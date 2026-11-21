import { driveAgentRequest } from "@/lib/services/drive-agent-api";
import { reopenDriveSelection } from "@/lib/services/drive-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return driveAgentRequest(request, async (db, device) => {
    reopenDriveSelection(db, { deviceId: device.id }, (await context.params).id);
    return { ok: true };
  });
}
