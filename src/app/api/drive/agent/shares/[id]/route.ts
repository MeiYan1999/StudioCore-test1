import { z } from "zod";
import { driveAgentRequest } from "@/lib/services/drive-agent-api";
import { revokeDriveShare, updateDriveShareStatus } from "@/lib/services/drive-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  return driveAgentRequest(request, async (db, device) => {
    const { id } = await context.params;
    const body = z.object({ status: z.enum(["active", "paused"]) }).parse(await request.json());
    updateDriveShareStatus(db, { deviceId: device.id }, id, body.status);
    return { ok: true };
  });
}
export async function DELETE(request: Request, context: Context) {
  return driveAgentRequest(request, async (db, device) => {
    revokeDriveShare(db, { deviceId: device.id }, (await context.params).id);
    return { ok: true };
  });
}
