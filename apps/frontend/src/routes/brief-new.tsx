import { useRef } from "react";
import { PageHeader } from "@/components/gitbrief/shared/page-header";
import { Button } from "@/components/ui/button";
import { BriefForm, type BriefFormHandle } from "@/components/gitbrief/new-brief/brief-form";

export function BriefNewPage() {
  const formRef = useRef<BriefFormHandle>(null);
  return (
    <>
      <PageHeader
        title="New Brief"
        description="Configure scope, cadence, and delivery for an automated brief."
        actions={
          <Button size="sm" onClick={() => formRef.current?.save()}>
            Save brief
          </Button>
        }
      />
      <BriefForm ref={formRef} />
    </>
  );
}
