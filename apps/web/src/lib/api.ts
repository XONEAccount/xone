import { getWebEnv } from "@/lib/env";

type ApiOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  idempotencyKey?: string;
};

type ApiErrorBody = {
  error?: string;
  details?: {
    fieldErrors?: Record<string, string[] | undefined>;
    formErrors?: string[];
  };
  issues?: Array<{ path?: (string | number)[]; message?: string }>;
};

/**
 * Turns an API error JSON body into a readable message, including Zod field errors.
 * @param data - Parsed error response
 * @param status - HTTP status
 * @returns User-facing error string
 */
function formatApiError(data: ApiErrorBody, status: number): string {
  const title = data.error ?? `Request failed (${status})`;
  const fieldErrors = data.details?.fieldErrors
    ? Object.entries(data.details.fieldErrors).flatMap(([key, messages]) =>
        (messages ?? []).map((message) => `${key}: ${message}`),
      )
    : [];
  const formErrors = data.details?.formErrors ?? [];
  const issues =
    data.issues?.map((issue) => {
      const path = issue.path?.join(".") ?? "";
      return path ? `${path}: ${issue.message}` : (issue.message ?? "");
    }) ?? [];
  const extra = [...fieldErrors, ...formErrors, ...issues].filter(Boolean).join("；");
  return extra ? `${title}（${extra}）` : title;
}

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

  try {
    const response = await fetch(`${env.apiUrl}${path}`, {
      method: options.method ?? (options.body ? "POST" : "GET"),
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = (await response.json().catch(() => ({}))) as T & { error?: string };

    if (!response.ok) {
      throw new Error(formatApiError(data, response.status));
    }

    return data;
  } catch (error) {
    if (error instanceof Error && error.message === "Failed to fetch") {
      throw new Error("无法连接钱包服务。请先启动 API：pnpm --filter @wallet/api dev");
    }
    throw error;
  }
}
