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

/**
 * Grouped TOC for remote-only API docs.
 */
export const DOC_NAV: DocNavGroup[] = [
  {
    title: "Getting started",
    items: [
      { id: "overview", label: "Overview" },
      { id: "architecture", label: "Architecture" },
      { id: "console-setup", label: "Console setup" },
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
      { id: "agent-get", label: "get()" },
    ],
  },
  {
    title: "RemoteAgent",
    items: [
      { id: "api-reference-remoteagent", label: "Overview" },
      { id: "properties", label: "Properties" },
      { id: "getstatus", label: "getStatus()" },
      { id: "getaddress", label: "getAddress()" },
      { id: "getbalance", label: "getBalance()" },
      { id: "getlimits", label: "getLimits()" },
      { id: "gethistory-params", label: "getHistory()" },
      { id: "pay-params", label: "pay(params)" },
      { id: "gettools", label: "getTools()" },
    ],
  },
  {
    title: "LangChain tools",
    items: [
      { id: "langchain-tools", label: "Overview" },
      { id: "xone_wallet_address", label: "xone_wallet_address" },
      { id: "xone_wallet_balance", label: "xone_wallet_balance" },
      { id: "xone_payment_status", label: "xone_payment_status" },
      { id: "xone_x402_pay", label: "xone_x402_pay" },
      { id: "langchain-agent-example", label: "LangChain example" },
    ],
  },
  {
    title: "Reference",
    items: [
      { id: "types", label: "Types" },
      { id: "errors", label: "Errors" },
      { id: "security-notes", label: "Security notes" },
    ],
  },
];

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
