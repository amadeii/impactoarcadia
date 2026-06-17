/**
 * Shim do LLM Orchestrator para módulos Control e HR.
 * Tenta usar OpenAI (gpt-4o-mini) como fallback leve.
 * Em caso de falha, retorna null silenciosamente (os callers verificam).
 */
import OpenAI from "openai";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export async function runWithOrchestration<T = any>(
  prompt: string,
  options?: { systemPrompt?: string; model?: string; maxTokens?: number }
): Promise<T | null> {
  try {
    if (!process.env.OPENAI_API_KEY) return null;
    const response = await getClient().chat.completions.create({
      model: options?.model ?? "gpt-4o-mini",
      messages: [
        ...(options?.systemPrompt
          ? [{ role: "system" as const, content: options.systemPrompt }]
          : []),
        { role: "user" as const, content: prompt },
      ],
      max_tokens: options?.maxTokens ?? 2048,
    });
    const text = response.choices[0]?.message?.content ?? null;
    if (!text) return null;
    // Try JSON parse, else return as string
    try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
  } catch (e) {
    console.warn("[llmOrchestrator] Falha silenciosa:", (e as Error).message);
    return null;
  }
}
