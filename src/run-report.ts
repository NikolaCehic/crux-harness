import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadRunArtifactBundle, type RunArtifactBundle } from "./run-bundle.js";
import type { Claim, EvidenceItem, SourceChunk, SourceItem } from "./types.js";

export async function writeRunReport(projectRoot: string, runDir: string, outPath?: string): Promise<string> {
  const bundle = await loadRunArtifactBundle(projectRoot, runDir);
  const target = path.resolve(projectRoot, outPath ?? path.join(bundle.run_dir, "run_report.html"));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, renderRunReportHtml(bundle), "utf8");
  return path.relative(projectRoot, target);
}

export function renderRunReportHtml(bundle: RunArtifactBundle): string {
  const rootClaims = bundle.claims.root_claim_ids
    .map((claimId) => bundle.claims.claims.find((claim) => claim.id === claimId))
    .filter((claim): claim is Claim => Boolean(claim));

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Crux Run Inspector</title>
  <style>
    :root {
      color-scheme: light;
      --bg: oklch(97.5% 0.006 230);
      --surface: oklch(99% 0.004 230);
      --surface-2: oklch(94.5% 0.008 230);
      --text: oklch(24% 0.015 245);
      --muted: oklch(49% 0.018 245);
      --line: oklch(86% 0.012 245);
      --accent: oklch(48% 0.13 230);
      --accent-soft: oklch(92% 0.045 230);
      --success: oklch(45% 0.11 150);
      --warning: oklch(58% 0.12 75);
      --danger: oklch(52% 0.16 30);
      --code: oklch(94% 0.01 255);
    }

    * { box-sizing: border-box; }

    html {
      scroll-behavior: smooth;
    }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      font-size: 14px;
      line-height: 1.45;
    }

    a {
      color: var(--accent);
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    .shell {
      display: grid;
      grid-template-columns: 248px minmax(0, 1fr);
      min-height: 100vh;
    }

    .sidebar {
      position: sticky;
      top: 0;
      height: 100vh;
      padding: 20px 16px;
      background: var(--surface);
      border-right: 1px solid var(--line);
      overflow: auto;
    }

    .brand {
      display: grid;
      gap: 4px;
      margin-bottom: 20px;
    }

    .brand strong {
      font-size: 15px;
      letter-spacing: 0;
    }

    .brand span {
      color: var(--muted);
      font-size: 12px;
      overflow-wrap: anywhere;
    }

    .nav {
      display: grid;
      gap: 2px;
    }

    .nav a {
      border-radius: 6px;
      color: var(--text);
      padding: 7px 9px;
    }

    .nav a:hover {
      background: var(--surface-2);
      text-decoration: none;
    }

    main {
      min-width: 0;
      padding: 24px;
    }

    .header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 20px;
      align-items: start;
      margin-bottom: 18px;
    }

    h1 {
      margin: 0 0 6px;
      font-size: 24px;
      line-height: 1.2;
      letter-spacing: 0;
    }

    h2 {
      margin: 0 0 12px;
      font-size: 18px;
      letter-spacing: 0;
    }

    h3 {
      margin: 16px 0 8px;
      font-size: 15px;
      letter-spacing: 0;
    }

    .subtle {
      color: var(--muted);
    }

    .panel {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 8px;
      margin: 14px 0;
      overflow: hidden;
    }

    .panel-body {
      padding: 16px;
    }

    .metric-grid {
      display: grid;
      grid-template-columns: repeat(6, minmax(112px, 1fr));
      gap: 8px;
    }

    .metric {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
    }

    .metric span {
      color: var(--muted);
      display: block;
      font-size: 11px;
      margin-bottom: 3px;
    }

    .metric strong {
      font-size: 18px;
    }

    .status {
      align-items: center;
      border-radius: 999px;
      display: inline-flex;
      font-size: 12px;
      font-weight: 650;
      line-height: 1;
      padding: 5px 8px;
      text-transform: uppercase;
    }

    .status.pass,
    .status.supported {
      background: oklch(93% 0.045 150);
      color: var(--success);
    }

    .status.warn,
    .status.weakly_supported,
    .status.contested,
    .status.unknown {
      background: oklch(94% 0.055 80);
      color: var(--warning);
    }

    .status.fail,
    .status.unsupported,
    .status.high {
      background: oklch(93% 0.055 30);
      color: var(--danger);
    }

    .table-wrap {
      overflow-x: auto;
    }

    table {
      border-collapse: collapse;
      min-width: 760px;
      width: 100%;
    }

    th,
    td {
      border-top: 1px solid var(--line);
      padding: 9px 10px;
      text-align: left;
      vertical-align: top;
    }

    th {
      background: var(--surface-2);
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .claim-list,
    .evidence-list,
    .diagnostic-list {
      display: grid;
      gap: 10px;
    }

    .item {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      background: var(--surface);
    }

    .item-head {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: space-between;
      margin-bottom: 7px;
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }

    .chip {
      background: var(--accent-soft);
      border-radius: 999px;
      color: var(--accent);
      display: inline-flex;
      font-size: 12px;
      padding: 4px 7px;
    }

    .markdown {
      max-width: 74ch;
    }

    .markdown p {
      margin: 8px 0;
    }

    .markdown ul,
    .markdown ol {
      margin: 8px 0 12px 22px;
      padding: 0;
    }

    .excerpt,
    code {
      background: var(--code);
      border-radius: 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px;
    }

    .excerpt {
      margin-top: 8px;
      padding: 10px;
      white-space: pre-wrap;
    }

    details {
      border-top: 1px solid var(--line);
      padding: 10px 0 0;
    }

    summary {
      cursor: pointer;
      font-weight: 650;
    }

    .trace-row {
      display: grid;
      grid-template-columns: 170px 160px 1fr;
      gap: 10px;
      border-top: 1px solid var(--line);
      padding: 9px 0;
    }

    @media (max-width: 900px) {
      .shell {
        grid-template-columns: 1fr;
      }

      .sidebar {
        height: auto;
        position: relative;
      }

      .header {
        grid-template-columns: 1fr;
      }

      .metric-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      main {
        padding: 16px;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <strong>Crux Run Inspector</strong>
        <span>${escapeHtml(bundle.run_dir)}</span>
      </div>
      <nav class="nav" aria-label="Run sections">
        <a href="#summary">Summary</a>
        <a href="#memo">Decision Memo</a>
        <a href="#claims">Claim Graph</a>
        <a href="#evidence">Evidence</a>
        <a href="#sources">Sources</a>
        <a href="#contradictions">Contradictions</a>
        <a href="#uncertainty">Uncertainty</a>
        <a href="#agents">Agents</a>
        <a href="#eval">Eval</a>
        <a href="#diagnostics">Diagnostics</a>
        <a href="#trace">Trace</a>
      </nav>
    </aside>
    <main>
      <header class="header" id="summary">
        <div>
          <h1>${escapeHtml(bundle.question_spec.question)}</h1>
          <div class="subtle">${escapeHtml(bundle.summary.scenario)} &middot; harness ${escapeHtml(bundle.run_config.harness_version)} &middot; ${escapeHtml(bundle.run_config.source_policy)}</div>
        </div>
        <span class="status ${bundle.summary.council_status}">${escapeHtml(bundle.summary.council_status)}</span>
      </header>

      <section class="metric-grid" aria-label="Run counts">
        ${metric("Claims", bundle.summary.claim_count)}
        ${metric("Evidence", bundle.summary.evidence_count)}
        ${metric("Sources", bundle.summary.source_count)}
        ${metric("Chunks", bundle.summary.source_chunk_count)}
        ${metric("Contradictions", bundle.summary.contradiction_count)}
        ${metric("Agents", bundle.summary.agent_count)}
      </section>

      <section class="panel" id="memo">
        <div class="panel-body">
          <h2>Decision Memo</h2>
          <div class="chips">${rootClaims.map((claim) => linkChip(`#${claimId(claim.id)}`, `Root ${claim.id}`)).join("")}</div>
          <div class="markdown">${renderMarkdown(bundle.decision_memo)}</div>
        </div>
      </section>

      <section class="panel" id="claims">
        <div class="panel-body">
          <h2>Claim Graph</h2>
          <div class="claim-list">
            ${bundle.claims.claims.map((claim) => renderClaim(bundle, claim)).join("")}
          </div>
        </div>
      </section>

      <section class="panel" id="evidence">
        <div class="panel-body">
          <h2>Evidence</h2>
          <div class="evidence-list">
            ${bundle.evidence.evidence.map((item) => renderEvidence(bundle, item)).join("")}
          </div>
        </div>
      </section>

      <section class="panel" id="sources">
        <div class="panel-body">
          <h2>Sources</h2>
          <div class="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Title</th><th>Type</th><th>Quality</th><th>Chunks</th></tr></thead>
              <tbody>${bundle.source_inventory.sources.map((source) => renderSource(bundle, source)).join("")}</tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="panel" id="contradictions">
        <div class="panel-body">
          <h2>Contradictions</h2>
          <div class="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Severity</th><th>Claims</th><th>Description</th><th>Next Step</th></tr></thead>
              <tbody>${bundle.contradictions.contradictions.map((item) => `
                <tr>
                  <td>${escapeHtml(item.id)}</td>
                  <td><span class="status ${item.severity}">${escapeHtml(item.severity)}</span></td>
                  <td>${item.claim_ids.map((id) => link(`#${claimId(id)}`, id)).join(" ")}</td>
                  <td>${escapeHtml(item.description)}</td>
                  <td>${escapeHtml(item.next_step)}</td>
                </tr>`).join("")}</tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="panel" id="uncertainty">
        <div class="panel-body">
          <h2>Uncertainty</h2>
          <div class="subtle">Overall confidence: ${bundle.uncertainty.overall_confidence}</div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Description</th><th>Impact If Wrong</th><th>Evidence Needed</th></tr></thead>
              <tbody>${bundle.uncertainty.key_uncertainties.map((item) => `
                <tr>
                  <td>${escapeHtml(item.id)}</td>
                  <td>${escapeHtml(item.description)}</td>
                  <td>${escapeHtml(item.impact_if_wrong)}</td>
                  <td>${escapeHtml(item.evidence_needed)}</td>
                </tr>`).join("")}</tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="panel" id="eval">
        <div class="panel-body">
          <h2>Eval</h2>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Score</th><th>Value</th></tr></thead>
              <tbody>${Object.entries(bundle.eval_report.scores).map(([name, value]) => `
                <tr><td>${escapeHtml(name)}</td><td>${value}</td></tr>`).join("")}</tbody>
            </table>
          </div>
          <h3>Council</h3>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Reviewer</th><th>Status</th><th>Score</th><th>Stage</th><th>Findings</th></tr></thead>
              <tbody>${bundle.eval_report.council.reviewers.map((reviewer) => `
                <tr>
                  <td>${escapeHtml(reviewer.role_name)}</td>
                  <td><span class="status ${reviewer.status}">${escapeHtml(reviewer.status)}</span></td>
                  <td>${reviewer.score}</td>
                  <td>${escapeHtml(reviewer.stage)}</td>
                  <td>${reviewer.findings.map(escapeHtml).join("<br>")}</td>
                </tr>`).join("")}</tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="panel" id="agents">
        <div class="panel-body">
          <h2>Bounded Agents</h2>
          <div class="subtle">Synthesis: <span class="status ${bundle.summary.agent_status}">${escapeHtml(bundle.summary.agent_status)}</span> confidence ${bundle.agent_findings.synthesis.confidence}</div>
          <div class="diagnostic-list">
            ${bundle.agent_findings.findings.map((finding) => `
              <article class="item">
                <div class="item-head">
                  <strong>${escapeHtml(finding.name)} &middot; ${escapeHtml(finding.role)}</strong>
                  <span class="status ${finding.status}">${escapeHtml(finding.status)}</span>
                </div>
                <div>${escapeHtml(finding.summary)}</div>
                <div class="subtle">Stage ${escapeHtml(finding.stage)} &middot; confidence ${finding.confidence}</div>
                <div class="chips">${finding.input_artifacts.map((artifact) => `<span class="chip">${escapeHtml(artifact)}</span>`).join("")}</div>
                ${finding.blocking_issues.length ? `<h3>Blocking Issues</h3><ul>${finding.blocking_issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")}</ul>` : ""}
                ${finding.next_actions.length ? `<h3>Next Actions</h3><ul>${finding.next_actions.map((action) => `<li>${escapeHtml(action)}</li>`).join("")}</ul>` : ""}
              </article>`).join("")}
          </div>
        </div>
      </section>

      <section class="panel" id="diagnostics">
        <div class="panel-body">
          <h2>Diagnostics</h2>
          ${renderDiagnostics(bundle)}
        </div>
      </section>

      <section class="panel" id="trace">
        <div class="panel-body">
          <h2>Trace</h2>
          ${bundle.trace.map((event) => `
            <div class="trace-row">
              <code>${escapeHtml(event.timestamp)}</code>
              <span>${escapeHtml(event.stage)} &middot; ${escapeHtml(event.event_type)}</span>
              <span>${escapeHtml(event.message)}</span>
            </div>`).join("")}
        </div>
      </section>
    </main>
  </div>
</body>
</html>`;
}

function renderClaim(bundle: RunArtifactBundle, claim: Claim): string {
  const evidenceIds = bundle.relationships.evidence_ids_by_claim_id[claim.id] ?? [];
  const dependencyLinks = claim.depends_on.map((id) => link(`#${claimId(id)}`, id)).join(" ");
  const evidenceLinks = evidenceIds.map((id) => linkChip(`#${evidenceId(id)}`, id)).join("");

  return `<article class="item" id="${claimId(claim.id)}">
    <div class="item-head">
      <strong>${escapeHtml(claim.id)} &middot; ${escapeHtml(claim.type)}</strong>
      <span class="status ${claim.status}">${escapeHtml(claim.status)}</span>
    </div>
    <div>${escapeHtml(claim.text)}</div>
    <div class="subtle">Confidence ${claim.confidence} &middot; importance ${claim.importance}${dependencyLinks ? ` &middot; depends on ${dependencyLinks}` : ""}</div>
    <div class="chips">${evidenceLinks || "<span class=\"chip\">No mapped evidence</span>"}</div>
  </article>`;
}

function renderEvidence(bundle: RunArtifactBundle, item: EvidenceItem): string {
  const claimLinks = [...item.supports_claim_ids, ...item.challenges_claim_ids]
    .map((id) => link(`#${claimId(id)}`, id))
    .join(" ");
  const sourceLinks = (item.source_ids ?? []).map((id) => link(`#${sourceId(id)}`, id)).join(" ");
  const chunkLinks = (item.chunk_ids ?? []).map((id) => link(`#${chunkId(id)}`, id)).join(" ");

  return `<article class="item" id="${evidenceId(item.id)}">
    <div class="item-head">
      <strong>${escapeHtml(item.id)} &middot; ${escapeHtml(item.source_type)}</strong>
      <span class="subtle">reliability ${item.reliability} &middot; relevance ${item.relevance}</span>
    </div>
    <div>${escapeHtml(item.summary)}</div>
    <div class="subtle">Claims: ${claimLinks || "none"} &middot; Sources: ${sourceLinks || "none"} &middot; Chunks: ${chunkLinks || "none"}</div>
    ${item.excerpt ? `<div class="excerpt">${escapeHtml(item.excerpt)}</div>` : ""}
    <details>
      <summary>Limitations and citation</summary>
      <p>${escapeHtml(item.limitations)}</p>
      <p>${escapeHtml(item.citation)}</p>
    </details>
  </article>`;
}

function renderSource(bundle: RunArtifactBundle, source: SourceItem): string {
  const chunks = bundle.source_chunks.chunks.filter((chunk) => chunk.source_id === source.id);

  return `<tr id="${sourceId(source.id)}">
    <td>${escapeHtml(source.id)}</td>
    <td>${escapeHtml(source.title)}<div class="subtle">${escapeHtml(source.citation)}</div></td>
    <td>${escapeHtml(source.source_type)}</td>
    <td>rel ${source.reliability} &middot; rec ${source.recency} &middot; fit ${source.relevance}</td>
    <td>${chunks.map((chunk) => renderChunkLink(chunk)).join(" ")}</td>
  </tr>${chunks.map((chunk) => renderChunkRow(chunk)).join("")}`;
}

function renderChunkLink(chunk: SourceChunk): string {
  return link(`#${chunkId(chunk.id)}`, chunk.id);
}

function renderChunkRow(chunk: SourceChunk): string {
  return `<tr id="${chunkId(chunk.id)}">
    <td></td>
    <td colspan="4"><div class="excerpt">${escapeHtml(chunk.text)}</div></td>
  </tr>`;
}

function renderDiagnostics(bundle: RunArtifactBundle): string {
  if (bundle.eval_report.diagnostics.length === 0) {
    return "<p class=\"subtle\">No diagnostics were emitted for this run.</p>";
  }

  return `<div class="diagnostic-list">${bundle.eval_report.diagnostics.map((diagnostic) => `
    <article class="item">
      <div class="item-head">
        <strong>${escapeHtml(diagnostic.stage)} &middot; ${escapeHtml(diagnostic.category)}</strong>
        <span class="status ${diagnostic.severity}">${escapeHtml(diagnostic.severity)}</span>
      </div>
      <div>${escapeHtml(diagnostic.message)}</div>
      <div class="subtle">${escapeHtml(diagnostic.recommended_fix)}</div>
    </article>`).join("")}</div>`;
}

function renderMarkdown(markdown: string): string {
  const lines = markdown.split("\n");
  const html: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const closeList = (): void => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      continue;
    }
    if (trimmed.startsWith("## ")) {
      closeList();
      html.push(`<h3>${escapeHtml(trimmed.slice(3))}</h3>`);
      continue;
    }
    if (trimmed.startsWith("- ")) {
      if (listType !== "ul") {
        closeList();
        html.push("<ul>");
        listType = "ul";
      }
      html.push(`<li>${escapeHtml(trimmed.slice(2))}</li>`);
      continue;
    }
    if (/^[0-9]+\.\s/.test(trimmed)) {
      if (listType !== "ol") {
        closeList();
        html.push("<ol>");
        listType = "ol";
      }
      html.push(`<li>${escapeHtml(trimmed.replace(/^[0-9]+\.\s/, ""))}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${escapeHtml(trimmed)}</p>`);
  }

  closeList();
  return html.join("\n");
}

function metric(label: string, value: number): string {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`;
}

function link(href: string, text: string): string {
  return `<a href="${escapeAttribute(href)}">${escapeHtml(text)}</a>`;
}

function linkChip(href: string, text: string): string {
  return `<a class="chip" href="${escapeAttribute(href)}">${escapeHtml(text)}</a>`;
}

function claimId(id: string): string {
  return domId("claim", id);
}

function evidenceId(id: string): string {
  return domId("evidence", id);
}

function sourceId(id: string): string {
  return domId("source", id);
}

function chunkId(id: string): string {
  return domId("chunk", id);
}

function domId(prefix: string, id: string): string {
  return `${prefix}-${id.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
