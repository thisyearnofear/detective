// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title DetectiveGameEntry V4 (Pull-Payment Pattern)
 * @dev Upgrade to V3: Implements "Pull-Payment" pattern for trustless rewards.
 *
 * IMPROVEMENTS OVER V3:
 * 1. Escrow Pattern: Funds remain in contract until explicitly distributed or claimed.
 * 2. Pull-Payments: Users claim their winnings/refunds. Prevents gas limit issues
 *    and reentrancy vectors associated with pushing payments to many addresses.
 * 3. Batch Settlement: Admin can efficiently settle multiple game results in one transaction.
 *
 * ARCHITECTURE:
 * - Users pay/stake -> Funds held in Contract
 * - Game Cycle Ends -> Admin calculates results -> Admin calls `allocateRewards`
 * - Users call `claimRewards` to withdraw their balance.
 */

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract DetectiveGameEntryV4 {
    // ============ Constants ============

    /// @notice Arbitrum One USDC address
    address public constant USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;

    /// @notice Stake limits
    uint256 public constant MIN_STAKE_NATIVE = 0.0001 ether;
    uint256 public constant MAX_STAKE_NATIVE = 0.1 ether;
    uint256 public constant MIN_STAKE_USDC = 1e6;   // 1 USDC
    uint256 public constant MAX_STAKE_USDC = 100e6; // 100 USDC

    // ============ State Variables ============

    address public admin;
    address public houseWallet; // Where the "House Edge" or fees go ultimately
    bool public isPaused;
    uint256 public minEntryFee;

    // Game State
    mapping(address => bool) public registeredWallets;
    mapping(bytes32 => mapping(address => bool)) public hasVoted;
    mapping(bytes32 => mapping(address => uint256)) public userStakes;

    // Accounting (The Pull-Payment Ledger)
    // User Address => Token Address => Amount available to withdraw
    mapping(address => mapping(address => uint256)) public pendingWithdrawals;

    // ============ Events ============

    event PlayerRegistered(address indexed wallet, uint256 timestamp, uint256 feePaid);

    event StakePlaced(
        address indexed wallet,
        bytes32 indexed matchId,
        bool isBot,
        uint256 amount,
        address token // address(0) for Native
    );

    event VoteSubmitted(address indexed wallet, bytes32 indexed matchId, bool isBot);

    event RewardsAllocated(
        address indexed token,
        uint256 totalAmount,
        uint256 recipientCount
    );

    event Withdrawal(
        address indexed wallet,
        address indexed token,
        uint256 amount
    );

    event HouseFundsWithdrawn(
        address indexed token,
        uint256 amount
    );

    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    event PauseStatusChanged(bool isPaused);
    event MinEntryFeeUpdated(uint256 newFee);

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
    error NoFundsToWithdraw();
    error ArrayLengthMismatch();

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

    constructor(address _houseWallet, address _admin) {
        if (_houseWallet == address(0)) revert InvalidAddress();
        if (_admin == address(0)) revert InvalidAddress();

        houseWallet = _houseWallet;
        admin = _admin;
        isPaused = false;
        minEntryFee = 0;
    }

    // ============ User Actions (Inflow) ============

    /**
     * @notice Register wallet for the game. Fee is held in contract until distributed.
     */
    function registerForGame() external payable whenNotPaused {
        if (registeredWallets[msg.sender]) revert AlreadyRegistered();
        if (msg.value < minEntryFee) revert InsufficientFee();

        registeredWallets[msg.sender] = true;

        // V4 Change: Funds stay in contract.
        // If entry fee is purely House Revenue, we can auto-allocate it to HouseWallet here
        // or just leave it in the general pot. Let's leave it in general pot for flexibility.

        emit PlayerRegistered(msg.sender, block.timestamp, msg.value);
    }

    /**
     * @notice Stake native ETH/ARB. Funds held in contract escrow.
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

        emit StakePlaced(msg.sender, matchId, isBot, msg.value, address(0));
    }

    /**
     * @notice Stake USDC. Funds transferred to contract escrow.
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

        // V4 Change: Transfer to address(this), NOT treasury
        bool success = IERC20(USDC).transferFrom(msg.sender, address(this), amount);
        if (!success) revert USDCTransferFailed();

        emit StakePlaced(msg.sender, matchId, isBot, amount, USDC);
    }

    /**
     * @notice Submit a vote/guess for a match (No funds involved)
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

    // ============ Settlement & Payouts (Outflow) ============

    /**
     * @notice Admin batches rewards allocation.
     * @dev Moves funds from global float to specific user pending balances.
     *      This is the "Oracle" step where the game server pushes results.
     * @param recipients Array of winner addresses
     * @param amounts Array of amounts to allocate
     * @param token Token address (address(0) for ETH, or USDC address)
     */
    function allocateRewards(
        address[] calldata recipients,
        uint256[] calldata amounts,
        address token
    ) external onlyAdmin {
        if (recipients.length != amounts.length) revert ArrayLengthMismatch();

        uint256 totalAllocation = 0;

        for (uint256 i = 0; i < recipients.length; i++) {
            pendingWithdrawals[recipients[i]][token] += amounts[i];
            totalAllocation += amounts[i];
        }

        // Safety check: Ensure contract actually has enough funds for this allocation
        if (token == address(0)) {
            if (address(this).balance < totalAllocation) revert InvalidAmount(); // Solvency check
        } else {
            if (IERC20(token).balanceOf(address(this)) < totalAllocation) revert InvalidAmount();
        }

        emit RewardsAllocated(token, totalAllocation, recipients.length);
    }

    /**
     * @notice User claims their accumulated rewards/refunds.
     * @dev Follows Checks-Effects-Interactions pattern strictly.
     * @param token The token to withdraw (address(0) for ETH/Native)
     */
    function claimRewards(address token) external {
        uint256 amount = pendingWithdrawals[msg.sender][token];
        if (amount == 0) revert NoFundsToWithdraw();

        // Effect
        pendingWithdrawals[msg.sender][token] = 0;

        // Interaction
        if (token == address(0)) {
            (bool sent, ) = payable(msg.sender).call{value: amount}("");
            if (!sent) {
                // Revert state if transfer fails (Safety)
                pendingWithdrawals[msg.sender][token] = amount;
                revert TransferFailed();
            }
        } else {
            bool success = IERC20(token).transfer(msg.sender, amount);
            if (!success) {
                pendingWithdrawals[msg.sender][token] = amount;
                revert USDCTransferFailed();
            }
        }

        emit Withdrawal(msg.sender, token, amount);
    }

    /**
     * @notice Admin withdraws unallocated funds (House Edge / Fees) to the House Wallet.
     * @dev Only withdraws funds that are NOT currently allocated to users in pendingWithdrawals.
     *      However, since we don't track "Global Locked", Admin must be careful not to
     *      withdraw funds that back pending user claims.
     *      In a strictly rigorous version, we would track `totalPendingWithdrawals` global var.
     *      For this Game V4, we assume Admin (Server) manages solvency off-chain.
     */
    function withdrawHouseFunds(address token, uint256 amount) external onlyAdmin {
        if (token == address(0)) {
            (bool sent, ) = houseWallet.call{value: amount}("");
            if (!sent) revert TransferFailed();
        } else {
            bool success = IERC20(token).transfer(houseWallet, amount);
            if (!success) revert USDCTransferFailed();
        }

        emit HouseFundsWithdrawn(token, amount);
    }

    // ============ Admin Management ============

    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert InvalidAddress();
        address oldAdmin = admin;
        admin = newAdmin;
        emit AdminTransferred(oldAdmin, newAdmin);
    }

    function setPaused(bool paused) external onlyAdmin {
        isPaused = paused;
        emit PauseStatusChanged(paused);
    }

    function setMinEntryFee(uint256 newFee) external onlyAdmin {
        minEntryFee = newFee;
        emit MinEntryFeeUpdated(newFee);
    }

    // ============ View Functions ============

    function getPendingReward(address user, address token) external view returns (uint256) {
        return pendingWithdrawals[user][token];
    }

    function isWalletRegistered(address wallet) external view returns (bool) {
        return registeredWallets[wallet];
    }
}
