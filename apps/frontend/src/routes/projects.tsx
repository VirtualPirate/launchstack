import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { FolderKanban, Plus } from "lucide-react";
import type { Project } from "@launchstack/api-interfaces";
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
import { ProjectDialog } from "@/components/gitbrief/new-project/project-dialog";
import { useGetProjects } from "@/hooks/api/use-projects";

export function ProjectsPage() {
  const projectsQuery = useGetProjects();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Projects"
        description="Group repositories so briefs cover the right scope."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" /> New project
          </Button>
        }
      />

      {projectsQuery.isLoading ? (
        <SkeletonGrid cards={6} cardHeight={120} />
      ) : projectsQuery.isError ? (
        <ErrorState
          message={extractErrorMessage(projectsQuery.error)}
          onRetry={() => projectsQuery.refetch()}
        />
      ) : projectsQuery.data?.data.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="size-6" />}
          title="No projects yet"
          description="Create your first project to start grouping repositories."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" /> New project
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(projectsQuery.data?.data ?? []).map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      <ProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link to="/projects/$projectId" params={{ projectId: project.id }} className="block">
      <Card className="transition-colors hover:bg-accent/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <EntityDot color={project.color ?? "var(--muted-foreground)"} />
            <span className="truncate">{project.name}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          {project.description ? (
            <p className="line-clamp-2">{project.description}</p>
          ) : (
            <p className="italic">No description</p>
          )}
          <p className="mt-2">
            {project.repositoryIds.length}{" "}
            {project.repositoryIds.length === 1 ? "repository" : "repositories"}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
