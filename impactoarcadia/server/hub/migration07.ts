/**
 * Arcádia Project Hub — Migration HUB-07
 * + Seeds: 5 formulários padrão para Impacto Geologia
 */
import { pool } from "../../db/index";

// ── Definição dos formulários da Impacto ─────────────────────────────────────
const FORM_TEMPLATES = [
  {
    formType: "ficha_campo",
    label: "Ficha de Campo",
    icon: "MapPin",
    projectType: "geologia",
    fields: [
      { id:"ponto",       label:"Identificação do ponto",    type:"text",     required:true,  placeholder:"PM-01" },
      { id:"data_hora",   label:"Data e hora",               type:"datetime", required:true  },
      { id:"geologo",     label:"Geólogo responsável",       type:"text",     required:true  },
      { id:"profundidade",label:"Profundidade (m)",          type:"number",   required:false, unit:"m" },
      { id:"litologia",   label:"Litologia",                 type:"select",   required:true,
        options:["Argila","Areia","Areia argilosa","Argila arenosa","Silte","Rocha","Aterro","Não identificado"] },
      { id:"cor",         label:"Cor",                       type:"text",     required:false },
      { id:"consistencia",label:"Consistência/Compacidade",  type:"select",   required:false,
        options:["Muito mole","Mole","Média","Rígida","Muito rígida","Fofa","Pouco compacta","Compacta","Muito compacta"] },
      { id:"nivel_agua",  label:"Nível d'água (m)",          type:"number",   required:false, unit:"m" },
      { id:"observacoes", label:"Observações técnicas",      type:"textarea", required:false },
      { id:"fotos",       label:"Fotos do ponto",            type:"photo",    required:false },
      { id:"coords",      label:"Coordenadas GPS",           type:"coords",   required:false },
    ],
  },
  {
    formType: "sondagem_spt",
    label: "Sondagem SPT",
    icon: "Drill",
    projectType: "geologia",
    fields: [
      { id:"furo",          label:"Número do furo",           type:"text",     required:true,  placeholder:"SP-01" },
      { id:"data_inicio",   label:"Data de início",           type:"date",     required:true  },
      { id:"data_fim",      label:"Data de término",          type:"date",     required:false },
      { id:"cota_boca",     label:"Cota da boca do furo (m)", type:"number",   required:false, unit:"m" },
      { id:"profundidade_final", label:"Profundidade final (m)", type:"number", required:true, unit:"m" },
      { id:"nivel_agua_m",  label:"Nível d'água (m)",         type:"number",   required:false, unit:"m" },
      { id:"empresa_sonda", label:"Empresa sondadora",        type:"text",     required:false },
      { id:"sondador",      label:"Sondador",                 type:"text",     required:false },
      { id:"amostrador",    label:"Tipo de amostrador",       type:"select",   required:false,
        options:["Padrão","Caixas","Shelby","Denison"] },
      { id:"golpes_spt",    label:"Golpes SPT por metro",     type:"textarea", required:false,
        placeholder:"Profundidade: golpes (0-15, 15-30, 30-45)" },
      { id:"observacoes",   label:"Observações",              type:"textarea", required:false },
      { id:"croqui_fotos",  label:"Croqui / Fotos",          type:"photo",    required:false },
      { id:"coords",        label:"Coordenadas GPS",          type:"coords",   required:false },
    ],
  },
  {
    formType: "coleta_agua",
    label: "Coleta de Água",
    icon: "Droplets",
    projectType: "geologia",
    fields: [
      { id:"ponto_coleta",  label:"Ponto de coleta",          type:"text",     required:true  },
      { id:"data_hora",     label:"Data e hora",              type:"datetime", required:true  },
      { id:"profundidade",  label:"Profundidade de coleta (m)",type:"number",  required:false, unit:"m" },
      { id:"temperatura",   label:"Temperatura da água (°C)", type:"number",   required:false, unit:"°C" },
      { id:"ph",            label:"pH (campo)",               type:"number",   required:false },
      { id:"condutividade", label:"Condutividade (μS/cm)",    type:"number",   required:false, unit:"μS/cm" },
      { id:"oxigenio",      label:"OD (mg/L)",                type:"number",   required:false, unit:"mg/L" },
      { id:"cor_agua",      label:"Cor da água",              type:"select",   required:false,
        options:["Incolor","Amarelada","Esverdeada","Avermelhada","Turva","Escura"] },
      { id:"odor",          label:"Odor",                     type:"select",   required:false,
        options:["Inodora","Sulfuroso","Ferroso","Putrefação","Outro"] },
      { id:"volume_purga",  label:"Volume de purga (L)",      type:"number",   required:false, unit:"L" },
      { id:"frascos",       label:"Nº de frascos coletados",  type:"number",   required:false },
      { id:"analises",      label:"Parâmetros a analisar",    type:"multiselect", required:false,
        options:["Metais pesados","Hidrocarbonetos","Coliformes","pH","DBO","DQO","Nitratos","Sulfatos","Cloretos"] },
      { id:"observacoes",   label:"Observações",              type:"textarea", required:false },
      { id:"fotos",         label:"Fotos",                    type:"photo",    required:false },
      { id:"coords",        label:"Coordenadas GPS",          type:"coords",   required:false },
    ],
  },
  {
    formType: "diario_obra",
    label: "Diário de Obras",
    icon: "BookOpen",
    projectType: null,  // global — serve qualquer tipo de projeto
    fields: [
      { id:"data",           label:"Data",                    type:"date",     required:true  },
      { id:"responsavel",    label:"Responsável",             type:"text",     required:true  },
      { id:"equipe",         label:"Equipe presente",         type:"textarea", required:false,
        placeholder:"Nomes e funções" },
      { id:"clima",          label:"Condição climática",      type:"select",   required:false,
        options:["Ensolarado","Nublado","Chuva leve","Chuva forte","Vento forte"] },
      { id:"atividades",     label:"Atividades executadas",   type:"textarea", required:true  },
      { id:"equipamentos",   label:"Equipamentos utilizados", type:"textarea", required:false },
      { id:"ocorrencias",    label:"Ocorrências / Não conformidades", type:"textarea", required:false },
      { id:"medicoes",       label:"Medições realizadas",     type:"textarea", required:false },
      { id:"visitas",        label:"Visitantes / Fiscalização",type:"text",    required:false },
      { id:"percentual",     label:"Avanço físico do dia (%)",type:"number",   required:false, unit:"%" },
      { id:"proximas",       label:"Atividades para amanhã",  type:"textarea", required:false },
      { id:"fotos",          label:"Fotos do dia",            type:"photo",    required:false },
    ],
  },
  {
    formType: "vistoria_ambiental",
    label: "Vistoria Ambiental",
    icon: "Leaf",
    projectType: "ambiental",
    fields: [
      { id:"area",            label:"Área vistoriada",         type:"text",     required:true  },
      { id:"data_hora",       label:"Data e hora",             type:"datetime", required:true  },
      { id:"responsavel",     label:"Responsável",             type:"text",     required:true  },
      { id:"uso_solo",        label:"Uso e cobertura do solo", type:"select",   required:false,
        options:["Vegetação nativa","Pastagem","Agricultura","Urbano","Corpo d'água","Solo exposto","Mineração"] },
      { id:"presenca_agua",   label:"Presença de corpo d'água",type:"boolean",  required:false },
      { id:"APP",             label:"Área de Preservação Permanente (APP)",type:"boolean", required:false },
      { id:"passivos",        label:"Passivos ambientais identificados", type:"textarea", required:false },
      { id:"flora",           label:"Espécies de flora observadas",      type:"textarea", required:false },
      { id:"fauna",           label:"Espécies de fauna observadas",      type:"textarea", required:false },
      { id:"grau_degradacao", label:"Grau de degradação",     type:"select",   required:false,
        options:["Sem degradação","Baixo","Moderado","Alto","Crítico"] },
      { id:"recomendacoes",   label:"Recomendações",           type:"textarea", required:false },
      { id:"fotos",           label:"Fotos da área",           type:"photo",    required:false },
      { id:"coords",          label:"Coordenadas GPS",         type:"coords",   required:false },
    ],
  },
];

