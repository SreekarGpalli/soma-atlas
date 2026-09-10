/** Remove six verified Z-Anatomy collection-label meshes, preserving all other geometry. */
import { readFileSync, writeFileSync } from "node:fs";
const file = "src/data/catalog-male.json";
const rows = JSON.parse(readFileSync(file));
const ids = new Set(["joints-g", "lymphoid-organs-g", "muscular-system-g", "nervous-system-sense-organs-g", "skeletal-system-g", "visceral-systems-g"]);
// Edit only GLB JSON: preserve compressed vertex buffers byte-for-byte.
const master = "public/models/male-body.glb";
const buf = readFileSync(master), len = buf.readUInt32LE(12);
const json = JSON.parse(buf.subarray(20, 20 + len).toString());
let removed = 0;
for (const n of json.nodes ?? []) if (ids.has(n.name)) { delete n.mesh; delete n.name; removed++; }
const raw = Buffer.from(JSON.stringify(json));
const padded = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 32); raw.copy(padded);
const header = Buffer.from(buf.subarray(0, 20));
const tail = buf.subarray(20 + len);
header.writeUInt32LE(20 + padded.length + tail.length, 8); header.writeUInt32LE(padded.length, 12);
writeFileSync(master, Buffer.concat([header, padded, tail]));
const kept = rows.filter(r => !ids.has(r.id)), positions = new Map(kept.map((r,i) => [r.id,i]));
for (const r of kept) if (r.m) r.m = r.m.map(i => positions.get(rows[i]?.id)).filter(i => i !== undefined);
writeFileSync(file, JSON.stringify(kept));
console.log(`Removed ${removed} collection labels; retained mesh buffers and remapped catalog indices.`);
