import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { processPlatformBillingWebhook } from "@/lib/services/subscription-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return NextResponse.json({
    status: "ok",
    service: "StudioCore Platform Billing Webhook",
    message: "Endpoint tự động duyệt thanh toán mua gói cước SaaS (SePay / VietQR) đang hoạt động.",
    supportedFormat: "Chuẩn SePay Webhook Payload với mã chuyển khoản SCxxxxx",
  });
}

export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const authHeader = request.headers.get("authorization") || "";
  const xApiKey = request.headers.get("x-api-key") || "";
  const queryApiKey = url.searchParams.get("api_key") || "";

  const rawKey = authHeader || xApiKey || queryApiKey;

  let payload: any = {};
  try {
    const rawBody = await request.text();
    if (rawBody) {
      payload = JSON.parse(rawBody);
    }
  } catch {
    return NextResponse.json(
      { success: false, message: "Payload JSON không hợp lệ." },
      { status: 400 },
    );
  }

  const result = processPlatformBillingWebhook(getDb(), payload, rawKey);

  // Nếu sai API Key thì trả 401 Unauthorized, ngược lại trả về 200 OK cho SePay
  // để SePay không báo lỗi đỏ khi thử nghiệm (test) hoặc nhận giao dịch không có mã SC
  const statusCode = result.success
    ? 200
    : result.message.includes("API Key")
      ? 401
      : 200;

  return NextResponse.json(
    {
      success: result.success,
      message: result.message,
      subscriptionId: result.subscriptionId,
      plan: result.plan,
    },
    { status: statusCode },
  );
}
