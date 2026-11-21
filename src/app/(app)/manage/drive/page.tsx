import { requireActor } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";

export default async function ManageDrivePage() {
  const actor = await requireActor();
  assertPermission(actor, "albums.view");
  return <section><h1>StudioCore Drive</h1><p>Giao diện quản lý đang được cập nhật.</p></section>;
}
