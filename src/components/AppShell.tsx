"use client";

import { useEffect, useState } from "react";
import { useAtlasStore, type PanelId } from "@/store/useAtlasStore";
import { Viewer } from "./Viewer";
import { SearchBar } from "./SearchBar";
import { BrowsePanel } from "./BrowsePanel";
import { StructureCard } from "./StructureCard";
import { QuizPanel } from "./QuizPanel";
import { SliceViewer } from "./SliceViewer";
import { CompareView } from "./CompareView";
import { TutorPanel } from "./TutorPanel";
import { SettingsPanel } from "./SettingsPanel";
import { InstallBanner } from "./PwaRegister";
import { NavigationHelp } from "./NavigationHelp";
import { ViewDock } from "./ViewDock";
import { SceneModes } from "./SceneModes";
import {
  IconCard,
  IconCompare,
  IconLayers,
  IconMoon,
  IconQuiz,
  IconSettings,
  IconSlices,
  IconSun,
  IconTutor,
} from "./Icons";

const TABS: {
  id: PanelId;
  label: string;
  icon: (p: React.SVGProps<SVGSVGElement>) => React.ReactElement;
  key: string;
}[] = [
  { id: "browse", label: "Browse", icon: IconLayers, key: "1" },
  { id: "card", label: "Details", icon: IconCard, key: "2" },
  { id: "quiz", label: "Quiz", icon: IconQuiz, key: "3" },
  { id: "slices", label: "Slices", icon: IconSlices, key: "4" },
  { id: "compare", label: "Compare", icon: IconCompare, key: "5" },
  { id: "tutor", label: "Tutor", icon: IconTutor, key: "6" },
];

/** True when the key event came from somewhere the user is typing. */
function isTypingTarget(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

export function AppShell() {
  const [explorerOpen, setExplorerOpen] = useState(true);
  const panel = useAtlasStore((s) => s.panel);
  const setPanel = useAtlasStore((s) => s.setPanel);
  const theme = useAtlasStore((s) => s.theme);
  const toggleTheme = useAtlasStore((s) => s.toggleTheme);
  const sex = useAtlasStore((s) => s.sex);
  const setSex = useAtlasStore((s) => s.setSex);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector("dialog[open]")) return;
      if (isTypingTarget(e)) {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }
      // Never shadow browser shortcuts such as Ctrl+R or Cmd+I.
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const store = useAtlasStore.getState();
      switch (e.key) {
        case "/":
          e.preventDefault();
          document
            .querySelector<HTMLInputElement>('input[data-search="atlas"]')
            ?.focus();
          return;
        case "h":
        case "H":
          store.hideSelected();
          return;
        case "i":
        case "I":
          store.isolate();
          return;
        case "r":
        case "R":
          store.resetVisibility();
          return;
        case "f":
        case "F":
          store.triggerFit();
          return;
        case "z":
        case "Z":
          store.focusSelection();
          return;
        case "Escape":
          store.clearSelection();
          return;
      }
      const tab = TABS.find((t) => t.key === e.key);
      if (tab) setPanel(tab.id);
      if (e.key === "7") setPanel("settings");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPanel]);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-text">
            <strong>G.L.S.C Atlas</strong>
            <span>
              {sex === "female"
                ? "HRA female organ set"
                : "BodyParts3D whole body"}
            </span>
          </div>
        </div>

        <SearchBar />

        <div className="topbar-right">
          <NavigationHelp />
        <button type="button" className="explorer-toggle" aria-expanded={explorerOpen} aria-controls="atlas-panel" onClick={() => setExplorerOpen(v => !v)}>{explorerOpen ? "Hide explorer" : "Open explorer"}</button>
          <div className="segmented" role="group" aria-label="Anatomy module">
            <button
              type="button"
              className={sex === "male" ? "is-active" : ""}
              aria-pressed={sex === "male"}
              onClick={() => setSex("male")}
            >
              Male
            </button>
            <button
              type="button"
              className={sex === "female" ? "is-active" : ""}
              aria-pressed={sex === "female"}
              onClick={() => setSex("female")}
              title="Real open female organ meshes. Not a complete female cadaver."
            >
              Female
            </button>
          </div>
          <button
            type="button"
            className="ghost"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? <IconSun /> : <IconMoon />}
          </button>
        </div>
      </header>

      <div className={`workspace ${explorerOpen ? "" : "explorer-closed"}`}>
        <Viewer />


        <aside className="side">
          <nav className="rail" aria-label="Panels">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={panel === id ? "is-active" : ""}
                aria-current={panel === id ? "page" : undefined}
                onClick={() => { setPanel(id); setExplorerOpen(true); }}
                title={label}
              >
                <Icon />
                <span>{label}</span>
              </button>
            ))}
            <div className="rail-spacer" />
            <button
              type="button"
              className={panel === "settings" ? "is-active" : ""}
              aria-current={panel === "settings" ? "page" : undefined}
              onClick={() => setPanel("settings")}
              title="Settings"
            >
              <IconSettings />
              <span>Setup</span>
            </button>
          </nav>

          <div className="panel" id="atlas-panel">

            <InstallBanner />
            {panel === "browse" && <><SceneModes /><BrowsePanel /></>}
            <ViewDock />
            {panel === "card" && (
              <div className="panel-inner">
                <button type="button" className="ghost" onClick={() => setPanel("browse")}>Back to explorer</button>
                <StructureCard />
              </div>
            )}
            {panel === "quiz" && <QuizPanel />}
            {panel === "slices" && <SliceViewer />}
            {panel === "compare" && <CompareView />}
            {panel === "tutor" && <TutorPanel />}
            {panel === "settings" && <SettingsPanel />}
          </div>
        </aside>
      </div>
    </div>
  );
}
