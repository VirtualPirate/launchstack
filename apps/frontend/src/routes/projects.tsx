import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/gitbrief/shared/page-header";
import { ProjectsTable } from "@/components/gitbrief/tables/projects-table";

export function ProjectsPage() {
  return (
    <>
      <PageHeader
        title="Projects"
        description="Virtual groupings of repositories — health, features, and briefs at a glance."
        actions={<Button size="sm"><Plus className="size-3.5" /> New project</Button>}
      />
      <ProjectsTable />
    </>
  );
}
