import { after, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import {
  ingestWebhook,
  metaConfig,
  refreshProfiles,
  validSignature,
} from "@/lib/omnichannel/meta";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  try {
    if (
      p.get("hub.mode") === "subscribe" &&
      p.get("hub.verify_token") === metaConfig().verify
    )
      return new Response(p.get("hub.challenge"));
  } catch {
    return new Response("Meta not configured", { status: 503 });
  }
  return new Response("Forbidden", { status: 403 });
}
export async function POST(request: Request) {
  const raw = Buffer.from(await request.arrayBuffer());
  if (raw.length > 1048576) return new Response("Too large", { status: 413 });
  try {
    if (!validSignature(raw, request.headers.get("x-hub-signature-256"))) {
      console.warn("[facebook webhook] rejected: invalid signature");
      return new Response("Forbidden", { status: 403 });
    }
    const payload = z
      .object({
        object: z.string(),
        entry: z.array(
          z.object({
            id: z.string(),
            messaging: z.array(z.object({}).passthrough()).optional(),
          }),
        ),
      })
      .parse(JSON.parse(raw.toString("utf8")));
    const db = getDb();
    const stale = ingestWebhook(db, payload);
    // IDs and counts only: message content must not reach the logs.
    console.info(
      "[facebook webhook] received",
      payload.object,
      payload.entry.map((e) => `${e.id}:${e.messaging?.length ?? 0}`).join(","),
    );
    if (stale.length) after(() => refreshProfiles(db, stale));
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error(
      "[facebook webhook] failed:",
      e instanceof Error ? e.name : "unknown error",
    );
    return new Response("Webhook processing failed", { status: 500 });
  }
}
