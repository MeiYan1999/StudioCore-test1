import { requireActor } from "@/lib/auth/session";
import { OmniWorkspace } from "@/components/omnichannel/workspace";
export const dynamic = "force-dynamic";
export const metadata = { title: "Kênh bán hàng · Facebook" };
export default async function FacebookSettings() {
  await requireActor();
  return <OmniWorkspace settings />;
}
