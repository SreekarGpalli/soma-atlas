import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { flatten, prune, dedup, weld, cloneDocument } from "@gltf-transform/functions";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "data/raw/3d-vh-f-united.glb");
const CROSSWALK = path.join(ROOT, "data/raw/hra-crosswalk.csv");
const OUT_DIR = path.join(ROOT, "data/work/glb");
const CATALOG = path.join(ROOT, "src/data/catalog-female.json");

const maleCatalog = JSON.parse(
  await readFile(path.join(ROOT, "src/data/catalog-male.json"), "utf8"),
);
const maleIds = new Set(maleCatalog.map((r) => r.id));

const HIGH_YIELD = {
  VH_F_uterus: "uterus",
  VH_F_cervix: "cervix",
  VH_F_left_ovary: "ovary-left",
  VH_F_right_ovary: "ovary-right",
  VH_F_vagina: "vagina",
  VH_F_fallopian_tube_L: "uterine-tube",
  VH_F_fallopian_tube_R: "uterine-tube-right",
  VH_F_broad_ligament: "broad-ligament",
  VH_F_pelvis: "female-pelvis-bone",
  VH_F_urinary_bladder: "female-bladder",
  VH_F_mammary_gland_L: "breast",
  VH_F_mammary_gland_R: "breast-right",
};

const SYSTEM_RULES = [
  ["femaleReproductive", ["uterus", "ovary", "vagina", "cervix", "fallopian", "uterine", "mammary", "breast", "nipple", "areola", "placenta", "round_ligament_of_uterus", "uterosacral", "cardinal", "mesosalpinx", "mesovarium", "fimbria"]],
  ["maleReproductive", ["prostate", "testis", "penis"]],
  ["sensory", ["eye", "retina", "cornea", "lens", "iris", "sclera", "optic"]],
  ["nervous", ["brain", "spinal", "nerve", "cortex", "gyrus", "putamen", "hypothalamus", "colliculus"]],
  ["cardiovascular", ["heart", "aorta", "vein", "artery", "ventricle", "atrium", "vena", "coronary", "vasculature"]],
  ["lymphatic", ["lymph", "spleen", "thymus"]],
  ["muscular", ["muscle", "rectus_femoris", "tendon"]],
  ["respiratory", ["lung", "trachea", "bronch", "larynx", "carina"]],
  ["urinary", ["kidney", "ureter", "bladder", "renal", "calyx"]],
  ["digestive", ["liver", "stomach", "intestin", "colon", "ileum", "jejunum", "duodenum", "pancreas", "gallbladder", "bile", "rectum", "appendix", "caecum", "cecum"]],
  ["endocrine", ["thyroid", "adrenal", "pineal"]],
  ["skeletal", ["pelvis", "sacrum", "coccyx", "pubis", "ilium", "ischium", "vertebra", "femur", "tibia", "fibula", "patella", "knee", "ligament", "meniscus"]],
  ["integumentary", ["skin", "integument"]],
];

const REGION_RULES = [
  ["head", ["brain", "eye", "optic", "gyrus"]],
  ["neck", ["cervical", "thyroid", "larynx"]],
  ["thorax", ["heart", "lung", "trachea", "breast", "mammary", "thymus", "aorta"]],
  ["abdomen", ["liver", "kidney", "colon", "intestin", "pancreas", "spleen", "stomach"]],
  ["femalePelvis", ["uterus", "ovary", "vagina", "cervix", "fallopian", "pelvis", "bladder", "pubis", "ilium", "ischium"]],
  ["lowerLimb", ["femur", "tibia", "knee", "patella", "fibula"]],
  ["back", ["vertebra", "spinal", "sacrum", "coccyx"]],
];

function slug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "structure";
}

function classify(name, rules, fallback) {
  const n = name.toLowerCase();
  for (const [label, keys] of rules) {
    if (keys.some((k) => n.includes(k))) return label;
  }
  return fallback;
}

function parseCsv(text) {
  const map = new Map();
  for (const line of text.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const [node, ontology, label] = line.split(",");
    if (node) map.set(node.trim(), { ontology: (ontology || "").trim(), label: (label || node).trim() });
  }
  return map;
}

