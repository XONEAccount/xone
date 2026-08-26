import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SiteShell } from "@/components/site-shell";
import { DevelopersPage } from "@/pages/developers-page";
import { HomePage } from "@/pages/home-page";

/**
 * Marketing site router.
 */
export function App() {
  return (
    <BrowserRouter>
      <SiteShell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/developers" element={<DevelopersPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SiteShell>
    </BrowserRouter>
  );
}
