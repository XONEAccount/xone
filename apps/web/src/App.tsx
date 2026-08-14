import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { queryClient } from "@/lib/query-client";
import { EnsureAppChain } from "@/components/auth/ensure-app-chain";
import { EnsureEmbeddedWallet } from "@/components/auth/ensure-embedded-wallet";
import { RequireWallet } from "@/components/auth/require-wallet";
import { WalletSessionSync } from "@/components/auth/wallet-session-sync";
import { AppLayout } from "@/components/layout/app-layout";
import { A2APayPage } from "@/features/a2a/a2a-pay-page";
import { ChatPage } from "@/features/chat/chat-page";
import { SignInPage } from "@/features/auth/sign-in-page";
import { AgentsListPage } from "@/features/developers/agents-list-page";
import { CreateAgentPage } from "@/features/developers/create-agent-page";
import { DashboardPage } from "@/features/wallet/dashboard-page";
import {
  A2ALedgerPage,
  PaymentLedgerPage,
  ReceiveLedgerPage,
} from "@/features/wallet/ledger-pages";
import { PayPage } from "@/features/wallet/pay-page";
import { ReceivePage } from "@/features/wallet/receive-page";
import { SendPage } from "@/features/wallet/send-page";
import { SettingsPage } from "@/features/wallet/settings-page";
import { WalletPrivyProvider } from "@/web3/privy-provider";

/**
 * Root application router with Privy provider and wallet gate.
 */
export function App() {
  return (
    <WalletPrivyProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <EnsureAppChain />
          <EnsureEmbeddedWallet />
          <WalletSessionSync />
          <Routes>
            <Route path="/" element={<SignInPage />} />
            <Route
              path="/app"
              element={
                <RequireWallet>
                  <AppLayout />
                </RequireWallet>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="pay" element={<PayPage />} />
              <Route path="merchants" element={<A2APayPage />} />
              <Route path="developers" element={<CreateAgentPage />} />
              <Route path="developers/agents" element={<AgentsListPage />} />
              <Route path="a2a" element={<Navigate to="/app/merchants" replace />} />
              <Route path="ledger" element={<Navigate to="/app/ledger/payments" replace />} />
              <Route path="ledger/payments" element={<PaymentLedgerPage />} />
              <Route path="ledger/receive" element={<ReceiveLedgerPage />} />
              <Route path="ledger/a2a" element={<A2ALedgerPage />} />
              <Route path="send" element={<SendPage />} />
              <Route path="receive" element={<ReceivePage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="assistant" element={<Navigate to="/app/chat" replace />} />
              <Route path="activity" element={<Navigate to="/app/ledger/payments" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </WalletPrivyProvider>
  );
}
