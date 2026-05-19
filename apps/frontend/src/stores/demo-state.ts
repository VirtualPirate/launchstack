import { create } from "zustand";
import { demoBriefs, demoSchedules, type DemoBrief, type DemoSchedule } from "@/lib/demo-data";

interface DemoState {
  schedules: DemoSchedule[];
  briefs: DemoBrief[];
  addSchedule: (s: DemoSchedule) => void;
  pauseSchedule: (id: string) => void;
  deleteSchedule: (id: string) => void;
  updateSchedule: (id: string, patch: Partial<DemoSchedule>) => void;
  addBrief: (b: DemoBrief) => void;
}

export const useDemoState = create<DemoState>((set) => ({
  schedules: [...demoSchedules],
  briefs: [...demoBriefs],
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
