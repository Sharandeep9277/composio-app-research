import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function badge(kind, label) {
  return `<span class="badge badge-${esc(kind)}">${esc(label)}</span>`;
}

function accessKind(a) {
  if (a === "self_serve" || a === "trial_or_paid_self_serve") return "good";
  if (a === "paid" || a === "admin") return "warn";
  if (a === "partner" || a === "blocked" || a === "unclear") return "bad";
  return "neutral";
}

function buildKind(b) {
  if (b === "ready") return "good";
  if (b === "partial") return "warn";
  return "bad";
}

function barRow(items, total) {
  return items
    .slice(0, 6)
    .map((it) => {
      const pct = it.pct ?? Math.round((it.count / total) * 100);
      return `<div class="bar-row"><span class="bar-label">${esc(it.key)}</span><span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span><span class="bar-pct">${pct}%</span></div>`;
    })
    .join("");
}

async function main() {
  const results = JSON.parse(await fs.readFile(path.join(ROOT, "data", "results.json"), "utf8"));
  const verification = JSON.parse(
    await fs.readFile(path.join(ROOT, "data", "verification.json"), "utf8")
  );
  const p = results.patterns;
  const acc = verification.accuracy;

  const catRows = Object.entries(p.byCategoryAccess)
    .map(([cat, v]) => {
      const easy = Math.round((v.self_serveish / v.total) * 100);
      return `<tr><td>${esc(cat)}</td><td>${v.self_serveish}/${v.total}</td><td><div class="mini-track"><span style="width:${easy}%"></span></div></td><td>${easy}% self-serve-ish</td></tr>`;
    })
    .join("");

  const tableRows = results.results
    .map((r) => {
      const evidence = (r.evidence || [])
        .slice(0, 2)
        .map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">docs</a>`)
        .join(" · ");
      return `<tr>
        <td class="num" data-label="#">${r.id}</td>
        <td data-label="App"><strong>${esc(r.app)}</strong><div class="muted tiny">${esc(r.category)}</div></td>
        <td class="one-liner" data-label="What it does">${esc(r.one_liner)}</td>
        <td data-label="Auth">${r.auth.map((a) => badge("neutral", a)).join(" ")}</td>
        <td data-label="Access">${badge(accessKind(r.access), r.access.replaceAll("_", " "))}</td>
        <td data-label="API / MCP">${esc(r.api_surface)}<div class="muted tiny">MCP: ${esc(r.mcp)}</div></td>
        <td data-label="Build">${badge(buildKind(r.buildability), r.buildability)}${r.blocker ? `<div class="muted tiny">${esc(r.blocker)}</div>` : ""}</td>
        <td class="evidence" data-label="Evidence">${evidence}<div class="muted tiny">conf ${r.confidence}</div></td>
      </tr>`;
    })
    .join("\n");

  const missCards = verification.heuristic_misses?.length
    ? verification.heuristic_misses
        .slice(0, 12)
        .map(
          (m) => `<article class="miss-card"><h4>${esc(m.app)} <span class="badge badge-warn">heuristic miss</span></h4>
          <p class="muted tiny">${esc(m.why)}</p>
          <ul>
            <li>Predicted: <code>${esc(JSON.stringify(m.predicted))}</code></li>
            <li>Human truth: <code>${esc(JSON.stringify(m.truth))}</code></li>
          </ul></article>`
        )
        .join("")
    : `<p class="muted">No heuristic misses recorded.</p>`;

  const finalMissCards = verification.misses.length
    ? verification.misses
        .map(
          (m) => `<article class="miss-card"><h4>${esc(m.app)}</h4><p>${esc(m.notes)}</p><ul>${(m.misses || [])
            .map(
              (x) =>
                `<li><code>${esc(x.field)}</code>: predicted <em>${esc(JSON.stringify(x.predicted))}</em> → truth <em>${esc(JSON.stringify(x.truth))}</em></li>`
            )
            .join("")}</ul></article>`
        )
        .join("")
    : `<p class="muted">No full-row misses on the final (prior-merged) ${acc.sample_size}-app sample. Residual risk is called out on low-confidence apps instead of inventing certainty.</p>`;

  const hitList = verification.hits.map((h) => `<li>${esc(h)}</li>`).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>App Research at Scale — Composio Take-Home Case Study</title>
<meta name="description" content="Agent-researched map of 100 apps: auth, access gates, API/MCP surface, buildability, patterns, and verification." />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
<style>
:root {
  --ink: #14201c;
  --muted: #5a6b64;
  --paper: #f3efe6;
  --panel: rgba(255,252,246,0.92);
  --line: rgba(20,32,28,0.12);
  --accent: #0f6e56;
  --accent-hover: #0c5a46;
  --good: #0f6e56;
  --warn: #9a6700;
  --bad: #a33b2b;
  --shadow: 0 18px 50px rgba(20,32,28,0.08);
  --radius: 16px;
  --btn-radius: 10px;
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}
*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  color: var(--ink);
  font-family: "IBM Plex Sans", system-ui, sans-serif;
  background:
    radial-gradient(1200px 600px at 10% -10%, rgba(15,110,86,0.18), transparent 55%),
    radial-gradient(900px 500px at 100% 0%, rgba(196,92,38,0.14), transparent 50%),
    linear-gradient(180deg, #e7efe9 0%, var(--paper) 38%, #ebe4d6 100%);
  min-height: 100vh;
  overflow-x: hidden;
}
body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: 0.35;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.45'/%3E%3C/svg%3E");
  mix-blend-mode: multiply;
  z-index: 0;
}
.wrap {
  position: relative;
  z-index: 1;
  width: min(1120px, 100%);
  margin: 0 auto;
  padding: 2.5rem clamp(1rem, 3vw, 1.5rem) calc(3.5rem + var(--safe-bottom));
}
.hero { padding: 1.5rem 0 1rem; animation: rise 0.7s ease both; }
.eyebrow {
  margin: 0 0 0.4rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 0.78rem;
  color: var(--muted);
}
.brand {
  font-family: "Fraunces", Georgia, serif;
  font-size: clamp(2.1rem, 8vw, 4.2rem);
  line-height: 0.95;
  letter-spacing: -0.03em;
  margin: 0 0 0.85rem;
  overflow-wrap: anywhere;
}
.brand span { color: var(--accent); }
.lede {
  max-width: 38rem;
  font-size: clamp(0.98rem, 2.5vw, 1.08rem);
  line-height: 1.55;
  color: var(--muted);
  margin: 0 0 1.35rem;
}
.cta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: stretch;
}
.btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 44px;
  padding: 0.7rem 1.15rem;
  border-radius: var(--btn-radius);
  text-decoration: none;
  font-family: inherit;
  font-weight: 600;
  font-size: 0.92rem;
  line-height: 1.2;
  border: 1.5px solid rgba(20,32,28,0.16);
  background: #fffcf6;
  color: var(--ink);
  cursor: pointer;
  box-shadow: 0 1px 0 rgba(20,32,28,0.04);
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}
.btn:hover {
  border-color: rgba(15,110,86,0.45);
  background: #fff;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(20,32,28,0.08);
}
.btn:active { transform: translateY(0); box-shadow: none; }
.btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.btn.primary {
  background: var(--accent);
  color: #f7fff9;
  border-color: var(--accent);
  box-shadow: 0 8px 20px rgba(15,110,86,0.22);
}
.btn.primary:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
  color: #fff;
}
.nav {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.45rem;
  margin: 1.35rem 0 0.2rem;
  padding: 0.35rem 0;
  position: sticky;
  top: 0;
  z-index: 5;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  background: linear-gradient(180deg, rgba(231,239,233,0.96), rgba(243,239,230,0.92));
  backdrop-filter: blur(12px);
  border-bottom: 1px solid transparent;
}
.nav::-webkit-scrollbar { display: none; }
.nav a {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  text-decoration: none;
  color: var(--ink);
  font-size: 0.82rem;
  font-weight: 600;
  padding: 0.45rem 0.9rem;
  border-radius: var(--btn-radius);
  background: #fffcf6;
  border: 1.5px solid rgba(20,32,28,0.14);
  white-space: nowrap;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.nav a:hover { border-color: rgba(15,110,86,0.4); background: #fff; }
.nav a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
section {
  margin: 1.25rem 0;
  padding: clamp(1rem, 3vw, 1.4rem);
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  backdrop-filter: blur(10px);
  animation: rise 0.6s ease both;
  overflow: hidden;
}
h2 {
  font-family: "Fraunces", Georgia, serif;
  font-size: clamp(1.3rem, 4vw, 1.55rem);
  margin: 0 0 0.55rem;
  letter-spacing: -0.02em;
}
h3 { margin: 1rem 0 0.45rem; font-size: 1rem; }
.muted { color: var(--muted); }
.tiny { font-size: 0.78rem; margin-top: 0.2rem; }
.headlines { list-style: none; padding: 0; margin: 0.8rem 0 0; display: grid; gap: 0.65rem; }
.headlines li {
  padding: 0.85rem 1rem;
  border-left: 3px solid var(--accent);
  background: rgba(15,110,86,0.06);
  border-radius: 0 12px 12px 0;
  font-size: clamp(0.95rem, 2.4vw, 1.02rem);
  line-height: 1.45;
}
.grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 1rem; }
.grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 0.8rem; }
.stat {
  padding: 1rem;
  border-radius: 14px;
  background: rgba(20,32,28,0.03);
  border: 1px solid var(--line);
  min-width: 0;
}
.stat .n {
  font-family: "Fraunces", Georgia, serif;
  font-size: clamp(1.6rem, 5vw, 2rem);
  line-height: 1;
  color: var(--accent);
}
.stat .l { font-size: 0.85rem; color: var(--muted); margin-top: 0.35rem; }
.bar-row {
  display: grid;
  grid-template-columns: minmax(4.5rem, 7.5rem) 1fr 2.6rem;
  gap: 0.5rem;
  align-items: center;
  margin: 0.35rem 0;
  font-size: 0.86rem;
}
.bar-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bar-track { height: 8px; background: rgba(20,32,28,0.08); border-radius: 99px; overflow: hidden; min-width: 0; }
.bar-fill { display: block; height: 100%; background: linear-gradient(90deg, var(--accent), #1f9a74); border-radius: 99px; }
.bar-pct { text-align: right; color: var(--muted); font-variant-numeric: tabular-nums; }
table { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
th, td { text-align: left; padding: 0.65rem 0.5rem; border-bottom: 1px solid var(--line); vertical-align: top; }
th {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  background: #f7f3ea;
}
.num { font-family: "IBM Plex Mono", monospace; color: var(--muted); width: 2.2rem; }
.one-liner { max-width: 18rem; }
.table-wrap {
  overflow: auto;
  max-height: 70vh;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: #fffcf6;
  -webkit-overflow-scrolling: touch;
}
.table-wrap thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #f0ebe0;
  border-bottom: 1px solid rgba(20,32,28,0.16);
  box-shadow: 0 1px 0 rgba(20,32,28,0.06);
}
.table-wrap thead th:first-child { border-radius: 11px 0 0 0; }
.table-wrap thead th:last-child { border-radius: 0 11px 0 0; }
.badge {
  display: inline-block;
  padding: 0.18rem 0.45rem;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  margin: 0.05rem;
  white-space: nowrap;
  font-family: "IBM Plex Mono", monospace;
}
.badge-good { background: rgba(15,110,86,0.12); color: var(--good); }
.badge-warn { background: rgba(154,103,0,0.14); color: var(--warn); }
.badge-bad { background: rgba(163,59,43,0.12); color: var(--bad); }
.badge-neutral { background: rgba(20,32,28,0.08); color: var(--ink); }
.flow {
  display: grid;
  grid-template-columns: repeat(4, minmax(0,1fr));
  gap: 0.6rem;
  margin-top: 0.8rem;
}
.flow-step {
  padding: 0.85rem;
  border-radius: 12px;
  background: #14201c;
  color: #eef6f1;
  min-height: 7.5rem;
  min-width: 0;
}
.flow-step strong { display: block; font-family: "Fraunces", Georgia, serif; margin-bottom: 0.35rem; color: #9fe0c5; }
.flow-step span { font-size: 0.84rem; color: rgba(238,246,241,0.82); line-height: 1.4; }
.mini-track { height: 7px; background: rgba(20,32,28,0.08); border-radius: 99px; overflow: hidden; min-width: 4rem; }
.mini-track span { display: block; height: 100%; background: var(--accent); }
.filters {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 0.55rem;
  margin: 0.7rem 0 0.9rem;
  align-items: center;
}
.filters input,
.filters select {
  font: inherit;
  width: 100%;
  min-height: 44px;
  padding: 0.55rem 0.75rem;
  border-radius: var(--btn-radius);
  border: 1.5px solid rgba(20,32,28,0.14);
  background: #fff;
  color: var(--ink);
}
.filters input:focus-visible,
.filters select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.filters #count { white-space: nowrap; }
.hit-list { columns: 2; margin: 0.4rem 0 0; padding-left: 1.1rem; }
.miss-card {
  padding: 0.85rem 1rem;
  border-radius: 12px;
  border: 1px dashed rgba(163,59,43,0.35);
  background: rgba(163,59,43,0.05);
  margin: 0.5rem 0;
  overflow-wrap: anywhere;
}
.miss-card h4 { margin: 0 0 0.35rem; }
.miss-card ul { margin: 0.4rem 0 0; padding-left: 1.1rem; }
code, em { font-family: "IBM Plex Mono", monospace; font-style: normal; font-size: 0.82em; word-break: break-word; }
.footer {
  margin-top: 1.5rem;
  color: var(--muted);
  font-size: 0.85rem;
  text-align: center;
  padding-inline: 0.5rem;
}
section ul { padding-left: 1.15rem; }
section li { margin: 0.35rem 0; line-height: 1.45; }
@keyframes rise {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
}
@media (max-width: 900px) {
  .flow { grid-template-columns: 1fr 1fr; }
  .filters { grid-template-columns: 1fr 1fr; }
  .filters #count { grid-column: 1 / -1; }
}
@media (max-width: 720px) {
  .wrap { padding-top: 1.4rem; }
  .cta-row { display: grid; grid-template-columns: 1fr 1fr; }
  .btn { width: 100%; }
  .grid-2, .grid-3 { grid-template-columns: 1fr; }
  .flow { grid-template-columns: 1fr; }
  .flow-step { min-height: 0; }
  .filters { grid-template-columns: 1fr; }
  .bar-row { grid-template-columns: 1fr 2.6rem; grid-template-areas: "label pct" "track track"; }
  .bar-label { grid-area: label; white-space: normal; }
  .bar-pct { grid-area: pct; }
  .bar-track { grid-area: track; }
  .hit-list { columns: 1; }
  .table-wrap {
    max-height: none;
    overflow: visible;
    border: none;
    background: transparent;
    border-radius: 0;
  }
  .table-wrap table,
  .table-wrap thead,
  .table-wrap tbody,
  .table-wrap th,
  .table-wrap td,
  .table-wrap tr { display: block; width: 100%; }
  .table-wrap thead { display: none; }
  .table-wrap tr {
    margin: 0 0 0.75rem;
    padding: 0.85rem 0.95rem;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: #fffcf6;
    box-shadow: 0 4px 14px rgba(20,32,28,0.04);
  }
  .table-wrap tr[style*="display: none"] { display: none !important; }
  .table-wrap td {
    display: grid;
    grid-template-columns: 6.2rem minmax(0, 1fr);
    gap: 0.55rem;
    padding: 0.4rem 0;
    border-bottom: 1px solid rgba(20,32,28,0.06);
  }
  .table-wrap td:last-child { border-bottom: none; padding-bottom: 0; }
  .table-wrap td::before {
    content: attr(data-label);
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--muted);
    padding-top: 0.15rem;
  }
  .table-wrap td.num {
    grid-template-columns: 6.2rem auto;
    align-items: center;
  }
  .one-liner { max-width: none; }
}
@media (max-width: 420px) {
  .cta-row { grid-template-columns: 1fr; }
  .table-wrap td {
    grid-template-columns: 1fr;
    gap: 0.2rem;
  }
}
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
</style>
</head>
<body>
<div class="wrap">
  <header class="hero">
    <p class="eyebrow">Composio · AI Product Ops take-home</p>
    <h1 class="brand">App Research<br/><span>at Scale</span></h1>
    <p class="lede">100 apps researched by an agent pipeline — auth, self-serve vs gated, API/MCP surface, and buildability — then clustered into patterns a toolkit team can act on in two minutes.</p>
    <div class="cta-row">
      <a class="btn primary" href="#patterns">Read the patterns</a>
      <a class="btn" href="#matrix">Open the matrix</a>
      <a class="btn" href="#verify">See verification</a>
      <a class="btn" href="#agent">How the agent works</a>
    </div>
    <nav class="nav" aria-label="Sections">
      <a href="#patterns">Patterns</a>
      <a href="#matrix">Matrix</a>
      <a href="#agent">Agent</a>
      <a href="#verify">Proof</a>
      <a href="#human">Human loop</a>
    </nav>
  </header>

  <section id="patterns">
    <h2>Headline findings</h2>
    <p class="muted">Insight over raw rows. These are the decisions a Product Ops / toolkit team would make Monday morning.</p>
    <ul class="headlines">
      ${p.headlines.map((h) => `<li>${esc(h)}</li>`).join("")}
    </ul>
    <div class="grid-3" style="margin-top:1.1rem">
      <div class="stat"><div class="n">${p.buildability.find((x) => x.key === "ready")?.count ?? "—"}</div><div class="l">Ready to toolkit today</div></div>
      <div class="stat"><div class="n">${p.buildability.find((x) => x.key === "partial")?.count ?? "—"}</div><div class="l">Partial (paid / admin / review)</div></div>
      <div class="stat"><div class="n">${p.buildability.find((x) => x.key === "blocked")?.count ?? "—"}</div><div class="l">Blocked — outreach first</div></div>
    </div>
    <div class="grid-2" style="margin-top:1rem">
      <div>
        <h3>Auth mix</h3>
        ${barRow(p.auth, p.n)}
      </div>
      <div>
        <h3>Access model</h3>
        ${barRow(p.access, p.n)}
      </div>
    </div>
    <h3>Self-serve density by category</h3>
    <div class="table-wrap" style="max-height:none">
      <table>
        <thead><tr><th>Category</th><th>Self-serve-ish</th><th></th><th>Read</th></tr></thead>
        <tbody>${catRows}</tbody>
      </table>
    </div>
    <div class="grid-2" style="margin-top:1rem">
      <div>
        <h3>Easy wins (build first)</h3>
        <p class="muted tiny">Self-serve + ready — ship toolkits without sales.</p>
        <p>${p.easy_wins.map((a) => badge("good", a)).join(" ")}</p>
      </div>
      <div>
        <h3>Outreach queue</h3>
        <p class="muted tiny">Partner / contract / admin gates — evidence is the finding.</p>
        <ul class="muted" style="margin:0.4rem 0 0; padding-left:1.1rem; font-size:0.9rem">
          ${p.outreach_queue
            .slice(0, 10)
            .map((o) => `<li><strong>${esc(o.app)}</strong> — ${esc(o.reason)}</li>`)
            .join("")}
        </ul>
      </div>
    </div>
  </section>

  <section id="agent">
    <h2>The agent (and where a human was needed)</h2>
    <p class="muted">Built as a Node research pipeline you can re-run. Spirit of the role: automate the repetitive docs scrape, keep humans on judgment calls.</p>
    <div class="flow">
      <div class="flow-step"><strong>1. Seed</strong><span>100 apps with docs hints across 10 categories (intentional auth/access mix).</span></div>
      <div class="flow-step"><strong>2. Fetch</strong><span>Concurrent HTTP fetch of docs pages + heuristic extractors for OAuth/API key/partner language/MCP.</span></div>
      <div class="flow-step"><strong>3. Prior merge</strong><span>Curated docs priors fill one-liners & hard gates when HTML is JS-rendered or thin.</span></div>
      <div class="flow-step"><strong>4. Verify</strong><span>Stratified 25-app sample: re-fetch evidence + human ground truth → correct misses → recompute patterns.</span></div>
    </div>
    <div class="grid-2" style="margin-top:1rem">
      <div>
        <h3>Agent owns</h3>
        <ul>
          <li>Bulk fetch + signal extraction</li>
          <li>Buildability scoring rules</li>
          <li>Pattern aggregation / clustering</li>
          <li>HTML case-study generation</li>
          <li>Confidence adjustments from fetch success</li>
        </ul>
      </div>
      <div>
        <h3>Human still needed</h3>
        <ul>
          <li>JS-heavy docs that return empty shells</li>
          <li>Partner vs admin nuance (Brex, Ramp, Gladly)</li>
          <li>MCP-only products without REST (Otter)</li>
          <li>Sparse/emerging vendors (iPayX, higgsfield)</li>
          <li>Final “is gated a blocker or a finding?” judgment</li>
        </ul>
      </div>
    </div>
    <p style="margin-top:1rem"><code>npm run build</code> → research → verify → regenerate this page. Source: <code>src/run-research.mjs</code>, <code>src/run-verify.mjs</code>, <code>src/lib/priors.js</code>.</p>
  </section>

  <section id="verify">
    <h2>Verification — how we know</h2>
    <p class="muted">Accuracy is the point. Stratified sample of <strong>${acc.sample_size}</strong> apps (≈2 per category + hard cases). Live evidence URLs re-fetched; fields scored against human ground truth from official docs.</p>
    <div class="grid-3">
      <div class="stat"><div class="n">${acc.full_row_accuracy}%</div><div class="l">Full-row accuracy (sample)</div></div>
      <div class="stat"><div class="n">${acc.auth_accuracy}%</div><div class="l">Auth field accuracy</div></div>
      <div class="stat"><div class="n">${acc.access_accuracy}%</div><div class="l">Access field accuracy</div></div>
    </div>
    <h3>Accuracy moved because of loops</h3>
    <div class="grid-2">
      <div class="stat">
        <div class="n">${acc.estimated_heuristic_only_full_row ?? acc.heuristic_only_full_row}%</div>
        <div class="l">Heuristic-only full-row (fetch + regex, no priors) on the same sample</div>
      </div>
      <div class="stat">
        <div class="n">${acc.after_prior_merge_full_row}%</div>
        <div class="l">After prior merge + human verify loop (this submission)</div>
      </div>
    </div>
    <ul class="muted" style="margin-top:0.8rem">
      ${acc.narrative.map((n) => `<li>${esc(n)}</li>`).join("")}
    </ul>
    <h3>Hits (final sample)</h3>
    <ul class="hit-list">${hitList}</ul>
    <h3>Where heuristics alone were wrong</h3>
    ${missCards}
    <h3>Final-pass misses (after priors)</h3>
    ${finalMissCards}
  </section>

  <section id="human">
    <h2>What defeated us (or almost did)</h2>
    <ul>
      <li><strong>iPayX</strong> — sparse public docs; kept low confidence rather than fake precision.</li>
      <li><strong>NotebookLM</strong> — consumer product ≠ clear public agent API; Enterprise Gemini path is the real surface.</li>
      <li><strong>Paygent Connect</strong> — NMI-powered merchant stack; partner/underwriting gate.</li>
      <li><strong>Clay / Waterfall / PitchBook</strong> — enrichment & research data lean contract-gated.</li>
      <li><strong>Otter</strong> — excellent MCP, weak public REST key story for embedding in a multi-tenant toolkit.</li>
    </ul>
    <p class="muted">Gated ≠ failed research. Saying “contact sales / contract” with a docs URL is the correct Product Ops answer.</p>
  </section>

  <section id="matrix">
    <h2>Full matrix — 100 apps</h2>
    <p class="muted">Filter and scan. Every row has evidence links.</p>
    <div class="filters">
      <input id="q" type="search" placeholder="Filter app or category…" aria-label="Filter apps" />
      <select id="build" aria-label="Filter by buildability">
        <option value="">All buildability</option>
        <option>ready</option>
        <option>partial</option>
        <option>blocked</option>
      </select>
      <select id="access" aria-label="Filter by access">
        <option value="">All access</option>
        <option value="self_serve">self serve</option>
        <option value="trial_or_paid_self_serve">trial/paid self-serve</option>
        <option value="paid">paid</option>
        <option value="admin">admin</option>
        <option value="partner">partner</option>
        <option value="unclear">unclear</option>
      </select>
      <span class="muted tiny" id="count"></span>
    </div>
    <div class="table-wrap">
      <table id="matrix-table">
        <thead>
          <tr>
            <th>#</th><th>App</th><th>What it does</th><th>Auth</th><th>Access</th><th>API / MCP</th><th>Build</th><th>Evidence</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </section>

  <p class="footer">Generated ${esc(results.generated_at)} · Pass ${esc(results.pass)} · Re-run with <code>npm run build</code></p>
</div>
<script>
const q = document.getElementById('q');
const build = document.getElementById('build');
const access = document.getElementById('access');
const count = document.getElementById('count');
const rows = [...document.querySelectorAll('#matrix-table tbody tr')];
function apply() {
  const qq = q.value.trim().toLowerCase();
  const b = build.value;
  const a = access.value;
  let shown = 0;
  for (const tr of rows) {
    const text = tr.textContent.toLowerCase();
    const okQ = !qq || text.includes(qq);
    const okB = !b || text.includes(b);
    const okA = !a || text.includes(a.replaceAll('_',' ')) || text.includes(a);
    const show = okQ && okB && okA;
    tr.style.display = show ? '' : 'none';
    if (show) shown += 1;
  }
  count.textContent = shown + ' / ' + rows.length + ' shown';
}
q.addEventListener('input', apply);
build.addEventListener('change', apply);
access.addEventListener('change', apply);
apply();
</script>
</body>
</html>`;

  await fs.mkdir(path.join(ROOT, "public"), { recursive: true });
  await fs.writeFile(path.join(ROOT, "public", "index.html"), html);
  await fs.writeFile(path.join(ROOT, "docs", "case-study.html"), html).catch(async () => {
    await fs.mkdir(path.join(ROOT, "docs"), { recursive: true });
    await fs.writeFile(path.join(ROOT, "docs", "case-study.html"), html);
  });
  console.log("Wrote public/index.html and docs/case-study.html");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
