import { NextResponse } from "next/server";
import { driveErrorResponse, requireDriveDevice } from "@/lib/drive/http";
import { pollDriveJobs } from "@/lib/drive/relay";
import { getTenantName, listDriveSubmissionsSince } from "@/lib/services/drive-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Long-poll: giữ kết nối tối đa ~25s, trả về ngay khi khách cần một tệp. */
export async function GET(request: Request): Promise<Response> {
  try {
    const { db, device } = requireDriveDevice(request);
    const url = new URL(request.url);
    const wait = Math.max(0, Math.min(25_000, Number(url.searchParams.get("wait") ?? 25_000) || 0));
    const since = Number(url.searchParams.get("since") ?? 0) || 0;
    let submissions = since > 0 ? listDriveSubmissionsSince(db, device, since) : [];
    const jobs = await pollDriveJobs(device.id, submissions.length > 0 ? 0 : wait, request.signal);
    if (since > 0 && submissions.length === 0) submissions = listDriveSubmissionsSince(db, device, since);
    return NextResponse.json({
      jobs,
      submissions,
      now: Date.now(),
      device: { id: device.id, name: device.name },
      studioName: getTenantName(db, device.tenantId),
    });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
