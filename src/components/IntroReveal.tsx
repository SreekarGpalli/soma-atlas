"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useProgress } from "@react-three/drei";
import { useAtlasStore } from "@/store/useAtlasStore";
import { DEFAULT_SYSTEMS, SYSTEM_IDS } from "@/lib/systems";
import { loadLocal, saveLocal } from "@/lib/storage";
import type { SystemId } from "@/lib/types";

/**
 * The opening reveal.
 *
 * A first-year opening this has no idea the body is stacked in layers she can
 * take off, which is the one thing the whole app is built around. So the first
 * thing she sees is the skin dissolving to muscle and muscle thinning to bone,
 * named as it happens. It is the product demo and the explanation at once.
 *
 * It only uses geometry the app downloads anyway — the skin envelope is a
 * single 231 KB mesh, and skeletal and muscular are the default layers — so it
 * costs one small extra request, not a second body. It runs once per browser,
 * any input skips it, and it is off entirely under prefers-reduced-motion.
 */

export interface Beat {
  /** Layer name shown while this beat plays. */
  caption: string;
  sub: string;
  /** Milliseconds this beat runs for. */
  ms: number;
  /** Target opacity per system, tweened from wherever the last beat left off. */
  to: Partial<Record<SystemId, number>>;
}

/** Always shown: the skin envelope plus the two layers the app loads anyway. */
export const CORE: Beat[] = [
  { caption: "Skin", sub: "Where every examination starts", ms: 1300, to: { integumentary: 1, muscular: 1, skeletal: 1 } },
  { caption: "Muscle", sub: "Take the surface away", ms: 1500, to: { integumentary: 0, muscular: 1, skeletal: 1 } },
  { caption: "Bone", sub: "And keep going", ms: 1500, to: { integumentary: 0, muscular: 0.12, skeletal: 1 } },
];

/**
 * The arterial and nerve trees are the best thing in the app to look at, and
 * also 7 MB. They are worth downloading on a connection that will not notice
 * and wrong to force on one that will, so this half only plays when the
 * browser says the link is good and the user has not asked to save data.
 */
export const EXTENDED: Beat[] = [
  { caption: "Vessels", sub: "Every artery and vein, to the smallest branch", ms: 1700, to: { integumentary: 0, muscular: 0.06, skeletal: 0.25, cardiovascular: 1 } },
  { caption: "Nerves", sub: "And the whole peripheral network", ms: 1700, to: { integumentary: 0, muscular: 0.06, skeletal: 0.2, cardiovascular: 0.55, nervous: 1 } },
];

/** Reassemble, landing exactly on the view she starts from. */
export const CLOSE: Beat = { caption: "", sub: "", ms: 1000, to: { integumentary: 0, muscular: 1, skeletal: 1, cardiovascular: 0, nervous: 0 } };

/** Cheap, standard signal: skip the heavy half on slow links or Save Data. */
function linkIsGenerous(): boolean {
  const c = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (!c) return true; // Safari and Firefox do not report; assume broadband.
  if (c.saveData) return false;
  return c.effectiveType === undefined || c.effectiveType === "4g";
}

