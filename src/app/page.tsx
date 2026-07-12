"use client";

import { useEffect, useState } from "react";
import AuthComponent from "@/components/AuthComponent";
import SpinningDetective from "@/components/SpinningDetective";
import { AUTH_EXPIRED_EVENT } from "@/lib/fetcher";
import AnimatedGridBackdrop from "@/components/AnimatedGridBackdrop";
import StarfieldBackground from "@/components/StarfieldBackground";
import InvestigationHome from "@/components/InvestigationHome";
import CollapsibleSection from "@/components/CollapsibleSection";

export default function Home() {
  const [sdkUser, setSdkUser] = useState<any>(null);
  const [isSdkLoading, setIsSdkLoading] = useState(true);
  // Lazy initializer reads localStorage synchronously on the first client
  // render so users who've completed onboarding skip the intro immediately.
  // SSR snapshot is `false` (no localStorage); client first render may
  // hydrate to `true` — the page just transitions faster, no behavior change.
  const [introComplete, setIntroComplete] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return !!localStorage.getItem("detective_onboarding_complete");
    } catch {
      return false;
    }
  });

  // Auto-advance the intro after 5s unless the lazy initializer already
  // detected `introComplete = true` from localStorage. The setState lives
  // inside the setTimeout callback (not the effect body), and [introComplete]
  // matches the only dep read in the body, so neither the set-state rule nor
  // the exhaustive-deps rule fires — no suppress needed here.
  useEffect(() => {
    if (introComplete) return;
    const timer = setTimeout(() => setIntroComplete(true), 5000);
    return () => clearTimeout(timer);
  }, [introComplete]);

  const skipIntro = () => setIntroComplete(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const cachedUser = localStorage.getItem("cached-user");
        const cachedToken = localStorage.getItem("auth-token");
        if (cachedUser && cachedToken) {
          try {
            setSdkUser(JSON.parse(cachedUser));
          } catch {
            localStorage.removeItem("cached-user");
            localStorage.removeItem("auth-token");
          }
        }

        const { sdk } = await import("@farcaster/miniapp-sdk");
        const isMiniApp = await sdk.isInMiniApp();
        if (isMiniApp) {
          await sdk.actions.ready();
          const context = await sdk.context;
          if (context?.user) {
            const user = {
              fid: context.user.fid,
              username: context.user.username,
              displayName: context.user.displayName,
              pfpUrl: context.user.pfpUrl,
            };
            setSdkUser(user);
            localStorage.setItem("cached-user", JSON.stringify(user));
            localStorage.setItem("detective_onboarding_complete", "true");
          }
        }
      } catch (err) {
        console.warn("[Home] Auth init:", err);
      } finally {
        setIsSdkLoading(false);
      }
    };
    initAuth();
  }, []);

  const handleWebAuth = (user: any) => {
    setSdkUser(user);
    localStorage.setItem("cached-user", JSON.stringify(user));
    localStorage.setItem("detective_onboarding_complete", "true");
  };

  const handleLogout = () => {
    setSdkUser(null);
    localStorage.removeItem("auth-token");
    localStorage.removeItem("cached-user");
  };

  // When any API call returns 401, fetcher.ts clears localStorage AND
  // dispatches "auth:expired". Here we react by dropping the cached sdkUser
  // state so the AuthComponent re-mounts and re-prompts.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      setSdkUser(null);
      setIsSdkLoading(false);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
  }, []);

  if (isSdkLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <div className="text-center">
          <SpinningDetective size="xl" className="mb-6" />
          <h1 className="hero-title text-3xl font-black text-stroke">
            Detective
          </h1>
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  const gridImages = Array.from(
    { length: 9 },
    (_, i) => `/grid-images/${i + 1}.jpg`,
  );

  return (
    <main className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 z-0">
      <StarfieldBackground />
      <AnimatedGridBackdrop images={gridImages} />

      <div className="relative z-20 w-full max-w-2xl flex flex-col items-center justify-center min-h-screen">
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-1000 ${introComplete ? "opacity-0 pointer-events-none" : "opacity-100"}`}
        >
          <h1
            className={`hero-title text-6xl sm:text-7xl md:text-[10rem] font-black text-white tracking-tighter leading-none select-none mix-blend-overlay opacity-90 text-center transition-all duration-700 ${introComplete ? "" : "animate-in"}`}
            style={{ animationDelay: "100ms" }}
          >
            DETECTIVE
          </h1>
          <button
            onClick={skipIntro}
            className="mt-8 text-sm text-white/50 hover:text-white/80 transition-colors"
          >
            Skip →
          </button>
        </div>

        <div
          className={`w-full flex flex-col items-center transition-all duration-1000 py-10 ${introComplete ? "opacity-100" : "opacity-0"}`}
        >
          {!sdkUser ? (
            <div className="w-full max-w-md flex flex-col items-center space-y-8">
              <div className="w-full flex flex-col items-center space-y-5 text-center">
                <div className="flex items-center justify-center w-20 h-20 bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-3xl backdrop-blur-md shadow-2xl">
                  <span className="text-4xl">🔍</span>
                </div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-black text-white tracking-tight">
                    Detective
                  </h2>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Investigate people through their digital residue. Step away
                    — the world keeps moving without you.
                  </p>
                </div>
              </div>

              <div className="w-full">
                <AuthComponent
                  onAuthSuccessAction={(user) => handleWebAuth(user)}
                />
              </div>

              <div className="w-full text-center space-y-0 pt-4">
                <CollapsibleSection title="How it works" defaultOpen={true}>
                  <div className="space-y-4">
                    {[
                      {
                        n: "1",
                        text: "Open a case on someone — reconstruct who they are from what they leave behind",
                      },
                      {
                        n: "2",
                        text: "Ask questions. Read the replies. Sit with the gaps.",
                      },
                      {
                        n: "3",
                        text: "Step away. Something may arrive while you're gone.",
                      },
                    ].map((rule) => (
                      <div key={rule.n} className="flex items-start gap-3 text-left">
                        <span className="text-amber-400/90 font-bold text-sm mt-0.5">
                          {rule.n}
                        </span>
                        <p className="text-sm text-white/90 leading-relaxed">
                          {rule.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              </div>
            </div>
          ) : (
            <InvestigationHome
              fid={sdkUser.fid}
              username={sdkUser.username}
              displayName={sdkUser.displayName}
              pfpUrl={sdkUser.pfpUrl}
              onLogout={handleLogout}
            />
          )}
        </div>
      </div>
    </main>
  );
}
