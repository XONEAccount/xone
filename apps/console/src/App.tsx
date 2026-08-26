import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
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
 * Redirects legacy `/agents/:id` bookmarks to `/wallet/:id`.
 */
function AgentsIdRedirect() {
  const { id } = useParams();
  return <Navigate to={id ? `/wallet/${id}` : "/wallet"} replace />;
}

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
              <Route path="wallet" element={<AgentsPage />} />
              <Route path="wallet/:id" element={<AgentDetailPage />} />
              <Route path="ledger" element={<HistoryPage />} />
              <Route path="agents" element={<Navigate to="/wallet" replace />} />
              <Route path="agents/:id" element={<AgentsIdRedirect />} />
              <Route path="history" element={<Navigate to="/ledger" replace />} />
              <Route path="funds" element={<Navigate to="/ledger" replace />} />
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
