// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title DetectiveGameEntry
 * @dev Minimal proof-of-intent contract for Detective game registration on Arbitrum
 * 
 * PURPOSE:
 * - Record on-chain that a wallet registered for the game with a Farcaster FID
 * - Prevent sybil attacks (one FID per wallet)
 * - All game logic, cycle management, and state handled by backend
 * 
 * DESIGN:
 * - Minimal surface area (single responsibility)
 * - Non-custodial (no fees, no fund management)
 * - Transparent (all registrations public on-chain)
 * - Gas efficient (one mapping lookup/update per registration)
 */

contract DetectiveGameEntry {
    /// @dev wallet → fid → registered (prevent duplicate registrations)
    mapping(address wallet => mapping(uint256 fid => bool)) public registered;
    
    /// @dev Emitted when a wallet registers with a Farcaster FID
    event PlayerRegistered(address indexed wallet, uint256 indexed fid, uint256 timestamp);
    
    address public admin;
    
    constructor() {
        admin = msg.sender;
    }
    
    /**
     * @dev Register wallet with Farcaster FID
     * @param fid Farcaster ID to associate with this wallet
     * 
     * REQUIREMENTS:
     * - fid > 0 (valid Farcaster ID)
     * - This wallet hasn't registered this FID before
     */
    function registerForGame(uint256 fid) external payable {
        require(fid > 0, "Invalid FID");
        require(!registered[msg.sender][fid], "Already registered");
        
        registered[msg.sender][fid] = true;
        emit PlayerRegistered(msg.sender, fid, block.timestamp);
    }
    
    /**
     * @dev Check if a wallet has registered with a FID
     * @param wallet The wallet to check
     * @param fid The FID to check
     * @return true if wallet has registered with this FID
     */
    function hasRegistered(address wallet, uint256 fid) external view returns (bool) {
        return registered[wallet][fid];
    }
}