export async function runHub07Migration(): Promise<{ ok: boolean; log: string[] }> {
  const client = await pool.connect();
  const log: string[] = [];
  try {
    await client.query("BEGIN");

    // ── project_form_templates ───────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_form_templates (
        id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id    VARCHAR NOT NULL,
        project_type VARCHAR(30),
        form_type    VARCHAR(40) NOT NULL UNIQUE,
        label        VARCHAR(100) NOT NULL,
        icon         VARCHAR(30) DEFAULT 'FileText',
        fields       JSONB NOT NULL DEFAULT '[]',
        active       BOOLEAN DEFAULT TRUE,
        created_at   TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_form_tmpl_tenant ON project_form_templates(tenant_id)`);
    log.push("✓ TABLE project_form_templates");

    // ── project_field_records ────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_field_records (
        id                 VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id         VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        tenant_id          VARCHAR NOT NULL,
        wbs_node_id        VARCHAR REFERENCES project_wbs_nodes(id) ON DELETE SET NULL,
        task_id            VARCHAR REFERENCES project_tasks(id) ON DELETE SET NULL,
        form_type          VARCHAR(40) NOT NULL,
        collected_by       VARCHAR,
        collected_by_name  VARCHAR(200),
        collected_at       TIMESTAMP,
        latitude           NUMERIC(10,7),
        longitude          NUMERIC(10,7),
        location_name      VARCHAR(200),
        field_data         JSONB NOT NULL DEFAULT '{}',
        attachments        JSONB DEFAULT '[]',
        status             VARCHAR(20) NOT NULL DEFAULT 'rascunho',
        reviewed_by        VARCHAR,
        reviewed_by_name   VARCHAR(200),
        reviewed_at        TIMESTAMP,
        review_notes       TEXT,
        point_id           VARCHAR(50),
        sequence_number    INTEGER,
        notes              TEXT,
        created_at         TIMESTAMP DEFAULT NOW(),
        updated_at         TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_field_project  ON project_field_records(project_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_field_form     ON project_field_records(project_id, form_type)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_field_status   ON project_field_records(project_id, status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_field_tenant   ON project_field_records(tenant_id)`);
    log.push("✓ TABLE project_field_records");

    // ── Seeds: formulários padrão (tenant_id = 'global') ────────────────────
    for (const tpl of FORM_TEMPLATES) {
      await client.query(`
        INSERT INTO project_form_templates (tenant_id, project_type, form_type, label, icon, fields)
        VALUES ('global', $1, $2, $3, $4, $5)
        ON CONFLICT (form_type) DO UPDATE
        SET label = EXCLUDED.label, icon = EXCLUDED.icon, fields = EXCLUDED.fields`,
        [tpl.projectType, tpl.formType, tpl.label, tpl.icon, JSON.stringify(tpl.fields)]
      );
    }
    log.push(`✓ SEEDS: ${FORM_TEMPLATES.length} formulários padrão`);

    await client.query("COMMIT");
    log.push("✓ COMMIT — HUB-07 concluída");
    return { ok: true, log };
  } catch (err: any) {
    await client.query("ROLLBACK");
    return { ok: false, log: [...log, `✗ ${err.message}`] };
  } finally {
    client.release();
  }
}
