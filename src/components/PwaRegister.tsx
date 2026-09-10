"use client";

import { useEffect, useState } from "react";
import { loadLocal, saveLocal } from "@/lib/storage";
import { IconClose } from "./Icons";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "development") {
      void navigator.serviceWorker.getRegistrations().then(registrations => {
        for (const r of registrations) if (r.active?.scriptURL === new URL("/sw.js", location.href).href) void r.unregister();
      });
      return;
    }
    // Registering after load keeps the worker off the critical path.
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}

type PromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

export function InstallBanner() {
  const [promptEvent, setPromptEvent] = useState<PromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (loadLocal<boolean>("installDismissed", false)) return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator &&
        Boolean((navigator as { standalone?: boolean }).standalone));
    if (standalone) return;

    const isIos =
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      // iPadOS 13+ reports as a Mac; touch points give it away.
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIos(isIos);
    if (isIos) setVisible(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as PromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    saveLocal("installDismissed", true);
    setVisible(false);
  };

  return (
    <div className="banner">
      <div className="grow">
        <strong>Install G.L.S.C Atlas</strong>
        <p className="muted" style={{ margin: 0 }}>
          {promptEvent
            ? "Keeps the atlas, notes, quizzes and slices available offline."
            : ios
              ? "Tap Share → Add to Home Screen. Safari keeps the offline cache far longer once installed."
              : "Use your browser's install command for offline study."}
        </p>
      </div>
      {promptEvent && (
        <button
          type="button"
          className="primary"
          onClick={async () => {
            await promptEvent.prompt();
            dismiss();
          }}
        >
          Install
        </button>
      )}
      <button
        type="button"
        className="ghost"
        onClick={dismiss}
        aria-label="Dismiss install prompt"
      >
        <IconClose style={{ width: 14, height: 14 }} />
      </button>
    </div>
  );
}
