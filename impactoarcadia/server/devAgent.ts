import { Router } from "express";
import { manusService } from "./manus/service";
import { db } from "../db/index";
import { sql } from "drizzle-orm";

const router = Router();

const DEV_AGENT_CONTEXT = `CONTEXTO ESPECIAL - DEV AGENT:
Você está operando como Dev Agent, o assistente de desenvolvimento low-code do Arcádia Suite.

Você pode criar diretamente no sistema:
1. DocTypes - Entidades de dados com campos, validações e relacionamentos
2. Páginas - Interfaces visuais com componentes e layouts
3. Workflows - Automações com gatilhos, ações e condições
4. Scripts - Código customizado para validações e eventos
5. Dashboards - Painéis com KPIs, gráficos e tabelas
6. Relatórios - Relatórios personalizados com filtros

Quando o usuário pedir para criar algo, você deve:
1. Entender exatamente o que ele precisa
2. Gerar a estrutura JSON/código necessário
3. Explicar o que foi criado

Para DocTypes, gere JSON no formato (envolto em \`\`\`json e \`\`\`):
{
  "action": "create_doctype",
  "data": {
    "name": "nome_snake_case",
    "label": "Nome Exibição",
    "module": "Módulo",
    "description": "Descrição",
    "icon": "icon-name",
    "fields": [
      { "name": "campo", "label": "Campo", "fieldType": "Data|Link|Select|Text|Int|Currency|Date|Datetime|Check", "required": true/false, "options": "opções se Select" }
    ]
  }
}

Para Páginas, gere JSON no formato:
{
  "action": "create_page",
  "data": {
    "name": "nome-da-pagina",
    "title": "Título da Página",
    "route": "/rota",
    "layout": "list|form|dashboard|report",
    "components": [...]
  }
}

Para Workflows, gere JSON no formato:
{
  "action": "create_workflow",
  "data": {
    "name": "Nome do Workflow",
    "description": "Descrição",
    "nodes": [
      { "type": "trigger|action|condition", "name": "Nome", "config": {...} }
    ]
  }
}

Sempre responda em português brasileiro de forma amigável e profissional.
Inclua o JSON de ação quando for criar algo, precedido por \`\`\`json e seguido por \`\`\`.`;

router.post("/chat", async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    const userId = (req as any).user?.id || "dev-admin-001";

    const fullPrompt = `${DEV_AGENT_CONTEXT}

Histórico da conversa:
${history.map((m: any) => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`).join('\n')}

Usuário: ${message}

Responda como Dev Agent, criando os recursos solicitados:`;

    const result = await manusService.run(userId, 1, fullPrompt, []);
    
    const responseContent = result.finalResponse || "Desculpe, não consegui processar sua solicitação.";

    const jsonMatch = responseContent.match(/```json\s*([\s\S]*?)\s*```/);
    let action = null;
    let actionResult = null;

    if (jsonMatch) {
      try {
        const actionData = JSON.parse(jsonMatch[1]);
        
        if (actionData.action === "create_doctype" && actionData.data) {
          const doctype = actionData.data;
          const result = await db.execute(sql`
            INSERT INTO arc_doctypes (name, label, module, description, icon, status, created_at, updated_at)
            VALUES (${doctype.name}, ${doctype.label}, ${doctype.module || 'Custom'}, ${doctype.description}, ${doctype.icon || 'file'}, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id
          `);
          
          const doctypeId = (result.rows[0] as any).id;

          if (doctype.fields && Array.isArray(doctype.fields)) {
            for (let i = 0; i < doctype.fields.length; i++) {
              const field = doctype.fields[i];
              await db.execute(sql`
                INSERT INTO arc_fields (doctype_id, name, label, field_type, required, options, sort_order, created_at)
                VALUES (${doctypeId}, ${field.name}, ${field.label}, ${field.fieldType || 'Data'}, ${field.required || false}, ${field.options || null}, ${i}, CURRENT_TIMESTAMP)
              `);
            }
          }

          action = { type: "create_doctype", status: "completed" };
          actionResult = { id: doctypeId, name: doctype.name, fieldsCount: doctype.fields?.length || 0 };
        }

        if (actionData.action === "create_page" && actionData.data) {
          const page = actionData.data;
          const result = await db.execute(sql`
            INSERT INTO arc_pages (name, title, route, page_type, config, status, created_at, updated_at)
            VALUES (${page.name}, ${page.title}, ${page.route}, ${page.layout || 'custom'}, ${JSON.stringify(page.components || [])}, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id
          `);

          action = { type: "create_page", status: "completed" };
          actionResult = { id: (result.rows[0] as any).id, name: page.name, route: page.route };
        }

        if (actionData.action === "create_workflow" && actionData.data) {
          const workflow = actionData.data;
          const result = await db.execute(sql`
            INSERT INTO arc_workflows (name, description, nodes, status, created_at, updated_at)
            VALUES (${workflow.name}, ${workflow.description}, ${JSON.stringify(workflow.nodes || [])}, 'draft', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id
          `);

          action = { type: "create_workflow", status: "completed" };
          actionResult = { id: (result.rows[0] as any).id, name: workflow.name, nodesCount: workflow.nodes?.length || 0 };
        }

      } catch (parseError) {
        console.error("Error parsing/executing action:", parseError);
        action = { type: "unknown", status: "failed" };
      }
    }

    res.json({
      response: responseContent.replace(/```json[\s\S]*?```/g, '').trim(),
      action: action ? { ...action, result: actionResult } : null
    });

  } catch (error) {
    console.error("Dev Agent error:", error);
    res.status(500).json({ 
      error: "Failed to process request",
      response: "Desculpe, ocorreu um erro ao processar sua solicitação. Tente novamente."
    });
  }
});

router.post("/generate-code", async (req, res) => {
  try {
    const { type, specification } = req.body;
    const userId = (req as any).user?.id || "dev-admin-001";

    const prompts: Record<string, string> = {
      doctype: `Gere um DocType completo baseado nesta especificação: ${specification}. Retorne apenas o JSON válido.`,
      page: `Gere uma página React/TSX baseada nesta especificação: ${specification}. Retorne código completo.`,
      script: `Gere um script de validação/evento baseado nesta especificação: ${specification}. Retorne código JavaScript.`,
      workflow: `Gere um workflow de automação baseado nesta especificação: ${specification}. Retorne o JSON com nodes.`
    };

    const result = await manusService.run(userId, 1, prompts[type] || specification, []);

    res.json({
      code: result.finalResponse || "",
      type
    });

  } catch (error) {
    console.error("Code generation error:", error);
    res.status(500).json({ error: "Failed to generate code" });
  }
});

export default router;
