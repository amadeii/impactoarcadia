import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { getProviderConfig, resolveKey, resolveBaseUrl, type ProviderKey } from './configStore';

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: string } };

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

export interface LLMCallParams {
  provider: 'openai' | 'anthropic' | 'gemini' | 'ollama';
  model: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

function normalizeContent(content: string | ContentPart[], provider: string): string | ContentPart[] {
  if (typeof content === 'string') return content;
  if (provider === 'openai' || provider === 'gemini') return content;
  return content.filter((p: ContentPart) => p.type === 'text').map((p: ContentPart) => (p as any).text).join('\n\n');
}

export interface LLMCallResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

// ── Clientes lazy ────────────────────────────────────────────────
const _clients: Partial<Record<ProviderKey, Anthropic | OpenAI>> = {};

async function openaiClient(): Promise<OpenAI> {
  const cfg = await getProviderConfig('openai');
  const key = resolveKey('openai', cfg);
  if (!key) throw new Error('OPENAI_API_KEY não configurada');
  const baseURL = resolveBaseUrl('openai', cfg);
  _clients.openai = new OpenAI({ apiKey: key, ...(baseURL ? { baseURL } : {}) });
  return _clients.openai as OpenAI;
}

async function anthropicClient(): Promise<Anthropic> {
  const cfg = await getProviderConfig('anthropic');
  const key = resolveKey('anthropic', cfg);
  if (!key) throw new Error('ANTHROPIC_API_KEY não configurada');
  _clients.anthropic = new Anthropic({ apiKey: key });
  return _clients.anthropic as Anthropic;
}

async function geminiClient(): Promise<OpenAI> {
  const cfg = await getProviderConfig('gemini');
  const key = resolveKey('gemini', cfg);
  if (!key) throw new Error('GEMINI_API_KEY não configurada');
  _clients.gemini = new OpenAI({
    apiKey: key,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
  });
  return _clients.gemini as OpenAI;
}

async function ollamaClient(): Promise<OpenAI> {
  const cfg = await getProviderConfig('ollama');
  const baseURL = resolveBaseUrl('ollama', cfg) ?? 'http://ollama:11434/v1';
  _clients.ollama = new OpenAI({ apiKey: 'ollama', baseURL });
  return _clients.ollama as OpenAI;
}

// ── Chamada principal ────────────────────────────────────────────
export async function callLLM(params: LLMCallParams): Promise<LLMCallResult> {
  const { provider, model, messages, maxTokens = 4000, temperature = 0.2, signal } = params;

  if (provider === 'anthropic') {
    const client = await anthropicClient();
    const system = messages.find(m => m.role === 'system')?.content ?? '';
    const systemStr = typeof system === 'string' ? system : (system as ContentPart[]).filter(p => p.type === 'text').map(p => (p as any).text).join('');
    const nonSys = messages.filter(m => m.role !== 'system');
    const res = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemStr,
      messages: nonSys.map(m => ({ role: m.role as 'user' | 'assistant', content: normalizeContent(m.content, 'anthropic') as string })),
    }, { signal });
    const text = res.content.filter(b => b.type === 'text').map(b => (b as any).text as string).join('');
    return { text, tokensIn: res.usage.input_tokens, tokensOut: res.usage.output_tokens };
  }

  // OpenAI, Gemini (OpenAI-compatible), Ollama
  const client = provider === 'openai'  ? await openaiClient()
               : provider === 'gemini'  ? await geminiClient()
               :                          await ollamaClient();

  const res = await (client.chat.completions.create as Function)({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: messages.map(m => ({ role: m.role, content: normalizeContent(m.content, provider) })),
  }, { signal });

  return {
    text: res.choices[0]?.message?.content ?? '',
    tokensIn: res.usage?.prompt_tokens ?? 0,
    tokensOut: res.usage?.completion_tokens ?? 0,
  };
}

// ── Ping para health check ───────────────────────────────────────
export async function pingProvider(
  provider: 'openai' | 'anthropic' | 'gemini' | 'ollama'
): Promise<{ ok: boolean; error?: string }> {
  try {
    const cfg = await getProviderConfig(provider as ProviderKey);
    const key = resolveKey(provider as ProviderKey, cfg);
    if (!key && provider !== 'ollama') {
      return { ok: false, error: 'Nenhuma chave configurada' };
    }

    const model = provider === 'openai'     ? 'gpt-4o-mini'
                : provider === 'anthropic'  ? 'claude-haiku-4-5-20251001'
                : provider === 'gemini'     ? 'gemini-2.0-flash-lite'
                :                             'qwen2.5:1.5b';

    await callLLM({
      provider,
      model,
      messages: [{ role: 'user', content: 'reply with the word ok only' }],
      maxTokens: 5,
      signal: AbortSignal.timeout(15000),
    });
    return { ok: true };
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error(`[suite-llm] pingProvider ${provider} error:`, msg);
    return { ok: false, error: msg };
  }
}
