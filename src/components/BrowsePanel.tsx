"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { STRUCTURES, searchStructures } from "@/data/structures";
import { REGION_META, SYSTEM_IDS, SYSTEM_META } from "@/lib/systems";
import { classifyTissue } from "@/lib/tissue";
import { regionAvailability, systemsRevealing } from "@/lib/regions";

import { useAtlasStore } from "@/store/useAtlasStore";
import type { RegionId, Structure, SystemId } from "@/lib/types";

const PAGE = 60;

/** Per-system structure counts for the current module, computed once. */
function useSystemCounts(sex: "male" | "female") {
  return useMemo(() => {
    const counts = {} as Record<SystemId, number>;
    for (const id of SYSTEM_IDS) counts[id] = 0;
    for (const s of STRUCTURES) {
      if (s.sex !== "both" && s.sex !== sex) continue;
      if (s.isLeafMesh) counts[s.system] += 1;
    }
    return counts;
  }, [sex]);
}

function SystemFilters() {
  const systems = useAtlasStore((s) => s.systems);
  const toggleSystem = useAtlasStore((s) => s.toggleSystem);
  const soloSystem = useAtlasStore((s) => s.soloSystem);
  const resetVisibility = useAtlasStore(s => s.resetVisibility);
  const sex = useAtlasStore((s) => s.sex);

  const counts = useSystemCounts(sex);

  const visible = SYSTEM_IDS.filter((id) => {
    if (id === "maleReproductive" && sex !== "male") return false;
    if (id === "femaleReproductive" && sex !== "female") return false;
    return counts[id] > 0;
  });

  const onCount = visible.filter((id) => systems[id]).length;

  return (
    <section>
      <div className="filter-head">
        <h3 className="section-label" style={{ margin: 0 }}>
          Layers · {onCount} on
        </h3>
        <button
          type="button"
          className="ghost"
          onClick={resetVisibility}
        >
          All on
        </button>
      </div>

      <div className="filters">
        {visible.map((id) => {
          const on = systems[id];
          const meta = SYSTEM_META[id];
          return (
            <div key={id} className="filter">
              <button type="button" className="filter-toggle" aria-pressed={on} onClick={() => toggleSystem(id)}>
              <span
                className="swatch"
                style={{ background: meta.color }}
                aria-hidden
              />
              <span className="filter-label">
                <b>{meta.label}</b>
                <small>
                  {meta.hint}

                </small>
              </span>
              <span className="count" title="Mesh count">{counts[id]}</span>
              </button>
              <button
                type="button"
                className="solo"
                title="Show only this system"
                onClick={(e) => {
                  e.stopPropagation();
                  soloSystem(id);
                }}
              >
                Only
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StructureList() {
  const tissueFocus = useAtlasStore(s => s.tissueFocus);
  const sex = useAtlasStore((s) => s.sex);
  const systems = useAtlasStore((s) => s.systems);
  const availability = useMemo(() => regionAvailability(sex, systems, tissueFocus), [sex, systems, tissueFocus]);
  const focusedId = useAtlasStore((s) => s.focusedId);
  const select = useAtlasStore((s) => s.select);
  const focusSelection = useAtlasStore((s) => s.focusSelection);

  const region = useAtlasStore(s => s.regionFocus);
  const setRegion = (value: RegionId | "all") => useAtlasStore.setState(s => ({
    regionFocus: value,
    // Choosing a region reveals what is in it; see src/lib/regions.ts.
    systems: systemsRevealing(s.sex, value, s.systems, s.tissueFocus) ?? s.systems,
    isolatedIds: ["Lung shape", "Airways"].includes(s.viewName) ? s.isolatedIds : [],
    hiddenIds: [], selectedIds: [], focusedId: null, fitTrigger: s.fitTrigger + 1,
  }));
  const [filter, setFilter] = useState("");
  const [shown, setShown] = useState(PAGE);
  const deferred = useDeferredValue(filter);

  const rows: Structure[] = useMemo(() => {
    const base = deferred.trim()
      ? searchStructures(deferred, { sex })
      : STRUCTURES.filter(s => s.sex === "both" || s.sex === sex);
    const out = base.filter((s) => {
      if (!systems[s.system]) return false;
      if (tissueFocus !== "all" && classifyTissue(s.name) !== tissueFocus) return false;
      if (region !== "all" && s.region !== region) return false;
      return true;
    });
    // Without a query, rank teaching content first then alphabetise so the
    // list is navigable rather than an arbitrary dump of mesh fragments.
    if (!deferred.trim()) {
      out.sort(
        (a, b) =>
          Number(Boolean(b.curated)) - Number(Boolean(a.curated)) ||
          Number(Boolean(b.clinical)) - Number(Boolean(a.clinical)) ||
          Number(Boolean(b.isLeafMesh)) - Number(Boolean(a.isLeafMesh)) ||
          a.name.localeCompare(b.name),
      );
    }
    return out;
  }, [deferred, sex, systems, region, tissueFocus]);

  const regions = useMemo(() => {
    const set = new Set<RegionId>();
    for (const s of rows) set.add(s.region);
    return set;
  }, [rows]);

  const page = rows.slice(0, shown);

  return (
    <section style={{ display: "grid", gap: 9 }}>
      <div className="filter-head">
        <h3 className="section-label" style={{ margin: 0 }}>
          Structures · {rows.length.toLocaleString()}
        </h3>
      </div>

      <input
        value={filter}
        onChange={(e) => {
          setFilter(e.target.value);
          setShown(PAGE);
        }}
        placeholder="Filter this list…"
        aria-label="Filter structure list"
      />

      <div className="slice-tabs" role="group" aria-label="Region filter">
        <button
          type="button"
          className={region === "all" ? "is-active" : ""}
          onClick={() => {
            setRegion("all");
            setShown(PAGE);
          }}
        >
          All regions
        </button>
        {(Object.keys(REGION_META) as RegionId[])
          .filter((r) => regions.has(r) || r === region)
          .map((r) => (
            <button
              key={r}
              type="button"
              className={region === r ? "is-active" : ""}
              disabled={!availability[r].available && region !== r}
              title={availability[r].available ? undefined : "Nothing in this region for the current view"}
              onClick={() => {
                setRegion(region === r ? "all" : r);
                setShown(PAGE);
              }}
            >
              {REGION_META[r].label}
            </button>
          ))}
      </div>

      {page.length === 0 ? (
        <p className="faint">
          Nothing here. Switch a system on, clear the region filter, or search
          from the bar above.
        </p>
      ) : (
        <ul className="struct-list">
          {page.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={focusedId === s.id ? "is-active" : ""}
                onClick={() => {
                  select(s.id);
                  focusSelection();
                }}
                onDoubleClick={() => select(s.id, { openCard: true })}
              >
                <span
                  className="dot"
                  style={{ background: SYSTEM_META[s.system].color }}
                  aria-hidden
                />
                <span className="name">{s.name}</span>
                {s.curated && <span className="tag">notes</span>}
                <span className="meta">
                  {s.missingMeshReason
                    ? "no mesh"
                    : (s.meshIds?.length ?? 1) > 1
                      ? `${s.meshIds!.length}×`
                      : ""}
                </span>
              </button>
            </li>
          ))}
          {rows.length > page.length && (
            <li className="list-foot">
              <button
                type="button"
                className="ghost"
                onClick={() => setShown((n) => n + PAGE * 2)}
              >
                Show {Math.min(PAGE * 2, rows.length - page.length)} more of{" "}
                {(rows.length - page.length).toLocaleString()}
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

export function BrowsePanel() {
  return (
    <div className="panel-inner">
      <details className="layer-details"><summary>Customise layers <span>All body systems</span></summary><SystemFilters /></details>
      <StructureList />
    </div>
  );
}
