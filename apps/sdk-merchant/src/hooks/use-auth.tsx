import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import { getSupabase, isRemoteAuthEnabled } from "@/lib/supabase";

const SESSION_KEY = "xone.console.user";
const USERS_KEY = "xone.console.users";

export interface ConsoleUser {
  name: string;
  email: string;
  avatarUrl: string;
}

interface StoredAccount {
  name: string;
  email: string;
  password: string;
}

type AuthContextValue = {
  user: ConsoleUser | null;
  isLoggedIn: boolean;
  ready: boolean;
  remote: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (params: {
    email: string;
    password: string;
    name?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * @param email - User email
 * @returns Avatar URL
 */
function avatarFor(email: string): string {
  return `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(email)}`;
}

/**
 * @returns Registered mock accounts
 */
function loadAccounts(): Record<string, StoredAccount> {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, StoredAccount>;
  } catch {
    return {};
  }
}

/**
 * @param accounts - Accounts to persist
 */
function saveAccounts(accounts: Record<string, StoredAccount>): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(accounts));
}

/**
 * Ensures demo account exists for mock mode.
 */
function ensureDemoAccount(): void {
  const accounts = loadAccounts();
  if (!accounts["demo@xone.dev"]) {
    accounts["demo@xone.dev"] = {
      email: "demo@xone.dev",
      name: "Demo User",
      password: "demo",
    };
    saveAccounts(accounts);
  }
}

/**
 * @returns Stored mock session user or null
 */
function loadSession(): ConsoleUser | null {
  if (isRemoteAuthEnabled()) return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ConsoleUser;
  } catch {
    return null;
  }
}

/**
 * Maps identity fields into console user.
 */
function toConsoleUser(
  email: string,
  name?: string | null,
  avatarUrl?: string | null,
): ConsoleUser {
  return {
    email,
    name: name?.trim() || email.split("@")[0] || "User",
    avatarUrl: avatarUrl || avatarFor(email),
  };
}

/**
 * Auth provider for the console (Supabase or local mock).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const remote = isRemoteAuthEnabled();
  const [user, setUser] = useState<ConsoleUser | null>(() =>
    remote ? null : loadSession(),
  );
  const [ready, setReady] = useState(!remote);

  useEffect(() => {
    if (!remote) {
      ensureDemoAccount();
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setReady(true);
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setUser(
        u?.email
          ? toConsoleUser(
              u.email,
              (u.user_metadata as { name?: string })?.name,
              (u.user_metadata as { avatar_url?: string })?.avatar_url,
            )
          : null,
      );
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      const u = next?.user;
      setUser(
        u?.email
          ? toConsoleUser(
              u.email,
              (u.user_metadata as { name?: string })?.name,
              (u.user_metadata as { avatar_url?: string })?.avatar_url,
            )
          : null,
      );
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [remote]);

  const startSession = useCallback((account: StoredAccount) => {
    const next = toConsoleUser(account.email, account.name);
    setUser(next);
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  }, []);

  const register = useCallback(
    async (params: { email: string; password: string; name?: string }) => {
      const email = params.email.trim().toLowerCase();
      const password = params.password;
      const name = params.name?.trim();

      if (!email.includes("@")) throw new Error("Enter a valid email address");
      if (password.length < 6 && remote) {
        throw new Error("Password must be at least 6 characters");
      }
      if (password.length < 4 && !remote) {
        throw new Error("Password must be at least 4 characters");
      }

      if (remote) {
        const result = await api.register({
          email,
          password,
          name: name || email.split("@")[0] || "User",
        });
        const supabase = getSupabase()!;
        const { error } = await supabase.auth.setSession({
          access_token: result.accessToken,
          refresh_token: result.refreshToken,
        });
        if (error) throw new Error(error.message);
        return;
      }

      const accounts = loadAccounts();
      if (accounts[email]) {
        throw new Error("That email is already registered. Sign in instead.");
      }
      const account: StoredAccount = {
        email,
        password,
        name: name || email.split("@")[0] || "User",
      };
      accounts[email] = account;
      saveAccounts(accounts);
      startSession(account);
    },
    [remote, startSession],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const normalized = email.trim().toLowerCase();
      if (!normalized.includes("@")) {
        throw new Error("Enter a valid email address");
      }
      if (!password) throw new Error("Enter your password");

      if (remote) {
        const supabase = getSupabase()!;
        const { error } = await supabase.auth.signInWithPassword({
          email: normalized,
          password,
        });
        if (error) throw new Error(error.message);
        return;
      }

      ensureDemoAccount();
      const accounts = loadAccounts();
      const account = accounts[normalized];
      if (!account || account.password !== password) {
        throw new Error("Incorrect email or password");
      }
      startSession(account);
    },
    [remote, startSession],
  );

  const logout = useCallback(async () => {
    if (remote) await getSupabase()?.auth.signOut();
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
    window.location.href = "/login";
  }, [remote]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoggedIn: Boolean(user),
      ready,
      remote,
      login,
      register,
      logout,
    }),
    [user, ready, remote, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * @returns Auth context
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
