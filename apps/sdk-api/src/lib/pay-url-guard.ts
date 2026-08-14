import { HttpError } from "./errors";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

/**
 * Policy attached to an agent for x402 settlement.
 */
export interface PayUrlPolicy {
  /** Exact or `*.suffix` hostnames. Empty = any public host. */
  allowedHosts: string[];
  /** Lowercase 0x payTo addresses. Empty = any payee. */
  allowedPayees: string[];
}

/**
 * Normalizes console/API host entries to hostnames.
 * Accepts `example.com`, `*.example.com`, or a full URL.
 *
 * @param raw - Host strings
 * @returns Deduped lowercase host rules
 * @throws {HttpError} When an entry is not a hostname
 */
export function normalizeAllowedHosts(raw?: unknown): string[] {
  const items = toStringList(raw);
  const out: string[] = [];
  for (const item of items) {
    const rule = parseHostRule(item);
    if (rule) out.push(rule);
  }
  return [...new Set(out)];
}

/**
 * Normalizes EVM payTo addresses to lowercase 0x-hex.
 *
 * @param raw - Address strings
 * @returns Deduped lowercase addresses
 * @throws {HttpError} When an entry is not a 20-byte address
 */
export function normalizeAllowedPayees(raw?: unknown): string[] {
  const items = toStringList(raw);
  const out: string[] = [];
  for (const item of items) {
    const addr = item.trim().toLowerCase();
    if (!addr) continue;
    if (!/^0x[0-9a-f]{40}$/.test(addr)) {
      throw new HttpError(
        400,
        `Invalid payee address: ${item}`,
        "validation_error",
      );
    }
    out.push(addr);
  }
  return [...new Set(out)];
}

/**
 * Asserts an x402 resource URL is safe to fetch from the API
 * (https, public DNS/IP, optional host allowlist).
 *
 * @param rawUrl - Client-supplied URL
 * @param policy - Agent host allowlist
 * @returns Parsed public URL
 * @throws {HttpError} When the URL is invalid, private, or not allowed
 */
export async function assertSafePayUrl(
  rawUrl: string,
  policy: PayUrlPolicy,
): Promise<URL> {
  const url = parseHttpsUrl(rawUrl);
  await assertPublicHostname(url.hostname);
  assertHostAllowed(url.hostname, policy.allowedHosts);
  return url;
}

/**
 * fetch() wrapper that re-validates every hop (including redirects).
 *
 * @param policy - Agent host allowlist
 * @returns Fetch implementation for x402 probe + settle
 */
export function createGuardedPayFetch(
  policy: PayUrlPolicy,
): typeof fetch {
  return async (input, init) => {
    let next = requestUrl(input);
    for (let hop = 0; hop < 5; hop += 1) {
      await assertSafePayUrl(next, policy);
      const res = await fetch(next, {
        ...init,
        redirect: "manual",
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("Location");
        if (!location) return res;
        next = new URL(location, next).href;
        continue;
      }
      return res;
    }
    throw new HttpError(502, "Too many redirects", "forbidden_url");
  };
}

/**
 * @param payTo - 402 accept payTo
 * @param policy - Agent payee allowlist
 * @throws {HttpError} When the payee is not allowed
 */
export function assertPayeeAllowed(
  payTo: string | undefined,
  policy: PayUrlPolicy,
): void {
  if (!policy.allowedPayees.length) return;
  const addr = payTo?.trim().toLowerCase() ?? "";
  if (!addr || !policy.allowedPayees.includes(addr)) {
    throw new HttpError(
      403,
      `Payee is not on this agent's allowlist${payTo ? `: ${payTo}` : ""}`,
      "forbidden_payee",
    );
  }
}

/**
 * @param hostname - URL hostname
 * @param allowedHosts - Agent rules (empty = allow)
 * @throws {HttpError} When the host is not listed
 */
export function assertHostAllowed(
  hostname: string,
  allowedHosts: string[],
): void {
  if (!allowedHosts.length) return;
  const host = hostname.toLowerCase();
  const ok = allowedHosts.some((rule) => hostMatchesRule(host, rule));
  if (!ok) {
    throw new HttpError(
      403,
      `Host is not on this agent's allowlist: ${hostname}`,
      "forbidden_url",
    );
  }
}

/**
 * @param raw - URL string
 * @returns HTTPS URL
 */
function parseHttpsUrl(raw: string): URL {
  const trimmed = raw?.trim();
  if (!trimmed) {
    throw new HttpError(400, "url is required", "validation_error");
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new HttpError(400, `Invalid url: ${raw}`, "validation_error");
  }
  if (url.protocol !== "https:") {
    throw new HttpError(400, "x402 url must be https", "forbidden_url");
  }
  if (url.username || url.password) {
    throw new HttpError(400, "x402 url must not include credentials", "forbidden_url");
  }
  return url;
}

/**
 * Blocks localhost, private, link-local, and metadata addresses.
 *
 * @param hostname - URL hostname
 */
async function assertPublicHostname(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new HttpError(400, `Private or reserved host is not allowed: ${hostname}`, "forbidden_url");
  }
  if (isIpLiteral(host)) {
    assertPublicIp(host);
    return;
  }
  if (/^\d+$/.test(host)) {
    throw new HttpError(400, `Numeric hosts are not allowed: ${hostname}`, "forbidden_url");
  }

  const ips = await resolveDnsIps(host);
  if (!ips.length) {
    throw new HttpError(502, `Could not resolve host: ${hostname}`, "forbidden_url");
  }
  for (const ip of ips) {
    assertPublicIp(ip);
  }
}

