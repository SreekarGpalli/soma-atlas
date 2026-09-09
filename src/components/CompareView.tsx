"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { STRUCTURE_BY_ID, meshesFor, searchStructures } from "@/data/structures";
import { REGION_META, SYSTEM_META } from "@/lib/systems";
import { useAtlasStore } from "@/store/useAtlasStore";
import { IconCompare } from "./Icons";
import type { Structure } from "@/lib/types";

/**
 * Picker that actually reaches the whole catalog. The previous version used a
 * <select> filled from a 15-row search, so most structures were unreachable.
 */
function Picker({
  label,
  value,
  onPick,
}: {
  label: string;
  value: Structure | undefined;
  onPick: (id: string | null) => void;
}) {
  const sex = useAtlasStore((s) => s.sex);
  const [q, setQ] = useState("");
  const deferred = useDeferredValue(q);
  const hits = useMemo(
    () => (deferred.trim() ? searchStructures(deferred, { sex, limit: 6 }) : []),
    [deferred, sex],
  );

  return (
    <div className="compare-picker">
      <div className="row-label">{label}</div>
      {value ? (
        <div className="tag-row">
          <strong style={{ flex: 1, minWidth: 0 }}>{value.name}</strong>
          <button type="button" className="ghost" onClick={() => onPick(null)}>
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}…`}
            aria-label={`Search ${label}`}
          />
          {hits.length > 0 && (
            <ul className="struct-list">
              {hits.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(s.id);
                      setQ("");
                    }}
                  >
                    <span
                      className="dot"
                      style={{ background: SYSTEM_META[s.system].color }}
                      aria-hidden
                    />
                    <span className="name">{s.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Column({ s }: { s: Structure }) {
  const select = useAtlasStore((s) => s.select);
  const focusSelection = useAtlasStore((s) => s.focusSelection);
  return (
    <div className="compare-col">
      <h3>{s.name}</h3>
      <div className="tag-row">
        <span className="tag">
          <span
            className="dot"
            style={{ background: SYSTEM_META[s.system].color }}
          />
          {SYSTEM_META[s.system].label}
        </span>
        <span className="tag">{REGION_META[s.region].label}</span>
      </div>
      <p className="muted">{s.summary}</p>
      {s.relations && (
        <div>
          <div className="row-label">Relations</div>
          <p className="muted">{s.relations}</p>
        </div>
      )}
      {s.muscle && (
        <div>
          <div className="row-label">Nerve</div>
          <p className="muted">{s.muscle.innervation}</p>
          <div className="row-label" style={{ marginTop: 6 }}>
            Action
          </div>
          <p className="muted">{s.muscle.action}</p>
        </div>
      )}
      {s.clinical && (
        <div>
          <div className="row-label">Clinical</div>
          <p className="muted">{s.clinical}</p>
        </div>
      )}
      <button
        type="button"
        className="ghost"
        disabled={!meshesFor(s.id).length}
        onClick={() => {
          select(s.id);
          focusSelection();
        }}
      >
        Show in 3D
      </button>
    </div>
  );
}

export function CompareView() {
  const leftId = useAtlasStore((s) => s.compareLeft);
  const rightId = useAtlasStore((s) => s.compareRight);
  const setCompare = useAtlasStore((s) => s.setCompare);
  const isolate = useAtlasStore((s) => s.isolate);
  const patchSystems = useAtlasStore((s) => s.patchSystems);
  const focusSelection = useAtlasStore((s) => s.focusSelection);

  const L = leftId ? STRUCTURE_BY_ID[leftId] : undefined;
  const R = rightId ? STRUCTURE_BY_ID[rightId] : undefined;

  const showBoth = () => {
    const ids = [...meshesFor(L?.id ?? ""), ...meshesFor(R?.id ?? "")];
    if (!ids.length) return;
    if (L) patchSystems({ [L.system]: true });
    if (R) patchSystems({ [R.system]: true });
    useAtlasStore.setState({ selectedIds: ids, focusedId: L?.id ?? R?.id ?? null });
    isolate(ids);
    focusSelection();
  };

  return (
    <div className="panel-inner">
      <header className="panel-head">
        <div>
          <h2>Compare</h2>
          <p className="sub">Two structures side by side.</p>
        </div>
        {L && R && (
          <button type="button" onClick={showBoth}>
            Both in 3D
          </button>
        )}
      </header>

      <div className="compare-cols">
        <Picker
          label="Left"
          value={L}
          onPick={(id) => setCompare(id, rightId)}
        />
        <Picker
          label="Right"
          value={R}
          onPick={(id) => setCompare(leftId, id)}
        />
      </div>

      {L || R ? (
        <div className="compare-cols">
          {L && <Column s={L} />}
          {R && <Column s={R} />}
        </div>
      ) : (
        <div className="empty">
          <IconCompare />
          <p>Pick two structures to compare.</p>
          <p className="faint">
            Useful for male vs female pelvis, or two muscles with the same
            action but different nerve supply.
          </p>
        </div>
      )}
    </div>
  );
}
