"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useProgress } from "@react-three/drei";
import { Box3, Color, Mesh, PerspectiveCamera, Sphere, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { AnatomyScene } from "./AnatomyScene";

import { REGION_IDS, REGION_META, SYSTEM_META } from "@/lib/systems";
import { regionAvailability } from "@/lib/regions";
import type { RegionId, SystemId } from "@/lib/types";
import { useAtlasStore } from "@/store/useAtlasStore";
import { STRUCTURE_BY_ID } from "@/data/structures";

/** Direction the camera approaches from: front, slightly above and to one side. */
const APPROACH = new Vector3(0, 0.05, 1).normalize();

interface Goal {
  pos: Vector3;
  target: Vector3;
}

/**
 * Distance at which a sphere of this radius fills the frame, accounting for
 * the camera's field of view and the viewport aspect.
 */
function distanceFor(camera: PerspectiveCamera, radius: number, padding: number) {
  const vFov = (camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const fit = radius / Math.sin(Math.min(vFov, hFov) / 2);
  return Math.max(fit * padding, 0.12);
}

/**
 * Camera framing is measured from the scene rather than hardcoded. The male
 * and female datasets have different origins and extents, so fixed positions
 * framed the male body correctly while pointing at the female model's knees.
 */
function CameraRig({
  controls,
}: {
  controls: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera, scene, invalidate, size } = useThree();
  const sex = useAtlasStore((s) => s.sex);
  const fitTrigger = useAtlasStore((s) => s.fitTrigger);
  const focusTrigger = useAtlasStore((s) => s.focusTrigger);
  const sceneRevision = useAtlasStore(s => s.sceneRevision);
  const activeSystems = useAtlasStore(s => s.systems);

  const goal = useRef<Goal | null>(null);
  /** Retry deadline for framing that could not be satisfied yet. */
  const pending = useRef<{ kind: "home" | "focus"; until: number } | null>(null);

  const frameBox = useCallback(
    (box: Box3, padding: number) => {
      if (box.isEmpty()) return false;
      const sphere = box.getBoundingSphere(new Sphere());
      if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) return false;
      const dist = distanceFor(camera as PerspectiveCamera, sphere.radius, padding);
      goal.current = {
        pos: sphere.center.clone().add(APPROACH.clone().multiplyScalar(dist)),
        target: sphere.center.clone(),
      };
      invalidate();
      return true;
    },
    [camera, invalidate],
  );

  /** Frame the whole visible body. */
  const tryHome = useCallback(() => {
    const box = new Box3();
    let found = false;
    scene.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh || !mesh.visible) return;
      box.expandByObject(mesh);
      found = true;
    });
    return found && frameBox(box, 1.12);
  }, [scene, frameBox]);

  /** Frame just the current selection. */
  const tryFocus = useCallback(() => {
    const ids = new Set(useAtlasStore.getState().selectedIds);
    if (!ids.size) return true;
    const box = new Box3();
    let found = false;
    scene.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh || !mesh.visible || !ids.has(mesh.name)) return;
      box.expandByObject(mesh);
      found = true;
    });
    return found && frameBox(box, 1.12);
  }, [scene, frameBox]);

  const request = useCallback(
    (kind: "home" | "focus") => {
      const done = kind === "home" ? tryHome() : tryFocus();
      // A selection can switch on a system whose pack is still downloading,
      // so keep retrying briefly rather than silently doing nothing.
      pending.current = done ? null : { kind, until: performance.now() + 8000 };
      invalidate();
    },
    [tryHome, tryFocus, invalidate],
  );

  useEffect(() => {
    request("home");
  }, [sex, fitTrigger, request]);

  useEffect(() => {
    if (focusTrigger) request("focus");
  }, [focusTrigger, request]);

  useEffect(() => {
    let count = 0;
    scene.traverse(obj => { if ((obj as Mesh).isMesh && obj.visible) count++; });
    useAtlasStore.setState({ visibleMeshCount: count });
    request(useAtlasStore.getState().selectedIds.length ? "focus" : "home");
  }, [sceneRevision, activeSystems, request, scene]);

  // A resize changes the aspect the framing was computed for.
  useEffect(() => {
    invalidate();
  }, [size, invalidate]);

  useFrame(() => {
    if (useAtlasStore.getState().turntable) invalidate();
    const p = pending.current;
    if (p) {
      const done = p.kind === "home" ? tryHome() : tryFocus();
      if (done || performance.now() > p.until) pending.current = null;
      else invalidate();
    }

    const g = goal.current;
    if (!g) return;
    const ctl = controls.current;
    camera.position.lerp(g.pos, 0.15);
    if (ctl) {
      ctl.target.lerp(g.target, 0.15);
      ctl.update();
    }
    if (camera.position.distanceTo(g.pos) < 0.004) {
      camera.position.copy(g.pos);
      if (ctl) {
        ctl.target.copy(g.target);
        ctl.update();
      }
      goal.current = null;
    }
    invalidate();
  });

  return null;
}

