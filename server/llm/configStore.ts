import { db } from '../../db/index';
import { llmProviderConfigs } from '@shared/schema';
import { eq } from 'drizzle-orm';

export type ProviderKey = 'anthropic' | 'gemini' | 'ollama' | 'openai';

interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  enabled: boolean;
}

const cache = new Map<ProviderKey, ProviderConfig>();
let lastLoaded = 0;
const CACHE_TTL_MS = 60_000;

export async function getProviderConfig(provider: ProviderKey): Promise<ProviderConfig> {
  if (Date.now() - lastLoaded > CACHE_TTL_MS) {
    await reloadCache();
  }
  return cache.get(provider) ?? { enabled: true };
}

export async function reloadCache(): Promise<void> {
  try {
    const rows = await db.select().from(llmProviderConfigs);
    for (const row of rows) {
      cache.set(row.provider as ProviderKey, {
        apiKey: row.apiKey ?? undefined,
        baseUrl: row.baseUrl ?? undefined,
        enabled: row.enabled ?? true,
      });
    }
    lastLoaded = Date.now();
  } catch {
    // DB may not have table yet — fail silently, use env vars
  }
}

export async function saveProviderConfig(
  provider: ProviderKey,
  data: { apiKey?: string; baseUrl?: string; enabled?: boolean }
): Promise<void> {
  await db.insert(llmProviderConfigs)
    .values({
      provider,
      apiKey: data.apiKey || null,
      baseUrl: data.baseUrl || null,
      enabled: data.enabled ?? true,
    })
    .onConflictDoUpdate({
      target: llmProviderConfigs.provider,
      set: {
        apiKey: data.apiKey || null,
        baseUrl: data.baseUrl || null,
        enabled: data.enabled ?? true,
        updatedAt: new Date(),
      },
    });
  cache.delete(provider);
  lastLoaded = 0;
}

export async function getAllProviderConfigs(): Promise<Record<ProviderKey, ProviderConfig & { hasKey: boolean }>> {
  if (Date.now() - lastLoaded > CACHE_TTL_MS) {
    await reloadCache();
  }
  const providers: ProviderKey[] = ['openai', 'anthropic', 'gemini', 'ollama'];
  const result: any = {};
  for (const p of providers) {
    const cfg = cache.get(p) ?? { enabled: true };
    const envKey = p === 'anthropic' ? process.env.ANTHROPIC_API_KEY
                 : p === 'gemini'    ? process.env.GEMINI_API_KEY
                 : p === 'openai'    ? process.env.OPENAI_API_KEY
                 :                     null;
    result[p] = {
      ...cfg,
      hasKey: !!(cfg.apiKey || envKey),
      source: cfg.apiKey ? 'database' : envKey ? 'environment' : 'none',
    };
  }
  return result;
}

export function resolveKey(provider: ProviderKey, cached?: ProviderConfig): string | undefined {
  if (cached?.apiKey) return cached.apiKey;
  if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY;
  if (provider === 'gemini')    return process.env.GEMINI_API_KEY;
  if (provider === 'openai')    return process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  return undefined;
}

export function resolveBaseUrl(provider: ProviderKey, cached?: ProviderConfig): string | undefined {
  if (cached?.baseUrl) return cached.baseUrl;
  if (provider === 'openai') return process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? undefined;
  if (provider === 'ollama') return process.env.OLLAMA_BASE_URL ?? 'http://ollama:11434/v1';
  return undefined;
}
