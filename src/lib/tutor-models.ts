/**
 * Models the tutor proxy will forward to.
 *
 * Shared by the API route (as an allowlist) and Settings (as the picker), so
 * the UI can never offer a model the route rejects. The previous Settings list
 * offered "qwen/qwen3.6-27b", which is not a Groq model id and always failed.
 */
export const TUTOR_MODELS = [
  {
    id: "openai/gpt-oss-120b",
    label: "GPT-OSS 120B",
    hint: "Best reasoning and tool use. Default.",
  },
  {
    id: "openai/gpt-oss-20b",
    label: "GPT-OSS 20B",
    hint: "Faster, lighter, still calls tools well.",
  },
  {
    id: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B",
    hint: "Strong general explanations.",
  },
  {
    id: "llama-3.1-8b-instant",
    label: "Llama 3.1 8B",
    hint: "Fastest. Weaker at multi-step tool use.",
  },
] as const;

export const TUTOR_MODEL_IDS = TUTOR_MODELS.map((m) => m.id);
export const DEFAULT_TUTOR_MODEL = TUTOR_MODELS[0].id;

export function isAllowedModel(id: unknown): id is string {
  return typeof id === "string" && (TUTOR_MODEL_IDS as readonly string[]).includes(id);
}
