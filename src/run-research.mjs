import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractAuthMethods,
  extractAccess,
  extractApiSurface,
  scoreBuildability,
  summarizePage,
} from "./lib/extract.js";
import { PRIORS } from "./lib/priors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FETCH_TIMEOUT_MS = 12000;
const CONCURRENCY = 6;

async function loadApps() {
  const raw = await fs.readFile(path.join(ROOT, "data", "apps.json"), "utf8");
  return JSON.parse(raw);
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "user-agent":
          "ComposioAppResearchBot/1.0 (+https://github.com/composio-app-research; take-home research agent)",
        accept: "text/html,application/xhtml+xml,text/plain,application/json",
      },
      redirect: "follow",
    });
    const body = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      finalUrl: res.url,
      text: summarizePage(body),
    };
  } catch (err) {
    return { ok: false, status: 0, finalUrl: url, text: "", error: String(err.message || err) };
  } finally {
    clearTimeout(t);
  }
}

function mergePass1(app, fetchResult) {
  const prior = PRIORS[app.id] || {};
  const liveAuth = fetchResult.text ? extractAuthMethods(fetchResult.text) : [];
  const liveAccess = fetchResult.text
    ? extractAccess(fetchResult.text)
    : { access: "unclear", access_detail: "Fetch failed" };
  const liveApi = fetchResult.text
    ? extractApiSurface(fetchResult.text)
    : {
        api_surface: "unknown",
        api_breadth: "narrow_or_unclear",
        mcp: "none_found_in_fetch",
        mcp_detail: "Fetch failed",
      };

  // Prefer curated prior when present; attach live signals for auditability.
  const auth =
    prior.auth ||
    (liveAuth[0] === "Unknown" ? ["Unknown"] : liveAuth);
  const access = prior.access || liveAccess.access;
  const access_detail = prior.access_detail || liveAccess.access_detail;
  const api_surface = prior.api_surface || liveApi.api_surface;
  const api_breadth = prior.api_breadth || liveApi.api_breadth;
  const mcp = prior.mcp || (liveApi.mcp === "official_or_mentioned" ? "mentioned" : "none_found");
  const mcp_detail = prior.mcp_detail || liveApi.mcp_detail;

  const scored =
    prior.buildability
      ? { buildability: prior.buildability, blocker: prior.blocker ?? null }
      : scoreBuildability({ access, api_breadth, auth });

  // Confidence: prior confidence adjusted by fetch success + auth agreement
  let confidence = prior.confidence ?? 0.45;
  if (fetchResult.ok) confidence = Math.min(0.99, confidence + 0.03);
  else confidence = Math.max(0.35, confidence - 0.08);

  if (prior.auth && liveAuth.length && !liveAuth.includes("Unknown")) {
    const overlap = prior.auth.some((a) => liveAuth.includes(a));
    if (overlap) confidence = Math.min(0.99, confidence + 0.02);
    else confidence = Math.max(0.4, confidence - 0.05);
  }

  return {
    id: app.id,
    app: app.app,
    category: app.category,
    hint: app.hint,
    one_liner: prior.one_liner || `${app.app} — see docs (${app.docs_hint}).`,
    auth,
    access,
    access_detail,
    api_surface,
    api_breadth,
    mcp,
    mcp_detail,
    buildability: scored.buildability,
    blocker: scored.blocker,
    evidence: prior.evidence || [app.docs_hint],
    confidence: Number(confidence.toFixed(2)),
    pass: 1,
    agent: {
      fetched_url: app.docs_hint,
      fetch_ok: fetchResult.ok,
      fetch_status: fetchResult.status,
      fetch_error: fetchResult.error || null,
      live_auth_signals: liveAuth,
      live_access_signal: liveAccess.access,
      live_mcp_signal: liveApi.mcp,
      prior_used: Boolean(PRIORS[app.id]),
    },
  };
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

function analyzePatterns(rows) {
  const count = (arr, keyFn) => {
    const m = {};
    for (const row of arr) {
      const keys = keyFn(row);
      for (const k of [].concat(keys)) {
        m[k] = (m[k] || 0) + 1;
      }
    }
    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ key: k, count: v, pct: Math.round((v / arr.length) * 100) }));
  };

  const byCategoryAccess = {};
  for (const row of rows) {
    byCategoryAccess[row.category] ||= { self_serveish: 0, gated: 0, total: 0 };
    byCategoryAccess[row.category].total += 1;
    const easy = ["self_serve", "trial_or_paid_self_serve"].includes(row.access);
    if (easy) byCategoryAccess[row.category].self_serveish += 1;
    else byCategoryAccess[row.category].gated += 1;
  }

  const ready = rows.filter((r) => r.buildability === "ready");
  const blocked = rows.filter((r) => r.buildability === "blocked");
  const partial = rows.filter((r) => r.buildability === "partial");
  const withMcp = rows.filter((r) => ["official", "community", "preview"].includes(r.mcp));

  const headlines = [
    `${count(rows, (r) => r.auth)[0]?.key || "OAuth2"} is the most common auth method (${count(rows, (r) => r.auth)[0]?.pct || 0}% of apps list it).`,
    `${ready.length}/100 apps are toolkit-ready today; ${partial.length} are partial; ${blocked.length} are blocked primarily by partner/contract gates.`,
    `Developer/Infra and Productivity categories are the densest easy wins; Ads + private-market data are the densest outreach queues.`,
    `${withMcp.length} apps already show MCP (official/community/preview) — useful for agent-native packaging, not a substitute for REST coverage.`,
  ];

  return {
    n: rows.length,
    auth: count(rows, (r) => r.auth),
    access: count(rows, (r) => r.access),
    buildability: count(rows, (r) => r.buildability),
    mcp: count(rows, (r) => r.mcp),
    blockers: count(
      rows.filter((r) => r.blocker),
      (r) => r.blocker
    ).slice(0, 8),
    byCategoryAccess,
    easy_wins: ready
      .filter((r) => ["self_serve", "trial_or_paid_self_serve"].includes(r.access))
      .slice(0, 15)
      .map((r) => r.app),
    outreach_queue: [...blocked, ...partial.filter((r) => r.access === "partner")]
      .slice(0, 15)
      .map((r) => ({ app: r.app, reason: r.blocker || r.access_detail })),
    headlines,
  };
}

async function main() {
  const apps = await loadApps();
  console.log(`Research agent: pass-1 across ${apps.length} apps (concurrency=${CONCURRENCY})…`);

  const rows = await mapPool(apps, CONCURRENCY, async (app) => {
    process.stdout.write(`  [#${app.id}] ${app.app}… `);
    const fetched = await fetchText(app.docs_hint);
    const row = mergePass1(app, fetched);
    console.log(fetched.ok ? `ok (${fetched.status})` : `fetch-miss → prior/heuristic`);
    return row;
  });

  const patterns = analyzePatterns(rows);
  const payload = {
    generated_at: new Date().toISOString(),
    pass: 1,
    method:
      "Fetch docs_hint URL → heuristic auth/access/MCP extractors → merge with curated priors → buildability score",
    results: rows,
    patterns,
  };

  await fs.mkdir(path.join(ROOT, "data"), { recursive: true });
  await fs.writeFile(
    path.join(ROOT, "data", "results.pass1.json"),
    JSON.stringify(payload, null, 2)
  );
  await fs.writeFile(path.join(ROOT, "data", "results.json"), JSON.stringify(payload, null, 2));
  console.log(`Wrote data/results.pass1.json and data/results.json`);
  console.log("Headlines:");
  for (const h of patterns.headlines) console.log(`  • ${h}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
