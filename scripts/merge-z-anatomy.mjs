/**
 * Merge the exported Z-Anatomy meshes into the male master and register them in
 * the catalog.
 *
 *   node scripts/merge-z-anatomy.mjs
 *
 * Z-Anatomy is derived from BodyParts3D and shares its coordinate space, so the
 * two sit in one body without re-registration. Where both have a structure the
 * BodyParts3D mesh wins — its ids are what the hand-written notes, aliases and
 * quizzes already point at — so only the objects scripts/plan-z-anatomy.mjs
 * marked as additions are merged.
 *
 * The BodyParts3D-only master is copied to data/backup/models first. Run
 * `npm run data:split` afterwards to rebuild the per-system packs.
 *
 * Rows are appended, never inserted, and classified here rather than by a later
 * `data:taxonomy` pass. Both matter: 1,752 catalog rows carry their mesh group
 * as an array of *positions* in this file (`m`), so inserting would repoint them
 * at the wrong meshes, and rebuild-taxonomy.mjs reads `meshIds`, which the
 * compacted rows no longer have — re-running it would flatten every group.
 */
import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { draco, dedup, mergeDocuments, prune, unpartition } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import { classifyRegion, classifySystem } from "./taxonomy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MASTER = path.join(ROOT, "public/models/male-body.glb");
const Z_GLB = path.join(ROOT, "data/work/z-anatomy/z-male.glb");
const PLAN = path.join(ROOT, "data/work/z-anatomy/za-plan.json");
const CATALOG = path.join(ROOT, "src/data/catalog-male.json");
const BACKUP = path.join(ROOT, "data/backup/models/male-body.bodyparts3d.glb");

for (const [label, file] of [["master", MASTER], ["Z-Anatomy export", Z_GLB], ["plan", PLAN]]) {
  if (!existsSync(file)) {
    console.error(`missing ${label}: ${path.relative(ROOT, file)}`);
    process.exit(1);
  }
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "draco3d.decoder": await draco3d.createDecoderModule(),
    "draco3d.encoder": await draco3d.createEncoderModule(),
  });

const plan = JSON.parse(await readFile(PLAN, "utf8"));
const planById = new Map(plan.map((p) => [p.id, p]));

/* ------------------------------------------------------------- merge GLBs */

const master = await io.read(MASTER);
const before = master.getRoot().listNodes().filter((n) => n.getMesh()).length;

const existing = new Set(master.getRoot().listNodes().map((n) => n.getName()));
const zdoc = await io.read(Z_GLB);
// Capture the names before merging — merge() rehomes the nodes into the master.
const incoming = zdoc.getRoot().listNodes().filter((n) => n.getMesh()).map((n) => n.getName());

const clash = incoming.filter((n) => existing.has(n));
if (clash.length) {
  console.error(`refusing to merge: ${clash.length} node names already in the master`);
  console.error(`  ${clash.slice(0, 10).join(", ")}`);
  process.exit(1);
}

if (!existsSync(path.dirname(BACKUP))) await mkdir(path.dirname(BACKUP), { recursive: true });
if (!existsSync(BACKUP)) {
  await copyFile(MASTER, BACKUP);
  console.log("backed up BodyParts3D-only master ->", path.relative(ROOT, BACKUP));
}

mergeDocuments(master, zdoc);

// mergeDocuments brings the source scene across; fold its nodes into ours.
const scenes = master.getRoot().listScenes();
const primary = scenes[0];
for (const scene of scenes.slice(1)) {
  for (const node of scene.listChildren()) {
    scene.removeChild(node);
    primary.addChild(node);
  }
  scene.dispose();
}

// unpartition first: the merge leaves two buffers and GLB allows only one.
await master.transform(unpartition(), dedup(), prune(), draco());
await writeFile(MASTER, await io.writeBinary(master));

const after = master.getRoot().listNodes().filter((n) => n.getMesh()).length;
console.log(`master nodes: ${before} -> ${after}  (+${after - before})`);

/* ---------------------------------------------------------- catalog rows */

const rows = JSON.parse(await readFile(CATALOG, "utf8"));
const known = new Set(rows.map((r) => r.id));
const added = [];
for (const id of incoming) {
  const entry = planById.get(id);
  if (!entry || known.has(id)) continue;
  added.push({
    id,
    name: entry.name,
    system: classifySystem(entry.name, entry.system),
    region: classifyRegion(entry.name),   // its own default is a valid region; "trunk" is not
    sex: "both",
    source: "z-anatomy",
  });
  known.add(id);
}
await writeFile(CATALOG, JSON.stringify([...rows, ...added], null, 0));
console.log(`catalog rows: ${rows.length} -> ${rows.length + added.length}  (+${added.length})`);
console.log("\nnext: npm run data:split && npm run data:verify && npm run data:coverage");
