export const stageNames = [
  "normalize_question",
  "ingest_sources",
  "build_claim_graph",
  "gather_evidence",
  "verify_claims",
  "red_team",
  "model_uncertainty",
  "write_decision_memo",
  "evaluate"
] as const;

export type StageName = typeof stageNames[number];

export type StageModuleKind = "deterministic" | "llm" | "external";

export type StageModule = {
  stage: StageName;
  module_id: string;
  module_version: string;
  kind: StageModuleKind;
  prompt_version?: string;
  provider?: string;
  model?: string;
  timeout_ms: number;
  max_retries: number;
};

export type StageModuleRegistry = {
  modules: StageModule[];
  get(stage: StageName): StageModule;
};

export type StageModuleRunResult<T> = {
  value: T;
  module: StageModule;
  attempts: number;
  duration_ms: number;
};

export function stageModuleMetadata(module: StageModule, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    module_id: module.module_id,
    module_version: module.module_version,
    module_kind: module.kind,
    prompt_version: module.prompt_version ?? null,
    provider: module.provider ?? null,
    model: module.model ?? null,
    timeout_ms: module.timeout_ms,
    max_retries: module.max_retries,
    ...extra
  };
}
