"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  Color,
  FrontSide,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Plane,
  Vector3,
  type BufferGeometry,
} from "three";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { SkeletonUtils } from "three-stdlib";
import { useAtlasStore } from "@/store/useAtlasStore";
import { STRUCTURE_BY_ID } from "@/data/structures";
import { SYSTEM_META } from "@/lib/systems";
import { ErrorBoundary } from "./ErrorBoundary";
import { useModelPacks } from "@/lib/useModelPacks";
import type { SystemId } from "@/lib/types";

useGLTF.setDecoderPath("/draco/");

const SELECTED_COLOR = "#5ee2ff";
const SELECTED_EMISSIVE = "#0d3346";
const HOVER_COLOR = "#f6d98a";
const HOVER_EMISSIVE = "#3a2c10";

interface Entry {
  mesh: Mesh;
  meshId: string;
  system: SystemId;
  layer: number;
  sex: "both" | "male" | "female";
}

/**
 * Draco meshes already carry normals. The previous code recomputed them for
 * every mesh on load, which cost seconds on the 2,234-mesh male body and
 * flattened smooth shading.
 */
function ensureNormals(geometry: BufferGeometry) {
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
}

/**
 * One material per system instead of one per mesh. The male cardiovascular
 * pack alone has 981 meshes; giving each its own MeshStandardMaterial meant
 * 981 shader uniform blocks and a full re-upload on every hover.
 */
function useSystemMaterials() {
  const materials = useMemo(() => {
    const base = {} as Record<SystemId, MeshStandardMaterial>;
    for (const id of Object.keys(SYSTEM_META) as SystemId[]) {
      base[id] = new MeshStandardMaterial({
        color: new Color(SYSTEM_META[id].color),
        roughness: 0.55,
        metalness: 0.04,
        side: FrontSide,
        clipShadows: true,
      });
    }
    const selected = new MeshStandardMaterial({
      color: new Color(SELECTED_COLOR),
      emissive: new Color(SELECTED_EMISSIVE),
      roughness: 0.4,
      metalness: 0.05,
      side: FrontSide,
      clipShadows: true,
    });
    const hover = new MeshStandardMaterial({
      color: new Color(HOVER_COLOR),
      emissive: new Color(HOVER_EMISSIVE),
      roughness: 0.45,
      metalness: 0.05,
      side: FrontSide,
      clipShadows: true,
    });
    const fallback = new MeshStandardMaterial({
      color: new Color("#a9b2be"),
      roughness: 0.6,
      side: FrontSide,
    });
    return { base, selected, hover, fallback };
  }, []);

  useEffect(() => {
    const all = [
      ...Object.values(materials.base),
      materials.selected,
      materials.hover,
      materials.fallback,
    ];
    return () => all.forEach((m) => m.dispose());
  }, [materials]);

  return materials;
}

function useClippingPlanes() {
  const clipEnabled = useAtlasStore((s) => s.clipEnabled);
  const clipAxis = useAtlasStore((s) => s.clipAxis);
  const clipValue = useAtlasStore((s) => s.clipValue);
  return useMemo(() => {
    if (!clipEnabled) return [];
    const n = new Vector3(
      clipAxis === "x" ? -1 : 0,
      clipAxis === "y" ? -1 : 0,
      clipAxis === "z" ? -1 : 0,
    );
    return [new Plane(n, clipValue)];
  }, [clipEnabled, clipAxis, clipValue]);
}

