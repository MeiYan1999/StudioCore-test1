import { driveAgentRequest } from "@/lib/services/drive-agent-api";
import { getDriveMediaSecret } from "@/lib/services/drive-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return driveAgentRequest(request, async (db, device) => ({ mediaSecret: getDriveMediaSecret(db, device.id, (await context.params).id) }));
}
