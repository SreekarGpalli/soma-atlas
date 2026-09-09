"use client";

import { create } from "zustand";
import { STRUCTURE_BY_ID, meshesFor } from "@/data/structures";
import { SLICES } from "@/data/slices";
import { DEFAULT_SYSTEMS } from "@/lib/systems";
import { buildQuiz, checkAnswer } from "@/lib/quiz";
import { loadLocal, saveLocal } from "@/lib/storage";
import { DEFAULT_TUTOR_MODEL, isAllowedModel } from "@/lib/tutor-models";
import type {
  Bookmark,
  ClipAxis,
  QuizQuestion,
  SexModule,
  SystemId,
  TutorMessage,
} from "@/lib/types";

export type PanelId =
  | "browse"
  | "card"
  | "quiz"
  | "slices"
  | "compare"
  | "tutor"
  | "settings";

export interface ToolTrace {
  id: string;
  tool: string;
  label: string;
  status: "running" | "done" | "error";
}

interface AtlasState {
  sex: SexModule;
  systems: Record<SystemId, boolean>;
  /** Mesh ids currently highlighted. */
  selectedIds: string[];
  /** Structure id whose card is open. */
  focusedId: string | null;
  hoveredId: string | null;
  hiddenIds: string[];
  isolatedIds: string[];
  tipsDismissed: boolean;
  transparency: number;
  /** Draw the selection through whatever occludes it. */
  xray: boolean;
  muscleLayer: number;
  clipEnabled: boolean;
  clipAxis: ClipAxis;
  clipValue: number;
  query: string;
  panel: PanelId;
  theme: "dark" | "light";
  sliceId: string | null;
  compareLeft: string | null;
  compareRight: string | null;
  bookmarks: Bookmark[];
  groqKey: string;
  groqModel: string;
  messages: TutorMessage[];
  toolTrace: ToolTrace[];
  tutorBusy: boolean;
  quiz: QuizQuestion[];
  quizIndex: number;
  quizScore: number;
  quizAnswered: boolean;
  quizGiven: string;
  lastQuizCorrect: boolean | null;
  modelLoading: string | null;
  loadedSystems: SystemId[];
  fitTrigger: number;
  /** Bumped to ask the viewer to frame the current selection. */
  focusTrigger: number;

  setSex: (sex: SexModule) => void;
  setModelLoading: (v: string | null) => void;
  setLoadedSystems: (v: SystemId[]) => void;
  triggerFit: () => void;
  focusSelection: () => void;
  toggleSystem: (id: SystemId) => void;
  patchSystems: (patch: Partial<Record<SystemId, boolean>>) => void;
  soloSystem: (id: SystemId) => void;
  select: (id: string, opts?: { additive?: boolean; openCard?: boolean }) => void;
  selectMesh: (meshId: string) => void;
  setHovered: (id: string | null) => void;
  dismissTips: () => void;
  clearSelection: () => void;
  hideSelected: () => void;
  hideMany: (ids: string[]) => void;
  isolate: (ids?: string[]) => void;
  resetVisibility: () => void;
  setTransparency: (v: number) => void;
  setXray: (v: boolean) => void;
  setMuscleLayer: (v: number) => void;
  setClipEnabled: (v: boolean) => void;
  setClipAxis: (v: ClipAxis) => void;
  setClipValue: (v: number) => void;
  setQuery: (q: string) => void;
  setPanel: (p: PanelId) => void;
  setTheme: (t: "dark" | "light") => void;
  toggleTheme: () => void;
  setSliceId: (id: string | null) => void;
  setCompare: (left: string | null, right: string | null) => void;
  saveBookmark: (title?: string) => void;
  loadBookmark: (id: string) => void;
  deleteBookmark: (id: string) => void;
  setGroqKey: (k: string) => void;
  setGroqModel: (m: string) => void;
  pushMessage: (m: TutorMessage) => void;
  clearMessages: () => void;
  pushTrace: (e: ToolTrace) => void;
  patchTrace: (id: string, patch: Partial<ToolTrace>) => void;
  clearTrace: () => void;
  setTutorBusy: (v: boolean) => void;
  startQuiz: (system?: SystemId) => void;
  answerQuiz: (choice: string) => void;
  nextQuiz: () => void;
  endQuiz: () => void;
}

/**
 * The inline script in layout.tsx already resolved the theme before paint
 * (stored preference, else prefers-color-scheme). Read that back so the store
 * agrees with the DOM instead of hard-defaulting to dark.
 */
function initialTheme(): "dark" | "light" {
  const stored = loadLocal<string | null>("theme", null);
  if (stored === "dark" || stored === "light") return stored;
  if (typeof document !== "undefined") {
    const attr = document.documentElement.dataset.theme;
    if (attr === "dark" || attr === "light") return attr;
  }
  return "dark";
}

/** Ids only present in one module leave stale highlights behind on a switch. */
function systemsForSex(
  current: Record<SystemId, boolean>,
  sex: SexModule,
): Record<SystemId, boolean> {
  return {
    ...current,
    maleReproductive: sex === "male" ? current.maleReproductive : false,
    femaleReproductive: sex === "female" ? current.femaleReproductive : false,
  };
}