const STORAGE_KEY = "introReveal-v1";
const TICK = 1000 / 40;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Ease-in-out, so a layer does not snap at either end of its fade. */
function ease(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

export function IntroReveal() {
  const setSystemOpacity = useAtlasStore((s) => s.setSystemOpacity);
  const setIntro = useAtlasStore((s) => s.setIntro);
  const patchSystems = useAtlasStore((s) => s.patchSystems);
  const loading = useProgress((s) => s.active);

  const [beat, setBeat] = useState(-1);
  const [plan, setPlan] = useState<Beat[]>(CORE);
  const [total, setTotal] = useState(CORE.length);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const started = useRef(false);

  const stop = useCallback(
    (seen: boolean) => {
      for (const t of timers.current) clearTimeout(t);
      timers.current = [];
      setBeat(-1);
      setSystemOpacity({});
      // Land exactly on the normal opening view rather than wherever the
      // timeline had got to.
      useAtlasStore.setState((s) => ({
        systems: { ...DEFAULT_SYSTEMS },
        turntable: false,
        viewName: "Overview",
        fitTrigger: s.fitTrigger + 1,
      }));
      setIntro("done");
      if (seen) saveLocal(STORAGE_KEY, true);
    },
    [setSystemOpacity, setIntro],
  );

  const play = useCallback(() => {
    started.current = true;
    setIntro("playing");
    const full = linkIsGenerous();
    const beats = full ? [...CORE, ...EXTENDED, CLOSE] : [...CORE, CLOSE];
    setPlan(beats);
    setTotal(full ? CORE.length + EXTENDED.length : CORE.length);
    // The skin envelope lives in the integumentary pack, which is off by
    // default; skeletal and muscular are already on. Switching the heavy packs
    // on now starts their download while the first three beats play.
    const on: SystemId[] = ["integumentary", "muscular", "skeletal"];
    if (full) on.push("cardiovascular", "nervous");
    patchSystems(
      Object.fromEntries(SYSTEM_IDS.map((id) => [id, on.includes(id)])) as Record<SystemId, boolean>,
    );
    useAtlasStore.setState({ turntable: true, viewName: "Overview" });

    // Where each beat starts from: the one before it, carried forward.
    const opening: Partial<Record<SystemId, number>> = {
      integumentary: 1, muscular: 1, skeletal: 1, cardiovascular: 0, nervous: 0,
    };
    const froms: Partial<Record<SystemId, number>>[] = [];
    let carried = opening;
    for (const b of beats) {
      froms.push(carried);
      carried = { ...carried, ...b.to };
    }
    const runtime = beats.reduce((sum, b) => sum + b.ms, 0);

    // One clock for the whole timeline. Giving each beat its own tween chain
    // meant a slow frame let two of them overlap, and the stale one wrote its
    // opacities over the newer beat — the caption said "Nerves" while the body
    // was already reassembling. Reading elapsed time instead is self-correcting.
    const startedAt = performance.now();
    let shown = -1;
    const frame = () => {
      const elapsed = performance.now() - startedAt;
      if (elapsed >= runtime) {
        stop(true);
        return;
      }
      let index = 0;
      let at = 0;
      while (index < beats.length - 1 && elapsed >= at + beats[index].ms) {
        at += beats[index].ms;
        index += 1;
      }
      if (index !== shown) {
        shown = index;
        setBeat(index);
      }
      const from = froms[index];
      const to = beats[index].to;
      const eased = ease(Math.min(1, (elapsed - at) / beats[index].ms));
      setSystemOpacity(
        Object.fromEntries(
          // A layer a beat says nothing about holds where it was, so the
          // vessel packs stay at zero while skin and muscle are on screen.
          SYSTEM_IDS.map((id) => [id, lerp(from[id] ?? 1, to[id] ?? from[id] ?? 1, eased)]),
        ),
      );
      timers.current.push(setTimeout(frame, TICK));
    };
    frame();
  }, [patchSystems, setIntro, setSystemOpacity, stop]);

  // Wait for the first geometry: a reveal of an empty canvas is not a reveal.
  useEffect(() => {
    if (started.current || loading) return;
    if (loadLocal(STORAGE_KEY, false)) { setIntro("done"); return; }
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      saveLocal(STORAGE_KEY, true);
      setIntro("done");
      return;
    }
    play();
  }, [loading, play, setIntro]);

  // Any deliberate input means she would rather get on with it.
  useEffect(() => {
    if (beat < 0) return;
    const skip = () => stop(true);
    window.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", skip);
    window.addEventListener("wheel", skip, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("wheel", skip);
    };
  }, [beat, stop]);

  // React mounts effects twice in development. The first cleanup cancelled the
  // whole timeline while `started` stayed true, so the reveal set the layers up
  // and then never played a single beat. Clearing the guard alongside the
  // timers lets the second mount start a fresh, complete run.
  useEffect(
    () => () => {
      for (const t of timers.current) clearTimeout(t);
      timers.current = [];
      started.current = false;
    },
    [],
  );

  if (beat < 0 || !plan[beat]?.caption) return null;
  const current = plan[beat];
  return (
    <div className="intro-reveal" role="status" aria-live="polite">
      <div className="intro-caption">
        <span className="studio-kicker">LAYER {beat + 1} OF {total}</span>
        <strong key={current.caption}>{current.caption}</strong>
        <span>{current.sub}</span>
      </div>
      <button type="button" className="intro-skip" onClick={() => stop(true)}>
        Skip
      </button>
    </div>
  );
}

/** Replay the reveal from a control elsewhere in the app. */
export function replayIntro() {
  saveLocal(STORAGE_KEY, false);
  window.location.reload();
}
