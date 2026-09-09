import type { SystemId } from "./types";

export type AtlasManifest = {
  male: Partial<Record<SystemId, string>>;
  female: Partial<Record<SystemId, string>>;
  maleBody?: string;
  femalePelvis?: string;
};

export const MODEL_PATHS = {
  male: "/models/male-body.glb",
  female: "/models/female-pelvis.glb",
} as const;

export const SYSTEM_LOAD_ORDER: SystemId[] = [
  "skeletal",
  "muscular",
  "cardiovascular",
  "nervous",
  "respiratory",
  "digestive",
  "urinary",
  "maleReproductive",
  "femaleReproductive",
  "endocrine",
  "lymphatic",
  "sensory",
  "integumentary",
];

export async function loadManifest(): Promise<AtlasManifest | null> {
  try {
    const res = await fetch("/models/manifest.json", { cache: "no-cache" });
    if (!res.ok) return null;
    return (await res.json()) as AtlasManifest;
  } catch {
    return null;
  }
}

export function isPhoneViewport() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(max-width: 860px)").matches ||
    (navigator.maxTouchPoints > 1 && window.innerWidth < 1100)
  );
}
