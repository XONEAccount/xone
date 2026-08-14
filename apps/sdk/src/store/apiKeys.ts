import { randomAlnum, uuidHex } from "../utils/id.js";
import { InvalidApiKeyError, ValidationError } from "../errors.js";
import type {
  ApiKeyCreateParams,
  ApiKeyRecord,
  AgentRecord,
} from "../types.js";

/** In-memory API key registry (personal account, mock). */
const apiKeys = new Map<string, ApiKeyRecord>();
/** token → apiKeyId */
const tokenIndex = new Map<string, string>();

/**
 * Creates a new API key for the personal account.
 *
 * @param params - Key label
 * @returns Created key (includes secret token)
 * @throws When name is empty or already used by an active key
 */
export async function createApiKeyRecord(
  params: ApiKeyCreateParams,
): Promise<ApiKeyRecord> {
  await delay(10);
  const name = params.name?.trim();
  if (!name) {
    throw new ValidationError("name is required");
  }

  for (const existing of apiKeys.values()) {
    if (
      existing.status === "active" &&
      existing.name.toLowerCase() === name.toLowerCase()
    ) {
      throw new ValidationError(`API key name already exists: ${name}`);
    }
  }

  const id = `key_${uuidHex(12)}`;
  const token = `xone_${randomAlnum(16)}`;
  const record: ApiKeyRecord = {
    id,
    name,
    token,
    createdAt: new Date().toISOString(),
    status: "active",
  };

  apiKeys.set(id, record);
  tokenIndex.set(token, id);
  return cloneKey(record);
}

/**
 * @returns Active API keys (newest first). Soft-deleted keys stay in the store but are omitted.
 */
export function listApiKeyRecords(): ApiKeyRecord[] {
  return [...apiKeys.values()]
    .filter((k) => k.status !== "deleted")
    .map(cloneKey)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/**
 * @param id - API key id
 * @returns Key or undefined
 */
export function getApiKeyRecord(id: string): ApiKeyRecord | undefined {
  const record = apiKeys.get(id);
  return record ? cloneKey(record) : undefined;
}

/**
 * Resolves an active API key by secret token.
 *
 * @param token - agentToken from SDK
 * @returns Active key record
 * @throws {InvalidApiKeyError} When missing or deleted
 */
export function requireActiveApiKeyByToken(token: string): ApiKeyRecord {
  if (!token?.trim()) {
    throw new InvalidApiKeyError("API key token is required");
  }
  const id = tokenIndex.get(token);
  if (!id) {
    throw new InvalidApiKeyError("Unknown API key token");
  }
  const record = apiKeys.get(id);
  if (!record || record.status !== "active") {
    throw new InvalidApiKeyError("API key is deleted or inactive");
  }
  return cloneKey(record);
}

/**
 * Soft-deletes an API key. Existing agents remain but new creates fail.
 *
 * @param id - API key id
 * @returns Updated key
 * @throws When key is missing
 */
export function deleteApiKeyRecord(id: string): ApiKeyRecord {
  const record = apiKeys.get(id);
  if (!record) {
    throw new ValidationError(`API key not found: ${id}`);
  }
  if (record.status === "deleted") {
    return cloneKey(record);
  }
  record.status = "deleted";
  return cloneKey(record);
}

/**
 * Counts agents linked to an API key.
 *
 * @param apiKeyId - Key id
 * @param agents - Agent map
 * @returns Count
 */
export function countAgentsForKey(
  apiKeyId: string,
  agents: Map<string, AgentRecord>,
): number {
  let n = 0;
  for (const agent of agents.values()) {
    if (agent.apiKeyId === apiKeyId) n += 1;
  }
  return n;
}

/**
 * @param record - API key
 * @returns Clone
 */
function cloneKey(record: ApiKeyRecord): ApiKeyRecord {
  return { ...record };
}

/**
 * @param ms - Delay
 * @returns Promise
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Resolves api key id by token (active or deleted).
 *
 * @param token - Secret token
 * @returns Key id or undefined
 */
export function findApiKeyIdByToken(token: string): string | undefined {
  return tokenIndex.get(token);
}
