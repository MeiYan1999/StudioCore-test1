import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-surface-muted",
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  );
}
