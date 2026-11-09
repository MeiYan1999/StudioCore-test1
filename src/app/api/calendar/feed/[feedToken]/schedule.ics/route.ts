import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { generateCalendarIcs } from "@/lib/services/ical-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ feedToken: string }> },
): Promise<Response> {
  const { feedToken } = await params;
  if (!feedToken) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const result = generateCalendarIcs(getDb(), feedToken);
  if (!result) {
    return NextResponse.json({ error: "Calendar feed not found or invalid token" }, { status: 404 });
  }

  return new Response(result.icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="studiocore-schedule.ics"',
      "Cache-Control": "private, max-age=300, must-revalidate",
    },
  });
}
