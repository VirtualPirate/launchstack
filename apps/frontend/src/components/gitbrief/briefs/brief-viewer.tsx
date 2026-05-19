import { useState } from "react";
import { ChevronDown, Download, Pencil, Send, Share2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { DemoBrief } from "@/lib/demo-data";
import { getDeveloperById } from "@/lib/demo-selectors";
import { cn } from "@/lib/utils";
import { SectionLabel } from "@/components/gitbrief/shared/section-label";
import { ScopeLabel } from "./scope-label";

const COLLAPSIBLE_HEADINGS = new Set(["Team breakdown"]);
const HIDDEN_HEADINGS = new Set(["Feature progress"]);

const WORK_TYPE_COLOR: Record<string, string> = {
  feature: "var(--gb-chart-feature)",
  optimization: "var(--gb-chart-optimization)",
  refactor: "var(--gb-chart-refactor)",
  bug: "var(--gb-chart-bug)",
};

const WORK_TYPE_LABEL: Record<string, string> = {
  feature: "new features",
  optimization: "optimization",
  refactor: "refactoring",
  bug: "bug fixes",
};

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <b key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</b>
      : <span key={i}>{part}</span>,
  );
}

function TeamBreakdownBlock({ brief }: { brief: DemoBrief }) {
  if (brief.perDevDistribution.length === 0) {
    return <p className="text-sm text-muted-foreground">No per-developer breakdown for this period.</p>;
  }
  return (
    <div className="space-y-2">
      {brief.perDevDistribution.map((row) => {
        const dev = getDeveloperById(row.devId);
        if (!dev) return null;
        const segments = (["feature", "optimization", "refactor", "bug"] as const).map((t) => ({
          type: t,
          value: row.distribution[t],
        }));
        return (
          <div key={row.devId} className="flex items-center gap-3 py-2 border-t first:border-t-0">
            <Avatar className="size-6 shrink-0">
              <AvatarFallback className="text-[10px]" style={{ background: dev.avatarColor }}>
                {dev.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-[80px] text-sm font-medium">{dev.name.split(" ")[0]}</div>
            <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-muted flex">
              {segments.map((seg) => (
                <div key={seg.type} style={{ width: `${seg.value}%`, background: WORK_TYPE_COLOR[seg.type] }} />
              ))}
            </div>
            <div className="min-w-[120px] text-right text-xs text-muted-foreground">
              {row.distribution[row.dominant]}% {WORK_TYPE_LABEL[row.dominant]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CollapsibleSection({
  heading,
  paragraphs,
  brief,
}: {
  heading: string;
  paragraphs: string[];
  brief: DemoBrief;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mb-3 overflow-hidden rounded-lg border bg-background/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <SectionLabel>{heading}</SectionLabel>
          {!open ? (
            <span className="text-xs text-muted-foreground">
              {brief.perDevDistribution.length} contributors
            </span>
          ) : null}
        </div>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="space-y-3 border-t px-4 py-4">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-[14px] leading-relaxed text-foreground/90">
              {renderInline(p)}
            </p>
          ))}
          {heading === "Team breakdown" ? <TeamBreakdownBlock brief={brief} /> : null}
        </div>
      ) : null}
    </section>
  );
}

export function BriefViewer({ brief }: { brief: DemoBrief }) {
  const periodLabel = (() => {
    const s = new Date(brief.periodStart);
    const e = new Date(brief.periodEnd);
    return `${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${e.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  })();

  return (
    <article className="rounded-xl border bg-card p-7">
      <header className="flex items-start justify-between border-b pb-5 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-gb-chart-accent" />
            <ScopeLabel scope={brief.scope} />
          </div>
          <h1 className="mt-2.5 text-2xl font-semibold tracking-tight">{brief.tagline}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {periodLabel} · {brief.contributorCount} contributors · {brief.commitCount} commits
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Button variant="outline" size="sm"><Share2 className="size-3.5" /> Share</Button>
          <Button size="sm"><Send className="size-3.5" /> Send to Slack</Button>
          <Button variant="outline" size="icon" disabled className="size-8"><Download className="size-3.5" /></Button>
          <Button variant="outline" size="icon" className="size-8"><Pencil className="size-3.5" /></Button>
        </div>
      </header>

      {brief.sections.filter((s) => !HIDDEN_HEADINGS.has(s.heading)).map((section, sIdx) => {
        if (COLLAPSIBLE_HEADINGS.has(section.heading)) {
          return (
            <CollapsibleSection
              key={sIdx}
              heading={section.heading}
              paragraphs={section.paragraphs}
              brief={brief}
            />
          );
        }
        return (
          <section key={sIdx} className="mb-7">
            <SectionLabel className="mb-3">{section.heading}</SectionLabel>
            {section.paragraphs.map((p, i) => (
              <p key={i} className="mb-3 text-[14px] leading-relaxed text-foreground/90">
                {renderInline(p)}
              </p>
            ))}
          </section>
        );
      })}

      <footer className="mt-8 flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
        <span>Generated on {new Date(brief.generatedAt).toLocaleString()}</span>
        <span>Was this useful? 👍 👎</span>
      </footer>
    </article>
  );
}