function SceneBackground({ color }: { color: string }) {
  const { scene, invalidate } = useThree();
  useEffect(() => {
    scene.background = new Color(color);
    invalidate();
  }, [color, scene, invalidate]);
  return null;
}

export function Viewer() {
  const controls = useRef<OrbitControlsImpl>(null);
  const loading = useProgress(s => s.active);
  const visibleCount = useAtlasStore(s => s.visibleMeshCount);
  const selectedIds = useAtlasStore((s) => s.selectedIds);
  const focusedId = useAtlasStore((s) => s.focusedId);
  const hoveredId = useAtlasStore((s) => s.hoveredId);
  const theme = useAtlasStore((s) => s.theme);
  const modelLoading = useAtlasStore((s) => s.modelLoading);
  const isolatedIds = useAtlasStore((s) => s.isolatedIds);
  const hiddenIds = useAtlasStore((s) => s.hiddenIds);
  const triggerFit = useAtlasStore((s) => s.triggerFit);
  const focusSelection = useAtlasStore((s) => s.focusSelection);
  const resetVisibility = useAtlasStore((s) => s.resetVisibility);
  const isolate = useAtlasStore((s) => s.isolate);
  const clearSelection = useAtlasStore((s) => s.clearSelection);

  // An unanswered "identify this" question must not have the answer printed
  // under it. The label falls back to the selection when focusedId is null,
  // which was exactly the mesh being asked about.
  const answerHidden = useAtlasStore(
    (s) =>
      !s.quizAnswered &&
      s.panel === "quiz" &&
      s.quiz[s.quizIndex]?.type === "identify",
  );

  const turntable = useAtlasStore(s => s.turntable);
  const bg = theme === "dark" ? "#0b1420" : "#e7e5e2";

  const pinned = useMemo(() => {
    if (answerHidden) return null;
    if (focusedId) return STRUCTURE_BY_ID[focusedId]?.name ?? null;
    if (!selectedIds.length) return null;
    const first = STRUCTURE_BY_ID[selectedIds[0]]?.name ?? selectedIds[0];
    return selectedIds.length > 1 ? `${first} +${selectedIds.length - 1}` : first;
  }, [focusedId, selectedIds, answerHidden]);

  const hoverName =
    hoveredId && hoveredId !== focusedId && !answerHidden
      ? STRUCTURE_BY_ID[hoveredId]?.name ?? null
      : null;

  const regionFocus = useAtlasStore(s => s.regionFocus);
  const viewName = useAtlasStore(s => s.viewName);
  const canBack = useAtlasStore(s => s.viewHistory.length > 0);
  const sexModule = useAtlasStore(s => s.sex);
  const chooseRegion = useAtlasStore(s => s.setRegionFocus);
  const systems = useAtlasStore(s => s.systems);
  const tissueFocus = useAtlasStore(s => s.tissueFocus);
  const availability = useMemo(
    () => regionAvailability(sexModule, systems, tissueFocus),
    [sexModule, systems, tissueFocus],
  );
  const heading = tissueFocus === "all" ? Object.entries(systems).filter(([,on]) => on).map(([id]) => SYSTEM_META[id as SystemId].label).join(" + ") : ({ artery: "Arteries", vein: "Veins", nerve: "Peripheral nerves", lymph: "Lymphatics" }[tissueFocus]);
  const dirty = isolatedIds.length > 0 || hiddenIds.length > 0;

  return (
    <div className="viewer">
      <header className="viewport-heading"><div><span className="studio-kicker">ANATOMY / EXPLORE</span><h1>{pinned ?? (viewName === "Custom view" ? heading : viewName)}</h1>{viewName === "Lung shape" && sexModule === "male" && <small className="faint">Human Reference Atlas / separate lung reference</small>}</div><label>Region<select aria-label="Visible body region" value={regionFocus} onChange={e => chooseRegion(e.target.value as RegionId | "all")}><option value="all">Whole body</option>{REGION_IDS.map(id => <option key={id} value={id} disabled={!availability[id].available}>{REGION_META[id].label}{availability[id].available ? "" : " — not in this view"}</option>)}</select></label></header>
      <div className="anatomy-stage"><Canvas
        frameloop="demand"
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [1.5, 1.1, 2.3], fov: 42, near: 0.02, far: 80 }}
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true;
        }}
        onPointerMissed={clearSelection}
      >
        <SceneBackground color={bg} />
        <AnatomyScene />
        <CameraRig controls={controls} />
        <OrbitControls
          ref={controls}
          makeDefault
          autoRotate={turntable}
          autoRotateSpeed={0.55}
          onStart={() => useAtlasStore.setState({ turntable: false })}
          enableDamping
          dampingFactor={0.08}
          minDistance={0.08}
          maxDistance={12}
          zoomSpeed={0.8}
        />
      </Canvas>{!loading && visibleCount === 0 && <div className="empty-scene" role="status"><strong>Nothing to show here</strong><p>This combination of view and body region has no models. Go back to what you were looking at, or start again from the whole body.</p><div className="tag-row">{canBack && <button type="button" onClick={() => useAtlasStore.getState().backView()}>Back</button>}<button type="button" onClick={() => useAtlasStore.getState().homeView()}>Start again</button><button type="button" className="ghost" onClick={resetVisibility}>Turn on every layer</button></div></div>}</div>

      <div className="viewport-tools">
      <button type="button" disabled={!canBack} onClick={() => useAtlasStore.getState().backView()}>Back</button>
      <button type="button" onClick={() => useAtlasStore.getState().homeView()}>Home</button>

      <div className="hud hud-tr">
        <button type="button" onClick={triggerFit} title="Fit visible anatomy to the canvas (F)">
          Fit view
        </button>
        <button
          type="button"
          onClick={focusSelection}
          disabled={!selectedIds.length}
          title="Zoom to the selection (Z)"
        >
          Zoom to
        </button>
      </div>

      <div className="hud hud-br">
        <button
          type="button"
          onClick={() => isolate()}
          disabled={!selectedIds.length}
          title="Show only the selection (I)"
        >
          Isolate
        </button>
        <button
          type="button"
          onClick={resetVisibility}
          title="Show everything again (R)"
        >
          All systems
        </button>
      </div>

      <button type="button" className="orbit-button" aria-pressed={turntable} onClick={() => useAtlasStore.setState({ turntable: !turntable })}>{turntable ? "Pause orbit" : "Orbit"}</button>
      </div>
      <div className="viewer-labels"><span className="viewport-hint">{visibleCount ?? 0} meshes in view / {dirty ? "Some structures are hidden · All systems restores them" : "Drag to rotate · Scroll to zoom · Double-click to isolate"}</span>
        {hoverName && <span className="label label-hover">{hoverName}</span>}
        {pinned && <span className="label label-pin">{pinned}</span>}
      </div>

      {(modelLoading || loading) && (
        <div className="label label-load" role="status">
          <span className="spinner" aria-hidden />
          {modelLoading ?? "Loading anatomy..."}
        </div>
      )}
    </div>
  );
}
