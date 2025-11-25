// src/app/api/ably/auth/route.ts
import { NextRequest, NextResponse } from "next/server";
import * as Ably from "ably";
export const dynamic = "force-dynamic";

const tokenCache: Map<string, { token: any; expiresAt: number }> = new Map();
const tokenRequests: Map<string, Promise<any>> = new Map();

/**
 * Ably Token Authentication Endpoint
 * 
 * This endpoint generates secure tokens for clients to connect to Ably.
 * Each token is scoped to the user's FID for security.
 * Implements deduplication and caching to prevent nonce replay errors.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const fid = searchParams.get("fid");

        if (!fid) {
            return NextResponse.json(
                { error: "FID is required for authentication" },
                { status: 400 }
            );
        }

        const cacheKey = `token:${fid}`;
        const now = Date.now();

        const cached = tokenCache.get(cacheKey);
        if (cached && cached.expiresAt > now + 5 * 60 * 1000) {
            return NextResponse.json(cached.token, {
                headers: {
                    "Cache-Control": "public, max-age=300",
                },
            });
        }

        const pendingRequest = tokenRequests.get(fid);
        if (pendingRequest) {
            const token = await pendingRequest;
            return NextResponse.json(token, {
                headers: {
                    "Cache-Control": "public, max-age=300",
                },
            });
        }

        const apiKey = process.env.ABLY_API_KEY;
        if (!apiKey) {
            console.error("ABLY_API_KEY not configured");
            return NextResponse.json(
                { error: "WebSocket service not configured" },
                { status: 503 }
            );
        }

        const tokenPromise = (async () => {
            try {
                const client = new Ably.Rest(apiKey);
                const tokenDetails = await client.auth.requestToken({
                    clientId: `fid:${fid}`,
                    capability: {
                        [`match:*`]: ["subscribe", "publish", "presence"],
                        [`game:events`]: ["subscribe"],
                    },
                    ttl: 60 * 60 * 1000,
                });

                tokenCache.set(cacheKey, {
                    token: tokenDetails,
                    expiresAt: now + 60 * 60 * 1000,
                });

                return tokenDetails;
            } finally {
                tokenRequests.delete(fid);
            }
        })();

        tokenRequests.set(fid, tokenPromise);
        const tokenDetails = await tokenPromise;

        return NextResponse.json(tokenDetails, {
            headers: {
                "Cache-Control": "public, max-age=300",
            },
        });
    } catch (error) {
        console.error("Error generating Ably token:", error);
        return NextResponse.json(
            { error: "Failed to generate authentication token" },
            { status: 500 }
        );
    }
}
