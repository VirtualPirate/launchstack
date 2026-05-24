import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/gitbrief/shared/page-header";
import { TeamsTable } from "@/components/gitbrief/tables/teams-table";
import { NewTeamDialog } from "@/components/gitbrief/new-team/team-dialog";

export function TeamsPage() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Teams"
        description="Groups of developers that you want to track and brief together."
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-3.5" /> New team
          </Button>
        }
      />
      <TeamsTable />
      <NewTeamDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
