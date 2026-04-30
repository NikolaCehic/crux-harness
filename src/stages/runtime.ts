import type { StageModule, StageModuleRunResult } from "./types.js";

export async function runStageModule<T>(module: StageModule, work: () => Promise<T>): Promise<StageModuleRunResult<T>> {
  const startedAt = performance.now();
  let attempts = 0;
  let lastError: unknown;

  while (attempts <= module.max_retries) {
    attempts += 1;
    try {
      const value = await withTimeout(work(), module.timeout_ms, module.module_id);
      return {
        value,
        module,
        attempts,
        duration_ms: round(performance.now() - startedAt)
      };
    } catch (error) {
      lastError = error;
      if (attempts > module.max_retries) {
        break;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, moduleId: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Stage module ${moduleId} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
