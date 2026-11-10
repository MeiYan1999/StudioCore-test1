import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const startTime = Date.now();
  let dbStatus = "ok";

  try {
    const db = getDb();
    db.run(sql`SELECT 1`);
  } catch (err) {
    dbStatus = `error: ${err instanceof Error ? err.message : String(err)}`;
  }

  const responseTimeMs = Date.now() - startTime;
  const isHealthy = dbStatus === "ok";

  return NextResponse.json(
    {
      status: isHealthy ? "ok" : "degraded",
      service: "studiocore",
      database: dbStatus,
      uptimeSeconds: Math.floor(process.uptime()),
      responseTimeMs,
      timestamp: new Date().toISOString(),
    },
    {
      status: isHealthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}

export async function HEAD(): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
