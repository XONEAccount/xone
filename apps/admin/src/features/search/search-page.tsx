import { useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBar } from "@/components/layout/search-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage, shorten } from "@/lib/utils";

type SearchResults = {
  walletProfiles: Array<{ wallet_address: string; display_name: string | null }>;
  legacyAgents: Array<{
    id: string;
    name: string;
    wallet_address: string;
    status: string;
  }>;
  xoneProfiles: Array<{ id: string; email: string; name: string }>;
  xoneApiKeys: Array<{
    id: string;
    name: string;
    token_prefix: string;
    status: string;
  }>;
  xoneAgents: Array<{
    id: string;
    name: string;
    wallet_address: string;
    status: string;
  }>;
};

/**
 * Global fan-out search across wallet + XOne tables (explicit Search only).
 */
export function SearchPage() {
  const { authFetch } = useAuth();
  const [draftQ, setDraftQ] = useState("");
  const [appliedQ, setAppliedQ] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResults | null>(null);

  /**
   * Runs search with current draft query (no auto-search on mount / typing).
   */
  async function commitSearch(): Promise<void> {
    if (draftQ.trim().length < 2) {
      setError("Enter at least 2 characters");
      return;
    }
    setAppliedQ(draftQ);
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch<{ ok: true; results: SearchResults }>(
        `/api/search?q=${encodeURIComponent(draftQ.trim())}`,
      );
      setResults(res.results);
    } catch (err) {
      setError(errorMessage(err));
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-in">
      <PageHeader
        icon={Search}
        title="Search"
        description="Find users, wallets, keys, and agents by email, address, id, or prefix."
      />
      <SearchBar searching={loading} onSearch={() => void commitSearch()}>
        <Input
          className="max-w-md"
          value={draftQ}
          onChange={(e) => setDraftQ(e.target.value)}
          placeholder="0x… / email / agt_… / xone_…"
          onKeyDown={(e) => {
            if (e.key === "Enter") void commitSearch();
          }}
        />
      </SearchBar>
      {appliedQ === null ? (
        <p className="text-sm text-muted-foreground">Click Search to load results.</p>
      ) : null}
      {error ? <p className="text-sm text-[var(--color-destructive)]">{error}</p> : null}

      {results ? (
        <div className="grid gap-4 md:grid-cols-2">
          <ResultBlock title="Wallet users" empty={results.walletProfiles.length === 0}>
            {results.walletProfiles.map((p) => (
              <li key={p.wallet_address}>
                <Link
                  className="font-mono text-sm hover:underline"
                  to={`/profiles/${encodeURIComponent(p.wallet_address)}`}
                >
                  {shorten(p.wallet_address, 10, 6)}
                </Link>
                {p.display_name ? (
                  <span className="ml-2 text-muted-foreground">{p.display_name}</span>
                ) : null}
              </li>
            ))}
          </ResultBlock>
          <ResultBlock title="Legacy agents" empty={results.legacyAgents.length === 0}>
            {results.legacyAgents.map((a) => (
              <li key={a.id}>
                <Link className="text-sm hover:underline" to={`/legacy-agents/${a.id}`}>
                  {a.name}
                </Link>
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {a.status}
                </span>
              </li>
            ))}
          </ResultBlock>
          <ResultBlock title="Console users" empty={results.xoneProfiles.length === 0}>
            {results.xoneProfiles.map((p) => (
              <li key={p.id}>
                <Link className="text-sm hover:underline" to="/xone/tenants">
                  {p.email}
                </Link>
              </li>
            ))}
          </ResultBlock>
          <ResultBlock title="API keys" empty={results.xoneApiKeys.length === 0}>
            {results.xoneApiKeys.map((k) => (
              <li key={k.id}>
                <Link className="text-sm hover:underline" to="/xone/keys">
                  {k.name} · {k.token_prefix}…
                </Link>
              </li>
            ))}
          </ResultBlock>
          <ResultBlock title="XOne wallets" empty={results.xoneAgents.length === 0}>
            {results.xoneAgents.map((a) => (
              <li key={a.id}>
                <Link className="text-sm hover:underline" to={`/xone/wallets/${a.id}`}>
                  {a.name}
                </Link>
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {a.status}
                </span>
              </li>
            ))}
          </ResultBlock>
        </div>
      ) : null}
    </div>
  );
}

function ResultBlock({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="text-sm text-muted-foreground">No matches</p>
        ) : (
          <ul className="space-y-2">{children}</ul>
        )}
      </CardContent>
    </Card>
  );
}
