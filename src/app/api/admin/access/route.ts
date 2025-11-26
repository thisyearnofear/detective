// src/app/api/admin/access/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ACCESS_CONFIG } from "@/lib/accessControl";

/**
 * Admin endpoint to check and update access control configuration
 * Useful for monitoring and quick configuration changes
 */

// Simple admin authentication (replace with proper auth)
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'your_admin_secret';

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  return authHeader === `Bearer ${ADMIN_SECRET}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return NextResponse.json({
      success: true,
      currentConfig: {
        gatingEnabled: ACCESS_CONFIG.GATING_ENABLED,
        arbitrumNFT: {
          enabled: ACCESS_CONFIG.ARBITRUM_NFT.enabled,
          contract: ACCESS_CONFIG.ARBITRUM_NFT.contractAddress || null,
          minimumBalance: ACCESS_CONFIG.ARBITRUM_NFT.minimumBalance,
        },
        monadToken: {
          enabled: ACCESS_CONFIG.MONAD_TOKEN.enabled,
          contract: ACCESS_CONFIG.MONAD_TOKEN.contractAddress || null,
          minimumBalance: ACCESS_CONFIG.MONAD_TOKEN.minimumBalance.toString(),
          decimals: ACCESS_CONFIG.MONAD_TOKEN.decimals,
        },
        whitelist: {
          enabled: ACCESS_CONFIG.WHITELIST.enabled,
          adminOverride: ACCESS_CONFIG.WHITELIST.adminOverride,
        },
      },
      instructions: {
        activateNFTGating: "Set NEXT_PUBLIC_ACCESS_GATING_ENABLED=true and NEXT_PUBLIC_ARBITRUM_NFT_ENABLED=true",
        activateTokenGating: "Set NEXT_PUBLIC_ACCESS_GATING_ENABLED=true and NEXT_PUBLIC_MONAD_TOKEN_ENABLED=true",
        addContracts: "Set NEXT_PUBLIC_ARBITRUM_NFT_CONTRACT and NEXT_PUBLIC_MONAD_TOKEN_CONTRACT",
        quickStart: "See .env.local.example for configuration examples",
      }
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { action, data } = await request.json();

    switch (action) {
      case 'test_access':
        // Test access for a specific address
        const { walletAddress, fid } = data;
        const { checkUserAccess } = await import('@/lib/accessControl');
        const result = await checkUserAccess(walletAddress, fid);
        
        return NextResponse.json({
          success: true,
          testResult: result,
        });

      case 'add_whitelist':
        // Add address/FID to whitelist (would update database in production)
        const { addresses, fids } = data;
        
        // For now, just return success (implement database update)
        return NextResponse.json({
          success: true,
          message: 'Whitelist updated (implement database storage)',
          added: { addresses, fids }
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}