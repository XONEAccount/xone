/**
 * Sidebar navigation for SDK docs (ids must match heading slugify).
 */
export interface DocNavItem {
  id: string;
  label: string;
}

export interface DocNavGroup {
  title: string;
  items: DocNavItem[];
}

export type DocProduct = "sdk" | "mcp" | "api";

/**
 * @xone/sdk TOC
 */
export const SDK_DOC_NAV: DocNavGroup[] = [
  {
    title: "Getting started",
    items: [
      { id: "overview", label: "Overview" },
      { id: "architecture", label: "Architecture" },
      { id: "console-setup", label: "Console setup" },
      { id: "playground", label: "Playground" },
      { id: "funding", label: "Funding" },
      { id: "environment", label: "Environment" },
      { id: "installation", label: "Installation" },
      { id: "quickstart", label: "Quickstart" },
      { id: "core-concepts", label: "Core concepts" },
    ],
  },
  {
    title: "Client",
    items: [
      { id: "api-reference-xone", label: "XOne" },
      { id: "constructor", label: "Constructor" },
    ],
  },
  {
    title: "xone.agent",
    items: [
      { id: "api-reference-xone-agent", label: "Namespace" },
      { id: "create-params", label: "create()" },
      { id: "get", label: "get()" },
    ],
  },
  {
    title: "RemoteAgent",
    items: [
      { id: "api-reference-remoteagent", label: "Overview" },
      { id: "properties", label: "Properties" },
      { id: "getstatus", label: "getStatus()" },
      { id: "getaddress", label: "getAddress()" },
      { id: "getspendsnapshot", label: "getSpendSnapshot()" },
      { id: "getlimits", label: "getLimits()" },
      { id: "gethistory-params", label: "getHistory()" },
      { id: "pay-params", label: "pay()" },
    ],
  },
  {
    title: "Reference",
    items: [
      { id: "types", label: "Types" },
      { id: "errors", label: "Errors" },
      { id: "security-notes", label: "Security" },
    ],
  },
];

/**
 * @xone/mcp TOC
 */
export const MCP_DOC_NAV: DocNavGroup[] = [
  {
    title: "Getting started",
    items: [
      { id: "overview", label: "Overview" },
      { id: "installation", label: "Installation" },
      { id: "configuration", label: "Configuration" },
      { id: "api-key-flow", label: "API key flow" },
    ],
  },
  {
    title: "Tools",
    items: [
      { id: "tools", label: "Overview" },
      { id: "xone_set_api_key", label: "xone_set_api_key" },
      { id: "xone_create_agent", label: "xone_create_agent" },
      { id: "xone_get_agent", label: "xone_get_agent" },
      { id: "xone_wallet_address", label: "xone_wallet_address" },
      { id: "xone_wallet_balance", label: "xone_wallet_balance" },
      { id: "xone_payment_status", label: "xone_payment_status" },
      { id: "xone_get_history", label: "xone_get_history" },
      { id: "xone_x402_pay", label: "xone_x402_pay" },
    ],
  },
  {
    title: "Reference",
    items: [{ id: "security", label: "Security" }],
  },
];

/**
 * HTTP API TOC (ids must match heading slugify in content/http-api.md).
 */
export const API_DOC_NAV: DocNavGroup[] = [
  {
    title: "Getting started",
    items: [
      { id: "overview", label: "Overview" },
      { id: "base-url", label: "Base URL" },
      { id: "authentication", label: "Authentication" },
      { id: "sdk-vs-http", label: "SDK vs HTTP" },
      { id: "curl-quickstart", label: "Curl quickstart" },
    ],
  },
  {
    title: "Spender (`/v1/sdk`)",
    items: [
      { id: "create-wallet", label: "Create wallet" },
      { id: "get-agent", label: "Get agent" },
      { id: "pay-x402", label: "Pay x402" },
      { id: "history", label: "History" },
    ],
  },
  {
    title: "Operator",
    items: [
      { id: "operator-api", label: "Operator API" },
      { id: "agents", label: "Agents" },
      { id: "api-keys", label: "API keys" },
      { id: "profile", label: "Profile" },
      { id: "errors", label: "Errors" },
      { id: "fetch-example-typescript", label: "Fetch example" },
    ],
  },
];

/** @param product - Active doc product */
export function docNavFor(product: DocProduct): DocNavGroup[] {
  if (product === "mcp") return MCP_DOC_NAV;
  if (product === "api") return API_DOC_NAV;
  return SDK_DOC_NAV;
}

/**
 * Heading slug used for anchors (keeps `_` so tool names stay readable).
 * @param text - Heading text
 * @returns URL-safe id
 */
export function slugifyHeading(text: string): string {
  return text
    .replace(/[`*_~]/g, (ch) => (ch === "_" ? "_" : ""))
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}_]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}
