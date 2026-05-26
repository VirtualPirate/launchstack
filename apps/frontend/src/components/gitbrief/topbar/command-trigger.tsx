import { Search } from "lucide-react";

export function CommandTrigger() {
  return (
    <button
      type="button"
      className="inline-flex h-8 items-center gap-2 rounded-md border bg-card px-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors min-w-[220px]"
      onClick={() => {}}
    >
      <Search className="size-3.5" />
      <span>Search projects, briefs, repos…</span>
      <kbd className="ml-auto rounded border bg-background px-1 py-0.5 text-[10px] font-mono">⌘K</kbd>
    </button>
  );
}
