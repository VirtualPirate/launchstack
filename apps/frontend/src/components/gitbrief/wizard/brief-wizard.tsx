import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { demoPeople, demoProjects, demoTeams, type BriefScope, type Cadence, type DeliveryChannel, type DemoSchedule } from "@/lib/demo-data";
import { useDemoState } from "@/stores/demo-state";
import { WizardStepper } from "./wizard-stepper";
import { WizardPreview } from "./wizard-preview";

const FAKE_SLACK_CHANNELS = ["#product-updates", "#engineering", "#platform-standup", "#leadership"];

export function BriefWizard() {
  const navigate = useNavigate();
  const addSchedule = useDemoState((s) => s.addSchedule);

  const [step, setStep] = useState(0);
  const [scopeType, setScopeType] = useState<"repo" | "project" | "team" | "developer">("project");
  const [scopeId, setScopeId] = useState<string>(demoProjects[0]!.id);
  const [includeProgress, setIncludeProgress] = useState(true);
  const [includeDistribution, setIncludeDistribution] = useState(true);
  const [cadenceType, setCadenceType] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [cadenceDay, setCadenceDay] = useState<number>(5);
  const [cadenceTime, setCadenceTime] = useState("16:00");
  const [cadenceDayOfMonth, setCadenceDayOfMonth] = useState<number>(1);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState("");
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [slackChannel, setSlackChannel] = useState(FAKE_SLACK_CHANNELS[0]!);

  const buildScope = (): BriefScope => {
    if (scopeType === "project") return { type: "project", projectId: scopeId };
    if (scopeType === "team")    return { type: "team", teamId: scopeId };
    if (scopeType === "developer") return { type: "developer", devId: scopeId };
    return { type: "repo", repoId: scopeId };
  };

  const buildCadence = (): Cadence => {
    if (cadenceType === "daily") return { type: "daily", time: cadenceTime };
    if (cadenceType === "weekly") return { type: "weekly", day: cadenceDay, time: cadenceTime };
    return { type: "monthly", dayOfMonth: cadenceDayOfMonth, time: cadenceTime };
  };

  const buildDelivery = (): DeliveryChannel[] => {
    const out: DeliveryChannel[] = [{ type: "dashboard" }];
    if (emailEnabled && emailRecipients.trim()) {
      out.push({ type: "email", recipients: emailRecipients.split(",").map((r) => r.trim()).filter(Boolean) });
    }
    if (slackEnabled) out.push({ type: "slack", channel: slackChannel });
    return out;
  };

  const onSave = () => {
    const scope = buildScope();
    const cadence = buildCadence();
    const delivery = buildDelivery();
    const id = `sched_${Date.now()}`;
    const newSched: DemoSchedule = {
      id,
      name: scopeType === "project" ? `${demoProjects.find((p) => p.id === scopeId)?.name} Brief` : "New Brief",
      scope,
      cadence,
      delivery,
      paused: false,
      nextRunAt: new Date(Date.now() + 86400000).toISOString(),
      lastSentAt: null,
      options: { includeFeatureProgress: includeProgress, includeWorkDistribution: includeDistribution },
    };
    addSchedule(newSched);
    navigate({ to: "/briefs" });
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <WizardStepper
          steps={[{ title: "Scope" }, { title: "Cadence" }, { title: "Delivery" }]}
          current={step}
        />

        {step === 0 ? (
          <div className="space-y-5 rounded-lg border bg-card p-5">
            <div>
              <Label className="text-sm">What is this brief about?</Label>
              <RadioGroup value={scopeType} onValueChange={(v) => {
                setScopeType(v as typeof scopeType);
                if (v === "project") setScopeId(demoProjects[0]!.id);
                if (v === "team")    setScopeId(demoTeams[0]!.id);
                if (v === "developer") setScopeId(demoPeople[0]!.id);
              }} className="mt-2 grid grid-cols-4 gap-2">
                {[
                  { v: "project", l: "Project" },
                  { v: "team", l: "Team" },
                  { v: "developer", l: "Developer" },
                  { v: "repo", l: "Repository" },
                ].map((o) => (
                  <label key={o.v} className="flex items-center gap-2 rounded border bg-background px-3 py-2 cursor-pointer text-sm has-[:checked]:border-foreground">
                    <RadioGroupItem value={o.v} /> {o.l}
                  </label>
                ))}
              </RadioGroup>
            </div>
            <div>
              <Label className="text-sm">Pick one</Label>
              <Select value={scopeId} onValueChange={setScopeId}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {scopeType === "project" && demoProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  {scopeType === "team"    && demoTeams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  {scopeType === "developer" && demoPeople.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  {scopeType === "repo"    && demoProjects.flatMap((p) => p.repoIds).map((id) => <SelectItem key={id} value={id}>{id}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={includeProgress} onCheckedChange={setIncludeProgress} />
                Include feature progress section
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={includeDistribution} onCheckedChange={setIncludeDistribution} />
                Include work distribution charts
              </label>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-5 rounded-lg border bg-card p-5">
            <div>
              <Label className="text-sm">How often?</Label>
              <RadioGroup value={cadenceType} onValueChange={(v) => setCadenceType(v as typeof cadenceType)} className="mt-2 grid grid-cols-3 gap-2">
                {[{ v: "daily", l: "Daily" }, { v: "weekly", l: "Weekly" }, { v: "monthly", l: "Monthly" }].map((o) => (
                  <label key={o.v} className="flex items-center gap-2 rounded border bg-background px-3 py-2 cursor-pointer text-sm has-[:checked]:border-foreground">
                    <RadioGroupItem value={o.v} /> {o.l}
                  </label>
                ))}
              </RadioGroup>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {cadenceType === "weekly" ? (
                <div>
                  <Label className="text-sm">Day of week</Label>
                  <Select value={String(cadenceDay)} onValueChange={(v) => setCadenceDay(Number(v))}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((d, i) => (
                        <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {cadenceType === "monthly" ? (
                <div>
                  <Label className="text-sm">Day of month</Label>
                  <Select value={String(cadenceDayOfMonth)} onValueChange={(v) => setCadenceDayOfMonth(Number(v))}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                        <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div>
                <Label className="text-sm">Time</Label>
                <Input className="mt-1.5" type="time" value={cadenceTime} onChange={(e) => setCadenceTime(e.target.value)} />
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5 rounded-lg border bg-card p-5">
            <Label className="text-sm">Where should this brief be delivered?</Label>
            <div className="space-y-3">
              <label className="flex items-center justify-between rounded border bg-background px-3 py-2 text-sm">
                <span>Dashboard (always on)</span>
                <Switch checked disabled />
              </label>
              <div>
                <label className="flex items-center justify-between rounded border bg-background px-3 py-2 text-sm">
                  <span>Email</span>
                  <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
                </label>
                {emailEnabled ? (
                  <Input
                    className="mt-2"
                    placeholder="Recipients (comma-separated emails)"
                    value={emailRecipients}
                    onChange={(e) => setEmailRecipients(e.target.value)}
                  />
                ) : null}
              </div>
              <div>
                <label className="flex items-center justify-between rounded border bg-background px-3 py-2 text-sm">
                  <span>Slack</span>
                  <Switch checked={slackEnabled} onCheckedChange={setSlackEnabled} />
                </label>
                {slackEnabled ? (
                  <Select value={slackChannel} onValueChange={setSlackChannel}>
                    <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FAKE_SLACK_CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>← Back</Button>
          <div className="flex gap-2">
            <Button variant="outline">Generate sample preview</Button>
            {step < 2 ? (
              <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
            ) : (
              <Button onClick={onSave}>Save brief</Button>
            )}
          </div>
        </div>
      </div>

      <WizardPreview scope={buildScope()} cadence={buildCadence()} delivery={buildDelivery()} />
    </div>
  );
}
