import { create } from "zustand";
import {
  fetchA2AAccount,
  fundA2AAccount,
  mapA2ALedger,
  settleA2APayment as settleA2APaymentApi,
  updateA2AAgent,
  type A2AAccountDto,
} from "@/lib/a2a-api";

/** Connected external A2A agent with user-defined spend limits. */
export type ConnectedAgent = {
  id: string;
  name: string;
  category: string;
  description: string;
  enabled: boolean;
  /** Cap on total spend authorized for this agent (ETH). */
  maxAmount: number;
  /** Cap on a single dynamic payment request from this agent (ETH). */
  maxSinglePayment: number;
  /** Amount already spent under this agent. */
  spentAmount: number;
};

export type LedgerRecord = {
  id: string;
  direction: "in" | "out";
  kind: "receive" | "a2a" | "transfer" | "withdraw";
  title: string;
  counterparty: string;
  fromAddress?: string;
  toAddress?: string;
  agentId: string | null;
  amount: string;
  asset: "USDC" | "ETH";
  status: "success" | "blocked" | "pending" | "failed";
  note: string;
  createdAt: string;
};

const DEFAULT_AGENTS: ConnectedAgent[] = [
  {
    id: "agent-rail",
    name: "车票预订 Agent",
    category: "出行",
    description: "动态报价购票，价格由对方 Agent 给出，本地只校验限额。",
    enabled: true,
    maxAmount: 0.5,
    maxSinglePayment: 0.2,
    spentAmount: 0,
  },
  {
    id: "agent-hotel",
    name: "酒店预订 Agent",
    category: "住宿",
    description: "根据房型与日期报价，单笔支出受你设置的上限约束。",
    enabled: true,
    maxAmount: 1,
    maxSinglePayment: 0.4,
    spentAmount: 0,
  },
  {
    id: "agent-food",
    name: "餐饮外卖 Agent",
    category: "生活",
    description: "订单金额由商户 Agent 返回，超过限额将自动拦截。",
    enabled: false,
    maxAmount: 0.2,
    maxSinglePayment: 0.05,
    spentAmount: 0,
  },
];

interface A2AState {
  ownerAddress: string | null;
  /** Live on-chain ETH mirror for client-side fund validation only (not persisted). */
  walletEth: number;
  a2aBalance: number;
  agents: ConnectedAgent[];
  ledger: LedgerRecord[];
  /** Optimistic local transfer rows until chain/server history refreshes. */
  pendingTransfers: LedgerRecord[];
  loading: boolean;
  /**
   * Loads A2A account from Supabase via API for the active wallet.
   * @param address - Connected wallet address, or null when disconnected
   */
  switchWallet: (address: string | null) => Promise<void>;
  /**
   * Syncs on-chain ETH for fund validation.
   * @param amount - Chain ETH balance
   */
  syncWalletEth: (amount: number) => void;
  /**
   * Optimistic local transfer record (memory only).
   */
  recordTransfer: (input: {
    from: string;
    to: string;
    amount: string;
    asset: "ETH" | "USDC";
    txHash: string;
  }) => void;
  /**
   * Funds A2A balance in the database.
   * @param amount - ETH amount
   */
  fundFromWallet: (amount: number) => Promise<string | null>;
  setAgentEnabled: (agentId: string, enabled: boolean) => Promise<void>;
  updateAgentLimits: (
    agentId: string,
    maxAmount: number,
    maxSinglePayment: number,
  ) => Promise<string | null>;
  settleAgentPayment: (
    agentId: string,
    amount: number,
    title: string,
  ) => Promise<{ ok: boolean; message: string }>;
}

/**
 * Applies a server account snapshot into the in-memory store.
 * @param account - API account DTO
 */
function applyAccount(
  set: (partial: Partial<A2AState>) => void,
  account: A2AAccountDto,
): void {
  set({
    ownerAddress: account.walletAddress,
    a2aBalance: account.balance,
    agents: account.agents,
    ledger: mapA2ALedger(account.ledger),
    loading: false,
  });
}

