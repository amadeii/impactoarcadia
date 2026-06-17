import { BaseTool, ToolParameter, ToolResult } from "./BaseTool";
import { metasetClient } from "../../metaset/client";

export class MetaSetQueryTool extends BaseTool {
  name = "metaset.query";
  description = "Executa uma consulta SQL no motor de BI e retorna os resultados. Use para análises, relatórios e extração de dados.";
  category = "bi";
  parameters: ToolParameter[] = [
    { name: "query", type: "string", description: "Consulta SQL (apenas SELECT)", required: true },
    { name: "limit", type: "number", description: "Limite de linhas (padrão: 100)", required: false },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const result = await metasetClient.runNativeQuery(params.query, params.limit || 100);
      const preview = result.rows.slice(0, 20).map(row => {
        const obj: Record<string, any> = {};
        result.columns.forEach((col, i) => { obj[col] = row[i]; });
        return obj;
      });
      return this.formatSuccess(
        `Consulta executada: ${result.rowCount} linhas, ${result.columns.length} colunas.\n\nColunas: ${result.columns.join(", ")}\n\nPrimeiras ${Math.min(20, preview.length)} linhas:\n${JSON.stringify(preview, null, 2)}`,
        { columns: result.columns, rows: result.rows, rowCount: result.rowCount }
      );
    } catch (err: any) {
      return this.formatError(`Erro na consulta: ${err.message}`);
    }
  }
}

export class MetaSetListTablesTool extends BaseTool {
  name = "metaset.list_tables";
  description = "Lista todas as tabelas disponíveis no banco de dados para análise de BI.";
  category = "bi";
  parameters: ToolParameter[] = [];

  async execute(): Promise<ToolResult> {
    try {
      const tables = await metasetClient.getTables();
      const summary = tables.map(t => `- ${t.name} (${t.schema})`).join("\n");
      return this.formatSuccess(
        `${tables.length} tabelas disponíveis:\n${summary}`,
        tables
      );
    } catch (err: any) {
      return this.formatError(`Erro ao listar tabelas: ${err.message}`);
    }
  }
}

export class MetaSetTableFieldsTool extends BaseTool {
  name = "metaset.table_fields";
  description = "Obtém as colunas e tipos de uma tabela específica para planejar consultas e análises.";
  category = "bi";
  parameters: ToolParameter[] = [
    { name: "tableId", type: "number", description: "ID da tabela (use metaset.list_tables para obter)", required: true },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const fields = await metasetClient.getTableFields(params.tableId);
      const summary = fields.map(f => `- ${f.name} (${f.type})`).join("\n");
      return this.formatSuccess(
        `${fields.length} colunas:\n${summary}`,
        fields
      );
    } catch (err: any) {
      return this.formatError(`Erro ao obter campos: ${err.message}`);
    }
  }
}

export class MetaSetCreateQuestionTool extends BaseTool {
  name = "metaset.create_question";
  description = "Cria uma pergunta/consulta persistente no motor de BI. A pergunta fica salva e pode ser adicionada a dashboards.";
  category = "bi";
  parameters: ToolParameter[] = [
    { name: "name", type: "string", description: "Nome da pergunta/consulta", required: true },
    { name: "query", type: "string", description: "Consulta SQL da pergunta", required: true },
    { name: "chartType", type: "string", description: "Tipo de visualização: table, bar, line, pie, area, scatter, row, scalar", required: false },
    { name: "description", type: "string", description: "Descrição da pergunta", required: false },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const question = await metasetClient.createQuestion({
        name: params.name,
        description: params.description,
        queryType: "native",
        query: params.query,
        chartType: params.chartType || "table",
      });
      return this.formatSuccess(
        `Pergunta criada: "${question.name}" (ID: ${question.id}). Use metaset.run_question para executar ou metaset.add_to_dashboard para adicionar a um dashboard.`,
        question
      );
    } catch (err: any) {
      return this.formatError(`Erro ao criar pergunta: ${err.message}`);
    }
  }
}

export class MetaSetRunQuestionTool extends BaseTool {
  name = "metaset.run_question";
  description = "Executa uma pergunta salva no motor de BI e retorna os resultados atualizados.";
  category = "bi";
  parameters: ToolParameter[] = [
    { name: "questionId", type: "number", description: "ID da pergunta a executar", required: true },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const result = await metasetClient.runQuestion(params.questionId);
      const preview = result.rows.slice(0, 20).map(row => {
        const obj: Record<string, any> = {};
        result.columns.forEach((col, i) => { obj[col] = row[i]; });
        return obj;
      });
      return this.formatSuccess(
        `Resultados: ${result.rowCount} linhas\nColunas: ${result.columns.join(", ")}\n\n${JSON.stringify(preview, null, 2)}`,
        { columns: result.columns, rows: result.rows, rowCount: result.rowCount }
      );
    } catch (err: any) {
      return this.formatError(`Erro ao executar pergunta: ${err.message}`);
    }
  }
}

export class MetaSetListQuestionsTool extends BaseTool {
  name = "metaset.list_questions";
  description = "Lista todas as perguntas/consultas salvas no motor de BI.";
  category = "bi";
  parameters: ToolParameter[] = [];

