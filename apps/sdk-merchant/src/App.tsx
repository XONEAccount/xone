import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { AccountPage } from "@/features/account/account-page";
import { AgentDetailPage } from "@/features/agents/agent-detail-page";
import { AgentsPage } from "@/features/agents/agents-page";
import { ApiKeysPage } from "@/features/api-keys/api-keys-page";
import { LoginPage } from "@/features/auth/login-page";
import { HistoryPage } from "@/features/history/history-page";
import { AccountProvider } from "@/hooks/use-account";
import { AuthProvider, useAuth } from "@/hooks/use-auth";

/**
 * Waits for auth restore, then gates private routes.
 */
function RequireAuth() {
  const { isLoggedIn, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }

  return (
    <AccountProvider>
      <Outlet />
    </AccountProvider>
  );
}

/**
 * Root console router.
 */
export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/api-keys" replace />} />
              <Route path="api-keys" element={<ApiKeysPage />} />
              <Route path="agents" element={<AgentsPage />} />
              <Route path="agents/:id" element={<AgentDetailPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="funds" element={<Navigate to="/history" replace />} />
              <Route path="account" element={<AccountPage />} />
              <Route path="settings" element={<Navigate to="/account" replace />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/api-keys" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
