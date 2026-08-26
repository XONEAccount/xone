/**
 * External product URLs used by CTAs.
 */
export const links = {
  console:
    (import.meta.env.VITE_CONSOLE_URL as string | undefined)?.trim() ||
    "https://xone-console.pages.dev",
  docs:
    (import.meta.env.VITE_DOCS_URL as string | undefined)?.trim() ||
    "https://xone-sdk-docs.pages.dev",
  docsApi:
    (import.meta.env.VITE_DOCS_API_URL as string | undefined)?.trim() ||
    "https://xone-sdk-docs.pages.dev/?doc=api",
  playground:
    (import.meta.env.VITE_PLAYGROUND_URL as string | undefined)?.trim() ||
    "https://xone-sdk-docs.pages.dev/?view=playground",
  wallet:
    (import.meta.env.VITE_WALLET_URL as string | undefined)?.trim() ||
    "https://xone-wallet-web.pages.dev",
} as const;
