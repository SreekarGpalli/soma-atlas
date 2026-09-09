import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CATALOG_STATS,
  STRUCTURES,
  STRUCTURE_BY_ID,
  hasGeometry,
  meshesFor,
  searchStructures,
} from "@/data/structures";
import { NO_MESH_REASON } from "@/data/mesh-aliases";
import { SYSTEM_IDS } from "@/lib/systems";

describe("catalog", () => {
  it("loads a plausible number of structures", () => {
    assert.ok(CATALOG_STATS.structures > 4000, "expected >4000 structures");
    assert.equal(CATALOG_STATS.meshes, 2234 + 888 - overlapCount());
    assert.ok(CATALOG_STATS.curated >= 60, "high-yield notes should survive merge");
  });

  it("gives every structure a valid system and a summary", () => {
    for (const s of STRUCTURES) {
      assert.ok(SYSTEM_IDS.includes(s.system), `${s.id} has system ${s.system}`);
      assert.ok(s.summary && s.summary.length > 10, `${s.id} has no summary`);
    }
  });

  it("has no FMA upper-ontology rows left", () => {
    for (const id of [
      "anatomical-entity",
      "physical-anatomical-entity",
      "material-anatomical-entity",
      "anatomical-structure",
      "organ",
    ]) {
      assert.equal(STRUCTURE_BY_ID[id], undefined, `${id} should be dropped`);
    }
  });

  it("resolves every mesh reference to a real structure", () => {
    for (const s of STRUCTURES) {
      for (const m of s.meshIds ?? []) {
        assert.ok(STRUCTURE_BY_ID[m], `${s.id} references unknown mesh ${m}`);
      }
    }
  });

  it("classifies organs into the right systems", () => {
    // "thyroid" is BodyParts3D's id for the thyroid *cartilage* (FMA55099),
    // which is laryngeal, not endocrine.
    const expected: [string, string][] = [
      ["left-lung", "respiratory"],
      ["heart", "cardiovascular"],
      ["brain", "nervous"],
      ["liver", "digestive"],
      ["spleen", "lymphatic"],
      ["thyroid", "respiratory"],
    ];
    for (const [id, system] of expected) {
      const s = STRUCTURE_BY_ID[id];
      assert.ok(s, `${id} missing from catalog`);
      assert.equal(s.system, system, `${id} should be ${system}`);
    }
  });

  it("keeps the skeletal system to actual skeletal structures", () => {
    // The original catalog used skeletal as a catch-all: lungs, eyeballs and
    // cranial nerves all lived there.
    const skeletal = STRUCTURES.filter((s) => s.system === "skeletal");
    const wrong = skeletal.filter((s) =>
      /\b(lung|bronch|alveol|eyeball|retina|cornea|cerebrum|cerebellum)\b/i.test(
        s.name,
      ),
    );
    assert.deepEqual(
      wrong.map((s) => s.name),
      [],
      "non-skeletal structures are still tagged skeletal",
    );
  });
});

describe("high-yield notes", () => {
  it("does not attach a note to an unrelated mesh", () => {
    // These ids collide with BodyParts3D mesh slugs for different structures.
    const wrongPairs: [string, RegExp][] = [
      ["thyroid", /cartilage/i],
      ["tibia", /tibialis/i],
      ["deltoid", /artery|branch/i],
    ];
    for (const [id, wrong] of wrongPairs) {
      const s = STRUCTURE_BY_ID[id];
      if (!s?.curated) continue;
      assert.ok(
        !wrong.test(s.name),
        `curated note "${id}" merged onto "${s.name}"`,
      );
    }
  });

  it("keeps the curated note reachable and top-ranked by name", () => {
    for (const [query, expected] of [
      ["tibia", "Tibia"],
      ["deltoid", "Deltoid"],
      ["thyroid gland", "Thyroid gland"],
    ] as const) {
      const [first] = searchStructures(query, { limit: 1 });
      assert.equal(first?.name, expected, `"${query}" should find ${expected}`);
    }
  });
});

describe("mesh resolution", () => {
  it("points curated notes at real geometry where it exists", () => {
    for (const id of ["cranium", "thoracic-cage", "quadriceps", "eye", "heart"]) {
      assert.ok(hasGeometry(id), `${id} should resolve to meshes`);
    }
  });

  it("declares a reason when a note has no geometry", () => {
    for (const [id, reason] of Object.entries(NO_MESH_REASON)) {
      const s = STRUCTURE_BY_ID[id];
      if (!s) continue;
      if (meshesFor(id).length === 0) {
        assert.equal(
          s.missingMeshReason,
          reason,
          `${id} should explain why it has no mesh`,
        );
      }
    }
  });

  it("never returns a phantom mesh id", () => {
    // meshesFor used to fall back to [id] for grouping rows that own no
    // geometry, which selected nothing and highlighted nothing.
    for (const s of STRUCTURES) {
      for (const m of meshesFor(s.id)) {
        assert.ok(STRUCTURE_BY_ID[m], `${s.id} yields phantom mesh ${m}`);
      }
    }
  });
});

describe("search", () => {
  it("ranks the exact structure first", () => {
    for (const [query, expected] of [
      ["heart", "Heart"],
      ["left lung", "Left lung"],
      ["liver", "Liver"],
    ] as const) {
      const [first] = searchStructures(query, { limit: 1 });
      assert.equal(first?.name, expected, `"${query}" should find ${expected}`);
    }
  });

  it("matches clinical prose, not just names", () => {
    const hits = searchStructures("intercostal space", { limit: 20 });
    assert.ok(hits.length > 0, "clinical notes should be searchable");
  });

  it("respects the module filter", () => {
    const male = searchStructures("uterus", { sex: "male", limit: 20 });
    assert.equal(
      male.filter((s) => s.sex === "female").length,
      0,
      "female-only structures must not appear in the male module",
    );
  });

  it("returns nothing for gibberish rather than everything", () => {
    assert.equal(searchStructures("zzzqqqxx").length, 0);
  });

  it("is bounded by limit", () => {
    assert.ok(searchStructures("a", { limit: 5 }).length <= 5);
  });
});

/** Structures present in both packs are counted once. */
function overlapCount() {
  const leaves = STRUCTURES.filter((s) => s.isLeafMesh);
  return 2234 + 888 - new Set(leaves.map((s) => s.id)).size;
}
