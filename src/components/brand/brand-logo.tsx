import Image from "next/image";
import Link from "next/link";

export function BrandIcon({ className = "size-9 shrink-0" }: { className?: string }) {
  return (
    <Image src="/icon.svg" alt="" width={40} height={40} className={className} />
  );
}

export function BrandLogo({ stacked = false }: { stacked?: boolean }) {
  return (
    <Link href="/" className="inline-flex shrink-0 items-center gap-2">
      {stacked ? (
        <Image
          src="/brand-logo.png"
          alt="StudioCore — Since 2026"
          width={390}
          height={320}
          sizes="144px"
          className="h-auto w-36 rounded-xl border border-border"
        />
      ) : (
        <>
          <BrandIcon />
          <span className="block">
            <span className="block text-sm font-extrabold uppercase leading-none tracking-wide text-foreground">
              StudioCore
            </span>
            <span className="mt-1 block text-[10px] uppercase leading-none tracking-[0.24em] text-muted-foreground">
              Since 2026
            </span>
          </span>
        </>
      )}
    </Link>
  );
}