function boundsOf(doc) {
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const acc = prim.getAttribute("POSITION");
      if (!acc) continue;
      const arr = acc.getArray();
      if (!arr) continue;
      for (let i = 0; i < arr.length; i += 3) {
        min[0] = Math.min(min[0], arr[i]);
        min[1] = Math.min(min[1], arr[i + 1]);
        min[2] = Math.min(min[2], arr[i + 2]);
        max[0] = Math.max(max[0], arr[i]);
        max[1] = Math.max(max[1], arr[i + 1]);
        max[2] = Math.max(max[2], arr[i + 2]);
      }
    }
  }
  return { min, max };
}

function transformPositions(doc, origin, scale) {
  const seen = new Set();
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const acc = prim.getAttribute("POSITION");
      if (!acc || seen.has(acc)) continue;
      seen.add(acc);
      const arr = acc.getArray();
      if (!arr) continue;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] = (arr[i] - origin[0]) * scale;
        arr[i + 1] = (arr[i + 1] - origin[1]) * scale;
        arr[i + 2] = (arr[i + 2] - origin[2]) * scale;
      }
      acc.setArray(arr);
    }
  }
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

console.log("reading", SRC);
const doc = await io.read(SRC);
const crosswalk = parseCsv(await readFile(CROSSWALK, "utf8"));

await doc.transform(flatten());

const used = new Set();
const catalog = [];
const bySystem = new Map();

for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const rawName = node.getName() || mesh.getName() || "";
  if (rawName.startsWith("VH_M_")) {
    mesh.dispose();
    node.setMesh(null);
    continue;
  }
  const meta = crosswalk.get(rawName);
  const label = meta?.label || rawName.replace(/^VH_F_/, "").replaceAll("_", " ");
  const high = HIGH_YIELD[rawName];
  let id = high || slug(label);
  if (!high) {
    if (maleIds.has(id)) id = `f-${id}`;
    let n = id;
    let i = 2;
    while (used.has(n) || (!high && maleIds.has(n) && n === id)) {
      n = `${id}-${i++}`;
    }
    id = n;
  }
  used.add(id);
  mesh.setName(id);
  node.setName(id);
  const system = classify(`${rawName} ${label}`, SYSTEM_RULES, "skeletal");
  const region = classify(`${rawName} ${label}`, REGION_RULES, "femalePelvis");
  catalog.push({
    id,
    name: label[0] ? label[0].toUpperCase() + label.slice(1) : id,
    system,
    region,
    sex: "female",
    aliases: rawName !== id ? [rawName] : [],
    summary: `Human Reference Atlas female structure: ${label}. Real female mesh from the Visible Human Female / HuBMAP 3D reference organ set v1.5.`,
    fmaId: meta?.ontology || undefined,
    source: "hra",
    layer: 1,
  });
  if (!bySystem.has(system)) bySystem.set(system, []);
  bySystem.get(system).push(id);
}

await doc.transform(prune(), dedup(), weld());

const { min, max } = boundsOf(doc);
const height = max[1] - min[1] || 1;
const scale = height > 10 ? 0.001 : height > 3 ? 1.7 / height : 1;
const origin = [(min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2];
console.log("hra bbox", { min, max, height, scale });
transformPositions(doc, origin, scale);

await mkdir(path.join(OUT_DIR, "female"), { recursive: true });
await mkdir(OUT_DIR, { recursive: true });

await io.write(path.join(OUT_DIR, "female-pelvis.glb"), doc);
console.log("wrote female-pelvis.glb meshes", catalog.length);

for (const [system, ids] of bySystem) {
  const keep = new Set(ids);
  const part = cloneDocument(doc);
  for (const mesh of part.getRoot().listMeshes()) {
    if (!keep.has(mesh.getName())) mesh.dispose();
  }
  await part.transform(prune());
  if (!part.getRoot().listMeshes().length) continue;
  await io.write(path.join(OUT_DIR, "female", `${system}.glb`), part);
  console.log("female", system, ids.length);
}

await writeFile(CATALOG, JSON.stringify(catalog, null, 2));
console.log("female catalog", catalog.length);
