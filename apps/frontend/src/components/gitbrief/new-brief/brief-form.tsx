import { useImperativeHandle, useMemo, useState, type Ref } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SectionLabel } from "@/components/gitbrief/shared/section-label";
import { EntityDot } from "@/components/gitbrief/shared/entity-dot";
import { cn } from "@/lib/utils";
import {
  demoPeople,
  demoRepos,
  demoTeams,
  type BriefScope,
  type Cadence,
  type DeliveryChannel,
  type DemoSchedule,
} from "@/lib/demo-data";
import { useDemoState } from "@/stores/demo-state";

const FAKE_SLACK_CHANNELS = ["#product-updates", "#engineering", "#platform-standup", "#leadership"];

type ScopeType = "repo" | "project" | "team" | "developer";
type CadenceType = "daily" | "weekly" | "monthly";

function deriveName(scopeType: ScopeType, scopeId: string): string {
  if (scopeType === "project") {
    const p = useDemoState.getState().projects.find((x) => x.id === scopeId);
    return p ? `${p.name} Brief` : "New Brief";
  }
  if (scopeType === "team") {
    const t = demoTeams.find((x) => x.id === scopeId);
    return t ? `${t.name} Team Brief` : "New Brief";
  }
  if (scopeType === "developer") {
    const d = demoPeople.find((x) => x.id === scopeId);
    return d ? `${d.name} Brief` : "New Brief";
  }
  const r = demoRepos.find((x) => x.id === scopeId);
  return `${r ? r.name : scopeId} Brief`;
}

export type BriefFormHandle = { save: () => void };

