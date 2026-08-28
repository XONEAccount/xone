import { create } from "zustand";
import { persist } from "zustand/middleware";
import { fetchServiceCatalog } from "@/lib/service-catalog-api";

/** Shared Agent List catalog entry (platform-owned; users toggle enabled). */
export type CatalogAgent = {
  id: string;
  name: string;
  /** Absolute x402 resource URL (may accept ?q= for search agents). */
  url: string;
  /** What this agent does (shown in UI + sent to Chat). */
  description: string;
  enabled: boolean;
};

/**
 * Fallback when API is unreachable (matches DB seed).
 */
export const SHARED_AGENT_CATALOG: Omit<CatalogAgent, "enabled">[] = [
  {
    id: "agent-bocha-search",
    name: "Bocha Search",
    url: "https://xone-x402-seller.tskwangyi.workers.dev/bocha/search",
    description:
      "Use Bocha web search to answer the user’s factual / current-events question. Pass the question as pay_x402.query. Price is AI-estimated between $0.01–$0.10 USDC per call.",
  },
];

type AgentListState = {
  enabledById: Record<string, boolean>;
  /** Remote/platform definitions (without enabled). */
  catalog: Omit<CatalogAgent, "enabled">[];
  agents: CatalogAgent[];
  loading: boolean;
  error: string | null;
  /**
   * Reloads catalog from wallet-api (admin-managed).
   */
  refreshCatalog: () => Promise<void>;
  /**
   * Toggles enabled for a catalog entry.
   * @param id - Catalog id
   */
  toggleEnabled: (id: string) => void;
};

/**
 * Resolves catalog rows with user enable overrides.
 * @param catalog - Platform rows
 * @param enabledById - Overrides (missing = enabled)
 */
function resolveAgents(
  catalog: Omit<CatalogAgent, "enabled">[],
  enabledById: Record<string, boolean>,
): CatalogAgent[] {
  return catalog.map((item) => ({
    ...item,
    enabled: enabledById[item.id] ?? true,
  }));
}

/**
 * Agent List catalog store (Service List → Agent List).
 */
export const useAgentListStore = create<AgentListState>()(
  persist(
    (set, get) => ({
      enabledById: {},
      catalog: SHARED_AGENT_CATALOG,
      agents: resolveAgents(SHARED_AGENT_CATALOG, {}),
      loading: false,
      error: null,

      async refreshCatalog() {
        set({ loading: true, error: null });
        try {
          const items = await fetchServiceCatalog("agent");
          const catalog =
            items.length > 0
              ? items.map((i) => ({
                  id: i.id,
                  name: i.name,
                  url: i.url,
                  description: i.description,
                }))
              : SHARED_AGENT_CATALOG;
          const enabledById = get().enabledById;
          set({
            catalog,
            agents: resolveAgents(catalog, enabledById),
            loading: false,
            error: null,
          });
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : "Failed to load catalog",
            // Keep last good catalog / fallback.
            agents: resolveAgents(get().catalog, get().enabledById),
          });
        }
      },

      toggleEnabled(id) {
        const current = get().agents.find((a) => a.id === id)?.enabled ?? true;
        const enabledById = { ...get().enabledById, [id]: !current };
        set({
          enabledById,
          agents: resolveAgents(get().catalog, enabledById),
        });
      },
    }),
    {
      name: "xone-service-agent-list",
      /**
       * @param persisted - Stored slice
       * @param current - Current state
       */
      merge: (persisted, current) => {
        const p = persisted as Partial<AgentListState> | undefined;
        const enabledById = { ...(p?.enabledById ?? {}) };
        const catalog =
          Array.isArray(p?.catalog) && p.catalog.length > 0
            ? p.catalog
            : current.catalog;
        return {
          ...current,
          enabledById,
          catalog,
          agents: resolveAgents(catalog, enabledById),
        };
      },
      partialize: (state) => ({
        enabledById: state.enabledById,
        catalog: state.catalog,
      }),
    },
  ),
);