/**
 * In-memory A2A UI state. Canonical data lives in Supabase via /api/a2a.
 * No localStorage / persist.
 */
export const useA2AStore = create<A2AState>((set, get) => ({
  ownerAddress: null,
  walletEth: 0,
  a2aBalance: 0,
  agents: DEFAULT_AGENTS,
  ledger: [],
  pendingTransfers: [],
  loading: false,

  switchWallet: async (address) => {
    const next = address?.toLowerCase() ?? null;
    if (!next) {
      set({
        ownerAddress: null,
        a2aBalance: 0,
        agents: DEFAULT_AGENTS,
        ledger: [],
        pendingTransfers: [],
        loading: false,
      });
      return;
    }

    if (get().ownerAddress === next && get().loading === false && get().a2aBalance >= 0) {
      // Still refresh from DB so multi-device stays consistent.
    }

    set({ loading: true, ownerAddress: next, pendingTransfers: [] });
    try {
      const account = await fetchA2AAccount(next);
      applyAccount(set, account);
    } catch (error) {
      console.warn("[a2a] load account failed", error);
      set({
        ownerAddress: next,
        a2aBalance: 0,
        agents: DEFAULT_AGENTS,
        ledger: [],
        loading: false,
      });
    }
  },

  syncWalletEth: (amount) => {
    if (!Number.isFinite(amount) || amount < 0) return;
    set({ walletEth: Number(amount.toFixed(6)) });
  },

  recordTransfer: ({ from, to, amount, asset, txHash }) => {
    const { pendingTransfers } = get();
    if (pendingTransfers.some((row) => row.id === txHash || row.note === txHash)) {
      return;
    }
    const row: LedgerRecord = {
      id: txHash,
      direction: "out",
      kind: "transfer",
      title: "转账",
      counterparty: `${to.slice(0, 6)}…${to.slice(-4)}`,
      fromAddress: from.toLowerCase(),
      toAddress: to.toLowerCase(),
      agentId: null,
      amount,
      asset,
      status: "success",
      note: txHash,
      createdAt: new Date().toISOString(),
    };
    set({ pendingTransfers: [row, ...pendingTransfers].slice(0, 20) });
  },

  fundFromWallet: async (amount) => {
    if (!Number.isFinite(amount) || amount <= 0) return "请输入有效金额";
    const { walletEth, ownerAddress } = get();
    if (!ownerAddress) return "请先连接钱包";
    if (amount > walletEth) return "钱包可用余额不足";

    try {
      const account = await fundA2AAccount(ownerAddress, amount);
      applyAccount(set, account);
      set({ walletEth: Number((walletEth - amount).toFixed(6)) });
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "转入失败";
    }
  },

  setAgentEnabled: async (agentId, enabled) => {
    const { ownerAddress } = get();
    if (!ownerAddress) return;
    try {
      const account = await updateA2AAgent(ownerAddress, agentId, { enabled });
      applyAccount(set, account);
    } catch (error) {
      console.warn("[a2a] setAgentEnabled failed", error);
    }
  },

  updateAgentLimits: async (agentId, maxAmount, maxSinglePayment) => {
    const { ownerAddress } = get();
    if (!ownerAddress) return "请先连接钱包";
    try {
      const account = await updateA2AAgent(ownerAddress, agentId, {
        maxAmount,
        maxSinglePayment,
      });
      applyAccount(set, account);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "保存失败";
    }
  },

  settleAgentPayment: async (agentId, amount, title) => {
    const { ownerAddress } = get();
    if (!ownerAddress) {
      return { ok: false, message: "请先连接钱包" };
    }
    try {
      const result = await settleA2APaymentApi(ownerAddress, agentId, amount, title);
      applyAccount(set, result.account);
      return { ok: result.ok, message: result.message };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "支付失败",
      };
    }
  },
}));
