import { DocumentMeta } from "@/components/document-meta";
import { Reveal } from "@/components/reveal";
import { links } from "@/lib/links";

/**
 * Short privacy notice for the marketing site and product beta.
 */
export function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <DocumentMeta
        title="X-ONE Privacy"
        description="How X-ONE handles account, wallet, and waitlist data during beta."
      />

      <Reveal>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Privacy
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Privacy
        </h1>
        <p className="mt-4 text-muted-foreground">Last updated 31 August 2026.</p>
        <p className="mt-4 text-muted-foreground">
          This notice describes what the X-ONE marketing site, wallet, and
          console collect during beta. It is not legal advice.
        </p>
      </Reveal>

      <div className="mt-10 space-y-8 text-muted-foreground">
        <section>
          <h2 className="text-lg font-medium text-foreground">Marketing site</h2>
          <p className="mt-2">
            The app waitlist is stored in your browser until we connect a mailing
            backend. We do not currently send waitlist emails from a server.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-medium text-foreground">Accounts</h2>
          <p className="mt-2">
            When you sign in to the wallet or console, identity is handled by our
            auth providers (including Privy and Supabase). We store an application
            user id, wallet mapping, and product data such as agent rows, limits,
            and payment history. We do not store seed phrases or raw private keys
            in our database.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-medium text-foreground">On-chain data</h2>
          <p className="mt-2">
            Addresses, balances, and transactions are public on the network you
            use. RPC and facilitator providers may process those requests to
            settle payments.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-medium text-foreground">Contact</h2>
          <p className="mt-2">
            Questions: open an issue on{" "}
            <a
              href={links.github}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              GitHub
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
