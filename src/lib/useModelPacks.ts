"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGLTF } from "@react-three/drei";
import { useAtlasStore } from "@/store/useAtlasStore";
import { SYSTEM_META } from "./systems";
import {
  SYSTEM_LOAD_ORDER,
  isPhoneViewport,
  loadManifest,
  type AtlasManifest,
} from "./model-loader";
import type { SystemId } from "./types";

export interface Pack {
  id: SystemId;
  url: string;
}

/**
 * Decides which GLB packs are mounted.
 *
 * On phones the packs are admitted one at a time so a burst of filter toggles
 * does not kick off five multi-megabyte downloads at once. On desktop every
 * enabled system loads immediately.
 */
export function useModelPacks(): Pack[] {
  const sex = useAtlasStore((s) => s.sex);
  const systems = useAtlasStore((s) => s.systems);
  const setModelLoading = useAtlasStore((s) => s.setModelLoading);
  const setLoadedSystems = useAtlasStore((s) => s.setLoadedSystems);

  const [manifest, setManifest] = useState<AtlasManifest | null>(null);
  const [manifestError, setManifestError] = useState(false);
  const [admitted, setAdmitted] = useState<SystemId[]>([]);
  const phone = useRef(false);

  useEffect(() => {
    phone.current = isPhoneViewport();
    let live = true;
    loadManifest().then((m) => {
      if (!live) return;
      if (m) setManifest(m);
      else setManifestError(true);
    });
    return () => {
      live = false;
    };
  }, []);

  const pack = useMemo(
    () => (sex === "female" ? manifest?.female : manifest?.male) ?? null,
    [manifest, sex],
  );

  /** Systems the user has switched on that actually have a file. */
  const wanted = useMemo(() => {
    if (!pack) return [] as SystemId[];
    return SYSTEM_LOAD_ORDER.filter((id) => systems[id] && pack[id]);
  }, [pack, systems]);

  const wantedKey = wanted.join(",");

  // Reset the admission queue whenever the module changes.
  useEffect(() => {
    setAdmitted([]);
  }, [sex]);

  useEffect(() => {
    if (!pack) return;
    if (!phone.current) {
      setAdmitted(wanted);
      setModelLoading(null);
      return;
    }
    setAdmitted((prev) => {
      const kept = prev.filter((id) => wanted.includes(id));
      if (kept.length === wanted.length) return kept;
      const next = wanted.find((id) => !kept.includes(id));
      return next ? [...kept, next] : kept;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedKey, pack, setModelLoading]);

  // Admit the remaining phone packs one frame-budget apart.
  useEffect(() => {
    if (!pack || !phone.current) return;
    const missing = wanted.filter((id) => !admitted.includes(id));
    if (!missing.length) {
      setModelLoading(null);
      return;
    }
    setModelLoading(`Loading ${SYSTEM_META[missing[0]].label}…`);
    const t = window.setTimeout(() => {
      setAdmitted((prev) =>
        prev.includes(missing[0]) ? prev : [...prev, missing[0]],
      );
    }, 300);
    return () => window.clearTimeout(t);
  }, [admitted, wanted, pack, setModelLoading]);

  const packs = useMemo<Pack[]>(() => {
    if (!pack) return [];
    const active = phone.current ? admitted : wanted;
    return active
      .filter((id) => systems[id] && pack[id])
      .map((id) => ({ id, url: pack[id] as string }));
  }, [pack, admitted, wanted, systems]);

  useEffect(() => {
    setLoadedSystems(packs.map((p) => p.id));
  }, [packs, setLoadedSystems]);

  // Warm the next likely pack so toggling a filter feels instant.
  useEffect(() => {
    for (const p of packs) useGLTF.preload(p.url);
  }, [packs]);

  useEffect(() => {
    if (manifestError) {
      setModelLoading("Could not load /models/manifest.json");
    }
  }, [manifestError, setModelLoading]);

  return packs;
}
