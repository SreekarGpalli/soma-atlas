import { GROQ_TOOLS, SYSTEM_PROMPT, runTool, traceLabel } from "./tools";
import { newId, useAtlasStore } from "@/store/useAtlasStore";

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

/** OpenAI-shaped message, including the tool roles Groq expects. */
export type WireMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string; name: string };

interface StreamResult {
  content: string;
  toolCalls: ToolCall[];
}

/**
 * Reads Groq's SSE stream, assembling both the answer text and any tool calls.
 * Tool-call arguments arrive as fragments across many deltas and are keyed by
 * index, not id, so they have to be stitched by position.
 */
async function streamOnce(
  apiKey: string,
  model: string,
  messages: WireMessage[],
  onText: (chunk: string) => void,
  signal: AbortSignal,
): Promise<StreamResult> {
  const res = await fetch("/api/tutor", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, model, messages, tools: GROQ_TOOLS }),
  });

  if (!res.ok || !res.body) {
    let message = `Tutor request failed (${res.status}).`;
    try {
      const err = await res.json();
      if (err?.error) message = String(err.error);
    } catch {
      /* stream or empty body */
    }
    throw new Error(message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const partial = new Map<number, ToolCall>();

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let cut: number;
    while ((cut = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, cut).trim();
      buffer = buffer.slice(cut + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      let parsed: {
        choices?: {
          delta?: {
            content?: string | null;
            tool_calls?: {
              index: number;
              id?: string;
              function?: { name?: string; arguments?: string };
            }[];
          };
        }[];
        error?: { message?: string };
      };
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue;
      }
      if (parsed.error?.message) throw new Error(parsed.error.message);

      const delta = parsed.choices?.[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        content += delta.content;
        onText(delta.content);
      }

      for (const call of delta.tool_calls ?? []) {
        const existing = partial.get(call.index) ?? {
          id: call.id ?? `call_${newId()}`,
          type: "function" as const,
          function: { name: "", arguments: "" },
        };
        if (call.id) existing.id = call.id;
        if (call.function?.name) existing.function.name = call.function.name;
        if (call.function?.arguments) {
          existing.function.arguments += call.function.arguments;
        }
        partial.set(call.index, existing);
      }
    }
  }

  return {
    content,
    toolCalls: [...partial.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => v)
      .filter((c) => c.function.name),
  };
}

const MAX_TOOL_ROUNDS = 6;
/** Keep the last N turns so a long session cannot blow the context window. */
const HISTORY_TURNS = 12;

export interface AskOptions {
  apiKey: string;
  model: string;
  question: string;
  signal: AbortSignal;
  onText: (chunk: string) => void;
  /**
   * Called when a round turns out to have been a tool round, so the UI can
   * drop any prose it optimistically streamed for it.
   */
  onDiscardRound: () => void;
}

/**
 * Runs one tutor turn: stream, execute any tool calls against the live atlas,
 * feed the results back, repeat until the model answers in prose.
 */
export async function askTutor(opts: AskOptions): Promise<string> {
  const store = useAtlasStore.getState();
  const prior: WireMessage[] = store.messages
    .slice(-HISTORY_TURNS)
    .filter((m) => !m.error)
    .map((m) =>
      m.role === "user"
        ? { role: "user", content: m.content }
        : { role: "assistant", content: m.content },
    );
  const history: WireMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...prior,
    { role: "user", content: opts.question },
  ];

  let answer = "";
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const isLastRound = round === MAX_TOOL_ROUNDS;
    const { content, toolCalls } = await streamOnce(
      opts.apiKey,
      opts.model,
      history,
      opts.onText,
      opts.signal,
    );
    answer = content;

    if (!toolCalls.length || isLastRound) break;

    // That round was tool calls, not the answer: unwind its streamed prose.
    opts.onDiscardRound();

    history.push({ role: "assistant", content: content || null, tool_calls: toolCalls });

    for (const call of toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        args = {};
      }
      const traceId = call.id;
      useAtlasStore.getState().pushTrace({
        id: traceId,
        tool: call.function.name,
        label: traceLabel(call.function.name, args),
        status: "running",
      });

      let result: string;
      try {
        result = await runTool(call.function.name, args);
        useAtlasStore.getState().patchTrace(traceId, { status: "done" });
      } catch (err) {
        result = JSON.stringify({
          error: err instanceof Error ? err.message : "Tool failed.",
        });
        useAtlasStore.getState().patchTrace(traceId, { status: "error" });
      }

      history.push({
        role: "tool",
        content: result,
        tool_call_id: call.id,
        name: call.function.name,
      });
    }
  }

  return answer;
}
