import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral: "border-border bg-surface-muted text-foreground",
        info: "border-blue-200 bg-blue-50 text-[var(--info)] dark:border-blue-900 dark:bg-blue-950/40",
        success:
          "border-emerald-200 bg-emerald-50 text-[var(--success)] dark:border-emerald-900 dark:bg-emerald-950/40",
        warning:
          "border-amber-200 bg-amber-50 text-[var(--warning)] dark:border-amber-900 dark:bg-amber-950/40",
        danger:
          "border-red-200 bg-red-50 text-[var(--danger)] dark:border-red-900 dark:bg-red-950/40",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
