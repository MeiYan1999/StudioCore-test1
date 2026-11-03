import { cn, formatVnd } from "@/lib/utils";

export function Money({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <span className={cn("tabular-nums", className)}>{formatVnd(value)}</span>
  );
}
