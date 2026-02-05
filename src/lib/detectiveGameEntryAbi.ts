/**
 * DetectiveGameEntry V3 Smart Contract ABI
 * 
 * Deployed on Arbitrum One: [UPDATE AFTER DEPLOYMENT]
 * 
 * Streamlined design:
 * - Backend handles FID verification (off-chain)
 * - Contract handles stake/vote integrity (on-chain)
 * - Immutable treasury for trustlessness
 * - Simple emergency escape hatch
 */

export const DETECTIVE_GAME_ENTRY_ABI = [
  // ============ Constants ============
  {
    type: 'function',
    name: 'USDC',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MIN_STAKE_NATIVE',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MAX_STAKE_NATIVE',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MIN_STAKE_USDC',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MAX_STAKE_USDC',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  // ============ State Variables ============
  {
    type: 'function',
    name: 'treasury',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'admin',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isPaused',
    inputs: [],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'minEntryFee',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  // ============ Mappings ============
  {
    type: 'function',
    name: 'registeredWallets',
    inputs: [{ name: 'wallet', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasVoted',
    inputs: [
      { name: 'matchId', type: 'bytes32', internalType: 'bytes32' },
      { name: 'user', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'userStakes',
    inputs: [
      { name: 'matchId', type: 'bytes32', internalType: 'bytes32' },
      { name: 'user', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  // ============ Core Functions ============
  {
    type: 'function',
    name: 'registerForGame',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'stakeOnMatch',
    inputs: [
      { name: 'matchId', type: 'bytes32', internalType: 'bytes32' },
      { name: 'isBot', type: 'bool', internalType: 'bool' },
      { name: 'deadline', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'stakeOnMatchUSDC',
    inputs: [
      { name: 'matchId', type: 'bytes32', internalType: 'bytes32' },
      { name: 'isBot', type: 'bool', internalType: 'bool' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
      { name: 'deadline', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'submitVote',
    inputs: [
      { name: 'matchId', type: 'bytes32', internalType: 'bytes32' },
      { name: 'isBot', type: 'bool', internalType: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // ============ Admin Functions ============
  {
    type: 'function',
    name: 'transferAdmin',
    inputs: [{ name: 'newAdmin', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setPaused',
    inputs: [{ name: 'paused', type: 'bool', internalType: 'bool' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setMinEntryFee',
    inputs: [{ name: 'newFee', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'emergencyWithdraw',
    inputs: [
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'to', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // ============ View Functions ============
  {
    type: 'function',
    name: 'isWalletRegistered',
    inputs: [{ name: 'wallet', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasUserVoted',
    inputs: [
      { name: 'matchId', type: 'bytes32', internalType: 'bytes32' },
      { name: 'user', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getUserStake',
    inputs: [
      { name: 'matchId', type: 'bytes32', internalType: 'bytes32' },
      { name: 'user', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getStakeLimits',
    inputs: [],
    outputs: [
      { name: 'minNative', type: 'uint256', internalType: 'uint256' },
      { name: 'maxNative', type: 'uint256', internalType: 'uint256' },
      { name: 'minUsdc', type: 'uint256', internalType: 'uint256' },
      { name: 'maxUsdc', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'getContractInfo',
    inputs: [],
    outputs: [
      { name: '_treasury', type: 'address', internalType: 'address' },
      { name: '_admin', type: 'address', internalType: 'address' },
      { name: '_isPaused', type: 'bool', internalType: 'bool' },
      { name: '_minEntryFee', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  // ============ Events ============
  {
    type: 'event',
    name: 'PlayerRegistered',
    inputs: [
      { name: 'wallet', type: 'address', indexed: true, internalType: 'address' },
      { name: 'timestamp', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'StakePlaced',
    inputs: [
      { name: 'wallet', type: 'address', indexed: true, internalType: 'address' },
      { name: 'matchId', type: 'bytes32', indexed: true, internalType: 'bytes32' },
      { name: 'isBot', type: 'bool', indexed: false, internalType: 'bool' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'isNative', type: 'bool', indexed: false, internalType: 'bool' },
    ],
  },
  {
    type: 'event',
    name: 'VoteSubmitted',
    inputs: [
      { name: 'wallet', type: 'address', indexed: true, internalType: 'address' },
      { name: 'matchId', type: 'bytes32', indexed: true, internalType: 'bytes32' },
      { name: 'isBot', type: 'bool', indexed: false, internalType: 'bool' },
    ],
  },
  {
    type: 'event',
    name: 'AdminTransferred',
    inputs: [
      { name: 'oldAdmin', type: 'address', indexed: true, internalType: 'address' },
      { name: 'newAdmin', type: 'address', indexed: true, internalType: 'address' },
    ],
  },
  {
    type: 'event',
    name: 'PauseStatusChanged',
    inputs: [
      { name: 'isPaused', type: 'bool', indexed: false, internalType: 'bool' },
    ],
  },
  {
    type: 'event',
    name: 'MinEntryFeeUpdated',
    inputs: [
      { name: 'newFee', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'EmergencyWithdrawal',
    inputs: [
      { name: 'token', type: 'address', indexed: true, internalType: 'address' },
      { name: 'to', type: 'address', indexed: true, internalType: 'address' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
  // ============ Errors ============
  {
    type: 'error',
    name: 'ContractPaused',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidAmount',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidMatchId',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidDeadline',
    inputs: [],
  },
  {
    type: 'error',
    name: 'StakeTooHigh',
    inputs: [],
  },
  {
    type: 'error',
    name: 'StakeTooLow',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientFee',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AlreadyRegistered',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotRegistered',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AlreadyVoted',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AlreadyStaked',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ExpiredDeadline',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotAdmin',
    inputs: [],
  },
  {
    type: 'error',
    name: 'TransferFailed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'USDCTransferFailed',
    inputs: [],
  },
] as const;

// Contract addresses by network
export const DETECTIVE_GAME_ENTRY_ADDRESSES = {
  arbitrumOne: '0x0000000000000000000000000000000000000000' as const, // Update after deployment
  arbitrumSepolia: '0x0000000000000000000000000000000000000000' as const, // Update after testnet deployment
} as const;

// Default to mainnet (update after deployment)
export const CONTRACT_ADDRESS = DETECTIVE_GAME_ENTRY_ADDRESSES.arbitrumOne;

// Stake limits for client-side validation
export const STAKE_LIMITS = {
  native: {
    min: '100000000000000',     // 0.0001 ETH in wei
    max: '100000000000000000',  // 0.1 ETH in wei
  },
  usdc: {
    min: 1000000,   // 1 USDC (6 decimals)
    max: 100000000, // 100 USDC (6 decimals)
  },
} as const;

// Types for TypeScript
export type DetectiveGameEntryEvents = 
  | 'PlayerRegistered'
  | 'StakePlaced'
  | 'VoteSubmitted'
  | 'AdminTransferred'
  | 'PauseStatusChanged'
  | 'MinEntryFeeUpdated'
  | 'EmergencyWithdrawal';

export type DetectiveGameEntryErrors =
  | 'ContractPaused'
  | 'InvalidAddress'
  | 'InvalidAmount'
  | 'InvalidMatchId'
  | 'InvalidDeadline'
  | 'StakeTooHigh'
  | 'StakeTooLow'
  | 'InsufficientFee'
  | 'AlreadyRegistered'
  | 'NotRegistered'
  | 'AlreadyVoted'
  | 'AlreadyStaked'
  | 'ExpiredDeadline'
  | 'NotAdmin'
  | 'TransferFailed'
  | 'USDCTransferFailed';