/**
 * @param host - Hostname or IP
 * @returns Whether it looks like an IP literal
 */
function isIpLiteral(host: string): boolean {
  return isIpv4(host) || host.includes(":");
}

/**
 * @param ip - IPv4 or IPv6 literal
 */
function assertPublicIp(ip: string): void {
  if (isIpv4(ip)) {
    if (isPrivateIpv4(ip)) {
      throw new HttpError(400, `Private IP is not allowed: ${ip}`, "forbidden_url");
    }
    return;
  }
  const mapped = ipv4Mapped(ip);
  if (mapped) {
    assertPublicIp(mapped);
    return;
  }
  const normalized = ip.toLowerCase();
  if (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("ff")
  ) {
    throw new HttpError(400, `Private IP is not allowed: ${ip}`, "forbidden_url");
  }
}

/**
 * @param ip - Dotted IPv4
 */
function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

/**
 * @param ip - IPv4 string
 */
function isIpv4(ip: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip);
}

/**
 * @param ip - IPv6
 * @returns Embedded IPv4 when this is :ffff:a.b.c.d
 */
function ipv4Mapped(ip: string): string | undefined {
  const m = ip.toLowerCase().match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  return m?.[1];
}

/**
 * Resolves A + AAAA via Cloudflare DNS-over-HTTPS (Workers + Node).
 *
 * @param hostname - Public hostname
 * @returns IP literals
 */
async function resolveDnsIps(hostname: string): Promise<string[]> {
  const ips = new Set<string>();
  for (const type of ["A", "AAAA"] as const) {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`,
      { headers: { Accept: "application/dns-json" } },
    ).catch(() => null);
    if (!res?.ok) continue;
    const body = (await res.json().catch(() => null)) as
      | { Answer?: Array<{ data?: string; type?: number }> }
      | null;
    for (const ans of body?.Answer ?? []) {
      const data = ans.data?.trim();
      if (data) ips.add(data.replace(/\.$/, ""));
    }
  }
  return [...ips];
}

/**
 * @param host - Request hostname
 * @param rule - Exact host or `*.example.com`
 */
function hostMatchesRule(host: string, rule: string): boolean {
  const r = rule.toLowerCase();
  if (r.startsWith("*.")) {
    const suffix = r.slice(2);
    return host === suffix || host.endsWith(`.${suffix}`);
  }
  return host === r;
}

/**
 * @param item - Host or URL
 * @returns Hostname rule
 */
function parseHostRule(item: string): string | undefined {
  const raw = item.trim().toLowerCase();
  if (!raw) return undefined;
  if (raw.startsWith("*.")) {
    const suffix = raw.slice(2);
    if (!suffix || suffix.includes("/") || suffix.includes(":")) {
      throw new HttpError(400, `Invalid host allowlist entry: ${item}`, "validation_error");
    }
    return `*.${suffix}`;
  }
  try {
    const url = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`);
    if (!url.hostname) {
      throw new Error("empty host");
    }
    return url.hostname;
  } catch {
    throw new HttpError(400, `Invalid host allowlist entry: ${item}`, "validation_error");
  }
}

/**
 * @param raw - Array or comma/newline string
 */
function toStringList(raw?: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v));
  }
  if (typeof raw === "string") {
    return raw.split(/[\n,]/);
  }
  throw new HttpError(400, "Allowlist must be an array of strings", "validation_error");
}

/**
 * @param input - fetch input
 */
function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}
