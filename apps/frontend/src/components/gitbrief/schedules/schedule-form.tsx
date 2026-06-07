import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import type {
  BriefScheduleResponse,
  CadenceInput,
  DeliveryInput,
  ScopeInput,
} from "@launchstack/api-interfaces";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionLabel } from "@/components/gitbrief/shared/section-label";
import {
  extractErrorMessage,
} from "@/components/gitbrief/shared/error-state";
import { ScopePicker, deriveScopeName } from "./scope-picker";
import { CadenceFields } from "./cadence-fields";
import { DeliveryFields } from "./delivery-fields";
import {
  useCreateBriefSchedule,
  useUpdateBriefSchedule,
} from "@/hooks/api/use-brief-schedules";
import { useGetProjects } from "@/hooks/api/use-projects";
import { useGetTeams } from "@/hooks/api/use-teams";
import { useGetCollaborators } from "@/hooks/api/use-collaborators";
import { useGithubInstallations } from "@/hooks/api/use-github-integrations";

function defaultTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  } catch {
    return "UTC";
  }
}

function scopeFromExisting(existing: BriefScheduleResponse): ScopeInput {
  return existing.scope as ScopeInput;
}

function cadenceFromExisting(existing: BriefScheduleResponse): CadenceInput {
  if (existing.cadence.type === "daily")
    return { type: "daily", time: existing.cadence.time.slice(0, 5) };
  if (existing.cadence.type === "weekly")
    return {
      type: "weekly",
      time: existing.cadence.time.slice(0, 5),
      dayOfWeek: existing.cadence.dayOfWeek,
    };
  return {
    type: "monthly",
    time: existing.cadence.time.slice(0, 5),
    dayOfMonth: existing.cadence.dayOfMonth,
  };
}

function deliveryFromExisting(existing: BriefScheduleResponse): DeliveryInput {
  return {
    emails: existing.delivery.emails,
    slackChannelId: existing.delivery.slackChannelId ?? undefined,
  };
}

export function ScheduleForm({
  existing,
}: {
  existing?: BriefScheduleResponse;
}) {
  const navigate = useNavigate();
  const isEdit = !!existing;

  const projectsQuery = useGetProjects();
  const teamsQuery = useGetTeams();
  const collaboratorsQuery = useGetCollaborators();
  const installationsQuery = useGithubInstallations();

  const [scope, setScope] = useState<ScopeInput | null>(
    existing ? scopeFromExisting(existing) : null,
  );
  const [cadence, setCadence] = useState<CadenceInput>(
    existing
      ? cadenceFromExisting(existing)
      : { type: "weekly", time: "09:00", dayOfWeek: 1 },
  );
  const [timezone, setTimezone] = useState<string>(
    existing?.timezone ?? defaultTz(),
  );
  const [delivery, setDelivery] = useState<DeliveryInput>(
    existing ? deliveryFromExisting(existing) : { emails: [] },
  );
  const [name, setName] = useState(existing?.name ?? "");
  const [nameDirty, setNameDirty] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createMutation = useCreateBriefSchedule();
  const updateMutation = useUpdateBriefSchedule(existing?.id ?? "");
  const submitting = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (existing || scope) return;
    const firstProjectId = projectsQuery.data?.data[0]?.id;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (firstProjectId) setScope({ type: "project", projectId: firstProjectId });
  }, [existing, scope, projectsQuery.data]);

  useEffect(() => {
    if (nameDirty) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(
      deriveScopeName(
        scope,
        projectsQuery.data?.data ?? [],
        teamsQuery.data?.data ?? [],
        (collaboratorsQuery.data?.data ?? []).map((c) => ({ id: c.id, login: c.login })),
        (installationsQuery.data?.data ?? []).flatMap((i) =>
          i.repositories.map((r) => ({ id: r.id, fullName: r.fullName })),
        ),
        cadence.type,
      ),
    );
  }, [
    nameDirty,
    scope,
    cadence.type,
    projectsQuery.data,
    teamsQuery.data,
    collaboratorsQuery.data,
    installationsQuery.data,
  ]);

  const slackAvailable = (installationsQuery.data?.data ?? []).length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!scope) {
      setSubmitError("Pick a scope before saving.");
      return;
    }
    const payload = {
      name: name.trim() || "New brief",
      cadence,
      timezone,
      scope,
      delivery: {
        emails: delivery.emails ?? [],
        slackChannelId: delivery.slackChannelId,
      },
    };
    try {
      if (isEdit && existing) {
        await updateMutation.mutateAsync(payload);
        toast.success("Schedule updated");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Schedule created");
        await navigate({ to: "/schedules" });
      }
    } catch (err) {
      setSubmitError(extractErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section>
        <SectionLabel className="mb-3">Scope</SectionLabel>
        <ScopePicker value={scope} onChange={setScope} />
        <div className="mt-4">
          <Label htmlFor="schedule-name" className="text-xs">Schedule name</Label>
          <Input
            id="schedule-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameDirty(true);
            }}
            maxLength={200}
            placeholder="Auto-derived from scope"
          />
        </div>
      </section>

      <section>
        <SectionLabel className="mb-3">Cadence</SectionLabel>
        <CadenceFields
          cadence={cadence}
          timezone={timezone}
          onCadenceChange={setCadence}
          onTimezoneChange={setTimezone}
        />
      </section>

      <section>
        <SectionLabel className="mb-3">Delivery</SectionLabel>
        <DeliveryFields
          delivery={delivery}
          onChange={setDelivery}
          slackAvailable={slackAvailable}
        />
      </section>

      {submitError ? (
        <p className="text-xs text-destructive">{submitError}</p>
      ) : null}

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="ghost" onClick={() => navigate({ to: "/schedules" })}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !scope}>
          {isEdit ? "Save changes" : "Create schedule"}
        </Button>
      </div>
    </form>
  );
}