function SystemPack({ url }: { url: string }) {
  const gltf = useGLTF(url);
  const { invalidate } = useThree();
  const materials = useSystemMaterials();
  const clippingPlanes = useClippingPlanes();

  const { root, entries, byMeshId } = useMemo(() => {
    const cloned = SkeletonUtils.clone(gltf.scene) as Object3D;
    const list: Entry[] = [];
    const map = new Map<string, Entry>();
    cloned.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      ensureNormals(mesh.geometry);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = true;
      const meta = STRUCTURE_BY_ID[mesh.name];
      const entry: Entry = {
        mesh,
        meshId: mesh.name,
        system: meta?.system ?? "skeletal",
        layer: meta?.layer ?? 1,
        sex: meta?.sex ?? "both",
      };
      list.push(entry);
      map.set(mesh.name, entry);
    });
    return { root: cloned, entries: list, byMeshId: map };
  }, [gltf.scene]);

  // --- base material assignment (once per pack) ---------------------------
  useLayoutEffect(() => {
    for (const e of entries) {
      e.mesh.material = STRUCTURE_BY_ID[e.meshId]
        ? materials.base[e.system]
        : materials.fallback;
    }
    invalidate();
  }, [entries, materials, invalidate]);

  // --- shared appearance: clipping + fade --------------------------------
  const transparency = useAtlasStore((s) => s.transparency);
  useLayoutEffect(() => {
    const opacity = 1 - transparency * 0.85;
    const all = [
      ...Object.values(materials.base),
      materials.selected,
      materials.hover,
      materials.fallback,
    ];
    for (const m of all) {
      m.clippingPlanes = clippingPlanes;
      m.needsUpdate = true;
    }
    // Fade unselected context so the selection reads through it.
    for (const m of Object.values(materials.base)) {
      m.transparent = opacity < 1;
      m.opacity = opacity;
      m.depthWrite = opacity >= 1;
    }
    materials.fallback.transparent = opacity < 1;
    materials.fallback.opacity = opacity;
    invalidate();
  }, [clippingPlanes, transparency, materials, invalidate]);

  // --- visibility ---------------------------------------------------------
  const systems = useAtlasStore((s) => s.systems);
  const hiddenIds = useAtlasStore((s) => s.hiddenIds);
  const isolatedIds = useAtlasStore((s) => s.isolatedIds);
  const sex = useAtlasStore((s) => s.sex);
  const muscleLayer = useAtlasStore((s) => s.muscleLayer);

  useLayoutEffect(() => {
    const hidden = new Set(hiddenIds);
    const isolated = isolatedIds.length ? new Set(isolatedIds) : null;
    for (const e of entries) {
      let visible = systems[e.system] !== false;
      if (visible && e.sex !== "both" && e.sex !== sex) visible = false;
      if (visible && e.system === "muscular" && e.layer > muscleLayer) {
        visible = false;
      }
      if (visible && hidden.has(e.meshId)) visible = false;
      if (visible && isolated && !isolated.has(e.meshId)) visible = false;
      e.mesh.visible = visible;
    }
    invalidate();
  }, [entries, systems, hiddenIds, isolatedIds, sex, muscleLayer, invalidate]);

  // --- selection ----------------------------------------------------------
  // Most structures worth selecting sit inside the body. Without an x-ray
  // pass, flying the camera to the left lung just shows the chest wall.
  const xray = useAtlasStore((s) => s.xray);
  useLayoutEffect(() => {
    const m = materials.selected;
    m.depthTest = !xray;
    m.transparent = xray;
    m.opacity = xray ? 0.94 : 1;
    m.needsUpdate = true;
    invalidate();
  }, [xray, materials, invalidate]);

  const selectedIds = useAtlasStore((s) => s.selectedIds);
  const selectedRef = useRef<Set<string>>(new Set());
  useLayoutEffect(() => {
    const next = new Set(selectedIds);
    const prev = selectedRef.current;
    for (const id of prev) {
      if (next.has(id)) continue;
      const e = byMeshId.get(id);
      if (e) {
        e.mesh.material = materials.base[e.system];
        e.mesh.renderOrder = 0;
      }
    }
    for (const id of next) {
      const e = byMeshId.get(id);
      if (e) {
        e.mesh.material = materials.selected;
        // Drawn last so the x-ray pass lands on top of the body.
        e.mesh.renderOrder = 10;
      }
    }
    selectedRef.current = next;
    invalidate();
  }, [selectedIds, byMeshId, materials, invalidate]);

  // --- hover: touch only the two meshes involved --------------------------
  const hoveredId = useAtlasStore((s) => s.hoveredId);
  const hoveredRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    const prev = hoveredRef.current;
    if (prev && prev !== hoveredId) {
      const e = byMeshId.get(prev);
      if (e && !selectedRef.current.has(prev)) {
        e.mesh.material = materials.base[e.system];
      }
    }
    if (hoveredId && !selectedRef.current.has(hoveredId)) {
      const e = byMeshId.get(hoveredId);
      if (e) e.mesh.material = materials.hover;
    }
    hoveredRef.current = hoveredId;
    invalidate();
  }, [hoveredId, byMeshId, materials, invalidate]);

  return <primitive object={root} />;
}

function Lighting() {
  const theme = useAtlasStore((s) => s.theme);
  const dark = theme === "dark";
  return (
    <>
      <ambientLight intensity={dark ? 0.55 : 0.7} />
      <hemisphereLight
        color={dark ? "#dce8f6" : "#ffffff"}
        groundColor={dark ? "#2a3444" : "#9d9488"}
        intensity={0.75}
      />
      {/* Key */}
      <directionalLight position={[2.5, 3.5, 3.5]} intensity={dark ? 1.25 : 1.0} />
      {/* Fill */}
      <directionalLight position={[-2.8, 2.0, 2.6]} intensity={dark ? 0.8 : 0.7} />
      {/* Rim */}
      <directionalLight position={[0, 3.6, -3.4]} intensity={dark ? 0.7 : 0.45} />
      {/* Bounce */}
      <directionalLight position={[0, -2.4, 1.6]} intensity={0.35} />
    </>
  );
}

export function AnatomyScene() {
  const packs = useModelPacks();
  const selectMesh = useAtlasStore((s) => s.selectMesh);
  const setHovered = useAtlasStore((s) => s.setHovered);
  const isolate = useAtlasStore((s) => s.isolate);

  // Pointer highlighting is a desktop nicety; on touch it just costs raycasts.
  const hoverEnabled = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches,
    [],
  );

  return (
    <group
      onPointerMove={
        hoverEnabled
          ? (e) => {
              e.stopPropagation();
              setHovered((e.object as Mesh).name || null);
            }
          : undefined
      }
      onPointerOut={hoverEnabled ? () => setHovered(null) : undefined}
      onClick={(e) => {
        e.stopPropagation();
        const name = (e.object as Mesh).name;
        if (name) selectMesh(name);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        const name = (e.object as Mesh).name;
        if (!name) return;
        selectMesh(name);
        isolate();
      }}
    >
      <Lighting />
      <ErrorBoundary fallback={null} resetKey={packs.map((p) => p.id).join(",")}>
        {packs.map((p) => (
          <Suspense key={p.id} fallback={null}>
            <SystemPack url={p.url} />
          </Suspense>
        ))}
      </ErrorBoundary>
    </group>
  );
}
