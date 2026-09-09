"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SLICES } from "@/data/slices";
import { REGION_META } from "@/lib/systems";
import { useAtlasStore } from "@/store/useAtlasStore";
import { IconSlices } from "./Icons";

export function SliceViewer() {
  const sliceId = useAtlasStore((s) => s.sliceId);
  const setSliceId = useAtlasStore((s) => s.setSliceId);
  const sex = useAtlasStore((s) => s.sex);
  const setClipEnabled = useAtlasStore((s) => s.setClipEnabled);
  const clipEnabled = useAtlasStore((s) => s.clipEnabled);

  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const [zoomed, setZoomed] = useState(false);
  const frame = useRef<HTMLDivElement>(null);

  const list = useMemo(() => SLICES.filter((s) => s.sex === sex), [sex]);
  const current = useMemo(
    () => list.find((s) => s.id === sliceId) ?? list[0],
    [list, sliceId],
  );

  // Keep the store in step with what is actually displayed after a module
  // switch, otherwise sliceId points at a slice from the other body.
  useEffect(() => {
    if (current && current.id !== sliceId) setSliceId(current.id);
  }, [current, sliceId, setSliceId]);

  useEffect(() => setZoomed(false), [current?.id]);

  if (!list.length) {
    return (
      <div className="panel-inner">
        <div className="empty">
          <IconSlices />
          <p>No cross-sections for this module yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-inner">
      <header className="panel-head">
        <div>
          <h2>Cross-sections</h2>
          <p className="sub">
            {list.length} plate{list.length === 1 ? "" : "s"} · U.S. National
            Library of Medicine
          </p>
        </div>
        <button
          type="button"
          className={clipEnabled ? "is-active" : ""}
          onClick={() => setClipEnabled(!clipEnabled)}
          title="Cut the 3D model with a plane"
        >
          {clipEnabled ? "Cut on" : "Cut in 3D"}
        </button>
      </header>

      <div className="slice-tabs" role="tablist" aria-label="Cross-sections">
        {list.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={current?.id === s.id}
            className={current?.id === s.id ? "is-active" : ""}
            onClick={() => {
              setSliceId(s.id);
              setBroken((b) => ({ ...b, [s.id]: false }));
            }}
          >
            {REGION_META[s.region].label} · {s.plane}
          </button>
        ))}
      </div>

      {current && (
        <figure className="slice-figure">
          <div className="slice-frame" ref={frame}>
            {broken[current.id] ? (
              <div className="slice-missing">
                <strong>{current.title}</strong>
                <span>
                  Missing {current.src.replace("/slices/", "")} in public/slices
                </span>
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={current.src}
                alt={`${current.title}. Labelled features: ${current.labels.join(", ")}.`}
                className={zoomed ? "zoomed" : ""}
                loading="lazy"
                decoding="async"
                onClick={(e) => {
                  // Zoom toward the point the student clicked.
                  const r = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - r.left) / r.width) * 100;
                  const y = ((e.clientY - r.top) / r.height) * 100;
                  e.currentTarget.style.setProperty("--zx", `${x}%`);
                  e.currentTarget.style.setProperty("--zy", `${y}%`);
                  setZoomed((v) => !v);
                }}
                onError={() =>
                  setBroken((b) => ({ ...b, [current.id]: true }))
                }
              />
            )}
          </div>
          <figcaption style={{ display: "grid", gap: 6 }}>
            <strong style={{ fontSize: 14 }}>{current.title}</strong>
            <div className="tag-row">
              {current.labels.map((l) => (
                <span key={l} className="tag">
                  {l}
                </span>
              ))}
            </div>
            <span className="faint">{current.credit}</span>
          </figcaption>
        </figure>
      )}
    </div>
  );
}
