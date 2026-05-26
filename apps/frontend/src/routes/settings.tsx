import { PageHeader } from "@/components/gitbrief/shared/page-header";

export function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your account and application preferences."
      />
      <div className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
        Profile, preferences, and security controls will appear here.
      </div>
    </>
  );
}
