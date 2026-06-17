export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface ManusToolDef {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}

export const MANUS_TOOLS: ManusToolDef[] = [
  {
    name: "web_search",
    description: "Pesquisa informações na web usando um termo de busca. Retorna resultados relevantes.",
    parameters: {
      query: { type: "string", description: "O termo de busca", required: true }
    }
  },
  {
    name: "knowledge_query",
    description: "Consulta a base de conhecimento interna da empresa para encontrar documentos e informações relevantes.",
    parameters: {
      query: { type: "string", description: "A pergunta ou termo para buscar na base de conhecimento", required: true }
    }
  },
  {
    name: "erp_query",
    description: "Consulta dados do sistema ERP conectado (clientes, pedidos, estoque, financeiro).",
    parameters: {
      entity: { type: "string", description: "Entidade a consultar: customers, orders, inventory, financial", required: true },
      filter: { type: "string", description: "Filtro opcional (ex: 'status=active')", required: false }
    }
  },
  {
    name: "calculate",
    description: "Executa cálculos matemáticos e análises numéricas.",
    parameters: {
      expression: { type: "string", description: "Expressão matemática ou descrição do cálculo", required: true }
    }
  },
  {
    name: "send_message",
    description: "Envia uma mensagem para um usuário ou grupo no chat interno.",
    parameters: {
      to: { type: "string", description: "Nome ou ID do destinatário", required: true },
      message: { type: "string", description: "Conteúdo da mensagem", required: true }
    }
  },
  {
    name: "generate_report",
    description: "Gera um relatório estruturado com base nos dados coletados.",
    parameters: {
      title: { type: "string", description: "Título do relatório", required: true },
      type: { type: "string", description: "Tipo: summary, detailed, chart", required: true },
      data: { type: "string", description: "Dados ou descrição do conteúdo do relatório", required: true }
    }
  },
  {
    name: "schedule_task",
    description: "Agenda uma tarefa para execução futura.",
    parameters: {
      task: { type: "string", description: "Descrição da tarefa", required: true },
      when: { type: "string", description: "Quando executar (ex: 'tomorrow 9am', 'in 2 hours')", required: true }
    }
  },
  {
    name: "web_browse",
    description: "Acessa e extrai informações de uma página web. Use para consultar sites, ler artigos, ou obter dados online.",
    parameters: {
      url: { type: "string", description: "URL completa da página a acessar (ex: https://example.com)", required: true },
      extract: { type: "string", description: "O que extrair: 'text' (todo texto), 'summary' (resumo), 'links' (lista de links)", required: false }
    }
  },
  {
    name: "analyze_file",
    description: "Analisa o conteúdo de um arquivo anexado pelo usuário.",
    parameters: {
      filename: { type: "string", description: "Nome do arquivo anexado a analisar", required: true },
      question: { type: "string", description: "Pergunta específica sobre o conteúdo do arquivo", required: false }
    }
  },
  {
    name: "crm_query",
    description: "Consulta dados do CRM (parceiros, contratos, comissões, conversas). Use para buscar informações de relacionamento com clientes.",
    parameters: {
      entity: { type: "string", description: "Entidade a consultar: partners, contracts, threads, events, commissions, stats", required: true },
      filter: { type: "string", description: "Filtro opcional (ex: 'status=active', 'tier=gold')", required: false }
    }
  },
  {
    name: "crm_create_event",
    description: "Cria um evento no calendário CRM. Use para agendar reuniões, ligações ou lembretes.",
    parameters: {
      title: { type: "string", description: "Título do evento", required: true },
      type: { type: "string", description: "Tipo: meeting, call, task, reminder", required: true },
      startAt: { type: "string", description: "Data/hora de início (ISO 8601 ou descrição como 'amanhã às 14h')", required: true },
      description: { type: "string", description: "Descrição do evento", required: false }
    }
  },
  {
    name: "crm_send_whatsapp",
    description: "Envia uma mensagem WhatsApp para um contato através do canal CRM conectado.",
    parameters: {
      phone: { type: "string", description: "Número de telefone do destinatário (com DDD)", required: true },
      message: { type: "string", description: "Conteúdo da mensagem", required: true }
    }
  },
  {
    name: "generate_chart",
    description: "Gera um gráfico visual a partir de dados estruturados. O gráfico será renderizado na interface. Use esta ferramenta quando o usuário pedir um gráfico ou visualização.",
    parameters: {
      type: { type: "string", description: "Tipo do gráfico: 'bar' (barras), 'line' (linha), 'pie' (pizza), 'area' (área)", required: true },
      title: { type: "string", description: "Título do gráfico", required: true },
      data: { type: "string", description: "JSON array com os dados. Ex: [{\"name\":\"2023\",\"valor\":1000},{\"name\":\"2024\",\"valor\":1500}]", required: true },
      xKey: { type: "string", description: "Nome do campo para o eixo X (ex: 'name', 'ano', 'mes')", required: true },
      yKeys: { type: "string", description: "Nomes dos campos para o eixo Y separados por vírgula (ex: 'ativo,passivo' ou 'valor')", required: true },
      colors: { type: "string", description: "Cores para cada série separadas por vírgula (ex: '#4caf50,#f44336')", required: false }
    }
  },
  {
    name: "finish",
    description: "Finaliza a execução do agente com uma resposta final para o usuário.",
    parameters: {
      answer: { type: "string", description: "Resposta final para o usuário", required: true },
      chart: { type: "string", description: "JSON opcional com dados de gráfico gerado anteriormente", required: false }
    }
  },
  {
    name: "python_execute",
    description: "Executa código Python em um ambiente seguro. Use para cálculos complexos, análise de dados ou automações.",
    parameters: {
      code: { type: "string", description: "O código Python a ser executado", required: true },
      timeout: { type: "number", description: "Tempo limite em segundos (padrão: 30)", required: false }
    }
  },
  {
    name: "semantic_search",
    description: "Busca informações no grafo de conhecimento por significado semântico. Use para encontrar documentos, mensagens ou dados relacionados.",
    parameters: {
      query: { type: "string", description: "A pergunta ou termo para buscar semanticamente", required: true },
      n_results: { type: "number", description: "Número de resultados (padrão: 5)", required: false }
    }
  },
  {
    name: "read_file",
    description: "Lê o conteúdo de um arquivo do sistema.",
    parameters: {
      path: { type: "string", description: "Caminho do arquivo a ser lido", required: true }
    }
  },
  {
    name: "write_file",
    description: "Escreve conteúdo em um arquivo. Cria o arquivo se não existir.",
    parameters: {
      path: { type: "string", description: "Caminho do arquivo a ser escrito", required: true },
      content: { type: "string", description: "Conteúdo a ser escrito no arquivo", required: true }
    }
  },
  {
    name: "list_files",
    description: "Lista arquivos e diretórios em um caminho.",
    parameters: {
      path: { type: "string", description: "Caminho do diretório a listar", required: true }
    }
  },
  {
    name: "shell",
    description: "Executa um comando no terminal. Use com cuidado para comandos seguros.",
    parameters: {
      command: { type: "string", description: "Comando a ser executado", required: true }
    }
  },
  {
    name: "ask_human",
    description: "Pede aprovação do usuário para uma ação crítica antes de prosseguir.",
    parameters: {
      prompt: { type: "string", description: "Pergunta ou descrição da ação que precisa de aprovação", required: true },
      options: { type: "string", description: "Opções de resposta separadas por vírgula (ex: 'sim,não')", required: false }
    }
  },
  {
    name: "analyze_data",
    description: "Analisa um conjunto de dados usando o Módulo Cientista. Detecta padrões, gera insights e estatísticas.",
    parameters: {
      data: { type: "string", description: "Dados em formato JSON para análise", required: true }
    }
  },
  {
    name: "add_to_knowledge",
    description: "Adiciona um documento ao grafo de conhecimento para futuras buscas semânticas.",
    parameters: {
      doc_id: { type: "string", description: "ID único do documento", required: true },
      content: { type: "string", description: "Conteúdo do documento", required: true },
      type: { type: "string", description: "Tipo do documento: email, message, project, note, etc", required: true }
    }
  },
  {
    name: "run_workflow",
    description: "Executa um workflow BPMN automatizado. Use para processos com múltiplos passos, decisões e ações.",
    parameters: {
      workflow_type: { type: "string", description: "Tipo: approval, data_processing, notification ou spec JSON customizado", required: true },
      data: { type: "string", description: "Dados de entrada para o workflow em formato JSON", required: false }
    }
  },
  {
    name: "rpa_execute",
    description: "Executa automação RPA (robotic process automation) em navegador. Use para preencher formulários, extrair dados de sites, ou automatizar tarefas web.",
    parameters: {
      template: { type: "string", description: "Template: login, scrape_table, form_fill, download_report, nfe_consulta, ou script JSON customizado", required: true },
      params: { type: "string", description: "Parâmetros para o script RPA em formato JSON (ex: {\"url\": \"...\", \"username\": \"...\"})", required: false }
    }
  },
  {
    name: "fiscal_emit",
    description: "Emite documento fiscal (NFe, NFCe) através do Arcadia Plus ERP.",
    parameters: {
      type: { type: "string", description: "Tipo de documento: nfe (nota fiscal) ou nfce (cupom fiscal)", required: true },
      data: { type: "string", description: "Dados da nota fiscal em formato JSON (emitente, destinatario, itens, pagamento)", required: true }
    }
  },
  {
    name: "fiscal_query",
    description: "Consulta situação de documento fiscal no SEFAZ.",
    parameters: {
      chave: { type: "string", description: "Chave de acesso da NFe/NFCe (44 dígitos)", required: true }
    }
  },
  {
    name: "plus_clientes",
    description: "Consulta clientes cadastrados no Arcádia Plus ERP. Use para buscar informações de clientes, contatos, histórico.",
    parameters: {
      filtro: { type: "string", description: "Filtro de busca: nome, CPF/CNPJ, telefone ou email", required: false }
    }
  },
  {
    name: "plus_produtos",
    description: "Consulta produtos cadastrados no Arcádia Plus ERP. Use para verificar estoque, preços, códigos.",
    parameters: {
      filtro: { type: "string", description: "Filtro de busca: nome, código, categoria ou marca", required: false }
    }
  },
  {
    name: "plus_vendas",
    description: "Consulta vendas realizadas no Arcádia Plus ERP. Use para verificar pedidos, faturamento, histórico de vendas.",
    parameters: {
      filtro: { type: "string", description: "Filtro: periodo (hoje, semana, mes), cliente, status", required: false }
    }
  },
  {
    name: "plus_estoque",
    description: "Consulta situação do estoque no Arcádia Plus ERP. Use para verificar quantidades, produtos em falta, movimentações.",
    parameters: {}
  },
  {
    name: "plus_financeiro",
    description: "Consulta dados financeiros do Arcádia Plus ERP: contas a pagar, contas a receber, fluxo de caixa.",
    parameters: {
      tipo: { type: "string", description: "Tipo: pagar, receber, todos", required: false }
    }
  },
  {
    name: "plus_fornecedores",
    description: "Consulta fornecedores cadastrados no Arcádia Plus ERP.",
    parameters: {
      filtro: { type: "string", description: "Filtro de busca: nome, CNPJ, cidade", required: false }
    }
  },
  {
    name: "plus_dashboard",
    description: "Obtém dados do dashboard do Arcádia Plus ERP: resumo de vendas, estoque, financeiro.",
    parameters: {}
  },
  {
    name: "learn_url",
    description: "Aprende o conteúdo de uma URL e adiciona ao grafo de conhecimento. Use para absorver informações de artigos, documentações, notícias, etc.",
    parameters: {
      url: { type: "string", description: "A URL para aprender (ex: https://exemplo.com/artigo)", required: true },
      priority: { type: "string", description: "Prioridade do aprendizado: low, normal, high", required: false }
    }
  },
  {
    name: "deep_research",
    description: "Pesquisa profunda sobre um tema: busca na web, extrai conteúdo dos melhores resultados, analisa e sintetiza. Use quando precisar de informações completas sobre um assunto.",
    parameters: {
      topic: { type: "string", description: "O tema ou pergunta para pesquisar em profundidade", required: true },
      depth: { type: "number", description: "Quantidade de fontes para analisar (1-5). Padrão: 3", required: false }
    }
  },
  {
    name: "detect_opportunities",
    description: "Analisa o grafo de conhecimento para detectar padrões e oportunidades de negócio.",
    parameters: {
      domain: { type: "string", description: "Domínio de análise (ex: vendas, produto, suporte, clientes)", required: true },
      min_confidence: { type: "number", description: "Confiança mínima (0-1). Padrão: 0.7", required: false }
    }
  },
  {
    name: "scientist_generate_code",
    description: "Usa o Módulo Cientista para gerar código Python automaticamente baseado em um objetivo. Use para criar análises, transformações ou processamentos de dados.",
    parameters: {
      goal: { type: "string", description: "Objetivo do código (ex: 'agregar vendas por mês', 'filtrar clientes inativos', 'gerar relatório')", required: true },
      data_description: { type: "string", description: "Descrição dos dados de entrada (colunas, tipos)", required: false }
    }
  },
  {
    name: "scientist_generate_automation",
    description: "Gera código de automação para tarefas repetitivas como enviar emails, fazer requisições API, processar arquivos ou agendar tarefas.",
    parameters: {
      task: { type: "string", description: "Descrição da tarefa de automação (ex: 'enviar email de lembrete', 'buscar dados de API')", required: true }
    }
  },
  {
    name: "scientist_detect_patterns",
    description: "Detecta padrões, correlações e tendências em um conjunto de dados.",
    parameters: {
      data: { type: "string", description: "Dados em formato JSON para análise de padrões", required: true }
    }
  },
  {
    name: "scientist_suggest_improvements",
    description: "Analisa dados e sugere melhorias de qualidade, otimizações e correções automáticas.",
    parameters: {
      data: { type: "string", description: "Dados em formato JSON para análise de melhorias", required: true }
    }
  },
  {
    name: "bi_stats",
    description: "Obtém estatísticas do módulo de Business Intelligence (fontes de dados, datasets, gráficos, dashboards, backups).",
    parameters: {}
  },
  {
    name: "bi_list_data_sources",
    description: "Lista todas as fontes de dados configuradas no BI (PostgreSQL, MySQL, MongoDB).",
    parameters: {}
  },
  {
    name: "bi_create_data_source",
    description: "Cria uma nova fonte de dados para conectar o BI a um banco de dados externo.",
    parameters: {
      name: { type: "string", description: "Nome da fonte de dados", required: true },
      type: { type: "string", description: "Tipo: postgresql, mysql ou mongodb", required: true },
      host: { type: "string", description: "Host do servidor de banco de dados", required: true },
      port: { type: "number", description: "Porta do servidor", required: true },
      database: { type: "string", description: "Nome do banco de dados", required: true },
      username: { type: "string", description: "Usuário de acesso", required: true },
      password: { type: "string", description: "Senha de acesso", required: true }
    }
  },
  {
    name: "bi_list_datasets",
    description: "Lista todos os datasets (consultas salvas) configurados no BI.",
    parameters: {}
  },
  {
    name: "bi_create_dataset",
    description: "Cria um novo dataset (consulta SQL ou seleção de tabela) no BI.",
    parameters: {
      name: { type: "string", description: "Nome do dataset", required: true },
      type: { type: "string", description: "Tipo: sql (consulta SQL) ou table (tabela inteira)", required: true },
      dataSourceId: { type: "number", description: "ID da fonte de dados (use bi_list_data_sources para obter)", required: false },
      query: { type: "string", description: "Consulta SQL (para type=sql)", required: false },
      tableName: { type: "string", description: "Nome da tabela (para type=table)", required: false }
    }
  },
  {
    name: "bi_execute_query",
    description: "Executa um dataset e retorna os dados resultantes.",
    parameters: {
      datasetId: { type: "number", description: "ID do dataset a executar", required: true }
    }
  },
  {
    name: "bi_list_charts",
    description: "Lista todos os gráficos criados no BI.",
    parameters: {}
  },
  {
    name: "bi_create_chart",
    description: "Cria um novo gráfico no módulo de BI baseado em um dataset existente.",
    parameters: {
      name: { type: "string", description: "Nome do gráfico", required: true },
      type: { type: "string", description: "Tipo: bar, line, pie, area, scatter, table", required: true },
      datasetId: { type: "number", description: "ID do dataset fonte dos dados", required: true },
      config: { type: "string", description: "Configuração JSON: {xAxis, yAxis, groupBy, aggregation, colors}", required: true }
    }
  },
  {
    name: "bi_list_dashboards",
    description: "Lista todos os dashboards do BI.",
    parameters: {}
  },
  {
    name: "bi_create_dashboard",
    description: "Cria um novo dashboard no BI para organizar gráficos.",
    parameters: {
      name: { type: "string", description: "Nome do dashboard", required: true },
      description: { type: "string", description: "Descrição do dashboard", required: false }
    }
  },
  {
    name: "bi_add_chart_to_dashboard",
    description: "Adiciona um gráfico existente a um dashboard.",
    parameters: {
      dashboardId: { type: "number", description: "ID do dashboard", required: true },
      chartId: { type: "number", description: "ID do gráfico a adicionar", required: true },
      position: { type: "string", description: "Posição JSON: {x, y, width, height}", required: false }
    }
  },
  {
    name: "bi_list_tables",
    description: "Lista todas as tabelas disponíveis no banco de dados interno.",
    parameters: {}
  },
  {
    name: "bi_get_table_columns",
    description: "Obtém as colunas de uma tabela específica.",
    parameters: {
      tableName: { type: "string", description: "Nome da tabela", required: true }
    }
  },
  {
    name: "bi_analyze_with_pandas",
    description: "Analisa dados de um dataset usando Python/Pandas. Retorna estatísticas avançadas: média, mediana, desvio padrão, correlações, outliers, e sugestões de gráficos. Use para análises profundas de dados.",
    parameters: {
      datasetId: { type: "number", description: "ID do dataset a analisar (use bi_list_datasets para obter)", required: true },
      question: { type: "string", description: "Pergunta específica sobre os dados (opcional)", required: false }
    }
  },
  {
    name: "metaset_query",
    description: "Executa uma consulta SQL via motor de BI (MetaSet). Motor robusto para análises complexas, gráficos e dashboards. Retorna dados estruturados.",
    parameters: {
      query: { type: "string", description: "Consulta SQL (apenas SELECT)", required: true },
      limit: { type: "number", description: "Limite de linhas (padrão: 100)", required: false }
    }
  },
  {
    name: "metaset_create_question",
    description: "Cria uma pergunta/consulta persistente no motor de BI (MetaSet). A pergunta fica salva e pode ser adicionada a dashboards e visualizada como gráfico.",
    parameters: {
      name: { type: "string", description: "Nome da pergunta/consulta", required: true },
      query: { type: "string", description: "Consulta SQL da pergunta", required: true },
      chartType: { type: "string", description: "Tipo de visualização: table, bar, line, pie, area, scatter, row, scalar", required: false },
      description: { type: "string", description: "Descrição da pergunta", required: false }
    }
  },
  {
    name: "metaset_list_questions",
    description: "Lista todas as perguntas/consultas salvas no motor de BI (MetaSet).",
    parameters: {}
  },
  {
    name: "metaset_run_question",
    description: "Executa uma pergunta salva no motor de BI e retorna dados atualizados.",
    parameters: {
      questionId: { type: "number", description: "ID da pergunta a executar", required: true }
    }
  },
  {
    name: "metaset_create_dashboard",
    description: "Cria um novo dashboard no motor de BI (MetaSet) para organizar consultas e gráficos.",
    parameters: {
      name: { type: "string", description: "Nome do dashboard", required: true },
      description: { type: "string", description: "Descrição do dashboard", required: false }
    }
  },
  {
    name: "metaset_list_dashboards",
    description: "Lista todos os dashboards do motor de BI (MetaSet).",
    parameters: {}
  },
  {
    name: "metaset_add_to_dashboard",
    description: "Adiciona uma pergunta/gráfico a um dashboard no motor de BI.",
    parameters: {
      dashboardId: { type: "number", description: "ID do dashboard", required: true },
      questionId: { type: "number", description: "ID da pergunta a adicionar", required: true }
    }
  },
  {
    name: "metaset_suggest_analysis",
    description: "Sugere consultas e tipos de gráfico para uma tabela. Útil para descoberta automática de insights.",
    parameters: {
      tableName: { type: "string", description: "Nome da tabela para analisar", required: true }
    }
  },
  {
    name: "fin_query_payables",
    description: "Consulta contas a pagar do módulo Financeiro. Retorna lista de títulos com vencimentos, valores e status.",
    parameters: {
      status: { type: "string", description: "Filtro por status: pending, paid, overdue, cancelled (opcional)", required: false },
      supplier_id: { type: "number", description: "Filtro por ID do fornecedor (opcional)", required: false }
    }
  },
  {
    name: "fin_query_receivables",
    description: "Consulta contas a receber do módulo Financeiro. Retorna lista de títulos com vencimentos, valores e status.",
    parameters: {
      status: { type: "string", description: "Filtro por status: pending, received, overdue, cancelled (opcional)", required: false },
      customer_id: { type: "number", description: "Filtro por ID do cliente (opcional)", required: false }
    }
  },
  {
    name: "fin_query_bank_accounts",
    description: "Consulta contas bancárias e saldos do módulo Financeiro.",
    parameters: {
      active_only: { type: "boolean", description: "Retornar apenas contas ativas (padrão: true)", required: false }
    }
  },
  {
    name: "fin_query_cashflow",
    description: "Consulta fluxo de caixa (transações) do módulo Financeiro em um período.",
    parameters: {
      start_date: { type: "string", description: "Data inicial no formato YYYY-MM-DD", required: false },
      end_date: { type: "string", description: "Data final no formato YYYY-MM-DD", required: false },
      account_id: { type: "number", description: "Filtro por conta bancária (opcional)", required: false }
    }
  },
  {
    name: "fin_summary",
    description: "Obtém resumo financeiro: total a pagar, total a receber, saldo em contas, vencimentos próximos.",
    parameters: {}
  },
  {
    name: "fin_register_payable",
    description: "Registra uma nova conta a pagar no módulo Financeiro.",
    parameters: {
      supplier_id: { type: "number", description: "ID do fornecedor", required: true },
      description: { type: "string", description: "Descrição do título", required: true },
      amount: { type: "number", description: "Valor do título", required: true },
      due_date: { type: "string", description: "Data de vencimento (YYYY-MM-DD)", required: true },
      category_id: { type: "number", description: "ID da categoria de fluxo de caixa (opcional)", required: false }
    }
  },
  {
    name: "fin_register_receivable",
    description: "Registra uma nova conta a receber no módulo Financeiro.",
    parameters: {
      customer_id: { type: "number", description: "ID do cliente", required: true },
      description: { type: "string", description: "Descrição do título", required: true },
      amount: { type: "number", description: "Valor do título", required: true },
      due_date: { type: "string", description: "Data de vencimento (YYYY-MM-DD)", required: true },
      category_id: { type: "number", description: "ID da categoria de fluxo de caixa (opcional)", required: false }
    }
  },
  {
    name: "fin_pay_account",
    description: "Registra o pagamento de uma conta a pagar.",
    parameters: {
      payable_id: { type: "number", description: "ID da conta a pagar", required: true },
      bank_account_id: { type: "number", description: "ID da conta bancária de saída", required: true },
      payment_date: { type: "string", description: "Data do pagamento (YYYY-MM-DD)", required: false },
      amount_paid: { type: "number", description: "Valor pago (se diferente do valor original)", required: false }
    }
  },
  {
    name: "fin_receive_account",
    description: "Registra o recebimento de uma conta a receber.",
    parameters: {
      receivable_id: { type: "number", description: "ID da conta a receber", required: true },
      bank_account_id: { type: "number", description: "ID da conta bancária de entrada", required: true },
      receive_date: { type: "string", description: "Data do recebimento (YYYY-MM-DD)", required: false },
      amount_received: { type: "number", description: "Valor recebido (se diferente do valor original)", required: false }
    }
  },
  {
    name: "call_agent",
    description: "Envia uma mensagem para outro agente de IA externo via protocolo A2A. Use para delegar tarefas especializadas, consultar agentes especializados ou orquestrar múltiplos agentes.",
    parameters: {
      agent_id: { type: "string", description: "ID do agente a chamar (use list_agents para ver disponíveis)", required: true },
      message: { type: "string", description: "Mensagem/pergunta a enviar ao agente", required: true },
      wait_response: { type: "boolean", description: "Aguardar resposta completa (padrão: true)", required: false }
    }
  },
  {
    name: "list_agents",
    description: "Lista todos os agentes de IA externos registrados e disponíveis para comunicação via A2A.",
    parameters: {}
  },
  {
    name: "register_agent",
    description: "Registra um novo agente externo para comunicação. Descobre automaticamente o Agent Card do agente.",
    parameters: {
      name: { type: "string", description: "Nome amigável para o agente", required: true },
      url: { type: "string", description: "URL base do agente (ex: https://agent.exemplo.com)", required: true },
      api_key: { type: "string", description: "API Key para autenticação (se necessário)", required: false }
    }
  },
  {
    name: "discover_agent",
    description: "Descobre as capacidades de um agente externo lendo seu Agent Card. Use para saber o que um agente pode fazer antes de chamá-lo.",
    parameters: {
      url: { type: "string", description: "URL base do agente para descoberta", required: true }
    }
  },
  {
    name: "export_to_excel",
    description: "Exporta dados para um arquivo Excel (.xlsx). Retorna o caminho do arquivo gerado para download. Use quando o usuário pedir para exportar dados, gerar planilha ou criar Excel.",
    parameters: {
      data: { type: "string", description: "Dados em formato JSON array para exportar (ex: [{\"coluna1\":\"valor1\"}])", required: true },
      filename: { type: "string", description: "Nome do arquivo sem extensão (ex: 'relatorio-vendas')", required: true },
      sheet_name: { type: "string", description: "Nome da aba/planilha (padrão: 'Dados')", required: false }
    }
  },
  {
    name: "send_to_bi_dataset",
    description: "Envia dados para criar ou atualizar um dataset no módulo de BI (Arcádia Insights). Os dados ficam disponíveis para criar gráficos e dashboards.",
    parameters: {
      name: { type: "string", description: "Nome do dataset no BI", required: true },
      data: { type: "string", description: "Dados em formato JSON array para o dataset", required: true },
      description: { type: "string", description: "Descrição do dataset (opcional)", required: false },
      update_if_exists: { type: "boolean", description: "Atualizar se já existir (padrão: true)", required: false }
    }
  },
  {
    name: "market_research",
    description: "Faz pesquisa de mercado sobre um setor, concorrentes ou tendências. Busca dados comparativos, benchmarks do setor e informações competitivas.",
    parameters: {
      topic: { type: "string", description: "O tema da pesquisa (ex: 'concorrentes no setor de logística', 'benchmarks de margem de lucro varejo')", required: true },
      company_context: { type: "string", description: "Contexto da empresa para comparação (setor, tamanho, região)", required: false },
      focus: { type: "string", description: "Foco da pesquisa: competitors, benchmarks, trends, all (padrão: all)", required: false }
    }
  },
  {
    name: "compare_with_market",
    description: "Compara dados financeiros ou operacionais da empresa com benchmarks de mercado. Útil para análise de desempenho relativo.",
    parameters: {
      metric: { type: "string", description: "Métrica a comparar (ex: 'margem_lucro', 'ticket_medio', 'crescimento_receita')", required: true },
      value: { type: "number", description: "Valor atual da empresa para a métrica", required: true },
      sector: { type: "string", description: "Setor de atuação para benchmark", required: true },
      period: { type: "string", description: "Período de referência (ex: '2024', 'Q1 2024')", required: false }
    }
  },
  // ERPNext Integration Tools
  {
    name: "erpnext_status",
    description: "Verifica o status da conexão com o ERPNext. Retorna se está conectado e o usuário autenticado.",
    parameters: {}
  },
  {
    name: "erpnext_list_doctypes",
    description: "Lista todos os DocTypes (entidades) disponíveis no ERPNext. Use para descobrir quais dados podem ser consultados.",
    parameters: {
      limit: { type: "number", description: "Número máximo de DocTypes a retornar (padrão: 50)", required: false }
    }
  },
  {
    name: "erpnext_get_documents",
    description: "Busca documentos de um DocType específico no ERPNext. Use para consultar clientes, vendas, produtos, etc.",
    parameters: {
      doctype: { type: "string", description: "Nome do DocType (ex: 'Customer', 'Sales Invoice', 'Item')", required: true },
      filters: { type: "string", description: "Filtros em formato JSON (ex: '{\"status\":\"Active\"}')", required: false },
      fields: { type: "string", description: "Campos a retornar separados por vírgula (ex: 'name,customer_name,status')", required: false },
      limit: { type: "number", description: "Número máximo de registros (padrão: 20)", required: false }
    }
  },
  {
    name: "erpnext_get_document",
    description: "Busca um documento específico do ERPNext pelo nome/ID.",
    parameters: {
      doctype: { type: "string", description: "Nome do DocType (ex: 'Customer', 'Sales Invoice')", required: true },
      name: { type: "string", description: "Nome/ID do documento", required: true }
    }
  },
  {
    name: "erpnext_create_document",
    description: "Cria um novo documento no ERPNext.",
    parameters: {
      doctype: { type: "string", description: "Nome do DocType (ex: 'Customer', 'Item')", required: true },
      data: { type: "string", description: "Dados do documento em formato JSON", required: true }
    }
  },
  {
    name: "erpnext_update_document",
    description: "Atualiza um documento existente no ERPNext.",
    parameters: {
      doctype: { type: "string", description: "Nome do DocType", required: true },
      name: { type: "string", description: "Nome/ID do documento a atualizar", required: true },
      data: { type: "string", description: "Dados a atualizar em formato JSON", required: true }
    }
  },
  {
    name: "erpnext_search",
    description: "Pesquisa documentos no ERPNext por texto. Busca em campos de texto do DocType.",
    parameters: {
      doctype: { type: "string", description: "Nome do DocType para pesquisar", required: true },
      search_term: { type: "string", description: "Termo de busca", required: true },
      limit: { type: "number", description: "Número máximo de resultados (padrão: 20)", required: false }
    }
  },
  {
    name: "erpnext_run_report",
    description: "Executa um relatório do ERPNext. Use para obter dados agregados e análises.",
    parameters: {
      report_name: { type: "string", description: "Nome do relatório (ex: 'Accounts Receivable', 'Stock Balance')", required: true },
      filters: { type: "string", description: "Filtros do relatório em formato JSON", required: false }
    }
  },
  {
    name: "erpnext_call_method",
    description: "Chama um método/API customizado do ERPNext/Frappe.",
    parameters: {
      method: { type: "string", description: "Nome do método (ex: 'frappe.client.get_count')", required: true },
      args: { type: "string", description: "Argumentos em formato JSON", required: false }
    }
  },
  // ========== ARCÁDIA RETAIL TOOLS ==========
  {
    name: "retail_query",
    description: "Consulta dados do módulo Arcádia Retail (vendas PDV, dispositivos/celulares, avaliações Trade-In, ordens de serviço, comissões, créditos de clientes).",
    parameters: {
      entity: { type: "string", description: "Entidade: sales, devices, evaluations, service_orders, commissions, credits, sellers, stores", required: true },
      filter: { type: "string", description: "Filtro opcional (ex: 'status=completed', 'date=today', 'customer_id=4')", required: false },
      limit: { type: "number", description: "Limite de resultados (padrão: 20)", required: false }
    }
  },
  {
    name: "retail_stats",
    description: "Obtém estatísticas e KPIs do Retail em tempo real: vendas do dia, estoque, O.S. abertas, avaliações pendentes.",
    parameters: {
      period: { type: "string", description: "Período: today, week, month, year (padrão: today)", required: false },
      storeId: { type: "number", description: "ID da loja para filtrar (opcional)", required: false }
    }
  },
  {
    name: "retail_report",
    description: "Gera relatórios analíticos do Retail com insights e recomendações.",
    parameters: {
      type: { type: "string", description: "Tipo: sales_summary, inventory_status, commission_report, trade_in_analysis, service_orders_pending", required: true },
      dateFrom: { type: "string", description: "Data inicial (YYYY-MM-DD)", required: false },
      dateTo: { type: "string", description: "Data final (YYYY-MM-DD)", required: false },
      storeId: { type: "number", description: "ID da loja para filtrar", required: false }
    }
  }
];

export function getToolsDescription(): string {
  return MANUS_TOOLS.map(tool => {
    const params = Object.entries(tool.parameters)
      .map(([name, p]) => `  - ${name} (${p.type}${p.required ? ', obrigatório' : ', opcional'}): ${p.description}`)
      .join('\n');
    return `${tool.name}: ${tool.description}\n${params}`;
  }).join('\n\n');
}
