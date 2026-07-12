"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import { fetcher, getApiUrl, requestJson } from "@/lib/fetcher";
import CaseInvestigation from "./CaseInvestigation";
import ReturnCard from "./ReturnCard";

/**
 * localStorage key for the post-auth curiosity-loop onboarding card.
 * Distinct from `detective_onboarding_complete` (page.tsx intro splash)
 * — this one is shown only after the first successful auth and exists to
 * teach the loop to returning users who skip the splash.
 */
const ONBOARDING_KEY = "detective.curiosity_loop_explained_v1";

type CaseListItem = {
  id: string;
  personFid: number;
  personUsername: string;
  personDisplayName: string;
  personPfpUrl: string;
  lastArtefactPreview: string | null;
  unseenFollowUp: boolean;
  lastActivityAt: number;
  state: string;
};

type Props = {
  fid: number;
  username: string;
  displayName?: string;
  pfpUrl?: string;
  onLogout: () => void;
};

/**
 * Curiosity OS home — return card + open cases + start investigation.
 */
export default function InvestigationHome({
  fid,
  username,
  displayName,
  pfpUrl,
  onLogout,
}: Props) {
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Lazy initializer reads localStorage synchronously on the first client
  // render so returning users skip the card immediately. SSR snapshot is
  // `false` — same hydration pattern used elsewhere in this app.
  const [onboardingDismissed, setOnboardingDismissed] = useState<boolean>(
    () => {
      if (typeof window === "undefined") return false;
      try {
        return !!localStorage.getItem(ONBOARDING_KEY);
      } catch {
        return false;
      }
    },
  );

  const dismissOnboarding = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      // Private mode etc. — silently keep the in-memory dismissal only.
    }
    setOnboardingDismissed(true);
  }, []);

  const { data, mutate, isLoading } = useSWR<{ cases: CaseListItem[] }>(
    getApiUrl(`/api/cases?fid=${fid}`),
    fetcher,
    { refreshInterval: 12000, revalidateOnFocus: true },
  );

  const cases = data?.cases || [];

  const startInvestigation = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await requestJson<{ case: { id: string }; error?: string }>(
        "/api/cases",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fid }),
        },
      );
      await mutate();
      setActiveCaseId(res.case.id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not open a case. Try again later.",
      );
    } finally {
      setStarting(false);
    }
  }, [fid, mutate]);

  if (activeCaseId) {
    return (
      <div className="w-full max-w-md flex flex-col space-y-4">
        <CaseInvestigation
          fid={fid}
          caseId={activeCaseId}
          onBack={() => {
            setActiveCaseId(null);
            mutate();
          }}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-md flex flex-col space-y-5">
      {/* Investigator header */}
      <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center gap-4">
        {pfpUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pfpUrl}
            alt=""
            className="w-14 h-14 rounded-full border border-white/20 object-cover"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-slate-700" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 mb-0.5">Investigating as</p>
          <p className="text-lg font-bold text-white truncate">@{username}</p>
          {displayName && (
            <p className="text-sm text-gray-400 truncate">{displayName}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="text-xs text-gray-500 hover:text-white transition-colors"
        >
          Switch
        </button>
      </div>

      {!onboardingDismissed && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-100">
                How the curiosity loop works
              </p>
              <p className="text-xs text-amber-300/70 mt-1">
                Read once. Dismiss to keep your home screen clean.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissOnboarding}
              className="text-xs text-amber-300/60 hover:text-amber-200 transition-colors shrink-0"
              aria-label="Dismiss onboarding"
            >
              Dismiss
            </button>
          </div>
          <ol className="text-xs text-amber-100/90 space-y-1.5 list-decimal pl-4 leading-relaxed">
            <li>
              Your case stays open even if you close this tab. Step away when
              the gaps feel right.
            </li>
            <li>
              The persona may reach out with a clue while you&apos;re away — a
              follow-up you didn&apos;t ask for.
            </li>
            <li>
              Come back. The ReturnCard at the top shows what arrived.
            </li>
          </ol>
        </div>
      )}

      <ReturnCard fid={fid} />

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-white">Open cases</h2>
        {isLoading && (
          <p className="text-sm text-gray-500 py-4">Loading case files…</p>
        )}
        {!isLoading && cases.length === 0 && (
          <p className="text-sm text-gray-500 py-2 leading-relaxed">
            No open investigations yet. Start one — ask a few questions, then
            step away. The world keeps moving.
          </p>
        )}
        <div className="space-y-2">
          {cases.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCaseId(c.id)}
              className="w-full text-left bg-slate-900/50 border border-white/10 hover:border-white/25 rounded-xl p-4 transition-colors"
            >
              <div className="flex items-center gap-3">
                {c.personPfpUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.personPfpUrl}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover border border-white/10"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-700" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white truncate">
                      @{c.personUsername}
                    </p>
                    {c.unseenFollowUp && (
                      <span className="text-[10px] uppercase tracking-wide text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                        New
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {c.lastArtefactPreview || "No messages yet"}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 leading-relaxed">{error}</p>
      )}

      <button
        type="button"
        onClick={startInvestigation}
        disabled={starting}
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-semibold text-sm transition-all disabled:opacity-50"
      >
        {starting ? "Opening case…" : "Start new investigation"}
      </button>
    </div>
  );
}
