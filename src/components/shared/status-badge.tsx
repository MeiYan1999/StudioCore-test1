import { Badge, type BadgeTone } from "@/components/ui/badge";

export function StatusBadge({
  tone,
  children,
}: {
  tone: BadgeTone;
  children: React.ReactNode;
}) {
  return <Badge tone={tone}>{children}</Badge>;
}

export function ActiveStatusBadge({ active }: { active: boolean }) {
  return (
    <StatusBadge tone={active ? "success" : "neutral"}>
      {active ? "Đang làm" : "Tạm khóa"}
    </StatusBadge>
  );
}
