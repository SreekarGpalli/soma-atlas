"use client";

import { useEffect, useRef, useState } from "react";
import { askTutor } from "@/lib/tutor-client";
import { newId, useAtlasStore } from "@/store/useAtlasStore";
import { STRUCTURE_BY_ID } from "@/data/structures";
import { IconCheck, IconClose, IconTutor } from "./Icons";
import { RichText } from "./RichText";

const STARTERS = [
  "Show the left lung and explain its lobes and fissures",
  "Cut an axial plane through the thorax and name what it crosses",
  "Compare the male and female bony pelvis",
  "Quiz me on the cardiovascular system",
];

export function TutorPanel() {
  const groqKey = useAtlasStore((s) => s.groqKey);
  const groqModel = useAtlasStore((s) => s.groqModel);
  const messages = useAtlasStore((s) => s.messages);
  const trace = useAtlasStore((s) => s.toolTrace);
  const busy = useAtlasStore((s) => s.tutorBusy);
  const setPanel = useAtlasStore((s) => s.setPanel);
  const clearMessages = useAtlasStore((s) => s.clearMessages);
  const focusedId = useAtlasStore((s) => s.focusedId);

  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState("");
  const abort = useRef<AbortController | null>(null);
  const threadEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadEnd.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, streaming, trace]);

  // Never leave a request running after the panel unmounts.
  useEffect(() => () => abort.current?.abort(), []);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    if (!groqKey) {
      setPanel("settings");
      return;
    }

    const store = useAtlasStore.getState();
    store.pushMessage({ id: newId(), role: "user", content: q });
    setText("");
    store.clearTrace();
    store.setTutorBusy(true);
    setStreaming("");

    const controller = new AbortController();
    abort.current = controller;

    try {
      const answer = await askTutor({
        apiKey: groqKey,
        model: groqModel,
        question: q,
        signal: controller.signal,
        onText: (chunk) => setStreaming((prev) => prev + chunk),
        onDiscardRound: () => setStreaming(""),
      });
      useAtlasStore.getState().pushMessage({
        id: newId(),
        role: "assistant",
        content:
          answer.trim() ||
          "I moved the atlas for you. Ask a follow-up for the explanation.",
        tools: useAtlasStore
          .getState()
          .toolTrace.map((t) => ({ name: t.tool, summary: t.label })),
      });
    } catch (err) {
      if (!controller.signal.aborted) {
        useAtlasStore.getState().pushMessage({
          id: newId(),
          role: "assistant",
          error: true,
          content:
            err instanceof Error ? err.message : "The tutor request failed.",
        });
      }
    } finally {
      setStreaming("");
      abort.current = null;
      useAtlasStore.getState().setTutorBusy(false);
    }
  };

  const contextHint = focusedId ? STRUCTURE_BY_ID[focusedId]?.name : null;

  return (
    <div className="panel-inner tutor" style={{ height: "100%" }}>
      <header className="panel-head">
        <div>
          <h2>Tutor</h2>
          <p className="sub">
            {groqModel} · needs a connection
            {contextHint ? ` · viewing ${contextHint}` : ""}
          </p>
        </div>
        {messages.length > 0 && (
          <button type="button" className="ghost" onClick={clearMessages}>
            Clear
          </button>
        )}
      </header>

      {!groqKey && (
        <div className="notice warn">
          <div>
            <strong>No Groq key yet.</strong> The tutor runs on your own key,
            stored only in this browser.{" "}
            <button
              type="button"
              className="ghost"
              style={{ padding: "0 2px" }}
              onClick={() => setPanel("settings")}
            >
              Add it in Setup →
            </button>
          </div>
        </div>
      )}

      <div className="tutor-thread">
        {messages.length === 0 && !streaming && (
          <div className="empty">
            <IconTutor />
            <p>Ask about anything on screen.</p>
            <p className="faint">
              The tutor drives the viewer — it can search, isolate, cut a
              section plane and start a quiz, then explain what it did.
            </p>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.role} ${m.error ? "error" : ""}`}>
            <span className="who">{m.role === "user" ? "You" : "Tutor"}</span>
            {m.tools && m.tools.length > 0 && (
              <ul className="trace">
                {m.tools.map((t, i) => (
                  <li key={`${m.id}-${i}`} className="done">
                    <span className="mark">
                      <IconCheck style={{ width: 11, height: 11 }} />
                    </span>
                    {t.summary}
                  </li>
                ))}
              </ul>
            )}
            <div className="body">
              {m.role === "assistant" && !m.error ? (
                <RichText text={m.content} />
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}

        {busy && trace.length > 0 && (
          <ul className="trace">
            {trace.map((t) => (
              <li key={t.id} className={t.status}>
                <span className="mark">
                  {t.status === "running" ? (
                    <span className="spinner" />
                  ) : t.status === "error" ? (
                    <IconClose style={{ width: 11, height: 11 }} />
                  ) : (
                    <IconCheck style={{ width: 11, height: 11 }} />
                  )}
                </span>
                {t.label}
              </li>
            ))}
          </ul>
        )}

        {streaming && (
          <div className="bubble assistant">
            <span className="who">Tutor</span>
            <div className="body">
              <RichText text={streaming} />
            </div>
          </div>
        )}

        {busy && !streaming && trace.length === 0 && (
          <ul className="trace">
            <li className="running">
              <span className="mark">
                <span className="spinner" />
              </span>
              Thinking…
            </li>
          </ul>
        )}

        <div ref={threadEnd} />
      </div>

      <form
        className="tutor-compose"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        {messages.length === 0 && (
          <div className="suggestions">
            {STARTERS.map((s) => (
              <button key={s} type="button" onClick={() => void send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(text);
            }
          }}
          placeholder="Ask a question. Enter to send, Shift+Enter for a new line."
          aria-label="Ask the tutor"
          rows={2}
        />
        <div className="compose-actions">
          <span className="faint grow">
            {busy ? "Working…" : "Educational use only."}
          </span>
          {busy ? (
            <button type="button" onClick={() => abort.current?.abort()}>
              Stop
            </button>
          ) : (
            <button type="submit" className="primary" disabled={!text.trim()}>
              Ask
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