  async execute(): Promise<ToolResult> {
    try {
      const questions = await metasetClient.listQuestions();
      if (questions.length === 0) {
        return this.formatSuccess("Nenhuma pergunta criada ainda. Use metaset.create_question para criar.", []);
      }
      const summary = questions.map(q => `- [${q.id}] "${q.name}" (${q.display}) - ${q.description || "sem descrição"}`).join("\n");
      return this.formatSuccess(`${questions.length} perguntas:\n${summary}`, questions);
    } catch (err: any) {
      return this.formatError(`Erro ao listar perguntas: ${err.message}`);
    }
  }
}

export class MetaSetCreateDashboardTool extends BaseTool {
  name = "metaset.create_dashboard";
  description = "Cria um novo dashboard no motor de BI para organizar perguntas e gráficos.";
  category = "bi";
  parameters: ToolParameter[] = [
    { name: "name", type: "string", description: "Nome do dashboard", required: true },
    { name: "description", type: "string", description: "Descrição do dashboard", required: false },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const dashboard = await metasetClient.createDashboard({
        name: params.name,
        description: params.description,
      });
      return this.formatSuccess(
        `Dashboard criado: "${dashboard.name}" (ID: ${dashboard.id}). Use metaset.add_to_dashboard para adicionar perguntas.`,
        dashboard
      );
    } catch (err: any) {
      return this.formatError(`Erro ao criar dashboard: ${err.message}`);
    }
  }
}

export class MetaSetListDashboardsTool extends BaseTool {
  name = "metaset.list_dashboards";
  description = "Lista todos os dashboards do motor de BI.";
  category = "bi";
  parameters: ToolParameter[] = [];

  async execute(): Promise<ToolResult> {
    try {
      const dashboards = await metasetClient.listDashboards();
      if (dashboards.length === 0) {
        return this.formatSuccess("Nenhum dashboard criado ainda. Use metaset.create_dashboard para criar.", []);
      }
      const summary = dashboards.map(d => `- [${d.id}] "${d.name}" - ${d.description || "sem descrição"}`).join("\n");
      return this.formatSuccess(`${dashboards.length} dashboards:\n${summary}`, dashboards);
    } catch (err: any) {
      return this.formatError(`Erro ao listar dashboards: ${err.message}`);
    }
  }
}

export class MetaSetAddToDashboardTool extends BaseTool {
  name = "metaset.add_to_dashboard";
  description = "Adiciona uma pergunta/gráfico a um dashboard existente.";
  category = "bi";
  parameters: ToolParameter[] = [
    { name: "dashboardId", type: "number", description: "ID do dashboard", required: true },
    { name: "questionId", type: "number", description: "ID da pergunta a adicionar", required: true },
    { name: "x", type: "number", description: "Posição X no grid (padrão: 0)", required: false },
    { name: "y", type: "number", description: "Posição Y no grid (padrão: 0)", required: false },
    { name: "width", type: "number", description: "Largura no grid (padrão: 6)", required: false },
    { name: "height", type: "number", description: "Altura no grid (padrão: 4)", required: false },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      await metasetClient.addQuestionToDashboard(
        params.dashboardId,
        params.questionId,
        {
          x: params.x || 0,
          y: params.y || 0,
          w: params.width || 6,
          h: params.height || 4,
        }
      );
      return this.formatSuccess(
        `Pergunta ${params.questionId} adicionada ao dashboard ${params.dashboardId}.`
      );
    } catch (err: any) {
      return this.formatError(`Erro ao adicionar ao dashboard: ${err.message}`);
    }
  }
}

export class MetaSetSuggestAnalysisTool extends BaseTool {
  name = "metaset.suggest_analysis";
  description = "Sugere consultas e tipos de gráfico para uma tabela baseado em sua estrutura de dados. Ideal para descoberta de insights.";
  category = "bi";
  parameters: ToolParameter[] = [
    { name: "tableName", type: "string", description: "Nome da tabela para analisar", required: true },
  ];

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      const suggestions = await metasetClient.getAutoSuggestions(params.tableName);
      return this.formatSuccess(
        `Sugestões para tabela "${params.tableName}":\n\nGráficos recomendados: ${suggestions.suggestedCharts.join(", ")}\n\nConsultas sugeridas:\n${suggestions.suggestedQueries.map((q, i) => `${i + 1}. ${q}`).join("\n")}`,
        suggestions
      );
    } catch (err: any) {
      return this.formatError(`Erro ao sugerir análises: ${err.message}`);
    }
  }
}

export class MetaSetSyncTool extends BaseTool {
  name = "metaset.sync_database";
  description = "Sincroniza o schema do banco de dados com o motor de BI. Use após criar novas tabelas.";
  category = "bi";
  parameters: ToolParameter[] = [];

  async execute(): Promise<ToolResult> {
    try {
      await metasetClient.syncDatabase();
      return this.formatSuccess("Schema do banco sincronizado com o motor de BI.");
    } catch (err: any) {
      return this.formatError(`Erro ao sincronizar: ${err.message}`);
    }
  }
}

export class MetaSetHealthTool extends BaseTool {
  name = "metaset.health";
  description = "Verifica o status do motor de BI (MetaSet).";
  category = "bi";
  parameters: ToolParameter[] = [];

  async execute(): Promise<ToolResult> {
    try {
      const health = await metasetClient.isHealthy();
      if (health.online) {
        return this.formatSuccess(`Motor BI online (versão: ${health.version})`, health);
      }
      return this.formatError("Motor BI offline");
    } catch (err: any) {
      return this.formatError(`Erro ao verificar status: ${err.message}`);
    }
  }
}
