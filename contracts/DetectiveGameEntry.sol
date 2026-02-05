// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title DetectiveGameEntry
 * @dev Minimal proof-of-intent contract for Detective game on Arbitrum
 * 
 * PURPOSE:
 * - Record on-chain registrations and stakes (native ETH/ARB + USDC)
 * - Prevent sybil attacks (one FID per wallet)
 * - All game logic, cycle management, and payouts handled by backend
 * 
 * DESIGN:
 * - Minimal surface area (single responsibility)
 * - Non-custodial (stakes forwarded to treasury, no fund management)
 * - Transparent (all registrations and stakes public on-chain)
 * - Multi-currency: Native + ERC20 (USDC) stakes
 * - Access controlled: Admin can pause and update parameters
 */

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract DetectiveGameEntry {
    // ============ Constants ============
    
    /// @notice Arbitrum One USDC address
    address public constant USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    
    /// @notice Maximum stake amount (0.1 ETH / 100 USDC) - prevents griefing
    uint256 public constant MAX_STAKE_NATIVE = 0.1 ether;
    uint256 public constant MAX_STAKE_USDC = 100 * 1e6; // 100 USDC (6 decimals)
    
    /// @notice Minimum stake amount - prevents dust attacks
    uint256 public constant MIN_STAKE_NATIVE = 0.0001 ether; // 0.0001 ETH
    uint256 public constant MIN_STAKE_USDC = 1e6; // 1 USDC
    
    // ============ State Variables ============
    
    /// @notice Treasury address for stake collection (set on deploy, immutable)
    address public immutable treasury;
    
    /// @notice Current admin address
    address public admin;
    
    /// @notice Whether registrations are paused
    bool public isPaused;
    
    /// @notice Minimum entry fee for registration (in wei)
    uint256 public minEntryFee;
    
    /// @notice Registration nonce tracking for FID verification
    mapping(uint256 => uint256) public registrationNonces;
    
    /// @notice Tracks registered FIDs to prevent sybil attacks
    mapping(uint256 => bool) public registeredFids;
    
    /// @notice Tracks registered wallets
    mapping(address => bool) public registeredWallets;
    
    // ============ Events ============
    
    /// @dev Emitted when a wallet registers with a Farcaster FID
    event PlayerRegistered(
        address indexed wallet, 
        uint256 indexed fid, 
        uint256 timestamp,
        uint256 nonce
    );
    
    /// @dev Emitted when a native (ETH/ARB) stake is placed
    event StakePlaced(
        address indexed wallet, 
        bytes32 indexed matchId, 
        bool isBot, 
        uint256 amount
    );
    
    /// @dev Emitted when an ERC20 stake is placed
    event StakePlacedERC20(
        address indexed wallet, 
        bytes32 indexed matchId, 
        bool isBot, 
        address token, 
        uint256 amount
    );
    
    /// @dev Emitted when a vote is submitted
    event VoteSubmitted(
        address indexed wallet, 
        bytes32 indexed matchId, 
        bool isBot
    );
    
    /// @dev Emitted when admin is transferred
    event AdminTransferred(
        address indexed oldAdmin, 
        address indexed newAdmin
    );
    
    /// @dev Emitted when pause status changes
    event PauseStatusChanged(bool isPaused);
    
    /// @dev Emitted when minimum entry fee is updated
    event MinEntryFeeUpdated(uint256 newFee);
    
    // ============ Errors ============
    
    error ContractPaused();
    error InvalidAddress();
    error InvalidFID();
    error InvalidAmount();
    error InvalidMatchId();
    error InvalidDeadline();
    error StakeTooHigh();
    error StakeTooLow();
    error InsufficientFee();
    error FIDAlreadyRegistered();
    error WalletAlreadyRegistered();
    error InvalidSignature();
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
    
    // ============ Constructor ============
    
    /**
     * @notice Deploys the contract with treasury address and sets deployer as admin
     * @param _treasury Address that will receive all staked funds (immutable)
     */
    constructor(address _treasury) {
        if (_treasury == address(0)) revert InvalidAddress();
        
        treasury = _treasury;
        admin = msg.sender;
        isPaused = false;
        minEntryFee = 0;
    }
    
    // ============ External Functions ============
    
    /**
     * @notice Register wallet with Farcaster FID using signature verification
     * @param fid The Farcaster ID being registered
     * @param nonce Unique nonce to prevent replay attacks
     * @param deadline Timestamp after which registration expires
     * @param signature EIP-712 signature from the FID owner authorizing this registration
     * 
     * Requirements:
     * - Contract must not be paused
     * - FID must not already be registered
     * - Wallet must not already be registered
     * - msg.value must be >= minEntryFee
     * - Signature must be valid and not expired
     */
    function registerForGame(
        uint256 fid,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external payable whenNotPaused {
        // Validate FID
        if (fid == 0) revert InvalidFID();
        
        // Check for sybil resistance
        if (registeredFids[fid]) revert FIDAlreadyRegistered();
        if (registeredWallets[msg.sender]) revert WalletAlreadyRegistered();
        
        // Check entry fee
        if (msg.value < minEntryFee) revert InsufficientFee();
        
        // Check deadline
        if (block.timestamp > deadline) revert ExpiredDeadline();
        
        // Verify nonce hasn't been used
        if (registrationNonces[fid] >= nonce) revert InvalidSignature();
        
        // Verify signature (simplified - in production, use EIP-712)
        bytes32 messageHash = keccak256(abi.encodePacked(
            msg.sender,
            fid,
            nonce,
            deadline,
            address(this),
            block.chainid
        ));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            messageHash
        ));
        address signer = recoverSigner(ethSignedMessageHash, signature);
        
        // In production, signer should be verified against Farcaster registry
        // For now, we accept any valid signature as proof of intent
        if (signer == address(0)) revert InvalidSignature();
        
        // Update state
        registeredFids[fid] = true;
        registeredWallets[msg.sender] = true;
        registrationNonces[fid] = nonce;
        
        // Forward entry fee to treasury if any
        if (msg.value > 0) {
            (bool sent, ) = treasury.call{value: msg.value}("");
            if (!sent) revert TransferFailed();
        }
        
        emit PlayerRegistered(msg.sender, fid, block.timestamp, nonce);
    }
    
    /**
     * @notice Stake native currency (ETH/ARB) on a match outcome
     * @param matchId The match identifier (bytes32 hash)
     * @param isBot Player's guess (true = bot, false = human)
     * @param deadline Timestamp after which stake expires
     * 
     * Requirements:
     * - Contract must not be paused
     * - msg.value must be between MIN_STAKE_NATIVE and MAX_STAKE_NATIVE
     * - Deadline must not have passed
     */
    function stakeOnMatch(
        bytes32 matchId,
        bool isBot,
        uint256 deadline
    ) external payable whenNotPaused {
        // Validate inputs
        if (matchId == bytes32(0)) revert InvalidMatchId();
        if (block.timestamp > deadline) revert ExpiredDeadline();
        if (msg.value < MIN_STAKE_NATIVE) revert StakeTooLow();
        if (msg.value > MAX_STAKE_NATIVE) revert StakeTooHigh();
        
        // Forward stake to treasury (non-custodial)
        (bool sent, ) = treasury.call{value: msg.value}("");
        if (!sent) revert TransferFailed();
        
        emit StakePlaced(msg.sender, matchId, isBot, msg.value);
    }
    
    /**
     * @notice Stake USDC on a match outcome
     * @param matchId The match identifier (bytes32 hash)
     * @param isBot Player's guess (true = bot, false = human)
     * @param amount USDC amount in base units (6 decimals)
     * @param deadline Timestamp after which stake expires
     * 
     * NOTE: Caller must approve this contract to spend USDC first
     * 
     * Requirements:
     * - Contract must not be paused
     * - Amount must be between MIN_STAKE_USDC and MAX_STAKE_USDC
     * - Deadline must not have passed
     * - USDC transfer must succeed
     */
    function stakeOnMatchUSDC(
        bytes32 matchId,
        bool isBot,
        uint256 amount,
        uint256 deadline
    ) external whenNotPaused {
        // Validate inputs
        if (matchId == bytes32(0)) revert InvalidMatchId();
        if (block.timestamp > deadline) revert ExpiredDeadline();
        if (amount < MIN_STAKE_USDC) revert StakeTooLow();
        if (amount > MAX_STAKE_USDC) revert StakeTooHigh();
        
        // Transfer USDC from player to treasury
        bool success = IERC20(USDC).transferFrom(msg.sender, treasury, amount);
        if (!success) revert USDCTransferFailed();
        
        emit StakePlacedERC20(msg.sender, matchId, isBot, USDC, amount);
    }
    
    /**
     * @notice Submit a vote/guess for a match (no stake required)
     * @param matchId The match identifier (bytes32 hash)
     * @param isBot Player's guess (true = bot, false = human)
     * 
     * Requirements:
     * - Contract must not be paused
     * - matchId must be valid (non-zero)
     */
    function submitVote(bytes32 matchId, bool isBot) external whenNotPaused {
        if (matchId == bytes32(0)) revert InvalidMatchId();
        
        emit VoteSubmitted(msg.sender, matchId, isBot);
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Transfer admin role to a new address
     * @param newAdmin The address to transfer admin rights to
     * 
     * Requirements:
     * - Only current admin can call
     * - newAdmin must not be zero address
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert InvalidAddress();
        
        address oldAdmin = admin;
        admin = newAdmin;
        
        emit AdminTransferred(oldAdmin, newAdmin);
    }
    
    /**
     * @notice Pause or unpause registrations and stakes
     * @param paused True to pause, false to unpause
     * 
     * Requirements:
     * - Only admin can call
     */
    function setPaused(bool paused) external onlyAdmin {
        isPaused = paused;
        emit PauseStatusChanged(paused);
    }
    
    /**
     * @notice Update the minimum entry fee for registration
     * @param newFee New minimum fee in wei
     * 
     * Requirements:
     * - Only admin can call
     */
    function setMinEntryFee(uint256 newFee) external onlyAdmin {
        minEntryFee = newFee;
        emit MinEntryFeeUpdated(newFee);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Check if a FID is already registered
     * @param fid The Farcaster ID to check
     * @return True if already registered
     */
    function isFidRegistered(uint256 fid) external view returns (bool) {
        return registeredFids[fid];
    }
    
    /**
     * @notice Check if a wallet is already registered
     * @param wallet The wallet address to check
     * @return True if already registered
     */
    function isWalletRegistered(address wallet) external view returns (bool) {
        return registeredWallets[wallet];
    }
    
    /**
     * @notice Get the current registration nonce for a FID
     * @param fid The Farcaster ID
     * @return The current nonce
     */
    function getRegistrationNonce(uint256 fid) external view returns (uint256) {
        return registrationNonces[fid];
    }
    
    // ============ Internal Functions ============
    
    /**
     * @notice Recover signer address from signature
     * @param ethSignedMessageHash The Ethereum signed message hash
     * @param signature The signature bytes
     * @return The recovered signer address
     */
    function recoverSigner(
        bytes32 ethSignedMessageHash,
        bytes memory signature
    ) internal pure returns (address) {
        if (signature.length != 65) return address(0);
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        
        if (v < 27) v += 27;
        
        if (v != 27 && v != 28) return address(0);
        
        return ecrecover(ethSignedMessageHash, v, r, s);
    }
}
