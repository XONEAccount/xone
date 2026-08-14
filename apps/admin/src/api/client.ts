/**
 * Admin API base URL (local or Cloudflare Worker).
 */
export function getApiBase(): string {
  const raw = import.meta.env.VITE_ADMIN_API_URL?.trim();
  return (raw || "http://localhost:4397").replace(/\/$/, "");
}

export class ApiError extends Error {
  status: number;

  /**
   * @param status - HTTP status
   * @param message - Error message
   */
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Authenticated JSON fetch helper for the admin API.
 * @param path - API path beginning with /
 * @param options - Fetch options plus optional bearer token
 * @returns Parsed JSON body
 * @throws {ApiError} On non-2xx responses
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${getApiBase()}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { error: text };
    }
  }

  if (!res.ok) {
    const message =
      typeof body === "object" &&
      body &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }

  return body as T;
}
