import { Link, useNavigate } from "@tanstack/react-router";
import { MailPlus } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { SkeletonList } from "@/components/shared/skeleton-list";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthSession } from "@/hooks/api/use-auth";
import {
  useAcceptInvite,
  useDeclineInvite,
  useMyPendingInvites,
} from "@/hooks/api/use-invites";
import { useActiveOrganizationStore } from "@/stores/active-organization-store";
import { extractErrorMessage } from "@/lib/extract-error";

const onError = (err: unknown) => toast.error(extractErrorMessage(err));

export function PendingInvitesPage() {
  const session = useAuthSession();
  const userId = session.data?.data?.user.id;
  const { data, isLoading, isError, error, refetch } = useMyPendingInvites(userId);
  const accept = useAcceptInvite();
  const decline = useDeclineInvite();
  const navigate = useNavigate();
  const setActive = useActiveOrganizationStore((s) => s.setActiveOrganizationId);

  const invites = data?.data ?? [];

  const handleAccept = async (inviteId: string) => {
    let result;
    try {
      result = await accept.mutateAsync({ inviteId });
    } catch (err) {
      onError(err);
      return;
    }
    setActive(result.data.organization.id);
    await navigate({ to: "/" });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-6">
      <PageHeader title="Pending invites" />
      {isLoading ? <SkeletonList rows={2} rowHeight={120} /> : null}
      {isError ? (
        <ErrorState
          message={extractErrorMessage(error)}
          onRetry={() => void refetch()}
        />
      ) : null}
      {!isLoading && !isError && invites.length === 0 ? (
        <EmptyState
          icon={<MailPlus className="size-6" />}
          title="No pending invites"
          description="Ask a teammate to invite you, or start your own organization."
          action={
            <Button asChild>
              <Link to="/organizations/new">Create organization</Link>
            </Button>
          }
        />
      ) : null}
      {invites.map((invite) => (
        <Card key={invite.id}>
          <CardHeader>
            <CardTitle>Invitation</CardTitle>
            <CardDescription>
              {invite.invitedBy?.name ?? "Someone"} invited you as{" "}
              <strong>{invite.role}</strong>. Expires{" "}
              {new Date(invite.expiresAt).toLocaleDateString()}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button
              onClick={() => handleAccept(invite.id)}
              disabled={accept.isPending}
            >
              Accept
            </Button>
            <Button
              variant="outline"
              onClick={() => decline.mutate({ inviteId: invite.id }, { onError })}
              disabled={decline.isPending}
            >
              Decline
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
