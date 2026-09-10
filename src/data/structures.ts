import type { Structure, SystemId } from "@/lib/types";
import { HIGH_YIELD } from "./high-yield";
import { MESH_ALIASES, NO_MESH_REASON } from "./mesh-aliases";
import maleCatalog from "./catalog-male.json";
import femaleCatalog from "./catalog-female.json";

/**
 * Rows as they sit on disk. `scripts/rebuild-taxonomy.mjs` strips every field
 * the app can rebuild — the templated summary, aliases that just repeat the
 * ids, and mesh references, which are stored as positions in `m` rather than
 * as repeated id strings. That took the catalogs from 3.3 MB to 1.35 MB.
 */
type CatalogRow = {
  id: string;
  name: string;
  system: SystemId;
  region: Structure["region"];
  sex: Structure["sex"];
  aliases?: string[];
  summary?: string;
  fmaId?: string;
  elementId?: string;
  referenceOnly?: boolean;
  source?: Structure["source"];
  layer?: number;
  /** Indices into this row's own catalog file. */
  m?: number[];
};

/** Resolve `m` indices back to mesh ids, per file. */
function expand(rows: CatalogRow[]): { row: CatalogRow; meshIds: string[] }[] {
  return rows.map((row) => ({
    row,
    meshIds: row.m ? row.m.map((i) => rows[i]?.id).filter(Boolean) : [row.id],
  }));
}

const generated = [
  ...expand(maleCatalog as CatalogRow[]),
  ...expand(femaleCatalog as CatalogRow[]),
];

/** Mirrors generatedSummary() in scripts/taxonomy.mjs. */
function describe(row: CatalogRow): string {
  const src =
    row.source?.startsWith("hra")
      ? `Human Reference Atlas (${row.source})`
      : "BodyParts3D 4.0";
  const system = row.system
    .replace("maleReproductive", "male reproductive")
    .replace("femaleReproductive", "female reproductive");
  return `${src} structure: ${row.name}${
    row.fmaId ? ` (${row.fmaId})` : ""
  }. ${system} anatomy.`;
}

function fromRow(row: CatalogRow, meshIds: string[]): Structure {
  return {
    id: row.id,
    name: row.name,
    system: row.system,
    region: row.region,
    sex: row.sex,
    aliases: row.aliases,
    summary: row.summary ?? describe(row),
    fmaId: row.fmaId,
    source: row.source,
    layer: row.layer ?? 1,
    meshIds,
    isLeafMesh: Boolean(row.elementId) || !row.m,
    referenceOnly: row.referenceOnly,
  };
}

/**
 * Two names refer to the same thing once side and parentheticals are ignored,
 * so "Right femur" hosts the "Femur" note but "Right tibialis anterior" does
 * not host "Tibia".
 */
