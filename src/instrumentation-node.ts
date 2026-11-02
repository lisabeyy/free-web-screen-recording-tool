import { sweep } from "./lib/sessions";

/** Every minute, delete recordings older than 6 hours from Mux so nothing is stored longer than promised. */
export function startSweeper() {
  const run = () => sweep().catch((e) => console.error("sweep", e));
  run();
  setInterval(run, 60_000);
}
