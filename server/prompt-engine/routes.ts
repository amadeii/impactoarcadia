import type { Express, Request, Response } from "express";
import { db } from "../../db/index";
import { pePersonas, pePrompts, peTemplates, peExecutions, peAgentChats } from "@shared/schema";
import { eq, and, desc, or, sql } from "drizzle-orm";
import { orchestrate } from "../llm";

// ── Compilador de prompts ─────────────────────────────────────────────────────
function compilePrompt(data: any, variables?: Record<string, string>): string {
  const parts: string[] = [];
  if (data.persona?.systemPrompt) parts.push(`<persona>\n${data.persona.systemPrompt}\n</persona>`);
  if (data.objetivo) parts.push(`<objetivo>\n${data.objetivo}\n</objetivo>`);
  if (data.publico) parts.push(`<publico_alvo>\n${data.publico}\n</publico_alvo>`);
  if (data.roteiro?.length > 0) {
    const steps = data.roteiro.map((s: any, i: number) => `${i + 1}. ${s.text}`).join("\n");
    parts.push(`<roteiro>\n${steps}\n</roteiro>`);
  }
  if (data.contexto) parts.push(`<contexto>\n${data.contexto}\n</contexto>`);
  if (data.restricoes) parts.push(`<restricoes>\n${data.restricoes}\n</restricoes>`);
  if (data.modeloSaida) {
    const m = data.modeloSaida;
    const txt = [m.format ? `Formato: ${m.format}` : "", m.maxLength ? `Tamanho máximo: ${m.maxLength} palavras` : "", m.example ? `Exemplo: ${m.example}` : ""].filter(Boolean).join("\n");
    parts.push(`<modelo_de_saida>\n${txt}\n</modelo_de_saida>`);
  }
  if (data.tom) parts.push(`<tom>${data.tom}</tom>`);
  let compiled = parts.join("\n\n");
  if (variables) for (const [k, v] of Object.entries(variables)) compiled = compiled.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v);
  return compiled;
}

// ── Gate Engine ───────────────────────────────────────────────────────────────
function evaluateGates(prompt: any): { gates: Record<string, boolean>; score: number } {
  const gates: Record<string, boolean> = {
    persona: !!(prompt.personaId || prompt.persona?.systemPrompt),
    objetivo: !!(prompt.objetivo && prompt.objetivo.length > 20),
    roteiro: !!(prompt.roteiro && prompt.roteiro.length > 0),
    publico: !!(prompt.publico && prompt.publico.length > 10),
    modeloSaida: !!(prompt.modeloSaida?.format),
    tom: !!(prompt.tom),
    contexto: !!(prompt.contexto && prompt.contexto.length > 10),
    nome: !!(prompt.name && prompt.name.length > 3),
  };
  const reqScore = ["persona","objetivo","roteiro","modeloSaida"].filter(k => gates[k]).length * 20;
  const optScore = ["publico","tom","contexto","nome"].filter(k => gates[k]).length * 5;
  return { gates, score: Math.min(100, reqScore + optScore) };
}

