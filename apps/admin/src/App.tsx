import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { AuditPage } from "@/features/audit/audit-page";
import { LoginPage } from "@/features/auth/login-page";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { FundingsPage } from "@/features/fundings/fundings-page";
import { LegacyAgentDetailPage } from "@/features/legacy-agents/legacy-agent-detail-page";
import { LegacyAgentsPage } from "@/features/legacy-agents/legacy-agents-page";
import { PaymentsPage } from "@/features/payments/payments-page";
import { ProfileDetailPage } from "@/features/profiles/profile-detail-page";
import { ProfilesPage } from "@/features/profiles/profiles-page";
import { SearchPage } from "@/features/search/search-page";
import { XoneKeyDetailPage } from "@/features/xone/xone-key-detail-page";
import { XoneKeysPage } from "@/features/xone/xone-keys-page";
import { XoneLedgerPage } from "@/features/xone/xone-ledger-page";
import { XoneTenantDetailPage } from "@/features/xone/xone-tenant-detail-page";
import { XoneTenantsPage } from "@/features/xone/xone-tenants-page";
import { XoneWalletDetailPage } from "@/features/xone/xone-wallet-detail-page";
import { XoneWalletsPage } from "@/features/xone/xone-wallets-page";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { PageLoading } from "@/components/layout/page-loading";

/**
 * Waits for auth restore, then gates private routes.
 */
function RequireAuth() {
  const { isLoggedIn, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return <PageLoading fullScreen />;
  }

  if (!isLoggedIn) {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }

  return <Outlet />;
}

/**
 * Root admin router.
 */
export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="profiles" element={<ProfilesPage />} />
              <Route path="profiles/:address" element={<ProfileDetailPage />} />
              <Route path="legacy-agents" element={<LegacyAgentsPage />} />
              <Route path="legacy-agents/:id" element={<LegacyAgentDetailPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="fundings" element={<FundingsPage />} />
              <Route path="audit" element={<AuditPage />} />
              <Route path="xone/tenants" element={<XoneTenantsPage />} />
              <Route path="xone/tenants/:id" element={<XoneTenantDetailPage />} />
              <Route path="xone/keys" element={<XoneKeysPage />} />
              <Route path="xone/keys/:id" element={<XoneKeyDetailPage />} />
              <Route path="xone/wallets" element={<XoneWalletsPage />} />
              <Route path="xone/wallets/:id" element={<XoneWalletDetailPage />} />
              <Route path="xone/ledger" element={<XoneLedgerPage />} />
              <Route path="agents" element={<Navigate to="/legacy-agents" replace />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
