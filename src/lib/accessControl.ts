// src/lib/accessControl.ts
import { createPublicClient, http, Address } from 'viem';
import { arbitrum, base } from 'viem/chains'; // Using base for mainnet compatibility
import { erc20Abi, erc721Abi } from 'viem';

// Access control configuration - easily configurable
export const ACCESS_CONFIG = {
  // Master switch - set to true to enable gating
  GATING_ENABLED: process.env.NEXT_PUBLIC_ACCESS_GATING_ENABLED === 'true',
  
  // Arbitrum NFT Configuration
  ARBITRUM_NFT: {
    enabled: process.env.NEXT_PUBLIC_ARBITRUM_NFT_ENABLED === 'true',
    contractAddress: (process.env.NEXT_PUBLIC_ARBITRUM_NFT_CONTRACT || '') as Address,
    minimumBalance: parseInt(process.env.NEXT_PUBLIC_ARBITRUM_NFT_MIN_BALANCE || '1'),
  },
  
  // Monad Token Configuration (using Base for now as example)
  MONAD_TOKEN: {
    enabled: process.env.NEXT_PUBLIC_MONAD_TOKEN_ENABLED === 'true',
    contractAddress: (process.env.NEXT_PUBLIC_MONAD_TOKEN_CONTRACT || '') as Address,
    minimumBalance: BigInt(process.env.NEXT_PUBLIC_MONAD_TOKEN_MIN_BALANCE || '1000000000000000000'), // 1 token with 18 decimals
    decimals: parseInt(process.env.NEXT_PUBLIC_MONAD_TOKEN_DECIMALS || '18'),
  },
  
  // Whitelist Configuration
  WHITELIST: {
    enabled: process.env.NEXT_PUBLIC_WHITELIST_ENABLED === 'true',
    adminOverride: process.env.NEXT_PUBLIC_ADMIN_OVERRIDE === 'true',
  }
};

