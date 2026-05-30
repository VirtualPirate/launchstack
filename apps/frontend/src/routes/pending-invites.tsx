import { useNavigate } from "@tanstack/react-router";
import { MailPlus } from "lucide-react";
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

export function PendingInvitesPage() {
  const session = useAuthSession();
  const userId = session.data?.data?.user.id;
  const { data, isLoading } = useMyPendingInvites(userId);
  const accept = useAcceptInvite();
  const decline = useDeclineInvite();
  const navigate = useNavigate();
  const setActive = useActiveOrganizationStore((s) => s.setActiveOrganizationId);

  const invites = data?.data ?? [];

  const handleAccept = async (inviteId: string) => {
    const result = await accept.mutateAsync({ inviteId });
    setActive(result.data.organization.id);
    await navigate({ to: "/" });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-6">
      <div className="flex items-center gap-3">
        <MailPlus className="size-6" />
        <h1 className="text-2xl font-semibold">Pending invites</h1>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
      {!isLoading && invites.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You have no pending invites.
        </p>
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
              onClick={() => decline.mutate({ inviteId: invite.id })}
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
