import assert from "node:assert/strict";
import { test } from "node:test";
import { useAtlasStore } from "@/store/useAtlasStore";
import { lungMeshIds, isLungSurface, selectionMeshes } from "@/lib/lung-views";
import { STRUCTURE_BY_ID } from "@/data/structures";
test("lung surface and airway selections are separate and nonempty in both modules", () => {
  for (const sex of ["male", "female"] as const) {
    const surfaces = lungMeshIds(sex, "lungs"), airways = lungMeshIds(sex, "airways");
    assert.ok(surfaces.length > 0); assert.ok(airways.length > 0);
    assert.equal(airways.some(id => surfaces.includes(id)), false);
    assert.ok(surfaces.every(id => isLungSurface(STRUCTURE_BY_ID[id].name)));
  }
  assert.equal(isLungSurface("Inferior lobe of left lung"), true);
  assert.equal(isLungSurface("Right medial bronchopulmonary segment"), true);
  assert.equal(isLungSurface("Segmental bronchus of left lung"), false);
});
test("Back restores filters and selection; Home resets to an accessible overview", () => {
  useAtlasStore.setState({ viewHistory: [], tissueFocus: "nerve", regionFocus: "head", viewName: "Nerves", selectedIds: [], hiddenIds: ["example"] });
  useAtlasStore.getState().navigateView({ tissueFocus: "vein", regionFocus: "all", viewName: "Veins", hiddenIds: [] });
  useAtlasStore.getState().backView();
  const back = useAtlasStore.getState();
  assert.equal(back.tissueFocus, "nerve"); assert.equal(back.regionFocus, "head"); assert.deepEqual(back.hiddenIds, ["example"]);
  back.homeView();
  const home = useAtlasStore.getState();
  assert.equal(home.viewName, "Overview"); assert.equal(home.regionFocus, "all"); assert.equal(home.tissueFocus, "all"); assert.equal(home.hiddenIds.length, 0);
});

test("male Lungs search selects the HRA surface set, not hundreds of internal structures", () => {
  useAtlasStore.setState({ sex: "male", isolatedIds: [], hiddenIds: [] });
  useAtlasStore.getState().select("lungs");
  const s = useAtlasStore.getState();
  assert.equal(s.selectedIds.length, 20);
  assert.deepEqual(s.isolatedIds, s.selectedIds);
  assert.ok(s.selectedIds.every(id => STRUCTURE_BY_ID[id].referenceOnly));
});

test("the card acts on the same meshes the selection shows", () => {
  useAtlasStore.setState({ sex: "male", isolatedIds: [], hiddenIds: [] });
  useAtlasStore.getState().select("lungs");
  // Isolate and Zoom to read selectionMeshes; if they diverged from select()
  // they would restore the 310-mesh vessel mixture over the lung surfaces.
  assert.deepEqual(selectionMeshes("lungs", "male"), useAtlasStore.getState().selectedIds);
  assert.equal(selectionMeshes("lungs", "female").length > 0, true);
});
