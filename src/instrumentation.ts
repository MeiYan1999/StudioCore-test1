export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNodeDbBackups } = await import("./instrumentation-node");
    await registerNodeDbBackups();
  }
}
