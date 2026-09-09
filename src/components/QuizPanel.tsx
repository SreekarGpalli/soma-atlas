"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { STRUCTURES, STRUCTURE_BY_ID } from "@/data/structures";
import { checkAnswer } from "@/lib/quiz";
import { SYSTEM_IDS, SYSTEM_META } from "@/lib/systems";
import { useAtlasStore } from "@/store/useAtlasStore";
import { IconQuiz } from "./Icons";
import type { SystemId } from "@/lib/types";

function QuizStart() {
  const startQuiz = useAtlasStore((s) => s.startQuiz);
  const sex = useAtlasStore((s) => s.sex);

  // Only offer systems with enough answerable material for eight questions.
  const options = useMemo(() => {
    const counts = {} as Record<SystemId, number>;
    for (const id of SYSTEM_IDS) counts[id] = 0;
    for (const s of STRUCTURES) {
      if (s.sex !== "both" && s.sex !== sex) continue;
      if (!s.meshIds?.length) continue;
      if (!s.curated && !s.clinical && (s.meshIds?.length ?? 0) < 2) continue;
      counts[s.system] += 1;
    }
    return SYSTEM_IDS.filter((id) => counts[id] >= 8);
  }, [sex]);

  return (
    <div className="panel-inner">
      <header className="panel-head">
        <div>
          <h2>Quiz</h2>
          <p className="sub">
            Eight questions from the loaded catalog. Works offline.
          </p>
        </div>
      </header>

      <div className="choices">
        <button type="button" className="primary" onClick={() => startQuiz()}>
          Mixed — high yield
        </button>
        {options.map((id) => (
          <button key={id} type="button" onClick={() => startQuiz(id)}>
            <span
              className="dot"
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: SYSTEM_META[id].color,
              }}
            />
            {SYSTEM_META[id].label}
          </button>
        ))}
      </div>

      <p className="faint">
        The viewer highlights the structure in question. Identification
        questions keep the label hidden until you answer.
      </p>
    </div>
  );
}

export function QuizPanel() {
  const quiz = useAtlasStore((s) => s.quiz);
  const quizIndex = useAtlasStore((s) => s.quizIndex);
  const quizScore = useAtlasStore((s) => s.quizScore);
  const quizAnswered = useAtlasStore((s) => s.quizAnswered);
  const quizGiven = useAtlasStore((s) => s.quizGiven);
  const lastCorrect = useAtlasStore((s) => s.lastQuizCorrect);
  const answerQuiz = useAtlasStore((s) => s.answerQuiz);
  const nextQuiz = useAtlasStore((s) => s.nextQuiz);
  const startQuiz = useAtlasStore((s) => s.startQuiz);
  const endQuiz = useAtlasStore((s) => s.endQuiz);
  const select = useAtlasStore((s) => s.select);

  const [typed, setTyped] = useState("");
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setTyped(""), [quizIndex]);

  // Move focus to the continue button so the keyboard flow keeps working.
  useEffect(() => {
    if (quizAnswered) nextRef.current?.focus();
  }, [quizAnswered]);

  if (!quiz.length) return <QuizStart />;

  const q = quiz[quizIndex];
  if (!q) return <QuizStart />;

  const last = quizIndex === quiz.length - 1;
  const finished = last && quizAnswered;
  const target = STRUCTURE_BY_ID[q.structureId];
  const pct = Math.round((quizScore / quiz.length) * 100);

  return (
    <div className="panel-inner">
      <header className="panel-head">
        <div style={{ flex: 1 }}>
          <h2>
            Question {quizIndex + 1}
            <span className="faint" style={{ fontWeight: 400 }}>
              {" "}
              / {quiz.length}
            </span>
          </h2>
          <p className="sub">Score {quizScore}</p>
        </div>
        <button type="button" className="ghost" onClick={endQuiz}>
          End
        </button>
      </header>

      <div className="quiz-progress" aria-hidden>
        {quiz.map((item, i) => (
          <i
            key={item.id}
            className={
              i < quizIndex || (i === quizIndex && quizAnswered)
                ? "done"
                : i === quizIndex
                  ? "current"
                  : ""
            }
          />
        ))}
      </div>

      <p className="quiz-prompt">{q.prompt}</p>

      {q.type === "identify" && (
        <p className="faint">Look at the highlighted mesh in the viewer.</p>
      )}

      {q.choices ? (
        <div className="choices">
          {q.choices.map((c) => {
            const isCorrect = quizAnswered && checkAnswer(q, c);
            const isWrongPick = quizAnswered && c === quizGiven && !isCorrect;
            return (
              <button
                key={c}
                type="button"
                className={isCorrect ? "correct" : isWrongPick ? "wrong" : ""}
                disabled={quizAnswered}
                onClick={() => answerQuiz(c)}
              >
                {c}
              </button>
            );
          })}
        </div>
      ) : (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (typed.trim()) answerQuiz(typed);
          }}
        >
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Type your answer"
            disabled={quizAnswered}
            aria-label="Your answer"
            autoComplete="off"
          />
          <button
            type="submit"
            className="primary"
            disabled={quizAnswered || !typed.trim()}
          >
            Check
          </button>
        </form>
      )}

      {quizAnswered && (
        <div className={`verdict ${lastCorrect ? "good" : "poor"}`}>
          <div>
            <strong>
              {lastCorrect ? "Correct" : "Not quite"}
              {!lastCorrect && ` — ${q.answer}`}
            </strong>
            {q.explanation && (
              <div className="muted" style={{ marginTop: 4 }}>
                {q.explanation}
              </div>
            )}
            {target && (
              <button
                type="button"
                className="ghost"
                style={{ marginTop: 6, paddingLeft: 0 }}
                onClick={() => select(target.id, { openCard: true })}
              >
                Open {target.name} →
              </button>
            )}
          </div>
        </div>
      )}

      {quizAnswered && !finished && (
        <button ref={nextRef} type="button" className="primary" onClick={nextQuiz}>
          Next question
        </button>
      )}

      {finished && (
        <div className="card" style={{ display: "grid", gap: 10, justifyItems: "start" }}>
          <div className="score-ring">
            {quizScore}/{quiz.length}
          </div>
          <p className="muted">
            {pct >= 80
              ? "Strong. Try a different system next."
              : pct >= 50
                ? "Solid base — revise the ones you missed."
                : "Worth a second pass. Open the cards for the misses."}
          </p>
          <div className="tag-row">
            <button ref={nextRef} type="button" className="primary" onClick={() => startQuiz()}>
              New quiz
            </button>
            <button type="button" onClick={endQuiz}>
              Choose a system
            </button>
          </div>
        </div>
      )}

      {!quiz.length && <IconQuiz />}
    </div>
  );
}
