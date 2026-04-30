import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SourceItem } from "./types.js";

export type SourceImportOptions = {
  inputDir: string;
  outputDir: string;
};

export type ImportedSource = {
  id: string;
  title: string;
  source_type: SourceItem["source_type"];
  input_path: string;
  output_path: string;
  content_hash: string;
};

export type SkippedSource = {
  path: string;
  reason: string;
};

export type SourceImportReport = {
  input_dir: string;
  output_dir: string;
  imported_count: number;
  skipped_count: number;
  sources: ImportedSource[];
  skipped: SkippedSource[];
};

const supportedExtensions = new Map<string, SourceItem["source_type"]>([
  [".md", "internal_document"],
  [".txt", "internal_document"],
  [".csv", "dataset"]
]);

const extensionOrder = new Map([
  [".md", 0],
  [".txt", 1],
  [".csv", 2]
]);

export async function importSources(options: SourceImportOptions): Promise<SourceImportReport> {
  const inputDir = path.resolve(options.inputDir);
  const outputDir = path.resolve(options.outputDir);
  const files = await listFiles(inputDir);
  const supported = files
    .filter((file) => supportedExtensions.has(path.extname(file).toLowerCase()))
    .sort(compareImportFiles);
  const skipped = files
    .filter((file) => !supportedExtensions.has(path.extname(file).toLowerCase()))
    .sort()
    .map((file) => ({
      path: file,
      reason: `Unsupported extension: ${path.extname(file) || "(none)"}`
    }));

  await mkdir(outputDir, { recursive: true });

  const sources: ImportedSource[] = [];
  for (const [index, file] of supported.entries()) {
    const id = `S${index + 1}`;
    const raw = await readFile(file, "utf8");
    const ext = path.extname(file).toLowerCase();
    const sourceType = supportedExtensions.get(ext) ?? "internal_document";
    const title = extractTitle(raw, file, ext);
    const body = ext === ".csv" ? csvToMarkdown(raw, title) : raw.trim();
    const summary = summarize(body, file, ext);
    const outputName = `${id.toLowerCase()}-${slugify(title)}.md`;
    const outputPath = path.join(outputDir, outputName);
    const generated = renderSourceFile({
      id,
      title,
      source_type: sourceType,
      citation: `Imported source: ${title}`,
      summary,
      tags: ["imported", ext.slice(1)],
      body
    });

    await writeFile(outputPath, generated, "utf8");
    sources.push({
      id,
      title,
      source_type: sourceType,
      input_path: file,
      output_path: outputPath,
      content_hash: createHash("sha256").update(generated).digest("hex")
    });
  }

  return {
    input_dir: inputDir,
    output_dir: outputDir,
    imported_count: sources.length,
    skipped_count: skipped.length,
    sources,
    skipped
  };
}

function compareImportFiles(left: string, right: string): number {
  const leftExt = path.extname(left).toLowerCase();
  const rightExt = path.extname(right).toLowerCase();
  const extDiff = (extensionOrder.get(leftExt) ?? 99) - (extensionOrder.get(rightExt) ?? 99);
  return extDiff === 0 ? left.localeCompare(right) : extDiff;
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

function extractTitle(raw: string, file: string, ext: string): string {
  if (ext === ".md") {
    const heading = raw.split("\n").find((line) => line.trim().startsWith("# "));
    if (heading) {
      return heading.replace(/^#\s+/, "").trim();
    }
  }

  if (ext === ".txt") {
    const firstLine = raw.split(/\r?\n/).find((line) => line.trim().length > 0);
    if (firstLine && firstLine.trim().length <= 90) {
      return titleCase(firstLine.trim());
    }
  }

  return titleCase(path.basename(file, ext).replace(/[-_]+/g, " "));
}

function summarize(body: string, file: string, ext: string): string {
  if (ext === ".csv") {
    const rows = body.split("\n").filter((line) => line.trim().startsWith("|")).length - 2;
    return `CSV dataset imported from ${path.basename(file)} with ${Math.max(rows, 0)} data rows.`;
  }

  const paragraph = body
    .replace(/^# .+$/m, "")
    .split(/\n\s*\n/)
    .map((entry) => entry.trim().replace(/\s+/g, " "))
    .find(Boolean);
  return paragraph ? truncate(paragraph, 220) : `Imported source from ${path.basename(file)}.`;
}

function csvToMarkdown(raw: string, title: string): string {
  const rows = raw
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(",").map((cell) => cell.trim()));
  if (rows.length === 0) {
    return `# ${title}\n\nNo CSV rows provided.`;
  }

  const [header, ...dataRows] = rows;
  const table = [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...dataRows.map((row) => `| ${row.join(" | ")} |`)
  ].join("\n");

  return `# ${title}\n\n${table}`;
}

function renderSourceFile(input: {
  id: string;
  title: string;
  source_type: SourceItem["source_type"];
  citation: string;
  summary: string;
  tags: string[];
  body: string;
}): string {
  return [
    "---",
    `id: ${input.id}`,
    `title: ${frontMatter(input.title)}`,
    `source_type: ${input.source_type}`,
    `citation: ${frontMatter(input.citation)}`,
    "url: \"\"",
    "published: \"\"",
    `summary: ${frontMatter(input.summary)}`,
    "reliability: 0.7",
    "recency: 0.7",
    "relevance: 0.7",
    `tags: ${input.tags.join(", ")}`,
    "---",
    "",
    input.body.trim(),
    ""
  ].join("\n");
}

function frontMatter(value: string): string {
  return `"${value.replace(/"/g, "'")}"`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "source";
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3).trim()}...`;
}
