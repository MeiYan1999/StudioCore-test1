export function AmbientGlow() {
  return (
    <div
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      aria-hidden="true"
    >
      {/* Mesh glow gradients */}
      <div className="absolute -top-40 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-primary/20 via-violet-600/15 to-fuchsia-400/15 blur-[130px] dark:from-primary/30 dark:via-violet-600/25 dark:to-fuchsia-400/20" />
      <div className="absolute top-1/3 -right-20 -z-10 h-[380px] w-[380px] rounded-full bg-gradient-to-bl from-amber-500/12 via-rose-500/10 to-transparent blur-[110px]" />
      <div className="absolute top-2/3 -left-20 -z-10 h-[320px] w-[320px] rounded-full bg-gradient-to-tr from-indigo-500/10 via-primary/10 to-transparent blur-[100px]" />

      {/* Dot matrix pattern with radial mask */}
      <div
        className="absolute inset-0 bg-dot-pattern opacity-60"
        style={{
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
        }}
      />
    </div>
  );
}
