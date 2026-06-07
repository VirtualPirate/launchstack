import { useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, GitBranch, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { ProjectDialog } from "@/components/gitbrief/new-project/project-dialog";
import { RepositoryPicker } from "@/components/gitbrief/new-project/repository-picker";
import { ScopeLabel } from "@/components/gitbrief/briefs/scope-label";
import { StatusBadge } from "@/components/gitbrief/briefs/status-badge";
import {
  useDeleteProject,
  useGetProject,
} from "@/hooks/api/use-projects";
import { useGithubInstallations } from "@/hooks/api/use-github-integrations";
import { useGetBriefsFirstPage } from "@/hooks/api/use-briefs";

export function ProjectDetailPage() {
  const params = useParams({ from: "/projects/$projectId" as never }) as {
    projectId: string;
  };
  const navigate = useNavigate();

  const projectQuery = useGetProject(params.projectId);
  const installationsQuery = useGithubInstallations();
  const briefsQuery = useGetBriefsFirstPage({
    scopeType: "project",
    scopeProjectId: params.projectId,
    limit: 10,
  });

  const deleteMutation = useDeleteProject();
  const [editOpen, setEditOpen] = useState(false);
  const [repoPickerOpen, setRepoPickerOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  if (projectQuery.isLoading) {
    return (
      <>
        <PageHeader title="…" />
        <SkeletonList rows={3} rowHeight={80} />
      </>
    );
  }
  if (projectQuery.isError || !projectQuery.data?.data) {
    return (
      <>
        <PageHeader title="Project" />
        <ErrorState
          message={extractErrorMessage(projectQuery.error)}
          onRetry={() => projectQuery.refetch()}
        />
      </>
    );
  }

  const project = projectQuery.data.data;

  const allRepos = (installationsQuery.data?.data ?? []).flatMap((i) => i.repositories);
  const linkedRepos = project.repositoryIds
    .map((id) => {
      const repo = allRepos.find((r) => r.id === id);
      return repo
        ? { id: repo.id, name: repo.fullName ?? repo.name }
        : { id, name: "(unavailable)" };
    });

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(project.id);
      toast.success("Project deleted");
      await navigate({ to: "/projects" });
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  return (
    <>
      <div className="mb-3">
        <Link
          to="/projects"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" /> Back to projects
        </Link>
      </div>

      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <EntityDot color={project.color ?? "var(--muted-foreground)"} />
            {project.name}
          </span>
        }
        description={project.description ?? undefined}
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
          <SectionLabel>Linked repositories</SectionLabel>
          <Button size="sm" variant="outline" onClick={() => setRepoPickerOpen(true)}>
            Manage repositories
          </Button>
        </div>
        {linkedRepos.length === 0 ? (
          <EmptyState
            icon={<GitBranch className="size-5" />}
            title="No repositories linked"
            description="Link at least one repository so briefs have commit data."
            action={
              <Button size="sm" onClick={() => setRepoPickerOpen(true)}>
                Manage repositories
              </Button>
            }
          />
        ) : (
          <Card>
            <CardContent className="p-0 divide-y">
              {linkedRepos.map((r) => (
                <div key={r.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                  <GitBranch className="size-3.5 text-muted-foreground" />
                  <span>{r.name}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      <section>
        <SectionLabel className="mb-3">Recent briefs for this project</SectionLabel>
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
          <EmptyState title="No briefs for this project yet" />
        )}
      </section>

      <ProjectDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
      />
      <RepositoryPicker
        open={repoPickerOpen}
        onOpenChange={setRepoPickerOpen}
        project={project}
      />

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              Existing briefs for this project will keep rendering but lose their scope label.
              This action can't be undone.
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
