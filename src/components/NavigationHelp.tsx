"use client";
import { useEffect, useRef, useState } from "react";
import { loadLocal, saveLocal } from "@/lib/storage";
import { openStudyView } from "./SceneModes";
const STEPS = [
  { title: "Start with one view", number: "01", body: "Choose Lung shape, Nerves or another view in the explorer. Each view removes unrelated layers so the anatomy is easier to see.", detail: "Lung shape shows outer surfaces. Airways shows the branching tubes inside. These are separate views of the available models." },
  { title: "Find a part", number: "02", body: "Use the search bar for a named structure, or choose a body region above the canvas. Click a result to select it and use Zoom to for a closer look.", detail: "The region menu filters the model. Whole body removes that region filter. Customise layers lets you turn individual systems on and off." },
  { title: "Move and inspect", number: "03", body: "Drag to rotate. Scroll or pinch to zoom. Right-drag or use two fingers to pan. Click a structure to select it; double-click or press Isolate to hide its surroundings.", detail: "The Details tab describes the selected structure. Display settings let you fade surrounding parts or enable a section plane." },
  { title: "Always know how to return", number: "04", body: "Back returns to the previous view or selection. Home returns to the overview. Fit view brings the visible anatomy back into frame.", detail: "All systems enables every layer, which can cover internal organs. Use a focused view to reveal them again. Some detail is absent from the source datasets; a tutorial cannot fill those gaps." },
];
export function NavigationHelp() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => { if (!loadLocal("navigationTutorial-v1", false)) setOpen(true); }, []);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current?.close();
  }, [open]);
  const close = () => { saveLocal("navigationTutorial-v1", true); setOpen(false); };
  const current = STEPS[step];
  return <>
    <button type="button" className="help-button" onClick={() => { setStep(0); setOpen(true); }}>Help / tour</button>
    <dialog ref={dialog} className="navigation-help" aria-labelledby="tour-title" onCancel={close}>
      <div className="tour-top"><span className="studio-kicker">QUICK START / {step + 1} OF {STEPS.length}</span><button type="button" aria-label="Close tutorial" onClick={close}>Close</button></div>
      <div className="tour-number" aria-hidden="true">{current.number}</div>
      <div aria-live="polite"><h2 id="tour-title">{current.title}</h2><p>{current.body}</p><p className="tour-detail">{current.detail}</p></div>
      <div className="tour-progress" aria-label={`Step ${step + 1} of ${STEPS.length}`}>{STEPS.map((s,i) => <span key={s.number} className={i === step ? "active" : ""} />)}</div>
      <footer><button type="button" disabled={step === 0} onClick={() => setStep(s => s - 1)}>Previous</button>{step < STEPS.length - 1 ? <button type="button" className="primary" onClick={() => setStep(s => s + 1)}>Next</button> : <button type="button" className="primary" onClick={() => { openStudyView("lungs"); close(); }}>Try Lung shape</button>}</footer>
    </dialog>
  </>;
}
