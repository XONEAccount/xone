const TOKEN_KEY = "xone.playground.agentToken";

/** Public x402 seller used as the default pay target. */
export const DEFAULT_PAY_URL =
  "https://xone-x402-seller.tskwangyi.workers.dev/weather";

export type PlaygroundAgent = {
  id: string;
  name: string;
  apiKeyId: string;
  chain: string;
  currency: string;
  dailyLimit: number;
  perTransaction: number;
  remainingDaily: number;
  dailyPeriod?: string;
  address: string;
  walletFamily?: string;
  status: string;
  allowedHosts?: string[];
  allowedPayees?: string[];
};

export type PlaygroundCall = {
  method: string;
  path: string;
  status: number;
  ms: number;
  requestBody?: unknown;
  response: unknown;
};

/**
 * API error that still carries the last HTTP exchange for the response panel.
 */
export class PlaygroundApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly call?: PlaygroundCall;

  /**
   * @param message - Human-readable error
   * @param status - HTTP status, or 0 for network failure
   * @param code - API machine code
   * @param call - Captured request/response
   */
  constructor(
    message: string,
    status: number,
    code?: string,
    call?: PlaygroundCall,
  ) {
    super(message);
    this.name = "PlaygroundApiError";
    this.status = status;
    this.code = code;
    this.call = call;
  }
}

/**
 * @returns API origin. Empty string means same-origin (Vite proxy / Pages Function).
 */
export function getPlaygroundApiUrl(): string {
  const raw = import.meta.env.VITE_API_URL?.trim();
  return raw ? raw.replace(/\/$/, "") : "";
}

/**
 * @returns Human-readable API target shown in the playground chrome
 */
export function getPlaygroundApiLabel(): string {
  const explicit = import.meta.env.VITE_API_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (import.meta.env.DEV) {
    return `${window.location.origin} → http://127.0.0.1:8787`;
  }
  return window.location.origin;
}

/**
 * @returns Origin used in copied curl commands
 */
export function getPlaygroundCurlOrigin(): string {
  return getPlaygroundApiUrl() || window.location.origin;
}

/**
 * @returns Console origin for “create a key” links
 */
export function getConsoleUrl(): string {
  const raw = import.meta.env.VITE_CONSOLE_URL?.trim();
  return (raw || "https://xone-console.pages.dev").replace(/\/$/, "");
}

/**
 * Strips copy/paste noise so `xone_…` keys still validate.
 * @param raw - Field or clipboard value
 * @returns Normalized token
 */
