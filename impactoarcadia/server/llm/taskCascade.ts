export type SuiteProvider = 'openai' | 'anthropic' | 'gemini' | 'ollama';

export type SuiteTaskType =
  | 'manus:chat'
  | 'manus:analysis'
  | 'manus:research'
  | 'manus:agents'
  | 'valuation:analysis'
  | 'valuation:quick'
  | 'bi:sql'
  | 'bi:label'
  | 'autonomous:architect'
  | 'autonomous:codegen'
  | 'devagent:doctype'
  | 'dominio:parser'
  | 'doctype:summary'
  | 'generic';

export interface CascadePolicy {
  chain: SuiteProvider[];
  models: Record<SuiteProvider, string>;
  dataSensitive?: boolean;
}

const M = {
  // OpenAI
  gpt4o:        'gpt-4o',
  gpt4o_mini:   'gpt-4o-mini',
  // Anthropic
  claude_sonnet: 'claude-sonnet-4-5-20250929',
  claude_haiku:  'claude-haiku-4-5-20251001',
  // Gemini
  gemini_pro:   'gemini-1.5-pro-latest',
  gemini_flash: 'gemini-1.5-flash-latest',
  // Ollama
  ollama_fast:  'qwen3.5:4b',
  ollama_coder: 'qwen3-coder:14b',
};

// OpenAI primeiro, depois fallback para os demais
const REASONING: CascadePolicy = {
  chain:  ['openai', 'anthropic', 'gemini', 'ollama'],
  models: { openai: M.gpt4o, anthropic: M.claude_sonnet, gemini: M.gemini_pro, ollama: M.ollama_fast },
};

const REASONING_SENSITIVE: CascadePolicy = {
  chain:         ['openai', 'anthropic', 'gemini', 'ollama'],
  models:        { openai: M.gpt4o, anthropic: M.claude_sonnet, gemini: M.gemini_pro, ollama: M.ollama_fast },
  dataSensitive: true,
};

const CODING: CascadePolicy = {
  chain:  ['openai', 'anthropic', 'ollama', 'gemini'],
  models: { openai: M.gpt4o, anthropic: M.claude_sonnet, gemini: M.gemini_pro, ollama: M.ollama_coder },
};

const CHEAP: CascadePolicy = {
  chain:  ['openai', 'gemini', 'ollama', 'anthropic'],
  models: { openai: M.gpt4o_mini, anthropic: M.claude_haiku, gemini: M.gemini_flash, ollama: M.ollama_fast },
};

const POLICY: Record<SuiteTaskType, CascadePolicy> = {
  'manus:chat':           REASONING,
  'manus:analysis':       REASONING_SENSITIVE,
  'manus:research':       REASONING,
  'manus:agents':         REASONING,
  'valuation:analysis':   REASONING_SENSITIVE,
  'valuation:quick':      CHEAP,
  'bi:sql':               CODING,
  'bi:label':             CHEAP,
  'autonomous:architect': CODING,
  'autonomous:codegen':   CODING,
  'devagent:doctype':     CODING,
  'dominio:parser':       REASONING_SENSITIVE,
  'doctype:summary':      CHEAP,
  'generic':              CHEAP,
};

export function getPolicy(taskType: SuiteTaskType): CascadePolicy {
  return POLICY[taskType] ?? POLICY['generic'];
}
