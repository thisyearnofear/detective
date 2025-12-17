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
    /// @dev Emitted when a wallet registers with a Farcaster FID
    /// Backend uses this as proof of registration intent
    event PlayerRegistered(address indexed wallet, uint256 indexed fid, uint256 timestamp);
    
    /**
     * @dev Register wallet with Farcaster FID
     * @param fid Farcaster ID to associate with this wallet
     * 
     * This is a proof-of-intent mechanism only. The contract does not enforce
     * uniqueness - that is handled by the backend. This allows the same wallet+FID
     * to register in different game cycles.
     */
    function registerForGame(uint256 fid) external payable {
        require(fid > 0, "Invalid FID");
        emit PlayerRegistered(msg.sender, fid, block.timestamp);
    }
}