export const useAtlasStore = create<AtlasState>((set, get) => ({
  sex: "male",
  systems: { ...DEFAULT_SYSTEMS },
  selectedIds: [],
  focusedId: null,
  hoveredId: null,
  hiddenIds: [],
  isolatedIds: [],
  tipsDismissed: loadLocal<boolean>("tipsDismissed", false),
  transparency: 0,
  xray: true,
  muscleLayer: 3,
  clipEnabled: false,
  clipAxis: "y",
  clipValue: 0,
  query: "",
  panel: "browse",
  theme: initialTheme(),
  sliceId: SLICES[0]?.id ?? null,
  compareLeft: null,
  compareRight: null,
  bookmarks: loadLocal<Bookmark[]>("bookmarks", []),
  groqKey: loadLocal<string>("groqKey", ""),
  groqModel: loadLocal<string>("groqModel", DEFAULT_TUTOR_MODEL),
  messages: [],
  toolTrace: [],
  tutorBusy: false,
  quiz: [],
  quizIndex: 0,
  quizScore: 0,
  quizAnswered: false,
  quizGiven: "",
  lastQuizCorrect: null,
  modelLoading: null,
  loadedSystems: [],
  fitTrigger: 0,
  focusTrigger: 0,

  triggerFit: () => set((s) => ({ fitTrigger: s.fitTrigger + 1 })),
  focusSelection: () => set((s) => ({ focusTrigger: s.focusTrigger + 1 })),
  setModelLoading: (v) => set({ modelLoading: v }),
  setLoadedSystems: (v) => set({ loadedSystems: v }),

  setSex: (sex) => {
    if (get().sex === sex) return;
    // Mesh ids do not carry across modules, so anything referencing the old
    // model must be cleared or the new body renders empty.
    set((s) => ({
      sex,
      systems: systemsForSex(
        sex === "female"
          ? { ...s.systems, femaleReproductive: true }
          : s.systems,
        sex,
      ),
      selectedIds: [],
      focusedId: null,
      hoveredId: null,
      hiddenIds: [],
      isolatedIds: [],
      quiz: [],
      quizIndex: 0,
      quizScore: 0,
      quizAnswered: false,
      sliceId: SLICES.find((x) => x.sex === sex)?.id ?? null,
      fitTrigger: s.fitTrigger + 1,
    }));
  },

  toggleSystem: (id) =>
    set((s) => ({ systems: { ...s.systems, [id]: !s.systems[id] } })),
  patchSystems: (patch) => set((s) => ({ systems: { ...s.systems, ...patch } })),
  soloSystem: (id) =>
    set((s) => {
      const only = Object.fromEntries(
        Object.keys(s.systems).map((k) => [k, k === id]),
      ) as Record<SystemId, boolean>;
      // A second click on a solo'd system restores the defaults.
      const alreadySolo =
        s.systems[id] && Object.entries(s.systems).every(([k, v]) => v === (k === id));
      return { systems: alreadySolo ? { ...DEFAULT_SYSTEMS } : only };
    }),

  select: (id, opts) => {
    const meta = STRUCTURE_BY_ID[id];
    if (!meta) return;
    const meshes = meshesFor(id);
    const selectedIds = opts?.additive
      ? [...new Set([...get().selectedIds, ...meshes])]
      : meshes;
    set((s) => ({
      selectedIds,
      focusedId: id,
      systems: { ...s.systems, [meta.system]: true },
      // Only take over the sidebar when the caller asks; browsing a list
      // should not yank the list out from under the pointer.
      panel: opts?.openCard ? "card" : s.panel,
    }));
  },

  selectMesh: (meshId) => {
    // Clicking geometry resolves to the owning structure so a lung segment
    // opens the "Lungs" card rather than an unnamed fragment.
    const owner = STRUCTURE_BY_ID[meshId];
    get().select(owner ? owner.id : meshId, { openCard: true });
  },

  setHovered: (id) => {
    if (get().hoveredId === id) return;
    set({ hoveredId: id });
  },

  dismissTips: () => {
    saveLocal("tipsDismissed", true);
    set({ tipsDismissed: true });
  },

  clearSelection: () => set({ selectedIds: [], focusedId: null }),
  hideSelected: () =>
    set((s) => ({ hiddenIds: [...new Set([...s.hiddenIds, ...s.selectedIds])] })),
  hideMany: (ids) =>
    set((s) => ({ hiddenIds: [...new Set([...s.hiddenIds, ...ids])] })),
  isolate: (ids) => {
    const next = ids && ids.length ? ids : get().selectedIds;
    if (!next.length) return;
    set({ isolatedIds: next, hiddenIds: [] });
  },
  resetVisibility: () => set({ hiddenIds: [], isolatedIds: [] }),

  setTransparency: (v) => set({ transparency: Math.min(1, Math.max(0, v)) }),
  setXray: (v) => set({ xray: v }),
  setMuscleLayer: (v) => set({ muscleLayer: Math.min(3, Math.max(1, v)) }),
  setClipEnabled: (v) => set({ clipEnabled: v }),
  setClipAxis: (v) => set({ clipAxis: v }),
  setClipValue: (v) => set({ clipValue: v }),
  setQuery: (q) => set({ query: q }),
  setPanel: (p) => set({ panel: p }),

  setTheme: (theme) => {
    saveLocal("theme", theme);
    set({ theme });
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = theme;
    }
  },
  toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),

  setSliceId: (id) => set({ sliceId: id }),
  setCompare: (left, right) => set({ compareLeft: left, compareRight: right }),

  saveBookmark: (title) => {
    const s = get();
    const auto = s.focusedId
      ? STRUCTURE_BY_ID[s.focusedId]?.name
      : `View · ${new Date().toLocaleString()}`;
    const bookmark: Bookmark = {
      id: newId(),
      title: title?.trim() || auto || "Saved view",
      createdAt: Date.now(),
      sex: s.sex,
      focusedId: s.focusedId,
      selectedIds: s.selectedIds,
      hiddenIds: s.hiddenIds,
      isolatedIds: s.isolatedIds,
      systems: s.systems,
      transparency: s.transparency,
      clip: { enabled: s.clipEnabled, axis: s.clipAxis, value: s.clipValue },
    };
    const bookmarks = [bookmark, ...s.bookmarks].slice(0, 40);
    saveLocal("bookmarks", bookmarks);
    set({ bookmarks });
  },

  loadBookmark: (id) => {
    const b = get().bookmarks.find((x) => x.id === id);
    if (!b) return;
    set((s) => ({
      sex: b.sex,
      focusedId: b.focusedId ?? null,
      selectedIds: b.selectedIds,
      hiddenIds: b.hiddenIds,
      isolatedIds: b.isolatedIds,
      systems: systemsForSex(b.systems, b.sex),
      transparency: b.transparency,
      clipEnabled: b.clip.enabled,
      clipAxis: b.clip.axis,
      clipValue: b.clip.value,
      panel: "card",
      fitTrigger: s.fitTrigger + 1,
    }));
  },

  deleteBookmark: (id) => {
    const bookmarks = get().bookmarks.filter((b) => b.id !== id);
    saveLocal("bookmarks", bookmarks);
    set({ bookmarks });
  },

  setGroqKey: (k) => {
    saveLocal("groqKey", k.trim());
    set({ groqKey: k.trim() });
  },
  setGroqModel: (m) => {
    const model = isAllowedModel(m) ? m : DEFAULT_TUTOR_MODEL;
    saveLocal("groqModel", model);
    set({ groqModel: model });
  },

  pushMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  clearMessages: () => set({ messages: [], toolTrace: [] }),
  pushTrace: (e) => set((s) => ({ toolTrace: [...s.toolTrace, e] })),
  patchTrace: (id, patch) =>
    set((s) => ({
      toolTrace: s.toolTrace.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    })),
  clearTrace: () => set({ toolTrace: [] }),
  setTutorBusy: (v) => set({ tutorBusy: v }),

  startQuiz: (system) => {
    const quiz = buildQuiz({ system, sex: get().sex });
    if (!quiz.length) return;
    set((s) => ({
      quiz,
      quizIndex: 0,
      quizScore: 0,
      quizAnswered: false,
      quizGiven: "",
      lastQuizCorrect: null,
      panel: "quiz",
      ...applyQuizTarget(s, quiz[0]),
    }));
  },

  answerQuiz: (choice) => {
    const { quiz, quizIndex, quizAnswered } = get();
    if (quizAnswered) return;
    const q = quiz[quizIndex];
    if (!q) return;
    const ok = checkAnswer(q, choice);
    set((s) => ({
      quizAnswered: true,
      quizGiven: choice,
      lastQuizCorrect: ok,
      quizScore: ok ? s.quizScore + 1 : s.quizScore,
    }));
  },

  nextQuiz: () => {
    const { quiz, quizIndex } = get();
    const next = quizIndex + 1;
    if (next >= quiz.length) return;
    set((s) => ({
      quizIndex: next,
      quizAnswered: false,
      quizGiven: "",
      lastQuizCorrect: null,
      ...applyQuizTarget(s, quiz[next]),
    }));
  },

  endQuiz: () =>
    set({
      quiz: [],
      quizIndex: 0,
      quizScore: 0,
      quizAnswered: false,
      quizGiven: "",
      lastQuizCorrect: null,
    }),
}));

/**
 * Highlight the question's structure and switch its system on, otherwise an
 * "identify this" question points at a mesh that is filtered out of the scene.
 * `focusedId` stays null for identify questions so the viewer label does not
 * print the answer.
 */
function applyQuizTarget(
  state: { systems: Record<SystemId, boolean> },
  q: QuizQuestion | undefined,
) {
  if (!q) return {};
  const meta = STRUCTURE_BY_ID[q.structureId];
  return {
    selectedIds: meshesFor(q.structureId),
    focusedId: q.type === "identify" ? null : q.structureId,
    isolatedIds: [] as string[],
    hiddenIds: [] as string[],
    systems: meta ? { ...state.systems, [meta.system]: true } : state.systems,
  };
}

/** crypto.randomUUID is unavailable outside secure contexts (e.g. LAN testing). */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
