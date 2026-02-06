/**
 * Centralized SWR fetcher function
 * Single source of truth for API data fetching
 * 
 * Usage: useSWR('/api/endpoint', fetcher)
 */

export const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`);
  }
  return res.json();
};

/**
 * SWR fetcher with error handling for 403 (game not live)
 * Used for match/game endpoints where 403 is expected
 */
export const fetcherWithGameNotLive = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    // Handle 403 specially - game not live, return the state info
    if (res.status === 403) {
      const data = await res.json().catch(() => ({ currentState: "UNKNOWN" }));
      return { gameNotLive: true, currentState: data.currentState };
    }
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`);
  }
  return res.json();
};
