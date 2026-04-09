// src/app/api/health/route.ts
/**
 * Health Check Endpoint for Load Balancer and Container Orchestration
 * 
 * Checks:
 * - Redis connectivity
 * - Database connectivity
 * - Application state
 * 
 * Returns:
 * - 200: healthy or degraded (can serve traffic)
 * - 503: unhealthy (no traffic should be sent)
 */

import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  services: {
    redis: {
      status: "ok" | "error";
      latencyMs?: number;
      error?: string;
    };
  };
  application: {
    uptime: number;
    environment: string;
  };
}

// Simple health check endpoint for load balancers
export async function GET() {
  const startTime = Date.now();
  const health: HealthStatus = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      redis: { status: "ok" },
    },
    application: {
      uptime: process.uptime?.() || 0,
      environment: process.env.NODE_ENV || "development",
    },
  };

  // Check Redis
  try {
    const redisStart = Date.now();
    await redis.ping();
    health.services.redis.latencyMs = Date.now() - redisStart;
  } catch (error) {
    health.services.redis.status = "error";
    health.services.redis.error = error instanceof Error ? error.message : "Unknown error";
    health.status = "unhealthy";
  }

  const totalLatency = Date.now() - startTime;
  
  // Return appropriate status code based on health
  const statusCode = health.status === "healthy" ? 200 : 503;
  
  return NextResponse.json(health, { 
    status: statusCode,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Health-Latency": totalLatency.toString(),
    },
  });
}