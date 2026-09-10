"use client";

import { CATALOG_STATS, STRUCTURE_BY_ID } from "@/data/structures";
import { selectionMeshes } from "@/lib/lung-views";
import { REGION_META, SYSTEM_META } from "@/lib/systems";
import { speak } from "@/lib/tts";
import { useAtlasStore } from "@/store/useAtlasStore";
import type { Structure } from "@/lib/types";
import { IconCard, IconSpeaker } from "./Icons";

const SOURCE_LABELS: Record<string, string> = {
  bodyparts3d: "BodyParts3D 4.0",
  hra: "Human Reference Atlas female organ set",
  "hra-v1.10": "Human Reference Atlas female organ set",
  "hra-male-v1.10": "Human Reference Atlas male reference organs",
  "z-anatomy": "Z-Anatomy",
  osu: "OSU anatomy set",
  schematic: "Schematic geometry",
};

/**
 * Rows unioned across the male and female packs kept the first pack's source
 * tag, so male lungs credited the female organ set. Name the sources of the
 * meshes actually on screen instead.
 */
function sourceLabel(s: Structure, meshes: string[]): string {
  const sources = new Set(
    (meshes.length ? meshes.map((m) => STRUCTURE_BY_ID[m]?.source) : [s.source]).map(
      (src) => SOURCE_LABELS[src ?? "bodyparts3d"] ?? SOURCE_LABELS.bodyparts3d,
    ),
  );
  return [...sources].join(" · ");
}

export function StructureCard() {
  const selectedIds = useAtlasStore((s) => s.selectedIds);
  const focusedId = useAtlasStore((s) => s.focusedId);
  const isolate = useAtlasStore((s) => s.isolate);
  const focusSelection = useAtlasStore((s) => s.focusSelection);
  const setCompare = useAtlasStore((s) => s.setCompare);
  const setPanel = useAtlasStore((s) => s.setPanel);
  const compareLeft = useAtlasStore((s) => s.compareLeft);
  const sex = useAtlasStore((s) => s.sex);

  const id = focusedId ?? selectedIds[0];
  const s = id ? STRUCTURE_BY_ID[id] : undefined;

  if (!s) {
    return (
      <div className="empty">
        <IconCard />
        <p>No structure selected.</p>
        <p className="faint">
          Click a mesh in the viewer, or search across{" "}
          {CATALOG_STATS.structures.toLocaleString()} structures —{" "}
          {CATALOG_STATS.curated} carry hand-written exam notes.
        </p>
      </div>
    );
  }

  // Must match what select() actually shows, or Isolate quietly restores the
  // 310-mesh mixture the selection just replaced.
  const meshes = selectionMeshes(s.id, sex);
  const viewable = meshes.length > 0;

  return (
    <article style={{ display: "grid", gap: 14 }}>
      <header className="panel-head">
        <div style={{ minWidth: 0 }}>
          <h2 className="structure-title">{s.name}</h2>
          <div className="tag-row" style={{ marginTop: 6 }}>
            <span className="tag">
              <span
                className="dot"
                style={{ background: SYSTEM_META[s.system].color }}
              />
              {SYSTEM_META[s.system].label}
            </span>
            <span className="tag">{REGION_META[s.region].label}</span>
            {s.sex !== "both" && <span className="tag">{s.sex}</span>}
            {meshes.length > 1 && <span className="tag">{meshes.length} meshes</span>}
          </div>
        </div>
        <button
          type="button"
          className="ghost"
          onClick={() => speak(s.name)}
          aria-label={`Pronounce ${s.name}`}
          title="Pronounce"
        >
          <IconSpeaker />
        </button>
      </header>

      {!viewable && (
        <div className="notice warn">
          <div>
            <strong>Not in the 3D model.</strong>{" "}
            {s.missingMeshReason
              ? `The open datasets ship no geometry for ${s.missingMeshReason}. The notes below still apply.`
              : "This structure has notes but no mesh in the current dataset."}
          </div>
        </div>
      )}

      <div className="tag-row">
        <button
          type="button"
          onClick={focusSelection}
          disabled={!viewable}
          title="Zoom the camera to this structure"
        >
          Zoom to
        </button>
        <button
          type="button"
          onClick={() => isolate(meshes)}
          disabled={!viewable}
          title="Hide everything else"
        >
          Isolate
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            setCompare(compareLeft && compareLeft !== s.id ? compareLeft : s.id,
              compareLeft && compareLeft !== s.id ? s.id : null);
            setPanel("compare");
          }}
          title="Add to the comparison view"
        >
          Compare
        </button>
      </div>

      <div className="prose">
        <p>{s.summary}</p>
      </div>

      {s.relations && (
        <section className="prose">
          <h3>Relations</h3>
          <p>{s.relations}</p>
        </section>
      )}

      {s.muscle && (
        <section>
          <h3 className="section-label">Muscle facts</h3>
          <dl className="fact-grid card">
            <dt>Origin</dt>
            <dd>{s.muscle.origin}</dd>
            <dt>Insertion</dt>
            <dd>{s.muscle.insertion}</dd>
            <dt>Nerve</dt>
            <dd>{s.muscle.innervation}</dd>
            <dt>Action</dt>
            <dd>{s.muscle.action}</dd>
          </dl>
        </section>
      )}

      {s.clinical && (
        <section className="prose clinical">
          <h3>Clinical</h3>
          <p>{s.clinical}</p>
        </section>
      )}

      <p className="disclaimer">
        {s.fmaId && <>Ontology {s.fmaId} · </>}
        {sourceLabel(s, meshes)}
        . Educational reference only — not a diagnosis or a medical device.
      </p>
    </article>
  );
}
