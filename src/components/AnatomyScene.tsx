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
  type PerspectiveCamera,
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
import { TISSUE_COLOR, classifyTissue, type TissueId } from "@/lib/tissue";

useGLTF.setDecoderPath("/draco/");

const SELECTED_COLOR = "#5ee2ff";
const SELECTED_EMISSIVE = "#0d3346";
const HOVER_COLOR = "#f6d98a";
const HOVER_EMISSIVE = "#3a2c10";

interface Entry {
  mesh: Mesh;
  meshId: string;
  system: SystemId;
  tissue: TissueId;
  layer: number;
  sex: "both" | "male" | "female";
}

/** Optional normal extrusion improves distant visibility. It uses a nominal
 * radius, not measured calibre, and is not a guaranteed pixel-width floor.
 * Disable the display aid when assessing original surface geometry. */
const MIN_TUBE_PIXELS = 2.4;
const NOMINAL_TUBE_RADIUS = 0.0025;   // metres; Z-Anatomy's authored tube radius
const MAX_TUBE_GROWTH = 0.006;        // never add more than 6 mm of radius

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
  // One shared uniform object, so every material's minimum-width correction is
  // driven by the same camera without touching 5,000 meshes each frame.
  const pixelScale = useRef({ value: 0.002 });

  /** Grow thin geometry along its normal until it clears MIN_TUBE_PIXELS. */
  const applyMinWidth = useMemo(
    () => (material: MeshStandardMaterial) => {
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uPixelScale = pixelScale.current;
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            `#include <common>
             uniform float uPixelScale;`,
          )
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
             {
               vec4 mvp = modelViewMatrix * vec4( transformed, 1.0 );
               float depth = max( -mvp.z, 0.001 );
               float wantRadius = ${MIN_TUBE_PIXELS.toFixed(2)} * depth * uPixelScale * 0.5;
               float grow = clamp( wantRadius - ${NOMINAL_TUBE_RADIUS.toFixed(5)}, 0.0, ${MAX_TUBE_GROWTH.toFixed(5)} );
               transformed += normalize( objectNormal ) * grow;
             }`,
          );
      };
      // Distinct key or three.js reuses one compiled program for all of them.
      material.customProgramCacheKey = () => "min-width-v1";
      return material;
    },
    [],
  );

  const materials = useMemo(() => {
    const base = {} as Record<string, MeshStandardMaterial>;
    const make = (color: string) =>
        new MeshStandardMaterial({
          color: new Color(color),
          roughness: 0.55,
          metalness: 0.04,
          side: FrontSide,
          clipShadows: true,
        });
    for (const id of Object.keys(SYSTEM_META) as SystemId[]) {
      base[id] = make(SYSTEM_META[id].color);
      // Arteries red, veins blue, nerves yellow: the convention a student
      // already reads, so a vein stops hiding inside the arterial tree.
      for (const [tissue, color] of Object.entries(TISSUE_COLOR)) {
        base[`${id}:${tissue}`] = applyMinWidth(make(color as string));
      }
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
    const tubeSelected = applyMinWidth(selected.clone());
    const tubeHover = applyMinWidth(hover.clone());
    return { base, selected, hover, fallback, tubeSelected, tubeHover, pixelScale };
  }, [applyMinWidth]);

  useEffect(() => {
    const all = [
      ...Object.values(materials.base),
      materials.selected,
      materials.hover,
      materials.fallback,
      materials.tubeSelected,
      materials.tubeHover,
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
        tissue: classifyTissue(meta?.name ?? mesh.name),
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
        ? materials.base[`${e.system}:${e.tissue}`] ?? materials.base[e.system]
        : materials.fallback;
    }
    invalidate();
  }, [entries, materials, invalidate]);

  // --- minimum tube width: world units per pixel at unit depth ------------
  // A perspective camera spans 2*tan(fov/2) world units per unit of depth, over
  // the viewport's height in pixels. Recomputed on resize and on any camera
  // change, which is also every frame the user is dragging.
  const readable = useAtlasStore((s) => s.readable);
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const update = () => {
      const cam = camera as PerspectiveCamera;
      if (!cam.isPerspectiveCamera || !size.height) return;
      const next = readable ? 2 / (cam.projectionMatrix.elements[5] * size.height) : 0;
      if (Math.abs(next - materials.pixelScale.current.value) > 1e-9) {
        materials.pixelScale.current.value = next;
        invalidate();
      }
    };
    update();

  }, [camera, size, readable, materials, invalidate]);

  // --- shared appearance: clipping + fade --------------------------------
  const transparency = useAtlasStore((s) => s.transparency);
  useLayoutEffect(() => {
    const opacity = 1 - transparency * 0.85;
    const all = [
      ...Object.values(materials.base),
      materials.selected,
      materials.hover,
      materials.fallback,
      materials.tubeSelected,
      materials.tubeHover,
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
  const tissueFocus = useAtlasStore((s) => s.tissueFocus);

  const regionFocus = useAtlasStore(s => s.regionFocus);
  useLayoutEffect(() => {
    const hidden = new Set(hiddenIds);
    const isolated = isolatedIds.length ? new Set(isolatedIds) : null;
    for (const e of entries) {
      let visible = systems[e.system] !== false;
      if (regionFocus !== "all" && STRUCTURE_BY_ID[e.meshId]?.region !== regionFocus) visible = false;
      if (tissueFocus !== "all" && e.tissue !== tissueFocus) visible = false;
      if (visible && e.sex !== "both" && e.sex !== sex) visible = false;
      if (visible && e.system === "muscular" && e.layer > muscleLayer) {
        visible = false;
      }
      if (visible && hidden.has(e.meshId)) visible = false;
      if (visible && isolated && !isolated.has(e.meshId)) visible = false;
      e.mesh.visible = visible;
    }
    useAtlasStore.setState(s => ({ sceneRevision: s.sceneRevision + 1 }));
    invalidate();
  }, [entries, systems, hiddenIds, isolatedIds, sex, muscleLayer, tissueFocus, regionFocus, invalidate]);

  // --- selection ----------------------------------------------------------
  // Most structures worth selecting sit inside the body. Without an x-ray
  // pass, flying the camera to the left lung just shows the chest wall.
  const xray = useAtlasStore((s) => s.xray);
  useLayoutEffect(() => {
    for (const m of [materials.selected, materials.tubeSelected]) {
    m.depthTest = !xray;
    m.transparent = xray;
    m.opacity = xray ? 0.94 : 1;
    m.needsUpdate = true;
    }
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
        e.mesh.material = materials.base[`${e.system}:${e.tissue}`] ?? materials.base[e.system];
        e.mesh.renderOrder = 0;
      }
    }
    for (const id of next) {
      const e = byMeshId.get(id);
      if (e) {
        e.mesh.material = TISSUE_COLOR[e.tissue] ? materials.tubeSelected : materials.selected;
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
        e.mesh.material = materials.base[`${e.system}:${e.tissue}`] ?? materials.base[e.system];
      }
    }
    if (hoveredId && !selectedRef.current.has(hoveredId)) {
      const e = byMeshId.get(hoveredId);
      if (e) e.mesh.material = TISSUE_COLOR[e.tissue] ? materials.tubeHover : materials.hover;
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
