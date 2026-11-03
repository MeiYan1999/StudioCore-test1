import { cn, formatDate, formatDateTime } from "@/lib/utils";

export function DateText({
  value,
  className,
}: {
  value: Date | number | string | null | undefined;
  className?: string;
}) {
  return <span className={cn("whitespace-nowrap", className)}>{formatDate(value)}</span>;
}

export function DateTimeText({
  value,
  className,
}: {
  value: Date | number | string | null | undefined;
  className?: string;
}) {
  return (
    <span className={cn("whitespace-nowrap tabular-nums", className)}>
      {formatDateTime(value)}
    </span>
  );
}