export function normalizeAgentToken(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

/**
 * @param raw - Candidate API key
 * @returns Whether it looks like a console spend token
 */
export function isSpendToken(raw: string): boolean {
  return /^xone_[A-Za-z0-9_]+/.test(normalizeAgentToken(raw));
}

/**
 * Explains why a pasted value is not a spend token.
 * @param raw - Field value
 * @returns Error copy, or null if the value looks valid
 */
export function spendTokenError(raw: string): string | null {
  const value = normalizeAgentToken(raw);
  if (!value) return "Paste a console API key starting with xone_";
  if (/^https?:\/\//i.test(value) || /localhost|\?view=/i.test(value)) {
    return "That is a page URL. Paste the API key from the console (starts with xone_), then click Connect.";
  }
  if (!isSpendToken(value)) return "Paste a console API key starting with xone_";
  return null;
}

/**
 * @returns Token saved for this tab, if any
 */
export function loadStoredToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * Persists the spend token in sessionStorage (tab lifetime only).
 * @param token - API key, or empty to forget
 */
export function storeToken(token: string): void {
  try {
    if (!token) sessionStorage.removeItem(TOKEN_KEY);
    else sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Private mode / quota — the in-memory field still works.
  }
}

/**
 * Masks a spend token for display (`xone_abcd…wxyz`).
 * @param token - Full API key
 * @returns Masked token
 */
export function maskToken(token: string): string {
  const t = token.trim();
  if (t.length <= 12) return "xone_••••";
  return `${t.slice(0, 9)}…${t.slice(-4)}`;
}

/**
 * Builds a copy-paste curl for the last call.
 * @param token - Full API key (embedded in the copied command)
 * @param call - Last HTTP exchange
 * @returns curl command
 */
export function formatCurl(token: string, call: PlaygroundCall): string {
  const url = `${getPlaygroundCurlOrigin()}${call.path}`;
  const parts = [
    "curl",
    "-sS",
    `-X ${call.method}`,
    `'${url}'`,
    `-H 'Authorization: Bearer ${token}'`,
    `-H 'Content-Type: application/json'`,
  ];
  if (call.requestBody !== undefined) {
    parts.push(`-d '${JSON.stringify(call.requestBody)}'`);
  }
  return parts.join(" \\\n  ");
}

/**
 * Authenticated fetch against `/v1/sdk/*`.
 * @param params - Token, path, optional method/body/headers
 * @returns Parsed JSON plus the captured call
 * @throws {PlaygroundApiError} On network or API failure
 */
export async function playgroundFetch<T>(params: {
  token: string;
  path: string;
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}): Promise<{ data: T; call: PlaygroundCall }> {
  const base = getPlaygroundApiUrl();
  const method = params.method ?? "GET";
  const started = performance.now();

  let res: Response;
  try {
    res = await fetch(`${base}${params.path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.token}`,
        ...(params.headers ?? {}),
      },
      body:
        params.body === undefined ? undefined : JSON.stringify(params.body),
    });
  } catch (err) {
    const where = getPlaygroundCurlOrigin();
    const hint =
      import.meta.env.DEV && !import.meta.env.VITE_API_URL?.trim()
        ? " Start local sdk-api: pnpm --filter @xone/api dev."
        : "";
    throw new PlaygroundApiError(
      `Cannot reach API at ${where}.${hint} ${err instanceof Error ? err.message : String(err)}`,
      0,
      "network_error",
    );
  }

  const json: unknown = await res.json().catch(() => ({}));
  const call: PlaygroundCall = {
    method,
    path: params.path,
    status: res.status,
    ms: Math.round(performance.now() - started),
    requestBody: params.body,
    response: json,
  };

  if (!res.ok) {
    const record = isRecord(json) ? json : {};
    const message =
      typeof record.error === "string" ? record.error : `HTTP ${res.status}`;
    const code = typeof record.code === "string" ? record.code : undefined;
    throw new PlaygroundApiError(message, res.status, code, call);
  }

  return { data: json as T, call };
}

/**
 * Loads the agent bound to this spend token.
 * @param token - API key
 * @returns Agent plus the HTTP call, or `undefined` agent when none is bound
 * @throws {PlaygroundApiError} On auth or network failure
 */
export async function loadBoundAgent(token: string): Promise<{
  agent: PlaygroundAgent | undefined;
  call: PlaygroundCall;
}> {
  const { data, call } = await playgroundFetch<{ items: PlaygroundAgent[] }>({
    token,
    path: "/v1/sdk/agents",
  });
  return { agent: data.items[0], call };
}

/** Default wallet created by playground / SDK `agent.create()`. */
export const DEFAULT_CREATE = {
  name: "agent",
  chain: "base-sepolia",
  dailyLimit: 10,
  perTransaction: 1,
} as const;

/**
 * Creates the agent wallet for this key (idempotent).
 * @param token - API key
 * @returns Created or existing agent plus the HTTP call
 * @throws {PlaygroundApiError} On auth or network failure
 */
export async function createBoundAgent(token: string): Promise<{
  agent: PlaygroundAgent;
  call: PlaygroundCall;
}> {
  const { data, call } = await playgroundFetch<PlaygroundAgent>({
    token,
    method: "POST",
    path: "/v1/sdk/agents",
    body: { ...DEFAULT_CREATE },
  });
  return { agent: data, call };
}

/**
 * @param value - Unknown JSON
 * @returns Whether the value is a plain object
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
