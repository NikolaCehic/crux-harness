import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { stringify } from "yaml";
import { runHarness, type RunResult } from "./pipeline.js";
import type { QueryIntakeArtifact, QueryIntent, RunInput } from "./types.js";

export type QueryRunOptions = {
  context?: string;
  timeHorizon?: string;
  outputGoal?: string;
  sourcePolicy?: string;
};

export type QueryRunResult = RunResult & {
  intake: QueryIntakeArtifact;
  generatedInputPath: string;
};

export type NormalizedQueryInput = {
  input: RunInput;
  intake: QueryIntakeArtifact;
};

export function buildRunInputFromQuery(rawQuery: string, options: QueryRunOptions = {}): NormalizedQueryInput {
  const originalQuery = rawQuery.trim();
  if (!originalQuery) {
    throw new Error("Query must not be empty.");
  }

  const normalizedQuery = normalizeQuery(originalQuery);
  const intent = inferIntent(normalizedQuery);
  const complexity = inferComplexity(normalizedQuery);
  const riskLevel = inferRiskLevel(normalizedQuery);
  const ambiguous = isAmbiguous(normalizedQuery);
  const answerability = ambiguous ? "needs_clarification" : options.context ? "answerable" : "answerable_with_assumptions";
  const analysisScope = "general-analysis";
  const sourcePolicy = options.sourcePolicy ?? "hybrid";
  const decisionContext = options.context ?? buildDefaultContext(intent, riskLevel);
  const timeHorizon = options.timeHorizon ?? inferTimeHorizon(normalizedQuery, intent);
  const outputGoal = options.outputGoal ?? defaultOutputGoal(intent);
  const clarifyingQuestions = buildClarifyingQuestions(normalizedQuery, intent, ambiguous);
  const sourceNeeds = buildSourceNeeds(normalizedQuery, intent, riskLevel);
  const assumptions = buildAssumptions(riskLevel, answerability, sourcePolicy);

  const generatedInput = {
    question: originalQuery,
    decision_context: decisionContext,
    time_horizon: timeHorizon,
    output_goal: outputGoal,
    analysis_scope: analysisScope,
    source_policy: sourcePolicy
  };

  const intake: QueryIntakeArtifact = {
    schema_version: "crux.query_intake.v1",
    original_query: originalQuery,
    normalized_query: normalizedQuery,
    analysis_scope: analysisScope,
    intent,
    complexity,
    risk_level: riskLevel,
    answerability,
    source_policy: sourcePolicy,
    assumptions,
    clarifying_questions: clarifyingQuestions,
    source_needs: sourceNeeds,
    generated_input: generatedInput
  };

  return {
    intake,
    input: {
      ...generatedInput,
      query_intake: intake,
      risk_tolerance: riskLevel === "high" ? "low" : "medium",
      known_constraints: [
        "No vertical pack selected; generic scope-agnostic analysis is used.",
        `Query intake intent: ${intent}.`,
        `Query intake answerability: ${answerability}.`,
        `Query intake risk level: ${riskLevel}.`,
        `Source policy requested: ${sourcePolicy}.`,
        ...assumptions,
        ...sourceNeeds.map((need) => `Evidence need (${need.priority} ${need.source_type}): ${need.question}`)
      ],
      tool_budget: {
        max_research_items: riskLevel === "high" ? 8 : 5,
        max_agent_steps: complexity === "high" ? 10 : 6
      },
      model_budget: {
        max_llm_calls: complexity === "high" ? 8 : 4
      }
    }
  };
}

export async function runQuery(projectRoot: string, rawQuery: string, options: QueryRunOptions = {}): Promise<QueryRunResult> {
  const normalized = buildRunInputFromQuery(rawQuery, options);
  const generatedInputPath = await writeGeneratedInput(projectRoot, normalized.input);
  const run = await runHarness(projectRoot, generatedInputPath);
  return {
    ...run,
    intake: normalized.intake,
    generatedInputPath
  };
}

