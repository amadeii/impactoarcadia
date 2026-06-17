/**
 * Migrações idempotentes do módulo Control + Pessoas.
 * Chamado no startup do servidor. Seguro para rodar N vezes.
 */
import { Pool } from "pg";
import { runCartaoMigrations } from "./migrations_cartao";
import { runOrigemRefMigrations } from "./migrations_origem_ref";
import { runPessoasAjustesMigrations } from "./migrations_pessoas_ajustes";
import { runMigrationSoe00 } from "../soe/migration_soe00";
import { runMigrationCad01 } from "../cad/migration_cad01";
import { runMigrationFisc01 } from "../fisc/migration_fisc01";
import { runMigrationFisc02 } from "../fisc/migration_fisc02";
import { runMigrationCom01 } from "../com/migration_com01";
import { runMigrationEst01 } from "../est/migration_est01";
import { runMigrationComp01 } from "../comp/migration_comp01";
import { seedCad01Defaults } from "../cad/seed_defaults";

export async function runControlMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    console.log("[control-migrations] Iniciando migrações...");

    // ── Clients (empresas gerenciadas) ──────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        name varchar(300) NOT NULL,
        company varchar(300),
        cnpj varchar(18),
        email varchar(300),
        phone varchar(30),
        status varchar(20) NOT NULL DEFAULT 'ativo',
        regime varchar(30),
        responsavel varchar(200),
        observacoes text,
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_clients_tenant_status ON clients(tenant_id, status);`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_clients_tenant_cnpj ON clients(tenant_id, cnpj) WHERE cnpj IS NOT NULL;`);

    // ── Plano de Contas ──────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS planos_contas (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        codigo varchar(30) NOT NULL,
        descricao varchar(300) NOT NULL,
        natureza varchar(30) NOT NULL,
        nivel integer NOT NULL DEFAULT 1,
        parent_id varchar,
        natureza_dre varchar(30),
        permite_lancamento boolean DEFAULT true,
        ativo boolean DEFAULT true,
        codigo_cfc varchar(30),
        tipo_conta varchar(15),
        grupo_dre varchar(50),
        apelido varchar(100),
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_planos_contas_tenant ON planos_contas(tenant_id);`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS planos_contas_tenant_codigo_uniq ON planos_contas(tenant_id, codigo);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_planos_contas_codigo_cfc ON planos_contas(tenant_id, codigo_cfc);`);

    // ── Centros de Custo ─────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS centros_custo (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        cliente_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        codigo varchar(30) NOT NULL,
        nome varchar(200) NOT NULL,
        descricao text,
        ativo boolean DEFAULT true,
        tipo varchar(20) NOT NULL DEFAULT 'departamento',
        parent_id varchar,
        responsavel varchar(200),
        data_inicio date,
        data_fim date,
        orcamento_anual numeric(15,2),
        cor varchar(7) DEFAULT '#6366f1',
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_centros_custo_tenant_cliente ON centros_custo(tenant_id, cliente_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_centros_custo_parent ON centros_custo(parent_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_centros_custo_tipo ON centros_custo(tenant_id, tipo);`);

    // ── Rateios CC ───────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS rateios_cc (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        lancamento_financeiro_id varchar NOT NULL,
        centro_custo_id varchar NOT NULL REFERENCES centros_custo(id) ON DELETE CASCADE,
        percentual numeric(6,3) NOT NULL,
        valor_rateado numeric(15,2),
        created_at timestamp DEFAULT NOW()
      );
    `);
    // idx criado sobre a coluna renomeada (lancamento_id); idempotente
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rateios_cc' AND column_name='lancamento_id') THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS idx_rateios_cc_lanc ON rateios_cc(lancamento_id)';
        ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rateios_cc' AND column_name='lancamento_financeiro_id') THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS idx_rateios_cc_lanc ON rateios_cc(lancamento_financeiro_id)';
        END IF;
      END $$;
    `);

    // ── Contas Bancárias ─────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS contas_bancarias (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        cliente_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        nome varchar(200) NOT NULL,
        banco varchar(100),
        agencia varchar(20),
        conta varchar(30),
        tipo varchar(30) DEFAULT 'corrente',
        saldo_inicial numeric(15,2) DEFAULT 0,
        saldo_atual numeric(15,2) DEFAULT 0,
        data_saldo_inicial date,
        ativa boolean DEFAULT true,
        integracao varchar(50),
        config_integracao jsonb,
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contas_bancarias_tenant_cliente ON contas_bancarias(tenant_id, cliente_id);`);

    // ── Lançamentos Financeiros ──────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS lancamentos_financeiros (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        cliente_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        tipo varchar(10) NOT NULL,
        descricao varchar(500) NOT NULL,
        valor numeric(15,2) NOT NULL,
        data_vencimento date NOT NULL,
        data_pagamento date,
        data_competencia date,
        status varchar(20) NOT NULL DEFAULT 'pendente',
        plano_conta_id varchar REFERENCES planos_contas(id),
        centro_custo_id varchar REFERENCES centros_custo(id),
        conta_bancaria_id varchar REFERENCES contas_bancarias(id),
        tipo_documento_id varchar,
        favorecido varchar(300),
        numero_documento varchar(100),
        observacoes text,
        conciliado boolean DEFAULT false,
        movimentacao_bancaria_id varchar,
        aprovado_por varchar,
        aprovado_em timestamp,
        criado_por varchar REFERENCES users(id),
        grupo_parcelamento_id varchar,
        numero_parcela integer,
        total_parcelas integer,
        template_recorrencia_id varchar,
        origem_recorrencia boolean DEFAULT false,
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_lanc_fin_tenant_cliente ON lancamentos_financeiros(tenant_id, cliente_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_lanc_fin_status ON lancamentos_financeiros(tenant_id, status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_lanc_fin_vencimento ON lancamentos_financeiros(tenant_id, data_vencimento);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_lanc_fin_tipo ON lancamentos_financeiros(tenant_id, tipo);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_lanc_grupo_parcelamento ON lancamentos_financeiros(grupo_parcelamento_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_lanc_template_recorrencia ON lancamentos_financeiros(template_recorrencia_id);`);

    // ── Tipos de Documento ───────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS tipos_documento (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        nome varchar(100) NOT NULL,
        icone varchar(50) DEFAULT 'file',
        ativo boolean NOT NULL DEFAULT true,
        ordem integer DEFAULT 0,
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tipos_doc_tenant ON tipos_documento(tenant_id);`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_tipos_doc_tenant_nome ON tipos_documento(tenant_id, nome);`);
    // Seed tipos globais
    const TIPOS_PADRAO = [
      ['NF-e','file-text',1],['NFC-e','shopping-bag',2],['Boleto','barcode',3],
      ['PIX','zap',4],['CTE','truck',5],['Recibo','receipt',6],
      ['Folha de Pagamento','users',7],['Débito Automático','repeat',8],
      ['Estorno','rotate-ccw',9],['Contrato','pen-tool',10],
      ['Extrato','list',11],['Outros','more-horizontal',99],
    ] as const;
    for (const [nome, icone, ordem] of TIPOS_PADRAO) {
      await client.query(
        `INSERT INTO tipos_documento (tenant_id, nome, icone, ordem)
         VALUES ('__global__', $1, $2, $3)
         ON CONFLICT (tenant_id, nome) DO NOTHING;`,
        [nome, icone, ordem],
      );
    }

    // ── Grupos de Parcelamento ───────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS grupos_parcelamento (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        cliente_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        tipo varchar(10) NOT NULL,
        descricao varchar(300) NOT NULL,
        total_parcelas integer NOT NULL,
        valor_total numeric(15,2) NOT NULL,
        plano_conta_id varchar REFERENCES planos_contas(id),
        centro_custo_id varchar REFERENCES centros_custo(id),
        tipo_documento_id varchar,
        favorecido varchar(300),
        observacoes text,
        criado_por varchar REFERENCES users(id),
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_grupos_parcel_tenant_cliente ON grupos_parcelamento(tenant_id, cliente_id);`);

    // ── Templates de Recorrência ─────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS templates_recorrencia (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        cliente_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        descricao varchar(300) NOT NULL,
        tipo varchar(10) NOT NULL,
        frequencia varchar(20) NOT NULL,
        dia_vencimento integer,
        valor_fixo numeric(15,2),
        plano_conta_id varchar REFERENCES planos_contas(id),
        centro_custo_id varchar REFERENCES centros_custo(id),
        conta_bancaria_id varchar REFERENCES contas_bancarias(id),
        tipo_documento_id varchar,
        favorecido varchar(300),
        data_inicio date NOT NULL,
        data_fim date,
        ativa boolean NOT NULL DEFAULT true,
        geradas_ate date,
        observacoes text,
        criado_por varchar REFERENCES users(id),
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_templates_rec_tenant_cliente ON templates_recorrencia(tenant_id, cliente_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_templates_rec_ativa ON templates_recorrencia(tenant_id, ativa);`);

    // ── Períodos de Competência ──────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS periodos_competencia (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        cliente_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        ano integer NOT NULL,
        mes integer NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'aberto',
        fechado_por varchar REFERENCES users(id),
        fechado_em timestamp,
        observacoes text,
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_periodo_cliente_anomes ON periodos_competencia(tenant_id, cliente_id, ano, mes);`);

    // ── Movimentações Bancárias ──────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS movimentacoes_bancarias (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        conta_bancaria_id varchar NOT NULL REFERENCES contas_bancarias(id) ON DELETE CASCADE,
        data_movimentacao date NOT NULL,
        descricao varchar(500) NOT NULL,
        valor numeric(15,2) NOT NULL,
        tipo varchar(10) NOT NULL,
        saldo_apos numeric(15,2),
        conciliado boolean DEFAULT false,
        lancamento_financeiro_id varchar,
        origem varchar(50) DEFAULT 'manual',
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_mov_banc_conta ON movimentacoes_bancarias(conta_bancaria_id, data_movimentacao);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_mov_banc_conciliado ON movimentacoes_bancarias(tenant_id, conciliado);`);

    // ── Orçamentos Mensais ───────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS orcamentos_mensais (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        cliente_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        ano integer NOT NULL,
        mes integer NOT NULL,
        plano_conta_id varchar NOT NULL REFERENCES planos_contas(id),
        centro_custo_id varchar REFERENCES centros_custo(id),
        valor_previsto numeric(15,2) NOT NULL DEFAULT 0,
        valor_realizado numeric(15,2) DEFAULT 0,
        alerta_threshold numeric(5,2) DEFAULT 10.00,
        notas text,
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_orcamento_cli_anomes_conta ON orcamentos_mensais(tenant_id, cliente_id, ano, mes, plano_conta_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_orcamentos_tenant_cliente ON orcamentos_mensais(tenant_id, cliente_id);`);

    // ── Grupos Empresariais ──────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS grupos_empresariais (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        nome varchar(200) NOT NULL,
        descricao text,
        ativo boolean DEFAULT true,
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_grupos_emp_tenant ON grupos_empresariais(tenant_id);`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS grupos_empresariais_membros (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        grupo_id varchar NOT NULL REFERENCES grupos_empresariais(id) ON DELETE CASCADE,
        cliente_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        papel varchar(50) DEFAULT 'membro',
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_grupo_membro ON grupos_empresariais_membros(grupo_id, cliente_id);`);

    // ── Lançamentos Contábeis ────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS lancamentos_contabeis (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        cliente_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        data_lancamento date NOT NULL,
        historico text NOT NULL,
        total_debito numeric(15,2) NOT NULL DEFAULT 0,
        total_credito numeric(15,2) NOT NULL DEFAULT 0,
        status varchar(20) NOT NULL DEFAULT 'rascunho',
        origem varchar(50),
        lancamento_financeiro_id varchar REFERENCES lancamentos_financeiros(id) ON DELETE SET NULL,
        criado_por varchar REFERENCES users(id),
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_lanc_cont_tenant_cliente ON lancamentos_contabeis(tenant_id, cliente_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_lanc_cont_data ON lancamentos_contabeis(tenant_id, data_lancamento);`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS partidas_contabeis (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        lancamento_contabil_id varchar NOT NULL REFERENCES lancamentos_contabeis(id) ON DELETE CASCADE,
        plano_conta_id varchar NOT NULL REFERENCES planos_contas(id),
        centro_custo_id varchar REFERENCES centros_custo(id),
        tipo varchar(1) NOT NULL,
        valor numeric(15,2) NOT NULL,
        rateio numeric(6,3) DEFAULT 100.000,
        descricao text,
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_partidas_lanc ON partidas_contabeis(lancamento_contabil_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_partidas_tenant_conta ON partidas_contabeis(tenant_id, plano_conta_id);`);

    // ── Conectores ───────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS conectores (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        cliente_id varchar REFERENCES clients(id) ON DELETE CASCADE,
        tipo_conector varchar(40) NOT NULL,
        nome varchar(200) NOT NULL,
        config_criptografada text,
        status varchar(20) NOT NULL DEFAULT 'nao_configurado',
        ultima_sincronizacao timestamp,
        ultimo_erro text,
        ativo boolean DEFAULT true,
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_conectores_tenant ON conectores(tenant_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_conectores_tenant_tipo ON conectores(tenant_id, tipo_conector);`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS conectores_sync_logs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        conector_id varchar NOT NULL REFERENCES conectores(id) ON DELETE CASCADE,
        iniciado_em timestamp DEFAULT NOW(),
        finalizado_em timestamp,
        status varchar(20) NOT NULL DEFAULT 'em_andamento',
        registros_processados integer DEFAULT 0,
        mensagem text,
        payload_resumo jsonb
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sync_logs_tenant_conector ON conectores_sync_logs(tenant_id, conector_id);`);

    // ── NF-e Recebidas ───────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS nfes_recebidas (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        cliente_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        chave_nfe varchar(44) NOT NULL,
        numero_nfe varchar(20),
        serie_nfe varchar(5),
        data_emissao date,
        valor_total numeric(15,2),
        fornecedor_cnpj varchar(14),
        fornecedor_nome varchar(300),
        xml_conteudo text,
        status_manifestacao varchar(30) NOT NULL DEFAULT 'pendente',
        categorizacao_ia jsonb,
        lancamento_financeiro_id varchar REFERENCES lancamentos_financeiros(id) ON DELETE SET NULL,
        processado_em timestamp,
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_nfes_tenant_cliente ON nfes_recebidas(tenant_id, cliente_id);`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_nfe_chave_cliente ON nfes_recebidas(cliente_id, chave_nfe);`);

    // ── Fechamentos Contábeis ────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS fechamentos_contabeis (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        cliente_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        ano integer NOT NULL,
        mes integer NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'em_andamento',
        checklist jsonb,
        iniciado_por varchar REFERENCES users(id),
        iniciado_em timestamp DEFAULT NOW(),
        concluido_por varchar REFERENCES users(id),
        concluido_em timestamp,
        observacoes text
      );
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_fechamento_cliente_periodo ON fechamentos_contabeis(tenant_id, cliente_id, ano, mes);`);

    // ── Regime Tributário ────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS regime_tributario_config (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        cliente_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        ano integer NOT NULL,
        regime varchar(30) NOT NULL,
        aliquotas_personalizadas jsonb,
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_regime_cliente_ano ON regime_tributario_config(tenant_id, cliente_id, ano);`);

    // ── Retenções ────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS retencoes (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        lancamento_financeiro_id varchar NOT NULL REFERENCES lancamentos_financeiros(id) ON DELETE CASCADE,
        tipo varchar(10) NOT NULL,
        aliquota numeric(6,4) NOT NULL,
        base_calculo numeric(15,2) NOT NULL,
        valor_retido numeric(15,2) NOT NULL,
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_retencoes_lanc ON retencoes(lancamento_financeiro_id);`);

    // ── Pessoas ──────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS pessoas (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        tipo_pessoa varchar(2) NOT NULL DEFAULT 'PJ',
        nome_fantasia varchar(300) NOT NULL,
        razao_social varchar(300),
        cnpj_cpf varchar(18),
        rg_ie varchar(30),
        inscricao_municipal varchar(30),
        data_nascimento_fundacao date,
        status varchar(20) NOT NULL DEFAULT 'ativo',
        observacoes text,
        created_by_id varchar REFERENCES users(id),
        updated_by_id varchar REFERENCES users(id),
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pessoas_tenant ON pessoas(tenant_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pessoas_tenant_nome ON pessoas(tenant_id, nome_fantasia);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pessoas_cnpj ON pessoas(tenant_id, cnpj_cpf);`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS enderecos (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        pessoa_id varchar NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
        tipo varchar(30) DEFAULT 'principal',
        cep varchar(10),
        logradouro varchar(300),
        numero varchar(20),
        complemento varchar(100),
        bairro varchar(100),
        cidade varchar(100),
        estado varchar(2),
        pais varchar(50) DEFAULT 'Brasil',
        principal boolean DEFAULT false,
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_enderecos_pessoa ON enderecos(pessoa_id);`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS contatos (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        pessoa_id varchar NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
        tipo varchar(30) NOT NULL,
        valor varchar(300) NOT NULL,
        descricao varchar(100),
        principal boolean DEFAULT false,
        ultimo_bounce timestamp,
        bounce_count integer DEFAULT 0,
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contatos_pessoa ON contatos(pessoa_id);`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pessoa_papeis (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        pessoa_id varchar NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
        tipo_papel varchar(50) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'ativo',
        data_inicio date,
        data_fim date,
        dados_extras jsonb,
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pessoa_papeis_pessoa ON pessoa_papeis(pessoa_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_papel_tenant_tipo ON pessoa_papeis(tenant_id, tipo_papel);`);

    // ── HR — Departamentos e Cargos ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_departments (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        cliente_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        nome varchar(100) NOT NULL,
        centro_custo_id varchar REFERENCES centros_custo(id) ON DELETE SET NULL,
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_hr_departments_tenant_cliente ON hr_departments(tenant_id, cliente_id);`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_positions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        cliente_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        nome varchar(100) NOT NULL,
        cbo_code varchar(10),
        level varchar(20),
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_hr_positions_tenant_cliente ON hr_positions(tenant_id, cliente_id);`);

    // ── HR — Colaboradores ───────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_employees (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        cliente_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        employee_code varchar(20) NOT NULL,
        full_name varchar(200) NOT NULL,
        cpf varchar(14) NOT NULL,
        rg varchar(20),
        ctps_number varchar(20),
        ctps_series varchar(10),
        admission_date date NOT NULL,
        termination_date date,
        status varchar(20) NOT NULL DEFAULT 'active',
        position_id varchar NOT NULL REFERENCES hr_positions(id),
        department_id varchar REFERENCES hr_departments(id) ON DELETE SET NULL,
        work_location varchar(100),
        employment_type varchar(20) NOT NULL DEFAULT 'clt',
        base_salary numeric(12,2) NOT NULL,
        monthly_hours integer NOT NULL DEFAULT 220,
        work_schedule jsonb,
        cbo_code varchar(10),
        pis_pasep varchar(20),
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_hr_employees_tenant_cliente ON hr_employees(tenant_id, cliente_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_hr_employees_tenant_status ON hr_employees(tenant_id, status);`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_employees_cliente_codigo ON hr_employees(cliente_id, employee_code);`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_employees_cliente_cpf ON hr_employees(cliente_id, cpf);`);

    // ── HR — Histórico Salarial ──────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_salary_history (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        employee_id varchar NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        salary numeric(12,2) NOT NULL,
        effective_date date NOT NULL,
        reason varchar(50) DEFAULT 'reajuste',
        notes varchar(500),
        created_by varchar REFERENCES users(id),
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_hr_salary_history_employee ON hr_salary_history(employee_id, effective_date);`);

    // ── HR — Folha de Pagamento ──────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_payroll_periods (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        cliente_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        competencia_ano integer NOT NULL,
        competencia_mes integer NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'draft',
        total_bruto numeric(14,2) DEFAULT 0,
        total_descontos numeric(14,2) DEFAULT 0,
        total_liquido numeric(14,2) DEFAULT 0,
        total_encargos numeric(14,2) DEFAULT 0,
        headcount integer DEFAULT 0,
        approved_by varchar REFERENCES users(id),
        approved_at timestamp,
        control_tx_ids jsonb,
        exported_at timestamp,
        export_count integer DEFAULT 0,
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_payroll_periodo_cliente ON hr_payroll_periods(tenant_id, cliente_id, competencia_ano, competencia_mes);`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_payroll_entries (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        period_id varchar NOT NULL REFERENCES hr_payroll_periods(id) ON DELETE CASCADE,
        employee_id varchar NOT NULL REFERENCES hr_employees(id),
        salario_base numeric(12,2) NOT NULL,
        total_proventos numeric(12,2) NOT NULL DEFAULT 0,
        total_descontos numeric(12,2) NOT NULL DEFAULT 0,
        salario_liquido numeric(12,2) NOT NULL DEFAULT 0,
        inss_employee numeric(12,2) DEFAULT 0,
        irrf numeric(12,2) DEFAULT 0,
        fgts numeric(12,2) DEFAULT 0,
        rubricas jsonb,
        status varchar(20) NOT NULL DEFAULT 'calculated',
        notes text,
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_hr_payroll_entries_period ON hr_payroll_entries(period_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_hr_payroll_entries_employee ON hr_payroll_entries(employee_id);`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_payroll_entries_period_employee ON hr_payroll_entries(period_id, employee_id);`);

    // ── HR — Ponto ───────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_timesheet_periods (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        cliente_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        employee_id varchar NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        period_start date NOT NULL,
        period_end date NOT NULL,
        source varchar(20) NOT NULL DEFAULT 'manual',
        scheduled_hours numeric(7,2) DEFAULT 0,
        worked_hours numeric(7,2) DEFAULT 0,
        absence_hours numeric(7,2) DEFAULT 0,
        overtime_hours numeric(7,2) DEFAULT 0,
        bank_balance numeric(7,2) DEFAULT 0,
        absent_days integer DEFAULT 0,
        entries jsonb,
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_hr_timesheet_tenant_cliente ON hr_timesheet_periods(tenant_id, cliente_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_hr_timesheet_employee ON hr_timesheet_periods(employee_id, period_start);`);

    // ── HR — Account Entries (Conta corrente colaborador) ────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_employee_account_entries (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        employee_id varchar NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        tipo varchar(10) NOT NULL,
        descricao varchar(300) NOT NULL,
        valor numeric(12,2) NOT NULL,
        data_referencia date NOT NULL,
        competencia_ano integer,
        competencia_mes integer,
        categoria varchar(50),
        lancamento_folha_id varchar REFERENCES hr_payroll_entries(id) ON DELETE SET NULL,
        lancamento_control_id varchar REFERENCES lancamentos_financeiros(id) ON DELETE SET NULL,
        origem varchar(30) DEFAULT 'manual',
        created_by varchar REFERENCES users(id),
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_hr_account_employee ON hr_employee_account_entries(employee_id, data_referencia);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_hr_account_tenant ON hr_employee_account_entries(tenant_id);`);

    // ── HR — Import Previews ─────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_import_previews (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        cliente_id varchar NOT NULL,
        tipo varchar(30) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'pending',
        raw_text text,
        parsed_data jsonb,
        validation_errors jsonb,
        created_by varchar REFERENCES users(id),
        expires_at timestamp,
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_hr_import_previews_tenant ON hr_import_previews(tenant_id, cliente_id);`);

    // ── Sociedades (dados empresariais para exportação Domínio) ─────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS sociedades (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        client_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        razao_social varchar(300) NOT NULL,
        nome_fantasia varchar(300),
        cnpj varchar(18),
        inscricao_estadual varchar(30),
        inscricao_municipal varchar(30),
        cep varchar(10),
        logradouro varchar(300),
        numero varchar(20),
        complemento varchar(100),
        bairro varchar(100),
        cidade varchar(100),
        estado varchar(2),
        email varchar(300),
        telefone varchar(30),
        regime_tributario varchar(30),
        codigo_dominio varchar(20),
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sociedades_tenant ON sociedades(tenant_id);`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_sociedades_client_id ON sociedades(tenant_id, client_id);`);

    // ── HR Import Previews + Rubric Mappings (Sprint RH-3) ──────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_import_previews (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        cliente_id varchar NOT NULL,
        tipo varchar(30) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'pending',
        raw_text text,
        parsed_data jsonb,
        validation_errors jsonb,
        created_by varchar REFERENCES users(id),
        expires_at timestamp,
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_hr_import_previews_tenant ON hr_import_previews(tenant_id, cliente_id);`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_rubric_mappings (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        dominio_code varchar(10) NOT NULL,
        dominio_desc varchar(300),
        arcadia_rubrica varchar(100) NOT NULL,
        tipo varchar(10) NOT NULL DEFAULT 'desconto',
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_hr_rubric_tenant ON hr_rubric_mappings(tenant_id);`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_rubric_tenant_code ON hr_rubric_mappings(tenant_id, dominio_code);`);

    // ── Colunas retroativas (schema Drizzle ≠ CREATE TABLE original) ─────────
    // contas_bancarias: schema usa "ativo", migration criou "ativa"
    await client.query(`ALTER TABLE contas_bancarias ADD COLUMN IF NOT EXISTS ativo boolean DEFAULT true;`);
    // Sincroniza ativo a partir do valor de ativa (idempotente)
    await client.query(`UPDATE contas_bancarias SET ativo = ativa WHERE ativo IS DISTINCT FROM ativa AND ativa IS NOT NULL;`);

    // lancamentos_financeiros: schema usa "documento", migration criou "numero_documento"
    await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS documento varchar(80);`);
    // Copia valores existentes de numero_documento → documento (idempotente)
    await client.query(`UPDATE lancamentos_financeiros SET documento = LEFT(numero_documento, 80) WHERE documento IS NULL AND numero_documento IS NOT NULL;`);

    // Outras colunas do schema Drizzle ausentes no CREATE TABLE original
    await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS data_emissao date;`);
    await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS origem varchar(20) DEFAULT 'manual';`);
    await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS criado_por_ia boolean DEFAULT false;`);
    await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS grupo_id varchar;`);
    await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS recovery_installment_id varchar;`);

    // contas_bancarias: colunas adicionais do schema Drizzle
    await client.query(`ALTER TABLE contas_bancarias ADD COLUMN IF NOT EXISTS apelido varchar(100);`);
    await client.query(`ALTER TABLE contas_bancarias ADD COLUMN IF NOT EXISTS responsavel_id varchar;`);
    await client.query(`ALTER TABLE contas_bancarias ADD COLUMN IF NOT EXISTS grupo_id varchar;`);
    await client.query(`ALTER TABLE contas_bancarias ADD COLUMN IF NOT EXISTS nome varchar(200);`);

    // ── grupos_empresariais: colunas do schema Drizzle ausentes na criação original ──
    await client.query(`ALTER TABLE grupos_empresariais ADD COLUMN IF NOT EXISTS tipo varchar(30) NOT NULL DEFAULT 'holding';`);
    await client.query(`ALTER TABLE grupos_empresariais ADD COLUMN IF NOT EXISTS matriz_cliente_id varchar;`);
    await client.query(`ALTER TABLE grupos_empresariais_membros ADD COLUMN IF NOT EXISTS participacao numeric(6,3);`);

    // ── tenant_grupos: FK de sincronização com Control ──────────────────────
    await client.query(`ALTER TABLE tenant_grupos ADD COLUMN IF NOT EXISTS grupo_control_id VARCHAR(100) DEFAULT NULL;`);
    console.log('[migration] tenant_grupos.grupo_control_id: OK');

    // ── Contabilidade — Partidas Dobradas (Sprint C8) ──────────────────
    // A tabela pode já existir com estrutura diferente — usar CREATE TABLE IF NOT EXISTS
    // e depois ALTER TABLE para adicionar colunas que podem faltar.
    await client.query(`
      CREATE TABLE IF NOT EXISTS lancamentos_contabeis (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        cliente_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        historico text NOT NULL DEFAULT '',
        status varchar(20) NOT NULL DEFAULT 'pendente',
        origem varchar(20) NOT NULL DEFAULT 'manual',
        total_debito numeric(15,2) NOT NULL DEFAULT 0,
        total_credito numeric(15,2) NOT NULL DEFAULT 0,
        criado_por varchar REFERENCES users(id),
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      );
    `);
    // Adicionar colunas do schema Drizzle que podem não existir na tabela antiga
    await client.query(`ALTER TABLE lancamentos_contabeis ADD COLUMN IF NOT EXISTS data date;`);
    await client.query(`ALTER TABLE lancamentos_contabeis ADD COLUMN IF NOT EXISTS grupo_id varchar;`);
    await client.query(`ALTER TABLE lancamentos_contabeis ADD COLUMN IF NOT EXISTS numero_doc varchar(80);`);
    await client.query(`ALTER TABLE lancamentos_contabeis ADD COLUMN IF NOT EXISTS lote varchar(80);`);
    await client.query(`ALTER TABLE lancamentos_contabeis ADD COLUMN IF NOT EXISTS periodo_id varchar;`);
    await client.query(`ALTER TABLE lancamentos_contabeis ADD COLUMN IF NOT EXISTS observacoes text;`);
    // Retrocompatibilidade: copia data_lancamento → data se coluna antiga existir
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lancamentos_contabeis' AND column_name='data_lancamento') THEN
          UPDATE lancamentos_contabeis SET data = data_lancamento::date WHERE data IS NULL AND data_lancamento IS NOT NULL;
        END IF;
      END $$;
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_lanc_contabeis_tenant_cliente ON lancamentos_contabeis(tenant_id, cliente_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_lanc_contabeis_data ON lancamentos_contabeis(tenant_id, "data") WHERE "data" IS NOT NULL;`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS partidas_contabeis (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        lancamento_contabil_id varchar NOT NULL REFERENCES lancamentos_contabeis(id) ON DELETE CASCADE,
        plano_conta_id varchar NOT NULL REFERENCES planos_contas(id),
        centro_custo_id varchar REFERENCES centros_custo(id),
        tipo varchar(1) NOT NULL,
        valor numeric(15,2) NOT NULL,
        rateio numeric(6,3) DEFAULT 100.000,
        descricao text,
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_partidas_lanc ON partidas_contabeis(lancamento_contabil_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_partidas_tenant_conta ON partidas_contabeis(tenant_id, plano_conta_id);`);

    // ── Carteiras de cobrança (Sprint C10) ────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS carteiras_cobranca (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        cliente_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        conta_bancaria_id varchar REFERENCES contas_bancarias(id) ON DELETE SET NULL,
        nome varchar(200) NOT NULL,
        codigo varchar(10),
        tipo varchar(30) DEFAULT 'boleto',
        ativa boolean DEFAULT true,
        configuracao jsonb,
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_carteiras_cobranca_tenant ON carteiras_cobranca(tenant_id, cliente_id);`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS contas_bancarias_carteiras (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        conta_bancaria_id varchar NOT NULL REFERENCES contas_bancarias(id) ON DELETE CASCADE,
        carteira_id varchar NOT NULL REFERENCES carteiras_cobranca(id) ON DELETE CASCADE,
        created_at timestamp DEFAULT NOW()
      );
    `);

    // ── Conciliações bancárias (Sprint C6) ────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS conciliacoes (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        conta_bancaria_id varchar NOT NULL REFERENCES contas_bancarias(id) ON DELETE CASCADE,
        lancamento_financeiro_id varchar REFERENCES lancamentos_financeiros(id) ON DELETE SET NULL,
        movimentacao_bancaria_id varchar REFERENCES movimentacoes_bancarias(id) ON DELETE SET NULL,
        data_conciliacao timestamp DEFAULT NOW(),
        conciliado_por varchar REFERENCES users(id),
        observacoes text,
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_conciliacoes_tenant ON conciliacoes(tenant_id, conta_bancaria_id);`);

    // ── IBS/CBS Lançamentos (Sprint IBS-1) ────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS ibscbs_lancamentos (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        cliente_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        lancamento_financeiro_id varchar REFERENCES lancamentos_financeiros(id) ON DELETE SET NULL,
        operacao varchar(30) NOT NULL,
        ano integer NOT NULL,
        base_calculo numeric(15,2) NOT NULL DEFAULT 0,
        aliquota_ibs numeric(8,4) DEFAULT 0,
        aliquota_cbs numeric(8,4) DEFAULT 0,
        valor_ibs numeric(15,2) DEFAULT 0,
        valor_cbs numeric(15,2) DEFAULT 0,
        regime varchar(30),
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ibscbs_tenant_cliente ON ibscbs_lancamentos(tenant_id, cliente_id);`);

    // ── Sprint C-E01: segmento do tenant ─────────────────────────────────
    await client.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS segmento varchar(50) DEFAULT 'generic';`);

    // ── Sprint C-E07: centros_custo raiz e rateio ─────────────────────────
    await client.query(`ALTER TABLE centros_custo ADD COLUMN IF NOT EXISTS marca_rateio boolean DEFAULT false;`);
    await client.query(`ALTER TABLE centros_custo ADD COLUMN IF NOT EXISTS centro_custo_raiz boolean DEFAULT false;`);

    // ── Sprint C-E02: engineering_projects + history ──────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS engineering_projects (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        numero varchar(30) NOT NULL,
        titulo varchar(300) NOT NULL,
        cliente_id varchar,
        cliente_nome varchar(300),
        cliente_externo_nome varchar(300),
        descricao text,
        etapa varchar(40) NOT NULL DEFAULT 'venda',
        status varchar(20) NOT NULL DEFAULT 'ativo',
        valor_contrato numeric(15,2),
        percentual_entregue integer DEFAULT 0,
        data_inicio date,
        data_fim date,
        os_numero varchar(50),
        proposal_id integer,
        responsavel_id varchar,
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_eng_proj_numero ON engineering_projects(tenant_id, numero);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_eng_proj_tenant ON engineering_projects(tenant_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_eng_proj_etapa ON engineering_projects(tenant_id, etapa);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_eng_proj_cliente ON engineering_projects(tenant_id, cliente_id);`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS engineering_project_history (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        projeto_id varchar NOT NULL,
        etapa_anterior varchar(40),
        etapa_atual varchar(40) NOT NULL,
        observacoes text,
        alterado_por varchar,
        created_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_eng_hist_projeto ON engineering_project_history(projeto_id);`);

    // ── Sprint C-E03: lancamentos_financeiros ← projeto ──────────────────
    await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS projeto_id varchar;`);
    await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS os_numero varchar(50);`);
    await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS pessoa_id varchar;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_lanc_projeto ON lancamentos_financeiros(projeto_id) WHERE projeto_id IS NOT NULL;`);

    // ── Sprint C-E08: Motor de Rateio Automático ──────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS control_rateio_config (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        grupo_id varchar,
        centro_custo_id varchar NOT NULL,
        criterio varchar(30) NOT NULL DEFAULT 'percentual',
        percentual_impacto numeric(6,3) NOT NULL DEFAULT 100,
        percentual_saf numeric(6,3) NOT NULL DEFAULT 0,
        observacoes text,
        ativo boolean NOT NULL DEFAULT true,
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rateio_cfg_tenant ON control_rateio_config(tenant_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rateio_cfg_cc ON control_rateio_config(centro_custo_id);`);

    // Lançamentos de rateio filhos
    await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS origem_rateio_id varchar;`);
    await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS empresa_rateio varchar(20);`);
    await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS tipo_lancamento varchar(20) DEFAULT 'normal';`);

    // Templates recorrência: projetoId + aplicarRateio + variavel_faixa
    await client.query(`ALTER TABLE templates_recorrencia ADD COLUMN IF NOT EXISTS projeto_id varchar;`);
    await client.query(`ALTER TABLE templates_recorrencia ADD COLUMN IF NOT EXISTS aplicar_rateio boolean DEFAULT false;`);
    await client.query(`ALTER TABLE templates_recorrencia ADD COLUMN IF NOT EXISTS tipo_valor varchar(20) DEFAULT 'fixo';`);
    await client.query(`ALTER TABLE templates_recorrencia ADD COLUMN IF NOT EXISTS valor_minimo numeric(15,2);`);
    await client.query(`ALTER TABLE templates_recorrencia ADD COLUMN IF NOT EXISTS valor_maximo numeric(15,2);`);

    // Sprint C-E05: bases de receita por projeto
    await client.query(`
      CREATE TABLE IF NOT EXISTS engineering_projeto_bases_receita (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id varchar NOT NULL,
        cliente_id varchar,
        projeto_id varchar NOT NULL,
        etapa varchar(50) NOT NULL DEFAULT 'mobilizacao',
        descricao varchar(300),
        valor_previsto numeric(15,2) NOT NULL DEFAULT 0,
        competencia date,
        status varchar(20) NOT NULL DEFAULT 'previsto',
        lancamento_id varchar,
        created_at timestamp DEFAULT NOW(),
        updated_at timestamp DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_bases_receita_projeto ON engineering_projeto_bases_receita(projeto_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_bases_receita_tenant ON engineering_projeto_bases_receita(tenant_id);`);

    // ── Colunas comerciais em pessoas (schema v2) ────────────────────────
    // Adicionadas após criação inicial da tabela — idempotentes via IF NOT EXISTS
    await client.query(`ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS codigo_externo varchar(100);`);
    await client.query(`ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS pessoa_grupo varchar(100);`);
    await client.query(`ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS vendedor_padrao varchar(150);`);
    await client.query(`ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS categoria varchar(100);`);
    await client.query(`ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS tabela_preco varchar(100);`);
    await client.query(`ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS limite_credito numeric(14,2);`);
    await client.query(`ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS periodicidade_venda_compra integer;`);
    await client.query(`ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS valor_minimo_compra numeric(14,2);`);
    await client.query(`ALTER TABLE pessoas ADD COLUMN IF NOT EXISTS legacy_client_id varchar;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_pessoas_legacy_client ON pessoas(legacy_client_id) WHERE legacy_client_id IS NOT NULL;`);

    // ── SOE-03: pessoa_id em xos_contacts ───────────────────────────────────
    await client.query(`ALTER TABLE xos_contacts ADD COLUMN IF NOT EXISTS pessoa_id VARCHAR;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_xos_contacts_pessoa_id ON xos_contacts(pessoa_id) WHERE pessoa_id IS NOT NULL;`);

    // ── CTL-01: Sub-contas de cartão corporativo em contas_bancarias ──────────
    await client.query(`ALTER TABLE contas_bancarias ADD COLUMN IF NOT EXISTS parent_conta_id VARCHAR REFERENCES contas_bancarias(id) ON DELETE SET NULL;`);
    await client.query(`ALTER TABLE contas_bancarias ADD COLUMN IF NOT EXISTS pessoa_id VARCHAR;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contas_bancarias_parent ON contas_bancarias(parent_conta_id) WHERE parent_conta_id IS NOT NULL;`);
    console.log('[migration] contas_bancarias: parent_conta_id + pessoa_id: OK');

    // ── CTL-02: AR enriquecida — código projeto, parceiro, tipo recorrência ───
    await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS projeto_codigo VARCHAR(50);`);
    await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS parceiro VARCHAR(100);`);
    await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS tipo_recorrencia_ar VARCHAR(30);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_lanc_parceiro ON lancamentos_financeiros(parceiro) WHERE parceiro IS NOT NULL;`);
    console.log('[migration] lancamentos_financeiros: projeto_codigo + parceiro + tipo_recorrencia_ar: OK');

    // ── Fix: renomear lancamento_financeiro_id → lancamento_id em rateios_cc ─
    // Corrige mismatch entre a migration original e o schema Drizzle.
    // Idempotente: IF EXISTS garante que pode rodar múltiplas vezes sem erro.
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'rateios_cc'
            AND column_name = 'lancamento_financeiro_id'
        ) THEN
          ALTER TABLE rateios_cc
            RENAME COLUMN lancamento_financeiro_id TO lancamento_id;

          DROP INDEX IF EXISTS idx_rateios_cc_lanc;
          CREATE INDEX IF NOT EXISTS idx_rateios_cc_lanc ON rateios_cc(lancamento_id);

          RAISE NOTICE 'rateios_cc: coluna renomeada lancamento_financeiro_id → lancamento_id';
        ELSE
          RAISE NOTICE 'rateios_cc: coluna lancamento_id já existe, nada a fazer';
        END IF;
      END
      $$;
    `);
    console.log('[migration] rateios_cc.lancamento_id: OK');

    // ── Sprint MP-PERFIS: segmento por empresa ────────────────────────────
    await client.query(`ALTER TABLE tenant_empresas ADD COLUMN IF NOT EXISTS segmento varchar(50);`);

    // ── USR-01-A: override de permissão individual ────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_permission_overrides (
        id            SERIAL PRIMARY KEY,
        tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id       VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        permission_code TEXT NOT NULL,
        granted       BOOLEAN NOT NULL DEFAULT true,
        reason        TEXT,
        created_by    VARCHAR REFERENCES users(id),
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, user_id, permission_code)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_upo_user ON user_permission_overrides(user_id, tenant_id)`);
    console.log('[migration] user_permission_overrides: OK');

    // ── USR-01-B: restrição de acesso por empresa do grupo ────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_user_empresa_access (
        id            SERIAL PRIMARY KEY,
        tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id       VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        empresa_id    INTEGER NOT NULL REFERENCES tenant_empresas(id) ON DELETE CASCADE,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by    VARCHAR REFERENCES users(id),
        UNIQUE(tenant_id, user_id, empresa_id)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tuea_user ON tenant_user_empresa_access(user_id, tenant_id)`);
    console.log('[migration] tenant_user_empresa_access: OK');

    // ── USR-01-C: colunas extras em permissions ───────────────────────────
    await client.query(`
      ALTER TABLE permissions
        ADD COLUMN IF NOT EXISTS ui_key TEXT,
        ADD COLUMN IF NOT EXISTS ui_action TEXT DEFAULT 'hide',
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS grupo TEXT
    `);
    console.log('[migration] permissions extra cols: OK');

    // ── DEC-02: Módulo Decor — Decoração, Cortinas e Persianaria ─────────────

    // 1. Pedidos técnicos
    await client.query(`
      CREATE TABLE IF NOT EXISTS cortiart_pedidos (
        id                          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        tenant_id                   VARCHAR NOT NULL,
        numero_pedido               VARCHAR(30),
        status                      VARCHAR(30) NOT NULL DEFAULT 'rascunho',
        cliente_id                  VARCHAR,
        cliente_nome                VARCHAR,
        cliente_cpf                 VARCHAR(20),
        especificador_id            VARCHAR,
        cliente_final_id            VARCHAR,
        xos_contact_id              VARCHAR,
        xos_deal_id                 VARCHAR,
        endereco_obra               TEXT,
        cidade_obra                 VARCHAR,
        valor_subtotal              NUMERIC(15,2) DEFAULT 0,
        valor_desconto              NUMERIC(15,2) DEFAULT 0,
        valor_mao_obra              NUMERIC(15,2) DEFAULT 0,
        valor_final                 NUMERIC(15,2) DEFAULT 0,
        data_medicao                DATE,
        data_instalacao             DATE,
        data_efetivacao             DATE,
        data_expedicao              DATE,
        analise_tecnica_status      VARCHAR(20) DEFAULT 'pendente',
        analise_tecnica_motivo      TEXT,
        analise_tecnica_responsavel VARCHAR,
        analise_tecnica_data        TIMESTAMP,
        observacoes                 TEXT,
        referencia_externa          VARCHAR,
        negociacao                  TEXT,
        created_by                  VARCHAR,
        created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cp_tenant_status ON cortiart_pedidos(tenant_id, status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cp_cliente ON cortiart_pedidos(tenant_id, cliente_id)`);
    console.log('[migration] cortiart_pedidos: OK');

    // 2. Medições por ambiente/vão
    await client.query(`
      CREATE TABLE IF NOT EXISTS cortiart_medicoes (
        id               VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        pedido_id        VARCHAR NOT NULL REFERENCES cortiart_pedidos(id) ON DELETE CASCADE,
        tenant_id        VARCHAR NOT NULL,
        ambiente         VARCHAR,
        largura_vao      NUMERIC(8,3),
        altura_vao       NUMERIC(8,3),
        quantidade_vaos  INTEGER DEFAULT 1,
        observacoes      TEXT,
        fotos            TEXT[],
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cm_pedido ON cortiart_medicoes(pedido_id)`);
    console.log('[migration] cortiart_medicoes: OK');

    // 3. Itens configurados do pedido
    await client.query(`
      CREATE TABLE IF NOT EXISTS cortiart_itens_pedido (
        id               VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        pedido_id        VARCHAR NOT NULL REFERENCES cortiart_pedidos(id) ON DELETE CASCADE,
        medicao_id       VARCHAR REFERENCES cortiart_medicoes(id) ON DELETE SET NULL,
        tenant_id        VARCHAR NOT NULL,
        tipo_produto     VARCHAR(40),
        produto          VARCHAR,
        ambiente         VARCHAR,
        sistema          VARCHAR,
        tecido           VARCHAR,
        largura          NUMERIC(8,3),
        altura           NUMERIC(8,3),
        quantidade       NUMERIC(8,3) DEFAULT 1,
        metragem_tecido  NUMERIC(10,3),
        coeficiente      NUMERIC(6,3),
        valor_unitario   NUMERIC(15,2) DEFAULT 0,
        valor_mao_obra   NUMERIC(15,2) DEFAULT 0,
        valor_total      NUMERIC(15,2) DEFAULT 0,
        outros           TEXT,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cip_pedido ON cortiart_itens_pedido(pedido_id)`);
    console.log('[migration] cortiart_itens_pedido: OK');

    // 4. OS de produção (ateliê)
    await client.query(`
      CREATE TABLE IF NOT EXISTS cortiart_os_producao (
        id               VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        pedido_id        VARCHAR NOT NULL REFERENCES cortiart_pedidos(id) ON DELETE CASCADE,
        tenant_id        VARCHAR NOT NULL,
        item_id          VARCHAR REFERENCES cortiart_itens_pedido(id) ON DELETE SET NULL,
        ambiente         VARCHAR,
        etapa            VARCHAR(30),
        status           VARCHAR(20) DEFAULT 'pendente',
        tecido_id        INTEGER,
        metragem_tecido  NUMERIC(10,3),
        responsavel_id   VARCHAR,
        data_inicio      TIMESTAMP,
        data_conclusao   TIMESTAMP,
        observacoes      TEXT,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cosp_pedido ON cortiart_os_producao(pedido_id, status)`);
    console.log('[migration] cortiart_os_producao: OK');

    // 5. OS de instalação
    await client.query(`
      CREATE TABLE IF NOT EXISTS cortiart_os_instalacao (
        id                   VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        pedido_id            VARCHAR NOT NULL REFERENCES cortiart_pedidos(id) ON DELETE CASCADE,
        tenant_id            VARCHAR NOT NULL,
        instalador_id        VARCHAR,
        status               VARCHAR(20) DEFAULT 'agendada',
        data_agendamento     DATE,
        hora_agendamento     VARCHAR(5),
        data_instalacao      DATE,
        data_conclusao       TIMESTAMP,
        endereco_instalacao  TEXT,
        observacoes          TEXT,
        termo_assinado       BOOLEAN DEFAULT false,
        termo_assinado_em    TIMESTAMP,
        created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_coi_pedido ON cortiart_os_instalacao(pedido_id, status)`);
    console.log('[migration] cortiart_os_instalacao: OK');

    // 6. Checklist por pedido
    await client.query(`
      CREATE TABLE IF NOT EXISTS cortiart_checklist (
        id                   VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        pedido_id            VARCHAR NOT NULL UNIQUE REFERENCES cortiart_pedidos(id) ON DELETE CASCADE,
        tenant_id            VARCHAR NOT NULL,
        medicao_ok           BOOLEAN DEFAULT false,
        orcamento_aprovado   BOOLEAN DEFAULT false,
        pagamento_entrada    BOOLEAN DEFAULT false,
        material_recebido    BOOLEAN DEFAULT false,
        producao_ok          BOOLEAN DEFAULT false,
        etiquetas_ok         BOOLEAN DEFAULT false,
        instalacao_agendada  BOOLEAN DEFAULT false,
        instalacao_concluida BOOLEAN DEFAULT false,
        termo_assinado       BOOLEAN DEFAULT false,
        nfe_emitida          BOOLEAN DEFAULT false,
        pagamento_saldo      BOOLEAN DEFAULT false,
        observacoes          TEXT,
        updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[migration] cortiart_checklist: OK');

    // 7. Tabela de coeficientes de tecido
    await client.query(`
      CREATE TABLE IF NOT EXISTS cortiart_coeficientes (
        id           SERIAL PRIMARY KEY,
        sistema      VARCHAR(60) NOT NULL,
        faixa        VARCHAR(20) NOT NULL,
        coeficiente  NUMERIC(6,3) NOT NULL,
        descricao    TEXT,
        UNIQUE(sistema, faixa)
      )
    `);
    console.log('[migration] cortiart_coeficientes: OK');

    // 8. Catálogo (tecidos, sistemas, persianas, acessórios, mão de obra)
    await client.query(`
      CREATE TABLE IF NOT EXISTS cortiart_catalogo (
        id               SERIAL PRIMARY KEY,
        tenant_id        VARCHAR,
        codigo           VARCHAR(30),
        nome             VARCHAR NOT NULL,
        descricao        TEXT,
        categoria        VARCHAR(30),
        colecao          VARCHAR,
        fornecedor_id    INTEGER,
        unidade          VARCHAR(10) DEFAULT 'm',
        valor_unitario   NUMERIC(15,2) DEFAULT 0,
        status_comercial VARCHAR(20) DEFAULT 'ativo',
        data_previsao    DATE,
        ncm              VARCHAR(12),
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cc_tenant_cat ON cortiart_catalogo(tenant_id, categoria, status_comercial)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cc_codigo ON cortiart_catalogo(codigo)`);
    console.log('[migration] cortiart_catalogo: OK');

    // 9. Histórico de análise técnica
    await client.query(`
      CREATE TABLE IF NOT EXISTS cortiart_analise_tecnica (
        id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        pedido_id   VARCHAR NOT NULL REFERENCES cortiart_pedidos(id) ON DELETE CASCADE,
        tenant_id   VARCHAR NOT NULL,
        acao        VARCHAR(30) NOT NULL,
        usuario_id  VARCHAR,
        observacao  TEXT,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cat_pedido ON cortiart_analise_tecnica(pedido_id)`);
    console.log('[migration] cortiart_analise_tecnica: OK');

    // ALTER TABLE — colunas extras em tabelas existentes (tolerante a falha se tabela não existir)
    await client.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS cortiart_pedido_id VARCHAR`).catch(() => {});
    await client.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS tipo_compra VARCHAR(20)`).catch(() => {});
    await client.query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS especificacao_tecnica TEXT`).catch(() => {});
    await client.query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS unidade VARCHAR(10)`).catch(() => {});
    await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS pedido_externo_id VARCHAR`).catch(() => {});
    await client.query(`ALTER TABLE lancamentos_financeiros ADD COLUMN IF NOT EXISTS pedido_externo_tipo VARCHAR(30)`).catch(() => {});
    console.log('[migration] ALTER TABLE purchase_orders / lancamentos_financeiros: OK');

    // ── DEC-EXP-01: Expansão cortiart_pedidos ──────────────────────────────
    await client.query(`ALTER TABLE cortiart_pedidos ADD COLUMN IF NOT EXISTS torre VARCHAR(20)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_pedidos ADD COLUMN IF NOT EXISTS apartamento VARCHAR(20)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_pedidos ADD COLUMN IF NOT EXISTS data_aniversario DATE`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_pedidos ADD COLUMN IF NOT EXISTS vendedor_nome VARCHAR(100)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_pedidos ADD COLUMN IF NOT EXISTS horario_instalacao VARCHAR(20)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_pedidos ADD COLUMN IF NOT EXISTS condicao_pagamento_id VARCHAR`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_pedidos ADD COLUMN IF NOT EXISTS tipo_pagamento_codigo VARCHAR(3)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_pedidos ADD COLUMN IF NOT EXISTS num_parcelas SMALLINT DEFAULT 1`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_pedidos ADD COLUMN IF NOT EXISTS sale_order_id VARCHAR`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_pedidos ADD COLUMN IF NOT EXISTS prazo_entrega_dias SMALLINT DEFAULT 30`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_pedidos ADD COLUMN IF NOT EXISTS status_obra VARCHAR(20)`).catch(() => {});
    console.log('[migration] DEC-EXP-01 cortiart_pedidos expand: OK');

    // ── DEC-EXP-01: Expansão cortiart_itens_pedido (persiana) ──────────────
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS fornecedor_persiana VARCHAR(100)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS colecao_cor VARCHAR(100)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS acabamento VARCHAR(50)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS cor_pecas VARCHAR(50)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS alt_comando NUMERIC(6,3)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS lado_a_lado VARCHAR(1)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS acionamento VARCHAR(30)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS tipo_instalacao VARCHAR(20)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS lado_comando VARCHAR(2)`).catch(() => {});
    // ── DEC-EXP-01: Expansão cortiart_itens_pedido (cortina Wave) ──────────
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS divisao_a NUMERIC(6,3)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS divisao_b NUMERIC(6,3)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS modelo_cortina VARCHAR(50)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS tecido_codigo VARCHAR(30)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS tecido_lado VARCHAR(20)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS tecido_forro_codigo VARCHAR(30)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS tecido_forro_lado_a VARCHAR(20)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS tecido_forro_lado_b VARCHAR(20)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS barra_codigo VARCHAR(30)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS barra_observacao VARCHAR(50)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS barra_medida VARCHAR(20)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS barra_detalhes VARCHAR(50)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS alt_forro NUMERIC(6,3)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS trilho_tipo VARCHAR(50)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS trilho_medida NUMERIC(6,3)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS cortineiro_tipo VARCHAR(30)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS cortineiro_fixacao VARCHAR(30)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS altura_piso_teto_folga NUMERIC(5,2)`).catch(() => {});
    console.log('[migration] DEC-EXP-01 cortiart_itens_pedido expand: OK');
    // ── DEC-EXP-07: Expansão cortiart_itens_pedido (outros produtos) ────────
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS comprimento NUMERIC(6,3)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS referencia_produto VARCHAR(80)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS formato_tapete VARCHAR(40)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_itens_pedido ADD COLUMN IF NOT EXISTS observacao_tecnica TEXT`).catch(() => {});
    console.log('[migration] DEC-EXP-07 cortiart_itens_pedido expand: OK');

    // ── DEC-EXP-01: Expansão cortiart_checklist ────────────────────────────
    await client.query(`ALTER TABLE cortiart_checklist ADD COLUMN IF NOT EXISTS pedido_fornecedor_persiana BOOLEAN DEFAULT false`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_checklist ADD COLUMN IF NOT EXISTS material_tecido_recebido BOOLEAN DEFAULT false`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_checklist ADD COLUMN IF NOT EXISTS material_persiana_recebido BOOLEAN DEFAULT false`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_checklist ADD COLUMN IF NOT EXISTS producao_cortinas_ok BOOLEAN DEFAULT false`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_checklist ADD COLUMN IF NOT EXISTS nfe_fornecedor_recebida BOOLEAN DEFAULT false`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_checklist ADD COLUMN IF NOT EXISTS ambiente_apto BOOLEAN DEFAULT false`).catch(() => {});
    console.log('[migration] DEC-EXP-01 cortiart_checklist expand: OK');

    // ── DEC-EXP-01: Expansão cortiart_catalogo ─────────────────────────────
    await client.query(`ALTER TABLE cortiart_catalogo ADD COLUMN IF NOT EXISTS fornecedor_padrao VARCHAR(100)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_catalogo ADD COLUMN IF NOT EXISTS acabamento_padrao VARCHAR(50)`).catch(() => {});
    await client.query(`ALTER TABLE cortiart_catalogo ADD COLUMN IF NOT EXISTS tipo_acionamento VARCHAR(30)`).catch(() => {});
    console.log('[migration] DEC-EXP-01 cortiart_catalogo expand: OK');

    // ── DEC-EXP-01: Nova tabela cortiart_parcelas ───────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS cortiart_parcelas (
        id              VARCHAR PRIMARY KEY,
        pedido_id       VARCHAR NOT NULL REFERENCES cortiart_pedidos(id) ON DELETE CASCADE,
        tenant_id       VARCHAR NOT NULL,
        sequencia       SMALLINT NOT NULL,
        total_parcelas  SMALLINT NOT NULL,
        valor           NUMERIC(15,2) NOT NULL,
        vencimento      DATE,
        forma_pagamento VARCHAR(3),
        status          VARCHAR(20) NOT NULL DEFAULT 'pendente',
        lancamento_id   VARCHAR,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cparc_pedido ON cortiart_parcelas(pedido_id)`);
    console.log('[migration] cortiart_parcelas: OK');

    // ── DEC-EXP-01: Nova tabela cortiart_fornecedores_pedido ───────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS cortiart_fornecedores_pedido (
        id               VARCHAR PRIMARY KEY,
        pedido_id        VARCHAR NOT NULL REFERENCES cortiart_pedidos(id) ON DELETE CASCADE,
        item_id          VARCHAR REFERENCES cortiart_itens_pedido(id) ON DELETE SET NULL,
        tenant_id        VARCHAR NOT NULL,
        fornecedor_nome  VARCHAR(100),
        data_envio       DATE,
        status           VARCHAR(30) NOT NULL DEFAULT 'solicitado',
        previsao_entrega DATE,
        observacoes      TEXT,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cfp_pedido ON cortiart_fornecedores_pedido(pedido_id)`);
    console.log('[migration] cortiart_fornecedores_pedido: OK');

    // Seed warehouse "Ateliê Cortiart" (só se a tabela existir)
    await client.query(`
      INSERT INTO retail_warehouses (name, code, type, is_active)
      VALUES ('Ateliê Cortiart', 'ATELIE_CORTIART', 'producao', true)
      ON CONFLICT (code) DO NOTHING
    `).catch(() => {});
    console.log('[migration] seed retail_warehouses Ateliê Cortiart: OK');

    // FIX-01: ponte engineering_projects ↔ projects (Hub)
    await client.query(`ALTER TABLE engineering_projects ADD COLUMN IF NOT EXISTS hub_project_id VARCHAR REFERENCES projects(id) ON DELETE SET NULL`).catch(() => {});
    await client.query(`CREATE INDEX IF NOT EXISTS idx_eng_proj_hub ON engineering_projects(hub_project_id)`).catch(() => {});
    console.log('[migration] engineering_projects.hub_project_id: OK');

    // crm_proposals + crm_proposal_items (tabelas podem não ter sido criadas pelo drizzle-kit)
    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_proposals (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        opportunity_id INTEGER REFERENCES crm_opportunities(id) ON DELETE SET NULL,
        client_id INTEGER REFERENCES crm_clients(id) ON DELETE SET NULL,
        customer_name TEXT,
        customer_id VARCHAR,
        code TEXT,
        title TEXT NOT NULL,
        description TEXT,
        version INTEGER DEFAULT 1,
        status TEXT DEFAULT 'draft',
        valid_until TIMESTAMP,
        total_value INTEGER DEFAULT 0,
        currency TEXT DEFAULT 'BRL',
        payment_terms TEXT,
        delivery_terms TEXT,
        notes TEXT,
        internal_notes TEXT,
        sent_at TIMESTAMP,
        viewed_at TIMESTAMP,
        accepted_at TIMESTAMP,
        rejected_at TIMESTAMP,
        rejection_reason TEXT,
        created_by_id VARCHAR REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `).catch((e: any) => console.error('[migration] crm_proposals create error:', e.message));

    await client.query(`
      CREATE TABLE IF NOT EXISTS crm_proposal_items (
        id SERIAL PRIMARY KEY,
        proposal_id INTEGER NOT NULL REFERENCES crm_proposals(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES crm_products(id),
        item_type TEXT DEFAULT 'product',
        name TEXT NOT NULL,
        description TEXT,
        quantity INTEGER DEFAULT 1,
        unit_price INTEGER DEFAULT 0,
        discount INTEGER DEFAULT 0,
        total INTEGER DEFAULT 0,
        order_index INTEGER DEFAULT 0
      )
    `).catch((e: any) => console.error('[migration] crm_proposal_items create error:', e.message));

    // Adicionar colunas novas se a tabela já existia sem elas
    await client.query(`ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS customer_name TEXT`).catch(() => {});
    await client.query(`ALTER TABLE crm_proposals ADD COLUMN IF NOT EXISTS customer_id VARCHAR`).catch(() => {});
    console.log('[migration] crm_proposals + crm_proposal_items: OK');

    await runCartaoMigrations(client);
    await runOrigemRefMigrations(client);
    await runPessoasAjustesMigrations(client);

    // PROJ-01: priority no projeto Hub
    await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'media'`).catch(() => {});
    console.log('[migration] projects.priority (PROJ-01): OK');

    // TIMER-01: colunas started_at / ended_at em project_timesheets
    await client.query(`
      ALTER TABLE project_timesheets
        ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS ended_at   TIMESTAMP
    `).catch(() => {});
    console.log('[migration] project_timesheets started_at/ended_at (TIMER-01): OK');

    // DEP-01: dependências entre tarefas do Hub
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_task_dependencies (
        id            VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id       VARCHAR NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
        depends_on_id VARCHAR NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
        tenant_id     VARCHAR NOT NULL,
        created_at    TIMESTAMP DEFAULT NOW(),
        UNIQUE(task_id, depends_on_id)
      )
    `).catch(() => {});
    await client.query(`CREATE INDEX IF NOT EXISTS idx_dep_task    ON project_task_dependencies(task_id)`).catch(() => {});
    await client.query(`CREATE INDEX IF NOT EXISTS idx_dep_depends ON project_task_dependencies(depends_on_id)`).catch(() => {});
    console.log('[migration] project_task_dependencies (DEP-01): OK');

    // SOE-00: infraestrutura base (soe_events, soe_audit_log, views de compatibilidade)
    await runMigrationSoe00().catch((e: any) =>
      console.error('[migration] SOE-00 error:', e.message)
    );
    console.log('[migration] SOE-00 (soe_events + soe_audit_log + views): OK');

    // CAD-01: cadastros centrais (produto_fiscal, emitentes, tabelas_preco, condicoes_pagamento)
    await runMigrationCad01().catch((e: any) =>
      console.error('[migration] CAD-01 error:', e.message)
    );
    console.log('[migration] CAD-01 (produto_fiscal + emitentes + tabelas_preco + condicoes): OK');

    // FISC-01: separação rg/ie na tabela pessoas + campos contribuinte/consumidor_final
    await runMigrationFisc01().catch((e: any) =>
      console.error('[migration] FISC-01 error:', e.message)
    );
    console.log('[migration] FISC-01 (pessoas: rg + ie + contribuinte + consumidor_final): OK');

    // FISC-02: fiscal_documentos + uf em emitentes_fiscal + FiscalValidator
    await runMigrationFisc02().catch((e: any) =>
      console.error('[migration] FISC-02 error:', e.message)
    );
    console.log('[migration] FISC-02 (fiscal_documentos + emitentes_fiscal.uf): OK');

    // COM-01: sale_quotes, sale_orders, parcelas, eventos + soe_numeracao
    await runMigrationCom01().catch((e: any) =>
      console.error('[migration] COM-01 error:', e.message)
    );
    console.log('[migration] COM-01 (sale_orders + sale_quotes + soe_numeracao): OK');

    // EST-01: depositos, saldos_produto, inventory_movements_core, inventory_lots, inventory_reservations
    await runMigrationEst01().catch((e: any) =>
      console.error('[migration] EST-01 error:', e.message)
    );
    console.log('[migration] EST-01 (depositos + saldos_produto + inventory_movements_core): OK');

    // COMP-01: purchase_invoice_entries, items, installments, validation_results, conferences, relacao_fiscal
    await runMigrationComp01().catch((e: any) =>
      console.error('[migration] COMP-01 error:', e.message)
    );
    console.log('[migration] COMP-01 (purchase_invoice_entries + purchase_conferences + relacao_fiscal_fornecedor): OK');

    console.log("[control-migrations] ✅ Migrações concluídas com sucesso");
  } catch (err) {
    console.error("[control-migrations] ❌ Erro:", err);
    throw err;
  } finally {
    client.release();
  }
}
