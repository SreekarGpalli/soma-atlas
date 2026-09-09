import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanToolName } from "@/lib/tutor-client";
import { GROQ_TOOLS } from "@/lib/tools";

describe("tool-call names from the model", () => {
  const known = new Set(GROQ_TOOLS.map((t) => t.function.name));

  it("strips the Harmony channel marker GPT-OSS leaks into the name", () => {
    // The exact string that broke a live session: Groq then rejected every
    // later request with "not in request.tools", because the bad name went
    // into the assistant message and was replayed.
    assert.equal(
      cleanToolName("search_structures<|channel|>commentary"),
      "search_structures",
    );
    assert.ok(known.has(cleanToolName("search_structures<|channel|>commentary")));
  });

  it("strips the Harmony tool namespace", () => {
    assert.equal(cleanToolName("functions.show_structure"), "show_structure");
  });

  it("leaves a clean name alone", () => {
    for (const name of known) assert.equal(cleanToolName(name), name);
  });

  it("does not invent a tool from noise", () => {
    assert.ok(!known.has(cleanToolName("<|channel|>commentary")));
    assert.ok(!known.has(cleanToolName("not_a_tool")));
  });
});
