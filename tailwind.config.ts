import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          900: "#0f172a",
          800: "#1e293b",
          700: "#334155",
          600: "#475569",
          500: "#64748b",
          400: "#94a3b8",
          300: "#cbd5e1",
          200: "#e2e8f0",
          100: "#f1f5f9",
        },
      },
      animation: {
        "wiggle-left": "wiggle-left 1s ease-in-out infinite",
        "wiggle-right": "wiggle-right 1s ease-in-out infinite",
        "fade-in": "fade-in 0.5s ease-in-out",
        "slide-in-up": "slide-in-up 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "slide-in-down": "slide-in-down 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "bounce-in": "bounce-in 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        "scale-in": "scale-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "glow-pulse": "glow-pulse 0.6s ease-in-out",
        "vote-lock": "vote-lock 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "vote-correct": "vote-correct 1.5s ease-in-out",
        "vote-incorrect": "vote-incorrect 1.5s ease-in-out",
        "vote-feedback": "vote-feedback 1.5s ease-in-out",
        "inactivity-warning": "inactivity-warning 0.8s ease-in-out infinite",
        "inactivity-critical": "inactivity-critical 0.5s ease-in-out infinite",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        "wiggle-left": {
          "0%, 100%": { transform: "translateX(0)" },
          "50%": { transform: "translateX(10px)" },
        },
        "wiggle-right": {
          "0%, 100%": { transform: "translateX(0)" },
          "50%": { transform: "translateX(-10px)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-in-up": {
          "0%": { transform: "translateY(40px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-in-down": {
          "0%": { transform: "translateY(-40px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "bounce-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "50%": { transform: "scale(1.05)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "glow-pulse": {
          "0%": { boxShadow: "0 0 0 0 rgba(59, 130, 246, 0.7)" },
          "50%": { boxShadow: "0 0 0 10px rgba(59, 130, 246, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(59, 130, 246, 0)" },
        },
        "vote-lock": {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(0.95)" },
          "100%": { transform: "scale(1)" },
        },
        "vote-correct": {
          "0%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.08)", boxShadow: "0 0 20px rgba(34, 197, 94, 0.5)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "vote-incorrect": {
          "0%": { transform: "rotate(0deg) scale(1)", opacity: "1" },
          "25%": { transform: "rotate(-3deg) scale(1)" },
          "75%": { transform: "rotate(3deg) scale(1)" },
          "100%": { transform: "rotate(0deg) scale(1)", opacity: "1" },
        },
        "vote-feedback": {
          "0%": { opacity: "0", transform: "translateY(-10px)" },
          "10%": { opacity: "1", transform: "translateY(0)" },
          "90%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(-10px)" },
        },
        "inactivity-warning": {
          "0%": { transform: "translateX(-2px)", opacity: "1" },
          "50%": { transform: "translateX(2px)", opacity: "0.8" },
          "100%": { transform: "translateX(-2px)", opacity: "1" },
        },
        "inactivity-critical": {
          "0%": { transform: "translateX(-3px) scale(1)", opacity: "1" },
          "33%": { transform: "translateX(3px) scale(1.02)", opacity: "1" },
          "66%": { transform: "translateX(-3px) scale(1)", opacity: "1" },
          "100%": { transform: "translateX(0) scale(1)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
