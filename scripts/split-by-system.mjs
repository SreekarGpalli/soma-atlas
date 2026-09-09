/**
 * Re-split the master body GLBs into per-system packs using the corrected
 * catalog taxonomy.
 *
 *   node scripts/split-by-system.mjs
 *
 * The previous packs followed the old catch-all `system` field, so the male
 * "respiratory" pack held 5 meshes while the lungs sat inside a 3.7 MB
 * "skeletal" pack. Turning on a system filter therefore downloaded the wrong
 * file and showed nothing. This regenerates every pack from
 * public/models/{male-body,female-pelvis}.glb, which stay untouched.
 */
import { mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { draco, dedup, prune } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "draco3d.decoder": await draco3d.createDecoderModule(),
    "draco3d.encoder": await draco3d.createEncoderModule(),
  });

const PACKS = [
  {
    sex: "male",
    master: "public/models/male-body.glb",
    catalog: "src/data/catalog-male.json",
    outDir: "public/models/male",
  },
  {
    sex: "female",
    master: "public/models/female-pelvis.glb",
    catalog: "src/data/catalog-female.json",
    outDir: "public/models/female",
  },
];

const manifest = { male: {}, female: {} };

for (const pack of PACKS) {
  const rows = JSON.parse(
    await import("node:fs/promises").then((fs) =>
      fs.readFile(path.join(ROOT, pack.catalog), "utf8"),
    ),
  );
  const systemOf = new Map(rows.map((r) => [r.id, r.system]));

  // Which systems actually have meshes in this master?
  const probe = await io.read(path.join(ROOT, pack.master));
  const present = new Map();
  for (const node of probe.getRoot().listNodes()) {
    const sys = systemOf.get(node.getName());
    if (!sys) continue;
    present.set(sys, (present.get(sys) ?? 0) + 1);
  }
  probe.dispose?.();

  await mkdir(path.join(ROOT, pack.outDir), { recursive: true });
  console.log(`\n=== ${pack.sex}: ${present.size} systems`);

  for (const [system, count] of [...present].sort((a, b) => b[1] - a[1])) {
    const doc = await io.read(path.join(ROOT, pack.master));
    for (const node of doc.getRoot().listNodes()) {
      if (systemOf.get(node.getName()) !== system) {
        node.dispose();
      }
    }
    // The viewer assigns its own system-coloured materials, so baked textures
    // are pure download weight.
    for (const texture of doc.getRoot().listTextures()) texture.dispose();
    await doc.transform(dedup(), prune(), draco({ method: "edgebreaker" }));

    const dest = path.join(ROOT, pack.outDir, `${system}.glb`);
    await writeFile(dest, await io.writeBinary(doc));
    const kb = Math.round((await stat(dest)).size / 1024);
    manifest[pack.sex][system] = `/models/${pack.sex}/${system}.glb`;
    console.log(`  ${system.padEnd(20)} ${String(count).padStart(5)} meshes  ${String(kb).padStart(6)} KB`);
  }
}

manifest.maleBody = "/models/male-body.glb";
manifest.femalePelvis = "/models/female-pelvis.glb";
await writeFile(
  path.join(ROOT, "public/models/manifest.json"),
  JSON.stringify(manifest, null, 2),
  "utf8",
);
console.log("\nwrote public/models/manifest.json");
