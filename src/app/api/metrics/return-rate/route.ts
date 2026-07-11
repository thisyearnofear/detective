import { NextRequest, NextResponse } from "next/server";
import { getReturnRateMetric } from "@/lib/offlineEvents";

export const dynamic = "force-dynamic";

/**
 * GET /api/metrics/return-rate
 * North-star: % of delivered offline events opened within 48h.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const adminSecret = process.env.ADMIN_SECRET;
    const token = authHeader?.replace(/^Bearer\s+/i, "");

    if (cronSecret || adminSecret) {
      if (token !== cronSecret && token !== adminSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const windowParam = request.nextUrl.searchParams.get("windowMs");
    const windowMs = windowParam
      ? parseInt(windowParam, 10)
      : 48 * 60 * 60 * 1000;

    const metric = await getReturnRateMetric(
      Number.isFinite(windowMs) ? windowMs : 48 * 60 * 60 * 1000,
    );

    return NextResponse.json({
      ...metric,
      ratePercent: Math.round(metric.rate * 1000) / 10,
    });
  } catch (error) {
    console.error("[api/metrics/return-rate]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
