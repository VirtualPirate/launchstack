import { useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/gitbrief/shared/page-header";
import { SectionLabel } from "@/components/gitbrief/shared/section-label";
import { EmptyState } from "@/components/gitbrief/shared/empty-state";
import { EntityDot } from "@/components/gitbrief/shared/entity-dot";
import {
  ErrorState,
  extractErrorMessage,
} from "@/components/gitbrief/shared/error-state";
import { SkeletonList } from "@/components/gitbrief/shared/skeleton-list";
import { TeamDialog } from "@/components/gitbrief/new-team/team-dialog";
import { CollaboratorPicker } from "@/components/gitbrief/new-team/collaborator-picker";
import { ScopeLabel } from "@/components/gitbrief/briefs/scope-label";
import { StatusBadge } from "@/components/gitbrief/briefs/status-badge";
import { useDeleteTeam, useGetTeam } from "@/hooks/api/use-teams";
import { useGetCollaborators } from "@/hooks/api/use-collaborators";
import { useGetBriefsFirstPage } from "@/hooks/api/use-briefs";

export function TeamDetailPage() {
  const { teamId } = useParams({ strict: false });
  const navigate = useNavigate();

  const teamQuery = useGetTeam(teamId);
  const collaboratorsQuery = useGetCollaborators();
  const briefsQuery = useGetBriefsFirstPage({
    scopeType: "team",
    scopeTeamId: teamId,
    limit: 10,
  });

  const deleteMutation = useDeleteTeam();
  const [editOpen, setEditOpen] = useState(false);
  const [collabPickerOpen, setCollabPickerOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  if (teamQuery.isLoading) {
    return (
      <>
        <PageHeader title="…" />
        <SkeletonList rows={3} rowHeight={80} />
      </>
    );
  }
  if (teamQuery.isError || !teamQuery.data?.data) {
    return (
      <>
        <PageHeader title="Team" />
        <ErrorState
          message={extractErrorMessage(teamQuery.error)}
          onRetry={() => teamQuery.refetch()}
        />
      </>
    );
  }

  const team = teamQuery.data.data;
  const allCollabs = collaboratorsQuery.data?.data ?? [];
  const linked = team.collaboratorIds
    .map((id) => allCollabs.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(team.id);
      toast.success("Team deleted");
      await navigate({ to: "/teams" });
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  return (
    <>
      <div className="mb-3">
        <Link
          to="/teams"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" /> Back to teams
        </Link>
      </div>

      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <EntityDot color={team.color ?? "var(--muted-foreground)"} />
            {team.name}
          </span>
        }
        description={team.description ?? undefined}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="size-3.5" /> Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDeleteOpen(true)}
            >
              <Trash2 className="size-3.5" /> Delete
            </Button>
          </>
        }
      />

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <SectionLabel>Linked collaborators</SectionLabel>
          <Button size="sm" variant="outline" onClick={() => setCollabPickerOpen(true)}>
            Manage collaborators
          </Button>
        </div>
        {linked.length === 0 ? (
          <EmptyState
            icon={<User className="size-5" />}
            title="No collaborators linked"
            description="Link at least one collaborator so team briefs have authors to summarize."
            action={
              <Button size="sm" onClick={() => setCollabPickerOpen(true)}>
                Manage collaborators
              </Button>
            }
          />
        ) : (
          <Card>
            <CardContent className="p-0 divide-y">
              {linked.map((c) => (
                <div key={c.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                  <Avatar className="size-5">
                    {c.avatarUrl ? <AvatarImage src={c.avatarUrl} alt={c.login} /> : null}
                    <AvatarFallback className="text-[9px]">
                      {c.login.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span>{c.login}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      <section>
        <SectionLabel className="mb-3">Recent briefs for this team</SectionLabel>
        {briefsQuery.isLoading ? (
          <SkeletonList rows={3} />
        ) : briefsQuery.data?.data.items.length ? (
          <Card>
            <CardContent className="p-0 divide-y">
              {briefsQuery.data.data.items.map((brief) => (
                <Link
                  key={brief.id}
                  to="/briefs/$briefId"
                  params={{ briefId: brief.id }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30"
                >
                  <ScopeLabel scope={brief.scope} />
                  <div className="min-w-0 flex-1 text-sm font-medium truncate">
                    {brief.title || "(no title yet)"}
                  </div>
                  <StatusBadge status={brief.status} />
                </Link>
              ))}
            </CardContent>
          </Card>
        ) : (
          <EmptyState title="No briefs for this team yet" />
        )}
      </section>

      <TeamDialog open={editOpen} onOpenChange={setEditOpen} team={team} />
      <CollaboratorPicker
        open={collabPickerOpen}
        onOpenChange={setCollabPickerOpen}
        team={team}
      />

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this team?</AlertDialogTitle>
            <AlertDialogDescription>
              Existing briefs for this team will lose their scope label. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
