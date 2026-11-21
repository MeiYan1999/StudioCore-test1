import { driveAgentRequest, drivePublicUrl } from "@/lib/services/drive-agent-api";
import {
  createDriveShare,
  driveShareInputSchema,
  listDriveSharesForDevice,
} from "@/lib/services/drive-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return driveAgentRequest(request, (db, device) => ({
    shares: listDriveSharesForDevice(db, device.id).map((s) => ({
      ...s,
      url: drivePublicUrl(s.url, request),
    })),
  }));
}
export async function POST(request: Request) {
  return driveAgentRequest(request, async (db, device) => {
    const share = createDriveShare(
      db,
      device.id,
      driveShareInputSchema.parse(await request.json()),
    );
    return { share: { ...share, url: drivePublicUrl(share.url, request) } };
  });
}
