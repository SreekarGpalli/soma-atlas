import { STRUCTURES, STRUCTURE_BY_ID, meshesFor } from "@/data/structures";
import type { SexModule } from "./types";
/** Keep solid bronchopulmonary segments separate from hollow bronchial trees. */
export function isLungSurface(name: string) {
  return /bronchopulmonary segment/i.test(name) || (/\blungs?\b/i.test(name) && !/bronch|arter|vein|hilus|ligament|pleura/i.test(name));
}
/**
 * Walk meshes, not rows. A male BodyParts3D group and a female HRA mesh can
 * share an id; the catalog unions them and keeps the male row's non-leaf flag,
 * so filtering rows by isLeafMesh dropped 20 of the female lung segments and
 * left the female Lung shape view showing two blobs.
 */
export function lungMeshIds(sex: SexModule, mode: "lungs" | "airways") {
  const reference = STRUCTURES.filter(s => s.referenceOnly && s.isLeafMesh && s.sex === sex);
  if (mode === "lungs" && reference.length) return reference.map(s => s.id);
  const ids = new Set<string>();
  for (const s of STRUCTURES) {
    if (s.system !== "respiratory" || (s.sex !== "both" && s.sex !== sex)) continue;
    for (const mesh of s.meshIds ?? []) {
      const row = STRUCTURE_BY_ID[mesh];
      // A grouping row lists its children, never itself; isolating its id
      // would match nothing in the packs.
      if (row?.meshIds?.length && !row.meshIds.includes(mesh)) continue;
      const name = row?.name ?? mesh;
      const surface = isLungSurface(name);
      if (mode === "lungs" ? surface : /bronch|trachea/i.test(name) && !surface) ids.add(mesh);
    }
  }
  return [...ids];
}

/**
 * The male "Lungs" row unions 310 meshes of arteries, veins and bronchi with
 * the cutaway lung surfaces, so acting on it shows everything except a lung.
 * Selection, the mesh-count tag, Zoom to and Isolate must all resolve it the
 * same way or the card silently undoes what the search just showed.
 */
export function selectionMeshes(id: string, sex: SexModule): string[] {
  return meshesFor(id === "lungs" && sex === "male" ? "hra-male-lung-reference" : id);
}
