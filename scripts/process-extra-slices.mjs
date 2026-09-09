import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "public", "slices");
await mkdir(outDir, { recursive: true });

const jobs = [
  ["data/work/mri/m_vm1125.t1.png", "mri-male-head.jpg"],
  ["data/work/mri/m_vm3532.t1.png", "mri-male-thorax.jpg"],
  ["data/work/mri/m_vm4512.t1.png", "mri-male-abdomen.jpg"],
  ["data/work/mri/m_vm5480.t1.png", "mri-male-pelvis.jpg"],
  ["data/work/ct/c_vm1125.fro.png", "ct-male-head.jpg"],
  ["data/work/ct/c_vm1449.fro.png", "ct-male-thorax.jpg"],
  ["data/work/ct/c_vm1674.fro.png", "ct-male-abdomen.jpg"],
  ["data/work/ct/c_vm1945.fro.png", "ct-male-pelvis.jpg"],
  ["data/work/ct/c_vm2295.fro.png", "ct-male-thigh.jpg"],
];

for (const [src, dest] of jobs) {
  await sharp(path.join(root, src))
    .rotate()
    .resize({ width: 1200, withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(path.join(outDir, dest));
  console.log("wrote", dest);
}
