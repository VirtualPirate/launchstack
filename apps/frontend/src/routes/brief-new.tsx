import { PageHeader } from "@/components/gitbrief/shared/page-header";
import { BriefWizard } from "@/components/gitbrief/wizard/brief-wizard";

export function BriefNewPage() {
  return (
    <>
      <PageHeader
        title="New Brief"
        description="Configure scope, cadence, and delivery for an automated brief."
      />
      <BriefWizard />
    </>
  );
}
