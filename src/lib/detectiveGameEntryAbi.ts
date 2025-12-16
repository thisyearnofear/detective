/**
 * DetectiveGameEntry Smart Contract ABI
 * 
 * Deployed on Arbitrum One: 0x2d0B651fE940f965AE239Ec6cF6EA35F502394ff
 * Verified: https://arbitrum.blockscout.com/address/0x2d0B651fE940f965AE239Ec6cF6EA35F502394ff
 * Source: https://repo.sourcify.dev/42161/0x2d0B651fE940f965AE239Ec6cF6EA35F502394ff
 * 
 * Purpose: Minimal proof-of-intent contract for registration gating
 * - Records registration transactions on-chain
 * - Enforces one-time registration per wallet per cycle
 * - Supports fee updates and emergency pause state
 * 
 * Functions:
 * - registerForGame(uint256 fid): Register with Farcaster FID
 * - transferAdmin(address newAdmin): Safely hand off admin role
 * - setPaused(bool paused): Emergency halt for registrations
 * - setMinEntryFee(uint256 fee): Adjust fees for future monetization
 * 
 * Events:
 * - PlayerRegistered(address indexed player, uint256 indexed fid, uint256 timestamp)
 * - AdminTransferred(address indexed oldAdmin, address indexed newAdmin)
 * - PauseStatusChanged(bool isPaused)
 * - MinEntryFeeUpdated(uint256 newFee)
 * 
 * Errors:
 * - ContractPaused: Registration attempted while contract is paused
 * - InvalidAddress: Invalid address provided (e.g., zero address)
 */

export const DETECTIVE_GAME_ENTRY_ABI = [
  {
    type: 'constructor',
    inputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'admin',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isPaused',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'minEntryFee',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'registrationCount',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasRegistered',
    inputs: [
      {
        name: 'player',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'playerFid',
    inputs: [
      {
        name: 'player',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'registerForGame',
    inputs: [
      {
        name: 'fid',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'transferAdmin',
    inputs: [
      {
        name: 'newAdmin',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setPaused',
    inputs: [
      {
        name: 'paused',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setMinEntryFee',
    inputs: [
      {
        name: 'fee',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'PlayerRegistered',
    inputs: [
      {
        name: 'player',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'fid',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'timestamp',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'event',
    name: 'AdminTransferred',
    inputs: [
      {
        name: 'oldAdmin',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'newAdmin',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
  },
  {
    type: 'event',
    name: 'PauseStatusChanged',
    inputs: [
      {
        name: 'isPaused',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
    ],
  },
  {
    type: 'event',
    name: 'MinEntryFeeUpdated',
    inputs: [
      {
        name: 'newFee',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
  },
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
] as const;

/**
 * Contract interfaces for type safety
 */
export interface DetectiveGameEntryEvents {
  PlayerRegistered: {
    player: string;
    fid: bigint;
    timestamp: bigint;
  };
  AdminTransferred: {
    oldAdmin: string;
    newAdmin: string;
  };
  PauseStatusChanged: {
    isPaused: boolean;
  };
  MinEntryFeeUpdated: {
    newFee: bigint;
  };
}

export interface DetectiveGameEntryErrors {
  ContractPaused: {};
  InvalidAddress: {};
}

/**
 * Contract deployment info
 */
export const DETECTIVE_GAME_ENTRY_ADDRESSES = {
  arbitrumOne: '0x2d0B651fE940f965AE239Ec6cF6EA35F502394ff' as const,
} as const;

export const DETECTIVE_GAME_ENTRY_LINKS = {
  blockscout: 'https://arbitrum.blockscout.com/address/0x2d0B651fE940f965AE239Ec6cF6EA35F502394ff',
  sourcify: 'https://repo.sourcify.dev/42161/0x2d0B651fE940f965AE239Ec6cF6EA35F502394ff',
} as const;
