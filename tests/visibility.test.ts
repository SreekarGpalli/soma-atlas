import assert from "node:assert/strict";
import { test } from "node:test";
import { useAtlasStore } from "@/store/useAtlasStore";
import { STRUCTURES, STRUCTURE_BY_ID, meshesFor } from "@/data/structures";
import { classifyTissue } from "@/lib/tissue";

test("selecting a peripheral nerve preserves its study filter", () => {
  const nerve = STRUCTURES.find(s => s.isLeafMesh && s.sex !== "female" && classifyTissue(s.name) === "nerve")!;
  assert.ok(nerve);
  useAtlasStore.setState({ tissueFocus: "nerve", regionFocus: "all", isolatedIds: [], hiddenIds: [] });
  useAtlasStore.getState().select(nerve.id);
  assert.equal(useAtlasStore.getState().tissueFocus, "nerve");
});
test("search selection escapes stale isolation, hiding and clipping", () => {
  const lung = STRUCTURES.find(s => s.sex !== "female" && /lung/i.test(s.name) && meshesFor(s.id).length)!;
  const meshes = meshesFor(lung.id);
  useAtlasStore.setState({ isolatedIds: ["old-selection"], hiddenIds: meshes, clipEnabled: true, regionFocus: "head", tissueFocus: "nerve" });
  useAtlasStore.getState().select(lung.id);
  const state = useAtlasStore.getState();
  assert.deepEqual(state.isolatedIds, meshes);
  assert.equal(state.hiddenIds.length, 0);
  assert.equal(state.clipEnabled, false);
  for (const id of meshes) assert.equal(state.systems[STRUCTURE_BY_ID[id].system], true);
});
test("restore all resets filters and enables every compatible system", () => {
  useAtlasStore.setState({ sex: "male", regionFocus: "head", tissueFocus: "vein", transparency: 1, muscleLayer: 1, clipEnabled: true });
  useAtlasStore.getState().resetVisibility();
  const state = useAtlasStore.getState();
  assert.equal(state.regionFocus, "all");
  assert.equal(state.tissueFocus, "all");
  assert.equal(state.transparency, 0);
  assert.equal(state.muscleLayer, 3);
  assert.equal(state.clipEnabled, false);
  assert.equal(state.systems.respiratory, true);
  assert.equal(state.systems.femaleReproductive, false);
});
