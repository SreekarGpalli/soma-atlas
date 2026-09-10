/**
 * Decide which Z-Anatomy objects to ingest.
 *
 * Z-Anatomy is derived from BodyParts3D, so most of it duplicates meshes this
 * atlas already ships. This picks the objects that add a structure we do not
 * have, resolves each to a catalog id, system and display name, and writes the
 * plan Blender then exports.
 *
 *   node scripts/plan-z-anatomy.mjs data/work/z-anatomy/za-objects.json
 *
 * Input is the object dump from scripts/dump-z-anatomy.py.
 * Output is data/work/z-anatomy/za-plan.json.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rd = (p) => JSON.parse(readFileSync(path.join(ROOT, p), "utf8"));

/* Z-Anatomy groups objects into nine numbered collections. Two of them are not
 * anatomical structures: muscle attachment footprints painted onto bone, and
 * body-surface regions, which TA2 counts as spaces rather than parts. */
const SYSTEM_OF = {
  "1: Skeletal system": "skeletal",
  "3: Joints": "skeletal",
  "4: Muscular system": "muscular",
  "5: Cardiovascular system": "cardiovascular",
  "6: Lymphoid organs": "lymphatic",
  "7: Nervous system & Sense organs": "nervous",
  "8: Visceral systems": "digestive",
};
const SKIP_COLLECTIONS = new Set(["2: Muscular insertions", "9: Regions of human body"]);

/* --------------------------------------------------------- name handling */

/** Z-Anatomy encodes side as a .l/.r suffix and optional structures in parens. */
function parseName(raw) {
  let n = raw.trim();
  const side = /\.(l|ol)$/i.test(n) ? "left" : /\.(r|or)$/i.test(n) ? "right" : null;
  n = n.replace(/\.(l|r|ol|or|m)$/i, "").replace(/\.\d{3}$/, "").trim();
  const optional = /^\(.*\)$/.test(n);
  if (optional) n = n.slice(1, -1).trim();
  if (!n) return null;
  const display = side ? `${side[0].toUpperCase()}${side.slice(1)} ${n[0].toLowerCase()}${n.slice(1)}` : n;
  return { base: n, side, optional, display };
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* Normalisation shared with scripts/coverage-matrix.mjs, so "do we already have
 * this?" is asked exactly the way coverage asks it. */
const DROP = new Set(["of", "the", "a", "an", "and", "left", "right", "set", "group",
  "part", "parts", "muscle", "muscles"]);
const KEEP = new Set(["pons", "thalamus", "plexus", "uterus", "humerus", "fundus", "sinus",
  "corpus", "ramus", "nucleus", "meatus", "hiatus", "os", "vas", "iris", "pancreas", "atlas"]);
const IRREGULAR = { nuclei: "nucleus", ganglia: "ganglion", cornua: "cornu", ostia: "ostium",
  crura: "crus", septa: "septum", labia: "labium", fossae: "fossa", laminae: "lamina",
  bursae: "bursa", teeth: "tooth", feet: "foot", vertebrae: "vertebra", arteriae: "artery",
  venae: "vein", nervi: "nerve", musculi: "muscle", rami: "ramus", sulci: "sulcus",
  gyri: "gyrus", ossa: "bone", digiti: "digit", tarsi: "tarsus" };

function tokens(text) {
  const out = [];
  for (let w of String(text ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ")) {
    if (!w) continue;
    if (IRREGULAR[w]) w = IRREGULAR[w];
    else if (!KEEP.has(w)) {
      if (w.endsWith("ies") && w.length > 4) w = `${w.slice(0, -3)}y`;
      else if (/(ch|sh|s|x|z)es$/.test(w) && w.length > 4) w = w.slice(0, -2);
      else if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) w = w.slice(0, -1);
    }
    if (!DROP.has(w)) out.push(w);
  }
  return out;
}
const keyOf = (t) => [...new Set(tokens(t))].sort().join(" ");

/* ------------------------------------------------------------------- plan */

const src = process.argv[2] ?? "data/work/z-anatomy/za-objects.json";
if (!existsSync(path.join(ROOT, src))) {
  console.error(`missing ${src} — run scripts/dump-z-anatomy.py through Blender first`);
  process.exit(1);
}
const objects = rd(src);

// What the atlas already ships from other sources, keyed the way coverage keys
// it. Rows from a previous Z-Anatomy merge are deliberately excluded: dedupe
// against them and re-planning an already-merged catalog would yield an empty
// plan, so the same plan comes out whether or not the merge has been run.
const male = rd("src/data/catalog-male.json");
const haveKeys = new Set();
const haveIds = new Set();
for (const r of male) {
  if (r.source === "z-anatomy") continue;
  haveIds.add(r.id);
  const k = keyOf(r.name);
  if (k) haveKeys.add(k);
}

const plan = [];
const seenId = new Set();
const stats = { total: objects.length, skippedCollection: 0, unnamed: 0, duplicate: 0,
  alreadyShipped: 0, kept: 0, curves: 0 };

for (const o of objects) {
  if (o.name.endsWith(".g")) continue; // Authored collection text, not anatomy.
  if (!o.system || SKIP_COLLECTIONS.has(o.system) || !SYSTEM_OF[o.system]) {
    stats.skippedCollection += 1;
    continue;
  }
  const parsed = parseName(o.name);
  // A handful of Z-Anatomy objects are working scratch ("?x", "????????").
  // They carry geometry but no identity, so they cannot become catalog rows.
  if (!parsed || parsed.base.includes("?") || parsed.base.length < 3) {
    stats.unnamed += 1;
    continue;
  }
  if (haveKeys.has(keyOf(parsed.display)) || haveKeys.has(keyOf(parsed.base))) {
    stats.alreadyShipped += 1;
    continue;
  }
  let id = slug(parsed.display);
  if (!id) { stats.unnamed += 1; continue; }
  if (haveIds.has(id) || seenId.has(id)) {
    // Same structure name twice in Z-Anatomy (a split mesh); keep both as parts.
    let i = 2;
    while (seenId.has(`${id}-${i}`) || haveIds.has(`${id}-${i}`)) i += 1;
    id = `${id}-${i}`;
    stats.duplicate += 1;
  }
  seenId.add(id);
  if (o.type === "CURVE") stats.curves += 1;
  stats.kept += 1;
  plan.push({
    object: o.name,
    id,
    name: parsed.display,
    system: SYSTEM_OF[o.system],
    type: o.type,
    optional: parsed.optional,
    zSystem: o.system,
  });
}

const out = path.join(ROOT, "data/work/z-anatomy/za-plan.json");
writeFileSync(out, JSON.stringify(plan, null, 1));

console.log("Z-Anatomy objects       ", stats.total);
console.log("  skipped (collection)  ", stats.skippedCollection);
console.log("  skipped (unnamed)     ", stats.unnamed);
console.log("  skipped (already here)", stats.alreadyShipped);
console.log("  KEPT                  ", stats.kept, `(${stats.curves} curves to convert)`);
console.log("  of which renamed      ", stats.duplicate);
const bySys = {};
for (const p of plan) bySys[p.system] = (bySys[p.system] ?? 0) + 1;
console.log("\nby target system:");
for (const [k, v] of Object.entries(bySys).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(16)} ${v}`);
console.log("\nwrote", path.relative(ROOT, out));
