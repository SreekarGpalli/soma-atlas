/**
 * Reclassify + compact the generated catalogs.
 *
 *   node scripts/rebuild-taxonomy.mjs [--dry]
 *
 * - drops FMA upper-ontology rows (they aggregate thousands of meshes and
 *   swamp search with things like "Material anatomical entity")
 * - reclassifies system + region from each structure's own name
 * - drops the templated summary and duplicate aliases, which the app rebuilds
 *   at runtime; this is most of the JSON weight
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ONTOLOGY_ROOTS,
  classifyRegion,
  classifySystem,
  generatedSummary,
} from "./taxonomy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");

async function rebuild(file) {
  const p = path.join(ROOT, "src/data", file);
  const rows = JSON.parse(await readFile(p, "utf8"));
  const before = JSON.stringify(rows).length;

  const kept = [];
  const moved = [];
  for (const row of rows) {
    if (ONTOLOGY_ROOTS.has(row.id)) continue;

    const system = classifySystem(row.name, row.system);
    const region = classifyRegion(row.name, row.region);
    if (system !== row.system) moved.push([row.name, row.system, system]);

    const aliases = (row.aliases ?? []).filter(
      (a) => a !== row.fmaId && a !== row.elementId && a !== row.id,
    );

    const out = {
      id: row.id,
      name: row.name,
      system,
      region,
      sex: row.sex,
      ...(aliases.length ? { aliases } : {}),
      ...(row.fmaId ? { fmaId: row.fmaId } : {}),
      ...(row.elementId ? { elementId: row.elementId } : {}),
      ...(row.source ? { source: row.source } : {}),
      ...(row.layer && row.layer !== 1 ? { layer: row.layer } : {}),
    };

    // Only carry a summary when it is not the template the app can rebuild.
    const templated = generatedSummary(
      row.name,
      row.system,
      row.fmaId,
      row.source,
    );
    if (row.summary && row.summary !== templated) out.summary = row.summary;

    // Carried through the index-encoding pass below, then dropped.
    out.meshIds = row.meshIds ?? [row.id];

    kept.push(out);
  }

  // Mesh ids average ~26 characters and repeat across 46k references, which
  // was over half the shipped JSON. Store positions in this array instead;
  // src/data/structures.ts resolves them back on load.
  const position = new Map(kept.map((r, i) => [r.id, i]));
  const final = [];
  for (const row of kept) {
    const refs = (row.meshIds ?? [])
      .map((m) => position.get(m))
      .filter((i) => i !== undefined);
    delete row.meshIds;
    // A row that is only its own mesh needs no list at all.
    const selfOnly = refs.length === 1 && refs[0] === position.get(row.id);
    if (refs.length && !selfOnly) row.m = refs;
    final.push(row);
  }

  const json = JSON.stringify(final);
  const dist = {};
  for (const r of final) dist[r.system] = (dist[r.system] ?? 0) + 1;

  console.log(`\n=== ${file}`);
  console.log(
    `rows ${rows.length} -> ${final.length} (dropped ${rows.length - final.length} ontology roots)`,
  );
  console.log(
    `bytes ${(before / 1e6).toFixed(2)}MB -> ${(json.length / 1e6).toFixed(2)}MB`,
  );
  console.log(`reclassified ${moved.length} rows`);
  console.log(
    Object.entries(dist)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `  ${k.padEnd(20)} ${v}`)
      .join("\n"),
  );

  if (!DRY) await writeFile(p, JSON.stringify(final, null, 0), "utf8");
  return { moved, final };
}

const male = await rebuild("catalog-male.json");
await rebuild("catalog-female.json");

console.log("\n=== sample reclassifications");
for (const [name, from, to] of male.moved.slice(0, 30)) {
  console.log(`  ${from.padEnd(16)} -> ${to.padEnd(18)} ${name}`);
}
if (DRY) console.log("\n(dry run — nothing written)");
