"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { STRUCTURES, searchStructures } from "@/data/structures";
import { REGION_META, SYSTEM_IDS, SYSTEM_META } from "@/lib/systems";
import { DEFAULT_SYSTEMS } from "@/lib/systems";
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
      counts[s.system] += 1;
    }
    return counts;
  }, [sex]);
}

function SystemFilters() {
  const systems = useAtlasStore((s) => s.systems);
  const toggleSystem = useAtlasStore((s) => s.toggleSystem);
  const soloSystem = useAtlasStore((s) => s.soloSystem);
  const patchSystems = useAtlasStore((s) => s.patchSystems);
  const sex = useAtlasStore((s) => s.sex);
  const loaded = useAtlasStore((s) => s.loadedSystems);
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
          Systems · {onCount} on
        </h3>
        <button
          type="button"
          className="ghost"
          onClick={() => patchSystems(DEFAULT_SYSTEMS)}
        >
          Reset
        </button>
      </div>

      <div className="filters">
        {visible.map((id) => {
          const on = systems[id];
          const meta = SYSTEM_META[id];
          return (
            <div
              key={id}
              className="filter"
              role="button"
              tabIndex={0}
              aria-pressed={on}
              onClick={() => toggleSystem(id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleSystem(id);
                }
              }}
            >
              <span
                className="swatch"
                style={{ background: meta.color }}
                aria-hidden
              />
              <span className="filter-label">
                <b>{meta.label}</b>
                <small>
                  {meta.hint}
                  {on && loaded.includes(id) ? " · loaded" : ""}
                </small>
              </span>
              <span className="count">{counts[id]}</span>
              <span
                className="solo"
                role="button"
                tabIndex={-1}
                title="Show only this system"
                onClick={(e) => {
                  e.stopPropagation();
                  soloSystem(id);
                }}
              >
                only
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StructureList() {
  const sex = useAtlasStore((s) => s.sex);
  const systems = useAtlasStore((s) => s.systems);
  const focusedId = useAtlasStore((s) => s.focusedId);
  const select = useAtlasStore((s) => s.select);
  const focusSelection = useAtlasStore((s) => s.focusSelection);

  const [region, setRegion] = useState<RegionId | "all">("all");
  const [filter, setFilter] = useState("");
  const [shown, setShown] = useState(PAGE);
  const deferred = useDeferredValue(filter);

  const rows: Structure[] = useMemo(() => {
    const base = deferred.trim()
      ? searchStructures(deferred, { sex })
      : searchStructures("", { sex });
    const out = base.filter((s) => {
      if (!systems[s.system]) return false;
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
          (b.meshIds?.length ?? 0) - (a.meshIds?.length ?? 0) ||
          a.name.localeCompare(b.name),
      );
    }
    return out;
  }, [deferred, sex, systems, region]);

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
      <SystemFilters />
      <StructureList />
    </div>
  );
}
