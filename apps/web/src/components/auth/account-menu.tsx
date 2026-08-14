import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useWalletAccount } from "@/hooks/use-wallet-account";
import { shortAddress } from "@/lib/address";

/**
 * Compact account chip linking to settings. Replaces the old Connect menu.
 */
export function AccountMenu() {
  const { address } = useWalletAccount();

  if (!address) return null;

  return (
    <Button variant="outline" size="sm" asChild>
      <Link to="/app/settings" className="font-mono">
        {shortAddress(address)}
      </Link>
    </Button>
  );
}
