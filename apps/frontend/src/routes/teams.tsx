import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/gitbrief/shared/page-header";
import { TeamsTable } from "@/components/gitbrief/tables/teams-table";

export function TeamsPage() {
  return (
    <>
      <PageHeader
        title="Teams"
        description="Groups of developers that you want to track and brief together."
        actions={<Button size="sm"><Plus className="size-3.5" /> New team</Button>}
      />
      <TeamsTable />
    </>
  );
}
