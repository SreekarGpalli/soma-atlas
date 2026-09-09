/**
 * Coverage of this atlas against Terminologia Anatomica 2nd ed. (FIPAT 2019),
 * the international standard inventory of gross anatomy.
 *
 * The earlier version of this script compared BodyParts3D against BodyParts3D
 * and so always reported 100%. This one measures against an outside reference,
 * and counts a structure as present only when a GLB node carrying real
 * triangles exists for it — a catalog row on its own is not coverage.
 *
 *   node scripts/coverage-matrix.mjs
 *
 * Writes data/coverage-matrix.json (full matrix), data/coverage-matrix.csv (one
 * row per TA2 term), docs/coverage-snapshot.md (readable summary, committed so
 * it diffs) and appends a row to data/coverage-history.csv so coverage over
 * time is visible in the log. Also prints the summary.
 *
 * Method and error bar: docs/anatomy-coverage.md
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rd = (p) => JSON.parse(readFileSync(path.join(ROOT, p), "utf8"));

/* ------------------------------------------------------------------ meshes */

function glbJson(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file} is not a GLB`);
  return JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString("utf8"));
}

/** Every mesh node in the shipped packs, with its real triangle count. */
function shippedMeshes() {
  const out = [];
  for (const sex of ["male", "female"]) {
    const dir = path.join(ROOT, "public/models", sex);
    if (!existsSync(dir)) continue;
    const catalog = new Map(rd(`src/data/catalog-${sex}.json`).map((r) => [r.id, r]));
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".glb"))) {
      const json = glbJson(path.join(dir, file));
      const acc = json.accessors ?? [];
      for (const node of json.nodes ?? []) {
        if (node.mesh === undefined) continue;
        const mesh = json.meshes[node.mesh];
        let tris = 0;
        for (const prim of mesh.primitives ?? []) {
          if (prim.indices !== undefined) tris += (acc[prim.indices]?.count ?? 0) / 3;
        }
        const id = node.name ?? mesh.name;
        const row = catalog.get(id);
        out.push({
          sex,
          pack: file.replace(/\.glb$/, ""),
          id,
          tris: Math.round(tris),
          name: row?.name ?? id,
          fmaId: row?.fmaId ?? null,
          system: row?.system ?? null,
          source: row?.source ?? "unknown",
        });
      }
    }
  }
  return out;
}

/* ------------------------------------------------------- name normalisation */

// Words that carry no identity: side, collective wrappers, articles. "muscle"
// is here because TA2 writes "Sartorius muscle" where BodyParts3D writes
// "Right sartorius" — the head noun is redundant, the rest is distinctive.
const DROP = new Set(["of", "the", "a", "an", "and", "left", "right", "set", "group",
  "part", "parts", "muscle", "muscles"]);
// Words whose trailing s belongs to the stem.
const KEEP = new Set(["pons", "thalamus", "plexus", "uterus", "humerus", "fundus", "sinus",
  "corpus", "ramus", "nucleus", "meatus", "hiatus", "os", "vas", "iris", "pancreas", "atlas"]);
const IRREGULAR = {
  nuclei: "nucleus", ganglia: "ganglion", cornua: "cornu", ostia: "ostium", crura: "crus",
  septa: "septum", labia: "labium", fossae: "fossa", laminae: "lamina", bursae: "bursa",
  teeth: "tooth", feet: "foot", vertebrae: "vertebra", arteriae: "artery", venae: "vein",
  nervi: "nerve", musculi: "muscle", rami: "ramus", sulci: "sulcus", gyri: "gyrus",
  ossa: "bone", digiti: "digit", tarsi: "tarsus",
};

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
const keyOf = (text) => [...new Set(tokens(text))].sort().join(" ");

/* ------------------------------------------------------ TA2 classification */

// A feature of another structure, or a space between structures. No 3D atlas
// gives these their own mesh, so they are not part of the denominator when
// asking "is this part present?".
const FEATURE = /\b(margin|border|surface|crest|line|ridge|notch|incisure|impression|eminence|tubercle|tuberosity|trochanter|epicondyle|condyle|process|spine|fossa|foramen|foramina|canal|canaliculus|meatus|aperture|hiatus|sulcus|groove|fissure|facet|fovea|shaft|pole|hilum|hilus|axis|plane|point|junction)\b|\b(arch|neck|head|body|base|apex|angle|root|border) of\b/i;
const SPACE = /\b(cavity|cavities|space|spaces|recess|region|compartment|triangle|pouch|lumen|interval)\b|\b(fold|fornix|vestibule) of\b/i;
// Abstract classes and collectives rather than a nameable part.
const ABSTRACT = /^(bone|joint|muscle|nerve|artery|vein|gland|organ|tooth|vertebra|rib|cartilage|ligament|tendon|membrane|septum|fascia|skeleton|viscus|vessel)s?$|^(long|short|flat|irregular|sesamoid|pneumatized|pneumatised|membranous|endochondral|accessory|supernumerary|primary|secondary|synovial|fibrous|cartilaginous|simple|composite|compound|fusiform|straight|triangular|quadrate|unipennate|bipennate|multipennate|orbicular|sphincter|dilator|skeletal|striated|smooth|two-bellied|two-headed|three-headed|four-headed)\b.*\b(bone|joint|muscle|cartilage|tooth)s?$/i;

// TA2 prints section headers in capitals, but many of them name one real organ
// or bone (FEMUR, HEART, DIAPHRAGM) rather than a group. Only treat a capitalised
// row as a group header when it reads like one: "X OF Y", a plural collective,
// or an explicit grouping noun.
const GROUPING = /\bof\b|\b(system|part|skeleton|column|girdle|cavity|region|group|complex)\b/i;
function isGroupHeader(en) {
  if (GROUPING.test(en)) return true;
  const last = en.toLowerCase().split(/\s+/).pop() ?? "";
  return last.endsWith("s") && !last.endsWith("ss") && !KEEP.has(last);
}

function classify(row) {
  const en = row.enUS || row.enUK || "";
  if (!en) return "blank";
  const caps = en === en.toUpperCase() && /[A-Z]/.test(en);
  if (caps && isGroupHeader(en)) return "heading";
  if (row.chapter === 1) return "general";
  if (ABSTRACT.test(en.trim())) return "abstract";
  if (SPACE.test(en)) return "space";
  if (FEATURE.test(en)) return "feature";
  return "structure";
}

/**
 * Buckets the report breaks structure coverage down by. Order matters: the
 * first regex to hit wins, so vessels are tested before nerves or a venous
 * plexus would be counted as nervous tissue.
 */
const KIND = [
  ["vein / venous sinus", /\b(vein|veins|venous|venule|vena)\b/i],
  ["artery", /\b(artery|arteries|arterial|arteriole|aorta|aortic)\b/i],
  ["lymphatic", /\b(lymph|lymphoid|lymphatic|spleen|splenic|thymus|tonsil)\b/i],
  ["brain / spinal cord / meninges", /\b(nucleus|nuclei|cortex|gyrus|gyri|cerebral|cerebellar|cerebellum|brain|medulla|pons|thalamus|hypothalamus|hippocampus|amygdala|spinal cord|tract|fasciculus|lemniscus|commissure|decussation|dura|arachnoid|pia|choroid plexus)\b/i],
  ["nerve / plexus / ganglion", /\b(nerve|nerves|plexus|ganglion|ganglionic|rootlet)\b/i],
  ["muscle / tendon", /\b(muscle|muscles|muscular|tendon|aponeurosis|belly)\b/i],
  ["ligament / capsule", /\b(ligament|ligaments|capsule|retinaculum|raphe|meniscus|labrum)\b/i],
  ["bone / cartilage / joint", /\b(bone|vertebra|rib|sternum|cartilage|skull|maxilla|mandible|femur|tibia|fibula|humerus|radius|ulna|scapula|clavicle|patella|sacrum|coccyx|carpal|tarsal|metacarpal|metatarsal|phalanx|ilium|ischium|pubis|joint|symphysis|suture)\b/i],
  ["gland / endocrine", /\b(gland|glands|glandular|thyroid|parathyroid|adrenal|suprarenal|pituitary|hypophysis|pineal|islet)\b/i],
  ["eye / ear / sense organ", /\b(eye|eyeball|retina|cornea|sclera|iris|lens|ear|cochlea|labyrinth|tympanic|malleus|incus|stapes|olfactory|papilla)\b/i],
  ["viscus (thorax / abdomen / pelvis)", /\b(heart|atrium|ventricle|valve|lung|bronchus|bronchi|trachea|larynx|pharynx|oesophagus|esophagus|stomach|duodenum|jejunum|ileum|colon|caecum|cecum|rectum|anus|liver|hepatic|gallbladder|bile|pancreas|kidney|renal|ureter|bladder|urethra|uterus|ovary|testis|prostate|penis|vagina|epididymis|seminal)\b/i],
  ["skin / fascia / soft tissue", /\b(skin|dermis|epidermis|hair|nail|fascia|fat|bursa|sheath|integument|breast|mammary)\b/i],
];
const kindOf = (name) => KIND.find(([, re]) => re.test(name))?.[0] ?? "other";

/* ---------------------------------------------------------------- matching */

const ta2 = (() => {
  const rows = rd("data/ta2-terms.json");
  const seen = new Set();                       // endnote pages can repeat an id
  return rows.filter((r) => !seen.has(r.id) && seen.add(r.id));
})();

const meshes = shippedMeshes();
const byKey = new Map();
const tokenSets = [];
for (const m of meshes) {
  const k = keyOf(m.name);
  if (!k) continue;
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k).push(m);
  tokenSets.push({ set: new Set(tokens(m.name)), mesh: m });
}

// Too generic to carry a subset match on their own.
const GENERIC = new Set(["bone", "muscle", "nerve", "artery", "vein", "joint", "cartilage",
  "ligament", "tooth", "vertebra", "gland", "part", "branch", "tissue", "body", "cavity"]);

function look(row) {
  const variants = [row.enUS, row.enUK, ...(row.enSyn ? row.enSyn.split(";") : [])]
    .map((s) => (s || "").trim())
    .filter(Boolean);
  for (const v of variants) {
    const hit = byKey.get(keyOf(v));
    if (hit) return { match: "exact", meshes: hit };
  }
  // Partial: every word of the TA2 term appears in a mesh name, so the mesh is
  // that structure named more specifically ("Deltoid" -> "Acromial part of
  // right deltoid"). Generic-only terms are skipped or everything would match.
  for (const v of variants) {
    const t = tokens(v);
    if (!t.length || !t.some((w) => !GENERIC.has(w))) continue;
    const found = tokenSets.filter((o) => t.every((w) => o.set.has(w)));
    if (found.length) return { match: "partial", meshes: found.map((f) => f.mesh) };
  }
  return { match: "none", meshes: [] };
}

const matrix = ta2.map((row) => {
  const cls = classify(row);
  const name = row.enUS || row.enUK || row.latin;
  const res = cls === "structure" ? look(row) : { match: "n/a", meshes: [] };
  return {
    ta2Id: row.id,
    name,
    latin: row.latin,
    chapter: row.chapter,
    chapterName: row.chapterName,
    class: cls,
    kind: cls === "structure" ? kindOf(name) : null,
    match: res.match,
    meshCount: res.meshes.length,
    meshes: res.meshes.slice(0, 4).map((m) => `${m.sex}:${m.id}`),
    sexes: [...new Set(res.meshes.map((m) => m.sex))],
  };
});

/* ----------------------------------------------------------------- reports */

const structures = matrix.filter((r) => r.class === "structure");
const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : "-");

function group(rows, keyFn) {
  const g = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!g.has(k)) g.set(k, { total: 0, exact: 0, partial: 0, missing: [] });
    const b = g.get(k);
    b.total += 1;
    if (r.match === "exact") b.exact += 1;
    else if (r.match === "partial") b.partial += 1;
    else b.missing.push(r.name);
  }
  return g;
}

const byChapter = group(structures, (r) => `${String(r.chapter).padStart(2, "0")} ${r.chapterName}`);
const byKind = group(structures, (r) => r.kind);

const matchedMeshIds = new Set();
for (const r of matrix) for (const m of r.meshes) matchedMeshIds.add(m);

const report = {
  generatedAt: new Date().toISOString(),
  reference: {
    name: "Terminologia Anatomica 2nd ed. (FIPAT 2019)",
    citation: "FIPAT. Terminologia Anatomica. 2nd ed. FIPAT.library.dal.ca, 2019.",
    totalTerms: ta2.length,
    counted: {
      structure: structures.length,
      feature: matrix.filter((r) => r.class === "feature").length,
      space: matrix.filter((r) => r.class === "space").length,
      abstract: matrix.filter((r) => r.class === "abstract").length,
      heading: matrix.filter((r) => r.class === "heading").length,
      general: matrix.filter((r) => r.class === "general").length,
    },
  },
  shipped: {
    meshNodes: meshes.length,
    distinctNames: new Set(meshes.map((m) => m.name)).size,
    distinctKeys: byKey.size,
    triangles: meshes.reduce((a, m) => a + m.tris, 0),
    male: meshes.filter((m) => m.sex === "male").length,
    female: meshes.filter((m) => m.sex === "female").length,
    unmatchedMeshes: meshes.filter((m) => !matchedMeshIds.has(`${m.sex}:${m.id}`)).length,
    bySource: [...meshes.reduce((acc, m) => acc.set(m.source, (acc.get(m.source) ?? 0) + 1), new Map())]
      .sort((a, b) => b[1] - a[1]),
  },
  coverage: {
    structuresTotal: structures.length,
    exact: structures.filter((r) => r.match === "exact").length,
    partial: structures.filter((r) => r.match === "partial").length,
    missing: structures.filter((r) => r.match === "none").length,
  },
  byChapter: [...byChapter].sort().map(([k, v]) => ({
    chapter: k,
    total: v.total,
    exact: v.exact,
    partial: v.partial,
    missing: v.total - v.exact - v.partial,
    pct: Number(((100 * (v.exact + v.partial)) / v.total).toFixed(1)),
    missingExamples: v.missing.slice(0, 30),
  })),
  byKind: [...byKind].sort((a, b) => b[1].total - a[1].total).map(([k, v]) => ({
    kind: k,
    total: v.total,
    exact: v.exact,
    partial: v.partial,
    missing: v.total - v.exact - v.partial,
    pct: Number(((100 * (v.exact + v.partial)) / v.total).toFixed(1)),
    missingExamples: v.missing.slice(0, 40),
  })),
  matrix,
};

writeFileSync(path.join(ROOT, "data/coverage-matrix.json"), JSON.stringify(report, null, 2));

const csv = ["ta2Id,name,chapter,class,kind,match,meshCount,meshes"];
for (const r of matrix) {
  csv.push([r.ta2Id, JSON.stringify(r.name), r.chapter, r.class, r.kind ?? "",
    r.match, r.meshCount, JSON.stringify(r.meshes.join(" "))].join(","));
}
writeFileSync(path.join(ROOT, "data/coverage-matrix.csv"), csv.join("\n"));

/* ------------------------------------------- committed snapshot and history */

const day = report.generatedAt.slice(0, 10);
const covered = report.coverage.exact + report.coverage.partial;
const md = [
  "# Coverage snapshot",
  "",
  `Generated ${day} by \`npm run data:coverage\`. Do not edit by hand — the method`,
  "is in [anatomy-coverage.md](anatomy-coverage.md), the sources in",
  "[mesh-sources.md](mesh-sources.md).",
  "",
  `**${covered} of ${report.reference.counted.structure} Terminologia Anatomica structures — ` +
    `${pct(covered, report.coverage.structuresTotal)} candidate name matches.** ${report.coverage.missing} terms have no automatic match.`,
  "This is a heuristic inventory, not validated anatomical completeness. Exact and partial matches need geometry review; unmatched terms may have differently named geometry. Counts retain the existing denominator for comparison.",
  "",
  "| | |",
  "|---|---|",
  `| Reference | ${report.reference.name} |`,
  `| TA2 terms | ${report.reference.totalTerms} (${report.reference.counted.structure} modelable) |`,
  `| Meshes shipped | ${report.shipped.meshNodes} (${report.shipped.male} male + ${report.shipped.female} female) |`,
  `| Distinct mesh names | ${report.shipped.distinctNames} |`,
  `| Triangles | ${report.shipped.triangles.toLocaleString("en-US")} |`,
  `| Exact matches | ${report.coverage.exact} |`,
  `| Partial matches | ${report.coverage.partial} |`,
  "",
  "## By TA2 chapter",
  "",
  "| Ch. | Chapter | Structures | Covered | Missing | % |",
  "|---:|---|---:|---:|---:|---:|",
  ...report.byChapter.map((r) => {
    const m = r.chapter.match(/^(\d+)\s+(.*)$/);
    return `| ${m ? m[1] : ""} | ${m ? m[2] : r.chapter} | ${r.total} | ${r.exact + r.partial} | ${r.missing} | ${r.pct}% |`;
  }),
  "",
  "## By kind of structure",
  "",
  "| Kind | Structures | Covered | Missing | % |",
  "|---|---:|---:|---:|---:|",
  ...report.byKind.map((r) => `| ${r.kind} | ${r.total} | ${r.exact + r.partial} | ${r.missing} | ${r.pct}% |`),
  "",
  "## Mesh sources in the shipped packs",
  "",
  "| Source | Meshes |",
  "|---|---:|",
  ...[...report.shipped.bySource].map(([s, n]) => `| ${s} | ${n} |`),
  "",
].join("\n");
writeFileSync(path.join(ROOT, "docs/coverage-snapshot.md"), md);

