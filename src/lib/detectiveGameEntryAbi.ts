/**
 * DetectiveGameEntry Smart Contract ABI
 * 
 * Deployed on Arbitrum One: 0xa879B5CbD12b6137fCcf70669D48F55666296357
 * Verified: https://arbitrum.blockscout.com/address/0xa879B5CbD12b6137fCcf70669D48F55666296357
 * 
 * Purpose: Minimal proof-of-intent contract with multi-currency staking
 * - registerForGame(uint256 fid, uint256 nonce, uint256 deadline, bytes signature): 
 *     Register wallet with FID using signature verification
 * - stakeOnMatch(bytes32 matchId, bool isBot, uint256 deadline): 
 *     Stake native ETH/ARB on match outcome
 * - stakeOnMatchUSDC(bytes32 matchId, bool isBot, uint256 amount, uint256 deadline): 
 *     Stake USDC on match outcome
 * - submitVote(bytes32 matchId, bool isBot): 
 *     Submit vote without stake
 * 
 * Admin Functions:
 * - transferAdmin(address newAdmin): Transfer admin role
 * - setPaused(bool paused): Emergency pause/unpause
 * - setMinEntryFee(uint256 newFee): Update minimum entry fee
 * 
 * Security Features:
 * - Signature verification for FID registration (prevents spoofing)
 * - Deadline parameters prevent stale transactions
 * - Min/max stake limits prevent dust attacks and griefing
 * - Non-custodial: all funds forwarded directly to treasury
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
    name: 'MAX_STAKE_NATIVE',
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
  {
    type: 'function',
    name: 'MIN_STAKE_NATIVE',
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
  // ============ State Variables ============
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
  {
    type: 'function',
    name: 'treasury',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  // ============ Mappings ============
  {
    type: 'function',
    name: 'registeredFids',
    inputs: [{ name: 'fid', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'registeredWallets',
    inputs: [{ name: 'wallet', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'registrationNonces',
    inputs: [{ name: 'fid', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  // ============ Core Functions ============
  {
    type: 'function',
    name: 'registerForGame',
    inputs: [
      { name: 'fid', type: 'uint256', internalType: 'uint256' },
      { name: 'nonce', type: 'uint256', internalType: 'uint256' },
      { name: 'deadline', type: 'uint256', internalType: 'uint256' },
      { name: 'signature', type: 'bytes', internalType: 'bytes' },
    ],
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
  // ============ View Functions ============
  {
    type: 'function',
    name: 'isFidRegistered',
    inputs: [{ name: 'fid', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isWalletRegistered',
    inputs: [{ name: 'wallet', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getRegistrationNonce',
    inputs: [{ name: 'fid', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  // ============ Events ============
  {
    type: 'event',
    name: 'PlayerRegistered',
    inputs: [
      { name: 'wallet', type: 'address', indexed: true, internalType: 'address' },
      { name: 'fid', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'timestamp', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'nonce', type: 'uint256', indexed: false, internalType: 'uint256' },
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
    ],
  },
  {
    type: 'event',
    name: 'StakePlacedERC20',
    inputs: [
      { name: 'wallet', type: 'address', indexed: true, internalType: 'address' },
      { name: 'matchId', type: 'bytes32', indexed: true, internalType: 'bytes32' },
      { name: 'isBot', type: 'bool', indexed: false, internalType: 'bool' },
      { name: 'token', type: 'address', indexed: false, internalType: 'address' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
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
    name: 'InvalidFID',
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
    name: 'FIDAlreadyRegistered',
    inputs: [],
  },
  {
    type: 'error',
    name: 'WalletAlreadyRegistered',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidSignature',
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
  arbitrumOne: '0xa879B5CbD12b6137fCcf70669D48F55666296357' as const,
  arbitrumSepolia: '0x0000000000000000000000000000000000000000' as const, // Update after testnet deployment
} as const;

// Default to mainnet
export const CONTRACT_ADDRESS = DETECTIVE_GAME_ENTRY_ADDRESSES.arbitrumOne;

// Stake limits for client-side validation
export const STAKE_LIMITS = {
  native: {
    min: '100000000000000', // 0.0001 ETH in wei
    max: '100000000000000000', // 0.1 ETH in wei
  },
  usdc: {
    min: 1000000, // 1 USDC (6 decimals)
    max: 100000000, // 100 USDC (6 decimals)
  },
} as const;

// EIP-712 Domain for signature verification
export const REGISTRATION_DOMAIN = {
  name: 'DetectiveGame',
  version: '1',
  chainId: 42161, // Arbitrum One
} as const;

// Types for TypeScript
export type DetectiveGameEntryEvents = 
  | 'PlayerRegistered'
  | 'StakePlaced'
  | 'StakePlacedERC20'
  | 'VoteSubmitted'
  | 'AdminTransferred'
  | 'PauseStatusChanged'
  | 'MinEntryFeeUpdated';

export type DetectiveGameEntryErrors =
  | 'ContractPaused'
  | 'InvalidAddress'
  | 'InvalidFID'
  | 'InvalidAmount'
  | 'InvalidMatchId'
  | 'InvalidDeadline'
  | 'StakeTooHigh'
  | 'StakeTooLow'
  | 'InsufficientFee'
  | 'FIDAlreadyRegistered'
  | 'WalletAlreadyRegistered'
  | 'InvalidSignature'
  | 'ExpiredDeadline'
  | 'NotAdmin'
  | 'TransferFailed'
  | 'USDCTransferFailed';
