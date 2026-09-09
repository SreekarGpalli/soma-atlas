"use client";

import { useEffect, useState } from "react";
import { useAtlasStore } from "@/store/useAtlasStore";
import { IconChevron, IconSliders } from "./Icons";

/**
 * The display controls used to be a wrapping row of unlabelled buttons and
 * sliders across the top of the app. They live over the viewport now, where
 * their effect is visible, and collapse out of the way on small screens.
 */
export function ViewDock() {
  // On a phone the dock would cover most of the model, so it starts collapsed
  // there and expanded on a desktop where there is room beside the body.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 900px)");
    if (narrow.matches) setOpen(false);
  }, []);

  const transparency = useAtlasStore((s) => s.transparency);
  const setTransparency = useAtlasStore((s) => s.setTransparency);
  const muscleLayer = useAtlasStore((s) => s.muscleLayer);
  const setMuscleLayer = useAtlasStore((s) => s.setMuscleLayer);
  const clipEnabled = useAtlasStore((s) => s.clipEnabled);
  const setClipEnabled = useAtlasStore((s) => s.setClipEnabled);
  const clipAxis = useAtlasStore((s) => s.clipAxis);
  const setClipAxis = useAtlasStore((s) => s.setClipAxis);
  const clipValue = useAtlasStore((s) => s.clipValue);
  const setClipValue = useAtlasStore((s) => s.setClipValue);
  const muscularOn = useAtlasStore((s) => s.systems.muscular);
  const xray = useAtlasStore((s) => s.xray);
  const setXray = useAtlasStore((s) => s.setXray);
  const saveBookmark = useAtlasStore((s) => s.saveBookmark);
  const hideSelected = useAtlasStore((s) => s.hideSelected);
  const selectedCount = useAtlasStore((s) => s.selectedIds.length);

  return (
    <div className="dock">
      <div className="dock-head">
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <IconSliders style={{ width: 13, height: 13 }} />
          Display
        </span>
        <button
          type="button"
          className="ghost"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Collapse display controls" : "Expand display controls"}
        >
          <IconChevron
            style={{
              width: 14,
              height: 14,
              transform: `rotate(${open ? 270 : 90}deg)`,
              transition: "transform .15s ease",
            }}
          />
        </button>
      </div>

      {open && (
        <div className="dock-body">
          <div className="dock-row">
            <label htmlFor="dock-fade">
              Fade context <b>{Math.round(transparency * 100)}%</b>
            </label>
            <input
              id="dock-fade"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={transparency}
              onChange={(e) => setTransparency(Number(e.target.value))}
            />
          </div>

          {muscularOn && (
            <div className="dock-row">
              <label htmlFor="dock-layer">
                Muscle depth <b>{["", "Deep", "Mid", "All"][muscleLayer]}</b>
              </label>
              <input
                id="dock-layer"
                type="range"
                min={1}
                max={3}
                step={1}
                value={muscleLayer}
                onChange={(e) => setMuscleLayer(Number(e.target.value))}
              />
            </div>
          )}

          <div className="dock-row">
            <label htmlFor="dock-xray" style={{ cursor: "pointer" }}>
              <span style={{ display: "inline-flex", gap: 7, alignItems: "center" }}>
                <input
                  id="dock-xray"
                  type="checkbox"
                  checked={xray}
                  onChange={(e) => setXray(e.target.checked)}
                />
                See through to selection
              </span>
            </label>
          </div>

          <div className="dock-row">
            <label
              htmlFor="dock-clip"
              style={{ cursor: "pointer", alignItems: "center" }}
            >
              <span
                style={{ display: "inline-flex", gap: 7, alignItems: "center" }}
              >
                <input
                  id="dock-clip"
                  type="checkbox"
                  checked={clipEnabled}
                  onChange={(e) => setClipEnabled(e.target.checked)}
                />
                Section plane
              </span>
            </label>
            {clipEnabled && (
              <>
                <div className="segmented" style={{ width: "100%" }}>
                  {(
                    [
                      ["x", "Sagittal"],
                      ["y", "Axial"],
                      ["z", "Coronal"],
                    ] as const
                  ).map(([axis, label]) => (
                    <button
                      key={axis}
                      type="button"
                      style={{ flex: 1, fontSize: 11, padding: "4px 2px" }}
                      className={clipAxis === axis ? "is-active" : ""}
                      onClick={() => setClipAxis(axis)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  min={-1.5}
                  max={1.5}
                  step={0.02}
                  value={clipValue}
                  aria-label="Section plane position"
                  onChange={(e) => setClipValue(Number(e.target.value))}
                />
              </>
            )}
          </div>

          <div className="dock-actions">
            <button
              type="button"
              onClick={hideSelected}
              disabled={!selectedCount}
              title="Hide the selection (H)"
            >
              Hide
            </button>
            <button type="button" onClick={() => saveBookmark()} title="Save this view">
              Bookmark
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
