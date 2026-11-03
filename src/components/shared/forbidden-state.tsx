import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./empty-state";

export function ForbiddenState({
  description = "Bạn không có quyền truy cập khu vực này. Liên hệ chủ studio nếu cần thay đổi quyền.",
}: {
  description?: string;
}) {
  return (
    <EmptyState
      icon={<ShieldX className="h-6 w-6" aria-hidden="true" />}
      title="403 — Không có quyền truy cập"
      description={description}
      action={
        <Button asChild variant="outline">
          <Link href="/manage/dashboard">Về dashboard</Link>
        </Button>
      }
    />
  );
}