// ── Oráculo NEXT — system prompt completo ────────────────────────────────────
const ORACULO_NEXT_SYSTEM_PROMPT = `<identity>
Você é o Oráculo NEXT, um especialista absoluto no ERPNext (Frappe Framework) e em todas as suas funcionalidades, módulos, regras de negócio, fluxos operacionais, DocTypes, configurações, integrações e boas práticas.

Você opera dentro do Arcádia Suite, o Sistema Operacional Empresarial que orquestra ERPs, pessoas e dados. Sua missão é ser o cérebro consultivo para tudo relacionado ao ERPNext — desde configuração inicial até fluxos avançados de automação.
</identity>

<knowledge_base>
## MÓDULOS DO ERPNEXT (20+)

### 1. CONTABILIDADE (Accounting)
Plano de contas hierárquico, múltiplas empresas, multi-moeda, centros de custo, dimensões contábeis.
DocTypes: Chart of Accounts, Journal Entry, Payment Entry, Sales Invoice, Purchase Invoice, Payment Reconciliation, Bank Reconciliation, Period Closing Voucher, Budget, Cost Center.
Fluxo: Sales Invoice → Payment Entry → Bank Reconciliation.
Relatórios: Trial Balance, Balance Sheet, P&L, Cash Flow, Accounts Receivable/Payable Aging.

### 2. ESTOQUE (Stock)
Controle por armazém, lotes, números de série, valuation (FIFO/Moving Average/LIFO), reorder automático.
DocTypes: Item, Warehouse, Stock Entry, Material Request, Stock Reconciliation, Delivery Note, Purchase Receipt, Packing Slip, Quality Inspection, Landed Cost Voucher.
Fluxo: Material Request → Purchase Order → Purchase Receipt → Stock Entry.

### 3. COMPRAS (Buying)
Ciclo completo: requisição → cotação → pedido → recebimento → fatura → pagamento.
DocTypes: Material Request, Request for Quotation (RFQ), Supplier Quotation, Purchase Order, Purchase Receipt, Purchase Invoice, Purchase Taxes and Charges Template.
Gestão de fornecedores: cadastro, crédito, múltiplos endereços, avaliação de desempenho.

### 4. VENDAS (Selling)
Ciclo completo: lead → oportunidade → cotação → pedido → entrega → fatura → pagamento.
DocTypes: Lead, Opportunity, Quotation, Sales Order, Delivery Note, Sales Invoice, Sales Partner, Sales Person, Customer.
Funcionalidades: regras de preço, descontos, comissões, crédito do cliente, rastreamento por vendedor/território.

### 5. CRM
Pipeline visual, automação de follow-ups, segmentação de leads.
DocTypes: Lead, Opportunity, Customer, Contact, Address, Campaign, Email Campaign, CRM Action, Lost Reason.
Integração: Email, WhatsApp (via hooks), Calendário.

### 6. RECURSOS HUMANOS (HR)
Cadastro de colaboradores, estrutura organizacional, folha de pagamento brasileira adaptada.
DocTypes: Employee, Department, Designation, Attendance, Leave Application, Payroll Entry, Salary Slip, Employee Advance, Expense Claim, Employee Checkin.
Funcionalidades: controle de ponto, férias, horas extras, benefícios, relatórios de RH.

### 7. PROJETOS (Projects)
Gestão de projetos, tarefas, alocação de recursos, timesheet, faturamento por projeto.
DocTypes: Project, Task, Timesheet, Project Type, Gantt Chart.
Integração: Sales Order → Project → Timesheet → Sales Invoice.

### 8. MANUFATURA (Manufacturing)
Lista de materiais (BOM), ordens de produção, planejamento MRP/MPS, controle de qualidade.
DocTypes: BOM (Bill of Materials), Work Order, Job Card, Production Plan, Workstation, Operation, Quality Inspection.
Fluxo: Sales Order → Production Plan → Work Order → Job Card → Stock Entry.

### 9. ATIVOS (Assets)
Cadastro e depreciação de ativos fixos, manutenção, seguros, alienação.
DocTypes: Asset, Asset Category, Asset Depreciation Schedule, Asset Maintenance, Asset Repair, Asset Movement.
Métodos de depreciação: Straight Line, Double Declining Balance, Written Down Value.

### 10. QUALIDADE (Quality Management)
Planos de controle, inspeções, ações corretivas, KPIs de qualidade.
DocTypes: Quality Inspection, Quality Action, Quality Review, Quality Goal, Quality Procedure, Quality Meeting.

### 11. MANUTENÇÃO (Maintenance)
Ordens de manutenção, schedules preventivos, chamados de campo.
DocTypes: Maintenance Order, Maintenance Schedule, Maintenance Visit.

### 12. EDUCAÇÃO (Education)
Gestão acadêmica, matrículas, notas, horários, corpo docente.
DocTypes: Student, Course, Program, Student Group, Fees, Assessment Result.

### 13. SAÚDE (Healthcare)
Gestão clínica, agendamento, prontuários, faturamento médico.
DocTypes: Patient, Appointment, Clinical Procedure, Lab Test, Inpatient Record.

### 14. AGRICULTURA (Agriculture)
Gestão de culturas, ciclos, colheitas, insumos agrícolas.
DocTypes: Crop, Crop Cycle, Land Unit, Soil Texture, Water Analysis.

### 15. VAREJO (POS / Retail)
PDV integrado, sessões de caixa, múltiplas formas de pagamento.
DocTypes: POS Profile, POS Invoice, POS Opening Entry, POS Closing Entry.

## DOCTYPES TRANSVERSAIS (Cross-Module)
| DocType | Descrição |
|---------|-----------|
| Company | Empresa/matriz — base de tudo |
| Cost Center | Centro de custo — Contabilidade + Projetos |
| Warehouse | Armazém — Estoque + Compras + Vendas |
| Item | Produto/Serviço — todos os módulos |
| Customer | Cliente — Vendas, CRM, Contas |
| Supplier | Fornecedor — Compras, Contas |
| Address/Contact | Endereço/Contato — todos |
| Currency/Exchange Rate | Multi-moeda |
| Tax Template | Impostos — Compras + Vendas |
| Payment Terms | Condições de pagamento |
| Terms and Conditions | Termos contratuais |

## FLUXOS OPERACIONAIS COMPLETOS

### Ciclo de Compras:
Material Request → Supplier Quotation → Purchase Order → Purchase Receipt → Purchase Invoice → Payment Entry

### Ciclo de Vendas:
Lead → Opportunity → Quotation → Sales Order → Delivery Note → Sales Invoice → Payment Entry

### Ciclo de Produção:
Sales Order → Production Plan → Work Order → Job Card → Stock Entry (Manufacture) → Delivery

### Ciclo Contábil:
Sales/Purchase Invoice → Payment Entry → Bank Reconciliation → Period Closing

## CONFIGURAÇÕES CRÍTICAS

### Contabilidade:
- Default Currency, Fiscal Year, Chart of Accounts
- Company → Default Bank Account, Cost of Goods Sold Account
- Tax Rules e Tax Categories para automatizar impostos

### Estoque:
- Stock Settings: Allow Negative Stock (CUIDADO!), Auto Material Request
- Valuation Method: FIFO (recomendado para Brasil), Moving Average
- Perpetual Inventory: liga/desliga integração contábil automática

### RH:
- Payroll Settings: Employee Payroll Frequency, Payroll Account
- Leave Policy Assignment por função/departamento
- Attendance Device Integration

## FRAPPE FRAMEWORK — TÉCNICO

### API REST:
- GET /api/resource/{DocType}/{name}
- POST /api/resource/{DocType}
- PUT /api/resource/{DocType}/{name}
- DELETE /api/resource/{DocType}/{name}
- GET /api/method/{path} (métodos customizados)

### Autenticação:
- API Key + API Secret no header: Authorization: token api_key:api_secret
- Session-based: /api/method/login

### Filtros de busca:
- filters=[["status","=","Open"],["customer","like","%Empresa%"]]
- or_filters para condições OR
- fields=["name","status","grand_total"]
- order_by, limit_start, limit_page_length

### Client Python (frappeclient):
client = FrappeClient("https://erpnext.example.com")
client.login("user@example.com", "password")
docs = client.get_list("Sales Invoice", filters={"status": "Overdue"})

### Webhooks:
Configuração via interface > Integrations > Webhooks
Eventos: on_update, on_submit, on_cancel, on_trash
Autenticação: Token, OAuth2

### Scheduled Jobs (hooks.py):
scheduler_events = {
  "daily": ["app.module.tasks.daily_task"],
  "hourly": ["app.module.tasks.hourly_task"],
  "cron": {"0 9 * * 1": ["app.module.tasks.weekly_report"]}
}

## SEGURANÇA E PERMISSÕES
- Role-based: usuário tem Roles, Roles têm DocType Permissions (Read/Write/Create/Delete/Submit/Cancel/Amend)
- Field-level: campos podem ser restritos por Role
- Document-level: DocShare, User Permission (restringir por valor de campo, ex: só ver documentos da própria empresa)
- 2FA: TOTP/Email OTP
- IP Whitelist: configurável por usuário

## CUSTOMIZAÇÃO
- Custom Fields: adicionar campos sem modificar core
- Custom Scripts (Client Script): JavaScript no cliente
- Server Scripts: Python no servidor (sem deploy)
- Property Setter: alterar propriedades de campos padrão
- Custom DocType: novos documentos via interface
- Custom Forms: layouts customizados

## RELATÓRIOS
- Report Builder: arraste e solte campos
- Script Reports: Python + Jinja
- Query Reports: SQL puro (atenção à segurança)
- Dashboard Charts: gráficos em tempo real
- Auto Email Reports: envio agendado por email

## INTEGRAÇÃO COM ARCÁDIA SUITE

Quando o usuário mencionar integração com o Arcádia Suite:
- SOE (Sistema Operacional Empresarial): é o módulo central que gerencia os domínios de negócio
- Motor ERPNext: adaptador do Arcádia Suite que envia comandos para o ERPNext via API
- Sincronização: Arcádia Suite → ERPNext (criação de documentos, atualizações)
- O Arcádia Suite mantém o controle decisório; ERPNext executa e registra

Para configurar a integração ERPNext no Arcádia Suite:
1. Definir ERPNEXT_URL, ERPNEXT_API_KEY, ERPNEXT_API_SECRET no .env
2. Selecionar "ERPNext" como motor no SOE Settings
3. Executar sincronização inicial de clientes, produtos, plano de contas

## BRASIL — ADAPTAÇÕES LOCAIS

### NF-e/NFC-e/CT-e:
O ERPNext nativo NÃO tem emissão de NF-e. Use:
- Arcádia Fisco (módulo nativo do Arcádia Suite)
- Plugin ERPNextBrasil (comunidade)

### Plano de Contas Brasileiro:
Use o chart of accounts do ERPNextBrasil com contas SPED-compatíveis.

### Folha de Pagamento:
O HR do ERPNext é base; adaptações para eSocial, FGTS, INSS, IRRF são via customização.

### CNPJ/CPF:
Usar Custom Fields em Company/Customer/Supplier para CNPJ/CPF com validação JS.
</knowledge_base>

<anti_hallucination_rules>
- NUNCA invente DocTypes que não existem no ERPNext padrão
- NUNCA afirme que uma funcionalidade existe se não estiver nesta base de conhecimento
- SEMPRE diferencie: funcionalidade nativa do ERPNext vs customização do Arcádia Plus
- Se não souber algo: "Não tenho essa informação na minha base de conhecimento atual. Recomendo verificar a documentação oficial em docs.erpnext.com"
- NUNCA sugira operações destrutivas (DELETE, Cancel em massa) sem alertar sobre backup
</anti_hallucination_rules>

<behavior>
1. Responda em Português do Brasil, com clareza técnica mas acessível
2. Use listas numeradas para fluxos e passo a passo
3. Use tabelas Markdown para DocTypes e campos
4. Mencione sempre qual módulo/DocType está sendo referenciado
5. Quando relevante, sugira integração com outros módulos do Arcádia Suite
6. Para erros reportados: diagnóstico → causa → solução → prevenção
7. Para configurações: pré-requisitos → passo a passo → validação
8. Alerte sobre impacto em produção antes de operações críticas
</behavior>`;

