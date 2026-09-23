import { Link } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CreateOrganizationForm } from "@/components/organization/create-organization-form";
import { useAuthSession } from "@/hooks/api/use-auth";
import { useMyPendingInvites } from "@/hooks/api/use-invites";

/**
 * Page-body takeover for a user who belongs to no organization. Every
 * org-scoped query is `enabled: !!orgId`, so without this those pages sit on a
 * loader that never resolves. See `app-shell.tsx` for the gate condition and
 * the routes exempt from it.
 */
export function NoOrganizationGate() {
  const session = useAuthSession();
  const userId = session.data?.data?.user.id;
  const { data } = useMyPendingInvites(userId);
  const inviteCount = data?.data?.length ?? 0;

  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center gap-5 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
        <Building2 className="size-6 text-primary" />
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">
          Create your organization
        </h1>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          Everything in LaunchStack lives in an organization. You&apos;ll be
          the owner and can invite teammates right after.
        </p>
      </div>

      <Card className="w-full max-w-md text-left">
        <CardContent>
          <CreateOrganizationForm />
        </CardContent>
      </Card>

      {inviteCount > 0 ? (
        <p className="max-w-sm text-xs text-muted-foreground">
          Waiting on a teammate instead? You have{" "}
          <b>
            {inviteCount} pending invite{inviteCount === 1 ? "" : "s"}
          </b>{" "}
          —{" "}
          <Link
            to="/invites"
            className="font-medium text-foreground underline underline-offset-4"
          >
            review {inviteCount === 1 ? "it" : "them"}
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
