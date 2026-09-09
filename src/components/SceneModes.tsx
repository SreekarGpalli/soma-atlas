"use client";

import { useAtlasStore } from "@/store/useAtlasStore";
import { SYSTEM_IDS, DEFAULT_SYSTEMS } from "@/lib/systems";
import type { SystemId } from "@/lib/types";

const MODES = [
  { id: "all", title: "Anatomy", sub: "Form & movement", color: "#cbb9a4", systems: ["skeletal", "muscular"] },
  { id: "artery", title: "Arteries", sub: "Follow the flow", color: "#ef786a", systems: ["cardiovascular"] },
  { id: "vein", title: "Veins", sub: "The return path", color: "#73a9f5", systems: ["cardiovascular"] },
  { id: "nerve", title: "Nerves", sub: "Trace the network", color: "#f2d24b", systems: ["nervous", "sensory"] },
] as const;

export function SceneModes() {
  const focus = useAtlasStore(s => s.tissueFocus);
  const readable = useAtlasStore(s => s.readable);
  const turntable = useAtlasStore(s => s.turntable);
  const sex = useAtlasStore(s => s.sex);
  return <div className="scene-modes">
    <div className="scene-heading"><div><span className="studio-kicker">G.L.S.C / EXPLORATION STUDIO</span><h2>The body, revealed.</h2><p>{sex === "male" ? "Whole-body reference" : "Female organ reference"} · Rotate. Isolate. Discover.</p></div>
      <button type="button" className="orbit-button" aria-pressed={turntable} onClick={() => useAtlasStore.setState({ turntable: !turntable })}>{turntable ? "Ⅱ Pause orbit" : "↻ Orbit"}</button>
    </div>
    <div className="mode-strip" role="group" aria-label="Study views">
      {MODES.map(mode => <button type="button" key={mode.id} className="mode-card" aria-pressed={focus === mode.id} style={{ "--mode-color": mode.color } as React.CSSProperties} onClick={() => useAtlasStore.setState(s => ({
        tissueFocus: mode.id,
        systems: mode.id === "all" ? { ...DEFAULT_SYSTEMS } : Object.fromEntries(SYSTEM_IDS.map(id => [id, (mode.systems as readonly SystemId[]).includes(id)])) as Record<SystemId, boolean>,
        selectedIds: [], focusedId: null, hoveredId: null, isolatedIds: [], hiddenIds: [], clipEnabled: false, transparency: 0, fitTrigger: s.fitTrigger + 1,
      }))}><i aria-hidden /><span><b>{mode.title}</b><small>{mode.sub}</small></span></button>)}
    </div>
    <label className="readability-switch"><input type="checkbox" checked={readable} onChange={e => useAtlasStore.setState({ readable: e.target.checked })} /> Enhance fine structures <span>{readable ? "Display aid · zoom in for detail" : "Original geometry"}</span></label>
  </div>;
}
