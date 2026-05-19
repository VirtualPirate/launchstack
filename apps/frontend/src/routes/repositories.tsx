import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/gitbrief/shared/page-header";
import { ReposTable } from "@/components/gitbrief/tables/repos-table";

export function RepositoriesPage() {
  return (
    <>
      <PageHeader
        title="Repositories"
        description="GitHub repositories connected to this workspace."
        actions={<Button asChild size="sm"><Link to="/integrations/github">+ Connect new repo</Link></Button>}
      />
      <ReposTable />
    </>
  );
}
