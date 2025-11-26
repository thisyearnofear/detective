// src/app/api/access/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { checkUserAccess, ACCESS_CONFIG } from "@/lib/accessControl";

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, fid } = await request.json();

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: "Wallet address is required" },
        { status: 400 }
      );
    }

    console.log(`[AccessVerify] Checking access for wallet: ${walletAddress}, FID: ${fid}`);

    const accessStatus = await checkUserAccess(walletAddress, fid);

    return NextResponse.json({
      success: true,
      hasAccess: accessStatus.hasAccess,
      accessMethod: accessStatus.accessMethod,
      requirements: accessStatus.requirements,
      message: accessStatus.message,
      config: {
        gatingEnabled: ACCESS_CONFIG.GATING_ENABLED,
        arbitrumNFTEnabled: ACCESS_CONFIG.ARBITRUM_NFT.enabled,
        monadTokenEnabled: ACCESS_CONFIG.MONAD_TOKEN.enabled,
        whitelistEnabled: ACCESS_CONFIG.WHITELIST.enabled,
      }
    });

  } catch (error: any) {
    console.error("[AccessVerify] Error verifying access:", error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to verify access",
        hasAccess: ACCESS_CONFIG.WHITELIST.adminOverride, // Fail open if admin override
        accessMethod: ACCESS_CONFIG.WHITELIST.adminOverride ? 'admin' : null,
        message: ACCESS_CONFIG.WHITELIST.adminOverride ? 'Access granted via admin override' : 'Access verification failed'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("address");
    const fid = searchParams.get("fid");

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: "Wallet address is required" },
        { status: 400 }
      );
    }

    const accessStatus = await checkUserAccess(walletAddress, fid ? parseInt(fid) : undefined);

    return NextResponse.json({
      success: true,
      hasAccess: accessStatus.hasAccess,
      accessMethod: accessStatus.accessMethod,
      requirements: accessStatus.requirements,
      message: accessStatus.message,
    });

  } catch (error: any) {
    console.error("[AccessVerify] Error verifying access:", error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to verify access",
        hasAccess: ACCESS_CONFIG.WHITELIST.adminOverride,
        accessMethod: ACCESS_CONFIG.WHITELIST.adminOverride ? 'admin' : null,
      },
      { status: 500 }
    );
  }
}