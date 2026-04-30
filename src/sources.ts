import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { RunInput, SourceChunksArtifact, SourceChunk, SourceInventory, SourceItem } from "./types.js";

type ParsedSource = {
  metadata: Record<string, string>;
  body: string;
};

export async function buildSourceInventory(projectRoot: string, input: RunInput): Promise<SourceInventory> {
  const sourcePackPath = getSourcePackPath(input);
  if (!sourcePackPath) {
    return {
      source_pack: {
        path: null,
        mode: "none"
      },
      sources: []
    };
  }

  const absolutePackPath = path.resolve(projectRoot, sourcePackPath);
  const files = (await listSourceFiles(absolutePackPath)).sort();
  const sources: SourceItem[] = [];

  for (const filePath of files) {
    const raw = await readFile(filePath, "utf8");
    const parsed = parseSourceFile(raw);
    const relativeFilePath = path.relative(projectRoot, filePath);
    sources.push({
      id: requireMetadata(parsed, "id", relativeFilePath),
      path: relativeFilePath,
      title: requireMetadata(parsed, "title", relativeFilePath),
      source_type: parseSourceType(requireMetadata(parsed, "source_type", relativeFilePath), relativeFilePath),
      citation: requireMetadata(parsed, "citation", relativeFilePath),
      url: parsed.metadata.url ?? "",
      published: parsed.metadata.published ?? "",
      summary: parsed.metadata.summary ?? firstParagraph(parsed.body),
      reliability: parseScore(parsed.metadata.reliability, "reliability", relativeFilePath),
      recency: parseScore(parsed.metadata.recency, "recency", relativeFilePath),
      relevance: parseScore(parsed.metadata.relevance, "relevance", relativeFilePath),
      tags: parseTags(parsed.metadata.tags),
      content_hash: createHash("sha256").update(raw).digest("hex")
    });
  }

  return {
    source_pack: {
      path: sourcePackPath,
      mode: "directory"
    },
    sources
  };
}

export async function buildSourceChunks(projectRoot: string, sourceInventory: SourceInventory): Promise<SourceChunksArtifact> {
  if (sourceInventory.sources.length === 0) {
    return {
      source_pack: sourceInventory.source_pack,
      chunks: []
    };
  }

  const chunks: SourceChunk[] = [];
  const sources = [...sourceInventory.sources].sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));

  for (const source of sources) {
    const raw = await readFile(path.resolve(projectRoot, source.path), "utf8");
    const parsed = parseSourceFile(raw);
    const textChunks = chunkText(parsed.body);

    textChunks.forEach((text, index) => {
      const ordinal = index + 1;
      chunks.push({
        id: `${source.id}#chunk-${String(ordinal).padStart(3, "0")}`,
        source_id: source.id,
        path: source.path,
        ordinal,
        text,
        content_hash: createHash("sha256").update(text).digest("hex")
      });
    });
  }

  return {
    source_pack: sourceInventory.source_pack,
    chunks
  };
}

function getSourcePackPath(input: RunInput): string | undefined {
  if (typeof input.source_pack === "string") {
    return input.source_pack;
  }

  return input.source_pack?.path;
}

async function listSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listSourceFiles(entryPath));
    } else if (entry.isFile() && [".md", ".txt"].includes(path.extname(entry.name).toLowerCase())) {
      files.push(entryPath);
    }
  }

  return files;
}

function parseSourceFile(raw: string): ParsedSource {
  if (!raw.startsWith("---\n")) {
    return { metadata: {}, body: raw.trim() };
  }

  const end = raw.indexOf("\n---", 4);
  if (end === -1) {
    return { metadata: {}, body: raw.trim() };
  }

  const frontMatter = raw.slice(4, end).trim();
  const body = raw.slice(end + 4).trim();
  const metadata: Record<string, string> = {};

  for (const line of frontMatter.split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^"|"$/g, "");
    metadata[key] = value;
  }

  return { metadata, body };
}

function requireMetadata(parsed: ParsedSource, key: string, filePath: string): string {
  const value = parsed.metadata[key];
  if (!value) {
    throw new Error(`Source file ${filePath} is missing required metadata: ${key}`);
  }

  return value;
}

function parseSourceType(value: string, filePath: string): SourceItem["source_type"] {
  if (["web", "paper", "dataset", "internal_document", "expert_input"].includes(value)) {
    return value as SourceItem["source_type"];
  }

  throw new Error(`Source file ${filePath} has invalid source_type: ${value}`);
}

function parseScore(value: string | undefined, field: string, filePath: string): number {
  const parsed = Number.parseFloat(value ?? "");
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`Source file ${filePath} has invalid ${field}: ${value}`);
  }

  return parsed;
}

function parseTags(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function firstParagraph(body: string): string {
  return body.split(/\n\s*\n/).find((paragraph) => paragraph.trim().length > 0)?.trim() ?? "No summary provided.";
}

function chunkText(body: string): string[] {
  const paragraphs = body
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim().replace(/\s+/g, " "))
    .filter(Boolean);

  return paragraphs.length > 0 ? paragraphs : ["No source text provided."];
}
