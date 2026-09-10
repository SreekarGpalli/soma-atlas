/**
 * Checks that the catalogs and the GLB packs still agree.
 *
 *   node scripts/verify-data.mjs
 *
 * The original app shipped with mesh names, catalog ids and per-system packs
 * silently out of step — lungs classified as skeletal, high-yield notes
 * pointing at meshes that did not exist, ontology roots owning 2,234 meshes.
 * None of it failed loudly. This does.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { ONTOLOGY_ROOTS } from "./taxonomy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(path.join(ROOT, p), "utf8"));

const problems = [];
const warnings = [];
const fail = (m) => problems.push(m);
const warn = (m) => warnings.push(m);

/** Node names out of a GLB without decoding any geometry. */
function glbNodeNames(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file} is not a GLB`);
  const jsonLength = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString("utf8"));
  return (json.nodes ?? []).map((n) => n.name).filter(Boolean);
}

const male = read("src/data/catalog-male.json");
const female = read("src/data/catalog-female.json");
const manifest = read("public/models/manifest.json");
const all = [...male, ...female];
const byId = new Map(all.map((r) => [r.id, r]));

console.log(`catalog: ${male.length} male + ${female.length} female rows`);

// 1. No ontology roots crept back in.
for (const row of all) {
  if (ONTOLOGY_ROOTS.has(row.id)) {
    fail(`ontology root still present: ${row.id}`);
  }
}

// 2. Every meshId resolves to a real row.
let danglingMeshRefs = 0;
for (const row of all) {
  for (const m of row.meshIds ?? []) {
    if (!byId.has(m)) danglingMeshRefs += 1;
  }
}
if (danglingMeshRefs) fail(`${danglingMeshRefs} meshIds point at unknown rows`);

// 3. Required fields.
const SYSTEMS = new Set([
  "skeletal", "muscular", "cardiovascular", "nervous", "respiratory",
  "digestive", "urinary", "maleReproductive", "femaleReproductive",
  "endocrine", "lymphatic", "sensory", "integumentary",
]);
const REGIONS = new Set([
  "head", "neck", "thorax", "abdomen", "malePelvis", "femalePelvis",
  "upperLimb", "lowerLimb", "back", "perineum",
]);
for (const row of all) {
  if (!row.id || !row.name) fail(`row missing id or name: ${JSON.stringify(row).slice(0, 80)}`);
  if (!SYSTEMS.has(row.system)) fail(`${row.id}: bad system "${row.system}"`);
  if (!REGIONS.has(row.region)) fail(`${row.id}: bad region "${row.region}"`);
  if (!["both", "male", "female"].includes(row.sex)) {
    fail(`${row.id}: bad sex "${row.sex}"`);
  }
}

// 4. Duplicate ids inside a single pack would shadow each other.
for (const [label, rows] of [["male", male], ["female", female]]) {
  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.id)) fail(`${label} catalog has duplicate id ${r.id}`);
    seen.add(r.id);
  }
}

// 5. Every GLB node has a catalog row, and sits in the pack its system names.
for (const sex of ["male", "female"]) {
  const dir = path.join(ROOT, "public/models", sex);
  if (!existsSync(dir)) {
    fail(`missing model directory public/models/${sex}`);
    continue;
  }
  const rows = sex === "male" ? male : female;
  const systemOf = new Map(rows.map((r) => [r.id, r.system]));
  let nodes = 0;
  let unnamed = 0;
  let misplaced = 0;

  for (const file of readdirSync(dir).filter((f) => f.endsWith(".glb"))) {
    const system = file.replace(/\.glb$/, "");
    if (!SYSTEMS.has(system)) {
      fail(`public/models/${sex}/${file} is not named after a system`);
      continue;
    }
    if (!manifest[sex]?.[system]) {
      fail(`manifest is missing ${sex}.${system} but the file exists`);
    }
    for (const name of glbNodeNames(path.join(dir, file))) {
      nodes += 1;
      const owner = systemOf.get(name);
      if (!owner) unnamed += 1;
      else if (owner !== system) misplaced += 1;
    }
  }

  console.log(`${sex}: ${nodes} mesh nodes across the packs`);
  if (unnamed) fail(`${sex}: ${unnamed} GLB nodes have no catalog row`);
  if (misplaced) {
    fail(`${sex}: ${misplaced} GLB nodes are in the wrong system pack — re-run npm run data:split`);
  }
}

// 6. Every manifest entry resolves to a file on disk.
for (const sex of ["male", "female"]) {
  for (const [system, url] of Object.entries(manifest[sex] ?? {})) {
    if (!existsSync(path.join(ROOT, "public", url.split("?")[0].replace(/^\//, "")))) {
      fail(`manifest points at a missing file: ${url}`);
    }
    if (!SYSTEMS.has(system)) fail(`manifest has unknown system "${system}"`);
  }
}

// 7. Slices referenced by the app exist.
const sliceSrc = [
  ...readFileSync(path.join(ROOT, "src/data/slices.ts"), "utf8").matchAll(
    /src:\s*"([^"]+)"/g,
  ),
].map((m) => m[1]);
for (const src of sliceSrc) {
  if (!existsSync(path.join(ROOT, "public", src.replace(/^\//, "")))) {
    warn(`slice image missing: ${src}`);
  }
}

// 8. High-yield notes should reach geometry or declare why not.
const highYield = readFileSync(path.join(ROOT, "src/data/high-yield.ts"), "utf8");
const noteIds = [...highYield.matchAll(/^\s{4}id: "([^"]+)"/gm)].map((m) => m[1]);
const aliasSrc = readFileSync(path.join(ROOT, "src/data/mesh-aliases.ts"), "utf8");
const aliased = new Set(
  [...aliasSrc.matchAll(/^\s{2}"?([a-zA-Z0-9-]+)"?:\s*\[/gm)].map((m) => m[1]),
);
const excused = new Set(
  [...aliasSrc.matchAll(/^\s{2}"?([a-zA-Z0-9-]+)"?:\s*"/gm)].map((m) => m[1]),
);
const orphans = noteIds.filter(
  (id) => !byId.has(id) && !aliased.has(id) && !excused.has(id),
);
if (orphans.length) {
  warn(
    `${orphans.length} high-yield notes reach no geometry and give no reason: ${orphans.join(", ")}`,
  );
}

// ---------------------------------------------------------------------------
// The service worker serves the model packs cache-first and never revalidates
// them, so a stale MEDIA_VERSION ships new geometry that returning browsers
// never see. Catch it here rather than in a bug report.

{
  const stamp = spawnSync(
    process.execPath,
    [path.join(ROOT, "scripts/stamp-media-version.mjs"), "--check"],
    { encoding: "utf8" },
  );
  if (stamp.status !== 0) {
    fail(
      `service worker MEDIA_VERSION is stale — run \`npm run media:stamp\`. ${(
        stamp.stderr || ""
      ).trim().split("\n")[0]}`,
    );
  }
}

for (const w of warnings) console.warn(`warn  ${w}`);
for (const p of problems) console.error(`FAIL  ${p}`);

if (problems.length) {
  console.error(`\n${problems.length} problem(s).`);
  process.exit(1);
}
console.log(`\nok — ${warnings.length} warning(s), no failures.`);
