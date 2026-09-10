"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { searchStructures } from "@/data/structures";
import { SYSTEM_META } from "@/lib/systems";
import { useAtlasStore } from "@/store/useAtlasStore";
import { IconSearch } from "./Icons";
import type { Structure } from "@/lib/types";

const MAX_HITS = 9;

/** Highlights the matched span so the ranking is legible. */
function Highlighted({ text, query }: { text: string; query: string }) {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <em>{text.slice(at, at + query.length)}</em>
      {text.slice(at + query.length)}
    </>
  );
}

export function SearchBar() {
  const query = useAtlasStore((s) => s.query);
  const setQuery = useAtlasStore((s) => s.setQuery);
  const select = useAtlasStore((s) => s.select);
  const focusSelection = useAtlasStore((s) => s.focusSelection);
  const sex = useAtlasStore((s) => s.sex);
  const setSex = useAtlasStore((s) => s.setSex);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Searching 4,900 rows on every keystroke blocked typing; deferring keeps
  // the input responsive and drops intermediate results.
  const deferred = useDeferredValue(query);

  const hits: Structure[] = useMemo(() => {
    const q = deferred.trim();
    if (!q) return [];
    return searchStructures(q, { sex, limit: MAX_HITS });
  }, [deferred, sex]);

  // "uterus" in the male module matched the urinary bladder's clinical note
  // and reported it as the answer. When nothing here matches by name but the
  // other module has one, say so rather than letting a prose hit stand in.
  const elsewhere = useMemo(() => {
    const q = deferred.trim();
    if (!q) return null;
    if (searchStructures(q, { sex, namesOnly: true, limit: 1 })[0]) return null;
    const other = sex === "male" ? "female" : "male";
    return searchStructures(q, { sex: other, namesOnly: true, limit: 1 })[0] ? other : null;
  }, [deferred, sex]);

  useEffect(() => setActive(0), [deferred]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const commit = (s: Structure) => {
    select(s.id, { openCard: true });
    focusSelection();
    setQuery("");
    setOpen(false);
  };

  const showList = open && Boolean(query.trim());

  return (
    <div className="search" ref={box}>
      <div className="search-field">
        <IconSearch />
        <input
          data-search="atlas"
          value={query}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && hits[active] ? `${listId}-${active}` : undefined
          }
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && hits[active]) {
              e.preventDefault();
              commit(hits[active]);
            } else if (e.key === "Escape") {
              e.preventDefault();
              if (query) setQuery("");
              else (e.target as HTMLInputElement).blur();
              setOpen(false);
            }
          }}
          placeholder="Search a structure, nerve or clinical term"
          aria-label="Search anatomy"
          autoComplete="off"
          spellCheck={false}
        />
        {!query && <span className="kbd search-kbd">/</span>}
      </div>

      {showList && (
        <ul className="search-results" id={listId} role="listbox">
          {elsewhere && (
            <li className="search-empty" role="presentation">
              “{query.trim()}” is in the {elsewhere} module.{" "}
              <button type="button" className="link" onClick={() => setSex(elsewhere)}>
                Switch to {elsewhere === "female" ? "Female" : "Male"}
              </button>
            </li>
          )}
          {hits.length === 0 ? (
            !elsewhere && (
              <li className="search-empty" role="presentation">
                Nothing in the catalog matches “{query.trim()}”. Try a shorter word, or the anatomical name.
              </li>
            )
          ) : (
            hits.map((s, i) => (
              <li key={s.id} role="presentation">
                <button
                  type="button"
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={i === active ? "is-active" : ""}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => commit(s)}
                >
                  <span
                    className="dot"
                    aria-hidden
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: SYSTEM_META[s.system].color,
                      flexShrink: 0,
                    }}
                  />
                  <span className="hit-name">
                    <Highlighted text={s.name} query={deferred.trim()} />
                  </span>
                  {s.curated && <span className="tag">notes</span>}
                  <span className="faint">{SYSTEM_META[s.system].label}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
