import { Rocket } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function HomePage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pt-10">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Rocket className="size-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome to LaunchStack</CardTitle>
          <CardDescription>
            You are signed in. Navigate to dashboard or settings to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-muted-foreground">
            Protected routes are active for all app pages.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