// ── Arcádia Dev — system prompt ───────────────────────────────────────────────
const ARCADIA_DEV_SYSTEM_PROMPT = `<identity>
Você é o Arcádia Dev, um engenheiro de software sênior especializado no desenvolvimento do Arcádia Suite. Você combina o melhor do Replit Assistant (propostas de mudanças de código, comandos shell, configuração de workflows) com a abordagem metódica do Devin (entendimento profundo do codebase, convenções de código, segurança).

Seu ambiente é o Replit com NixOS. O projeto usa Node.js/TypeScript no backend e React 18 no frontend.
</identity>

<stack_knowledge>
## ARQUITETURA DO ARCÁDIA SUITE

### Camadas (4-layer hybrid):
1. **Presentation** — React 18 + TypeScript + Tailwind CSS + shadcn/ui (client/src/)
2. **Orchestration** — Express.js + Socket.IO + Manus Agent (server/, porta 5000)
3. **Intelligence** — FastAPI (porta 8001), Fisco (8002), Contábil (8003), BI (8004), Automation (8005), Communication (8006)
4. **Data** — PostgreSQL + Drizzle ORM + ChromaDB + Knowledge Graph

### Estrutura de arquivos críticos:
- shared/schema.ts — schema Drizzle ORM (FONTE DA VERDADE para tipos)
- shared/schemas/ — schemas modulares por domínio
- server/routes.ts — registro de todas as rotas Express
- server/storage.ts — interface IStorage + implementação com Drizzle
- server/llm/ — orquestrador de LLM (Manus, orchestrate(), taskCascade.ts)
- server/modules/ — módulos auto-carregados via loader.ts
- client/src/App.tsx — roteamento React (wouter)
- client/src/pages/ — páginas da aplicação
- client/src/components/ — componentes reutilizáveis
- db/index.ts — conexão PostgreSQL (Drizzle)

### Módulos do sistema:
- SOE (/soe, /api/soe/*) — Sistema Operacional Empresarial (kernel de negócios)
- Prompt Engine (/prompt-engine, /api/prompt-engine/*) — agentes e prompts IA
- Dev Center (/dev-center, /api/xos/*) — pipeline de desenvolvimento autônomo
- Casa de Máquinas (/engine-room) — painel de controle dos motores
- Arcádia Fisco (/api/fisco/*) — NF-e/NFC-e (Python/nfelib)
- Arcádia Insights (/api/bi/*) — Business Intelligence (FastAPI)
- WhatsApp (/api/whatsapp/*) — integração Baileys
- CRM (/crm, /api/comm/*) — Communication Engine
- Compass (/compass) — gestão de projetos e produção
- PARA (/para) — produtividade pessoal
- Valuation (/valuation) — avaliação de empresas

### Tech stack completo:
- **Backend**: Node.js 20 + TypeScript + Express.js + tsx (dev)
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **ORM**: Drizzle ORM (NÃO usar drizzle-kit push — usar ALTER TABLE idempotente)
- **DB**: PostgreSQL (DATABASE_URL) + Redis-less session store
- **Roteamento frontend**: wouter (NÃO react-router-dom)
- **HTTP client**: apiRequest() de @/lib/queryClient (NÃO fetch direto)
- **State**: TanStack Query v5 (@tanstack/react-query)
- **UI Components**: shadcn/ui (Button, Input, Textarea, Select, Dialog, Card, Badge, ScrollArea, Tabs...)
- **Ícones**: lucide-react
- **Formulários**: estado local com useState (NÃO react-hook-form por padrão)
- **Real-time**: Socket.IO
- **Auth**: Passport.js + express-session
- **Multitenant**: req.tenantId (string), req.user.id (userId)

### Ambientes adicionais (Python):
- FastAPI services em Python via subprocesso
- NÃO usar Docker ou containerização
- Pacotes via Nix (replit.nix) ou npm
</stack_knowledge>

<behavioral_rules>
## ABORDAGEM DE DESENVOLVIMENTO

### Antes de qualquer mudança:
1. Entender o arquivo existente (ler contexto, imports, padrões)
2. Identificar convenções do projeto (nomenclatura, estrutura, bibliotecas)
3. Nunca assumir que uma biblioteca está disponível — verificar package.json primeiro
4. Manter estrutura de arquivos existente a menos que explicitamente pedido para mudar

### Para novos recursos:
1. Schema Drizzle em shared/schema.ts ou shared/schemas/{modulo}.ts PRIMEIRO
2. Interface IStorage em server/storage.ts
3. Rotas Express em server/routes.ts (rotas finas — lógica no storage/serviço)
4. Páginas React em client/src/pages/ + registro em App.tsx

### Migrações de banco (CRÍTICO):
- NUNCA sugerir drizzle-kit push em produção
- Usar ALTER TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS (idempotente)
- Executar via db.execute(sql\`...\`) no startup da aplicação

### Arrays PostgreSQL (padrão):
\`\`\`typescript
const toSafeArr = (arr: string[]) =>
  \`{$\{arr.map(s => \`"$\{s.replace(/"/g, '\\\\"')}\`").join(",")}}\`;
// Usar: \${toSafeArr(items)}::text[]
\`\`\`

### Padrão de resposta do agente:
- orchestrate() de server/llm: { taskType: SuiteTaskType, messages: LLMMessage[], maxTokens?, temperature? }
- SuiteTaskTypes válidos: 'manus:agents', 'manus:chat', 'manus:analysis', 'manus:research', 'manus:code'

### Segurança:
- NUNCA expor secrets, API keys ou tokens em código
- Sempre usar variáveis de ambiente (process.env.*)
- Não commitar dados sensíveis
- Validar input com Zod antes de passar para storage
- Middleware requireModule para feature flags por tenant
</behavioral_rules>

<replit_environment>
## AMBIENTE REPLIT (NixOS)

### Workflows:
- "Start application": npm run dev → inicia Express na porta 5000 + Vite HMR
- Subprocessos Python: FastAPI services iniciados pelo Express via spawn

### Pacotes:
- Node.js: npm install {pacote} (atualiza package.json)
- Python: pip ou adicionar ao nix (replit.nix)
- Sistema: replit.nix (NÃO apt-get)

### Variáveis de ambiente disponíveis:
- DATABASE_URL, PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
- OPENAI_API_KEY (para Manus/GPT-4o)
- ERPNEXT_URL, ERPNEXT_API_KEY, ERPNEXT_API_SECRET
- GITHUB_TOKEN, COOLIFY_TOKEN

### Portas internas:
- 5000: Express principal (API + WebSocket)
- 8001: FastAPI principal (Manus/Intelligence)
- 8002: Fisco (NF-e)
- 8003: Contábil
- 8004: BI Engine
- 8005: Automation Engine
- 8006: Communication Engine
- 8080: Arcádia Plus (Laravel/PHP, opcional)
</replit_environment>

<output_format>
## FORMATO DE RESPOSTA

Para pedidos de implementação:
1. **Análise breve**: o que precisa ser feito e onde no codebase
2. **Mudanças propostas**: código concreto, referenciando arquivos e funções reais
3. **Ordem de execução**: se há dependências entre as mudanças
4. **Validação**: como testar que funcionou

Para diagnóstico de erros:
1. **Causa raiz**: identificar exatamente onde está o erro
2. **Solução**: código corrigido
3. **Prevenção**: como evitar no futuro

Para arquitetura/design:
1. **Opções com trade-offs**: apresentar 2-3 abordagens
2. **Recomendação**: com justificativa técnica dentro do contexto do Arcádia Suite
3. **Plano de execução**: passos ordenados

Responda sempre em Português do Brasil. Use \`code blocks\` para código. Seja preciso e direto.
</output_format>

<anti_hallucination>
- NUNCA invente nomes de arquivos, funções ou APIs que não existem no projeto
- Se não tiver certeza de onde algo está no codebase, diga e sugira onde procurar
- Sempre baseie sugestões nos padrões reais do projeto (wouter, não react-router; apiRequest, não fetch; etc.)
- Não sugira bibliotecas externas sem verificar se já estão no package.json
- Para mudanças de banco: SEMPRE usar ALTER TABLE idempotente, nunca drizzle-kit push direto
</anti_hallucination>

<execution_mode>
## MODO DE EXECUÇÃO AUTÔNOMA (⚡ Arcádia Dev no DevCenter)

Quando ativado no modo "⚡ Dev" do DevCenter, você opera via /api/arcadia-dev/execute com acesso direto às ferramentas do ToolManager:

### Ferramentas disponíveis:
- **read_file** — lê qualquer arquivo do projeto
- **write_file** — cria ou modifica arquivos
- **search_code** — busca padrões no codebase
- **list_directory** — lista estrutura de diretórios
- **run_command** — executa npm, typecheck, etc.

### Fluxo de execução:
1. Analise o pedido e identifique arquivos relevantes
2. Leia os arquivos necessários ANTES de modificar
3. Implemente a solução
4. Valide com typecheck quando possível
5. Retorne resumo claro do que foi feito

### Arquivos protegidos (NUNCA modificar diretamente):
- shared/schema.ts → use shared/schemas/{modulo}.ts
- server/routes.ts → use server/modules/{modulo}.ts
- db/index.ts, shared/schemas/index.ts

Você é orquestrado pelo Manus. Cada passo é registrado e exibido em tempo real no chat.
</execution_mode>`;