function normaliseName(n: string): string {
  return n
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/^\s*(left|right)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function namesAgree(a: string, b: string): boolean {
  return normaliseName(a) === normaliseName(b);
}

/**
 * Merge a hand-written note onto a generated row. The note always wins for
 * prose and teaching fields; the generated row always wins for geometry.
 */
function applyNote(base: Structure, note: Structure): Structure {
  return {
    ...base,
    name: note.name,
    system: note.system,
    region: note.region,
    sex: note.sex,
    summary: note.summary,
    relations: note.relations,
    clinical: note.clinical,
    muscle: note.muscle,
    parentId: note.parentId,
    aliases: [
      ...new Set([...(base.aliases ?? []), ...(note.aliases ?? []), base.name]),
    ],
    curated: true,
  };
}

function buildCatalog(): Structure[] {
  const byId = new Map<string, Structure>();
  for (const { row, meshIds } of generated) {
    const built = fromRow(row, meshIds);
    const prev = byId.get(built.id);
    if (!prev) {
      byId.set(built.id, built);
      continue;
    }
    // The male and female packs overlap on shared structures. Union the meshes
    // and widen the sex tag rather than letting one pack shadow the other.
    byId.set(built.id, {
      ...prev,
      meshIds: [...new Set([...(prev.meshIds ?? []), ...(built.meshIds ?? [])])],
      sex: prev.sex === built.sex ? prev.sex : "both",
      summary: prev.summary.length >= built.summary.length ? prev.summary : built.summary,
    });
  }

  const all = [...byId.values()];
  const byName = new Map<string, Structure[]>();
  for (const s of all) {
    const key = s.name.toLowerCase();
    const list = byName.get(key);
    if (list) list.push(s);
    else byName.set(key, [s]);
  }

  /** Resolve a MESH_ALIASES entry to concrete mesh ids. */
  function resolveAliases(noteId: string): string[] {
    const matchers = MESH_ALIASES[noteId];
    if (!matchers) return [];
    const out = new Set<string>();
    for (const matcher of matchers) {
      if (typeof matcher === "string") {
        const hit = byId.get(matcher);
        if (hit) for (const m of hit.meshIds ?? [hit.id]) out.add(m);
        continue;
      }
      for (const s of all) {
        if (matcher.test(s.name)) {
          for (const m of s.meshIds ?? [s.id]) out.add(m);
        }
      }
    }
    return [...out];
  }

  for (const note of HIGH_YIELD) {
    // BodyParts3D assigns some meshes short ids that collide with the note
    // ids: the mesh called "thyroid" is FMA55099, the thyroid *cartilage*,
    // and "tibia" is tibialis anterior. Merging on id alone attached the
    // thyroid gland's endocrine notes to a laryngeal cartilage.
    const direct = byId.get(note.id);
    const host =
      direct && namesAgree(direct.name, note.name)
        ? direct
        : byName.get(note.name.toLowerCase())?.[0];

    const aliasMeshes = resolveAliases(note.id);

    if (host) {
      const merged = applyNote(host, note);
      if (aliasMeshes.length) {
        merged.meshIds = [
          ...new Set([...(merged.meshIds ?? []), ...aliasMeshes]),
        ];
      }
      byId.set(host.id, merged);
      // Keep the note reachable under its own id when it merged onto another.
      if (host.id !== note.id) byId.set(note.id, { ...merged, id: note.id });
      continue;
    }

    // Never clobber a generated mesh row: the viewer looks meshes up by id.
    const noteId = byId.has(note.id) ? `${note.id}-note` : note.id;
    byId.set(noteId, {
      ...note,
      id: noteId,
      layer: note.layer ?? 1,
      meshIds: aliasMeshes.length ? aliasMeshes : [],
      curated: true,
      isLeafMesh: false,
      missingMeshReason: aliasMeshes.length ? undefined : NO_MESH_REASON[note.id],
    });
  }

  return [...byId.values()];
}

export const STRUCTURES: Structure[] = buildCatalog();

export const STRUCTURE_BY_ID: Record<string, Structure> = Object.fromEntries(
  STRUCTURES.map((s) => [s.id, s]),
);

/** Mesh id -> the structure that owns it, for click-to-select in the viewer. */
export const STRUCTURE_BY_MESH: Record<string, Structure> = (() => {
  const map: Record<string, Structure> = {};
  for (const s of STRUCTURES) {
    if (s.isLeafMesh) map[s.id] = s;
  }
  // Curated notes take precedence so clicking a lung segment opens "Lungs".
  for (const s of STRUCTURES) {
    if (!s.curated || !s.meshIds) continue;
    for (const m of s.meshIds) if (!map[m]?.curated) map[m] = s;
  }
  return map;
})();

export const CATALOG_STATS = {
  structures: STRUCTURES.length,
  meshes: new Set(STRUCTURES.filter((s) => s.isLeafMesh).map((s) => s.id)).size,
  curated: STRUCTURES.filter((s) => s.curated).length,
};

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

interface IndexRow {
  s: Structure;
  name: string;
  id: string;
  /** Everything else worth matching, lowercased once at startup. */
  blob: string;
  /** Grouping structures and curated notes rank above raw leaf meshes. */
  weight: number;
}

const INDEX: IndexRow[] = STRUCTURES.map((s) => ({
  s,
  name: s.name.toLowerCase(),
  id: s.id.toLowerCase(),
  blob: [
    s.summary,
    s.relations ?? "",
    s.clinical ?? "",
    s.fmaId ?? "",
    s.muscle ? Object.values(s.muscle).join(" ") : "",
    ...(s.aliases ?? []),
  ]
    .join(" ")
    .toLowerCase(),
  weight:
    (s.curated ? 30 : 0) +
    (s.clinical ? 10 : 0) +
    ((s.meshIds?.length ?? 0) > 1 ? 6 : 0) +
    (s.missingMeshReason ? -20 : 0),
}));

export interface SearchOptions {
  /** Restrict to structures visible in the given module. */
  sex?: "male" | "female";
  limit?: number;
}

export function searchStructures(
  query: string,
  options: SearchOptions = {},
): Structure[] {
  const q = query.trim().toLowerCase();
  const { sex, limit } = options;
  const matchesSex = (s: Structure) =>
    !sex || s.sex === "both" || s.sex === sex;

  if (!q) {
    const base = INDEX.filter((r) => matchesSex(r.s) && r.weight > 0)
      .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name))
      .map((r) => r.s);
    return limit ? base.slice(0, limit) : base;
  }

  const scored: { s: Structure; score: number }[] = [];
  for (const row of INDEX) {
    if (!matchesSex(row.s)) continue;
    let score: number;
    // Ids rank below names: BodyParts3D gives some meshes short ids that do
    // not describe them, so an id hit is weaker evidence than a name hit.
    if (row.name === q) score = 1000;
    else if (row.name.startsWith(q)) score = 600;
    else if (row.id === q) score = 450;
    else if (row.id.startsWith(q)) score = 380;
    else if (row.name.includes(q)) score = 300;
    else if (row.blob.includes(q)) score = 100;
    else continue;
    // Prefer the shortest name that still contains the query, so "lung" ranks
    // "Left lung" above "Lateral basal segment of left lung".
    scored.push({ s: row.s, score: score + row.weight - row.name.length * 0.4 });
  }
  scored.sort((a, b) => b.score - a.score);
  const out = scored.map((x) => x.s);
  return limit ? out.slice(0, limit) : out;
}

/** Mesh ids a structure should highlight. Empty when it has no geometry. */
export function meshesFor(id: string): string[] {
  const s = STRUCTURE_BY_ID[id];
  if (!s) return [];
  if (s.meshIds?.length) return s.meshIds;
  return s.isLeafMesh ? [s.id] : [];
}

export function hasGeometry(id: string): boolean {
  return meshesFor(id).length > 0;
}
