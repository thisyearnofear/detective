/**
 * DetectiveGameEntry Smart Contract ABI
 * 
 * Deployed on Arbitrum One: 0xF749C3aAFf292d93E8Cc330A64E4589451d6E47D
 * Verified: https://arbitrum.blockscout.com/address/0xF749C3aAFf292d93E8Cc330A64E4589451d6E47D
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

export const CONTRACT_ADDRESS = '0xF749C3aAFf292d93E8Cc330A64E4589451d6E47D' as const;
