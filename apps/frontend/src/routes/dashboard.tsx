import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function DashboardPage() {
  return (
    <div className="mx-auto max-w-3xl pt-10">
      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>
            This route is protected and only visible to authenticated users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Add your dashboard widgets, charts, and metrics here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
