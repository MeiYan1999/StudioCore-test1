import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandApertureIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="13.5" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
      {/* 6 camera aperture blades radiating inwards */}
      <path
        d="M16 2.5 L20.8 11.8 M29.5 9.8 L21.2 16 M27 24.2 L16.2 19.8 M16 29.5 L11.2 20.2 M2.5 22.2 L10.8 16 M5 7.8 L15.8 12.2"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="3.2" fill="currentColor" />
    </svg>
  );
}

export function BrandLogo({
  href = "/",
  size = "md",
  showTagline = true,
  className,
}: {
  href?: string;
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  className?: string;
}) {
  const iconSizes = {
    sm: "h-7 w-7 rounded-lg",
    md: "h-9 w-9 rounded-xl",
    lg: "h-11 w-11 rounded-2xl",
  };

  const svgSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const textSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  const content = (
    <div className={cn("group flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center bg-gradient-to-tr from-violet-600 via-indigo-600 to-fuchsia-500 text-white shadow-md shadow-violet-500/25 ring-1 ring-white/25 transition-transform duration-300 group-hover:scale-105 group-hover:shadow-violet-500/40",
          iconSizes[size],
        )}
      >
        <BrandApertureIcon className={cn(svgSizes[size], "transition-transform duration-500 group-hover:rotate-45")} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={cn("font-extrabold tracking-tight text-foreground", textSizes[size])}>
            Studio<span className="text-primary">Core</span>
          </span>
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-primary">
            SaaS
          </span>
        </div>
        {showTagline && (
          <p className="mt-1 truncate text-[11px] font-medium text-muted-foreground">
            Hệ điều hành Studio &amp; Áo cưới
          </p>
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
