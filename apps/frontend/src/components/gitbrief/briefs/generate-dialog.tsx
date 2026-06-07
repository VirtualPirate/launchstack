import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import type { DeliveryInput, ScopeInput } from "@launchstack/api-interfaces";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SectionLabel } from "@/components/gitbrief/shared/section-label";
import {
  extractErrorMessage,
} from "@/components/gitbrief/shared/error-state";
import { ScopePicker } from "@/components/gitbrief/schedules/scope-picker";
import { DeliveryFields } from "@/components/gitbrief/schedules/delivery-fields";
import { useGenerateBrief } from "@/hooks/api/use-briefs";
import { useGithubInstallations } from "@/hooks/api/use-github-integrations";
import { useGetProjects } from "@/hooks/api/use-projects";

function toLocalIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function GenerateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const projectsQuery = useGetProjects();
  const installationsQuery = useGithubInstallations();
  const generateMutation = useGenerateBrief();

  const [scope, setScope] = useState<ScopeInput | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [periodStart, setPeriodStart] = useState<string>("");
  const [periodEnd, setPeriodEnd] = useState<string>("");
  const [delivery, setDelivery] = useState<DeliveryInput>({ emails: [] });
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAdvanced(false);
    setSubmitError(null);
    setDelivery({ emails: [] });
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    setPeriodStart(toLocalIso(sevenDaysAgo));
    setPeriodEnd(toLocalIso(now));
    if (!scope) {
      const firstProjectId = projectsQuery.data?.data[0]?.id;
      if (firstProjectId) setScope({ type: "project", projectId: firstProjectId });
    }
  }, [open, projectsQuery.data, scope]);

  const slackAvailable = (installationsQuery.data?.data ?? []).length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!scope) {
      setSubmitError("Pick a scope before generating.");
      return;
    }
    try {
      const payload = {
        scope,
        delivery,
        ...(advanced
          ? {
              periodStart: new Date(periodStart).toISOString(),
              periodEnd: new Date(periodEnd).toISOString(),
            }
          : {}),
      };
      const res = await generateMutation.mutateAsync(payload);
      toast.success("Brief generation enqueued");
      onOpenChange(false);
      await navigate({
        to: "/briefs/$briefId",
        params: { briefId: res.data.briefId },
      });
    } catch (err) {
      setSubmitError(extractErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Generate brief now</DialogTitle>
            <DialogDescription>
              Pick a scope, optionally a custom period, and delivery channels.
            </DialogDescription>
          </DialogHeader>

          <section>
            <SectionLabel className="mb-2">Scope</SectionLabel>
            <ScopePicker value={scope} onChange={setScope} />
          </section>

          <section>
            <div className="flex items-center justify-between">
              <SectionLabel>Period</SectionLabel>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                Custom range
                <Switch checked={advanced} onCheckedChange={setAdvanced} />
              </div>
            </div>
            {advanced ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="period-start" className="text-xs">Start</Label>
                  <Input
                    id="period-start"
                    type="datetime-local"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="period-end" className="text-xs">End</Label>
                  <Input
                    id="period-end"
                    type="datetime-local"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Last 7 days (default).
              </p>
            )}
          </section>

          <section>
            <SectionLabel className="mb-2">Delivery</SectionLabel>
            <DeliveryFields
              delivery={delivery}
              onChange={setDelivery}
              slackAvailable={slackAvailable}
            />
          </section>

          {submitError ? <p className="text-xs text-destructive">{submitError}</p> : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={generateMutation.isPending || !scope}>
              Generate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
