const docsBase =
  (import.meta.env.VITE_DOCS_URL as string | undefined)?.trim() ||
  "https://xone-sdk-docs.pages.dev";

/**
 * External product URLs used by CTAs.
 */
export const links = {
  console:
    (import.meta.env.VITE_CONSOLE_URL as string | undefined)?.trim() ||
    "https://xone-console.pages.dev",
  docs: docsBase,
  docsApi:
    (import.meta.env.VITE_DOCS_API_URL as string | undefined)?.trim() ||
    `${docsBase}/?doc=api`,
  docsMcp:
    (import.meta.env.VITE_DOCS_MCP_URL as string | undefined)?.trim() ||
    `${docsBase}/?doc=mcp`,
  playground:
    (import.meta.env.VITE_PLAYGROUND_URL as string | undefined)?.trim() ||
    `${docsBase}/?view=playground`,
  wallet:
    (import.meta.env.VITE_WALLET_URL as string | undefined)?.trim() ||
    "https://xone-wallet-web.pages.dev",
  github: "https://github.com/XONEAccount/web",
  x402: "https://www.x402.org",
} as const;
