import pg from "pg";

async function getPool() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}

export async function runRbacSeed() {
  const pool = await getPool();

  // ── 1. PERFIS (roles) ────────────────────────────────────────────
  const PERFIS = [
    { name: "Administrador",        desc: "Acesso total a todos os módulos",                    is_system: 1 },
    { name: "Controller / CFO",     desc: "Gestão financeira completa — Control + RH leitura", is_system: 1 },
    { name: "Analista Financeiro",  desc: "Lançamentos, AR, AP, relatórios financeiros",       is_system: 0 },
    { name: "Gerente RH",           desc: "RH completo + leitura financeiro",                  is_system: 0 },
    { name: "Analista RH",          desc: "Funcionários, folha, importação de holerites",      is_system: 0 },
    { name: "Gerente de Projetos",  desc: "Engineering, Commercial, leitura financeiro",       is_system: 0 },
    { name: "Técnico de Campo",     desc: "Field Operations e leitura de projetos",            is_system: 0 },
    { name: "Consulta",             desc: "Leitura em todos os módulos habilitados",           is_system: 0 },
    // Decor
    { name: "Vendedor Decor",       desc: "Atendimento, orçamentos e pedidos de decoração",    is_system: 0 },
    { name: "Técnico Decor",        desc: "Medições técnicas e análise técnica",               is_system: 0 },
    { name: "Costureira Decor",     desc: "OS de produção no ateliê",                          is_system: 0 },
    { name: "Instalador Decor",     desc: "OS de instalação em campo",                        is_system: 0 },
    { name: "Gestor Decor",         desc: "Acesso completo ao módulo de decoração",            is_system: 0 },
  ];

  for (const p of PERFIS) {
    await pool.query(
      `INSERT INTO roles (name, description, is_system)
       VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING`,
      [p.name, p.desc, p.is_system]
    );
  }
  console.log('[rbacSeed] roles: OK');

  // ── 2. PERMISSÕES ────────────────────────────────────────────────
  const PERMS = [
    // Control
    { code:"control.dashboard.read",       name:"Ver dashboard financeiro",      module:"control",      action:"read",   grupo:"Dashboard",       ui_key:"tab-dashboard",           sort:10 },
    { code:"control.lancamentos.read",     name:"Ver lançamentos",               module:"control",      action:"read",   grupo:"Lançamentos",     ui_key:"tab-lancamentos",         sort:20 },
    { code:"control.lancamentos.write",    name:"Criar e editar lançamentos",    module:"control",      action:"write",  grupo:"Lançamentos",     ui_key:"btn-novo-lancamento",     sort:21 },
    { code:"control.lancamentos.delete",   name:"Excluir lançamentos",           module:"control",      action:"delete", grupo:"Lançamentos",     ui_key:"btn-delete-lancamento",   sort:22 },
    { code:"control.lancamentos.aprovar",  name:"Aprovar lançamentos",           module:"control",      action:"write",  grupo:"Lançamentos",     ui_key:"btn-aprovar-lancamento",  sort:23 },
    { code:"control.ar.read",              name:"Ver contas a receber",          module:"control",      action:"read",   grupo:"AR/AP",           ui_key:"tab-ar",                  sort:30 },
    { code:"control.ar.write",             name:"Criar e editar AR",             module:"control",      action:"write",  grupo:"AR/AP",           ui_key:"btn-nova-ar",             sort:31 },
    { code:"control.ap.read",              name:"Ver contas a pagar",            module:"control",      action:"read",   grupo:"AR/AP",           ui_key:"tab-ap",                  sort:32 },
    { code:"control.ap.write",             name:"Criar e editar AP",             module:"control",      action:"write",  grupo:"AR/AP",           ui_key:"btn-novo-ap",             sort:33 },
    { code:"control.orcamento.read",       name:"Ver orçamento e comparativo",   module:"control",      action:"read",   grupo:"Orçamento",       ui_key:"tab-orcamento",           sort:40 },
    { code:"control.orcamento.write",      name:"Editar células do orçamento",   module:"control",      action:"write",  grupo:"Orçamento",       ui_key:"orcamento-cells",         sort:41 },
    { code:"control.relatorios.read",      name:"Ver DRE, FC Diário, FC Mensal", module:"control",      action:"read",   grupo:"Relatórios",      ui_key:"tab-relatorios",          sort:50 },
    { code:"control.relatorios.export",    name:"Exportar relatórios",           module:"control",      action:"read",   grupo:"Relatórios",      ui_key:"btn-export-relatorio",    sort:51 },
    { code:"control.cc.write",             name:"Criar/editar centros de custo", module:"control",      action:"write",  grupo:"Configuração",    ui_key:"tab-cc-edit",             sort:60 },
    { code:"control.rateio.admin",         name:"Configurar rateio",             module:"control",      action:"admin",  grupo:"Configuração",    ui_key:"tab-rateio",              sort:61 },
    { code:"control.conciliacao.write",    name:"Fazer conciliação bancária",    module:"control",      action:"write",  grupo:"Configuração",    ui_key:"tab-conciliacao-write",   sort:62 },
    { code:"control.setup.admin",          name:"Acessar Setup e configurações", module:"control",      action:"admin",  grupo:"Configuração",    ui_key:"btn-setup",               sort:63 },
    { code:"control.grupo.read",           name:"Ver DRE consolidado do grupo",  module:"control",      action:"read",   grupo:"Grupo",           ui_key:"tab-grupo-consolidado",   sort:70 },
    // HR
    { code:"hr.funcionarios.read",         name:"Ver lista de funcionários",     module:"hr",           action:"read",   grupo:"Funcionários",    ui_key:"tab-funcionarios",        sort:80 },
    { code:"hr.funcionarios.write",        name:"Criar e editar funcionários",   module:"hr",           action:"write",  grupo:"Funcionários",    ui_key:"btn-novo-funcionario",    sort:81 },
    { code:"hr.salarios.read",             name:"Ver salários",                  module:"hr",           action:"read",   grupo:"Funcionários",    ui_key:"col-salario",             sort:82 },
    { code:"hr.salarios.write",            name:"Editar salários",               module:"hr",           action:"write",  grupo:"Funcionários",    ui_key:"input-salario",           sort:83 },
    { code:"hr.folha.read",                name:"Ver folha de pagamento",        module:"hr",           action:"read",   grupo:"Folha",           ui_key:"tab-folha",               sort:90 },
    { code:"hr.folha.write",               name:"Criar e processar folha",       module:"hr",           action:"write",  grupo:"Folha",           ui_key:"btn-nova-folha",          sort:91 },
    { code:"hr.folha.aprovar",             name:"Aprovar e fechar folha",        module:"hr",           action:"write",  grupo:"Folha",           ui_key:"btn-aprovar-folha",       sort:92 },
    { code:"hr.import.write",              name:"Importar holerites Domínio",    module:"hr",           action:"write",  grupo:"Importação",      ui_key:"btn-import-folha",        sort:93 },
    { code:"hr.relatorios.read",           name:"Ver relatórios gerenciais RH",  module:"hr",           action:"read",   grupo:"Relatórios",      ui_key:"tab-hr-relatorios",       sort:94 },
    // Engineering
    { code:"engineering.projetos.read",    name:"Ver projetos de engenharia",    module:"engineering",  action:"read",   grupo:"Projetos",        ui_key:"tab-projetos",            sort:100 },
    { code:"engineering.projetos.write",   name:"Criar e editar projetos",       module:"engineering",  action:"write",  grupo:"Projetos",        ui_key:"btn-novo-projeto",        sort:101 },
    { code:"engineering.projetos.delete",  name:"Excluir projetos",              module:"engineering",  action:"delete", grupo:"Projetos",        ui_key:"btn-delete-projeto",      sort:102 },
    { code:"engineering.ar.write",         name:"Criar AR por projeto",          module:"engineering",  action:"write",  grupo:"Projetos",        ui_key:"btn-ar-projeto",          sort:103 },
    { code:"engineering.bases.write",      name:"Editar bases de receita",       module:"engineering",  action:"write",  grupo:"Projetos",        ui_key:"tab-bases-receita",       sort:104 },
    { code:"commercial.propostas.read",    name:"Ver propostas comerciais",      module:"commercial",   action:"read",   grupo:"Comercial",       ui_key:"tab-propostas",           sort:110 },
    { code:"commercial.propostas.write",   name:"Criar e editar propostas",      module:"commercial",   action:"write",  grupo:"Comercial",       ui_key:"btn-nova-proposta",       sort:111 },
    { code:"commercial.pipeline.read",     name:"Ver pipeline comercial",        module:"commercial",   action:"read",   grupo:"Comercial",       ui_key:"tab-pipeline",            sort:112 },
    { code:"fieldops.read",                name:"Ver Field Operations",          module:"fieldops",     action:"read",   grupo:"Campo",           ui_key:"nav-fieldops",            sort:120 },
    { code:"fieldops.write",               name:"Operar campo",                  module:"fieldops",     action:"write",  grupo:"Campo",           ui_key:"btn-campo-write",         sort:121 },
    { code:"quality.read",                 name:"Ver qualidade e laudos",        module:"quality",      action:"read",   grupo:"Qualidade",       ui_key:"nav-quality",             sort:130 },
    { code:"quality.write",                name:"Criar laudos e amostras",       module:"quality",      action:"write",  grupo:"Qualidade",       ui_key:"btn-quality-write",       sort:131 },
    // XOS
    { code:"xos.crm.read",                name:"Ver CRM e contatos",            module:"xos",          action:"read",   grupo:"XOS",             ui_key:"nav-crm",                 sort:140 },
    { code:"xos.crm.write",               name:"Editar CRM e deals",            module:"xos",          action:"write",  grupo:"XOS",             ui_key:"btn-crm-write",           sort:141 },
    { code:"xos.inbox.read",              name:"Ver mensagens e atendimento",   module:"xos",          action:"read",   grupo:"XOS",             ui_key:"nav-inbox",               sort:142 },
    { code:"xos.inbox.write",             name:"Responder mensagens",           module:"xos",          action:"write",  grupo:"XOS",             ui_key:"btn-inbox-write",         sort:143 },
    { code:"xos.campanhas.write",         name:"Criar e enviar campanhas",      module:"xos",          action:"write",  grupo:"XOS",             ui_key:"btn-campanhas",           sort:144 },
    // Admin
    { code:"admin.usuarios.read",         name:"Ver lista de usuários",         module:"admin",        action:"read",   grupo:"Administração",   ui_key:"tab-usuarios",            sort:150 },
    { code:"admin.usuarios.write",        name:"Convidar usuários",             module:"admin",        action:"write",  grupo:"Administração",   ui_key:"btn-convidar",            sort:151 },
    { code:"admin.usuarios.admin",        name:"Gerenciar perfis e permissões", module:"admin",        action:"admin",  grupo:"Administração",   ui_key:"btn-perm-admin",          sort:152 },
    { code:"admin.perfis.admin",          name:"Criar e editar perfis",         module:"admin",        action:"admin",  grupo:"Administração",   ui_key:"tab-perfis-admin",        sort:153 },
    { code:"admin.empresas.read",         name:"Ver empresas do grupo",         module:"admin",        action:"read",   grupo:"Administração",   ui_key:"tab-empresas",            sort:154 },
    { code:"admin.empresas.write",        name:"Criar e editar empresas",       module:"admin",        action:"write",  grupo:"Administração",   ui_key:"btn-nova-empresa",        sort:155 },
    // Decor — Decoração, Cortinas e Persianaria
    { code:"decor.pedidos.read",          name:"Ver pedidos de cortinas",       module:"decor",        action:"read",   grupo:"Decor",           ui_key:"tab-decor-pedidos",        sort:200 },
    { code:"decor.pedidos.write",         name:"Criar e editar pedidos",        module:"decor",        action:"write",  grupo:"Decor",           ui_key:"btn-decor-novo-pedido",    sort:201 },
    { code:"decor.pedidos.efetivar",      name:"Efetivar pedidos",              module:"decor",        action:"write",  grupo:"Decor",           ui_key:"btn-decor-efetivar",       sort:202 },
    { code:"decor.medicao.write",         name:"Registrar medições",            module:"decor",        action:"write",  grupo:"Decor",           ui_key:"btn-decor-medicao",        sort:203 },
    { code:"decor.orcamento.write",       name:"Montar e enviar orçamentos",    module:"decor",        action:"write",  grupo:"Decor",           ui_key:"btn-decor-orcamento",      sort:204 },
    { code:"decor.os_prod.read",          name:"Ver OS de produção (ateliê)",   module:"decor",        action:"read",   grupo:"Decor",           ui_key:"tab-decor-osprod",         sort:205 },
    { code:"decor.os_prod.write",         name:"Operar OS de produção",         module:"decor",        action:"write",  grupo:"Decor",           ui_key:"btn-decor-osprod-write",   sort:206 },
    { code:"decor.os_inst.read",          name:"Ver OS de instalação",          module:"decor",        action:"read",   grupo:"Decor",           ui_key:"tab-decor-osinst",         sort:207 },
    { code:"decor.os_inst.write",         name:"Operar OS de instalação",       module:"decor",        action:"write",  grupo:"Decor",           ui_key:"btn-decor-osinst-write",   sort:208 },
    { code:"decor.catalogo.read",         name:"Ver catálogo de tecidos",       module:"decor",        action:"read",   grupo:"Decor",           ui_key:"tab-decor-catalogo",       sort:209 },
    { code:"decor.catalogo.write",        name:"Editar catálogo e preços",      module:"decor",        action:"write",  grupo:"Decor",           ui_key:"btn-decor-catalogo-edit",  sort:210 },
    { code:"decor.relatorios.read",       name:"Ver relatórios de decoração",   module:"decor",        action:"read",   grupo:"Decor",           ui_key:"tab-decor-relatorios",     sort:211 },
    { code:"decor.analise_tec.write",     name:"Fazer análise técnica",         module:"decor",        action:"write",  grupo:"Decor",           ui_key:"btn-decor-analise",        sort:212 },
  ];

  for (const perm of PERMS) {
    await pool.query(
      `INSERT INTO permissions (code, name, module, action, ui_key, ui_action, sort_order, grupo)
       VALUES ($1, $2, $3, $4, $5, 'hide', $6, $7)
       ON CONFLICT (code) DO UPDATE SET
         name       = EXCLUDED.name,
         ui_key     = EXCLUDED.ui_key,
         sort_order = EXCLUDED.sort_order,
         grupo      = EXCLUDED.grupo`,
      [perm.code, perm.name, perm.module, perm.action, perm.ui_key, perm.sort, perm.grupo]
    );
  }
  console.log('[rbacSeed] permissions: OK');

  // ── 3. VÍNCULO PERFIL → PERMISSÕES ──────────────────────────────
  const PERFIL_PERMS: Record<string, string[]> = {
    "Controller / CFO": [
      "control.dashboard.read","control.lancamentos.read","control.lancamentos.write",
      "control.lancamentos.delete","control.lancamentos.aprovar",
      "control.ar.read","control.ar.write","control.ap.read","control.ap.write",
      "control.orcamento.read","control.orcamento.write","control.relatorios.read",
      "control.relatorios.export","control.cc.write","control.rateio.admin",
      "control.conciliacao.write","control.grupo.read",
      "hr.funcionarios.read","hr.folha.read","hr.relatorios.read",
      "engineering.projetos.read","commercial.propostas.read","commercial.pipeline.read",
      "admin.usuarios.read",
    ],
    "Analista Financeiro": [
      "control.dashboard.read","control.lancamentos.read","control.lancamentos.write",
      "control.ar.read","control.ar.write","control.ap.read","control.ap.write",
      "control.orcamento.read","control.relatorios.read","control.relatorios.export",
    ],
    "Gerente RH": [
      "hr.funcionarios.read","hr.funcionarios.write","hr.salarios.read","hr.salarios.write",
      "hr.folha.read","hr.folha.write","hr.folha.aprovar","hr.import.write","hr.relatorios.read",
      "control.lancamentos.read","control.relatorios.read",
    ],
    "Analista RH": [
      "hr.funcionarios.read","hr.funcionarios.write","hr.folha.read","hr.folha.write",
      "hr.import.write","hr.relatorios.read",
    ],
    "Gerente de Projetos": [
      "engineering.projetos.read","engineering.projetos.write","engineering.ar.write",
      "engineering.bases.write","commercial.propostas.read","commercial.propostas.write",
      "commercial.pipeline.read","fieldops.read","fieldops.write",
      "control.lancamentos.read","control.relatorios.read","control.ar.read",
      "xos.crm.read","xos.crm.write",
    ],
    "Técnico de Campo": [
      "fieldops.read","fieldops.write",
      "engineering.projetos.read",
      "quality.read",
    ],
    "Consulta": [
      "control.dashboard.read","control.lancamentos.read","control.relatorios.read",
      "hr.funcionarios.read","engineering.projetos.read",
      "commercial.propostas.read","commercial.pipeline.read",
      "xos.crm.read",
    ],
    "Vendedor Decor": [
      "decor.pedidos.read","decor.pedidos.write","decor.orcamento.write",
      "decor.catalogo.read","decor.relatorios.read",
      "xos.crm.read","xos.crm.write","xos.inbox.read",
    ],
    "Técnico Decor": [
      "decor.pedidos.read","decor.medicao.write","decor.analise_tec.write",
      "decor.catalogo.read","decor.os_inst.read",
    ],
    "Costureira Decor": [
      "decor.pedidos.read","decor.os_prod.read","decor.os_prod.write",
    ],
    "Instalador Decor": [
      "decor.pedidos.read","decor.os_inst.read","decor.os_inst.write",
    ],
    "Gestor Decor": [
      "decor.pedidos.read","decor.pedidos.write","decor.pedidos.efetivar",
      "decor.medicao.write","decor.orcamento.write","decor.analise_tec.write",
      "decor.os_prod.read","decor.os_prod.write",
      "decor.os_inst.read","decor.os_inst.write",
      "decor.catalogo.read","decor.catalogo.write","decor.relatorios.read",
      "xos.crm.read","xos.crm.write","xos.inbox.read","xos.inbox.write",
      "control.ar.read","control.lancamentos.read",
    ],
  };

  for (const [perfilNome, permCodes] of Object.entries(PERFIL_PERMS)) {
    const roleRes = await pool.query(
      "SELECT id FROM roles WHERE name = $1 LIMIT 1", [perfilNome]
    );
    if (roleRes.rows.length === 0) continue;
    const roleId = roleRes.rows[0].id;

    for (const code of permCodes) {
      const permRes = await pool.query(
        "SELECT id FROM permissions WHERE code = $1 LIMIT 1", [code]
      );
      if (permRes.rows.length === 0) continue;
      await pool.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [roleId, permRes.rows[0].id]
      );
    }
  }
  console.log('[rbacSeed] role_permissions: OK');

  await pool.end();
}
