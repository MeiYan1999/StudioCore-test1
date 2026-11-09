export function AmbientGlow() {
  return (
    <div
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      aria-hidden="true"
    >
      {/* Mesh glow gradients */}
      <div className="absolute -top-40 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-primary/15 via-indigo-500/10 to-sky-400/15 blur-[120px] dark:from-primary/25 dark:via-indigo-500/20 dark:to-sky-400/20" />
      <div className="absolute top-1/3 -right-20 -z-10 h-[350px] w-[350px] rounded-full bg-gradient-to-bl from-rose-500/10 to-amber-500/5 blur-[100px]" />

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
