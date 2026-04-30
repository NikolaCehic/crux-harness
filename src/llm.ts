export type LlmClient = {
  completeJson(request: LlmJsonRequest): Promise<unknown>;
};

export type LlmJsonRequest = {
  system: string;
  prompt: string;
  metadata: Record<string, unknown>;
};

export type EvidenceMapperSelection = {
  type: "deterministic" | "llm";
  reason: string;
};

export function createConfiguredLlmClient(env: NodeJS.ProcessEnv = process.env): LlmClient | undefined {
  const provider = env.CRUX_LLM_PROVIDER;
  const apiKey = env.CRUX_LLM_API_KEY;

  if (!provider || !apiKey) {
    return undefined;
  }

  if (provider === "openai-compatible") {
    return new OpenAiCompatibleClient({
      apiKey,
      model: env.CRUX_LLM_MODEL ?? "gpt-4.1-mini",
      baseUrl: env.CRUX_LLM_BASE_URL ?? "https://api.openai.com/v1"
    });
  }

  return undefined;
}

class OpenAiCompatibleClient implements LlmClient {
  constructor(private readonly config: { apiKey: string; model: string; baseUrl: string }) {}

  async completeJson(request: LlmJsonRequest): Promise<unknown> {
    const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.prompt }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.status} ${await response.text()}`);
    }

    const body = await response.json() as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("LLM response did not include message content.");
    }

    return JSON.parse(content) as unknown;
  }
}

