import { create } from "zustand";
import {
  demoBriefs,
  demoProjects,
  demoSchedules,
  demoTeams,
  type DemoBrief,
  type DemoProject,
  type DemoSchedule,
  type DemoTeam,
} from "@/lib/demo-data";

interface DemoState {
  projects: DemoProject[];
  teams: DemoTeam[];
  schedules: DemoSchedule[];
  briefs: DemoBrief[];
  addProject: (p: DemoProject) => void;
  addTeam: (t: DemoTeam) => void;
  addSchedule: (s: DemoSchedule) => void;
  pauseSchedule: (id: string) => void;
  deleteSchedule: (id: string) => void;
  updateSchedule: (id: string, patch: Partial<DemoSchedule>) => void;
  addBrief: (b: DemoBrief) => void;
}

export const useDemoState = create<DemoState>((set) => ({
  projects: [...demoProjects],
  teams: [...demoTeams],
  schedules: [...demoSchedules],
  briefs: [...demoBriefs],
  addProject: (p) => set((state) => ({ projects: [p, ...state.projects] })),
  addTeam: (t) => set((state) => ({ teams: [t, ...state.teams] })),
  addSchedule: (s) => set((state) => ({ schedules: [s, ...state.schedules] })),
  pauseSchedule: (id) =>
    set((state) => ({
      schedules: state.schedules.map((s) => (s.id === id ? { ...s, paused: !s.paused } : s)),
    })),
  deleteSchedule: (id) =>
    set((state) => ({ schedules: state.schedules.filter((s) => s.id !== id) })),
  updateSchedule: (id, patch) =>
    set((state) => ({
      schedules: state.schedules.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    })),
  addBrief: (b) => set((state) => ({ briefs: [b, ...state.briefs] })),
}));
