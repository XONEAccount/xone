import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { apiFetch } from "../api/client";

const TOKEN_KEY = "xone_admin_token";

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY));
  const loading = ref(false);
  const error = ref<string | null>(null);

  const isAuthenticated = computed(() => Boolean(token.value));

  /**
   * Persists the session JWT in memory and localStorage.
   * @param value - JWT or null to clear
   */
  function setToken(value: string | null) {
    token.value = value;
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  }

  /**
   * Logs in with admin username + password.
   * @param username - Admin username
   * @param password - Admin password
   */
  async function login(username: string, password: string) {
    loading.value = true;
    error.value = null;
    try {
      const res = await apiFetch<{ ok: boolean; token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setToken(res.token);
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Login failed";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Clears the local session.
   */
  function logout() {
    setToken(null);
  }

  /**
   * Validates the current token against /api/auth/me.
   * @returns Whether the session is still valid
   */
  async function hydrate(): Promise<boolean> {
    if (!token.value) return false;
    try {
      await apiFetch("/api/auth/me", { token: token.value });
      return true;
    } catch {
      setToken(null);
      return false;
    }
  }

  return {
    token,
    loading,
    error,
    isAuthenticated,
    login,
    logout,
    hydrate,
  };
});
