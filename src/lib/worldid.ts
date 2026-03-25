// src/lib/worldid.ts
// World ID 4.0 Integration for Detective
// Uses RP signatures for secure verification requests

import { signRequest } from "@worldcoin/idkit/signing";

// Environment configuration
const RP_SIGNING_KEY = process.env.WORLD_RP_SIGNING_KEY;
const RP_ID = process.env.NEXT_PUBLIC_WORLD_RP_ID;

/**
 * Generate RP signature for World ID verification request
 * This is required for v4 - authenticates the request server-side
 */
export function generateRPSignature(action: string): {
  sig: string;
  nonce: string;
  created_at: string;
  expires_at: string;
} | null {
  if (!RP_SIGNING_KEY) {
    console.warn("[World ID] RP_SIGNING_KEY not configured");
    return null;
  }

  const signature = signRequest(action, RP_SIGNING_KEY);
  
  return {
    sig: signature.sig,
    nonce: String(signature.nonce),
    created_at: new Date(signature.createdAt).toISOString(),
    expires_at: new Date(signature.expiresAt).toISOString(),
  };
}

/**
 * Get World ID configuration
 */
export function getWorldIdConfig() {
  return {
    rpId: RP_ID || "rp_staging_placeholder",
  };
}

export function isWorldIdEnabled(): boolean {
  return !!RP_SIGNING_KEY && !!RP_ID;
}