import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Play,
  Copy,
  Send,
  Bot,
  Code,
  FileJson,
  Zap,
  Database,
  Users,
  MessageSquare,
  BarChart3,
  Settings,
  Shield,
  Truck,
  CreditCard,
  Mail,
  Globe,
  RefreshCw,
  CheckCircle,
  Plus,
  Sparkles,
  Eye,
  EyeOff,
  Save,
  Terminal,
  ArrowLeft,
  Plug,
  Share2,
  Trash2,
  TestTube,
  Loader2,
  X,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface SystemEndpoint {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  description: string;
  params?: { name: string; type: string; required: boolean; description?: string }[];
  bodyExample?: string;
  responseExample?: string;
}

interface SystemModule {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  baseUrl: string;
  endpoints: SystemEndpoint[];
}

const SYSTEM_MODULES: SystemModule[] = [
  {
    id: "admin",
    name: "Administração",
    description: "Gestão de usuários, perfis, tenants e planos",
    icon: Shield,
    color: "bg-red-500",
    baseUrl: "/api/admin",
    endpoints: [
      { method: "GET", path: "/users", description: "Listar todos os usuários", params: [{ name: "tenantId", type: "number", required: false }] },
      { method: "PATCH", path: "/users/:id", description: "Atualizar usuário", params: [{ name: "id", type: "string", required: true }] },
      { method: "GET", path: "/profiles", description: "Listar perfis de acesso" },
      { method: "POST", path: "/profiles", description: "Criar novo perfil", bodyExample: '{"name": "Vendedor", "allowedModules": ["crm", "whatsapp"]}' },
      { method: "GET", path: "/tenants", description: "Listar tenants (empresas)" },
      { method: "POST", path: "/tenants", description: "Criar novo tenant", bodyExample: '{"name": "Empresa X", "tenantType": "client"}' },
      { method: "GET", path: "/tenants/hierarchy", description: "Hierarquia de tenants (master/partner/client)" },
      { method: "GET", path: "/plans", description: "Listar planos disponíveis" },
      { method: "POST", path: "/plans", description: "Criar plano", bodyExample: '{"name": "Pro", "price": 199.90, "features": ["crm", "bi"]}' },
      { method: "GET", path: "/commissions", description: "Listar comissões de parceiros" },
      { method: "PATCH", path: "/commissions/:id/approve", description: "Aprovar comissão" },
    ]
  },
  {
    id: "crm",
    name: "CRM",
    description: "Gestão de parceiros, contratos e relacionamento",
    icon: Users,
    color: "bg-emerald-500",
    baseUrl: "/api/crm",
    endpoints: [
      { method: "GET", path: "/partners", description: "Listar parceiros" },
      { method: "GET", path: "/partners/:id", description: "Detalhes do parceiro" },
      { method: "POST", path: "/partners", description: "Criar parceiro", bodyExample: '{"name": "Parceiro X", "email": "contato@x.com"}' },
      { method: "PATCH", path: "/partners/:id", description: "Atualizar parceiro" },
      { method: "GET", path: "/contracts", description: "Listar contratos" },
      { method: "POST", path: "/contracts", description: "Criar contrato" },
      { method: "GET", path: "/channels", description: "Listar canais de comunicação" },
      { method: "GET", path: "/threads", description: "Listar threads de conversa" },
    ]
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    description: "Integração WhatsApp Business, tickets e mensagens",
    icon: MessageSquare,
    color: "bg-green-500",
    baseUrl: "/api/whatsapp",
    endpoints: [
      { method: "POST", path: "/connect", description: "Conectar WhatsApp (gera QR Code)" },
      { method: "POST", path: "/disconnect", description: "Desconectar sessão" },
      { method: "GET", path: "/status", description: "Status da conexão" },
      { method: "GET", path: "/tickets", description: "Listar tickets de atendimento", params: [{ name: "status", type: "string", required: false, description: "open, closed, all" }] },
      { method: "GET", path: "/tickets/:id/messages", description: "Mensagens de um ticket" },
      { method: "POST", path: "/tickets/:id/send", description: "Enviar mensagem", bodyExample: '{"message": "Olá!"}' },
      { method: "POST", path: "/send", description: "Enviar para novo número", bodyExample: '{"to": "5511999999999", "message": "Olá!"}' },
      { method: "GET", path: "/contacts/search", description: "Buscar contatos", params: [{ name: "q", type: "string", required: true }] },
      { method: "GET", path: "/analytics", description: "Métricas de atendimento" },
      { method: "GET", path: "/auto-reply/config", description: "Configuração de auto-resposta" },
      { method: "POST", path: "/auto-reply/config", description: "Atualizar auto-resposta", bodyExample: '{"enabled": true, "welcomeMessage": "Olá! Como posso ajudar?"}' },
    ]
  },
  {
    id: "email",
    name: "Email",
    description: "Gestão de contas de email e mensagens",
    icon: Mail,
    color: "bg-blue-500",
    baseUrl: "/api/email",
    endpoints: [
      { method: "GET", path: "/accounts", description: "Listar contas de email" },
      { method: "POST", path: "/accounts", description: "Adicionar conta", bodyExample: '{"email": "contato@empresa.com", "password": "..."}' },
      { method: "POST", path: "/accounts/:id/sync", description: "Sincronizar emails" },
      { method: "GET", path: "/accounts/:id/folders", description: "Listar pastas" },
      { method: "GET", path: "/accounts/:id/messages", description: "Listar mensagens" },
      { method: "POST", path: "/messages/send", description: "Enviar email", bodyExample: '{"to": "dest@email.com", "subject": "Assunto", "body": "Conteúdo"}' },
    ]
  },
  {
    id: "bi",
    name: "Business Intelligence",
    description: "Dashboards, datasets e análises",
    icon: BarChart3,
    color: "bg-purple-500",
    baseUrl: "/api/bi",
    endpoints: [
      { method: "GET", path: "/dashboards", description: "Listar dashboards" },
      { method: "POST", path: "/dashboards", description: "Criar dashboard" },
      { method: "GET", path: "/datasources", description: "Listar fontes de dados" },
      { method: "POST", path: "/datasources", description: "Adicionar fonte de dados" },
      { method: "GET", path: "/datasets", description: "Listar datasets" },
      { method: "POST", path: "/query", description: "Executar query SQL", bodyExample: '{"query": "SELECT * FROM customers LIMIT 10"}' },
    ]
  },
  {
    id: "ide",
    name: "IDE",
    description: "Ambiente de desenvolvimento integrado",
    icon: Code,
    color: "bg-slate-700",
    baseUrl: "/api/ide",
    endpoints: [
      { method: "GET", path: "/files", description: "Listar arquivos do projeto" },
      { method: "GET", path: "/file", description: "Ler conteúdo de arquivo", params: [{ name: "path", type: "string", required: true }] },
      { method: "POST", path: "/file", description: "Salvar arquivo", bodyExample: '{"path": "test.py", "content": "print(hello)"}' },
      { method: "POST", path: "/execute", description: "Executar comando", bodyExample: '{"command": "python test.py"}' },
      { method: "POST", path: "/create-file", description: "Criar novo arquivo" },
      { method: "POST", path: "/create-folder", description: "Criar pasta" },
      { method: "DELETE", path: "/file", description: "Deletar arquivo" },
      { method: "POST", path: "/ai-agent", description: "Executar tarefa com Manus", bodyExample: '{"task": "Criar função de validação de CPF"}' },
      { method: "POST", path: "/ai-chat", description: "Chat com IA" },
    ]
  },
  {
    id: "manus",
    name: "Manus (Agente)",
    description: "Agente autônomo para execução de tarefas",
    icon: Bot,
    color: "bg-amber-500",
    baseUrl: "/api/manus",
    endpoints: [
      { method: "POST", path: "/run", description: "Executar tarefa", bodyExample: '{"prompt": "Analise os dados de vendas e gere um relatório"}' },
      { method: "GET", path: "/runs", description: "Listar execuções" },
      { method: "GET", path: "/runs/:id", description: "Detalhes da execução" },
      { method: "GET", path: "/runs/:id/steps", description: "Passos da execução" },
    ]
  },
  {
    id: "api-central",
    name: "Central de APIs",
    description: "Gestão de conexões com APIs externas",
    icon: Globe,
    color: "bg-cyan-500",
    baseUrl: "/api/api-central",
    endpoints: [
      { method: "GET", path: "/connections", description: "Listar conexões" },
      { method: "POST", path: "/connections", description: "Criar conexão", bodyExample: '{"name": "Minha API", "baseUrl": "https://api.exemplo.com", "apiKey": "..."}' },
      { method: "PUT", path: "/connections/:id", description: "Atualizar conexão" },
      { method: "DELETE", path: "/connections/:id", description: "Deletar conexão" },
      { method: "POST", path: "/connections/:id/test", description: "Testar conexão" },
      { method: "GET", path: "/connections/:id/endpoints", description: "Endpoints salvos" },
      { method: "POST", path: "/connections/:id/endpoints", description: "Criar endpoint" },
      { method: "POST", path: "/execute", description: "Executar requisição", bodyExample: '{"method": "GET", "url": "https://api.exemplo.com/data"}' },
      { method: "GET", path: "/logs", description: "Logs de requisições" },
    ]
  },
  {
    id: "compass",
    name: "Process Compass",
    description: "Gestão de processos e workflows BPMN",
    icon: Settings,
    color: "bg-orange-500",
    baseUrl: "/api/compass",
    endpoints: [
      { method: "GET", path: "/processes", description: "Listar processos" },
      { method: "POST", path: "/processes", description: "Criar processo" },
      { method: "GET", path: "/workflows", description: "Listar workflows" },
      { method: "POST", path: "/workflows/:id/execute", description: "Executar workflow" },
    ]
  },
  {
    id: "chat",
    name: "Chat Interno",
    description: "Mensagens internas entre usuários",
    icon: MessageSquare,
    color: "bg-indigo-500",
    baseUrl: "/api/chat",
    endpoints: [
      { method: "GET", path: "/conversations", description: "Listar conversas" },
      { method: "GET", path: "/conversations/:id/messages", description: "Mensagens de uma conversa" },
      { method: "POST", path: "/messages", description: "Enviar mensagem", bodyExample: '{"to": "user123", "content": "Olá!"}' },
    ]
  },
  {
    id: "erp",
    name: "ERP Nativo",
    description: "Gestão de clientes, produtos, pedidos e estoque",
    icon: Database,
    color: "bg-teal-500",
    baseUrl: "/api/erp",
    endpoints: [
      { method: "GET", path: "/customers", description: "Listar clientes" },
      { method: "POST", path: "/customers", description: "Criar cliente", bodyExample: '{"name": "Cliente X", "email": "cliente@x.com"}' },
      { method: "GET", path: "/products", description: "Listar produtos" },
      { method: "POST", path: "/products", description: "Criar produto", bodyExample: '{"name": "Produto Y", "price": 99.90, "sku": "PROD001"}' },
      { method: "GET", path: "/suppliers", description: "Listar fornecedores" },
      { method: "POST", path: "/suppliers", description: "Criar fornecedor" },
      { method: "GET", path: "/sales-orders", description: "Listar pedidos de venda" },
      { method: "POST", path: "/sales-orders", description: "Criar pedido de venda" },
      { method: "GET", path: "/purchase-orders", description: "Listar pedidos de compra" },
      { method: "POST", path: "/purchase-orders", description: "Criar pedido de compra" },
      { method: "GET", path: "/doctypes", description: "Listar tipos de documento personalizados" },
      { method: "POST", path: "/doctypes", description: "Criar DocType" },
    ]
  },
  {
    id: "erpnext",
    name: "ERPNext",
    description: "Integração com ERPNext/Frappe - acesso via Manus",
    icon: Database,
    color: "bg-blue-600",
    baseUrl: "/api/erpnext",
    endpoints: [
      { method: "GET", path: "/status", description: "Verificar status da conexão com ERPNext" },
      { method: "GET", path: "/doctypes", description: "Listar DocTypes disponíveis", params: [{ name: "limit", type: "number", required: false }] },
      { method: "GET", path: "/doctype/:doctype/fields", description: "Campos de um DocType" },
      { method: "GET", path: "/resource/:doctype", description: "Listar documentos", params: [{ name: "limit", type: "number", required: false }, { name: "filters", type: "json", required: false }, { name: "fields", type: "json", required: false }] },
      { method: "GET", path: "/resource/:doctype/:name", description: "Buscar documento específico" },
      { method: "POST", path: "/resource/:doctype", description: "Criar documento", bodyExample: '{"customer_name": "Novo Cliente", "customer_type": "Company"}' },
      { method: "PUT", path: "/resource/:doctype/:name", description: "Atualizar documento" },
      { method: "DELETE", path: "/resource/:doctype/:name", description: "Deletar documento" },
      { method: "GET", path: "/search/:doctype", description: "Pesquisar documentos", params: [{ name: "q", type: "string", required: true }] },
      { method: "GET", path: "/report/:reportName", description: "Executar relatório", params: [{ name: "filters", type: "json", required: false }] },
      { method: "POST", path: "/method/:method", description: "Chamar método Frappe", bodyExample: '{}' },
    ]
  },
  {
    id: "automations",
    name: "Automações",
    description: "Bots, RPA e automações programadas",
    icon: Zap,
    color: "bg-yellow-500",
    baseUrl: "/api/automations",
    endpoints: [
      { method: "GET", path: "/bots", description: "Listar bots" },
      { method: "POST", path: "/bots", description: "Criar bot" },
      { method: "POST", path: "/bots/:id/run", description: "Executar bot" },
      { method: "GET", path: "/schedules", description: "Listar agendamentos" },
      { method: "POST", path: "/schedules", description: "Criar agendamento" },
      { method: "GET", path: "/rpa/tasks", description: "Tarefas RPA" },
      { method: "POST", path: "/rpa/execute", description: "Executar tarefa RPA" },
    ]
  },
  {
    id: "learning",
    name: "Aprendizado",
    description: "Sistema de aprendizado automático e IA",
    icon: Sparkles,
    color: "bg-pink-500",
    baseUrl: "/api/learning",
    endpoints: [
      { method: "GET", path: "/interactions", description: "Interações aprendidas" },
      { method: "GET", path: "/patterns", description: "Padrões detectados" },
      { method: "POST", path: "/train", description: "Treinar com novos dados" },
      { method: "GET", path: "/suggestions", description: "Sugestões da IA" },
    ]
  },
  {
    id: "knowledge",
    name: "Knowledge Graph",
    description: "Grafo de conhecimento do sistema",
    icon: Database,
    color: "bg-violet-500",
    baseUrl: "/api/knowledge",
    endpoints: [
      { method: "GET", path: "/nodes", description: "Listar nós do grafo" },
      { method: "POST", path: "/nodes", description: "Criar nó" },
      { method: "GET", path: "/edges", description: "Listar conexões" },
      { method: "POST", path: "/edges", description: "Criar conexão" },
      { method: "POST", path: "/search", description: "Busca semântica", bodyExample: '{"query": "clientes de São Paulo"}' },
    ]
  },
  {
    id: "auth",
    name: "Autenticação",
    description: "Login, registro e gerenciamento de sessões",
    icon: Shield,
    color: "bg-rose-500",
    baseUrl: "/api",
    endpoints: [
      { method: "POST", path: "/register", description: "Registrar novo usuário", bodyExample: '{"username": "user", "email": "user@mail.com", "password": "..."}' },
      { method: "POST", path: "/login", description: "Login de usuário", bodyExample: '{"username": "user", "password": "..."}' },
      { method: "POST", path: "/logout", description: "Fazer logout" },
      { method: "GET", path: "/user", description: "Dados do usuário logado" },
    ]
  },
  {
    id: "login-bridge",
    name: "Login Bridge",
    description: "Ponte de autenticação para sistemas externos",
    icon: Globe,
    color: "bg-lime-500",
    baseUrl: "/api/login-bridge",
    endpoints: [
      { method: "POST", path: "/start", description: "Iniciar sessão de login externo", bodyExample: '{"domain": "econet.com.br"}' },
      { method: "GET", path: "/session/:sessionId", description: "Status da sessão" },
      { method: "POST", path: "/sync-cookies", description: "Sincronizar cookies do navegador" },
      { method: "POST", path: "/end/:sessionId", description: "Encerrar sessão" },
      { method: "GET", path: "/allowed-domains", description: "Domínios permitidos" },
      { method: "POST", path: "/mark-logged-in", description: "Marcar como logado" },
      { method: "GET", path: "/check-session", description: "Verificar sessão ativa" },
    ]
  },
  {
    id: "fisco",
    name: "Arcádia Fisco",
    description: "Motor fiscal centralizado - NF-e, NFC-e, NCM, CFOP, IBS/CBS",
    icon: FileJson,
    color: "bg-emerald-600",
    baseUrl: "/api/fisco",
    endpoints: [
      { method: "GET", path: "/ncm", description: "Listar NCMs", params: [{ name: "search", type: "string", required: false }, { name: "limit", type: "number", required: false }] },
      { method: "GET", path: "/ncm/:id", description: "Detalhes do NCM" },
      { method: "POST", path: "/ncm", description: "Criar NCM", bodyExample: '{"codigo": "0000.00.00", "descricao": "Descrição do NCM", "aliqIpi": "10.00"}' },
      { method: "PUT", path: "/ncm/:id", description: "Atualizar NCM" },
      { method: "DELETE", path: "/ncm/:id", description: "Excluir NCM" },
      { method: "GET", path: "/cest", description: "Listar CESTs", params: [{ name: "search", type: "string", required: false }] },
      { method: "GET", path: "/cest/:id", description: "Detalhes do CEST" },
      { method: "POST", path: "/cest", description: "Criar CEST", bodyExample: '{"codigo": "00.000.00", "descricao": "Descrição"}' },
      { method: "PUT", path: "/cest/:id", description: "Atualizar CEST" },
      { method: "DELETE", path: "/cest/:id", description: "Excluir CEST" },
      { method: "GET", path: "/cfop", description: "Listar CFOPs", params: [{ name: "tipo", type: "string", required: false, description: "entrada ou saida" }] },
      { method: "GET", path: "/cfop/:id", description: "Detalhes do CFOP" },
      { method: "POST", path: "/cfop", description: "Criar CFOP", bodyExample: '{"codigo": "5102", "descricao": "Venda de mercadoria", "tipo": "saida"}' },
      { method: "PUT", path: "/cfop/:id", description: "Atualizar CFOP" },
      { method: "DELETE", path: "/cfop/:id", description: "Excluir CFOP" },
      { method: "GET", path: "/grupos-tributacao", description: "Listar grupos tributários", params: [{ name: "tenantId", type: "number", required: false }, { name: "ncm", type: "string", required: false }] },
      { method: "GET", path: "/grupos-tributacao/:id", description: "Detalhes do grupo tributário" },
      { method: "POST", path: "/grupos-tributacao", description: "Criar grupo tributário", bodyExample: '{"nome": "Alimentos", "ncm": "2106.90.10", "cstIcms": "00", "percIcms": "18.00"}' },
      { method: "PUT", path: "/grupos-tributacao/:id", description: "Atualizar grupo tributário" },
      { method: "DELETE", path: "/grupos-tributacao/:id", description: "Excluir grupo tributário" },
      { method: "GET", path: "/natureza-operacao", description: "Listar naturezas de operação", params: [{ name: "tenantId", type: "number", required: false }] },
      { method: "GET", path: "/natureza-operacao/:id", description: "Detalhes da natureza de operação" },
      { method: "POST", path: "/natureza-operacao", description: "Criar natureza de operação", bodyExample: '{"codigo": "VENDA", "descricao": "Venda de mercadoria", "cfopInterno": "5102"}' },
      { method: "PUT", path: "/natureza-operacao/:id", description: "Atualizar natureza de operação" },
      { method: "DELETE", path: "/natureza-operacao/:id", description: "Excluir natureza de operação" },
      { method: "GET", path: "/certificados", description: "Listar certificados digitais", params: [{ name: "tenantId", type: "number", required: false }] },
      { method: "POST", path: "/certificados", description: "Cadastrar certificado digital" },
      { method: "DELETE", path: "/certificados/:id", description: "Excluir certificado" },
      { method: "GET", path: "/configuracoes/:tenantId", description: "Configurações fiscais do tenant" },
      { method: "POST", path: "/configuracoes", description: "Salvar configurações fiscais" },
      { method: "GET", path: "/notas", description: "Listar notas fiscais", params: [{ name: "tenantId", type: "number", required: false }, { name: "modelo", type: "string", required: false, description: "55 (NF-e) ou 65 (NFC-e)" }, { name: "status", type: "string", required: false }] },
      { method: "GET", path: "/notas/:id", description: "Detalhes da nota fiscal (com itens e eventos)" },
      { method: "POST", path: "/notas", description: "Criar nota fiscal", bodyExample: '{"modelo": "55", "naturezaOperacao": "VENDA", "destinatario": {...}, "itens": [...]}' },
      { method: "PUT", path: "/notas/:id", description: "Atualizar nota fiscal" },
      { method: "DELETE", path: "/notas/:id", description: "Excluir nota fiscal (apenas rascunho)" },
      { method: "POST", path: "/notas/:id/eventos", description: "Registrar evento fiscal (cancelamento, carta correção)", bodyExample: '{"tipoEvento": "110111", "justificativa": "Erro na emissão"}' },
      { method: "GET", path: "/ibpt/:ncm", description: "Consultar tabela IBPT por NCM" },
      { method: "POST", path: "/ibpt/importar", description: "Importar tabela IBPT", bodyExample: '{"dados": [{"ncm": "0000.00.00", "aliqNacional": "15.50", ...}]}' },
      { method: "GET", path: "/stats/:tenantId", description: "Estatísticas fiscais do tenant" },
      { method: "GET", path: "/nfe/service-status", description: "Status do serviço Python de NF-e" },
      { method: "POST", path: "/nfe/validar-certificado", description: "Validar certificado A1", bodyExample: '{"arquivo_base64": "...", "senha": "123456"}' },
      { method: "POST", path: "/nfe/gerar-xml", description: "Gerar XML da NF-e (preview)", bodyExample: '{"modelo": "55", "serie": 1, "numero": 1, "emitente": {...}, "destinatario": {...}, "itens": [...]}' },
      { method: "POST", path: "/nfe/emitir", description: "Emitir NF-e (gera XML, assina e envia para SEFAZ)", bodyExample: '{"notaId": 1, "certificadoId": 1}' },
      { method: "POST", path: "/nfe/consultar", description: "Consultar situação da NF-e na SEFAZ", bodyExample: '{"chave_nfe": "35...", "ambiente": "2"}' },
      { method: "POST", path: "/nfe/cancelar", description: "Cancelar NF-e autorizada", bodyExample: '{"notaId": 1, "certificadoId": 1, "justificativa": "Erro na emissão..."}' },
      { method: "POST", path: "/nfe/inutilizar", description: "Inutilizar faixa de numeração", bodyExample: '{"cnpj": "...", "serie": 1, "numero_inicial": 1, "numero_final": 10, "justificativa": "..."}' },
    ]
  },
  {
    id: "mcp",
    name: "MCP Server",
    description: "Model Context Protocol - expõe ferramentas do Arcádia para agentes externos",
    icon: Plug,
    color: "bg-cyan-500",
    baseUrl: "/api/mcp/v1",
    endpoints: [
      { method: "GET", path: "/tools", description: "Listar todas as ferramentas disponíveis (56 tools)", responseExample: '{"tools": [{"name": "web_search", "description": "...", "parameters": {...}}], "serverInfo": {...}}' },
      { method: "GET", path: "/tools/:name", description: "Detalhes de uma ferramenta específica" },
      { method: "POST", path: "/tools/:name/execute", description: "Executar ferramenta (requer API Key)", bodyExample: '{"arguments": {"query": "buscar informações"}}', params: [{ name: "X-API-Key", type: "header", required: true, description: "API Key de autenticação" }] },
      { method: "GET", path: "/stats", description: "Estatísticas do servidor MCP", responseExample: '{"totalTools": 56, "toolCategories": {"search": 12, "file": 4, ...}}' },
      { method: "GET", path: "/health", description: "Health check do servidor MCP" },
    ]
  },
  {
    id: "a2a",
    name: "A2A Protocol",
    description: "Agent to Agent Protocol - comunicação bidirecional entre agentes de IA",
    icon: Share2,
    color: "bg-pink-500",
    baseUrl: "/api/a2a/v1",
    endpoints: [
      { method: "GET", path: "/.well-known/agent.json", description: "Agent Card do Arcádia (descoberta pública)", responseExample: '{"name": "Arcadia Suite Agent", "capabilities": [...], "skills": [...]}' },
      { method: "POST", path: "/tasks", description: "Criar nova tarefa (SendMessage) - requer API Key", bodyExample: '{"message": {"parts": [{"type": "text", "text": "Quanto é 2+2?"}]}}', params: [{ name: "X-API-Key", type: "header", required: true }] },
      { method: "GET", path: "/tasks/:id", description: "Status da tarefa", responseExample: '{"task": {"id": "task_123", "state": "completed", "history": [...]}}' },
      { method: "GET", path: "/tasks", description: "Listar tarefas com paginação", params: [{ name: "page", type: "number", required: false }, { name: "pageSize", type: "number", required: false }] },
      { method: "POST", path: "/tasks/:id/cancel", description: "Cancelar uma tarefa" },
      { method: "GET", path: "/tasks/:id/stream", description: "Stream de eventos via SSE (Server-Sent Events)" },
      { method: "GET", path: "/stats", description: "Estatísticas do servidor A2A" },
      { method: "GET", path: "/health", description: "Health check do servidor A2A" },
      { method: "GET", path: "/agents", description: "Listar agentes externos registrados", responseExample: '{"agents": [...], "stats": {"totalAgents": 2, "activeAgents": 1}}' },
      { method: "POST", path: "/agents", description: "Registrar novo agente externo", bodyExample: '{"name": "Agente Fiscal", "url": "https://agente.exemplo.com", "apiKey": "opcional"}' },
      { method: "GET", path: "/agents/:id", description: "Detalhes de um agente específico" },
      { method: "DELETE", path: "/agents/:id", description: "Remover um agente externo" },
      { method: "POST", path: "/agents/:id/message", description: "Enviar mensagem para um agente externo", bodyExample: '{"message": "Quanto é 2+2?", "waitForCompletion": true}' },
      { method: "POST", path: "/agents/discover", description: "Descobrir Agent Card de uma URL", bodyExample: '{"url": "https://agente.exemplo.com"}' },
      { method: "POST", path: "/agents/health-check", description: "Verificar saúde de todos os agentes" },
    ]
  },
];