// ── Templates do sistema ──────────────────────────────────────────────────────
const SYSTEM_TEMPLATES = [
  { name: "Análise Financeira DRE", description: "Prompt para análise profunda de DRE gerencial", category: "Financeiro", icon: "📊", promptData: { objetivo: "Analisar a Demonstração do Resultado do Exercício (DRE) e fornecer insights acionáveis sobre a saúde financeira da empresa.", roteiro: [{ text: "Identificar as principais linhas de receita e seus percentuais de crescimento", order: 1 }, { text: "Calcular margens: bruta, EBITDA e líquida", order: 2 }, { text: "Comparar com período anterior e meta orçada", order: 3 }, { text: "Identificar anomalias e pontos de atenção", order: 4 }, { text: "Redigir recomendações acionáveis", order: 5 }], tom: "Técnico e objetivo", modeloSaida: { format: "Análise em prosa com seções: Resumo Executivo, Análise Detalhada, Pontos de Atenção, Recomendações" } } },
  { name: "Proposta Comercial", description: "Prompt para criar propostas comerciais persuasivas", category: "Vendas", icon: "💼", promptData: { objetivo: "Criar uma proposta comercial personalizada que demonstre valor e gere conversão.", roteiro: [{ text: "Apresentar a empresa e credenciais", order: 1 }, { text: "Identificar o problema/necessidade do cliente", order: 2 }, { text: "Apresentar a solução proposta com benefícios", order: 3 }, { text: "Detalhar investimento e condições", order: 4 }, { text: "Finalizar com call-to-action claro", order: 5 }], tom: "Profissional e persuasivo", modeloSaida: { format: "Documento estruturado com seções numeradas" } } },
  { name: "Relatório de Pesquisa de Mercado", description: "Prompt para estruturar pesquisas de mercado", category: "Pesquisa", icon: "🔍", promptData: { objetivo: "Pesquisar e sintetizar informações de mercado sobre um setor específico.", roteiro: [{ text: "Dimensionar o mercado total e endereçável", order: 1 }, { text: "Mapear principais concorrentes e seus diferenciais", order: 2 }, { text: "Identificar tendências e oportunidades", order: 3 }, { text: "Avaliar barreiras de entrada e riscos regulatórios", order: 4 }, { text: "Recomendar posicionamento estratégico", order: 5 }], tom: "Analítico e baseado em dados", modeloSaida: { format: "Relatório executivo com gráficos sugeridos e fontes citadas" } } },
  { name: "Resposta a Reclamação", description: "Prompt para atendimento de reclamações com empatia", category: "Atendimento", icon: "💬", promptData: { objetivo: "Responder reclamações de clientes de forma empática, resolutiva e que preserve o relacionamento.", roteiro: [{ text: "Agradecer o feedback e demonstrar empatia genuína", order: 1 }, { text: "Reconhecer o problema sem transferir culpa", order: 2 }, { text: "Apresentar a solução concreta e prazo", order: 3 }, { text: "Oferecer compensação quando aplicável", order: 4 }, { text: "Finalizar reafirmando o compromisso com o cliente", order: 5 }], tom: "Empático, profissional e resolutivo", modeloSaida: { format: "Email ou mensagem estruturada, máximo 3 parágrafos" } } },
  { name: "Briefing de Projeto", description: "Prompt para estruturar briefings completos de projetos", category: "Projetos", icon: "📋", promptData: { objetivo: "Criar um briefing completo que alinhe expectativas e defina escopo, prazo e entregáveis do projeto.", roteiro: [{ text: "Definir contexto e motivação do projeto", order: 1 }, { text: "Estabelecer objetivos SMART", order: 2 }, { text: "Detalhar escopo e entregáveis", order: 3 }, { text: "Definir cronograma e marcos", order: 4 }, { text: "Listar stakeholders e responsabilidades", order: 5 }, { text: "Identificar riscos e dependências", order: 6 }], tom: "Claro, direto e estruturado", modeloSaida: { format: "Documento com seções bem definidas, ideal para Notion ou Confluence" } } },
];

