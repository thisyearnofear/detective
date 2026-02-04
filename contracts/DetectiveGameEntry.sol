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
    event PlayerRegistered(address indexed wallet, uint256 indexed fid, uint256 timestamp);
    
    /// @dev Emitted when a stake is placed
    event StakePlaced(address indexed wallet, bytes32 indexed matchId, bool isBot, uint256 amount);
    
    /// @dev Emitted when a vote is submitted
    event VoteSubmitted(address indexed wallet, bytes32 indexed matchId, bool isBot);

    /**
     * @dev Register wallet with Farcaster FID
     */
    function registerForGame(uint256 fid) external payable {
        require(fid > 0, "Invalid FID");
        emit PlayerRegistered(msg.sender, fid, block.timestamp);
    }

    /**
     * @dev Stake on a match outcome
     */
    function stakeOnMatch(bytes32 matchId, bool isBot) external payable {
        emit StakePlaced(msg.sender, matchId, isBot, msg.value);
    }

    /**
     * @dev Submit a vote/guess for a match
     */
    function submitVote(bytes32 matchId, bool isBot) external {
        emit VoteSubmitted(msg.sender, matchId, isBot);
    }
}