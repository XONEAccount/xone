import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Shared x402 catalog entry (name / URL / description are platform-owned). */
export type X402Agent = {
  id: string;
  name: string;
  /** Absolute x402 resource URL. */
  url: string;
  /** What this endpoint does (for the model + UI). */
  description: string;
  enabled: boolean;
};

/**
 * Platform-owned shared catalog. Users may only toggle `enabled`.
 */
export const SHARED_X402_CATALOG: Omit<X402Agent, "enabled">[] = [
  {
    id: "x402-weather",
    name: "天气查询",
    url: "https://xone-x402-seller.tskwangyi.workers.dev/weather",
    description:
      "查询天气信息的 x402 付费接口。用户询问天气、气温、预报时优先选用。",
  },
];

type X402AgentsState = {
  /** Per-id enabled overrides (missing = default enabled). */
  enabledById: Record<string, boolean>;
  /**
   * Resolved catalog with current enable flags.
   */
  agents: X402Agent[];
  /**
   * Toggles enabled flag for a shared catalog entry.
   * @param id - Catalog entry id
   */
  toggleEnabled: (id: string) => void;
};

/**
 * Builds the visible catalog from shared definitions + user toggles.
 * @param enabledById - User enable overrides
 */
function resolveAgents(enabledById: Record<string, boolean>): X402Agent[] {
  return SHARED_X402_CATALOG.map((item) => ({
    ...item,
    enabled: enabledById[item.id] ?? true,
  }));
}

/**
 * Shared x402 Agent List. Catalog is fixed; only enable/disable is persisted.
 */
export const useX402AgentsStore = create<X402AgentsState>()(
  persist(
    (set, get) => ({
      enabledById: {},
      agents: resolveAgents({}),

      toggleEnabled(id) {
        const current = get().agents.find((a) => a.id === id)?.enabled ?? true;
        const enabledById = { ...get().enabledById, [id]: !current };
        set({
          enabledById,
          agents: resolveAgents(enabledById),
        });
      },
    }),
    {
      name: "xone-x402-agent-list",
      /**
       * Persist only enable overrides; always re-resolve against shared catalog.
       * @param persisted - Stored slice
       * @param current - Current state
       */
      merge: (persisted, current) => {
        const p = persisted as
          | Partial<X402AgentsState> & {
              agents?: Array<{ id: string; enabled?: boolean }>;
            }
          | undefined;

        // Migrate old shape that stored full agent rows.
        const enabledById: Record<string, boolean> = {
          ...(p?.enabledById ?? {}),
        };
        if (Array.isArray(p?.agents)) {
          for (const row of p.agents) {
            if (row?.id && typeof row.enabled === "boolean") {
              enabledById[row.id] = row.enabled;
            }
          }
        }

        return {
          ...current,
          enabledById,
          agents: resolveAgents(enabledById),
        };
      },
      partialize: (state) => ({ enabledById: state.enabledById }),
    },
  ),
);
