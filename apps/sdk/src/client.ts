import { Agent } from "./agent.js";
import { OperatorRequiredError } from "./errors.js";
import { getRemoteAgentForKey, createRemoteAgent, RemoteAgent } from "./remoteAgent.js";
import {
  createAgentRecord,
  deleteAgentRecord,
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
 * Remote tokens: `create` (1 key ↔ 1 wallet), `get`, `pay`, history.
 * Limits, pause, and delete belong on the console JWT.
 *
 * @example
 * ```ts
 * const xone = new XOne({ agentToken: process.env.XONE_AGENT_TOKEN! });
 * const agent = await xone.agent.create({
 *   name: "agent",
 *   dailyLimit: 10,
 *   perTransaction: 1,
 * });
 * await agent.pay({ url: "https://seller.example/weather" });
 * ```
 */
export class XOne {
  readonly agentToken: string;
  /** Resolved API origin (`XONE_API_URL`), if any. */
  private readonly baseUrl?: string;

  /**
   * Agent namespace (1 API key ↔ 1 agent). No ids required.
   */
  readonly agent: {
    create: (params: AgentCreateParams) => Promise<Agent | RemoteAgent>;
    /** Load the agent bound to this key (or `undefined`). */
    get: () =>
      | Promise<Agent | RemoteAgent | undefined>
      | (Agent | undefined);
    /** Soft-delete the agent bound to this key. */
    delete: () => Promise<Agent | RemoteAgent> | Agent;
  };

  /**
   * @param config - API key token from the personal console
   */
  constructor(config: XOneConfig) {
    if (!config.agentToken?.trim()) {
      throw new Error("agentToken is required");
    }

    this.agentToken = config.agentToken;
    this.baseUrl = resolveApiBaseUrl();

    if (this.baseUrl) {
      const baseUrl = this.baseUrl;
      this.agent = {
        create: (params: AgentCreateParams) =>
          createRemoteAgent(baseUrl, this.agentToken, params),
        get: () => getRemoteAgentForKey(baseUrl, this.agentToken),
        delete: async () => {
          throw new OperatorRequiredError(
            "Delete agents in the console. Agent tokens may create, get, pay, and read history.",
          );
        },
      };
      return;
    }

    this.agent = {
      create: (params) => this.createAgent(params),
      get: () => this.getMockAgent(),
      delete: () => {
        const existing = this.getMockAgent();
        if (!existing) {
          throw new Error("Agent not found for this API key");
        }
        return new Agent(deleteAgentRecord(existing.id));
      },
    };
  }

  /**
   * Creates an agent with a local wallet and spend limits (mock).
   *
   * @param params - Name, limits, chain, optional currency
   * @returns Agent instance
   */
  private async createAgent(params: AgentCreateParams): Promise<Agent> {
    requireActiveApiKeyByToken(this.agentToken);
    const record = await createAgentRecord(params, this.agentToken);
    return new Agent(record);
  }

  /**
   * @returns The agent bound to this key, if any
   */
  private getMockAgent(): Agent | undefined {
    const keyId = findApiKeyIdByToken(this.agentToken);
    if (!keyId) return undefined;
    const [record] = listAgentRecords([keyId]);
    return record ? new Agent(record) : undefined;
  }
}
