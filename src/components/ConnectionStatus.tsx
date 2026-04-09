// src/components/ConnectionStatus.tsx
/**
 * Connection Status Indicator
 * 
 * Shows real-time connection status (online/offline/reconnecting)
 * with appropriate visual feedback.
 */

"use client";

import { useEffect, useState } from "react";

type ConnectionState = "online" | "offline" | "reconnecting";

export function ConnectionStatus() {
  const [status, setStatus] = useState<ConnectionState>("online");
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    // Handle online status
    const handleOnline = () => {
      setStatus("online");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    };

    // Handle offline status
    const handleOffline = () => {
      setStatus("offline");
      setShowToast(true);
    };

    // Add event listeners
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    // Check initial status
    if (!navigator.onLine) {
      setStatus("offline");
      setShowToast(true);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Don't render if online (no need to show status)
  if (status === "online" && !showToast) {
    return null;
  }

  const statusConfig = {
    online: { emoji: "✅", text: "Back online", color: "bg-green-500/20 border-green-500/50" },
    offline: { emoji: "📡", text: "No connection", color: "bg-red-500/20 border-red-500/50" },
    reconnecting: { emoji: "🔄", text: "Reconnecting...", color: "bg-yellow-500/20 border-yellow-500/50" },
  };

  const config = statusConfig[status];

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2">
      <div
        className={`flex items-center gap-2 px-4 py-2 rounded-full border ${config.color} backdrop-blur-md`}
      >
        <span className={status === "reconnecting" ? "animate-spin" : ""}>
          {config.emoji}
        </span>
        <span className="text-sm font-medium">{config.text}</span>
      </div>
    </div>
  );
}

/**
 * Hook to access connection status
 */
export function useConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

export default ConnectionStatus;