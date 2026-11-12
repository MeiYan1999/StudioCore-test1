import { requireActor } from "@/lib/auth/session";
import { OmniWorkspace } from "@/components/omnichannel/workspace";
export const dynamic = "force-dynamic";
export const metadata = { title: "Cài đặt Tin nhắn" };
export default async function FacebookSettings() {
  await requireActor();
  return <OmniWorkspace settings />;
}
