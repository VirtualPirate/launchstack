import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl pt-10">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            Manage your account and application preferences.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Add profile, preferences, and security controls in this section.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
