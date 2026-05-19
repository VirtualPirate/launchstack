import type { OrganizationRole } from "@launchstack/api-interfaces";
import { PageHeader } from "@/components/gitbrief/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InviteMemberForm } from "@/components/organization/invite-member-form";
import { RoleBadge } from "@/components/organization/role-badge";
import { useAuthSession } from "@/hooks/api/use-auth";
import { useCurrentOrganization } from "@/hooks/api/use-organizations";
import {
  useCurrentOrganizationMembers,
  useLeaveOrganization,
  useRemoveMember,
  useUpdateMemberRole,
} from "@/hooks/api/use-members";
import {
  useCurrentOrganizationInvites,
  useResendInvite,
  useRevokeInvite,
} from "@/hooks/api/use-invites";

export function OrganizationMembersPage() {
  const session = useAuthSession();
  const current = useCurrentOrganization();
  const membersQuery = useCurrentOrganizationMembers();
  const invitesQuery = useCurrentOrganizationInvites("pending");
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const leave = useLeaveOrganization();
  const resend = useResendInvite();
  const revoke = useRevokeInvite();

  const callerRole = current.data?.data.role;
  const callerUserId = session.data?.data?.user.id;
  const members = membersQuery.data?.data ?? [];
  const invites = invitesQuery.data?.data ?? [];

  const handleRoleChange = (memberId: string, role: OrganizationRole) => {
    if (role === "owner") return;
    updateRole.mutate({
      memberId,
      payload: { role: role as "admin" | "viewer" },
    });
  };

  return (
    <>
      <PageHeader
        title="Members"
        description="Invite, manage, and assign roles for organization members."
      />
      <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>
            {members.length} member{members.length === 1 ? "" : "s"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const isSelf = m.userId === callerUserId;
                return (
                  <TableRow key={m.id}>
                    <TableCell>{m.user.name}</TableCell>
                    <TableCell>{m.user.email}</TableCell>
                    <TableCell>
                      {callerRole === "owner" && m.role !== "owner" ? (
                        <Select
                          value={m.role}
                          onValueChange={(v) =>
                            handleRoleChange(m.id, v as OrganizationRole)
                          }
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <RoleBadge role={m.role} />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isSelf && m.role !== "owner" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => leave.mutate()}
                          disabled={leave.isPending}
                        >
                          Leave
                        </Button>
                      ) : callerRole !== "viewer" && m.role !== "owner" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeMember.mutate(m.id)}
                          disabled={removeMember.isPending}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {callerRole === "owner" || callerRole === "admin" ? (
        <Card>
          <CardHeader>
            <CardTitle>Invite a teammate</CardTitle>
            <CardDescription>
              They&apos;ll receive a magic link. Invites expire after 7 days.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <InviteMemberForm />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-sm text-muted-foreground"
                    >
                      No pending invites.
                    </TableCell>
                  </TableRow>
                ) : null}
                {invites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell>{invite.email}</TableCell>
                    <TableCell className="capitalize">{invite.role}</TableCell>
                    <TableCell>
                      {new Date(invite.expiresAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => resend.mutate(invite.id)}
                        disabled={resend.isPending}
                      >
                        Resend
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => revoke.mutate(invite.id)}
                        disabled={revoke.isPending}
                      >
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
      </div>
    </>
  );
}
