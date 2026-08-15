import { getSupabase } from "./supabase";
import type { AgentDto, ApiKeyDto, HistoryDto, ProfileDto } from "./types";

/**
 * @returns API base URL without trailing slash
 */
export function getApiBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  return (raw || "https://xone-sdk-api.tskwangyi.workers.dev").replace(/\/$/, "");
}

/**
 * @returns True when console should talk to Hono instead of in-memory SDK
 */
export function isRemoteApiEnabled(): boolean {
  const apiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  const useRemote = import.meta.env.VITE_USE_REMOTE === "true";
  const hasSupabase = Boolean(
    (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() &&
      (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim(),
  );
  return Boolean(apiUrl || useRemote || hasSupabase);
}

/**
 * @returns Access token for the signed-in Supabase user
 */
async function getAccessToken(): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  return token;
}

/**
 * Authenticated fetch against the Hono API.
 *
 * @param path - Path starting with /v1
 * @param init - Fetch init
 * @returns Parsed JSON
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });

  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  };

  if (!res.ok) {
    throw new Error(body.error || `Request failed (${res.status})`);
  }

  return body as T;
}

/**
 * Unauthenticated fetch (register / public).
 *
 * @param path - Path starting with /v1
 * @param init - Fetch init
 * @returns Parsed JSON
 */
export async function publicApiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new Error(
      `Cannot reach API at ${getApiBaseUrl()}. Check VITE_API_URL.`,
    );
  }

  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  };

  if (!res.ok) {
    throw new Error(body.error || `Request failed (${res.status})`);
  }

  return body as T;
}

/**
 * Console API helpers.
 */
export const api = {
  /**
   * Registers without confirmation email (server auto-confirms).
   *
   * @param params - Email, password, optional name
   * @returns Session tokens
   */
  register: (params: { email: string; password: string; name?: string }) =>
    publicApiFetch<{
      accessToken: string;
      refreshToken: string;
      user: { id: string; email: string; name: string };
    }>("/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  /**
   * @returns Current profile
   */
  me: () => apiFetch<ProfileDto>("/v1/me"),

  /**
   * @returns API keys
   */
  listApiKeys: () =>
    apiFetch<{ items: ApiKeyDto[] }>("/v1/api-keys").then((r) => r.items),

  /**
   * @param name - Unique label
   * @returns Created key (full token once)
   */
  createApiKey: (name: string) =>
    apiFetch<ApiKeyDto>("/v1/api-keys", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  /**
   * @param id - Key id
   * @returns Soft-deleted key
   */
  deleteApiKey: (id: string) =>
    apiFetch<ApiKeyDto>(`/v1/api-keys/${id}`, { method: "DELETE" }),

  /**
   * @param apiKeyId - Optional filter
   * @returns Agents
   */
  listAgents: (apiKeyId?: string) => {
    const q = apiKeyId ? `?apiKeyId=${encodeURIComponent(apiKeyId)}` : "";
    return apiFetch<{ items: AgentDto[] }>(`/v1/agents${q}`).then(
      (r) => r.items,
    );
  },

  /**
   * Creates an agent bound to an API key (console JWT).
   *
   * @param params - Key, name, limits, optional allowlists
   * @returns Created agent
   */
  createAgent: (params: {
    apiKeyId: string;
    name: string;
    chain?: AgentDto["chain"];
    dailyLimit: number;
    perTransaction: number;
    allowedHosts?: string[];
    allowedPayees?: string[];
  }) =>
    apiFetch<AgentDto>("/v1/agents", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  /**
   * @param id - Agent id
   * @returns Agent
   */
  getAgent: (id: string) => apiFetch<AgentDto>(`/v1/agents/${id}`),

  /**
   * @param id - Agent id
   * @returns Soft-deleted agent
   */
  deleteAgent: (id: string) =>
    apiFetch<AgentDto>(`/v1/agents/${id}`, { method: "DELETE" }),

  /**
   * @param id - Agent id
   * @returns Updated agent
   */
  pauseAgent: (id: string) =>
    apiFetch<AgentDto>(`/v1/agents/${id}/pause`, { method: "POST" }),

  /**
   * @param id - Agent id
   * @returns Updated agent
   */
  resumeAgent: (id: string) =>
    apiFetch<AgentDto>(`/v1/agents/${id}/resume`, { method: "POST" }),

  /**
   * @param id - Agent id
   * @param patch - Limits
   * @returns Updated agent
   */
  updateLimits: (
    id: string,
    patch: {
      dailyLimit?: number;
      perTransaction?: number;
      allowedHosts?: string[];
      allowedPayees?: string[];
    },
  ) =>
    apiFetch<AgentDto>(`/v1/agents/${id}/limits`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  /**
   * @param id - Agent id
   * @param limit - Max rows
   * @returns History
   */
  agentHistory: (id: string, limit = 50) =>
    apiFetch<{ items: HistoryDto[] }>(
      `/v1/agents/${id}/history?limit=${limit}`,
    ).then((r) => r.items),

  /**
   * @param limit - Max rows
   * @returns Account history
   */
  accountHistory: (limit = 100) =>
    apiFetch<{ items: HistoryDto[] }>(
      `/v1/agents/history?limit=${limit}`,
    ).then((r) => r.items),
};
