/**
 * Auth / access / MCP signal extractors from fetched docs text.
 * Used by pass-1 (heuristic) and pass-2 (verify) loops.
 */

const AUTH_PATTERNS = [
  { method: "OAuth2", re: /\boauth\s*2(\.0)?\b|\bauthorization\s*code\b|\bclient\s*credentials\b|\bpkce\b/i },
  { method: "API key", re: /\bapi[_\s-]?key\b|\bx-api-key\b|\bbearer\s+(api|token|key)\b/i },
  { method: "Basic", re: /\bbasic\s+auth(entication)?\b|\bhttp\s+basic\b/i },
  { method: "Token", re: /\b(personal\s+access\s+token|pat|access\s+token|bearer\s+token|bot\s+token)\b/i },
  { method: "Other", re: /\b(hmac|signature|mtls|mutual\s+tls|session\s+cookie|jwt)\b/i },
];

const SELF_SERVE_RE =
  /\b(sign\s*up|create\s+(an?\s+)?(account|app|api\s*key)|developer\s+portal|free\s+(tier|plan|trial)|self[-\s]?serve|get\s+started)\b/i;
const PAID_RE = /\b(paid\s+plan|pro\s+plan|business\s+plan|enterprise\s+only|requires?\s+(a\s+)?paid|subscription\s+required)\b/i;
const PARTNER_RE =
  /\b(partner\s+(program|only)|contact\s+sales|request\s+access|app\s+review|waitlist|by\s+invitation|solution\s+partner|approved\s+partner)\b/i;
const ADMIN_RE = /\b(admin\s+(access|role|permission)|workspace\s+admin|organization\s+admin)\b/i;
const MCP_OFFICIAL_RE = /\b(official\s+)?mcp\s+server\b|\bmodel\s+context\s+protocol\b|\bmcp\.(?:[a-z0-9-]+\.)+[a-z]{2,}\b/i;
const REST_RE = /\brest(\s+api)?\b|\bopenapi\b|\bswagger\b/i;
const GQL_RE = /\bgraphql\b/i;
const BROAD_RE = /\b(comprehensive|full\s+api|hundreds?\s+of\s+endpoints|all\s+(resources|objects))\b/i;

export function extractAuthMethods(text) {
  const found = [];
  for (const { method, re } of AUTH_PATTERNS) {
    if (re.test(text) && !found.includes(method)) found.push(method);
  }
  if (found.length === 0) found.push("Unknown");
  // Prefer concrete methods over "Other" when both match
  if (found.length > 1 && found.includes("Other")) {
    return found.filter((m) => m !== "Other");
  }
  return found;
}

export function extractAccess(text) {
  const partner = PARTNER_RE.test(text);
  const paid = PAID_RE.test(text);
  const admin = ADMIN_RE.test(text);
  const selfServe = SELF_SERVE_RE.test(text);

  if (partner) {
    return {
      access: "partner",
      access_detail: "Docs signal partner / request-access / app-review gate",
    };
  }
  if (paid && !selfServe) {
    return {
      access: "paid",
      access_detail: "Docs indicate paid plan required for API credentials",
    };
  }
  if (admin && !selfServe) {
    return {
      access: "admin",
      access_detail: "Credentials require org/workspace admin",
    };
  }
  if (selfServe || paid) {
    return {
      access: paid ? "trial_or_paid_self_serve" : "self_serve",
      access_detail: paid
        ? "Self-serve signup; API may require paid/trial plan"
        : "Developer can create credentials without sales outreach",
    };
  }
  return {
    access: "unclear",
    access_detail: "Could not classify access model from fetched text alone",
  };
}

export function extractApiSurface(text) {
  const rest = REST_RE.test(text);
  const gql = GQL_RE.test(text);
  const broad = BROAD_RE.test(text);
  const parts = [];
  if (rest) parts.push("REST");
  if (gql) parts.push("GraphQL");
  if (parts.length === 0) parts.push("Documented API (type unclear from snippet)");

  let breadth = "moderate";
  if (broad) breadth = "broad";
  if (!rest && !gql) breadth = "narrow_or_unclear";

  const mcpOfficial = MCP_OFFICIAL_RE.test(text);
  return {
    api_surface: parts.join(" + "),
    api_breadth: breadth,
    mcp: mcpOfficial ? "official_or_mentioned" : "none_found_in_fetch",
    mcp_detail: mcpOfficial ? "MCP mentioned in fetched docs" : "No MCP signal in fetched page",
  };
}

export function scoreBuildability({ access, api_breadth, auth }) {
  const blockedAccess = ["partner", "unclear"].includes(access);
  const noAuth = auth.length === 1 && auth[0] === "Unknown";

  if (blockedAccess && access === "partner") {
    return {
      buildability: "blocked",
      blocker: "Partner / sales / app-review gate before credentials",
    };
  }
  if (noAuth || api_breadth === "narrow_or_unclear") {
    return {
      buildability: "partial",
      blocker: "Thin or unclear public API docs from automated fetch",
    };
  }
  if (access === "paid" || access === "admin" || access === "trial_or_paid_self_serve") {
    return {
      buildability: "partial",
      blocker:
        access === "admin"
          ? "Needs existing customer admin to mint credentials"
          : "Paid/trial plan may be required before toolkit can be tested end-to-end",
    };
  }
  return {
    buildability: "ready",
    blocker: null,
  };
}

export function summarizePage(html) {
  // Strip scripts/styles, collapse whitespace, keep first ~12k chars for signals
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);
  return text;
}
