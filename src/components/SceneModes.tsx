"use client";
import { useAtlasStore } from "@/store/useAtlasStore";
import { SYSTEM_IDS } from "@/lib/systems";
import { lungMeshIds } from "@/lib/lung-views";
import type { RegionId, SystemId } from "@/lib/types";
export const MODES: { id: string; title: string; sub: string; color: string; systems: SystemId[]; tissue?: "artery" | "vein" | "nerve"; region?: RegionId }[] = [
  { id: "lungs", title: "Lung shape", sub: "Outer surfaces", color: "#75d5c5", systems: ["respiratory"] },
  { id: "airways", title: "Airways", sub: "Trachea & bronchial tree", color: "#75d5c5", systems: ["respiratory"] },
  { id: "organs", title: "Organs", sub: "Inside the body", color: "#e9a18e", systems: ["respiratory", "digestive", "urinary", "endocrine"] },
  { id: "artery", title: "Arteries", sub: "Arterial network", color: "#ed7c73", systems: ["cardiovascular"], tissue: "artery" },
  { id: "vein", title: "Veins", sub: "Venous network", color: "#7eaafa", systems: ["cardiovascular"], tissue: "vein" },
  { id: "nerve", title: "Nerves", sub: "Peripheral network", color: "#e5cf68", systems: ["nervous", "sensory"], tissue: "nerve" },
  { id: "brain", title: "Brain & cord", sub: "Full nervous system", color: "#d6b0e5", systems: ["nervous"] },
  { id: "face", title: "Head & face", sub: "Muscles, nerves, senses", color: "#eca98d", systems: ["muscular", "nervous", "sensory"], region: "head" },
  { id: "bones", title: "Skeleton", sub: "Bones & joints", color: "#d0c5b0", systems: ["skeletal"] },
];
export function openStudyView(id: string) {
  const mode = MODES.find(m => m.id === id);
  if (!mode) return;
  const state = useAtlasStore.getState();
  state.navigateView({
    viewName: mode.title, tissueFocus: mode.tissue ?? "all", regionFocus: mode.region ?? "all",
    systems: Object.fromEntries(SYSTEM_IDS.map(id => [id, mode.systems.includes(id)])) as Record<SystemId, boolean>,
    selectedIds: [], focusedId: null,
    isolatedIds: mode.id === "lungs" || mode.id === "airways" ? lungMeshIds(state.sex, mode.id) : [],
    hiddenIds: [], clipEnabled: false, muscleLayer: 3, transparency: 0,
  });
}
export function SceneModes() {
  const sex = useAtlasStore(s => s.sex);
  const active = useAtlasStore(s => s.viewName);
  return <section className="scene-modes">
    <div className="explorer-title"><span className="studio-kicker">YOUR ANATOMY LAB</span><h2>1. Choose a view</h2><p>Then choose a region or search for a structure.</p></div>
    <div className="mode-strip" role="group" aria-label="Study views">
      {MODES.map(mode => <button type="button" key={mode.id} className="mode-card" aria-pressed={active === mode.title} style={{ "--mode-color": mode.color } as React.CSSProperties} onClick={() => openStudyView(mode.id)}><i aria-hidden /><span><b>{mode.title}</b><small>{mode.sub}</small></span><span className="mode-arrow" aria-hidden>↗</span></button>)}
    </div>
    <p className="collection-note">{sex === "female" ? "Female reference organs" : "Male reference anatomy"} · Some anatomical detail is not modelled.</p>
  </section>;
}
