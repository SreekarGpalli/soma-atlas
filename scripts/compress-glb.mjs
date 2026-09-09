import { readdir, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { draco, weld, dedup, prune, flatten, simplify } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import draco3d from "draco3dgltf";

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "draco3d.decoder": await draco3d.createDecoderModule(),
    "draco3d.encoder": await draco3d.createEncoderModule(),
  });

await MeshoptSimplifier.ready;

const ratio = Number(process.env.SIMPLIFY_RATIO || "0.55");
const srcDir = process.argv[2] || "data/work/glb";
const dstDir = process.argv[3] || "public/models";

async function walk(dir) {
  const out = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...(await walk(p)));
    else if (ent.name.endsWith(".glb")) out.push(p);
  }
  return out;
}

const files = await walk(srcDir);
if (!files.length) {
  console.log("no glbs in", srcDir);
  process.exit(0);
}

for (const file of files) {
  const rel = path.relative(srcDir, file);
  const dest = path.join(dstDir, rel);
  await mkdir(path.dirname(dest), { recursive: true });
  const before = (await stat(file)).size;
  const doc = await io.read(file);
  for (const texture of doc.getRoot().listTextures()) texture.dispose();
  await doc.transform(
    flatten(),
    dedup(),
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.002 }),
    prune(),
    draco({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
  );
  await io.write(dest, doc);
  const after = (await stat(dest)).size;
  console.log(
    `${rel}  ${(before / 1e6).toFixed(2)}MB → ${(after / 1e6).toFixed(2)}MB`,
  );
}

const publicModels = path.resolve(dstDir);
const manifest = { male: {}, female: {} };
try {
  for (const sex of ["male", "female"]) {
    const dir = path.join(publicModels, sex);
    const names = await readdir(dir).catch(() => []);
    for (const name of names) {
      if (!name.endsWith(".glb")) continue;
      manifest[sex][name.replace(/\.glb$/, "")] = `/models/${sex}/${name}`;
    }
  }
} catch {
  /* optional system folders */
}
if ((await stat(path.join(publicModels, "male-body.glb")).catch(() => null))) {
  manifest.maleBody = "/models/male-body.glb";
}
if ((await stat(path.join(publicModels, "female-pelvis.glb")).catch(() => null))) {
  manifest.femalePelvis = "/models/female-pelvis.glb";
}
await writeFile(
  path.join(publicModels, "manifest.json"),
  JSON.stringify(manifest, null, 2),
);
console.log("manifest", manifest);
