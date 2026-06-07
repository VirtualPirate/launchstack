import type { CadenceInput } from "@launchstack/api-interfaces";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export function CadenceFields({
  cadence,
  timezone,
  onCadenceChange,
  onTimezoneChange,
}: {
  cadence: CadenceInput;
  timezone: string;
  onCadenceChange: (next: CadenceInput) => void;
  onTimezoneChange: (next: string) => void;
}) {
  const timezones = (() => {
    type SupportedValues = (kind: "timeZone") => string[];
    const intlWithSupported = Intl as unknown as { supportedValuesOf?: SupportedValues };
    return intlWithSupported.supportedValuesOf?.("timeZone") ?? ["UTC"];
  })();

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Cadence</Label>
        <RadioGroup
          value={cadence.type}
          onValueChange={(v) => {
            const time = cadence.time;
            if (v === "daily") onCadenceChange({ type: "daily", time });
            else if (v === "weekly")
              onCadenceChange({ type: "weekly", time, dayOfWeek: 1 });
            else onCadenceChange({ type: "monthly", time, dayOfMonth: 1 });
          }}
          className="mt-2 grid grid-cols-3 gap-2"
        >
          {(["daily", "weekly", "monthly"] as const).map((t) => (
            <Label
              key={t}
              className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm capitalize"
            >
              <RadioGroupItem value={t} />
              {t}
            </Label>
          ))}
        </RadioGroup>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="cadence-time" className="text-xs">Time</Label>
          <Input
            id="cadence-time"
            type="time"
            value={cadence.time}
            onChange={(e) =>
              onCadenceChange({ ...cadence, time: e.target.value } as CadenceInput)
            }
          />
        </div>
        <div>
          <Label htmlFor="cadence-tz" className="text-xs">Timezone</Label>
          <Select value={timezone} onValueChange={onTimezoneChange}>
            <SelectTrigger id="cadence-tz">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {timezones.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {cadence.type === "weekly" ? (
        <div>
          <Label className="text-xs">Day of week</Label>
          <Select
            value={String(cadence.dayOfWeek)}
            onValueChange={(v) =>
              onCadenceChange({ ...cadence, dayOfWeek: Number(v) })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS_OF_WEEK.map((d) => (
                <SelectItem key={d.value} value={String(d.value)}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {cadence.type === "monthly" ? (
        <div>
          <Label className="text-xs">Day of month</Label>
          <Select
            value={String(cadence.dayOfMonth)}
            onValueChange={(v) =>
              onCadenceChange({ ...cadence, dayOfMonth: Number(v) })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Days beyond the month length are clamped to the last day of that month.
          </p>
        </div>
      ) : null}
    </div>
  );
}
