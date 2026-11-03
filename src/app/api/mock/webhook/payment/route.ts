import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import {
  processPaymentWebhook,
  validatePaymentWebhookOrder,
} from "@/lib/services/finance-service";
import {
  mockWebhookEnabled,
  verifyWebhookSignature,
} from "@/lib/finance/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WebhookBody = {
  eventId?: string;
  eventType?: string;
  provider?: string;
  orderId?: string;
  amount?: number;
  reference?: string;
  occurredAt?: string;
};

export async function POST(request: Request): Promise<Response> {
  if (!mockWebhookEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }
  const body = await request.text();
  const timestamp = request.headers.get("x-payment-timestamp") ?? "";
  const signature = request.headers.get("x-payment-signature") ?? "";
  const verified = verifyWebhookSignature({ body, timestamp, signature });
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 401 });
  }
  let payload: WebhookBody;
  try {
    payload = JSON.parse(body) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "Body JSON không hợp lệ." }, { status: 400 });
  }
  if (
    !payload.eventId ||
    !payload.orderId ||
    !Number.isInteger(payload.amount) ||
    !payload.provider
  ) {
    return NextResponse.json({ error: "Payload webhook thiếu trường." }, { status: 400 });
  }
  if (payload.provider !== "mock") {
    return NextResponse.json({ error: "Provider webhook không hỗ trợ." }, { status: 400 });
  }
  const order = validatePaymentWebhookOrder(getDb(), payload.orderId);
  if (!order) {
    return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
  }
  if (!Number.isInteger(payload.amount) || (payload.amount ?? 0) <= 0) {
    return NextResponse.json({ error: "Số tiền không hợp lệ." }, { status: 400 });
  }
  try {
    const result = processPaymentWebhook(
      getDb(),
      {
        provider: "mock",
        eventId: payload.eventId,
        eventType: payload.eventType || "payment.succeeded",
        orderId: payload.orderId,
        amount: payload.amount as number,
        reference: payload.reference,
        occurredAt: payload.occurredAt,
      },
      body,
    );
    return NextResponse.json(
      { status: result.status, paymentId: result.paymentId ?? null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook xử lý thất bại." },
      { status: 400 },
    );
  }
}