// RPC clients for blockchain queries
const arbitrumClient = createPublicClient({
  chain: arbitrum,
  transport: http(process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'),
});

const monadClient = createPublicClient({
  chain: base, // Will replace with monad when available
  transport: http(process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://mainnet.base.org'),
});

export interface AccessStatus {
  hasAccess: boolean;
  accessMethod: 'open' | 'nft' | 'token' | 'whitelist' | 'admin';
  requirements: {
    arbitrumNFT: {
      required: boolean;
      balance: number;
      minimumRequired: number;
      verified: boolean;
    };
    monadToken: {
      required: boolean;
      balance: bigint;
      minimumRequired: bigint;
      verified: boolean;
    };
    whitelist: {
      required: boolean;
      whitelisted: boolean;
    };
  };
  message?: string;
}

export async function checkUserAccess(
  walletAddress: string,
  fid?: number
): Promise<AccessStatus> {
  try {
    console.log(`[AccessControl] Checking access for ${walletAddress}, FID: ${fid}`);
    
    // If gating is disabled, everyone has access
    if (!ACCESS_CONFIG.GATING_ENABLED) {
      return {
        hasAccess: true,
        accessMethod: 'open',
        requirements: {
          arbitrumNFT: { required: false, balance: 0, minimumRequired: 0, verified: false },
          monadToken: { required: false, balance: 0n, minimumRequired: 0n, verified: false },
          whitelist: { required: false, whitelisted: false },
        },
        message: 'Open access - no requirements',
      };
    }

    const status: AccessStatus = {
      hasAccess: false,
      accessMethod: 'open',
      requirements: {
        arbitrumNFT: {
          required: ACCESS_CONFIG.ARBITRUM_NFT.enabled,
          balance: 0,
          minimumRequired: ACCESS_CONFIG.ARBITRUM_NFT.minimumBalance,
          verified: false,
        },
        monadToken: {
          required: ACCESS_CONFIG.MONAD_TOKEN.enabled,
          balance: 0n,
          minimumRequired: ACCESS_CONFIG.MONAD_TOKEN.minimumBalance,
          verified: false,
        },
        whitelist: {
          required: ACCESS_CONFIG.WHITELIST.enabled,
          whitelisted: false,
        },
      },
    };

    // Check Arbitrum NFT balance
    if (ACCESS_CONFIG.ARBITRUM_NFT.enabled && ACCESS_CONFIG.ARBITRUM_NFT.contractAddress) {
      try {
        const nftBalance = await arbitrumClient.readContract({
          address: ACCESS_CONFIG.ARBITRUM_NFT.contractAddress,
          abi: erc721Abi,
          functionName: 'balanceOf',
          args: [walletAddress as Address],
        });

        status.requirements.arbitrumNFT.balance = Number(nftBalance);
        status.requirements.arbitrumNFT.verified = Number(nftBalance) >= ACCESS_CONFIG.ARBITRUM_NFT.minimumBalance;

        if (status.requirements.arbitrumNFT.verified) {
          status.hasAccess = true;
          status.accessMethod = 'nft';
          status.message = `Access granted via Arbitrum NFT (${nftBalance} owned)`;
          return status;
        }
      } catch (error) {
        console.error('[AccessControl] Error checking NFT balance:', error);
      }
    }

    // Check Monad token balance
    if (ACCESS_CONFIG.MONAD_TOKEN.enabled && ACCESS_CONFIG.MONAD_TOKEN.contractAddress) {
      try {
        const tokenBalance = await monadClient.readContract({
          address: ACCESS_CONFIG.MONAD_TOKEN.contractAddress,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [walletAddress as Address],
        });

        status.requirements.monadToken.balance = tokenBalance;
        status.requirements.monadToken.verified = tokenBalance >= ACCESS_CONFIG.MONAD_TOKEN.minimumBalance;

        if (status.requirements.monadToken.verified) {
          status.hasAccess = true;
          status.accessMethod = 'token';
          const formattedBalance = Number(tokenBalance) / Math.pow(10, ACCESS_CONFIG.MONAD_TOKEN.decimals);
          status.message = `Access granted via Monad token (${formattedBalance.toFixed(2)} tokens)`;
          return status;
        }
      } catch (error) {
        console.error('[AccessControl] Error checking token balance:', error);
      }
    }

    // Check whitelist
    if (ACCESS_CONFIG.WHITELIST.enabled) {
      const isWhitelisted = await checkWhitelist(walletAddress, fid);
      status.requirements.whitelist.whitelisted = isWhitelisted;

      if (isWhitelisted) {
        status.hasAccess = true;
        status.accessMethod = 'whitelist';
        status.message = 'Access granted via whitelist';
        return status;
      }
    }

    // If no access method worked
    status.message = 'Access denied - requirements not met';
    return status;

  } catch (error) {
    console.error('[AccessControl] Error checking user access:', error);
    
    // Fail open if there's an error and admin override is enabled
    if (ACCESS_CONFIG.WHITELIST.adminOverride) {
      return {
        hasAccess: true,
        accessMethod: 'admin',
        requirements: {
          arbitrumNFT: { required: false, balance: 0, minimumRequired: 0, verified: false },
          monadToken: { required: false, balance: 0n, minimumRequired: 0n, verified: false },
          whitelist: { required: false, whitelisted: false },
        },
        message: 'Access granted via admin override due to system error',
      };
    }

    throw error;
  }
}

async function checkWhitelist(walletAddress: string, fid?: number): Promise<boolean> {
  try {
    // Check database whitelist
    const response = await fetch('/api/access/whitelist/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, fid }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.whitelisted === true;
    }

    return false;
  } catch (error) {
    console.error('[AccessControl] Error checking whitelist:', error);
    return false;
  }
}

// Helper function to format token amounts for display
export function formatTokenAmount(
  amount: bigint,
  decimals: number = 18,
  displayDecimals: number = 2
): string {
  const divisor = BigInt(Math.pow(10, decimals));
  const whole = amount / divisor;
  const fraction = amount % divisor;
  
  if (fraction === 0n) {
    return whole.toString();
  }
  
  const fractionStr = fraction.toString().padStart(decimals, '0');
  const trimmed = fractionStr.slice(0, displayDecimals);
  return `${whole}.${trimmed}`;
}

// Helper to get human-readable access requirements
export function getAccessRequirementsText(): string {
  if (!ACCESS_CONFIG.GATING_ENABLED) {
    return 'Open access - no requirements';
  }

  const requirements = [];
  
  if (ACCESS_CONFIG.ARBITRUM_NFT.enabled) {
    requirements.push(`${ACCESS_CONFIG.ARBITRUM_NFT.minimumBalance} Arbitrum NFT(s)`);
  }
  
  if (ACCESS_CONFIG.MONAD_TOKEN.enabled) {
    const minTokens = formatTokenAmount(ACCESS_CONFIG.MONAD_TOKEN.minimumBalance, ACCESS_CONFIG.MONAD_TOKEN.decimals);
    requirements.push(`${minTokens} Monad tokens`);
  }
  
  if (ACCESS_CONFIG.WHITELIST.enabled) {
    requirements.push('Whitelist approval');
  }

  if (requirements.length === 0) {
    return 'Access gating configured but no requirements set';
  }

  return `Requires any of: ${requirements.join(' OR ')}`;
}