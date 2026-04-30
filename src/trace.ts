import { appendFile } from "node:fs/promises";
import path from "node:path";
import type { TraceEvent } from "./types.js";

export async function trace(
  runDir: string,
  event: Omit<TraceEvent, "timestamp">
): Promise<void> {
  const fullEvent: TraceEvent = {
    timestamp: new Date().toISOString(),
    ...event
  };

  await appendFile(path.join(runDir, "trace.jsonl"), `${JSON.stringify(fullEvent)}\n`, "utf8");
}

