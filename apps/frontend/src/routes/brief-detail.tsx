import { useParams } from "@tanstack/react-router";
import { EmptyState } from "@/components/gitbrief/shared/empty-state";
import { BriefViewer } from "@/components/gitbrief/briefs/brief-viewer";
import { useDemoState } from "@/stores/demo-state";

export function BriefDetailPage() {
  const { briefId } = useParams({ strict: false }) as { briefId: string };
  const brief = useDemoState((s) => s.briefs.find((b) => b.id === briefId));
  if (!brief) return <EmptyState title="Brief not found" />;
  return <BriefViewer brief={brief} />;
}
