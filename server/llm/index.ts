import { callLLM, type LLMMessage } from './llmClient';
import { isHealthy, markUnhealthy, markHealthy, startHealthProbe } from './providerHealth';
import { getPolicy, type SuiteTaskType, type SuiteProvider } from './taskCascade';

export { startHealthProbe, getHealthSnapshot } from './providerHealth';
export type { SuiteTaskType, LLMMessage };

export interface OrchestrateParams {
  taskType: SuiteTaskType;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface OrchestrateResult {
  text: string;
  provider: SuiteProvider;
  model: string;
  tokensIn: number;
  tokensOut: number;
  tiersAttempted: number;
}

const TIER_TIMEOUT_MS = Number(process.env.LLM_TIER_TIMEOUT_MS ?? 60_000);

export async function orchestrate(
  params: OrchestrateParams
): Promise<OrchestrateResult> {
  const { taskType, messages, maxTokens = 4000, temperature = 0.2, signal } = params;
  const policy = getPolicy(taskType);

  let chain = [...policy.chain];
  if (policy.dataSensitive && isHealthy('ollama')) {
    chain = ['ollama', ...chain.filter(p => p !== 'ollama')];
  }

  let lastError: unknown;
  let tiersAttempted = 0;

  for (const provider of chain) {
    if (!isHealthy(provider)) {
      console.log(`[suite-llm] pulando ${provider} (unhealthy)`);
      continue;
    }

    const model = policy.models[provider];
    tiersAttempted++;

    const tierSignal = TIER_TIMEOUT_MS > 0
      ? AbortSignal.any([AbortSignal.timeout(TIER_TIMEOUT_MS), signal].filter(Boolean) as AbortSignal[])
      : signal;

    try {
      console.log(`[suite-llm] tentando ${provider}/${model} (task: ${taskType})`);
      const result = await callLLM({
        provider, model, messages, maxTokens, temperature,
        signal: tierSignal,
      });

      markHealthy(provider);
      console.log(`[suite-llm] ok: ${provider}/${model} (in:${result.tokensIn} out:${result.tokensOut})`);

      return {
        text: result.text,
        provider, model,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        tiersAttempted,
      };
    } catch (err: unknown) {
      lastError = err;
      console.warn(`[suite-llm] falhou ${provider}:`, (err as Error).message);
      markUnhealthy(provider);
    }
  }

  console.error('[suite-llm] todos os providers falharam para:', taskType);
  throw new Error(
    `[suite-llm] nenhum provider disponível para ${taskType}: ${(lastError as Error)?.message}`,
  );
}
