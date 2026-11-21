import { driveAgentRequest } from "@/lib/services/drive-agent-api";
import { driveHeartbeatSchema, heartbeatDriveDevice } from "@/lib/services/drive-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return driveAgentRequest(request, async (db, device) => ({
    device: heartbeatDriveDevice(db, device.id, driveHeartbeatSchema.parse(await request.json())),
    serverTime: new Date().toISOString(),
  }));
}
