"use client";

import { useEffect, useState } from "react";

type ErrorSeverity = "error" | "warning" | "info";

interface ErrorCardProps {
  message: string;
  title?: string;
  severity?: ErrorSeverity;
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  autoClose?: number; // ms, 0 = no auto-close
}

export default function ErrorCard({
  message,
  title,
  severity = "error",
  icon,
  actionLabel,
  onAction,
  onDismiss,
  autoClose = 0,
}: ErrorCardProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (autoClose > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, autoClose);
      return () => clearTimeout(timer);
    }
  }, [autoClose, onDismiss]);

  if (!isVisible) return null;

  const bgColor =
    severity === "error"
      ? "bg-red-900/20 border-red-500/50"
      : severity === "warning"
        ? "bg-yellow-900/20 border-yellow-500/50"
        : "bg-blue-900/20 border-blue-500/50";

  const textColor =
    severity === "error"
      ? "text-red-300"
      : severity === "warning"
        ? "text-yellow-300"
        : "text-blue-300";

  const accentColor =
    severity === "error"
      ? "text-red-400"
      : severity === "warning"
        ? "text-yellow-400"
        : "text-blue-400";

  const defaultIcon =
    severity === "error"
      ? "⚠️"
      : severity === "warning"
        ? "⚡"
        : "ℹ️";

  return (
    <div
      className={`${bgColor} border rounded-lg p-4 mb-4 animate-scale-in transition-all duration-300`}
    >
      <div className="flex gap-4">
        {/* Icon */}
        <div
          className={`${accentColor} text-2xl flex-shrink-0 animate-wiggle-left`}
        >
          {icon || defaultIcon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {title && (
            <h3 className={`${accentColor} font-semibold mb-1`}>
              {title}
            </h3>
          )}
          <p className={`${textColor} text-sm`}>
            {message}
          </p>
        </div>

        {/* Action Button (if provided) */}
        {actionLabel && (
          <div className="flex-shrink-0">
            <button
              onClick={() => {
                onAction?.();
                setIsVisible(false);
              }}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                severity === "error"
                  ? "bg-red-600/50 hover:bg-red-600 text-red-100"
                  : severity === "warning"
                    ? "bg-yellow-600/50 hover:bg-yellow-600 text-yellow-100"
                    : "bg-blue-600/50 hover:bg-blue-600 text-blue-100"
              }`}
            >
              {actionLabel}
            </button>
          </div>
        )}

        {/* Dismiss Button */}
        {onDismiss && (
          <button
            onClick={() => {
              setIsVisible(false);
              onDismiss();
            }}
            className="flex-shrink-0 text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        )}
      </div>

      {/* Subtle bottom accent line */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-0.5 ${
          severity === "error"
            ? "bg-gradient-to-r from-red-500/0 via-red-500/50 to-red-500/0"
            : severity === "warning"
              ? "bg-gradient-to-r from-yellow-500/0 via-yellow-500/50 to-yellow-500/0"
              : "bg-gradient-to-r from-blue-500/0 via-blue-500/50 to-blue-500/0"
        }`}
      />
    </div>
  );
}
