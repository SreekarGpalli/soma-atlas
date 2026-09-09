import sharp from "sharp";
import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "public", "slices");
await mkdir(outDir, { recursive: true });

const jobs = [
  ["data/work/vh-male/a_vm1125.png", "vh-male-head.jpg"],
  ["data/work/vh-male/a_vm1450.png", "vh-male-thorax.jpg"],
  ["data/work/vh-male/a_vm1675.png", "vh-male-abdomen.jpg"],
  ["data/work/vh-male/a_vm1950.png", "vh-male-pelvis.jpg"],
  ["data/work/vh-male/a_vm2300.png", "vh-male-knee.jpg"],
  ["data/work/vh-male/a_vm2825.png", "vh-male-foot.jpg"],
  ["data/work/vh-female/avf1067a.png", "vh-female-5.jpg"],
  ["data/work/vh-female/avf1588a.png", "vh-female-2.jpg"],
  ["data/work/vh-female/avf1588b.png", "vh-female-3.jpg"],
  ["data/work/vh-female/avf1588c.png", "vh-female-4.jpg"],
  ["data/work/vh-female/avf2680a.png", "vh-female-1.jpg"],
];

for (const [src, dest] of jobs) {
  const input = path.join(root, src);
  const output = path.join(outDir, dest);
  await sharp(input)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .jpeg({ quality: 72, mozjpeg: true })
    .toFile(output);
  console.log("wrote", dest);
}

await copyFile(
  path.join(root, "public/icons/icon.svg"),
  path.join(root, "public/icons/icon.svg"),
);

const svg = path.join(root, "public/icons/icon.svg");
const iconDir = path.join(root, "public/icons");
for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(path.join(iconDir, name));
  console.log("wrote", name);
}
