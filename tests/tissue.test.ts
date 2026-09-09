import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyTissue } from "@/lib/tissue";

test("vessel views retain cerebral vessels without turning central tissue into nerves", () => {
  for (const name of ["Anterior cerebral artery", "Superior cerebellar artery"]) assert.equal(classifyTissue(name), "artery");
  assert.equal(classifyTissue("Internal cerebral vein"), "vein");
  assert.equal(classifyTissue("Median nerve"), "nerve");
  for (const name of ["Nucleus of facial nerve", "Choroid plexus", "Aortic valve", "Sinoatrial node"]) assert.equal(classifyTissue(name), "other");
});
