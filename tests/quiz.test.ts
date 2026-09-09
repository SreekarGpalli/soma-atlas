import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildQuiz, checkAnswer } from "@/lib/quiz";
import { STRUCTURE_BY_ID, meshesFor } from "@/data/structures";
import type { QuizQuestion } from "@/lib/types";

const mcq = (answer: string, choices: string[]): QuizQuestion => ({
  id: "q",
  type: "identify",
  prompt: "?",
  structureId: "heart",
  choices,
  answer,
});

const freeText = (answer: string): QuizQuestion => ({
  id: "q",
  type: "innervation",
  prompt: "?",
  structureId: "heart",
  answer,
});

describe("checkAnswer", () => {
  it("accepts the exact multiple-choice answer", () => {
    assert.equal(checkAnswer(mcq("Left lung", ["Left lung", "Liver"]), "Left lung"), true);
  });

  it("rejects a substring of the multiple-choice answer", () => {
    // The original grader used `answer.includes(choice)`, so picking "Lung"
    // when the answer was "Left lung" scored as correct.
    const q = mcq("Left lung", ["Left lung", "Lung", "Liver"]);
    assert.equal(checkAnswer(q, "Lung"), false);
    assert.equal(checkAnswer(q, "Liver"), false);
  });

  it("rejects an empty answer", () => {
    assert.equal(checkAnswer(mcq("Heart", ["Heart"]), ""), false);
    assert.equal(checkAnswer(mcq("Heart", ["Heart"]), "   "), false);
    assert.equal(checkAnswer(freeText("Vagus nerve"), ""), false);
  });

  it("grades free text on meaning, not exact wording", () => {
    const q = freeText("Musculocutaneous nerve (C5, C6)");
    assert.equal(checkAnswer(q, "musculocutaneous"), true);
    assert.equal(checkAnswer(q, "Musculocutaneous nerve"), true);
    assert.equal(checkAnswer(q, "median nerve"), false);
  });

  it("ignores side and part-of-speech noise in free text", () => {
    assert.equal(checkAnswer(freeText("The left phrenic nerve"), "left phrenic"), true);
  });

  it("does not confuse a nerve with the artery of the same name", () => {
    assert.equal(checkAnswer(freeText("Femoral artery"), "femoral nerve"), false);
    assert.equal(checkAnswer(freeText("Femoral nerve"), "femoral artery"), false);
    assert.equal(checkAnswer(freeText("Femoral nerve"), "femoral"), true);
  });

  it("does not accept the wrong side", () => {
    assert.equal(checkAnswer(freeText("Left phrenic nerve"), "right phrenic nerve"), false);
    assert.equal(
      checkAnswer(mcq("Left lung", ["Left lung", "Right lung"]), "Right lung"),
      false,
    );
  });

  it("tolerates capitalisation and punctuation", () => {
    assert.equal(
      checkAnswer(mcq("Left lung", ["Left lung"]), "  LEFT  LUNG  "),
      true,
    );
  });
});

describe("buildQuiz", () => {
  it("builds a full quiz for the male module", () => {
    const quiz = buildQuiz({ sex: "male" });
    assert.equal(quiz.length, 8);
  });

  it("only asks about structures that exist in the 3D view", () => {
    for (const q of buildQuiz({ sex: "male" })) {
      const s = STRUCTURE_BY_ID[q.structureId];
      assert.ok(s, `${q.structureId} is not in the catalog`);
      assert.ok(
        meshesFor(q.structureId).length > 0,
        `${q.structureId} has no geometry to highlight`,
      );
    }
  });

  it("never offers duplicate choices or a question without its answer", () => {
    for (let run = 0; run < 25; run++) {
      for (const q of buildQuiz({ sex: "male" })) {
        if (!q.choices) continue;
        assert.equal(
          new Set(q.choices.map((c) => c.toLowerCase())).size,
          q.choices.length,
          `duplicate choices in "${q.prompt}"`,
        );
        assert.ok(
          q.choices.includes(q.answer),
          `answer missing from choices in "${q.prompt}"`,
        );
        assert.equal(
          q.choices.filter((c) => checkAnswer(q, c)).length,
          1,
          `exactly one choice should grade correct in "${q.prompt}"`,
        );
      }
    }
  });

  it("respects a system filter", () => {
    const quiz = buildQuiz({ sex: "male", system: "cardiovascular" });
    assert.ok(quiz.length > 0);
    for (const q of quiz) {
      assert.equal(STRUCTURE_BY_ID[q.structureId]?.system, "cardiovascular");
    }
  });

  it("does not ask a male-module student about female structures", () => {
    for (let run = 0; run < 10; run++) {
      for (const q of buildQuiz({ sex: "male" })) {
        assert.notEqual(STRUCTURE_BY_ID[q.structureId]?.sex, "female");
      }
    }
  });

  it("builds a female-module quiz", () => {
    assert.ok(buildQuiz({ sex: "female" }).length > 0);
  });
});
