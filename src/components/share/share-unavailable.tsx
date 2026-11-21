import { Images, Link2Off, ShieldAlert } from "lucide-react";

export function ShareUnavailable({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
          {title.includes("hết hạn") || title.includes("thu hồi") ? (
            <Link2Off className="h-6 w-6" aria-hidden />
          ) : (
            <ShieldAlert className="h-6 w-6" aria-hidden />
          )}
        </span>
        <h1 className="mt-4 text-lg font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Images className="h-3.5 w-3.5" aria-hidden />
          StudioCore PhotoShare
        </p>
      </div>
    </div>
  );
}
