import { create } from "zustand";

interface UiState {
  selectedChain: string;
  selectedWalletId: string | null;
  /** Desktop sidebar expanded when true. */
  sidebarOpen: boolean;
  setSelectedChain: (chain: string) => void;
  setSelectedWalletId: (id: string | null) => void;
  /**
   * Toggles desktop sidebar visibility.
   */
  toggleSidebar: () => void;
  /**
   * Sets desktop sidebar open state.
   * @param open - Whether the sidebar should be expanded
   */
  setSidebarOpen: (open: boolean) => void;
}

/**
 * Client-only UI state (memory only — no localStorage).
 * Canonical server data stays in TanStack Query / Supabase.
 */
export const useUiStore = create<UiState>((set) => ({
  selectedChain: "ethereum-sepolia",
  selectedWalletId: null,
  sidebarOpen: true,
  setSelectedChain: (selectedChain) => set({ selectedChain }),
  setSelectedWalletId: (selectedWalletId) => set({ selectedWalletId }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}));