const histPath = path.join(ROOT, "data/coverage-history.csv");
const histHead = "timestamp,sources,structuresTotal,exact,partial,covered,missing,pct,meshNodes,distinctNames,triangles";
const metrics = [report.coverage.structuresTotal, report.coverage.exact,
  report.coverage.partial, covered, report.coverage.missing,
  ((100 * covered) / report.coverage.structuresTotal).toFixed(1),
  report.shipped.meshNodes, report.shipped.distinctNames, report.shipped.triangles];
const sources = report.shipped.bySource.map(([s, n]) => `${s}:${n}`).join(" ");
const prior = existsSync(histPath)
  ? readFileSync(histPath, "utf8").trim().split("\n").filter((l) => l && l !== histHead)
  : [];
// A row per real change. Re-running with nothing moved would otherwise add a
// row every time and bury the changes that matter.
const last = prior.at(-1)?.split(",").slice(1).join(",");
const next = [sources, ...metrics].join(",");
if (last !== next) prior.push(`${report.generatedAt},${next}`);
writeFileSync(histPath, [histHead, ...prior].join("\n") + "\n");

const c = report.coverage;
const n = report.reference.counted;
console.log(`Reference : ${report.reference.name}`);
console.log(`            ${ta2.length} terms -> ${structures.length} modelable structures`);
console.log(`            excluded: ${n.feature} landmarks, ${n.space} spaces, ${n.abstract} abstract classes, ${n.heading} headings, ${n.general} general-anatomy terms`);
console.log(`Shipped   : ${report.shipped.meshNodes} GLB meshes, ${report.shipped.distinctNames} distinct names, ${report.shipped.triangles.toLocaleString()} triangles`);
console.log(`Coverage  : ${c.exact} exact + ${c.partial} partial of ${c.structuresTotal} = ${pct(c.exact + c.partial, c.structuresTotal)}   MISSING ${c.missing}`);

console.log("\nBy TA2 chapter");
for (const r of report.byChapter) {
  console.log(`  ${r.chapter.padEnd(26)} ${String(r.exact + r.partial).padStart(4)}/${String(r.total).padStart(4)}  ${String(r.pct).padStart(5)}%  missing ${r.missing}`);
}
console.log("\nBy structure kind");
for (const r of report.byKind) {
  console.log(`  ${r.kind.padEnd(36)} ${String(r.exact + r.partial).padStart(4)}/${String(r.total).padStart(4)}  ${String(r.pct).padStart(5)}%  missing ${r.missing}`);
}
console.log("\nwrote data/coverage-matrix.json and data/coverage-matrix.csv");
