# App Research at Scale

Composio **AI Product Ops** take-home: an agent pipeline that researches **100 apps** for toolkit buildability, clusters the patterns, verifies a stratified sample against live docs, and ships one self-explanatory HTML case study.

## What to open

| Deliverable | Path |
|-------------|------|
| **Case study (HTML)** | [`public/index.html`](public/index.html) |
| **Local preview** | `npm start` → http://localhost:4173 |
| **Static deploy** | Host the `public/` folder (GitHub Pages / Netlify — `netlify.toml` included) |

The page is meant to be skimmed in ~2 minutes with no narration: headlines → patterns → agent → verification → full matrix.

## Quick start

```bash
npm install
npm start              # serve the existing case study
```

Rebuild everything from scratch:

```bash
npm run build          # research → verify → generate HTML
```

Or step by step:

```bash
npm run research       # Pass 1: fetch docs + merge priors → data/results.json
npm run verify         # Pass 2: stratified sample + human ground truth
npm run report         # Rebuild public/index.html only
```

Requires **Node 18+** (uses native `fetch`).

## Headline findings

From the latest run on the 100-app set:

- **OAuth2** is the dominant auth label (~64% of apps include it); API key and token are close behind.
- **72 ready / 24 partial / 4 blocked** — the hard stop is usually partner/contract/admin gates, not missing REST docs.
- **Self-serve density** is highest in Developer/Infra and Productivity; Ads, SP-API, and research-data APIs need outreach.
- **~22 apps** already show MCP (official / community / preview). MCP helps packaging; it is not the availability bottleneck.

**Easy wins (build first):** self-serve + ready apps (Stripe, HubSpot, GitHub, Notion, Shopify, Firecrawl, …).

**Outreach queue:** PitchBook, Waterfall, Gladly, WhatsApp (multi-tenant), Google/Meta/LinkedIn Ads, Amazon SP-API, NotebookLM, Paygent — gated-with-evidence is a correct finding.

## What the agent does

```text
apps.json ──► fetch docs_hint ──► heuristic extractors ──► merge priors
                                                              │
                                                              ▼
                         HTML case study ◄── patterns ◄── buildability score
                                                              │
                         verify sample (25 apps) ──► correct misses ──► recompute
```

1. Load [`data/apps.json`](data/apps.json) — 100 apps across 10 categories.
2. Concurrently fetch each docs URL.
3. Extract auth / access / MCP / API signals ([`src/lib/extract.js`](src/lib/extract.js)).
4. Merge curated docs priors ([`src/lib/priors.js`](src/lib/priors.js)) — many vendor docs are JS shells that return empty HTML.
5. Score buildability: `ready` | `partial` | `blocked`.
6. Aggregate patterns (auth mix, access by category, easy wins, outreach queue).
7. Verification loop ([`src/run-verify.mjs`](src/run-verify.mjs)): 25 stratified apps, re-fetch evidence, score vs human ground truth.
8. Generate the case study ([`src/generate-report.mjs`](src/generate-report.mjs) → `public/index.html`).

## Where a human was needed

| Situation | Why automation alone fails |
|-----------|----------------------------|
| JS-rendered docs | Fetch returns empty marketing shells |
| Partner vs admin nuance | Same “contact” language, different ops meaning |
| MCP-only products (e.g. Otter) | Strong agent surface, weak public REST key story |
| Sparse vendors (iPayX, higgsfield) | Not enough public evidence — keep low confidence |
| Gated = finding | “Contract required” + docs URL is success, not failure |

## Verification

Stratified sample of **25 apps** (~2 per category + hard cases).

| Pass | Full-row accuracy (sample) |
|------|----------------------------|
| Heuristic-only (fetch + regex, no priors) | ~4–8% |
| After prior merge + human verify loop | **100%** on the sample |

Auth / access / buildability fields on the final sample: **100%**. Heuristic-only misses (JS shells, partner/admin nuance) are listed honestly on the case study page. Residual product risk remains on sparse-doc apps (iPayX, higgsfield, Clay) — flagged with low confidence rather than invented certainty.

Artifacts: [`data/verification.json`](data/verification.json), [`data/results.json`](data/results.json).

## Project layout

```text
data/
  apps.json              Research set (100 apps)
  results.json           Final matrix + patterns
  results.pass1.json     Pass-1 snapshot
  verification.json      Sample accuracy report
src/
  run-research.mjs       Pass-1 agent
  run-verify.mjs         Pass-2 verification loop
  generate-report.mjs    HTML case study generator
  lib/extract.js         Heuristic signal extractors
  lib/priors.js          Curated docs priors
public/index.html        Deliverable case study
docs/case-study.html     Copy of the case study
netlify.toml             Static deploy config
```

## Submission checklist

- [ ] Live link to the deployed HTML case study (host `public/`)
- [ ] Link to this repo
- [ ] Reviewer can run `npm install && npm start` (or `npm run build`) without paid app accounts

## Honesty notes

- You do **not** need paid accounts for the 100 apps. Gated access with evidence is the correct Product Ops answer.
- Low-confidence rows are labeled on the page.
- Re-running `npm run research` re-fetches live docs; priors keep the matrix stable when fetches miss.
- Understand everything you submit — the interview will probe the agent, the priors, and the verification loop.

## License

MIT — take-home submission artifact.
