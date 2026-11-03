import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva("rounded-lg border p-4 text-sm", {
  variants: {
    tone: {
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
    tone: "info",
  },
});

export function Alert({
  className,
  tone,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      role="alert"
      className={cn(alertVariants({ tone }), className)}
      {...props}
    />
  );
}