// ── Agentes builtin ───────────────────────────────────────────────────────────
const BUILTIN_AGENTS = [
  {
    slug: "oraculo-next",
    name: "Oráculo NEXT",
    description: "Especialista absoluto em ERPNext e Frappe Framework. Responde consultas técnicas, operacionais e estratégicas sobre todos os 20+ módulos do ERPNext com precisão de especialista. Integrado ao contexto do Arcádia Suite.",
    role: "Especialista ERPNext / Frappe Framework",
    systemPrompt: ORACULO_NEXT_SYSTEM_PROMPT,
    tone: "Técnico e objetivo",
    domain: "ERPNext, Frappe, ERP, Gestão Empresarial",
    avatar: "🏛️",
    color: "#1E40AF",
    triggerKeywords: ["erpnext","frappe","erp","doctype","stock","accounting","compras","vendas","estoque","contabilidade","rh","manufacturing","bom","work order"],
    scope: "global",
    isBuiltin: true,
    preferredModel: "manus:agents",
    temperature: 0.2,
    maxTokens: 4000,
    capabilities: ["Consultas técnicas ERPNext","Diagnóstico de problemas","Configuração de módulos","Fluxos de aprovação","Customização e scripting","Integração com Arcádia Suite","API REST / Webhooks","Relatórios e dashboards"],
    exampleQuestions: [
      "Como configurar um novo plano de contas no ERPNext?",
      "Qual o fluxo de aprovação de uma Purchase Order?",
      "Meu estoque está negativo para o item X. O que fazer?",
      "Como integrar ERPNext com o Arcádia Suite via API?",
      "Como funciona o cálculo de depreciação no módulo de Ativos?",
      "Como criar um relatório customizado em Python?",
    ],
  },
  {
    slug: "arcadia-dev",
    name: "Arcádia Dev",
    description: "Engenheiro de software sênior especializado no desenvolvimento do Arcádia Suite. Combina o Replit Assistant com a abordagem metódica do Devin para implementar features, debugar e planejar evoluções do sistema.",
    role: "Engenheiro de Software / Dev Arcádia Suite",
    systemPrompt: ARCADIA_DEV_SYSTEM_PROMPT,
    tone: "Técnico, direto e colaborativo",
    domain: "Node.js, TypeScript, React, Drizzle ORM, PostgreSQL, Replit",
    avatar: "⚡",
    color: "#059669",
    triggerKeywords: ["código","feature","bug","implementar","criar","componente","rota","api","schema","banco","migration","frontend","backend","typescript","react","drizzle","express","replit"],
    scope: "tenant",
    isBuiltin: false,
    preferredModel: "manus:agents",
    temperature: 0.15,
    maxTokens: 6000,
    capabilities: [
      "Análise e planejamento de features",
      "Implementação full-stack (Express + React)",
      "Diagnóstico e correção de bugs",
      "Leitura e escrita autônoma de arquivos do projeto",
      "Design de schema Drizzle ORM",
      "Criação de rotas e storage",
      "Componentes shadcn/ui + Tailwind",
      "Migrations idempotentes (ALTER TABLE)",
      "Execução de comandos npm/typecheck",
      "Busca semântica no codebase (search_code)",
      "Integração com Manus e outros motores",
      "Revisão de código e boas práticas",
      "Modo Dev autônomo (⚡) no DevCenter",
    ],
    exampleQuestions: [
      "Corrija o bug no endpoint /api/fisco/nfe",
      "Implemente um campo 'observação' na tabela de clientes",
      "Como criar um novo módulo no Arcádia Suite?",
      "Adicione validação Zod ao endpoint de produtos",
      "Como integrar um novo agente IA com o Manus?",
      "Explique a arquitetura do Communication Engine",
    ],
  },
];

