import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/gitbrief/shared/page-header";
import { ProjectsTable } from "@/components/gitbrief/tables/projects-table";
import { NewProjectDialog } from "@/components/gitbrief/new-project/project-dialog";

export function ProjectsPage() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Projects"
        description="Virtual groupings of repositories — health, features, and briefs at a glance."
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-3.5" /> New project
          </Button>
        }
      />
      <ProjectsTable />
      <NewProjectDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
