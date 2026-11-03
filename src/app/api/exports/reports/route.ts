import { getActorContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { AuthorizationError, ValidationError } from "@/lib/errors";
import { attachmentHeader } from "@/lib/http/download";
import { reportCsv } from "@/lib/services/report-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const actor = await getActorContext();
  if (!actor) {
    return new Response("Unauthorized", { status: 401 });
  }
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  if (type !== "revenue" && type !== "debt" && type !== "tax") {
    return new Response("Invalid report type", { status: 400 });
  }
  try {
    const report = reportCsv(getDb(), actor, type, {
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      branchId: url.searchParams.get("branchId") ?? undefined,
    });
    return new Response(report.content, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": attachmentHeader(report.filename),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return new Response(error.message, { status: 403 });
    }
    if (error instanceof ValidationError) {
      return new Response(error.message, { status: 400 });
    }
    return new Response("Không thể xuất báo cáo.", { status: 500 });
  }
}
