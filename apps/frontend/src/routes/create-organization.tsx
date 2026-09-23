import { Rocket } from "lucide-react";
import { CreateOrganizationForm } from "@/components/organization/create-organization-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function CreateOrganizationPage() {
  return (
    <div className="mx-auto w-full max-w-md py-10">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Rocket className="size-6 text-primary" />
          </div>
          <CardTitle>Create organization</CardTitle>
          <CardDescription>
            You&apos;ll be the owner of this organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateOrganizationForm />
        </CardContent>
      </Card>
    </div>
  );
}
