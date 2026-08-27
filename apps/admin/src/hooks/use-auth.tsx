import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Address } from "viem";
import { apiFetch } from "@/lib/api";
import { connectWallet, signChallenge } from "@/lib/wallet";

const TOKEN_KEY = "xone_admin_token";

type AdminIdentity = { sub: string; role: "admin" };

type LoginOptions = {
  onConnected?: (address: string) => void;
};

type AuthContextValue = {
  ready: boolean;
  token: string | null;
  admin: AdminIdentity | null;
  isLoggedIn: boolean;
  loginWithWallet: (options?: LoginOptions) => Promise<void>;
  logout: () => void;
  authFetch: <T>(path: string, options?: RequestInit) => Promise<T>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Wallet challenge-response admin auth (allowlisted addresses).
 * @param props - Children
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setAdmin(null);
  }, []);

  const hydrate = useCallback(async () => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setReady(true);
      return;
    }
    try {
      const me = await apiFetch<{ ok: true; admin: AdminIdentity }>("/api/auth/me", {
        token: stored,
      });
      setToken(stored);
      setAdmin(me.admin);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setAdmin(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const loginWithWallet = useCallback(async (options?: LoginOptions) => {
    const address = await connectWallet();
    options?.onConnected?.(address);

    const challenge = await apiFetch<{
      ok: true;
      message: string;
      nonce: string;
    }>(`/api/auth/challenge?address=${encodeURIComponent(address)}`);

    const signature = await signChallenge(address as Address, challenge.message);
    const res = await apiFetch<{ ok: true; token: string; address: string }>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          address,
          message: challenge.message,
          signature,
        }),
      },
    );
    localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
    setAdmin({ sub: res.address, role: "admin" });
  }, []);

  const authFetch = useCallback(
    async <T,>(path: string, options: RequestInit = {}) => {
      if (!token) throw new Error("Not authenticated");
      try {
        return await apiFetch<T>(path, { ...options, token });
      } catch (err) {
        if (err instanceof Error && "status" in err && (err as { status: number }).status === 401) {
          logout();
        }
        throw err;
      }
    },
    [token, logout],
  );

  const value = useMemo(
    () => ({
      ready,
      token,
      admin,
      isLoggedIn: Boolean(token && admin),
      loginWithWallet,
      logout,
      authFetch,
    }),
    [ready, token, admin, loginWithWallet, logout, authFetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * @returns Admin auth context
 * @throws When used outside provider
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
