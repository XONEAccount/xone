import { User } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

/**
 * Account / logout page.
 */
export function AccountPage() {
  const { user, logout } = useAuth();

  return (
    <div className="mx-auto max-w-lg space-y-6 animate-in">
      <PageHeader
        icon={User}
        title="Account"
      />

      {user ? (
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4">
            <img
              src={user.avatarUrl}
              alt=""
              className="h-14 w-14 rounded-full border border-border"
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{user.name}</p>
              <p className="font-mono text-sm text-muted-foreground">{user.email}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void logout()}
            >
              Log out
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
