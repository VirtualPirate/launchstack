import type { DeliveryInput } from "@launchstack/api-interfaces";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DeliveryFields({
  delivery,
  onChange,
  slackAvailable,
}: {
  delivery: DeliveryInput;
  onChange: (next: DeliveryInput) => void;
  slackAvailable: boolean;
}) {
  const emailsString = (delivery.emails ?? []).join(", ");

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="delivery-emails" className="text-xs">
          Email recipients
        </Label>
        <Input
          id="delivery-emails"
          placeholder="comma-separated, e.g. ada@example.com, grace@example.com"
          value={emailsString}
          onChange={(e) => {
            const next = e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            onChange({ ...delivery, emails: next });
          }}
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Leave blank for dashboard-only delivery.
        </p>
      </div>

      <div>
        <Label htmlFor="delivery-slack" className="text-xs">
          Slack channel ID
        </Label>
        <Input
          id="delivery-slack"
          placeholder="e.g. C0123ABCDEF"
          value={delivery.slackChannelId ?? ""}
          onChange={(e) =>
            onChange({ ...delivery, slackChannelId: e.target.value.trim() || undefined })
          }
          disabled={!slackAvailable}
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          {slackAvailable
            ? "Find the channel ID in your Slack integration."
            : "Connect Slack in Integrations to enable Slack delivery."}
        </p>
      </div>
    </div>
  );
}
