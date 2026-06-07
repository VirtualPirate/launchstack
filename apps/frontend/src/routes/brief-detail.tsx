import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  ErrorState,
  extractErrorMessage,
} from "@/components/gitbrief/shared/error-state";
import { SkeletonList } from "@/components/gitbrief/shared/skeleton-list";
import { BriefViewer } from "@/components/gitbrief/briefs/brief-viewer";
import { useGenerateBrief, useGetBrief } from "@/hooks/api/use-briefs";

export function BriefDetailPage() {
  const { briefId } = useParams({ strict: false });
  const navigate = useNavigate();
  const briefQuery = useGetBrief(briefId);
  const generateMutation = useGenerateBrief();

  if (briefQuery.isLoading) {
    return (
      <>
        <BackLink />
        <SkeletonList rows={4} rowHeight={60} />
      </>
    );
  }
  if (briefQuery.isError || !briefQuery.data?.data) {
    return (
      <>
        <BackLink />
        <ErrorState
          message={extractErrorMessage(briefQuery.error)}
          onRetry={() => briefQuery.refetch()}
        />
      </>
    );
  }

  const brief = briefQuery.data.data;

  const handleRetry = async () => {
    if (!brief.scope) return;
    const scopeInput = (() => {
      const s = brief.scope;
      if (s.type === "project" && s.projectId)
        return { type: "project" as const, projectId: s.projectId };
      if (s.type === "team" && s.teamId)
        return { type: "team" as const, teamId: s.teamId };
      if (s.type === "collaborator" && s.collaboratorId)
        return {
          type: "collaborator" as const,
          collaboratorId: s.collaboratorId,
        };
      if (s.type === "repository" && s.repositoryId)
        return { type: "repository" as const, repositoryId: s.repositoryId };
      return null;
    })();
    if (!scopeInput) {
      toast.error("Can't retry — the brief's scope entity was deleted.");
      return;
    }
    try {
      const res = await generateMutation.mutateAsync({
        scope: scopeInput,
        periodStart: brief.periodStart,
        periodEnd: brief.periodEnd,
      });
      toast.success("Brief regeneration enqueued");
      await navigate({
        to: "/briefs/$briefId",
        params: { briefId: res.data.briefId },
      });
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  return (
    <>
      <BackLink />
      <BriefViewer brief={brief} onRetry={handleRetry} />
    </>
  );
}

function BackLink() {
  return (
    <div className="mb-3">
      <Link
        to="/briefs"
        search={{
          filterType: "all",
          from: "",
          to: "",
          repositoryId: "",
          excludeNoActivity: false,
          page: 0,
        }}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3" /> Back to briefs
      </Link>
    </div>
  );
}
