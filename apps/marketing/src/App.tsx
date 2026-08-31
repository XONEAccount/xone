import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SiteShell } from "@/components/site-shell";
import { DevelopersPage } from "@/pages/developers-page";
import { GuidePage } from "@/pages/guide-page";
import { HomePage } from "@/pages/home-page";
import { PrivacyPage } from "@/pages/privacy-page";
import { SecurityPage } from "@/pages/security-page";
import { TermsPage } from "@/pages/terms-page";

/**
 * Marketing site router.
 */
export function App() {
  return (
    <BrowserRouter>
      <SiteShell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/developers" element={<DevelopersPage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SiteShell>
    </BrowserRouter>
  );
}