async function writeGeneratedInput(projectRoot: string, input: RunInput): Promise<string> {
  const queryInputsDir = path.join(projectRoot, "runs", "query-inputs");
  await mkdir(queryInputsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const target = path.join(queryInputsDir, `${stamp}-${slugify(input.question)}.yaml`);
  await writeFile(target, stringify(input), "utf8");
  return target;
}

function normalizeQuery(query: string): string {
  return query.replace(/\s+/g, " ").trim();
}

function inferIntent(query: string): QueryIntent {
  const lower = query.toLowerCase();
  if (/\b(why|root cause|caused|diagnose|spike|drop|decline|incident)\b/.test(lower)) {
    return "diagnostic";
  }
  if (/\b(vs|versus|compare|comparison|better|trade-?off)\b/.test(lower)) {
    return "comparison";
  }
  if (/\b(plan|roadmap|triage|sequence|rollout|how should)\b/.test(lower)) {
    return lower.startsWith("should ") || lower.includes(" should ") ? "decision" : "planning";
  }
  if (/\b(should|choose|prioritize|invest|buy|build|replace|stop|continue|automate|adopt)\b/.test(lower)) {
    return "decision";
  }
  if (/\b(what is|explain|summarize|research|find out|overview)\b/.test(lower)) {
    return "research";
  }
  return "open_exploration";
}

function inferComplexity(query: string): QueryIntakeArtifact["complexity"] {
  const words = query.split(/\s+/).filter(Boolean);
  const lower = query.toLowerCase();
  const complexitySignals = ["without", "while", "multiple", "tradeoff", "regulation", "enterprise", "architecture", "migration", "incident"];
  const signalCount = complexitySignals.filter((signal) => lower.includes(signal)).length;
  if (words.length >= 24 || signalCount >= 3) {
    return "high";
  }
  if (words.length >= 9 || signalCount >= 1) {
    return "moderate";
  }
  return "low";
}

function inferRiskLevel(query: string): QueryIntakeArtifact["risk_level"] {
  const lower = query.toLowerCase();
  const highRisk = [
    "medication",
    "prescribed",
    "diagnosis",
    "doctor",
    "legal",
    "lawsuit",
    "criminal",
    "security breach",
    "vulnerability",
    "safety-critical",
    "suicide",
    "self harm"
  ];
  if (highRisk.some((term) => lower.includes(term))) {
    return "high";
  }

  const mediumRisk = ["financial", "investment", "invoice", "compliance", "hiring", "layoff", "customer data", "privacy", "refund"];
  if (mediumRisk.some((term) => lower.includes(term))) {
    return "medium";
  }

  return "medium";
}

function isAmbiguous(query: string): boolean {
  const lower = query.toLowerCase().replace(/[?.!]/g, "").trim();
  const words = lower.split(/\s+/).filter(Boolean);
  if (words.length <= 4) {
    return true;
  }
  return ["what should we do", "what do i do", "help me decide", "is this good"].includes(lower);
}

function buildDefaultContext(intent: QueryIntent, riskLevel: QueryIntakeArtifact["risk_level"]): string {
  const stakes = riskLevel === "high"
    ? "The query may involve high-stakes consequences, so the run must expose assumptions, source needs, and limits."
    : "The user needs a practical, scope-agnostic analysis without relying on a predefined vertical pack.";

  return `Arbitrary query intake created this scope-agnostic context. Intent is ${intent}. ${stakes}`;
}

function inferTimeHorizon(query: string, intent: QueryIntent): string {
  const lower = query.toLowerCase();
  const explicit = lower.match(/\b(next|within|in|over)\s+([0-9]+\s+)?(day|days|week|weeks|month|months|quarter|quarters|year|years)\b/);
  if (explicit) {
    return explicit[0];
  }
  if (lower.includes("this quarter")) {
    return "this quarter";
  }
  if (intent === "research" || intent === "open_exploration") {
    return "current available evidence";
  }
  return "90 days";
}

function defaultOutputGoal(intent: QueryIntent): string {
  if (intent === "research" || intent === "open_exploration") {
    return "analysis memo";
  }
  if (intent === "diagnostic") {
    return "diagnostic memo";
  }
  return "decision memo";
}

function buildClarifyingQuestions(query: string, intent: QueryIntent, ambiguous: boolean): string[] {
  const questions = [
    "Who is the accountable decision maker or audience for this analysis?",
    "What constraints, source material, or current evidence should the harness treat as authoritative?"
  ];

  if (ambiguous) {
    questions.unshift("What specific decision, diagnosis, comparison, or research question should be answered?");
  }

  if (intent === "decision" || intent === "planning") {
    questions.push("What would make the recommendation actionable within the stated time horizon?");
  }

  if (query.toLowerCase().includes("should")) {
    questions.push("What options are being compared, and what happens if no action is taken?");
  }

  return [...new Set(questions)];
}

function buildSourceNeeds(
  query: string,
  intent: QueryIntent,
  riskLevel: QueryIntakeArtifact["risk_level"]
): QueryIntakeArtifact["source_needs"] {
  const baseQuestion = query.replace(/\?+$/, "");
  const needs: QueryIntakeArtifact["source_needs"] = [
    {
      source_type: "internal_document",
      question: `What internal context, constraints, or prior decisions materially affect: ${baseQuestion}?`,
      priority: "required"
    },
    {
      source_type: "dataset",
      question: `What metrics or observations would confirm whether the central claim in "${baseQuestion}" is true?`,
      priority: intent === "research" ? "recommended" : "required"
    },
    {
      source_type: "web",
      question: `What current external evidence or benchmarks are needed for "${baseQuestion}"?`,
      priority: "recommended"
    }
  ];

  if (riskLevel === "high") {
    needs.unshift({
      source_type: "expert_input",
      question: "What qualified expert, policy, clinical, legal, safety, or security guidance is required before acting?",
      priority: "required"
    });
  }

  return needs;
}

function buildAssumptions(
  riskLevel: QueryIntakeArtifact["risk_level"],
  answerability: QueryIntakeArtifact["answerability"],
  sourcePolicy: string
): string[] {
  const assumptions = [
    "The query is treated as scope-agnostic unless the user supplies a vertical pack or source pack.",
    `The initial run may use placeholder evidence until ${sourcePolicy} source material is connected.`
  ];

  if (answerability === "needs_clarification") {
    assumptions.push("The query is under-specified and should be clarified before making a final decision.");
  } else if (answerability === "answerable_with_assumptions") {
    assumptions.push("The run can proceed, but assumptions must be reviewed before acting on the memo.");
  }

  if (riskLevel === "high") {
    assumptions.push("This is a high-stakes query; the harness output is not a substitute for qualified expert review.");
  }

  return assumptions;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 52);

  return slug || "query";
}
