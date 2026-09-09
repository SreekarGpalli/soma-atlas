import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_TUTOR_MODEL, isAllowedModel } from "@/lib/tutor-models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 60_000;
const MAX_BODY_BYTES = 512 * 1024;
const MAX_MESSAGES = 60;

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return bad("Conversation too large.", 413);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Request body must be JSON.");
  }

  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey.startsWith("gsk_") || apiKey.length < 20) {
    return bad("Add a Groq API key starting with gsk_ in Settings.", 401);
  }

  // An allowlist stops a crafted request using this route to probe arbitrary
  // Groq model ids, and keeps the UI from drifting onto ids that do not exist.
  const model = isAllowedModel(body.model) ? body.model : DEFAULT_TUTOR_MODEL;

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return bad("messages must be a non-empty array.");
  }
  if (body.messages.length > MAX_MESSAGES) {
    return bad("Too many messages in this conversation.", 413);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  // Hang up on Groq as soon as the browser hangs up on us.
  req.signal.addEventListener("abort", () => controller.abort());

  let upstream: Response;
  try {
    upstream = await fetch(GROQ_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: body.messages,
        tools: body.tools,
        tool_choice: body.tools ? "auto" : undefined,
        temperature: 0.2,
        max_completion_tokens: 1600,
        stream: true,
      }),
    });
  } catch (err) {
    clearTimeout(timer);
    const aborted = err instanceof Error && err.name === "AbortError";
    return bad(
      aborted ? "The tutor timed out. Try a shorter question." : "Could not reach Groq.",
      aborted ? 504 : 502,
    );
  }

  if (!upstream.ok || !upstream.body) {
    clearTimeout(timer);
    let message = `Groq returned ${upstream.status}.`;
    try {
      const err = await upstream.json();
      if (err?.error?.message) message = String(err.error.message);
    } catch {
      /* non-JSON error body */
    }
    if (upstream.status === 401) message = "Groq rejected that API key.";
    if (upstream.status === 429) {
      message = "Groq rate limit reached. Wait a moment and try again.";
    }
    return NextResponse.json({ error: message }, { status: upstream.status });
  }

  const stream = upstream.body.pipeThrough(
    new TransformStream({
      flush() {
        clearTimeout(timer);
      },
    }),
  );

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
