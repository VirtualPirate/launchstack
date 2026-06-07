import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Users } from "lucide-react";
import type { Team } from "@launchstack/api-interfaces";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/gitbrief/shared/page-header";
import { EmptyState } from "@/components/gitbrief/shared/empty-state";
import { EntityDot } from "@/components/gitbrief/shared/entity-dot";
import {
  ErrorState,
  extractErrorMessage,
} from "@/components/gitbrief/shared/error-state";
import { SkeletonGrid } from "@/components/gitbrief/shared/skeleton-list";
import { TeamDialog } from "@/components/gitbrief/new-team/team-dialog";
import { useGetTeams } from "@/hooks/api/use-teams";

export function TeamsPage() {
  const teamsQuery = useGetTeams();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Teams"
        description="Group collaborators so briefs can focus on their work."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" /> New team
          </Button>
        }
      />

      {teamsQuery.isLoading ? (
        <SkeletonGrid cards={6} cardHeight={120} />
      ) : teamsQuery.isError ? (
        <ErrorState
          message={extractErrorMessage(teamsQuery.error)}
          onRetry={() => teamsQuery.refetch()}
        />
      ) : teamsQuery.data?.data.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title="No teams yet"
          description="Create your first team to start grouping collaborators."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" /> New team
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(teamsQuery.data?.data ?? []).map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      )}

      <TeamDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

function TeamCard({ team }: { team: Team }) {
  return (
    <Link to="/teams/$teamId" params={{ teamId: team.id }} className="block">
      <Card className="transition-colors hover:bg-accent/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <EntityDot color={team.color ?? "var(--muted-foreground)"} />
            <span className="truncate">{team.name}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          {team.description ? (
            <p className="line-clamp-2">{team.description}</p>
          ) : (
            <p className="italic">No description</p>
          )}
          <p className="mt-2">
            {team.collaboratorIds.length}{" "}
            {team.collaboratorIds.length === 1 ? "collaborator" : "collaborators"}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
