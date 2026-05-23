import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SidebarScope = "projects" | "teams" | "people";

interface SidebarPrefsState {
  pinned: Record<SidebarScope, string[]>;
  collapsed: Record<SidebarScope, boolean>;
  togglePin: (scope: SidebarScope, id: string) => void;
  toggleCollapse: (scope: SidebarScope) => void;
  isPinned: (scope: SidebarScope, id: string) => boolean;
}

export const useSidebarPrefs = create<SidebarPrefsState>()(
  persist(
    (set, get) => ({
      pinned: { projects: [], teams: [], people: [] },
      collapsed: { projects: false, teams: false, people: false },
      togglePin: (scope, id) =>
        set((s) => {
          const list = s.pinned[scope];
          const next = list.includes(id)
            ? list.filter((x) => x !== id)
            : [...list, id];
          return { pinned: { ...s.pinned, [scope]: next } };
        }),
      toggleCollapse: (scope) =>
        set((s) => ({
          collapsed: { ...s.collapsed, [scope]: !s.collapsed[scope] },
        })),
      isPinned: (scope, id) => get().pinned[scope].includes(id),
    }),
    { name: "gitbrief-sidebar-prefs-v1" },
  ),
);
