/**
 * DetectiveGameEntry Smart Contract ABI
 * 
 * Deployed on Arbitrum One: 0xa879B5CbD12b6137fCcf70669D48F55666296357
 * Verified: https://arbitrum.blockscout.com/address/0xa879B5CbD12b6137fCcf70669D48F55666296357
 * 
 * Purpose: Minimal proof-of-intent contract
 * - registerForGame(uint256 fid): Record wallet registration with FID on-chain
 * - Events serve as proof; backend enforces game cycle logic
 */

export const DETECTIVE_GAME_ENTRY_ABI = [
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

export const CONTRACT_ADDRESS = '0xa879B5CbD12b6137fCcf70669D48F55666296357' as const;
