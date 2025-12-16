// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title DetectiveGameEntry
 * @dev Minimal proof-of-intent contract for Detective game registration on Arbitrum
 * 
 * PURPOSE:
 * - Record on-chain that a user (Farcaster FID) registered via EOA wallet
 * - Prevent sybil attacks (one registration per wallet)
 * - Measure traction (entry TX count per cycle)
 * - Optional future monetization (collect entry fees for Flow State)
 * 
 * DESIGN PRINCIPLES:
 * - Minimal surface area (no complex logic, no upgrades)
 * - Non-custodial (fees are optional, can stay 0)
 * - Transparent (all registrations are public on-chain)
 * - Gas efficient (single mapping lookup/update per registration)
 */

contract DetectiveGameEntry {
    // ========== STATE ==========
    
    /// @dev Address of contract admin (can withdraw collected fees if any)
    address public admin;
    
    /// @dev Minimum entry fee in wei (0 for free registration with TX proof)
    uint256 public minEntryFee;
    
    /// @dev Current game cycle ID (incremented by admin for new cycles)
    uint256 public currentCycleId;
    
    /// @dev Emergency pause flag (prevents new registrations if true)
    bool public paused;
    
    /// @dev wallet → cycleId → farcaster FID (prevent re-registration in same cycle)
    mapping(address => mapping(uint256 => uint256)) public registrations;
    
    /// @dev Total registrations per cycle (for traction metrics)
    mapping(uint256 => uint256) public cycleRegistrationCount;
    
    // ========== EVENTS ==========
    
    /// @dev Emitted when player registers for a game cycle
    /// @param wallet The EOA wallet that signed the TX
    /// @param farcasterFid The Farcaster FID being registered
    /// @param cycleId The game cycle ID
    /// @param fee Entry fee paid (0 if free)
    event PlayerRegistered(
        address indexed wallet,
        uint256 indexed farcasterFid,
        uint256 indexed cycleId,
        uint256 fee,
        uint256 timestamp
    );
    
    /// @dev Emitted when cycle advances
    event CycleAdvanced(uint256 newCycleId, uint256 timestamp);
    
    /// @dev Emitted when admin withdraws fees
    event FeesWithdrawn(address indexed to, uint256 amount);
    
    /// @dev Emitted when admin is transferred
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
    
    /// @dev Emitted when contract is paused/unpaused
    event PauseStatusChanged(bool isPaused, uint256 timestamp);
    
    /// @dev Emitted when minimum entry fee is updated
    event MinEntryFeeUpdated(uint256 newFee, uint256 timestamp);
    
    // ========== CONSTRUCTOR ==========
    
    constructor(uint256 _minEntryFee) {
        admin = msg.sender;
        minEntryFee = _minEntryFee; // 0 for free, or set to minimal amount
        currentCycleId = 1;
    }
    
    // ========== EXTERNAL FUNCTIONS ==========
    
    /**
     * @dev Register a player for the current game cycle
     * @param fid Farcaster FID to associate with this wallet
     * 
     * REQUIREMENTS:
     * - Contract is not paused
     * - msg.value >= minEntryFee
     * - fid has not been registered by this wallet in current cycle
     * - fid must be > 0 (valid Farcaster ID range starts at 1)
     * 
     * REVERTS:
     * - ContractPaused: if contract is paused
     * - InvalidFid: if fid is 0
     * - InsufficientFee: if msg.value < minEntryFee
     * - AlreadyRegistered: if this wallet already registered in this cycle
     */
    function registerForGame(uint256 fid) external payable {
        // Validate contract state
        if (paused) revert ContractPaused();
        
        // Validate inputs
        if (fid == 0) revert InvalidFid();
        if (msg.value < minEntryFee) revert InsufficientFee();
        if (registrations[msg.sender][currentCycleId] != 0) revert AlreadyRegistered();
        
        // Record registration
        registrations[msg.sender][currentCycleId] = fid;
        cycleRegistrationCount[currentCycleId]++;
        
        // Emit event (proof on-chain)
        emit PlayerRegistered(
            msg.sender,
            fid,
            currentCycleId,
            msg.value,
            block.timestamp
        );
    }
    
    /**
     * @dev Admin advances to next cycle (called weekly or when game transitions)
     * 
     * REQUIREMENTS:
     * - Only admin can call
     */
    function advanceCycle() external {
        if (msg.sender != admin) revert Unauthorized();
        
        currentCycleId++;
        emit CycleAdvanced(currentCycleId, block.timestamp);
    }
    
    /**
     * @dev Transfer admin rights to a new address
     * @param newAdmin The address to transfer admin rights to
     * 
     * REQUIREMENTS:
     * - Only current admin can call
     * - newAdmin must not be zero address
     */
    function transferAdmin(address newAdmin) external {
        if (msg.sender != admin) revert Unauthorized();
        if (newAdmin == address(0)) revert InvalidAddress();
        
        address previousAdmin = admin;
        admin = newAdmin;
        emit AdminTransferred(previousAdmin, newAdmin);
    }
    
    /**
     * @dev Pause or unpause registration
     * @param _paused True to pause registrations, false to allow them
     * 
     * REQUIREMENTS:
     * - Only admin can call
     * 
     * DESIGN NOTE:
     * - Allows emergency halt of registrations if needed
     * - Does not affect existing registrations or cycle management
     */
    function setPaused(bool _paused) external {
        if (msg.sender != admin) revert Unauthorized();
        paused = _paused;
        emit PauseStatusChanged(_paused, block.timestamp);
    }
    
    /**
     * @dev Update the minimum entry fee
     * @param newFee The new minimum fee in wei
     * 
     * REQUIREMENTS:
     * - Only admin can call
     * 
     * DESIGN NOTE:
     * - Allows future monetization by adjusting fees
     * - Can be set back to 0 for free registration
     */
    function setMinEntryFee(uint256 newFee) external {
        if (msg.sender != admin) revert Unauthorized();
        minEntryFee = newFee;
        emit MinEntryFeeUpdated(newFee, block.timestamp);
    }
    
    /**
     * @dev Admin withdraws accumulated fees (if any)
     * 
     * REQUIREMENTS:
     * - Only admin can call
     * - Contract balance > 0
     * 
     * DESIGN NOTE:
     * - Non-custodial: Players don't expect their fees back
     * - Optional: minEntryFee can be 0 (free registration)
     * - These fees could be sent to Flow State pool in future
     */
    function withdrawFees() external {
        if (msg.sender != admin) revert Unauthorized();
        
        uint256 balance = address(this).balance;
        if (balance == 0) revert NoFeesToWithdraw();
        
        (bool success, ) = admin.call{value: balance}("");
        if (!success) revert WithdrawalFailed();
        
        emit FeesWithdrawn(admin, balance);
    }
    
    // ========== VIEW FUNCTIONS ==========
    
    /**
     * @dev Check if a wallet has registered in current cycle
     * @param wallet The wallet to check
     * @return The FID if registered (0 if not)
     */
    function getRegistrationInCycle(address wallet) external view returns (uint256) {
        return registrations[wallet][currentCycleId];
    }
    
    /**
     * @dev Get registration count for a specific cycle (traction metric)
     * @param cycleId The cycle ID to query
     * @return Number of registrations in that cycle
     */
    function getRegistrationCount(uint256 cycleId) external view returns (uint256) {
        return cycleRegistrationCount[cycleId];
    }
    
    /**
     * @dev Get current cycle registration count
     * @return Number of registrations in current cycle
     */
    function getCurrentCycleCount() external view returns (uint256) {
        return cycleRegistrationCount[currentCycleId];
    }
    
    // ========== ERRORS ==========
    
    error InvalidFid();
    error InsufficientFee();
    error AlreadyRegistered();
    error Unauthorized();
    error NoFeesToWithdraw();
    error WithdrawalFailed();
    error ContractPaused();
    error InvalidAddress();
}
