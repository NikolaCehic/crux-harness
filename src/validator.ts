import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";

type ValidationResult = {
  valid: boolean;
  errors: string[];
};

export class ArtifactValidator {
  private readonly ajv = new Ajv2020({ allErrors: true, strict: false });
  private loaded = false;

  constructor(private readonly schemasDir: string) {}

  async load(): Promise<void> {
    if (this.loaded) {
      return;
    }

    const files = (await readdir(this.schemasDir)).filter((file) => file.endsWith(".json"));
    for (const file of files) {
      const raw = await readFile(path.join(this.schemasDir, file), "utf8");
      this.ajv.addSchema(JSON.parse(raw));
    }
    this.loaded = true;
  }

  async validate(schemaId: string, value: unknown): Promise<ValidationResult> {
    await this.load();
    const validate = this.ajv.getSchema(schemaId);
    if (!validate) {
      throw new Error(`Schema not loaded: ${schemaId}`);
    }

    const validationOutcome = validate(value);
    if (typeof validationOutcome !== "boolean") {
      throw new Error(`Async schema validation is not supported for: ${schemaId}`);
    }

    const valid = validationOutcome;
    return {
      valid,
      errors: valid
        ? []
        : (validate.errors ?? []).map((error: ErrorObject) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
    };
  }
}

export const schemaIds = {
  questionSpec: "https://crux.local/schemas/question_spec.schema.json",
  sourceInventory: "https://crux.local/schemas/source_inventory.schema.json",
  sourceChunks: "https://crux.local/schemas/source_chunks.schema.json",
  claims: "https://crux.local/schemas/claims.schema.json",
  evidence: "https://crux.local/schemas/evidence.schema.json",
  contradictions: "https://crux.local/schemas/contradictions.schema.json",
  uncertainty: "https://crux.local/schemas/uncertainty.schema.json",
  evalReport: "https://crux.local/schemas/eval_report.schema.json"
} as const;
