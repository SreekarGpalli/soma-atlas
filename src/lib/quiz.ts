import { STRUCTURES, STRUCTURE_BY_ID } from "@/data/structures";
import { REGION_META, SYSTEM_META } from "./systems";
import type { QuizKind, QuizQuestion, SexModule, Structure, SystemId } from "./types";

const QUESTION_COUNT = 8;

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Case, punctuation and spacing only. Side and head nouns are meaning. */
function tidy(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Looser form for free text, where phrasing varies but the nouns do not. */
function loose(s: string): string {
  return tidy(s)
    .replace(/\b(the|a|an|of|and|to|from|via|by|its|is|are)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Words that name a *kind* of structure rather than which one. They carry no
 * information for scoring, but a mismatch between them is decisive: a femoral
 * artery is not a femoral nerve.
 */
const HEAD_NOUNS = [
  "nerve",
  "artery",
  "vein",
  "muscle",
  "gland",
  "bone",
  "ligament",
  "tendon",
  "branch",
  "trunk",
];

function headNoun(t: string): string | null {
  return HEAD_NOUNS.find((n) => new RegExp(`\\b${n}s?\\b`).test(t)) ?? null;
}

function side(t: string): "left" | "right" | null {
  if (/\bleft\b/.test(t)) return "left";
  if (/\bright\b/.test(t)) return "right";
  return null;
}

/**
 * Multiple choice is graded on an exact match. Free text is graded on the
 * distinctive words, because "musculocutaneous" and "Musculocutaneous nerve
 * (C5, C6)" are the same answer.
 *
 * The original grader used `answer.includes(choice)` for both, so picking
 * "Lung" when the answer was "Left lung" scored as correct. Laterality and the
 * kind of structure must never be normalised away: left and right are
 * different answers, and so are a nerve and an artery.
 */
export function checkAnswer(q: QuizQuestion, given: string): boolean {
  if (!given.trim()) return false;
  if (q.choices) return tidy(given) === tidy(q.answer);

  const a = loose(q.answer);
  const g = loose(given);
  if (!a) return tidy(given) === tidy(q.answer);
  if (g === a) return true;

  const wantSide = side(a);
  if (wantSide && side(g) && side(g) !== wantSide) return false;

  const wantHead = headNoun(a);
  const gotHead = headNoun(g);
  if (wantHead && gotHead && wantHead !== gotHead) return false;

  const distinctive = a
    .split(" ")
    .filter((w) => w.length > 2 && !HEAD_NOUNS.includes(w));
  if (!distinctive.length) return g === a;
  const hit = distinctive.filter((w) => g.includes(w)).length;
  return hit / distinctive.length >= 0.6;
}

/** Only structures a student could reasonably be asked to name. */
function quizPool(system: SystemId | undefined, sex: SexModule): Structure[] {
  return STRUCTURES.filter((s) => {
    if (s.missingMeshReason) return false;
    if (!s.meshIds?.length) return false;
    if (s.sex !== "both" && s.sex !== sex) return false;
    if (system && s.system !== system) return false;
    // Skip raw BodyParts3D fragments: they make unanswerable questions.
    if (!s.curated && !s.clinical && (s.meshIds?.length ?? 0) < 2) return false;
    return true;
  });
}

function distractors(target: Structure, pool: Structure[], n: number): string[] {
  const sameSystem = pool.filter(
    (x) => x.id !== target.id && x.system === target.system,
  );
  const anywhere = STRUCTURES.filter(
    (x) => x.id !== target.id && x.curated && x.name !== target.name,
  );
  const source = sameSystem.length >= n ? sameSystem : [...sameSystem, ...anywhere];
  const out: string[] = [];
  for (const s of shuffle(source)) {
    if (out.length >= n) break;
    if (s.name.toLowerCase() === target.name.toLowerCase()) continue;
    if (out.some((x) => x.toLowerCase() === s.name.toLowerCase())) continue;
    out.push(s.name);
  }
  return out;
}

function makeQuestion(
  s: Structure,
  pool: Structure[],
  index: number,
): QuizQuestion | null {
  const kinds: QuizKind[] = ["identify", "name", "region"];
  if (s.muscle?.innervation) kinds.push("innervation");
  if (s.muscle?.action) kinds.push("action");
  const type = kinds[index % kinds.length];
  const id = `q${index}-${s.id}-${type}`;

  switch (type) {
    case "innervation":
      return {
        id,
        type,
        structureId: s.id,
        prompt: `What is the nerve supply of ${s.name}?`,
        answer: s.muscle!.innervation,
        explanation: s.muscle?.action
          ? `Action: ${s.muscle.action}`
          : undefined,
      };
    case "action":
      return {
        id,
        type,
        structureId: s.id,
        prompt: `What is the main action of ${s.name}?`,
        answer: s.muscle!.action,
        explanation: `Innervation: ${s.muscle!.innervation}`,
      };
    case "region": {
      const wrong = shuffle(
        Object.keys(REGION_META).filter((r) => r !== s.region),
      ).slice(0, 3);
      return {
        id,
        type,
        structureId: s.id,
        prompt: `In which region would you find ${s.name}?`,
        choices: shuffle([
          REGION_META[s.region].label,
          ...wrong.map((r) => REGION_META[r as keyof typeof REGION_META].label),
        ]),
        answer: REGION_META[s.region].label,
        explanation: `${s.name} — ${SYSTEM_META[s.system].label} system.`,
      };
    }
    case "identify": {
      const wrong = distractors(s, pool, 3);
      if (wrong.length < 2) return null;
      return {
        id,
        type,
        structureId: s.id,
        prompt: "Which structure is highlighted in the viewer?",
        choices: shuffle([s.name, ...wrong]),
        answer: s.name,
        explanation: s.clinical ?? s.summary,
      };
    }
    case "name":
    default: {
      const wrong = distractors(s, pool, 3);
      if (wrong.length < 2) return null;
      const clue = s.clinical ?? s.relations ?? s.summary;
      return {
        id,
        type: "name",
        structureId: s.id,
        prompt: `Which structure does this describe?\n"${clue}"`,
        choices: shuffle([s.name, ...wrong]),
        answer: s.name,
        explanation: `${SYSTEM_META[s.system].label} · ${REGION_META[s.region].label}`,
      };
    }
  }
}

export function buildQuiz(opts: {
  system?: SystemId;
  sex: SexModule;
}): QuizQuestion[] {
  const pool = quizPool(opts.system, opts.sex);
  if (pool.length < 4) return [];
  // Prefer structures that carry real teaching content.
  const rich = pool.filter((s) => s.curated || s.clinical || s.muscle);
  const source = rich.length >= QUESTION_COUNT ? rich : pool;

  const out: QuizQuestion[] = [];
  for (const s of shuffle(source)) {
    if (out.length >= QUESTION_COUNT) break;
    const q = makeQuestion(s, pool, out.length);
    if (q) out.push(q);
  }
  return out;
}

export function quizTargetName(q: QuizQuestion): string {
  return STRUCTURE_BY_ID[q.structureId]?.name ?? q.structureId;
}
