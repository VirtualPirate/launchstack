import { PageHeader } from "@/components/gitbrief/shared/page-header";
import { PeopleTable } from "@/components/gitbrief/tables/people-table";

export function PeoplePage() {
  return (
    <>
      <PageHeader
        title="People"
        description="Contributors across your organization."
      />
      <PeopleTable />
    </>
  );
}