export function BriefForm({ ref }: { ref?: Ref<BriefFormHandle> }) {
  const navigate = useNavigate();
  const addSchedule = useDemoState((s) => s.addSchedule);
  const projects = useDemoState((s) => s.projects);

  const [scopeType, setScopeType] = useState<ScopeType>("project");
  const [scopeId, setScopeId] = useState<string>(() => useDemoState.getState().projects[0]!.id);
  const [name, setName] = useState<string>(() => deriveName("project", useDemoState.getState().projects[0]!.id));
  const [nameDirty, setNameDirty] = useState(false);

const [cadenceType, setCadenceType] = useState<CadenceType>("weekly");
  const [cadenceDay, setCadenceDay] = useState<number>(5);
  const [cadenceTime, setCadenceTime] = useState("16:00");
  const [cadenceDayOfMonth, setCadenceDayOfMonth] = useState<number>(1);

  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState("");
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [slackChannel, setSlackChannel] = useState(FAKE_SLACK_CHANNELS[0]!);

  const entities = useMemo<{ id: string; name: string; color?: string }[]>(() => {
    if (scopeType === "project") return projects.map((p) => ({ id: p.id, name: p.name, color: p.color }));
    if (scopeType === "team")    return demoTeams.map((t) => ({ id: t.id, name: t.name, color: t.color }));
    if (scopeType === "developer") return demoPeople.map((d) => ({ id: d.id, name: d.name, color: d.avatarColor }));
    return demoRepos.map((r) => ({ id: r.id, name: r.name }));
  }, [scopeType, projects]);

  const updateScope = (nextType: ScopeType, nextId: string) => {
    setScopeType(nextType);
    setScopeId(nextId);
    if (!nameDirty) setName(deriveName(nextType, nextId));
  };

  const onScopeTypeChange = (v: string) => {
    const nextType = v as ScopeType;
    let nextId = scopeId;
    if (nextType === "project") nextId = projects[0]!.id;
    else if (nextType === "team") nextId = demoTeams[0]!.id;
    else if (nextType === "developer") nextId = demoPeople[0]!.id;
    else nextId = demoRepos[0]!.id;
    updateScope(nextType, nextId);
  };

  const onScopeIdChange = (v: string) => {
    updateScope(scopeType, v);
  };

  const onNameChange = (v: string) => {
    setName(v);
    if (!nameDirty) setNameDirty(true);
  };

  useImperativeHandle(ref, () => ({
    save: () => {
      const scope: BriefScope =
        scopeType === "project" ? { type: "project", projectId: scopeId } :
        scopeType === "team"    ? { type: "team", teamId: scopeId } :
        scopeType === "developer" ? { type: "developer", devId: scopeId } :
        { type: "repo", repoId: scopeId };

      const cadence: Cadence =
        cadenceType === "daily" ? { type: "daily", time: cadenceTime } :
        cadenceType === "weekly" ? { type: "weekly", day: cadenceDay, time: cadenceTime } :
        { type: "monthly", dayOfMonth: cadenceDayOfMonth, time: cadenceTime };

      const delivery: DeliveryChannel[] = [{ type: "dashboard" }];
      if (emailEnabled && emailRecipients.trim()) {
        delivery.push({
          type: "email",
          recipients: emailRecipients.split(",").map((r) => r.trim()).filter(Boolean),
        });
      }
      if (slackEnabled) delivery.push({ type: "slack", channel: slackChannel });

      const newSched: DemoSchedule = {
        id: `sched_${Date.now()}`,
        name: name.trim() || deriveName(scopeType, scopeId),
        scope,
        cadence,
        delivery,
        paused: false,
        nextRunAt: new Date(Date.now() + 86400000).toISOString(),
        lastSentAt: null,
        options: {
          includeFeatureProgress: true,
          includeWorkDistribution: true,
        },
      };
      addSchedule(newSched);
      navigate({ to: "/briefs" });
    },
  }), [
    name, scopeType, scopeId,
    cadenceType, cadenceDay, cadenceTime, cadenceDayOfMonth,
    emailEnabled, emailRecipients, slackEnabled, slackChannel,
    addSchedule, navigate,
  ]);

  return (
    <div className="rounded-lg border bg-card p-5 space-y-5">
      <div>
        <label htmlFor="brief-name" className="text-sm font-medium">Name</label>
        <Input
          id="brief-name"
          className="mt-1.5"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>

      <div className="border-t pt-5">
        <SectionLabel>Scope</SectionLabel>
        <div className="mt-3 space-y-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1.5">What is this brief about?</div>
            <div className="inline-flex gap-1 rounded-md border bg-background p-1">
              {[
                { v: "project", l: "Project" },
                { v: "team", l: "Team" },
                { v: "developer", l: "Developer" },
                { v: "repo", l: "Repository" },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => onScopeTypeChange(o.v)}
                  className={cn(
                    "rounded px-3 py-1 text-xs transition-colors",
                    scopeType === o.v
                      ? "bg-card text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-1.5">
              {scopeType === "project" ? "Pick a project" :
               scopeType === "team" ? "Pick a team" :
               scopeType === "developer" ? "Pick a developer" :
               "Pick a repository"}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {entities.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onScopeIdChange(e.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                    scopeId === e.id
                      ? "bg-accent text-accent-foreground border-transparent"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {e.color ? <EntityDot color={e.color} /> : null}
                  {e.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t pt-5">
        <SectionLabel>Cadence</SectionLabel>
        <div className="mt-3 space-y-4">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs text-muted-foreground mb-1.5">How often?</div>
              <div className="inline-flex gap-1 rounded-md border bg-background p-1">
                {[
                  { v: "daily", l: "Daily" },
                  { v: "weekly", l: "Weekly" },
                  { v: "monthly", l: "Monthly" },
                ].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setCadenceType(o.v as CadenceType)}
                    className={cn(
                      "rounded px-3 py-1 text-xs transition-colors",
                      cadenceType === o.v
                        ? "bg-card text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1.5">Time</div>
              <Input
                type="time"
                className="w-27.5"
                value={cadenceTime}
                onChange={(e) => setCadenceTime(e.target.value)}
              />
            </div>
          </div>

          {cadenceType === "weekly" ? (
            <div>
              <div className="text-xs text-muted-foreground mb-1.5">Day of week</div>
              <div className="flex gap-1">
                {["S", "M", "T", "W", "T", "F", "S"].map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCadenceDay(i)}
                    className={cn(
                      "inline-flex h-8 w-8 items-center justify-center rounded border text-xs transition-colors",
                      cadenceDay === i
                        ? "bg-foreground text-background border-transparent"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {cadenceType === "monthly" ? (
            <div>
              <div className="text-xs text-muted-foreground mb-1.5">Day of month</div>
              <div className="grid grid-cols-7 gap-1 max-w-65">
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setCadenceDayOfMonth(d)}
                    className={cn(
                      "inline-flex h-8 items-center justify-center rounded border text-xs transition-colors",
                      cadenceDayOfMonth === d
                        ? "bg-foreground text-background border-transparent"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t pt-5">
        <SectionLabel>Delivery</SectionLabel>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between rounded border bg-background px-3 py-2 text-sm">
            <span className="inline-flex items-center gap-2">
              Dashboard
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                Always on
              </span>
            </span>
            <span className="text-xs text-muted-foreground">Required</span>
          </div>

          <div className="rounded border bg-background px-3 py-2">
            <label className="flex items-center justify-between text-sm">
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

          <div className="rounded border bg-background px-3 py-2">
            <label className="flex items-center justify-between text-sm">
              <span>Slack</span>
              <Switch checked={slackEnabled} onCheckedChange={setSlackEnabled} />
            </label>
            {slackEnabled ? (
              <select
                className="mt-2 w-full rounded border bg-background px-2 py-1.5 text-sm"
                value={slackChannel}
                onChange={(e) => setSlackChannel(e.target.value)}
              >
                {FAKE_SLACK_CHANNELS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
