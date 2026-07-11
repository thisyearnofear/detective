"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import { fetcher, getApiUrl, requestJson } from "@/lib/fetcher";

type InboxItem = {
  eventId: string;
  caseId: string;
  artefactId: string;
  body: string;
  personFid: number;
  personUsername: string;
  personDisplayName: string;
  personPfpUrl: string;
  deliveredAt: number;
};

type Props = {
  fid: number;
};

/**
 * Return card — "While you were away, @name sent something."
 * Surfaces unseen offline_follow_up artefacts.
 */
export default function ReturnCard({ fid }: Props) {
  const [revealed, setRevealed] = useState<InboxItem | null>(null);
  const [opening, setOpening] = useState(false);

  const { data, mutate } = useSWR<{ items: InboxItem[]; count: number }>(
    getApiUrl(`/api/inbox?fid=${fid}`),
    fetcher,
    {
      refreshInterval: 15000,
      revalidateOnFocus: true,
    },
  );

  const items = data?.items || [];
  const top = revealed || items[0];

  const handleOpen = useCallback(async () => {
    if (!items[0] || opening || revealed) return;
    const item = items[0];
    setOpening(true);
    setRevealed(item);
    try {
      await requestJson("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artefactId: item.artefactId }),
      });
      await mutate();
    } catch (err) {
      console.error("[ReturnCard] Failed to mark seen:", err);
    } finally {
      setOpening(false);
    }
  }, [items, opening, revealed, mutate]);

  if (!top) return null;

  const isOpen = !!revealed;

  return (
    <div className="w-full rounded-xl border border-amber-500/30 bg-gradient-to-br from-slate-900/90 to-amber-950/40 p-4 backdrop-blur-sm shadow-lg">
      <p className="text-xs uppercase tracking-wide text-amber-400/80 mb-2">
        While you were away
      </p>
      <div className="flex items-start gap-3">
        {top.personPfpUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={top.personPfpUrl}
            alt=""
            className="w-10 h-10 rounded-full object-cover border border-white/10"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm text-gray-400">
            ?
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm">
            @{top.personUsername} sent something
          </h3>
          {!isOpen ? (
            <>
              <button
                type="button"
                onClick={handleOpen}
                disabled={opening}
                className="mt-3 w-full sm:w-auto px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {opening ? "Opening…" : "Open clue"}
              </button>
              {items.length > 1 && (
                <p className="mt-2 text-xs text-gray-500">
                  +{items.length - 1} more waiting
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
              {top.body}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
