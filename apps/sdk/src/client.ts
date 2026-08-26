import { Agent } from "./agent.js";
import { InvalidApiKeyError } from "./errors.js";
import { getRemoteAgentForKey, createRemoteAgent, RemoteAgent } from "./remoteAgent.js";
import {
  createAgentRecord,
  listAgentRecords,
} from "./store/mock.js";
import {
  findApiKeyIdByToken,
  requireActiveApiKeyByToken,
} from "./store/apiKeys.js";
import type { AgentCreateParams, XOneConfig } from "./types.js";

/**
 * Resolves the Hono API origin from the environment (not part of public config).
 * Set `XONE_API_URL` to talk to a live API; omit it for in-memory mock.
 *
 * @returns Normalized origin or `undefined` for mock mode
 */
function resolveApiBaseUrl(): string | undefined {
  try {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env;
    const raw = env?.XONE_API_URL?.trim();
    if (!raw) return undefined;
    return raw.replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

/**
 * XOne client — create agents with an API key from the personal console.
 *
 * When `XONE_API_URL` is set in the environment, requests go to the Hono API.
 * Otherwise uses the in-memory mock store.
 *
 * Spend surface: `create`, `get`, `pay`, history. Soft-delete / pause / limits
 * belong on the console (JWT), not this client.
 *
 * @example
 * ```ts
 * const xone = new XOne();
 * const agent = await xone.agent.create({
 *   apiKey: process.env.XONE_AGENT_TOKEN!,
 *   name: "agent",
 *   dailyLimit: 10,
 *   perTransaction: 1,
 * });
 * await agent.pay({ url: "https://seller.example/weather" });
 * ```
 */
export class XOne {
  private token: string | undefined;
  /** Resolved API origin (`XONE_API_URL`), if any. */
  private readonly baseUrl?: string;

  /**
   * Bound spend token after construct or `agent.create({ apiKey })`.
   */
  get agentToken(): string | undefined {
    return this.token;
  }

  /**
   * Agent namespace (1 API key ↔ 1 agent). No ids required.
   * Soft-delete is console-only — not exposed here.
   */
  readonly agent: {
    create: (params: AgentCreateParams) => Promise<Agent | RemoteAgent>;
    /**
     * Load the single agent bound to this key, or `undefined` if none yet.
     */
    get: () =>
      | Promise<Agent | RemoteAgent | undefined>
      | (Agent | undefined);
  };

  /**
   * @param config - Optional constructor token. Prefer passing `apiKey` to `agent.create`.
   */
  constructor(config: XOneConfig = {}) {
    this.token = config.agentToken?.trim() || undefined;
    this.baseUrl = resolveApiBaseUrl();

    if (this.baseUrl) {
      const baseUrl = this.baseUrl;
      this.agent = {
        create: (params: AgentCreateParams) => {
          const token = this.bindToken(params.apiKey);
          return createRemoteAgent(baseUrl, token, { ...params, apiKey: token });
        },
        get: () => getRemoteAgentForKey(baseUrl, this.requireToken()),
      };
      return;
    }

    this.agent = {
      create: (params) => this.createAgent(params),
      get: () => this.getMockAgent(),
    };
  }

  /**
   * Creates an agent with a local wallet and spend limits (mock).
   *
   * @param params - Name, limits, chain, optional currency, and user API key
   * @returns Agent instance
   * @throws {InvalidApiKeyError} When no API key is available
   */
  private async createAgent(params: AgentCreateParams): Promise<Agent> {
    const token = this.bindToken(params.apiKey);
    requireActiveApiKeyByToken(token);
    const record = await createAgentRecord(params, token);
    return new Agent(record);
  }

  /**
   * @returns The single agent bound to this key, if any
   * @throws {InvalidApiKeyError} When no API key is bound
   */
  private getMockAgent(): Agent | undefined {
    const keyId = findApiKeyIdByToken(this.requireToken());
    if (!keyId) return undefined;
    const [record] = listAgentRecords([keyId]);
    return record ? new Agent(record) : undefined;
  }

  /**
   * Binds a user-supplied API key (create param wins over constructor).
   *
   * @param apiKey - Token from `agent.create({ apiKey })`
   * @returns Bound spend token
   * @throws {InvalidApiKeyError} When neither create nor constructor provided a key
   */
  private bindToken(apiKey?: string): string {
    const token = apiKey?.trim() || this.token?.trim();
    if (!token) {
      throw new InvalidApiKeyError(
        "API key is required. Pass apiKey to agent.create() or construct XOne with agentToken.",
      );
    }
    this.token = token;
    return token;
  }

  /**
   * @returns Already-bound spend token
   * @throws {InvalidApiKeyError} When the client has no API key yet
   */
  private requireToken(): string {
    const token = this.token?.trim();
    if (!token) {
      throw new InvalidApiKeyError(
        "API key is required. Pass apiKey to agent.create() first.",
      );
    }
    return token;
  }
}
