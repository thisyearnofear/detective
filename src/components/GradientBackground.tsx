"use client";

import { useEffect, useRef } from "react";

interface GradientBackgroundProps {
  state?: "REGISTRATION" | "LIVE" | "VOTING" | "FINISHED";
  intensity?: number; // 0-1
}

interface ColorSet {
  c1: { r: number; g: number; b: number };
  c2: { r: number; g: number; b: number };
}

interface CurrentColor {
  r: number;
  g: number;
  b: number;
}

export default function GradientBackground({
  state = "LIVE",
  intensity = 1,
}: GradientBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const colorsRef = useRef<{
    current: CurrentColor;
    target: ColorSet;
  }>({
    current: { r: 245, g: 158, b: 11 },
    target: getStateColors(state),
  });

  // Get color palette based on game state
  function getStateColors(gameState: string) {
    switch (gameState) {
      case "REGISTRATION":
        return {
          c1: { r: 59, g: 130, b: 246 }, // blue-500
          c2: { r: 139, g: 92, b: 246 }, // violet-500
        };
      case "LIVE":
        return {
          c1: { r: 245, g: 158, b: 11 }, // amber-500
          c2: { r: 239, g: 68, b: 68 }, // red-500
        };
      case "VOTING":
        return {
          c1: { r: 34, g: 197, b: 194 }, // teal-500
          c2: { r: 16, g: 185, b: 129 }, // emerald-500
        };
      case "FINISHED":
        return {
          c1: { r: 250, g: 204, b: 21 }, // yellow-400
          c2: { r: 217, g: 119, b: 6 }, // orange-600
        };
      default:
        return {
          c1: { r: 245, g: 158, b: 11 },
          c2: { r: 239, g: 68, b: 68 },
        };
    }
  }

  // Update target colors when state changes
  useEffect(() => {
    colorsRef.current.target = getStateColors(state);
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    let startTime = Date.now();
    let lastFrameTime = startTime;

    const animate = (currentTime: number) => {
      const now = currentTime || Date.now();
      const elapsed = (now - startTime) / 1000;
      const dt = (now - lastFrameTime) / 1000;
      lastFrameTime = now;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      // Smoothly interpolate colors toward target
      const speed = 2; // color transition speed
      const colors = colorsRef.current;
      colors.current.r += (colors.target.c1.r - colors.current.r) * speed * dt;
      colors.current.g += (colors.target.c1.g - colors.current.g) * speed * dt;
      colors.current.b += (colors.target.c1.b - colors.current.b) * speed * dt;

      // Clear canvas
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);

      // Animate gradient centers with trigonometric motion
      const time = elapsed * 0.3;
      const a1 = Math.min(w, h) * 0.35;
      const a2 = Math.min(w, h) * 0.28;

      const cx = w * 0.5;
      const cy = h * 0.5;

      const x1 = cx + Math.cos(time) * a1;
      const y1 = cy + Math.sin(time * 0.8) * a1 * 0.4;
      const x2 = cx + Math.cos(-time * 0.9 + 1.2) * a2;
      const y2 = cy + Math.sin(-time * 0.7 + 0.7) * a2 * 0.5;

      const r1 = Math.max(w, h) * 0.75;
      const r2 = Math.max(w, h) * 0.65;

      // First radial gradient
      const g1 = ctx.createRadialGradient(x1, y1, 0, x1, y1, r1);
      g1.addColorStop(
        0,
        `rgba(${Math.round(colors.current.r)},${Math.round(colors.current.g)},${Math.round(colors.current.b)},${0.85 * intensity})`,
      );
      g1.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);

      // Second radial gradient (interpolate to target)
      const nextColor = colorsRef.current.target.c2;
      const g2 = ctx.createRadialGradient(x2, y2, 0, x2, y2, r2);
      g2.addColorStop(
        0,
        `rgba(${Math.round(nextColor.r)},${Math.round(nextColor.g)},${Math.round(nextColor.b)},${0.7 * intensity})`,
      );
      g2.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [intensity]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 w-full h-full"
      style={{
        filter: "blur(24px) saturate(1.05)",
      }}
    />
  );
}
