import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Agent, type ApiKeyRecord, type XOneChain } from "@xonepay/sdk";
import {
  countAgentsForKey,
  createAgentRecord,
  createApiKeyRecord,
  deleteAgentRecord,
  deleteApiKeyRecord,
  getAgentMap,
  getAgentRecord,
  getApiKeyRecord,
  listAgentRecords,
  listApiKeyRecords,
  softDeleteAgentsForApiKey,
} from "@xonepay/sdk/mock";
import { api, isRemoteApiEnabled } from "@/lib/api";
import { RemoteAgent } from "@/lib/remoteAgent";
import type { ApiKeyDto } from "@/lib/types";

const SECRETS_KEY = "xone.console.apiKeySecrets";

/**
 * @returns id → secret map
 */
function loadSecrets(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(SECRETS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

type AccountContextValue = {
  remote: boolean;
  loading: boolean;
  apiKeys: ApiKeyRecord[];
  agents: Agent[];
  refresh: () => Promise<void>;
  createApiKey: (name: string) => Promise<ApiKeyRecord>;
  deleteApiKey: (id: string) => Promise<void>;
  createAgent: (params: {
    apiKeyId: string;
    name: string;
    chain?: XOneChain;
    dailyLimit: number;
    perTransaction: number;
    allowedHosts?: string[];
    allowedPayees?: string[];
  }) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  agentCount: (id: string) => number;
  getAgent: (id: string) => Agent | undefined;
  getAgentByApiKey: (apiKeyId: string) => Agent | undefined;
  getApiKey: (apiKeyId: string) => ApiKeyRecord | undefined;
};

const AccountContext = createContext<AccountContextValue | null>(null);

/**
 * Console account state: API keys + agents.
 */
export function AccountProvider({ children }: { children: ReactNode }) {
  const remote = isRemoteApiEnabled();
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [secrets, setSecrets] = useState<Record<string, string>>(loadSecrets);
  const [remoteKeys, setRemoteKeys] = useState<ApiKeyDto[]>([]);
  const [remoteAgents, setRemoteAgents] = useState<RemoteAgent[]>([]);

  const bump = useCallback(() => setRevision((n) => n + 1), []);

  const persistSecrets = useCallback((next: Record<string, string>) => {
    setSecrets(next);
    sessionStorage.setItem(SECRETS_KEY, JSON.stringify(next));
  }, []);

  const rememberSecret = useCallback(
    (id: string, token: string) => {
      if (!token) return;
      persistSecrets({ ...secrets, [id]: token });
    },
    [persistSecrets, secrets],
  );

  const forgetSecret = useCallback(
    (id: string) => {
      const next = { ...secrets };
      delete next[id];
      persistSecrets(next);
    },
    [persistSecrets, secrets],
  );

  const refresh = useCallback(async () => {
    if (!remote) {
      bump();
      return;
    }
    setLoading(true);
    try {
      const [keys, list] = await Promise.all([api.listApiKeys(), api.listAgents()]);
      setRemoteKeys(keys);
      setRemoteAgents(
        list.map(
          (dto) =>
            new RemoteAgent(dto, () => {
              void refresh();
            }),
        ),
      );
      bump();
    } finally {
      setLoading(false);
    }
  }, [remote, bump]);

  const apiKeys = useMemo(() => {
    void revision;
    if (remote) {
      return remoteKeys.map((k) => ({
        ...k,
        token: k.token || secrets[k.id] || "",
      })) as ApiKeyRecord[];
    }
    return listApiKeyRecords();
  }, [remote, remoteKeys, secrets, revision]);

  const agents = useMemo(() => {
    void revision;
    if (remote) return remoteAgents as unknown as Agent[];
    const keyIds = listApiKeyRecords().map((k) => k.id);
    return listAgentRecords(keyIds).map((record) => new Agent(record));
  }, [remote, remoteAgents, revision]);

  const createApiKey = useCallback(
    async (name: string): Promise<ApiKeyRecord> => {
      if (remote) {
        const key = await api.createApiKey(name);
        if (key.token) rememberSecret(key.id, key.token);
        await refresh();
        return {
          ...(key as ApiKeyRecord),
          token: key.token || secrets[key.id] || "",
        };
      }
      const key = await createApiKeyRecord({ name });
      rememberSecret(key.id, key.token);
      bump();
      return key;
    },
    [remote, rememberSecret, refresh, secrets, bump],
  );

  const deleteApiKey = useCallback(
    async (id: string) => {
      if (remote) {
        await api.deleteApiKey(id);
        forgetSecret(id);
        await refresh();
        return;
      }
      deleteApiKeyRecord(id);
      softDeleteAgentsForApiKey(id);
      forgetSecret(id);
      bump();
    },
    [remote, forgetSecret, refresh, bump],
  );

  const createAgent = useCallback(
    async (params: {
      apiKeyId: string;
      name: string;
      chain?: XOneChain;
      dailyLimit: number;
      perTransaction: number;
      allowedHosts?: string[];
      allowedPayees?: string[];
    }) => {
      if (remote) {
        await api.createAgent({
          apiKeyId: params.apiKeyId,
          name: params.name,
          chain: params.chain,
          dailyLimit: params.dailyLimit,
          perTransaction: params.perTransaction,
          allowedHosts: params.allowedHosts,
          allowedPayees: params.allowedPayees,
        });
        await refresh();
        return;
      }
      const key = getApiKeyRecord(params.apiKeyId);
      if (!key?.token) throw new Error("API key not found");
      await createAgentRecord(
        {
          apiKey: key.token,
          name: params.name,
          chain: params.chain,
          dailyLimit: params.dailyLimit,
          perTransaction: params.perTransaction,
          allowedHosts: params.allowedHosts,
          allowedPayees: params.allowedPayees,
        },
        key.token,
      );
      bump();
    },
    [remote, refresh, bump],
  );

  const deleteAgent = useCallback(
    async (id: string) => {
      if (remote) {
        await api.deleteAgent(id);
        await refresh();
        return;
      }
      deleteAgentRecord(id);
      bump();
    },
    [remote, refresh, bump],
  );

  const agentCount = useCallback(
    (id: string) => {
      void revision;
      if (remote) return remoteAgents.some((a) => a.apiKeyId === id) ? 1 : 0;
      return countAgentsForKey(id, getAgentMap());
    },
    [remote, remoteAgents, revision],
  );

  const getAgent = useCallback(
    (id: string) => {
      void revision;
      if (remote) {
        return remoteAgents.find((a) => a.id === id) as unknown as Agent | undefined;
      }
      const record = getAgentRecord(id);
      return record ? new Agent(record) : undefined;
    },
    [remote, remoteAgents, revision],
  );

  const getAgentByApiKey = useCallback(
    (apiKeyId: string) => {
      void revision;
      if (remote) {
        return remoteAgents.find((a) => a.apiKeyId === apiKeyId) as
          | unknown as Agent | undefined;
      }
      const record = listAgentRecords([apiKeyId])[0];
      return record ? new Agent(record) : undefined;
    },
    [remote, remoteAgents, revision],
  );

  const getApiKey = useCallback(
    (apiKeyId: string) => {
      void revision;
      if (remote) {
        const row = remoteKeys.find((k) => k.id === apiKeyId);
        if (!row) return undefined;
        return {
          ...(row as ApiKeyRecord),
          token: row.token || secrets[row.id] || "",
        };
      }
      return getApiKeyRecord(apiKeyId);
    },
    [remote, remoteKeys, secrets, revision],
  );

  const value = useMemo<AccountContextValue>(
    () => ({
      remote,
      loading,
      apiKeys,
      agents,
      refresh,
      createApiKey,
      deleteApiKey,
      createAgent,
      deleteAgent,
      agentCount,
      getAgent,
      getAgentByApiKey,
      getApiKey,
    }),
    [
      remote,
      loading,
      apiKeys,
      agents,
      refresh,
      createApiKey,
      deleteApiKey,
      createAgent,
      deleteAgent,
      agentCount,
      getAgent,
      getAgentByApiKey,
      getApiKey,
    ],
  );

  return (
    <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
  );
}

/**
 * @returns Account context
 */
export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used within AccountProvider");
  return ctx;
}
