/**
 * DetectiveGameEntry Smart Contract ABI
 * 
 * Deployed on Arbitrum One: 0x2d0B651fE940f965AE239Ec6cF6EA35F502394ff
 * Verified: https://arbitrum.blockscout.com/address/0x2d0B651fE940f965AE239Ec6cF6EA35F502394ff
 * 
 * Purpose: Minimal proof-of-intent contract
 * - registerForGame(uint256 fid): Record wallet registration with FID
 * - hasRegistered(address wallet, uint256 fid): Check registration status
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
    name: 'registered',
    inputs: [
      {
        name: 'wallet',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'fid',
        type: 'uint256',
        internalType: 'uint256',
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
    name: 'hasRegistered',
    inputs: [
      {
        name: 'wallet',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'fid',
        type: 'uint256',
        internalType: 'uint256',
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
    type: 'event',
    name: 'PlayerRegistered',
    inputs: [
      {
        name: 'wallet',
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
] as const;

export const CONTRACT_ADDRESS = '0x2d0B651fE940f965AE239Ec6cF6EA35F502394ff' as const;