interface CustomMcpServer {
  id: number;
  name: string;
  transportType: string;
  serverUrl: string | null;
  command: string | null;
  args: string[] | null;
  iconUrl: string | null;
  description: string | null;
  customHeaders: Record<string, string> | null;
  isActive: number;
}

function CustomMcpSection() {
  const queryClient = useQueryClient();
  const [showImportModal, setShowImportModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [configForm, setConfigForm] = useState({
    name: "",
    transportType: "http",
    serverUrl: "",
    command: "",
    args: "",
    iconUrl: "",
    description: "",
    customHeaders: [{ key: "", value: "" }]
  });

  const { data: servers = [], isLoading } = useQuery({
    queryKey: ["custom-mcp-servers"],
    queryFn: async () => {
      const res = await fetch("/api/mcp/custom", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch MCP servers");
      return res.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/mcp/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to create server");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-mcp-servers"] });
      toast.success("Servidor MCP adicionado com sucesso");
      resetConfigForm();
      setShowConfigModal(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao criar servidor");
    }
  });

  const importMutation = useMutation({
    mutationFn: async (config: string) => {
      const res = await fetch("/api/mcp/custom/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to import");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["custom-mcp-servers"] });
      toast.success(`${data.imported} servidor(es) importado(s)`);
      setJsonInput("");
      setShowImportModal(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao importar");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/mcp/custom/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-mcp-servers"] });
      toast.success("Servidor removido");
    }
  });

  const testMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/mcp/custom/${id}/test`, {
        method: "POST",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to test");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    }
  });

  const resetConfigForm = () => {
    setConfigForm({
      name: "",
      transportType: "http",
      serverUrl: "",
      command: "",
      args: "",
      iconUrl: "",
      description: "",
      customHeaders: [{ key: "", value: "" }]
    });
  };

  const handleSaveConfig = () => {
    const headers: Record<string, string> = {};
    configForm.customHeaders.forEach(h => {
      if (h.key && h.value) headers[h.key] = h.value;
    });

    const data = {
      name: configForm.name,
      transportType: configForm.transportType,
      serverUrl: configForm.transportType === "http" ? configForm.serverUrl : null,
      command: configForm.transportType === "stdio" && configForm.command ? configForm.command : null,
      args: configForm.transportType === "stdio" && configForm.args 
        ? configForm.args.split(",").map(s => s.trim()) 
        : null,
      iconUrl: configForm.iconUrl || null,
      description: configForm.description || null,
      customHeaders: Object.keys(headers).length > 0 ? headers : null
    };

    createMutation.mutate(data);
  };

  const addCustomHeader = () => {
    setConfigForm(prev => ({
      ...prev,
      customHeaders: [...prev.customHeaders, { key: "", value: "" }]
    }));
  };

  const updateCustomHeader = (index: number, field: "key" | "value", value: string) => {
    setConfigForm(prev => ({
      ...prev,
      customHeaders: prev.customHeaders.map((h, i) => 
        i === index ? { ...h, [field]: value } : h
      )
    }));
  };

  const removeCustomHeader = (index: number) => {
    setConfigForm(prev => ({
      ...prev,
      customHeaders: prev.customHeaders.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="h-full p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Plug className="h-6 w-6 text-cyan-400" />
              MCPs Personalizados
            </h2>
            <p className="text-slate-400 mt-1">Configure servidores MCP externos para expandir as capacidades do Manus</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-cyan-600 hover:bg-cyan-700" data-testid="button-add-mcp-hub">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar MCP
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setShowImportModal(true)} data-testid="menu-import-json-hub">
                <FileJson className="h-4 w-4 mr-2" />
                Importar por JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowConfigModal(true)} data-testid="menu-direct-config-hub">
                <Settings className="h-4 w-4 mr-2" />
                Configuração direta
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : servers.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-slate-700 rounded-lg">
            <Plug className="h-16 w-16 mx-auto mb-4 text-slate-600" />
            <p className="text-slate-400 text-lg">Nenhum MCP personalizado adicionado ainda</p>
            <p className="text-slate-500 text-sm mt-2">Adicione servidores MCP externos para usar ferramentas de outros sistemas</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {servers.map((server: CustomMcpServer) => (
              <Card key={server.id} className="bg-slate-800/50 border-slate-700" data-testid={`mcp-card-${server.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-lg bg-cyan-500/20">
                        <Plug className="h-5 w-5 text-cyan-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{server.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">
                            {server.transportType.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-slate-400">
                            {server.serverUrl || server.command}
                          </span>
                        </div>
                        {server.description && (
                          <p className="text-xs text-slate-500 mt-1">{server.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => testMutation.mutate(server.id)}
                        disabled={testMutation.isPending}
                        className="text-slate-400 hover:text-white"
                        data-testid={`button-test-${server.id}`}
                      >
                        <TestTube className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => deleteMutation.mutate(server.id)}
                        className="text-red-400 hover:text-red-300"
                        data-testid={`button-delete-${server.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Import Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar por JSON</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder={`// Exemplo STDIO:\n{\n  "mcpServers": {\n    "meu-servidor": {\n      "command": "npx",\n      "args": ["-y", "mcp-server"]\n    }\n  }\n}\n\n// Exemplo HTTP:\n{\n  "mcpServers": {\n    "meu-servidor": {\n      "url": "https://mcp.exemplo.com"\n    }\n  }\n}`}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              className="min-h-[250px] font-mono text-sm bg-slate-800 border-slate-700"
              data-testid="textarea-json-import-hub"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowImportModal(false)}>Cancelar</Button>
              <Button 
                onClick={() => importMutation.mutate(jsonInput)}
                disabled={!jsonInput.trim() || importMutation.isPending}
                className="bg-cyan-600 hover:bg-cyan-700"
                data-testid="button-import-hub"
              >
                {importMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Importar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Config Modal */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configuração do MCP</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do servidor</Label>
                <Input
                  placeholder="Meu Servidor MCP"
                  value={configForm.name}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, name: e.target.value }))}
                  className="bg-slate-800 border-slate-700"
                  data-testid="input-mcp-name-hub"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de transporte</Label>
                <Select
                  value={configForm.transportType}
                  onValueChange={(v) => setConfigForm(prev => ({ ...prev, transportType: v }))}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700" data-testid="select-transport-hub">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="stdio">STDIO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea
                placeholder="Descrição do que este MCP faz..."
                value={configForm.description}
                onChange={(e) => setConfigForm(prev => ({ ...prev, description: e.target.value }))}
                className="bg-slate-800 border-slate-700"
                data-testid="textarea-description-hub"
              />
            </div>

            {configForm.transportType === "http" ? (
              <div className="space-y-2">
                <Label>URL do servidor</Label>
                <Input
                  placeholder="https://mcp.exemplo.com/mcp"
                  value={configForm.serverUrl}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, serverUrl: e.target.value }))}
                  className="bg-slate-800 border-slate-700"
                  data-testid="input-url-hub"
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Comando</Label>
                  <Input
                    placeholder="npx"
                    value={configForm.command}
                    onChange={(e) => setConfigForm(prev => ({ ...prev, command: e.target.value }))}
                    className="bg-slate-800 border-slate-700"
                    data-testid="input-command-hub"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Argumentos (separados por vírgula)</Label>
                  <Input
                    placeholder="-y, mcp-server"
                    value={configForm.args}
                    onChange={(e) => setConfigForm(prev => ({ ...prev, args: e.target.value }))}
                    className="bg-slate-800 border-slate-700"
                    data-testid="input-args-hub"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Cabeçalhos personalizados</Label>
              {configForm.customHeaders.map((header, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Chave"
                    value={header.key}
                    onChange={(e) => updateCustomHeader(index, "key", e.target.value)}
                    className="bg-slate-800 border-slate-700"
                  />
                  <Input
                    placeholder="Valor"
                    value={header.value}
                    onChange={(e) => updateCustomHeader(index, "value", e.target.value)}
                    className="bg-slate-800 border-slate-700"
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeCustomHeader(index)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addCustomHeader} className="border-slate-600">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar cabeçalho
              </Button>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => setShowConfigModal(false)}>Cancelar</Button>
              <Button 
                onClick={handleSaveConfig}
                disabled={!configForm.name || createMutation.isPending}
                className="bg-cyan-600 hover:bg-cyan-700"
                data-testid="button-save-hub"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ApiHub() {
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState<SystemModule | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<SystemEndpoint | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(["admin"]));
  
  // Handle URL parameter to auto-select module
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const moduleId = urlParams.get('module');
    if (moduleId) {
      const module = SYSTEM_MODULES.find(m => m.id === moduleId);
      if (module) {
        setSelectedModule(module);
        setExpandedModules(prev => new Set([...prev, moduleId]));
        if (module.endpoints.length > 0) {
          const firstEndpoint = module.endpoints[0];
          setSelectedEndpoint(firstEndpoint);
          setRequestMethod(firstEndpoint.method);
          setRequestUrl(module.baseUrl + firstEndpoint.path);
          if (firstEndpoint.bodyExample) {
            setRequestBody(firstEndpoint.bodyExample);
          }
        }
      }
    }
  }, []);
  const [activeTab, setActiveTab] = useState("docs");
  
  const [requestMethod, setRequestMethod] = useState("GET");
  const [requestUrl, setRequestUrl] = useState("");
  const [requestHeaders, setRequestHeaders] = useState('{\n  "Content-Type": "application/json"\n}');
  const [requestBody, setRequestBody] = useState("");
  const [responseData, setResponseData] = useState<{ status?: number; body?: string; latency?: number } | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  
  const [showGeneratorDialog, setShowGeneratorDialog] = useState(false);
  const [generatorInput, setGeneratorInput] = useState("");
  const [generatorOutput, setGeneratorOutput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [codeEditorContent, setCodeEditorContent] = useState(`// Código gerado pelo Manus
// Cole a documentação da API e o Manus criará as conexões

async function callApi(endpoint, options = {}) {
  const response = await fetch(endpoint, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  return response.json();
}

// Exemplo de uso:
// const users = await callApi('/api/admin/users');
`);

  const filteredModules = useMemo(() => {
    if (!searchQuery) return SYSTEM_MODULES;
    const q = searchQuery.toLowerCase();
    return SYSTEM_MODULES.filter(m => 
      m.name.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.endpoints.some(e => e.path.toLowerCase().includes(q) || e.description.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  const toggleModule = (id: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET": return "bg-green-500 text-white";
      case "POST": return "bg-blue-500 text-white";
      case "PUT": return "bg-amber-500 text-white";
      case "PATCH": return "bg-purple-500 text-white";
      case "DELETE": return "bg-red-500 text-white";
      default: return "bg-slate-500 text-white";
    }
  };

  const selectEndpoint = (module: SystemModule, endpoint: SystemEndpoint) => {
    setSelectedModule(module);
    setSelectedEndpoint(endpoint);
    setRequestMethod(endpoint.method);
    setRequestUrl(module.baseUrl + endpoint.path);
    if (endpoint.bodyExample) {
      setRequestBody(endpoint.bodyExample);
    } else {
      setRequestBody("");
    }
    setResponseData(null);
  };

  const executeRequest = async () => {
    setIsExecuting(true);
    setResponseData(null);
    const start = Date.now();
    
    try {
      let headers: Record<string, string> = {};
      try {
        headers = JSON.parse(requestHeaders);
      } catch {}
      
      const options: RequestInit = {
        method: requestMethod,
        headers,
        credentials: "include",
      };
      
      if (requestBody && requestMethod !== "GET") {
        options.body = requestBody;
      }
      
      const response = await fetch(requestUrl, options);
      const latency = Date.now() - start;
      
      let body: string;
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        body = JSON.stringify(await response.json(), null, 2);
      } else {
        body = await response.text();
      }
      
      setResponseData({ status: response.status, body, latency });
    } catch (error: any) {
      setResponseData({ status: 0, body: `Erro: ${error.message}` });
    }
    
    setIsExecuting(false);
  };

  const [manusRunId, setManusRunId] = useState<string | null>(null);
  const [editorFileName, setEditorFileName] = useState("api-client.ts");

  const generateWithManus = async () => {
    if (!generatorInput.trim()) return;
    setIsGenerating(true);
    setGeneratorOutput("");
    
    try {
      const response = await fetch("/api/ide/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: `Analise esta documentação de API e gere código TypeScript completo para conectar e consumir os endpoints. 
Inclua:
1. Interfaces/tipos para requests e responses
2. Funções de chamada para cada endpoint
3. Tratamento de erros
4. Exemplos de uso

Documentação da API:
${generatorInput}`,
        }),
        credentials: "include",
      });
      
      const result = await response.json();
      if (result.success && result.runId) {
        setManusRunId(result.runId);
        const generatedCode = `// Código gerado pelo Manus (runId: ${result.runId})
// A tarefa foi iniciada e está sendo processada...

// ==========================================
// Template base gerado automaticamente:
// ==========================================

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

class ArcadiaApiClient {
  private baseUrl: string;
  
  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  async request<T>(
    endpoint: string, 
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    try {
      const { params, ...fetchOptions } = options;
      let url = this.baseUrl + endpoint;
      
      if (params) {
        const searchParams = new URLSearchParams(params);
        url += '?' + searchParams.toString();
      }
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
        credentials: 'include',
        ...fetchOptions,
      });
      
      const data = await response.json();
      return { success: response.ok, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // GET request helper
  async get<T>(endpoint: string, params?: Record<string, string>) {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  // POST request helper
  async post<T>(endpoint: string, body?: any) {
    return this.request<T>(endpoint, { 
      method: 'POST', 
      body: body ? JSON.stringify(body) : undefined 
    });
  }

  // PUT request helper
  async put<T>(endpoint: string, body?: any) {
    return this.request<T>(endpoint, { 
      method: 'PUT', 
      body: body ? JSON.stringify(body) : undefined 
    });
  }

  // DELETE request helper
  async delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Instância do cliente
const api = new ArcadiaApiClient();

// Exemplos de uso:
// const users = await api.get('/api/admin/users');
// const customer = await api.post('/api/erp/customers', { name: 'Novo Cliente' });

export default ArcadiaApiClient;
`;
        setGeneratorOutput(generatedCode);
      } else {
        setGeneratorOutput(`// Erro: ${result.error || 'Falha ao iniciar geração'}`);
      }
    } catch (error: any) {
      setGeneratorOutput(`// Erro: ${error.message}`);
    }
    
    setIsGenerating(false);
  };

  const copyToEditor = () => {
    setCodeEditorContent(generatorOutput);
    setShowGeneratorDialog(false);
    setActiveTab("editor");
  };

  const saveEditorContent = async () => {
    try {
      const response = await fetch("/api/ide/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: `generated/${editorFileName}`,
          content: codeEditorContent,
        }),
        credentials: "include",
      });
      
      if (response.ok) {
        alert("Arquivo salvo com sucesso!");
      }
    } catch (error) {
      console.error("Erro ao salvar:", error);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-700/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white" data-testid="button-back-home">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
            </Link>
            <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Arcádia API Hub</h1>
              <p className="text-sm text-slate-400">Documentação, gerador e executor de APIs</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                data-testid="input-search-endpoints"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar endpoints..."
                className="pl-9 bg-slate-800/50 border-slate-700 text-white"
              />
            </div>
            <Button 
              data-testid="button-open-generator"
              className="bg-amber-500 hover:bg-amber-600"
              onClick={() => setShowGeneratorDialog(true)}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Gerador com IA
            </Button>
          </div>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="bg-slate-800/50">
            <TabsTrigger data-testid="tab-docs" value="docs" className="data-[state=active]:bg-slate-700">
              <FileJson className="h-4 w-4 mr-2" />
              Documentação
            </TabsTrigger>
            <TabsTrigger data-testid="tab-tester" value="tester" className="data-[state=active]:bg-slate-700">
              <Play className="h-4 w-4 mr-2" />
              Executor
            </TabsTrigger>
            <TabsTrigger data-testid="tab-editor" value="editor" className="data-[state=active]:bg-slate-700">
              <Code className="h-4 w-4 mr-2" />
              Editor
            </TabsTrigger>
            <TabsTrigger data-testid="tab-custom-mcp" value="custom-mcp" className="data-[state=active]:bg-slate-700">
              <Plug className="h-4 w-4 mr-2" />
              MCPs Personalizados
            </TabsTrigger>
          </TabsList>
        
        {/* Content */}
        <div className="flex-1 overflow-hidden mt-4">
          <TabsContent value="docs" className="h-full mt-0">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Sidebar - Módulos */}
            <ResizablePanel defaultSize={30} minSize={20}>
              <ScrollArea className="h-full">
                <div className="p-4 space-y-2">
                  {filteredModules.map((module) => (
                    <Collapsible 
                      key={module.id} 
                      open={expandedModules.has(module.id)}
                      onOpenChange={() => toggleModule(module.id)}
                    >
                      <CollapsibleTrigger data-testid={`module-trigger-${module.id}`} className="w-full">
                        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/50 transition-colors">
                          <div className={`p-2 rounded-lg ${module.color}`}>
                            <module.icon className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex-1 text-left">
                            <h3 data-testid={`text-module-name-${module.id}`} className="font-medium">{module.name}</h3>
                            <p className="text-xs text-slate-400">{module.endpoints.length} endpoints</p>
                          </div>
                          {expandedModules.has(module.id) ? (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="ml-4 pl-4 border-l border-slate-700/50 space-y-1 py-2">
                          {module.endpoints.map((endpoint, i) => (
                            <div
                              key={i}
                              data-testid={`endpoint-row-${module.id}-${i}`}
                              onClick={() => selectEndpoint(module, endpoint)}
                              className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                                selectedEndpoint === endpoint 
                                  ? "bg-cyan-500/20 border border-cyan-500/30" 
                                  : "hover:bg-slate-800/50"
                              }`}
                            >
                              <Badge className={`${getMethodColor(endpoint.method)} text-xs px-1.5 py-0`}>
                                {endpoint.method}
                              </Badge>
                              <span className="text-sm text-slate-300 truncate">{endpoint.path}</span>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </ScrollArea>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Main - Detalhes do Endpoint */}
            <ResizablePanel defaultSize={70}>
              {selectedEndpoint && selectedModule ? (
                <ScrollArea className="h-full">
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <Badge className={`${getMethodColor(selectedEndpoint.method)} text-lg px-3 py-1`}>
                        {selectedEndpoint.method}
                      </Badge>
                      <code className="text-xl text-cyan-300 font-mono">
                        {selectedModule.baseUrl}{selectedEndpoint.path}
                      </code>
                    </div>
                    
                    <p className="text-slate-300 mb-6">{selectedEndpoint.description}</p>
                    
                    {selectedEndpoint.params && selectedEndpoint.params.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                          <Settings className="h-5 w-5 text-slate-400" />
                          Parâmetros
                        </h3>
                        <div className="bg-slate-800/50 rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-slate-700/50">
                              <tr>
                                <th className="text-left p-3 text-sm font-medium">Nome</th>
                                <th className="text-left p-3 text-sm font-medium">Tipo</th>
                                <th className="text-left p-3 text-sm font-medium">Obrigatório</th>
                                <th className="text-left p-3 text-sm font-medium">Descrição</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedEndpoint.params.map((param, i) => (
                                <tr key={i} className="border-t border-slate-700/50">
                                  <td className="p-3"><code className="text-cyan-300">{param.name}</code></td>
                                  <td className="p-3"><Badge variant="outline">{param.type}</Badge></td>
                                  <td className="p-3">{param.required ? <CheckCircle className="h-4 w-4 text-green-400" /> : "-"}</td>
                                  <td className="p-3 text-slate-400 text-sm">{param.description || "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    
                    {selectedEndpoint.bodyExample && (
                      <div className="mb-6">
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                          <FileJson className="h-5 w-5 text-slate-400" />
                          Exemplo de Body
                        </h3>
                        <div className="bg-slate-950 rounded-lg p-4 font-mono text-sm">
                          <pre className="text-green-400">{JSON.stringify(JSON.parse(selectedEndpoint.bodyExample), null, 2)}</pre>
                        </div>
                      </div>
                    )}
                    
                    <Button 
                      data-testid="button-test-endpoint"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        setActiveTab("tester");
                      }}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Testar Endpoint
                    </Button>
                  </div>
                </ScrollArea>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <FileJson className="h-16 w-16 mx-auto mb-4 text-slate-600" />
                    <h2 className="text-xl font-semibold mb-2">Documentação de APIs</h2>
                    <p className="text-slate-400 max-w-md">
                      Selecione um módulo e endpoint para ver a documentação detalhada
                    </p>
                  </div>
                </div>
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        </TabsContent>

        <TabsContent value="tester" className="h-full mt-0 p-4">
          <div className="h-full grid grid-cols-2 gap-4">
            {/* Request */}
            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                <select
                  data-testid="select-request-method"
                  value={requestMethod}
                  onChange={(e) => setRequestMethod(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white w-28"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                </select>
                <Input
                  data-testid="input-request-url"
                  value={requestUrl}
                  onChange={(e) => setRequestUrl(e.target.value)}
                  placeholder="/api/endpoint"
                  className="flex-1 bg-slate-800 border-slate-700 text-white font-mono"
                />
                <Button 
                  data-testid="button-send-request"
                  className="bg-green-600 hover:bg-green-700 px-6"
                  onClick={executeRequest}
                  disabled={isExecuting}
                >
                  {isExecuting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span className="ml-2">Enviar</span>
                </Button>
              </div>
              
              <div className="flex-1 flex flex-col gap-4">
                <div>
                  <label className="text-sm text-slate-400 mb-1 block">Headers (JSON)</label>
                  <Textarea
                    data-testid="textarea-request-headers"
                    value={requestHeaders}
                    onChange={(e) => setRequestHeaders(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white font-mono text-sm h-24"
                  />
                </div>
                {requestMethod !== "GET" && (
                  <div className="flex-1">
                    <label className="text-sm text-slate-400 mb-1 block">Body (JSON)</label>
                    <Textarea
                      data-testid="textarea-request-body"
                      value={requestBody}
                      onChange={(e) => setRequestBody(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white font-mono text-sm h-48"
                    />
                  </div>
                )}
              </div>
            </div>
            
            {/* Response */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-slate-400">Resposta</label>
                {responseData?.status && (
                  <div data-testid="text-response-status" className="flex items-center gap-2">
                    <Badge className={responseData.status >= 200 && responseData.status < 300 ? "bg-green-500" : "bg-red-500"}>
                      {responseData.status}
                    </Badge>
                    <span className="text-xs text-slate-500">{responseData.latency}ms</span>
                  </div>
                )}
              </div>
              <div data-testid="text-response-body" className="flex-1 bg-slate-950 rounded-lg p-4 font-mono text-sm overflow-auto">
                {responseData?.body ? (
                  <pre className={responseData.status && responseData.status >= 200 && responseData.status < 300 ? "text-green-400" : "text-red-400"}>
                    {responseData.body}
                  </pre>
                ) : (
                  <span className="text-slate-500">Execute uma requisição para ver a resposta</span>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="editor" className="h-full mt-0">
          <div className="h-full flex flex-col">
            <div className="p-2 border-b border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-slate-400" />
                <Input
                  data-testid="input-editor-filename"
                  value={editorFileName}
                  onChange={(e) => setEditorFileName(e.target.value)}
                  className="w-48 h-7 text-sm bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <Button 
                data-testid="button-save-editor"
                size="sm" 
                variant="outline" 
                className="border-slate-600"
                onClick={saveEditorContent}
              >
                <Save className="h-4 w-4 mr-1" />
                Salvar
              </Button>
            </div>
            <div className="flex-1">
              <Editor
                height="100%"
                language="typescript"
                theme="vs-dark"
                value={codeEditorContent}
                onChange={(v) => setCodeEditorContent(v || "")}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  padding: { top: 16 },
                }}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="custom-mcp" className="h-full mt-0">
          <CustomMcpSection />
        </TabsContent>
        </div>
        </Tabs>
      </div>

      {/* Dialog: Gerador com IA */}
      <Dialog open={showGeneratorDialog} onOpenChange={setShowGeneratorDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-400" />
              Gerador de API com Manus
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden">
            <div className="flex flex-col">
              <label className="text-sm text-slate-400 mb-2">Cole a documentação da API aqui:</label>
              <Textarea
                data-testid="textarea-generator-input"
                value={generatorInput}
                onChange={(e) => setGeneratorInput(e.target.value)}
                placeholder="Cole aqui a documentação da API (Swagger, OpenAPI, texto, etc)..."
                className="flex-1 bg-slate-800 border-slate-700 text-white font-mono text-sm resize-none"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm text-slate-400 mb-2">Código gerado:</label>
              <div data-testid="text-generator-output" className="flex-1 bg-slate-950 rounded-lg p-4 font-mono text-sm overflow-auto">
                {generatorOutput ? (
                  <pre className="text-green-400">{generatorOutput}</pre>
                ) : (
                  <span className="text-slate-500">O Manus vai gerar o código aqui...</span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="button-close-generator" variant="ghost" onClick={() => setShowGeneratorDialog(false)}>
              Fechar
            </Button>
            <Button 
              data-testid="button-generate-with-manus"
              className="bg-amber-500 hover:bg-amber-600"
              onClick={generateWithManus}
              disabled={isGenerating || !generatorInput.trim()}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Bot className="h-4 w-4 mr-2" />
                  Gerar com Manus
                </>
              )}
            </Button>
            {generatorOutput && (
              <Button 
                data-testid="button-open-in-editor"
                className="bg-cyan-600 hover:bg-cyan-700"
                onClick={copyToEditor}
              >
                <Code className="h-4 w-4 mr-2" />
                Abrir no Editor
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
