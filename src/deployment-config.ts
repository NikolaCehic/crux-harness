export type DeploymentConfig = {
  api: {
    host: string;
    port: number;
  };
  model: {
    provider: string | null;
    model: string;
    api_key_env: "CRUX_LLM_API_KEY";
    has_api_key: boolean;
  };
};

export function loadDeploymentConfig(env: Record<string, string | undefined> = process.env): DeploymentConfig {
  return {
    api: {
      host: env.CRUX_API_HOST ?? "0.0.0.0",
      port: parsePort(env.CRUX_API_PORT ?? "4317")
    },
    model: {
      provider: env.CRUX_LLM_PROVIDER || null,
      model: env.CRUX_LLM_MODEL ?? "gpt-4.1-mini",
      api_key_env: "CRUX_LLM_API_KEY",
      has_api_key: Boolean(env.CRUX_LLM_API_KEY)
    }
  };
}

function parsePort(value: string): number {
  const port = Number.parseInt(value, 10);
  if (Number.isNaN(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid CRUX_API_PORT: ${value}`);
  }

  return port;
}
