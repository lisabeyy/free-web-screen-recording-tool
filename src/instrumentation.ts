export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startSweeper } = await import("./instrumentation-node");
    startSweeper();
  }
}
