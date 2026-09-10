import assert from "node:assert/strict";
import { test } from "node:test";
import { useAtlasStore } from "@/store/useAtlasStore";
import { lungMeshIds, isLungSurface, selectionMeshes } from "@/lib/lung-views";
import { STRUCTURE_BY_ID, searchStructures } from "@/data/structures";
import { regionAvailability, systemsRevealing } from "@/lib/regions";
import { DEFAULT_SYSTEMS, REGION_IDS, SYSTEM_IDS } from "@/lib/systems";
import type { SystemId, TissueFocus } from "@/lib/types";

const ALL_SYSTEMS = Object.fromEntries(SYSTEM_IDS.map(id => [id, true])) as Record<SystemId, boolean>;
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

test("no region a student can choose leads to an empty canvas", () => {
  // Every enabled region option must show something once its own layers are
  // revealed; a region with nothing in the view is offered as unavailable.
  const views: { name: string; systems: SystemId[]; tissue: TissueFocus }[] = [
    { name: "Overview", systems: [], tissue: "all" },
    { name: "Organs", systems: ["respiratory", "digestive", "urinary", "endocrine"], tissue: "all" },
    { name: "Arteries", systems: ["cardiovascular"], tissue: "artery" },
    { name: "Veins", systems: ["cardiovascular"], tissue: "vein" },
    { name: "Nerves", systems: ["nervous"], tissue: "nerve" },
    { name: "Skeleton", systems: ["skeletal"], tissue: "all" },
  ];
  for (const sex of ["male", "female"] as const) {
    for (const view of views) {
      const systems = view.systems.length
        ? (Object.fromEntries(SYSTEM_IDS.map(id => [id, view.systems.includes(id)])) as Record<SystemId, boolean>)
        : { ...DEFAULT_SYSTEMS };
      const availability = regionAvailability(sex, systems, view.tissue);
      for (const region of REGION_IDS) {
        if (!availability[region].available) continue;
        const revealed = systemsRevealing(sex, region, systems, view.tissue) ?? systems;
        const shown = regionAvailability(sex, revealed, view.tissue)[region].visible;
        assert.ok(shown > 0, `${sex} / ${view.name} / ${region} offered but shows nothing`);
      }
    }
  }
});

test("the male module offers no female pelvis and vice versa", () => {
  assert.equal(regionAvailability("male", ALL_SYSTEMS, "all").femalePelvis.available, 0);
  assert.equal(regionAvailability("female", ALL_SYSTEMS, "all").malePelvis.available, 0);
  // Male pelvis is real in the male module, just hidden by the default layers.
  assert.ok(regionAvailability("male", ALL_SYSTEMS, "all").malePelvis.available > 0);
  assert.equal(regionAvailability("male", DEFAULT_SYSTEMS, "all").malePelvis.visible, 0);
  assert.ok(systemsRevealing("male", "malePelvis", DEFAULT_SYSTEMS, "all") !== null);
});

test("search forgives spacing, British spelling and everyday names", () => {
  const first = (q: string, sex: "male" | "female" = "male") =>
    searchStructures(q, { sex, limit: 1 })[0]?.name ?? "";
  // The mesh is "Gallbladder"; students write two words.
  assert.match(first("gall bladder"), /gallbladder/i);
  // BodyParts3D spells it both ways; either spelling must reach both rows.
  assert.ok(searchStructures("oesophagus", { sex: "male" }).length >= 2);
  assert.ok(searchStructures("esophagus", { sex: "male" }).length >= 2);
  assert.match(first("caecum"), /cecum/i);
  assert.match(first("sterno cleido mastoid"), /sternocleidomastoid/i);
  assert.match(first("windpipe"), /trachea/i);
  assert.match(first("kneecap"), /patella/i);
  assert.match(first("womb", "female"), /uterus/i);
  // A literal name must still outrank the loosened matches.
  assert.match(first("femur"), /^femur$/i);
});

test("a prose mention is not passed off as a name match", () => {
  // The urinary bladder's clinical note mentions the uterus; in the male
  // module that used to be the top answer for "uterus".
  assert.equal(searchStructures("uterus", { sex: "male", namesOnly: true }).length, 0);
  assert.ok(searchStructures("uterus", { sex: "female", namesOnly: true }).length > 0);
});
