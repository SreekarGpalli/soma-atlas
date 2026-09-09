"use client";

import { useAtlasStore } from "@/store/useAtlasStore";
import { IconInfo } from "./Icons";

export function TipsBanner() {
  const dismissed = useAtlasStore((s) => s.tipsDismissed);
  const dismiss = useAtlasStore((s) => s.dismissTips);
  if (dismissed) return null;

  return (
    <div className="banner">
      <IconInfo style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
      <div className="grow">
        <strong>Getting around</strong>
        <p className="muted" style={{ margin: 0 }}>
          Drag to rotate, scroll to zoom. Click a mesh to open its card,
          double-click to isolate it. Press <span className="kbd">/</span> to
          search, <span className="kbd">I</span> to isolate,{" "}
          <span className="kbd">R</span> to bring everything back.
        </p>
      </div>
      <button type="button" className="ghost" onClick={dismiss}>
        Got it
      </button>
    </div>
  );
}
