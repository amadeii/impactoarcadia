/**
 * Arcádia Suite — Módulo Decor (Decoração, Cortinas e Persianaria)
 * Prefixo de tabelas: cortiart_*
 */
import {
  pgTable, varchar, numeric, integer, timestamp, date,
  boolean, text, serial,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── 1. PEDIDOS ────────────────────────────────────────────────────────────────
export const cortiartPedidos = pgTable("cortiart_pedidos", {
  id:                      varchar("id").primaryKey(),
  tenantId:                varchar("tenant_id").notNull(),
  numeroPedido:            varchar("numero_pedido", { length: 30 }),
  status:                  varchar("status", { length: 30 }).notNull().default("rascunho"),
  clienteId:               varchar("cliente_id"),
  clienteNome:             varchar("cliente_nome"),
  clienteCpf:              varchar("cliente_cpf", { length: 20 }),
  especificadorId:         varchar("especificador_id"),
  clienteFinalId:          varchar("cliente_final_id"),
  xosContactId:            varchar("xos_contact_id"),
  xosDealId:               varchar("xos_deal_id"),
  enderecoObra:            text("endereco_obra"),
  cidadeObra:              varchar("cidade_obra"),
  valorSubtotal:           numeric("valor_subtotal", { precision: 15, scale: 2 }).default("0"),
  valorDesconto:           numeric("valor_desconto", { precision: 15, scale: 2 }).default("0"),
  valorMaoObra:            numeric("valor_mao_obra", { precision: 15, scale: 2 }).default("0"),
  valorFinal:              numeric("valor_final", { precision: 15, scale: 2 }).default("0"),
  dataMedicao:             date("data_medicao"),
  dataInstalacao:          date("data_instalacao"),
  dataEfetivacao:          date("data_efetivacao"),
  dataExpedicao:           date("data_expedicao"),
  analiseTecnicaStatus:    varchar("analise_tecnica_status", { length: 20 }).default("pendente"),
  analiseTecnicaMotivo:    text("analise_tecnica_motivo"),
  analiseTecnicaResponsavel: varchar("analise_tecnica_responsavel"),
  analiseTecnicaData:      timestamp("analise_tecnica_data"),
  observacoes:             text("observacoes"),
  referenciaExterna:       varchar("referencia_externa"),
  negociacao:              text("negociacao"),
  createdBy:               varchar("created_by"),
  createdAt:               timestamp("created_at").defaultNow(),
  updatedAt:               timestamp("updated_at").defaultNow(),
});
export const insertCortiartPedidoSchema = createInsertSchema(cortiartPedidos).omit({ createdAt: true, updatedAt: true });
export type CortiartPedido = typeof cortiartPedidos.$inferSelect;
export type InsertCortiartPedido = z.infer<typeof insertCortiartPedidoSchema>;

// ─── 2. MEDIÇÕES ───────────────────────────────────────────────────────────────
export const cortiartMedicoes = pgTable("cortiart_medicoes", {
  id:              varchar("id").primaryKey(),
  pedidoId:        varchar("pedido_id").notNull(),
  tenantId:        varchar("tenant_id").notNull(),
  ambiente:        varchar("ambiente"),
  larguraVao:      numeric("largura_vao", { precision: 8, scale: 3 }),
  alturaVao:       numeric("altura_vao",  { precision: 8, scale: 3 }),
  quantidadeVaos:  integer("quantidade_vaos").default(1),
  observacoes:     text("observacoes"),
  fotos:           text("fotos").array(),
  createdAt:       timestamp("created_at").defaultNow(),
});
export const insertCortiartMedicaoSchema = createInsertSchema(cortiartMedicoes).omit({ createdAt: true });
export type CortiartMedicao = typeof cortiartMedicoes.$inferSelect;
export type InsertCortiartMedicao = z.infer<typeof insertCortiartMedicaoSchema>;

// ─── 3. ITENS DO PEDIDO ────────────────────────────────────────────────────────
export const cortiartItensPedido = pgTable("cortiart_itens_pedido", {
  id:                varchar("id").primaryKey(),
  pedidoId:          varchar("pedido_id").notNull(),
  medicaoId:         varchar("medicao_id"),
  tenantId:          varchar("tenant_id").notNull(),
  tipoProduto:       varchar("tipo_produto", { length: 40 }),
  produto:           varchar("produto"),
  ambiente:          varchar("ambiente"),
  sistema:           varchar("sistema"),
  tecido:            varchar("tecido"),
  largura:           numeric("largura", { precision: 8, scale: 3 }),
  altura:            numeric("altura",  { precision: 8, scale: 3 }),
  quantidade:        numeric("quantidade", { precision: 8, scale: 3 }).default("1"),
  metragemTecido:    numeric("metragem_tecido", { precision: 10, scale: 3 }),
  coeficiente:       numeric("coeficiente", { precision: 6, scale: 3 }),
  valorUnitario:     numeric("valor_unitario", { precision: 15, scale: 2 }).default("0"),
  valorMaoObra:      numeric("valor_mao_obra", { precision: 15, scale: 2 }).default("0"),
  valorTotal:        numeric("valor_total", { precision: 15, scale: 2 }).default("0"),
  outros:            text("outros"),
  createdAt:         timestamp("created_at").defaultNow(),
});
export const insertCortiartItemPedidoSchema = createInsertSchema(cortiartItensPedido).omit({ createdAt: true });
export type CortiartItemPedido = typeof cortiartItensPedido.$inferSelect;
export type InsertCortiartItemPedido = z.infer<typeof insertCortiartItemPedidoSchema>;

// ─── 4. OS PRODUÇÃO ────────────────────────────────────────────────────────────
export const cortiartOsProducao = pgTable("cortiart_os_producao", {
  id:               varchar("id").primaryKey(),
  pedidoId:         varchar("pedido_id").notNull(),
  tenantId:         varchar("tenant_id").notNull(),
  itemId:           varchar("item_id"),
  ambiente:         varchar("ambiente"),
  etapa:            varchar("etapa", { length: 30 }),
  status:           varchar("status", { length: 20 }).default("pendente"),
  tecidoId:         integer("tecido_id"),
  metragemTecido:   numeric("metragem_tecido", { precision: 10, scale: 3 }),
  responsavelId:    varchar("responsavel_id"),
  dataInicio:       timestamp("data_inicio"),
  dataConclusao:    timestamp("data_conclusao"),
  observacoes:      text("observacoes"),
  createdAt:        timestamp("created_at").defaultNow(),
});
export const insertCortiartOsProducaoSchema = createInsertSchema(cortiartOsProducao).omit({ createdAt: true });
export type CortiartOsProducao = typeof cortiartOsProducao.$inferSelect;
export type InsertCortiartOsProducao = z.infer<typeof insertCortiartOsProducaoSchema>;

// ─── 5. OS INSTALAÇÃO ──────────────────────────────────────────────────────────
export const cortiartOsInstalacao = pgTable("cortiart_os_instalacao", {
  id:                  varchar("id").primaryKey(),
  pedidoId:            varchar("pedido_id").notNull(),
  tenantId:            varchar("tenant_id").notNull(),
  instaladorId:        varchar("instalador_id"),
  status:              varchar("status", { length: 20 }).default("agendada"),
  dataAgendamento:     date("data_agendamento"),
  horaAgendamento:     varchar("hora_agendamento", { length: 5 }),
  dataInstalacao:      date("data_instalacao"),
  dataConclusao:       timestamp("data_conclusao"),
  enderecoInstalacao:  text("endereco_instalacao"),
  observacoes:         text("observacoes"),
  termoAssinado:       boolean("termo_assinado").default(false),
  termoAssinadoEm:     timestamp("termo_assinado_em"),
  createdAt:           timestamp("created_at").defaultNow(),
});
export const insertCortiartOsInstalacaoSchema = createInsertSchema(cortiartOsInstalacao).omit({ createdAt: true });
export type CortiartOsInstalacao = typeof cortiartOsInstalacao.$inferSelect;
export type InsertCortiartOsInstalacao = z.infer<typeof insertCortiartOsInstalacaoSchema>;

// ─── 6. CHECKLIST ──────────────────────────────────────────────────────────────
export const cortiartChecklist = pgTable("cortiart_checklist", {
  id:                   varchar("id").primaryKey(),
  pedidoId:             varchar("pedido_id").notNull().unique(),
  tenantId:             varchar("tenant_id").notNull(),
  medicaoOk:            boolean("medicao_ok").default(false),
  orcamentoAprovado:    boolean("orcamento_aprovado").default(false),
  pagamentoEntrada:     boolean("pagamento_entrada").default(false),
  materialRecebido:     boolean("material_recebido").default(false),
  producaoOk:           boolean("producao_ok").default(false),
  etiquetasOk:          boolean("etiquetas_ok").default(false),
  instalacaoAgendada:   boolean("instalacao_agendada").default(false),
  instalacaoConcluida:  boolean("instalacao_concluida").default(false),
  termoAssinado:        boolean("termo_assinado").default(false),
  nfeEmitida:           boolean("nfe_emitida").default(false),
  pagamentoSaldo:       boolean("pagamento_saldo").default(false),
  observacoes:          text("observacoes"),
  updatedAt:            timestamp("updated_at").defaultNow(),
});
export const insertCortiartChecklistSchema = createInsertSchema(cortiartChecklist).omit({ updatedAt: true });
export type CortiartChecklist = typeof cortiartChecklist.$inferSelect;
export type InsertCortiartChecklist = z.infer<typeof insertCortiartChecklistSchema>;

// ─── 7. COEFICIENTES ───────────────────────────────────────────────────────────
export const cortiartCoeficientes = pgTable("cortiart_coeficientes", {
  id:           serial("id").primaryKey(),
  sistema:      varchar("sistema", { length: 60 }).notNull(),
  faixa:        varchar("faixa", { length: 20 }).notNull(),
  coeficiente:  numeric("coeficiente", { precision: 6, scale: 3 }).notNull(),
  descricao:    text("descricao"),
});
export const insertCortiartCoeficienteSchema = createInsertSchema(cortiartCoeficientes).omit({ id: true });
export type CortiartCoeficiente = typeof cortiartCoeficientes.$inferSelect;
export type InsertCortiartCoeficiente = z.infer<typeof insertCortiartCoeficienteSchema>;

// ─── 8. CATÁLOGO ───────────────────────────────────────────────────────────────
export const cortiartCatalogo = pgTable("cortiart_catalogo", {
  id:               serial("id").primaryKey(),
  tenantId:         varchar("tenant_id"),
  codigo:           varchar("codigo", { length: 30 }),
  nome:             varchar("nome").notNull(),
  descricao:        text("descricao"),
  categoria:        varchar("categoria", { length: 30 }),
  colecao:          varchar("colecao"),
  fornecedorId:     integer("fornecedor_id"),
  unidade:          varchar("unidade", { length: 10 }).default("m"),
  valorUnitario:    numeric("valor_unitario", { precision: 15, scale: 2 }).default("0"),
  statusComercial:  varchar("status_comercial", { length: 20 }).default("ativo"),
  dataPrevisao:     date("data_previsao"),
  ncm:              varchar("ncm", { length: 12 }),
  createdAt:        timestamp("created_at").defaultNow(),
  updatedAt:        timestamp("updated_at").defaultNow(),
});
export const insertCortiartCatalogoSchema = createInsertSchema(cortiartCatalogo).omit({ id: true, createdAt: true, updatedAt: true });
export type CortiartCatalogo = typeof cortiartCatalogo.$inferSelect;
export type InsertCortiartCatalogo = z.infer<typeof insertCortiartCatalogoSchema>;

// ─── 9. ANÁLISE TÉCNICA (histórico) ────────────────────────────────────────────
export const cortiartAnaliseTecnica = pgTable("cortiart_analise_tecnica", {
  id:          varchar("id").primaryKey(),
  pedidoId:    varchar("pedido_id").notNull(),
  tenantId:    varchar("tenant_id").notNull(),
  acao:        varchar("acao", { length: 30 }).notNull(),
  usuarioId:   varchar("usuario_id"),
  observacao:  text("observacao"),
  createdAt:   timestamp("created_at").defaultNow(),
});
export const insertCortiartAnaliseTecnicaSchema = createInsertSchema(cortiartAnaliseTecnica).omit({ createdAt: true });
export type CortiartAnaliseTecnica = typeof cortiartAnaliseTecnica.$inferSelect;
export type InsertCortiartAnaliseTecnica = z.infer<typeof insertCortiartAnaliseTecnicaSchema>;
