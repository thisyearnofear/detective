"use client";

import {
  IDKitRequestWidget,
  orbLegacy,
  type IDKitResult,
} from "@worldcoin/idkit";
import { useState, useCallback, useEffect } from "react";
import { requestJson } from "@/lib/fetcher";

type WorldIdVerificationProps = {
  onVerified: (result: IDKitResult) => void;
  onError?: (error: string) => void;
  actionName?: string;
  enabled?: boolean;
};

type RPContext = {
  rp_id: string;
  nonce: string;
  created_at: number;
  expires_at: number;
  signature: string;
};

export default function WorldIdVerification({
  onVerified,
  onError,
  actionName = "play-detective",
  enabled = true,
}: WorldIdVerificationProps) {
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rpContext, setRpContext] = useState<RPContext | null>(null);
  const [open, setOpen] = useState(false);

  const appId = (process.env.NEXT_PUBLIC_WORLD_APP_ID ||
    "app_staging_placeholder") as `app_${string}`;
  const action = actionName;

  useEffect(() => {
    if (!enabled) return;

    fetch(`/api/auth/world-id/rp-context?action=${action}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          console.warn("[World ID] RP context error:", data.error);
        } else {
          setRpContext({
            rp_id: data.rp_id,
            nonce: data.nonce,
            created_at: data.created_at,
            expires_at: data.expires_at,
            signature: data.sig,
          });
        }
      })
      .catch((err) =>
        console.error("[World ID] Failed to fetch RP context:", err),
      );
  }, [action, enabled]);

  const handleVerify = useCallback(
    async (result: IDKitResult) => {
      try {
        await requestJson<any>("/api/auth/world-id/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idkitResponse: result }),
        });

        setVerified(true);
        onVerified(result);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Verification failed";
        setError(errorMessage);
        onError?.(errorMessage);
      }
    },
    [onVerified, onError],
  );

  const handleSuccess = useCallback(() => {
    console.log("[World ID] Verification successful");
  }, []);

  const handleError = useCallback(
    (errorCode: string) => {
      console.error("[World ID] Error:", errorCode);
      setError(`Verification error: ${errorCode}`);
      onError?.(errorCode);
    },
    [onError],
  );

  if (!enabled) return null;
  if (verified) {
    return (
      <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/40 rounded-xl px-4 py-3">
        <span className="text-xl">✓</span>
        <span className="text-green-200 font-medium">Human Verified</span>
        <span className="text-green-200/60 text-sm">(World ID)</span>
      </div>
    );
  }

  if (!rpContext) {
    return (
      <div className="space-y-4">
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🛡️</div>
            <div>
              <h3 className="text-white font-semibold mb-1">
                Verify You're Human
              </h3>
              <p className="text-gray-300 text-sm">
                Loading World ID verification...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">🛡️</div>
          <div>
            <h3 className="text-white font-semibold mb-1">
              Verify You're Human
            </h3>
            <p className="text-gray-300 text-sm">
              To play Detective, verify you're a unique human. This prevents
              bots and ensures fair gameplay. Your identity stays private.
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={() => setOpen(true)}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700
                   text-white font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
      >
        <span>Verify with World ID</span>
        <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Free</span>
      </button>

      <IDKitRequestWidget
        app_id={appId}
        action={action}
        rp_context={rpContext}
        allow_legacy_proofs={true}
        preset={orbLegacy()}
        open={open}
        onOpenChange={setOpen}
        handleVerify={handleVerify}
        onSuccess={handleSuccess}
        onError={handleError}
      />

      {error && (
        <div className="bg-red-500/15 border border-red-500/30 rounded-xl p-3 text-red-200 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
