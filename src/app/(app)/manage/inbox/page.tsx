import { requireActor } from "@/lib/auth/session";
import { OmniWorkspace } from "@/components/omnichannel/workspace";
export const dynamic = "force-dynamic";
export const metadata = { title: "Inbox" };
export default async function InboxPage() {
  await requireActor();
  return <OmniWorkspace />;
}
