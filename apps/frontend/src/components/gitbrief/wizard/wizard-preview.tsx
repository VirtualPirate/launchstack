import type { BriefScope, Cadence, DeliveryChannel } from "@/lib/demo-data";
import { SectionLabel } from "@/components/gitbrief/shared/section-label";
import { ScopeLabel } from "@/components/gitbrief/briefs/scope-label";

export function WizardPreview({
  scope,
  cadence,
  delivery,
}: {
  scope: BriefScope | null;
  cadence: Cadence | null;
  delivery: DeliveryChannel[];
}) {
  return (
    <aside className="sticky top-4 rounded-lg border bg-card p-4 text-sm">
      <SectionLabel>Preview</SectionLabel>
      <div className="mt-3 space-y-3">
        <div>
          <div className="text-xs text-muted-foreground">Scope</div>
          <div className="mt-0.5">{scope ? <ScopeLabel scope={scope} /> : <span className="text-muted-foreground">Not set</span>}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Cadence</div>
          <div className="mt-0.5">
            {!cadence ? <span className="text-muted-foreground">Not set</span>
            : cadence.type === "daily" ? `Daily at ${cadence.time}`
            : cadence.type === "weekly" ? `Weekly · ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][cadence.day]} ${cadence.time}`
            : `Monthly · day ${cadence.dayOfMonth} ${cadence.time}`}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Delivery</div>
          <div className="mt-0.5">
            {delivery.length === 0 ? <span className="text-muted-foreground">Dashboard only</span>
            : delivery.map((d, i) => (
              <span key={i} className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs mr-1 mb-1">
                {d.type === "dashboard" ? "Dashboard" : d.type === "email" ? `Email (${d.recipients.length})` : `Slack ${d.channel}`}
              </span>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
