import type { RegionId, SystemId } from "./types";

export interface SystemMeta {
  label: string;
  /** Base mesh colour. Chosen for separation under the studio light rig. */
  color: string;
  /** Short blurb used in the filter list. */
  hint: string;
  defaultOn: boolean;
}

export const SYSTEM_META: Record<SystemId, SystemMeta> = {
  skeletal: {
    label: "Skeletal",
    color: "#e7dcc6",
    hint: "Bones, joints, cartilage",
    defaultOn: true,
  },
  muscular: {
    label: "Muscular",
    color: "#c2564a",
    hint: "Muscles, tendons, fascia",
    defaultOn: true,
  },
  cardiovascular: {
    label: "Cardiovascular",
    color: "#d0453f",
    hint: "Heart, arteries, veins",
    defaultOn: false,
  },
  nervous: {
    label: "Nervous",
    color: "#f0c53d",
    hint: "Brain, cord, nerves",
    defaultOn: false,
  },
  respiratory: {
    label: "Respiratory",
    color: "#6fb6cc",
    hint: "Airways, lungs, pleura",
    defaultOn: false,
  },
  digestive: {
    label: "Digestive",
    color: "#cf7326",
    hint: "Gut, liver, pancreas",
    defaultOn: false,
  },
  urinary: {
    label: "Urinary",
    color: "#e0b93a",
    hint: "Kidneys, ureters, bladder",
    defaultOn: false,
  },
  maleReproductive: {
    label: "Male reproductive",
    color: "#a679c4",
    hint: "Prostate, testes, ducts",
    defaultOn: false,
  },
  femaleReproductive: {
    label: "Female reproductive",
    color: "#e392b4",
    hint: "Uterus, tubes, ovaries",
    defaultOn: false,
  },
  endocrine: {
    label: "Endocrine",
    color: "#4fc98a",
    hint: "Pituitary, thyroid, adrenals",
    defaultOn: false,
  },
  lymphatic: {
    label: "Lymphatic",
    color: "#5cbf87",
    hint: "Spleen, thymus, nodes",
    defaultOn: false,
  },
  sensory: {
    label: "Eye & ear",
    color: "#57a8de",
    hint: "Orbit, globe, hearing",
    defaultOn: false,
  },
  integumentary: {
    label: "Skin & fascia",
    color: "#dfb198",
    hint: "Skin, fat, superficial fascia",
    defaultOn: false,
  },
};

export const SYSTEM_IDS = Object.keys(SYSTEM_META) as SystemId[];

export const REGION_META: Record<RegionId, { label: string }> = {
  head: { label: "Head" },
  neck: { label: "Neck" },
  thorax: { label: "Thorax" },
  abdomen: { label: "Abdomen" },
  malePelvis: { label: "Male pelvis" },
  femalePelvis: { label: "Female pelvis" },
  upperLimb: { label: "Upper limb" },
  lowerLimb: { label: "Lower limb" },
  back: { label: "Back" },
  perineum: { label: "Perineum" },
};

export const REGION_IDS = Object.keys(REGION_META) as RegionId[];

export const DEFAULT_SYSTEMS = Object.fromEntries(
  SYSTEM_IDS.map((id) => [id, SYSTEM_META[id].defaultOn]),
) as Record<SystemId, boolean>;
