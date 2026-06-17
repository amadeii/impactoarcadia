import { pingProvider } from './llmClient';

type Provider = 'openai' | 'anthropic' | 'gemini' | 'ollama';

interface HealthEntry {
  healthy: boolean;
  failCount: number;
  checkedAt: number;
}

const healthMap = new Map<Provider, HealthEntry>([
  ['openai',    { healthy: true,  failCount: 0, checkedAt: 0 }],
  ['anthropic', { healthy: true,  failCount: 0, checkedAt: 0 }],
  ['gemini',    { healthy: true,  failCount: 0, checkedAt: 0 }],
  ['ollama',    { healthy: false, failCount: 0, checkedAt: 0 }],
]);

export function isHealthy(provider: Provider): boolean {
  return healthMap.get(provider)?.healthy ?? false;
}

export function markUnhealthy(provider: Provider): void {
  const e = healthMap.get(provider)!;
  e.healthy = false;
  e.failCount++;
  e.checkedAt = Date.now();
  console.warn(`[suite-llm] ${provider} unhealthy (fail #${e.failCount})`);
}

export function markHealthy(provider: Provider): void {
  const e = healthMap.get(provider)!;
  e.healthy = true;
  e.failCount = 0;
  e.checkedAt = Date.now();
}

export function getHealthSnapshot(): Record<Provider, boolean> {
  return Object.fromEntries(
    [...healthMap.entries()].map(([k, v]) => [k, v.healthy])
  ) as Record<Provider, boolean>;
}

export function startHealthProbe(): void {
  if (process.env.DISABLE_LLM_HEALTH_PROBE === 'true') return;

  const probe = async () => {
    for (const provider of ['openai', 'anthropic', 'gemini', 'ollama'] as Provider[]) {
      const result = await pingProvider(provider);
      result.ok ? markHealthy(provider) : markUnhealthy(provider);
    }
    console.log('[suite-llm] health:', JSON.stringify(getHealthSnapshot()));
  };

  probe().catch(console.error);
  setInterval(probe, 5 * 60 * 1000);
  console.log('[suite-llm] health probe iniciado');
}
