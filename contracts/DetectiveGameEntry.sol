// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title DetectiveGameEntry V3
 * @dev Streamlined proof-of-intent contract for Detective game on Arbitrum
 * 
 * DESIGN PRINCIPLES:
 * - Minimal surface area (only what's needed)
 * - Backend handles FID verification (off-chain)
 * - Contract handles stake/vote integrity (on-chain)
 * - Immutable treasury for trustlessness
 * - Emergency escape hatch (but simple)
 * 
 * KEY FEATURES:
 * - Wallet registration (backend verifies FID ownership)
 * - Native + USDC staking with limits
 * - Vote tracking (prevent double votes)
 * - Admin pause/unpause
 * - Emergency withdrawal (if funds ever get stuck)
 */

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract DetectiveGameEntry {
    // ============ Constants ============
    
    /// @notice Arbitrum One USDC address
    address public constant USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    
    /// @notice Stake limits (prevents dust attacks and griefing)
    uint256 public constant MIN_STAKE_NATIVE = 0.0001 ether; // 0.0001 ETH
    uint256 public constant MAX_STAKE_NATIVE = 0.1 ether;    // 0.1 ETH
    uint256 public constant MIN_STAKE_USDC = 1e6;            // 1 USDC
    uint256 public constant MAX_STAKE_USDC = 100e6;          // 100 USDC
    
    // ============ State Variables ============
    
    /// @notice Treasury address (immutable for trustlessness)
    address public immutable treasury;
    
    /// @notice Current admin address
    address public admin;
    
    /// @notice Whether registrations/stakes are paused
    bool public isPaused;
    
    /// @notice Minimum entry fee for registration
    uint256 public minEntryFee;
    
    /// @notice Tracks registered wallets (backend verified FID off-chain)
    mapping(address => bool) public registeredWallets;
    
    /// @notice Tracks votes per match per user (prevents double voting)
    mapping(bytes32 => mapping(address => bool)) public hasVoted;
    
    /// @notice Tracks stakes per match per user (prevents double staking)
    mapping(bytes32 => mapping(address => uint256)) public userStakes;
    
    // ============ Events ============
    
    event PlayerRegistered(
        address indexed wallet,
        uint256 timestamp
    );
    
    event StakePlaced(
        address indexed wallet,
        bytes32 indexed matchId,
        bool isBot,
        uint256 amount,
        bool isNative
    );
    
    event VoteSubmitted(
        address indexed wallet,
        bytes32 indexed matchId,
        bool isBot
    );
    
    event AdminTransferred(
        address indexed oldAdmin,
        address indexed newAdmin
    );
    
    event PauseStatusChanged(bool isPaused);
    
    event MinEntryFeeUpdated(uint256 newFee);
    
    event EmergencyWithdrawal(
        address indexed token,
        address indexed to,
        uint256 amount
    );
    
    // ============ Errors ============
    
    error ContractPaused();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidMatchId();
    error InvalidDeadline();
    error StakeTooHigh();
    error StakeTooLow();
    error InsufficientFee();
    error AlreadyRegistered();
    error NotRegistered();
    error AlreadyVoted();
    error AlreadyStaked();
    error ExpiredDeadline();
    error NotAdmin();
    error TransferFailed();
    error USDCTransferFailed();
    
    // ============ Modifiers ============
    
    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }
    
    modifier whenNotPaused() {
        if (isPaused) revert ContractPaused();
        _;
    }
    
    modifier onlyRegistered() {
        if (!registeredWallets[msg.sender]) revert NotRegistered();
        _;
    }
    
    // ============ Constructor ============
    
    /**
     * @notice Deploys the contract
     * @param _treasury Address that receives all staked funds (immutable)
     * @param _admin Initial admin address (use your personal wallet for testing)
     */
    constructor(address _treasury, address _admin) {
        if (_treasury == address(0)) revert InvalidAddress();
        if (_admin == address(0)) revert InvalidAddress();
        
        treasury = _treasury;
        admin = _admin;
        isPaused = false;
        minEntryFee = 0;
    }
    
    // ============ External Functions ============
    
    /**
     * @notice Register wallet for the game
     * @dev Backend verifies FID ownership off-chain before this call
     * @dev Entry fee goes directly to treasury (non-custodial)
     */
    function registerForGame() external payable whenNotPaused {
        if (registeredWallets[msg.sender]) revert AlreadyRegistered();
        if (msg.value < minEntryFee) revert InsufficientFee();
        
        registeredWallets[msg.sender] = true;
        
        // Forward entry fee to treasury if any
        if (msg.value > 0) {
            (bool sent, ) = treasury.call{value: msg.value}("");
            if (!sent) revert TransferFailed();
        }
        
        emit PlayerRegistered(msg.sender, block.timestamp);
    }
    
    /**
     * @notice Stake native ETH/ARB on a match outcome
     * @param matchId The match identifier (bytes32)
     * @param isBot Player's guess (true = bot, false = human)
     * @param deadline Timestamp after which stake expires (safety)
     */
    function stakeOnMatch(
        bytes32 matchId,
        bool isBot,
        uint256 deadline
    ) external payable whenNotPaused onlyRegistered {
        if (matchId == bytes32(0)) revert InvalidMatchId();
        if (block.timestamp > deadline) revert ExpiredDeadline();
        if (msg.value < MIN_STAKE_NATIVE) revert StakeTooLow();
        if (msg.value > MAX_STAKE_NATIVE) revert StakeTooHigh();
        if (userStakes[matchId][msg.sender] > 0) revert AlreadyStaked();
        
        userStakes[matchId][msg.sender] = msg.value;
        
        // Forward stake to treasury (non-custodial)
        (bool sent, ) = treasury.call{value: msg.value}("");
        if (!sent) revert TransferFailed();
        
        emit StakePlaced(msg.sender, matchId, isBot, msg.value, true);
    }
    
    /**
     * @notice Stake USDC on a match outcome
     * @param matchId The match identifier (bytes32)
     * @param isBot Player's guess (true = bot, false = human)
     * @param amount USDC amount in base units (6 decimals)
     * @param deadline Timestamp after which stake expires (safety)
     */
    function stakeOnMatchUSDC(
        bytes32 matchId,
        bool isBot,
        uint256 amount,
        uint256 deadline
    ) external whenNotPaused onlyRegistered {
        if (matchId == bytes32(0)) revert InvalidMatchId();
        if (block.timestamp > deadline) revert ExpiredDeadline();
        if (amount < MIN_STAKE_USDC) revert StakeTooLow();
        if (amount > MAX_STAKE_USDC) revert StakeTooHigh();
        if (userStakes[matchId][msg.sender] > 0) revert AlreadyStaked();
        
        userStakes[matchId][msg.sender] = amount;
        
        // Transfer USDC from player to treasury
        bool success = IERC20(USDC).transferFrom(msg.sender, treasury, amount);
        if (!success) revert USDCTransferFailed();
        
        emit StakePlaced(msg.sender, matchId, isBot, amount, false);
    }
    
    /**
     * @notice Submit a vote/guess for a match
     * @param matchId The match identifier (bytes32)
     * @param isBot Player's guess (true = bot, false = human)
     */
    function submitVote(
        bytes32 matchId,
        bool isBot
    ) external whenNotPaused onlyRegistered {
        if (matchId == bytes32(0)) revert InvalidMatchId();
        if (hasVoted[matchId][msg.sender]) revert AlreadyVoted();
        
        hasVoted[matchId][msg.sender] = true;
        
        emit VoteSubmitted(msg.sender, matchId, isBot);
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Transfer admin role (one-step, use with care)
     * @param newAdmin The new admin address
     * @dev For production, consider two-step transfer. For testing, this is fine.
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert InvalidAddress();
        
        address oldAdmin = admin;
        admin = newAdmin;
        
        emit AdminTransferred(oldAdmin, newAdmin);
    }
    
    /**
     * @notice Pause or unpause the contract
     * @param paused True to pause, false to unpause
     */
    function setPaused(bool paused) external onlyAdmin {
        isPaused = paused;
        emit PauseStatusChanged(paused);
    }
    
    /**
     * @notice Update minimum entry fee
     * @param newFee New minimum fee in wei
     */
    function setMinEntryFee(uint256 newFee) external onlyAdmin {
        minEntryFee = newFee;
        emit MinEntryFeeUpdated(newFee);
    }
    
    /**
     * @notice Emergency withdrawal of stuck funds
     * @dev Only use if funds get stuck (e.g., treasury contract broken)
     * @param token Token address (address(0) for native)
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(
        address token,
        address to,
        uint256 amount
    ) external onlyAdmin {
        if (to == address(0)) revert InvalidAddress();
        
        if (token == address(0)) {
            (bool sent, ) = to.call{value: amount}("");
            if (!sent) revert TransferFailed();
        } else {
            bool success = IERC20(token).transfer(to, amount);
            if (!success) revert TransferFailed();
        }
        
        emit EmergencyWithdrawal(token, to, amount);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Check if a wallet is registered
     */
    function isWalletRegistered(address wallet) external view returns (bool) {
        return registeredWallets[wallet];
    }
    
    /**
     * @notice Check if user has voted on a match
     */
    function hasUserVoted(bytes32 matchId, address user) external view returns (bool) {
        return hasVoted[matchId][user];
    }
    
    /**
     * @notice Get user's stake on a match
     */
    function getUserStake(bytes32 matchId, address user) external view returns (uint256) {
        return userStakes[matchId][user];
    }
    
    /**
     * @notice Get stake limits
     */
    function getStakeLimits() external pure returns (
        uint256 minNative,
        uint256 maxNative,
        uint256 minUsdc,
        uint256 maxUsdc
    ) {
        return (
            MIN_STAKE_NATIVE,
            MAX_STAKE_NATIVE,
            MIN_STAKE_USDC,
            MAX_STAKE_USDC
        );
    }
    
    /**
     * @notice Get contract info
     */
    function getContractInfo() external view returns (
        address _treasury,
        address _admin,
        bool _isPaused,
        uint256 _minEntryFee
    ) {
        return (
            treasury,
            admin,
            isPaused,
            minEntryFee
        );
    }
}