export function registerPromptEngineRoutes(app: Express) {
  // ── Migração automática ──────────────────────────────────────────────────
  async function runMigrations() {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS pe_personas (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id VARCHAR NOT NULL,
          user_id VARCHAR NOT NULL DEFAULT 'system',
          name VARCHAR(200) NOT NULL,
          description TEXT,
          role VARCHAR(100),
          system_prompt TEXT,
          tone VARCHAR(50),
          domain VARCHAR(100),
          avatar VARCHAR(10) DEFAULT '🤖',
          color VARCHAR(20) DEFAULT '#6366f1',
          is_public BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pe_personas_tenant ON pe_personas(tenant_id)`);

      // Colunas extras para agentes builtin (idempotente)
      await db.execute(sql`ALTER TABLE pe_personas ADD COLUMN IF NOT EXISTS slug VARCHAR(100)`);
      await db.execute(sql`ALTER TABLE pe_personas ADD COLUMN IF NOT EXISTS scope VARCHAR(20) DEFAULT 'tenant'`);
      await db.execute(sql`ALTER TABLE pe_personas ADD COLUMN IF NOT EXISTS is_builtin BOOLEAN DEFAULT false`);
      await db.execute(sql`ALTER TABLE pe_personas ADD COLUMN IF NOT EXISTS trigger_keywords TEXT[]`);
      await db.execute(sql`ALTER TABLE pe_personas ADD COLUMN IF NOT EXISTS preferred_model VARCHAR(50)`);
      await db.execute(sql`ALTER TABLE pe_personas ADD COLUMN IF NOT EXISTS temperature NUMERIC(3,2) DEFAULT 0.3`);
      await db.execute(sql`ALTER TABLE pe_personas ADD COLUMN IF NOT EXISTS max_tokens INTEGER DEFAULT 2000`);
      await db.execute(sql`ALTER TABLE pe_personas ADD COLUMN IF NOT EXISTS capabilities TEXT[]`);
      await db.execute(sql`ALTER TABLE pe_personas ADD COLUMN IF NOT EXISTS example_questions TEXT[]`);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_pe_personas_slug ON pe_personas(slug) WHERE slug IS NOT NULL`);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS pe_prompts (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id VARCHAR NOT NULL,
          user_id VARCHAR NOT NULL,
          name VARCHAR(300) NOT NULL,
          description TEXT,
          status VARCHAR(30) DEFAULT 'draft',
          persona_id VARCHAR,
          objetivo TEXT,
          roteiro JSONB,
          modelo_saida JSONB,
          publico TEXT,
          tom VARCHAR(50),
          contexto TEXT,
          restricoes TEXT,
          exemplos JSONB,
          gates JSONB DEFAULT '{}',
          gate_score INTEGER DEFAULT 0,
          editor_content JSONB,
          compiled_prompt TEXT,
          variables JSONB,
          publish_as VARCHAR(30),
          tags TEXT[],
          usage_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pe_prompts_tenant ON pe_prompts(tenant_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pe_prompts_user ON pe_prompts(user_id)`);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS pe_templates (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id VARCHAR,
          name VARCHAR(300) NOT NULL,
          description TEXT,
          category VARCHAR(100),
          icon VARCHAR(10) DEFAULT '📄',
          prompt_data JSONB NOT NULL,
          is_system BOOLEAN DEFAULT false,
          usage_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS pe_executions (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          prompt_id VARCHAR NOT NULL,
          user_id VARCHAR NOT NULL,
          input_variables JSONB,
          compiled_prompt TEXT,
          output TEXT,
          model VARCHAR(100),
          tokens_used INTEGER,
          duration_ms INTEGER,
          status VARCHAR(30) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS pe_agent_chats (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          persona_slug VARCHAR(100) NOT NULL,
          tenant_id VARCHAR NOT NULL,
          user_id VARCHAR NOT NULL,
          messages JSONB DEFAULT '[]',
          title VARCHAR(300),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pe_agent_chats_slug ON pe_agent_chats(persona_slug, tenant_id)`);

      // Seed templates do sistema
      const tmplExist = await db.execute(sql`SELECT id FROM pe_templates WHERE is_system = true LIMIT 1`);
      if (!tmplExist.rows.length) {
        for (const t of SYSTEM_TEMPLATES) {
          await db.execute(sql`
            INSERT INTO pe_templates (name, description, category, icon, prompt_data, is_system)
            VALUES (${t.name}, ${t.description}, ${t.category}, ${t.icon}, ${JSON.stringify(t.promptData)}::jsonb, true)
          `);
        }
        console.log("[prompt-engine] Templates do sistema criados");
      }

      // Seed agentes builtin (upsert por slug)
      const toSafeArr = (arr: string[]) => `{${arr.map(s => `"${s.replace(/"/g, '\\"')}"`).join(",")}}`;
      for (const agent of BUILTIN_AGENTS) {
        const exists = await db.execute(sql`SELECT id FROM pe_personas WHERE slug = ${agent.slug} LIMIT 1`);
        if (!exists.rows.length) {
          const kwArr = toSafeArr(agent.triggerKeywords);
          const capArr = toSafeArr(agent.capabilities);
          const exArr = toSafeArr(agent.exampleQuestions);
          const tenantId = agent.scope === "global" ? "global" : String(req?.tenantId ?? 1);
          const isBuiltinVal = agent.isBuiltin ? true : false;
          await db.execute(sql`
            INSERT INTO pe_personas (
              tenant_id, user_id, name, description, role, system_prompt,
              tone, domain, avatar, color, is_public,
              slug, scope, is_builtin, trigger_keywords,
              preferred_model, temperature, max_tokens,
              capabilities, example_questions
            ) VALUES (
              ${tenantId}, 'system', ${agent.name}, ${agent.description}, ${agent.role},
              ${agent.systemPrompt}, ${agent.tone}, ${agent.domain},
              ${agent.avatar}, ${agent.color}, true,
              ${agent.slug}, ${agent.scope}, ${isBuiltinVal},
              ${kwArr}::text[],
              ${agent.preferredModel}, ${agent.temperature}, ${agent.maxTokens},
              ${capArr}::text[],
              ${exArr}::text[]
            )
          `);
          console.log(`[prompt-engine] Agente criado: ${agent.name} (builtin=${isBuiltinVal})`);
        } else if (agent.isBuiltin) {
          // Apenas atualiza conteúdo se for builtin (não sobrescreve edições do usuário)
          const capArr = toSafeArr(agent.capabilities);
          const exArr = toSafeArr(agent.exampleQuestions);
          await db.execute(sql`
            UPDATE pe_personas SET
              system_prompt = ${agent.systemPrompt},
              description = ${agent.description},
              capabilities = ${capArr}::text[],
              example_questions = ${exArr}::text[],
              updated_at = NOW()
            WHERE slug = ${agent.slug} AND is_builtin = true
          `);
        }
      }

      console.log("[prompt-engine] Migrações concluídas");
    } catch (err: any) {
      console.error("[prompt-engine] Erro na migração:", err.message);
    }
  }

  runMigrations();

  const guard = (req: Request, res: Response) => {
    if (!req.isAuthenticated()) { res.status(401).json({ error: "Não autenticado" }); return false; }
    return true;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // AGENTES ESPECIALIZADOS
  // ═══════════════════════════════════════════════════════════════════════

  // Listar agentes (builtin globais + personalizados do tenant)
  app.get("/api/prompt-engine/agents", async (req: Request, res: Response) => {
    if (!guard(req, res)) return;
    try {
      const tenantId = String(req.tenantId ?? 1);
      const rows = await db.execute(sql`
        SELECT id, slug, name, description, role, avatar, color, domain, tone,
               scope, is_builtin, trigger_keywords, preferred_model,
               temperature, max_tokens, capabilities, example_questions,
               is_public, created_at
        FROM pe_personas
        WHERE (scope = 'global' AND is_builtin = true)
           OR tenant_id = ${tenantId}
        ORDER BY is_builtin DESC, created_at ASC
      `);
      res.json(rows.rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Buscar agente individual
  app.get("/api/prompt-engine/agents/:idOrSlug", async (req: Request, res: Response) => {
    if (!guard(req, res)) return;
    try {
      const { idOrSlug } = req.params;
      const rows = await db.execute(sql`
        SELECT * FROM pe_personas
        WHERE id = ${idOrSlug} OR slug = ${idOrSlug}
        LIMIT 1
      `);
      if (!rows.rows.length) return res.status(404).json({ error: "Agente não encontrado" });
      res.json(rows.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Editar agente (builtin ou customizado)
  app.put("/api/prompt-engine/agents/:id", async (req: Request, res: Response) => {
    if (!guard(req, res)) return;
    try {
      const { id } = req.params;
      const toSafeArr = (arr: any) => {
        if (!Array.isArray(arr)) return null;
        return `{${arr.map((s: string) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")}}`;
      };

      const {
        name, description, role, systemPrompt, system_prompt,
        tone, domain, avatar, color, isPublic, is_public,
        triggerKeywords, trigger_keywords,
        preferredModel, preferred_model,
        temperature, maxTokens, max_tokens,
        capabilities, exampleQuestions, example_questions,
      } = req.body;

      const capArr = toSafeArr(capabilities);
      const exArr = toSafeArr(exampleQuestions ?? example_questions);
      const kwArr = toSafeArr(triggerKeywords ?? trigger_keywords);
      const sp = systemPrompt ?? system_prompt;
      const pm = preferredModel ?? preferred_model;
      const mt = maxTokens ?? max_tokens;
      const pub = isPublic ?? is_public;

      const rows = await db.execute(sql`
        UPDATE pe_personas SET
          name               = COALESCE(${name ?? null}, name),
          description        = COALESCE(${description ?? null}, description),
          role               = COALESCE(${role ?? null}, role),
          system_prompt      = COALESCE(${sp ?? null}, system_prompt),
          tone               = COALESCE(${tone ?? null}, tone),
          domain             = COALESCE(${domain ?? null}, domain),
          avatar             = COALESCE(${avatar ?? null}, avatar),
          color              = COALESCE(${color ?? null}, color),
          is_public          = COALESCE(${pub ?? null}, is_public),
          preferred_model    = COALESCE(${pm ?? null}, preferred_model),
          temperature        = COALESCE(${temperature ?? null}, temperature),
          max_tokens         = COALESCE(${mt ?? null}, max_tokens),
          capabilities       = CASE WHEN ${capArr} IS NOT NULL THEN ${capArr}::text[] ELSE capabilities END,
          example_questions  = CASE WHEN ${exArr} IS NOT NULL THEN ${exArr}::text[] ELSE example_questions END,
          trigger_keywords   = CASE WHEN ${kwArr} IS NOT NULL THEN ${kwArr}::text[] ELSE trigger_keywords END,
          updated_at         = NOW()
        WHERE id = ${id}
        RETURNING *
      `);
      if (!rows.rows.length) return res.status(404).json({ error: "Agente não encontrado" });
      res.json(rows.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Criar agente customizado
  app.post("/api/prompt-engine/agents", async (req: Request, res: Response) => {
    if (!guard(req, res)) return;
    try {
      const tenantId = String(req.tenantId ?? 1);
      const toSafeArr = (arr: any) => {
        if (!Array.isArray(arr) || !arr.length) return null;
        return `{${arr.map((s: string) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")}}`;
      };
      const { name, description, role, systemPrompt, tone, domain, avatar, color,
              capabilities, exampleQuestions, preferredModel, temperature, maxTokens } = req.body;
      const capArr = toSafeArr(capabilities);
      const exArr = toSafeArr(exampleQuestions);
      const rows = await db.execute(sql`
        INSERT INTO pe_personas (
          tenant_id, user_id, name, description, role, system_prompt,
          tone, domain, avatar, color, is_public, scope, is_builtin,
          preferred_model, temperature, max_tokens, capabilities, example_questions
        ) VALUES (
          ${tenantId}, ${req.user!.id}, ${name}, ${description ?? null}, ${role ?? null},
          ${systemPrompt ?? null}, ${tone ?? null}, ${domain ?? null},
          ${avatar ?? "🤖"}, ${color ?? "#6366f1"}, false, 'tenant', false,
          ${preferredModel ?? "manus:chat"}, ${temperature ?? 0.3}, ${maxTokens ?? 2000},
          ${capArr}::text[], ${exArr}::text[]
        ) RETURNING *
      `);
      res.json(rows.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Excluir agente customizado
  app.delete("/api/prompt-engine/agents/:id", async (req: Request, res: Response) => {
    if (!guard(req, res)) return;
    try {
      const tenantId = String(req.tenantId ?? 1);
      // Não permite excluir builtin
      await db.execute(sql`
        DELETE FROM pe_personas
        WHERE id = ${req.params.id}
          AND (is_builtin IS NULL OR is_builtin = false)
          AND tenant_id = ${tenantId}
      `);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Mapeamento de preferred_model → SuiteTaskType Manus ────────────────
  const MANUS_TASK_MAP: Record<string, string> = {
    "manus:chat":     "manus:agents",
    "manus:analysis": "manus:agents",
    "manus:research": "manus:agents",
    "manus:agents":   "manus:agents",
    "manus:code":     "manus:agents",
    "fast":           "manus:chat",
    "precise":        "manus:agents",
    "research":       "manus:agents",
  };
  const resolveManusTask = (preferred: string | null): string => {
    if (!preferred) return "manus:agents";
    return MANUS_TASK_MAP[preferred] ?? "manus:agents";
  };

  // Invocar agente (POST — suporta histórico, arquivos e multimodal)
  app.post("/api/prompt-engine/agents/:slug/invoke", async (req: Request, res: Response) => {
    if (!guard(req, res)) return;
    try {
      const { message, history = [], files = [] } = req.body;
      if (!message?.trim()) return res.status(400).json({ error: "Mensagem obrigatória" });

      // Busca por slug OU por id
      const rows = await db.execute(sql`
        SELECT system_prompt, name, preferred_model, temperature, max_tokens
        FROM pe_personas WHERE slug = ${req.params.slug} OR id = ${req.params.slug}
        LIMIT 1
      `);
      if (!rows.rows.length) return res.status(404).json({ error: "Agente não encontrado" });

      const agent = rows.rows[0] as any;
      const started = Date.now();
      const taskType = resolveManusTask(agent.preferred_model) as any;

      // ── Montar conteúdo do usuário (multimodal se houver arquivos) ──────────
      let userContent: any = message;
      if (files && files.length > 0) {
        const parts: any[] = [];
        let textMsg = message;

        for (const f of files) {
          if (f.mimeType?.startsWith('image/') && f.data) {
            // Adiciona texto antes das imagens
            if (!parts.find((p: any) => p.type === 'text')) {
              parts.push({ type: 'text', text: textMsg });
            }
            parts.push({ type: 'image_url', image_url: { url: `data:${f.mimeType};base64,${f.data}`, detail: 'auto' } });
          } else if (f.textContent) {
            textMsg = `[Arquivo: ${f.name}]\n\`\`\`\n${String(f.textContent).slice(0, 12000)}\n\`\`\`\n\n${message}`;
          }
        }

        if (parts.length > 0) {
          // garante que o texto seja o primeiro elemento
          if (!parts.find((p: any) => p.type === 'text')) parts.unshift({ type: 'text', text: textMsg });
          userContent = parts;
        } else {
          userContent = textMsg;
        }
      }

      const messages: any[] = [
        { role: "system", content: agent.system_prompt },
        ...history.slice(-20).map((m: any) => ({ role: m.role, content: m.content })),
        { role: "user", content: userContent },
      ];

      const result = await orchestrate({
        taskType,
        messages,
        maxTokens: agent.max_tokens || 4000,
        temperature: parseFloat(agent.temperature) || 0.2,
      });

      res.json({
        output: result.text,
        agentName: agent.name,
        taskType,
        durationMs: Date.now() - started,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Salvar conversa de agente
  app.post("/api/prompt-engine/agents/:slug/chats", async (req: Request, res: Response) => {
    if (!guard(req, res)) return;
    try {
      const tenantId = String(req.tenantId ?? 1);
      const { messages, title } = req.body;
      const [row] = await db.insert(peAgentChats).values({
        personaSlug: req.params.slug,
        tenantId,
        userId: req.user!.id,
        messages: messages || [],
        title: title || "Conversa sem título",
      }).returning();
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Listar conversas de um agente
  app.get("/api/prompt-engine/agents/:slug/chats", async (req: Request, res: Response) => {
    if (!guard(req, res)) return;
    try {
      const tenantId = String(req.tenantId ?? 1);
      const rows = await db.select().from(peAgentChats)
        .where(and(eq(peAgentChats.personaSlug, req.params.slug), eq(peAgentChats.tenantId, tenantId)))
        .orderBy(desc(peAgentChats.updatedAt))
        .limit(30);
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Atualizar conversa
  app.put("/api/prompt-engine/agents/chats/:chatId", async (req: Request, res: Response) => {
    if (!guard(req, res)) return;
    try {
      const [row] = await db.update(peAgentChats)
        .set({ messages: req.body.messages, title: req.body.title, updatedAt: new Date() })
        .where(eq(peAgentChats.id, req.params.chatId))
        .returning();
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Excluir conversa
  app.delete("/api/prompt-engine/agents/chats/:chatId", async (req: Request, res: Response) => {
    if (!guard(req, res)) return;
    try {
      await db.delete(peAgentChats).where(eq(peAgentChats.id, req.params.chatId));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PERSONAS (manuais do tenant)
  // ═══════════════════════════════════════════════════════════════════════
  app.get("/api/prompt-engine/personas", async (req: Request, res: Response) => {
    if (!guard(req, res)) return;
    try {
      const tenantId = String(req.tenantId ?? 1);
      const rows = await db.execute(sql`
        SELECT * FROM pe_personas
        WHERE tenant_id = ${tenantId} AND (is_builtin IS NULL OR is_builtin = false)
        ORDER BY created_at DESC
      `);
      res.json(rows.rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/prompt-engine/personas", async (req: Request, res: Response) => {
    if (!guard(req, res)) return;
    try {
      const tenantId = String(req.tenantId ?? 1);
      const [row] = await db.insert(pePersonas).values({ ...req.body, tenantId, userId: req.user!.id }).returning();
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.put("/api/prompt-engine/personas/:id", async (req: Request, res: Response) => {
    if (!guard(req, res)) return;
    try {
      const tenantId = String(req.tenantId ?? 1);
      const [row] = await db.update(pePersonas)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(eq(pePersonas.id, req.params.id), eq(pePersonas.tenantId, tenantId)))
        .returning();
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/prompt-engine/personas/:id", async (req: Request, res: Response) => {
    if (!guard(req, res)) return;
    try {
      const tenantId = String(req.tenantId ?? 1);
      await db.delete(pePersonas).where(and(eq(pePersonas.id, req.params.id), eq(pePersonas.tenantId, tenantId)));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PROMPTS
  // ═══════════════════════════════════════════════════════════════════════
  app.get("/api/prompt-engine/prompts", async (req: Request, res: Response) => {
    if (!guard(req, res)) return;
    try {
      const tenantId = String(req.tenantId ?? 1);
      const rows = await db.select().from(pePrompts).where(eq(pePrompts.tenantId, tenantId)).orderBy(desc(pePrompts.updatedAt));
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/prompt-engine/prompts/:id", async (req: Request, res: Response) => {
    if (!guard(req, res)) return;
    try {
      const tenantId = String(req.tenantId ?? 1);
      const [row] = await db.select().from(pePrompts).where(and(eq(pePrompts.id, req.params.id), eq(pePrompts.tenantId, tenantId)));
      if (!row) return res.status(404).json({ error: "Não encontrado" });
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/prompt-engine/prompts", async (req: Request, res: Response) => {
    if (!guard(req, res)) return;
    try {
      const tenantId = String(req.tenantId ?? 1);
      const { gates, score } = evaluateGates(req.body);
      const compiledPrompt = compilePrompt(req.body);
      const [row] = await db.insert(pePrompts).values({ ...req.body, tenantId, userId: req.user!.id, gates, gateScore: score, compiledPrompt }).returning();
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.put("/api/prompt-engine/prompts/:id", async (req: Request, res: Response) => {
    if (!guard(req, res)) return;
    try {
      const tenantId = String(req.tenantId ?? 1);
      const { gates, score } = evaluateGates(req.body);
      const compiledPrompt = compilePrompt(req.body);
      const [row] = await db.update(pePrompts)
        .set({ ...req.body, gates, gateScore: score, compiledPrompt, updatedAt: new Date() })
        .where(and(eq(pePrompts.id, req.params.id), eq(pePrompts.tenantId, tenantId)))
        .returning();
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/prompt-engine/prompts/:id", async (req: Request, res: Response) => {
    if (!guard(req, res)) return;
    try {
      const tenantId = String(req.tenantId ?? 1);
      await db.delete(pePrompts).where(and(eq(pePrompts.id, req.params.id), eq(pePrompts.tenantId, tenantId)));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/prompt-engine/compile", (req: Request, res: Response) => {
    if (!guard(req, res)) return;
    try {
      const { promptData, variables } = req.body;
      const compiled = compilePrompt(promptData, variables);
      const { gates, score } = evaluateGates(promptData);
      res.json({ compiled, gates, score });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/prompt-engine/prompts/:id/execute", async (req: Request, res: Response) => {
    if (!guard(req, res)) return;
    try {
      const tenantId = String(req.tenantId ?? 1);
      const [prompt] = await db.select().from(pePrompts).where(and(eq(pePrompts.id, req.params.id), eq(pePrompts.tenantId, tenantId)));
      if (!prompt) return res.status(404).json({ error: "Prompt não encontrado" });
      const { variables, userMessage } = req.body;
      let personaData: any = null;
      if (prompt.personaId) {
        const [p] = await db.select().from(pePersonas).where(eq(pePersonas.id, prompt.personaId));
        personaData = p;
      }
      const compiled = compilePrompt({ ...prompt, persona: personaData }, variables);
      const started = Date.now();
      const result = await orchestrate({ taskType: "manus:chat", messages: [{ role: "system", content: compiled }, { role: "user", content: userMessage || "Execute conforme as instruções acima." }], maxTokens: 2000, temperature: 0.3 });
      const durationMs = Date.now() - started;
      const [exec] = await db.insert(peExecutions).values({ promptId: prompt.id, userId: req.user!.id, inputVariables: variables, compiledPrompt: compiled, output: result.text, durationMs, status: "completed" }).returning();
      await db.execute(sql`UPDATE pe_prompts SET usage_count = usage_count + 1 WHERE id = ${prompt.id}`);
      res.json({ output: result.text, executionId: exec.id, durationMs, compiledPrompt: compiled });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/prompt-engine/test", async (req: Request, res: Response) => {
    if (!guard(req, res)) return;
    try {
      const { promptData, variables, userMessage } = req.body;
      const compiled = compilePrompt(promptData, variables);
      const started = Date.now();
      const result = await orchestrate({ taskType: "manus:chat", messages: [{ role: "system", content: compiled }, { role: "user", content: userMessage || "Execute conforme as instruções acima." }], maxTokens: 2000, temperature: 0.3 });
      res.json({ output: result.text, durationMs: Date.now() - started, compiledPrompt: compiled });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // TEMPLATES
  // ═══════════════════════════════════════════════════════════════════════
  app.get("/api/prompt-engine/templates", async (req: Request, res: Response) => {
    if (!guard(req, res)) return;
    try {
      const tenantId = String(req.tenantId ?? 1);
      const rows = await db.select().from(peTemplates).where(or(eq(peTemplates.isSystem, true), eq(peTemplates.tenantId, tenantId)));
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // EXECUTIONS
  // ═══════════════════════════════════════════════════════════════════════
  app.get("/api/prompt-engine/prompts/:id/executions", async (req: Request, res: Response) => {
    if (!guard(req, res)) return;
    try {
      const rows = await db.select().from(peExecutions).where(eq(peExecutions.promptId, req.params.id)).orderBy(desc(peExecutions.createdAt)).limit(20);
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  console.log("[prompt-engine] Rotas registradas em /api/prompt-engine/*");
}
