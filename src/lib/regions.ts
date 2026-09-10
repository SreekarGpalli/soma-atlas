import { STRUCTURE_BY_ID } from "@/data/structures";
import maleCatalog from "@/data/catalog-male.json";
import femaleCatalog from "@/data/catalog-female.json";
import { classifyTissue } from "@/lib/tissue";
import { REGION_IDS, SYSTEM_IDS } from "@/lib/systems";
import type { RegionId, SexModule, SystemId, TissueFocus } from "./types";

/**
 * Picking a region used to be able to empty the canvas.
 *
 * Two different things looked identical to a student: a region the datasets
 * genuinely do not cover in this view (there are no lungs in an upper limb),
 * and a region that is full of geometry the current layer choice happens to
 * hide (male pelvis is entirely reproductive and cardiovascular, and neither
 * is on by default, so the Overview showed nothing at all). Both produced the
 * same blank screen with no way to tell which had happened.
 *
 * So the region controls now ask this module first. A region with nothing to
 * show in this view is offered as unavailable rather than as a dead end, and a
 * region that is merely hidden switches its own layers on when it is chosen.
 */

interface Leaf {
  region: RegionId;
  system: SystemId;
  tissue: string;
  module: SexModule;
}

/**
 * Indexed from the per-module catalogs, not from the merged STRUCTURES list.
 * The merge unions rows that share an id and widens `sex` to "both", so the
 * merged tag says a male pelvic mesh belongs to the female module too — where
 * its geometry is not in any loaded pack. The catalog a row came from is the
 * only reliable statement of which module actually ships it.
 *
 * Classifying tissue is a regex pass per name and both region controls re-read
 * this on every render, so flatten once at module load.
 */
type CatalogLeaf = { region: string; system: string; name: string; m?: number[]; referenceOnly?: boolean };
function index(rows: CatalogLeaf[], module: SexModule): Leaf[] {
  return rows
    .filter((r) => !r.m && !r.referenceOnly)
    .map((r) => ({
      region: r.region as RegionId,
      system: r.system as SystemId,
      tissue: classifyTissue(r.name),
      module,
    }));
}

const LEAVES: Leaf[] = [
  ...index(maleCatalog as CatalogLeaf[], "male"),
  ...index(femaleCatalog as CatalogLeaf[], "female"),
];

export interface RegionAvailability {
  /** Meshes this region shows with the layers that are on right now. */
  visible: number;
  /** Meshes this region could show in this view if every layer were on. */
  available: number;
}

function matches(leaf: Leaf, sex: SexModule, region: RegionId, tissue: TissueFocus) {
  return (
    leaf.region === region &&
    leaf.module === sex &&
    (tissue === "all" || leaf.tissue === tissue)
  );
}

/** Counts per region for the view described by `sex`, `systems` and `tissue`. */
export function regionAvailability(
  sex: SexModule,
  systems: Record<SystemId, boolean>,
  tissue: TissueFocus,
): Record<RegionId, RegionAvailability> {
  const out = Object.fromEntries(
    REGION_IDS.map((r) => [r, { visible: 0, available: 0 }]),
  ) as Record<RegionId, RegionAvailability>;
  for (const leaf of LEAVES) {
    if (leaf.module !== sex) continue;
    if (tissue !== "all" && leaf.tissue !== tissue) continue;
    const slot = out[leaf.region];
    if (!slot) continue;
    slot.available++;
    if (systems[leaf.system] !== false) slot.visible++;
  }
  return out;
}

/**
 * Layers to switch on so a chosen region actually shows its contents. Returns
 * null when the current layers already show something, so choosing a region
 * never disturbs a view the student has deliberately set up.
 */
export function systemsRevealing(
  sex: SexModule,
  region: RegionId | "all",
  systems: Record<SystemId, boolean>,
  tissue: TissueFocus,
): Record<SystemId, boolean> | null {
  if (region === "all") return null;
  let visible = 0;
  const needed = new Set<SystemId>();
  for (const leaf of LEAVES) {
    if (!matches(leaf, sex, region, tissue)) continue;
    if (systems[leaf.system] !== false) visible++;
    else needed.add(leaf.system);
  }
  if (visible > 0 || !needed.size) return null;
  return Object.fromEntries(
    SYSTEM_IDS.map((id) => [id, systems[id] !== false || needed.has(id)]),
  ) as Record<SystemId, boolean>;
}

/**
 * Whether an isolated set should survive a move to `region`.
 *
 * Isolation used to be kept unconditionally inside the lung views so that
 * narrowing to Thorax did not throw the lungs away. But choosing Head kept the
 * twenty lung meshes isolated too, so the canvas went blank with no hint of
 * why — the classic "I clicked something and got stuck". Isolation is worth
 * keeping only while it still has something to show where you are going.
 */
export function isolationSurvives(isolatedIds: string[], region: RegionId | "all"): boolean {
  if (!isolatedIds.length) return false;
  if (region === "all") return true;
  return isolatedIds.some((id) => STRUCTURE_BY_ID[id]?.region === region);
}
