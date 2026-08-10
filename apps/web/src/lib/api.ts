import { getWebEnv } from "@/lib/env";

type ApiOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  idempotencyKey?: string;
};

/**
 * Typed fetch helper against the Hono API.
 * @param path - API path beginning with /api
 * @param options - Request options
 * @returns Parsed JSON response
 * @throws When the response is not ok
 */
export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const env = getWebEnv();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  const response = await fetch(`${env.apiUrl}${path}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? `Request failed (${response.status})`);
  }

  return data;
}
