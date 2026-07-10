# App Research at Scale

Composio AI Product Ops take-home: an agent pipeline that researches **100 apps** for toolkit buildability (auth, self-serve vs gated, API/MCP surface), clusters patterns, verifies a stratified sample against live docs, and emits a single self-explanatory HTML case study.

## Live deliverable

- **Case study (open locally):** [`public/index.html`](public/index.html) or `npm start` → http://localhost:4173
- **Deploy:** push this repo and enable GitHub Pages / Netlify on the `public/` folder (`netlify.toml` included)
- Temporary tunnel used during build may expire; prefer a permanent static host for submission

## Quick start

```bash
npm install
npm run build          # research → verify → generate HTML
```

Or step by step:

```bash
npm run research       # Pass 1: fetch docs + merge priors → data/results.json
npm run verify         # Pass 2: stratified sample + human ground truth
npm run report         # Rebuild public/index.html
```

Open `public/index.html` in a browser.

## What the agent does

1. Loads `data/apps.json` (100 apps, 10 categories).
2. Concurrently fetches each `docs_hint` URL.
3. Runs heuristic extractors (`src/lib/extract.js`) for auth / access / MCP / API signals.
4. Merges with curated docs priors (`src/lib/priors.js`) — needed because many docs sites are JS-rendered shells.
5. Scores buildability (`ready` / `partial` / `blocked`) and aggregates patterns.
6. Verification loop (`src/run-verify.mjs`): 25 stratified apps, re-fetch evidence, score vs human ground truth, correct misses, recompute patterns.
7. Generates the case study HTML (`src/generate-report.mjs`).

## Where a human was needed

| Situation | Why automation alone fails |
|-----------|----------------------------|
| JS-rendered docs | Fetch returns empty marketing shells |
| Partner vs admin nuance | Same “contact” language, different ops meaning |
| MCP-only products (e.g. Otter) | Great agent surface, weak public REST key story |
| Sparse vendors (iPayX, higgsfield) | Not enough public evidence — keep low confidence |
| Gated = finding | Saying “contract required” with a docs URL is success |

## Project layout

```
data/apps.json              Research set
data/results.json           Final researched matrix + patterns
data/verification.json      Sample accuracy report
src/run-research.mjs        Pass-1 agent
src/run-verify.mjs          Pass-2 verification loop
src/generate-report.mjs     HTML case study generator
src/lib/extract.js          Heuristic signal extractors
src/lib/priors.js           Curated docs priors
public/index.html           Deliverable page
```

## Honesty notes

- You do **not** need paid accounts for the apps. Gated access with evidence is a correct finding.
- Low-confidence rows are labeled as such on the page.
- Re-running `npm run research` will re-fetch live docs; priors keep the matrix stable when fetches miss.

## License

MIT — take-home submission artifact.
"# composio-app-research" 
