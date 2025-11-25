// src/app/api/ably/auth/route.ts
import { NextRequest, NextResponse } from "next/server";
import * as Ably from "ably";

/**
 * Ably Token Authentication Endpoint
 * 
 * This endpoint generates secure tokens for clients to connect to Ably.
 * Each token is scoped to the user's FID for security.
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

        const apiKey = process.env.ABLY_API_KEY;
        if (!apiKey) {
            console.error("ABLY_API_KEY not configured");
            return NextResponse.json(
                { error: "WebSocket service not configured" },
                { status: 503 }
            );
        }

        // Initialize Ably with server API key
        const client = new Ably.Rest(apiKey);

        // Generate token with user-specific capabilities
        const tokenRequest = await client.auth.createTokenRequest({
            clientId: `fid:${fid}`,
            capability: {
                // Allow subscribe/publish to match channels for this user
                [`match:*`]: ["subscribe", "publish", "presence"],
                // Allow subscribe to game events
                [`game:events`]: ["subscribe"],
            },
            // Token valid for 1 hour
            ttl: 60 * 60 * 1000,
        });

        return NextResponse.json(tokenRequest);
    } catch (error) {
        console.error("Error generating Ably token:", error);
        return NextResponse.json(
            { error: "Failed to generate authentication token" },
            { status: 500 }
        );
    }
}
