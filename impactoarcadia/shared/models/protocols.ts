// ============================================================
// ARCADIA SUITE - PROTOCOLOS DE INTEROPERABILIDADE AGÊNTICA
// ============================================================

// ==================== MCP (Model Context Protocol) ====================

export interface McpTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, McpToolParameter>;
    required: string[];
  };
}

export interface McpToolParameter {
  type: string;
  description: string;
  enum?: string[];
}

export interface McpToolExecuteRequest {
  arguments: Record<string, any>;
}

export interface McpToolExecuteResponse {
  success: boolean;
  result?: any;
  error?: string;
  executionTime?: number;
}

export interface McpToolsListResponse {
  tools: McpTool[];
  serverInfo: {
    name: string;
    version: string;
    description: string;
  };
}

// ==================== A2A (Agent to Agent Protocol) ====================

export type TaskState = 
  | 'pending'
  | 'working'
  | 'input-required'
  | 'completed'
  | 'failed'
  | 'canceled';

export interface A2ATask {
  id: string;
  state: TaskState;
  message: A2AMessage;
  artifacts?: A2AArtifact[];
  history?: A2AMessage[];
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface A2AMessage {
  role: 'user' | 'agent';
  parts: A2APart[];
  metadata?: Record<string, any>;
}

export interface A2APart {
  type: 'text' | 'file' | 'data';
  text?: string;
  file?: {
    name: string;
    mimeType: string;
    data: string; // base64
  };
  data?: Record<string, any>;
}

export interface A2AArtifact {
  id: string;
  name: string;
  type: string;
  data: any;
  createdAt: string;
}

export interface A2AAgentCard {
  name: string;
  description: string;
  version: string;
  url: string;
  capabilities: A2ACapability[];
  skills: A2ASkill[];
  authentication?: {
    type: 'none' | 'api_key' | 'oauth2';
    instructions?: string;
  };
  contact?: {
    email?: string;
    website?: string;
  };
}

export interface A2ACapability {
  name: string;
  description: string;
}

export interface A2ASkill {
  id: string;
  name: string;
  description: string;
  inputSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
}

export interface A2ASendMessageRequest {
  message: A2AMessage;
  taskId?: string; // Se fornecido, continua uma conversa existente
  metadata?: Record<string, any>;
}

export interface A2ASendMessageResponse {
  task: A2ATask;
}

export interface A2AGetTaskResponse {
  task: A2ATask;
}

export interface A2AListTasksResponse {
  tasks: A2ATask[];
  total: number;
  page: number;
  pageSize: number;
}

// ==================== Eventos SSE para A2A ====================

export interface A2ATaskEvent {
  type: 'state_change' | 'message' | 'artifact' | 'progress';
  taskId: string;
  data: any;
  timestamp: string;
}

// ==================== Utilitários ====================

export function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function generateArtifactId(): string {
  return `artifact_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
