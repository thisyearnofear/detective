"use client";

/**
 * Unified Authentication Component
 *
 * Two paths, one server endpoint:
 * - MiniApp: sdk.quickAuth.getToken() -> verify JWT via /api/auth/quick-auth/verify
 * - Web:     @farcaster/auth-kit SignInButton (signature+message+fid)
 *            -> verify via EIP-191 + Neynar on the same endpoint
 *
 * Both produce an internal session JWT which the rest of the server uses for
 * requireAuth(). Reference: https://miniapps.farcaster.xyz/docs/sdk/quick-auth
 */

import { useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { SignInButton } from "@farcaster/auth-kit";
import { requestJson } from "@/lib/fetcher";
import SpinningDetective from "./SpinningDetective";

export type AuthUser = {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
};

type Props = {
  onAuthSuccessAction: (user: AuthUser, token: string) => void;
  onErrorAction?: (error: string) => void;
  onExploreWithoutAuthAction?: () => void;
};

type SessionResponse = {
  token: string;
  user: AuthUser;
};

type VerifyPayload =
  | { kind: "quick-auth"; token: string }
  | { kind: "siwf"; signature: string; message: string; fid: number };

type AuthStep = "detecting" | "authenticating" | "webauth" | "error";

export default function AuthComponent({
  onAuthSuccessAction,
  onErrorAction,
  onExploreWithoutAuthAction,
}: Props) {
  const [step, setStep] = useState<AuthStep>("detecting");
  const [error, setError] = useState<string | null>(null);

  /**
   * Send a verification payload to the single session endpoint, receive the
   * internal session JWT and the canonical user profile.
   */
  const exchangeForSession = async (
    payload: VerifyPayload,
  ): Promise<SessionResponse> => {
    return requestJson<SessionResponse>("/api/auth/quick-auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  };

  /**
   * Handle successful authentication from either MiniApp or Web source.
   * The `input` is a payload; the server returns the session JWT; we store
   * the session JWT (NOT the inbound token) as our `auth-token`.
   */
  const handleAuthSuccess = async (input: VerifyPayload) => {
    try {
      setStep("authenticating");
      const session = await exchangeForSession(input);

      localStorage.setItem("auth-token", session.token);
      localStorage.setItem(
        "cached-user",
        JSON.stringify({
          fid: session.user.fid,
          username: session.user.username,
          displayName: session.user.displayName,
          pfpUrl: session.user.pfpUrl,
        }),
      );

      onAuthSuccessAction(session.user, session.token);

      // Signal ready to Farcaster (if in MiniApp context)
      try {
        await sdk.actions.ready();
      } catch {
        // Not in MiniApp context - that's fine
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Authentication failed";
      setError(errorMessage);
      setStep("error");
      onErrorAction?.(errorMessage);
    }
  };

  /**
   * Detect context and initiate appropriate auth flow
   * Only runs on initial mount
   */
  useEffect(() => {
    const detectContextAndAuth = async () => {
      try {
        setError(null);
        let token: string | null = null;
        let inMiniApp = false;

        // Try Quick Auth (only available in MiniApp)
        try {
          // Check if we're likely in a miniapp context first
          const isPossiblyMiniApp =
            typeof window !== "undefined" &&
            (window.parent !== window ||
              navigator.userAgent.includes("Farcaster") ||
              navigator.userAgent.includes("Warpcast") ||
              document.referrer.includes("warpcast.com") ||
              document.referrer.includes("farcaster.xyz"));

          if (!isPossiblyMiniApp) {
            // Skip Quick Auth entirely if we're clearly not in a miniapp
            inMiniApp = false;
          } else {
            const result = await Promise.race([
              sdk.quickAuth.getToken(),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("timeout")), 2000),
              ),
            ]);

            const quickAuthResult = result as { token?: string };
            token = quickAuthResult?.token || null;
            inMiniApp = !!token;
          }
        } catch (quickAuthErr) {
          // Not in MiniApp or SDK error - will show web auth
          // Suppress SDK internal errors (e.g., RpcResponse parsing failures)
          console.log(
            "[AuthComponent] Quick Auth unavailable:",
            quickAuthErr instanceof Error ? quickAuthErr.message : "SDK error",
          );
          inMiniApp = false;
        }

        // If in MiniApp and got token, authenticate
        if (inMiniApp && token) {
          await handleAuthSuccess({ kind: "quick-auth", token });
          return;
        }

        // Not in MiniApp - show web auth UI
        setStep("webauth");
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Authentication failed";
        setError(errorMessage);
        setStep("error");
        onErrorAction?.(errorMessage);
      }
    };

    detectContextAndAuth();
  }, [onAuthSuccessAction, onErrorAction]);

  // =========================================================================
  // RENDER: Detecting
  // =========================================================================
  if (step === "detecting") {
    return (
      <div className="flex flex-col items-center justify-center space-y-6">
        <SpinningDetective />
        <div className="text-center space-y-2">
          <p className="text-white font-semibold">Loading...</p>
          <p className="text-sm text-gray-400">Checking Farcaster context</p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: Authenticating (MiniApp Quick Auth)
  // =========================================================================
  if (step === "authenticating") {
    return (
      <div className="flex flex-col items-center justify-center space-y-6">
        <SpinningDetective />
        <div className="text-center space-y-2">
          <p className="text-white font-semibold">Signing you in...</p>
          <p className="text-sm text-gray-400">Approve in Farcaster</p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: Web Auth (Browser QR Code Flow)
  // =========================================================================
  if (step === "webauth") {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-4">
          <div className="text-4xl">📱</div>
          <div>
            <h3 className="text-lg font-bold text-white mb-2">
              Sign in with Farcaster
            </h3>
            <p className="text-sm text-gray-300">
              Connect your Farcaster account using the button below
            </p>
          </div>
        </div>

        {/* Native SignInButton from @farcaster/auth-kit */}
        {/* This handles:
            - Button UI
            - QR code display
            - Deep link for mobile
            - Polling for signature completion
        */}
        <div className="flex justify-center relative z-10">
          {/* @farcaster/auth-kit handles QR, deep-link, and polling on the
              client. We forward the resulting (signature, message, fid) to
              the server for EIP-191 verification + Neynar binding. */}
          <SignInButton
            timeout={300_000}
            interval={1500}
            onSuccess={async (res) => {
              try {
                if (!res.signature || !res.message || !res.fid) {
                  throw new Error(
                    "Invalid sign-in response: missing signature, message, or FID",
                  );
                }

                // Hand the SIWF (signature, message, fid) to the server, which
                // recovers the signer address with viem and binds it to the
                // FID via Neynar verified_addresses.
                await handleAuthSuccess({
                  kind: "siwf",
                  signature: res.signature,
                  message: res.message,
                  fid: res.fid,
                });
              } catch (err) {
                const errorMsg =
                  err instanceof Error ? err.message : "Sign-in failed";
                setError(errorMsg);
                onErrorAction?.(errorMsg);
              }
            }}
            onError={(err) => {
              const errorMsg = err?.message || "Sign-in failed";
              setError(errorMsg);
              onErrorAction?.(errorMsg);
            }}
            hideSignOut={true}
          />
        </div>

        <p className="text-xs text-gray-400 text-center">
          Don&apos;t have Farcaster? Download the app or visit farcaster.xyz
        </p>

        {onExploreWithoutAuthAction && (
          <button
            onClick={onExploreWithoutAuthAction}
            className="w-full bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl px-4 py-3 text-white font-semibold transition-colors text-sm"
          >
            Continue Without Auth
          </button>
        )}
      </div>
    );
  }

  // =========================================================================
  // RENDER: Error State
  // =========================================================================
  if (step === "error") {
    return (
      <div className="space-y-6">
        <div className="bg-red-500/15 border-2 border-red-500/30 rounded-xl p-4 text-red-200 text-sm text-center">
          <p className="font-semibold mb-2">Authentication Error</p>
          <p>{error}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-xl px-4 py-3 text-white font-semibold transition-colors text-sm"
          >
            Try Again
          </button>
          {onExploreWithoutAuthAction && (
            <button
              onClick={onExploreWithoutAuthAction}
              className="flex-1 bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl px-4 py-3 text-white font-semibold transition-colors text-sm"
            >
              Continue Without Auth
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
