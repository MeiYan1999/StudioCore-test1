import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import {
  handleSepayWebhookCall,
  type SepayWebhookPayload,
} from "@/lib/services/sepay-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return NextResponse.json({
    status: "ok",
    provider: "sepay",
    message: "StudioCore SePay Webhook endpoint is active and listening for bank transaction events.",
  });
}

export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const authHeader = request.headers.get("authorization") || "";
  const xApiKey = request.headers.get("x-api-key") || "";
  const queryApiKey = url.searchParams.get("api_key") || "";

  const rawKey = authHeader || xApiKey || queryApiKey;
  if (!rawKey) {
    return NextResponse.json(
      {
        success: false,
        message: "Thiếu Authorization header hoặc API Key trong yêu cầu webhook.",
      },
      { status: 401 },
    );
  }

  const apiKey = rawKey.replace(/^(Apikey|Bearer)\s+/i, "").trim();

  let rawBody = "";
  let payload: SepayWebhookPayload = {};
  try {
    rawBody = await request.text();
    if (rawBody) {
      payload = JSON.parse(rawBody) as SepayWebhookPayload;
    }
  } catch {
    return NextResponse.json(
      { success: false, message: "Payload JSON không hợp lệ." },
      { status: 400 },
    );
  }

  const result = await handleSepayWebhookCall(getDb(), apiKey, payload, rawBody);
  return NextResponse.json(
    {
      success: result.success,
      message: result.message,
      paymentId: result.paymentId,
    },
    { status: result.status },
  );
}
