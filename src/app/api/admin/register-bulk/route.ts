// src/app/api/admin/register-bulk/route.ts
import { NextResponse } from "next/server";
import { gameManager } from "@/lib/gameState";
import { getFarcasterUserData } from "@/lib/neynar";

/**
 * Admin API to register multiple users at once for testing.
 * Accepts an array of Farcaster usernames or FIDs.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { usernames } = body;

        if (!usernames || !Array.isArray(usernames)) {
            return NextResponse.json(
                { error: "usernames array is required" },
                { status: 400 }
            );
        }

        const results = [];
        const errors = [];

        for (const username of usernames) {
            try {
                // Lookup username to get FID
                const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

                if (!NEYNAR_API_KEY) {
                    // Dev mode: Create mock user
                    const mockFid = Math.floor(Math.random() * 100000);
                    const mockCasts = [
                        { text: `Hello from ${username}!` },
                        { text: `This is a test cast from ${username}.` },
                    ];
                    gameManager.registerPlayer(
                        {
                            fid: mockFid,
                            username: username,
                            displayName: `${username} (dev)`,
                            pfpUrl: "https://i.imgur.com/vL43u65.jpg",
                        },
                        mockCasts,
                        "casual and friendly"
                    );
                    results.push({ username, success: true, fid: mockFid });
                    continue;
                }

                // Lookup username
                const userLookupResponse = await fetch(
                    `https://api.neynar.com/v2/farcaster/user/by_username?username=${username}`,
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                            api_key: NEYNAR_API_KEY,
                        },
                    }
                );

                if (!userLookupResponse.ok) {
                    errors.push({ username, error: "User not found" });
                    continue;
                }

                const userData = await userLookupResponse.json();
                const fid = userData.result?.user?.fid;

                if (!fid) {
                    errors.push({ username, error: "Could not retrieve FID" });
                    continue;
                }

                // Fetch full user data
                const { isValid, userProfile, recentCasts, style } =
                    await getFarcasterUserData(fid);

                if (!isValid || !userProfile) {
                    errors.push({ username, error: "User does not meet quality criteria" });
                    continue;
                }

                // Register player
                const player = gameManager.registerPlayer(userProfile, recentCasts, style);

                if (player) {
                    results.push({ username, success: true, fid: player.fid });
                } else {
                    errors.push({ username, error: "Failed to register (game might be full)" });
                }
            } catch (error: any) {
                errors.push({ username, error: error.message });
            }
        }

        return NextResponse.json({
            success: true,
            registered: results.length,
            failed: errors.length,
            results,
            errors,
        });
    } catch (error) {
        console.error("Error in bulk registration:", error);
        return NextResponse.json(
            { error: "An unexpected error occurred" },
            { status: 500 }
        );
    }
}
