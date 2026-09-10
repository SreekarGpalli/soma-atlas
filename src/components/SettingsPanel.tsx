"use client";

import { useState } from "react";
import { replayIntro } from "./IntroReveal";
import { CATALOG_STATS } from "@/data/structures";
import { TUTOR_MODELS } from "@/lib/tutor-models";
import { useAtlasStore } from "@/store/useAtlasStore";
import { IconBookmark, IconClose } from "./Icons";

const SHORTCUTS: [string, string][] = [
  ["/", "Focus search"],
  ["1 – 6", "Switch panel"],
  ["H", "Hide selection"],
  ["I", "Isolate selection"],
  ["R", "Show everything"],
  ["F", "Reset camera"],
  ["Z", "Zoom to selection"],
  ["Esc", "Clear selection"],
];

export function SettingsPanel() {
  const groqKey = useAtlasStore((s) => s.groqKey);
  const setGroqKey = useAtlasStore((s) => s.setGroqKey);
  const groqModel = useAtlasStore((s) => s.groqModel);
  const setGroqModel = useAtlasStore((s) => s.setGroqModel);
  const bookmarks = useAtlasStore((s) => s.bookmarks);
  const loadBookmark = useAtlasStore((s) => s.loadBookmark);
  const deleteBookmark = useAtlasStore((s) => s.deleteBookmark);
  const saveBookmark = useAtlasStore((s) => s.saveBookmark);

  const [reveal, setReveal] = useState(false);
  const keyLooksValid = !groqKey || groqKey.startsWith("gsk_");

  return (
    <div className="panel-inner">
      <header className="panel-head">
        <div>
          <h2>Setup</h2>
          <p className="sub">
            {CATALOG_STATS.structures.toLocaleString()} structures ·{" "}
            {CATALOG_STATS.meshes.toLocaleString()} meshes
          </p>
        </div>
      </header>

      <section style={{ display: "grid", gap: 10 }}>
        <h3 className="section-label">AI tutor</h3>

        <label className="field">
          <span>
            Groq API key
            <span className="hint">
              {" "}
              — kept in this browser only, sent per request to Groq through the
              app&apos;s proxy. Never stored on the server.
            </span>
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type={reveal ? "text" : "password"}
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              placeholder="gsk_…"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!keyLooksValid}
            />
            <button type="button" onClick={() => setReveal((v) => !v)}>
              {reveal ? "Hide" : "Show"}
            </button>
          </div>
          {!keyLooksValid && (
            <span className="hint" style={{ color: "var(--bad)" }}>
              Groq keys start with gsk_.
            </span>
          )}
        </label>

        <label className="field">
          <span>Model</span>
          <select
            value={groqModel}
            onChange={(e) => setGroqModel(e.target.value)}
          >
            {TUTOR_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} — {m.hint}
              </option>
            ))}
          </select>
        </label>

        <p className="faint">
          Get a free key at console.groq.com. Everything except the tutor works
          offline.
        </p>
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        <div className="filter-head">
          <h3 className="section-label" style={{ margin: 0 }}>
            Saved views · {bookmarks.length}
          </h3>
          <button type="button" onClick={() => saveBookmark()}>
            Save current
          </button>
        </div>

        {bookmarks.length === 0 ? (
          <p className="faint">
            Save the camera, selection and filters you keep returning to.
          </p>
        ) : (
          <ul className="bookmark-list">
            {bookmarks.map((b) => (
              <li key={b.id}>
                <button type="button" onClick={() => loadBookmark(b.id)}>
                  <IconBookmark style={{ width: 13, height: 13, flexShrink: 0 }} />
                  <span className="bm-title">{b.title}</span>
                  <span className="faint" style={{ marginLeft: "auto" }}>
                    {b.sex}
                  </span>
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => deleteBookmark(b.id)}
                  aria-label={`Delete ${b.title}`}
                >
                  <IconClose style={{ width: 13, height: 13 }} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        <h3 className="section-label">Keyboard</h3>
        <div className="shortcut-table">
          {SHORTCUTS.map(([k, what]) => (
            <span key={k} style={{ display: "contents" }}>
              <span className="kbd">{k}</span>
              <span>{what}</span>
            </span>
          ))}
        </div>
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        <h3 className="section-label">Opening reveal</h3>
        <p className="muted">
          The layer-by-layer opening plays once. Replay it to see how the body
          comes apart, or to show someone else.
        </p>
        <div className="tag-row">
          <button type="button" onClick={replayIntro}>Replay the reveal</button>
        </div>
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        <h3 className="section-label">Offline</h3>
        <p className="muted">
          Model packs and slices are cached the first time you open them.
          Install the app — Share → Add to Home Screen on iPhone, Install app in
          Chrome — so the cache is not evicted after a week.
        </p>
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        <h3 className="section-label">Sources &amp; licences</h3>
        <p className="faint">
          Male body: BodyParts3D 4.0 © Database Center for Life Science, CC BY
          4.0. Female organs: Human Reference Atlas / Visible Human Female, CC
          BY 4.0. Cross-sections courtesy of the U.S. National Library of
          Medicine, Visible Human Project. Notes adapted in part from OpenStax
          Anatomy &amp; Physiology 2e, CC BY 4.0.
        </p>
        <p className="faint">
          G.L.S.C Atlas is a study aid. It is not a medical device and must not be
          used for diagnosis or treatment.
        </p>
      </section>
    </div>
  );
}
