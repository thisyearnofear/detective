// src/app/api/access/whitelist/check/route.ts
import { NextRequest, NextResponse } from "next/server";
// import { database } from "@/lib/database"; // TODO: Uncomment when database whitelist is implemented

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, fid } = await request.json();

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: "Wallet address is required" },
        { status: 400 }
      );
    }

    // Check if address or FID is whitelisted
    const isWhitelisted = await checkWhitelistStatus(walletAddress, fid);

    return NextResponse.json({
      success: true,
      whitelisted: isWhitelisted,
      walletAddress,
      fid,
    });

  } catch (error: any) {
    console.error("[WhitelistCheck] Error checking whitelist:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to check whitelist status",
        whitelisted: false 
      },
      { status: 500 }
    );
  }
}

async function checkWhitelistStatus(walletAddress: string, fid?: number): Promise<boolean> {
  try {
    // For now, implement a simple whitelist check
    // In production, this would check a database table
    
    // Hardcoded whitelist for immediate use (can be moved to env vars)
    const whitelistedAddresses = (process.env.WHITELISTED_ADDRESSES || '').split(',').filter(Boolean);
    const whitelistedFIDs = (process.env.WHITELISTED_FIDS || '').split(',').map(Number).filter(Boolean);
    
    // Check address whitelist
    if (whitelistedAddresses.includes(walletAddress.toLowerCase())) {
      return true;
    }
    
    // Check FID whitelist
    if (fid && whitelistedFIDs.includes(fid)) {
      return true;
    }
    
    // TODO: Check database whitelist table
    // const dbResult = await database.checkWhitelist(walletAddress, fid);
    // return dbResult.whitelisted;
    
    return false;
    
  } catch (error) {
    console.error('[WhitelistCheck] Error checking whitelist database:', error);
    return false;
  }
}