import { Router, Request, Response, NextFunction } from "express";
import { db } from "../../db/index";
import { eq, like, desc, asc, and, or, sql, SQL } from "drizzle-orm";
import { z } from "zod";
import {
  fiscalNcms,
  fiscalCests,
  fiscalCfops,
  fiscalGruposTributacao,
  fiscalNaturezaOperacao,
  fiscalCertificados,
  fiscalConfiguracoes,
  fiscalNotas,
  fiscalNotaItens,
  fiscalEventos,
  fiscalIbpt,
} from "@shared/schema";

const router = Router();

function ensureAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  next();
}

router.use(ensureAuthenticated);

const ncmSchema = z.object({
  codigo: z.string().min(1),
  descricao: z.string().min(1),
  aliqIpi: z.string().optional(),
  aliqPis: z.string().optional(),
  aliqCofins: z.string().optional(),
  cest: z.string().optional(),
  unidadeTributavel: z.string().optional(),
  exTipi: z.string().optional(),
  exNcm: z.string().optional(),
});

const cestSchema = z.object({
  codigo: z.string().min(1),
  descricao: z.string().min(1),
  ncm: z.string().optional(),
  segmento: z.string().optional(),
});

const cfopSchema = z.object({
  codigo: z.string().min(1),
  descricao: z.string().min(1),
  tipo: z.enum(["entrada", "saida"]),
  natureza: z.string().optional(),
  aplicacao: z.string().optional(),
  indNfe: z.boolean().optional().default(true),
  indComunica: z.boolean().optional().default(false),
  indTransp: z.boolean().optional().default(false),
  indDevol: z.boolean().optional().default(false),
});

const grupoTributacaoSchema = z.object({
  tenantId: z.number(),
  nome: z.string().min(1),
  ncm: z.string().min(1),
  cest: z.string().optional(),
  cfopVendaInterna: z.string(),
  cfopVendaInterestadual: z.string(),
  cfopDevolucaoInterna: z.string(),
  cfopDevolucaoInterestadual: z.string(),
  cstIcms: z.string(),
  csosnIcms: z.string().optional(),
  percIcms: z.string().optional(),
  percReducaoBaseIcms: z.string().optional(),
  cstPis: z.string(),
  percPis: z.string().optional(),
  cstCofins: z.string(),
  percCofins: z.string().optional(),
  cstIpi: z.string(),
  percIpi: z.string().optional(),
  percIbsUf: z.string().optional(),
  percIbsMun: z.string().optional(),
  percCbs: z.string().optional(),
  cstIbsCbs: z.string().optional(),
  observacoes: z.string().optional(),
  ativo: z.boolean().optional().default(true),
});

const naturezaOperacaoSchema = z.object({
  tenantId: z.number(),
  codigo: z.string().min(1),
  descricao: z.string().min(1),
  tipo: z.string(),
  cfopInterno: z.string(),
  cfopInterestadual: z.string(),
  cfopExportacao: z.string().optional(),
  movimentaEstoque: z.boolean().optional().default(true),
  geraFinanceiro: z.boolean().optional().default(true),
  destacaIpi: z.boolean().optional().default(false),
  destacaIcmsSt: z.boolean().optional().default(false),
  finalidade: z.string(),
  observacoes: z.string().optional(),
  ativo: z.boolean().optional().default(true),
});

const certificadoSchema = z.object({
  tenantId: z.number(),
  nome: z.string().min(1),
  tipo: z.enum(["A1", "A3"]),
  cnpj: z.string().optional(),
  razaoSocial: z.string().optional(),
  validoAte: z.string().optional(),
  certificadoBase64: z.string().optional(),
  senha: z.string().optional(),
  ambiente: z.enum(["homologacao", "producao"]).default("homologacao"),
  status: z.enum(["ativo", "expirado", "revogado"]).default("ativo"),
});

const configuracaoFiscalSchema = z.object({
  tenantId: z.number(),
  ambiente: z.enum(["homologacao", "producao"]).optional().default("homologacao"),
  regimeTributario: z.enum(["1", "2", "3"]).optional(),
  ufEmitente: z.string().optional(),
  cnpjEmitente: z.string().optional(),
  ieEmitente: z.string().optional(),
  razaoSocialEmitente: z.string().optional(),
  nomeFantasiaEmitente: z.string().optional(),
  serieNfe: z.number().optional(),
  proximoNumeroNfe: z.number().optional(),
  serieNfce: z.number().optional(),
  proximoNumeroNfce: z.number().optional(),
  cscId: z.string().optional(),
  cscToken: z.string().optional(),
  habilitarIbsCbs: z.boolean().optional().default(false),
});

const notaItemSchema = z.object({
  produtoCodigo: z.string().optional(),
  produtoDescricao: z.string().min(1),
  ncm: z.string().optional(),
  cfop: z.string().optional(),
  unidade: z.string().optional(),
  quantidade: z.string().optional(),
  valorUnitario: z.string().optional(),
  valorTotal: z.string().optional(),
  cstIcms: z.string().optional(),
  percIcms: z.string().optional(),
  valorIcms: z.string().optional(),
  cstPis: z.string().optional(),
  percPis: z.string().optional(),
  valorPis: z.string().optional(),
  cstCofins: z.string().optional(),
  percCofins: z.string().optional(),
  valorCofins: z.string().optional(),
  cstIpi: z.string().optional(),
  percIpi: z.string().optional(),
  valorIpi: z.string().optional(),
  percIbsUf: z.string().optional(),
  percIbsMun: z.string().optional(),
  percCbs: z.string().optional(),
});

const notaFiscalSchema = z.object({
  tenantId: z.number(),
  modelo: z.enum(["55", "65"]),
  serie: z.number().optional(),
  numero: z.number().optional(),
  naturezaOperacao: z.string(),
  tipoOperacao: z.enum(["0", "1"]).optional(),
  destinatarioNome: z.string().optional(),
  destinatarioCnpjCpf: z.string().optional(),
  destinatarioIe: z.string().optional(),
  destinatarioEndereco: z.string().optional(),
  destinatarioMunicipio: z.string().optional(),
  destinatarioUf: z.string().optional(),
  destinatarioCep: z.string().optional(),
  valorProdutos: z.string().optional(),
  valorDesconto: z.string().optional(),
  valorFrete: z.string().optional(),
  valorSeguro: z.string().optional(),
  valorOutros: z.string().optional(),
  valorTotal: z.string().optional(),
  baseIcms: z.string().optional(),
  valorIcms: z.string().optional(),
  valorPis: z.string().optional(),
  valorCofins: z.string().optional(),
  valorIpi: z.string().optional(),
  informacoesAdicionais: z.string().optional(),
  status: z.enum(["rascunho", "pendente", "autorizada", "cancelada", "rejeitada", "denegada"]).optional().default("rascunho"),
});

const notaFiscalComItensSchema = notaFiscalSchema.extend({
  itens: z.array(notaItemSchema).optional(),
});

const eventoFiscalSchema = z.object({
  tipoEvento: z.string().min(1),
  descricaoEvento: z.string().optional(),
  justificativa: z.string().optional(),
  correcao: z.string().optional(),
});

const ibptImportSchema = z.object({
  dados: z.array(z.object({
    ncm: z.string(),
    exTipi: z.string().optional(),
    tipo: z.string().optional(),
    descricao: z.string().optional(),
    aliqNacional: z.string().optional(),
    aliqImportado: z.string().optional(),
    aliqEstadual: z.string().optional(),
    aliqMunicipal: z.string().optional(),
    vigenciaInicio: z.string().optional(),
    vigenciaFim: z.string().optional(),
    versao: z.string().optional(),
    fonte: z.string().optional(),
  })),
});

// ========== NCM ==========

router.get("/ncm", async (req: Request, res: Response) => {
  try {
    const { search, limit = "100", offset = "0" } = req.query;
    
    const conditions: SQL[] = [];
    
    if (search) {
      conditions.push(
        or(
          sql`${fiscalNcms.codigo} ILIKE ${'%' + search + '%'}`,
          sql`${fiscalNcms.descricao} ILIKE ${'%' + search + '%'}`
        )!
      );
    }
    
    const ncms = await db.select().from(fiscalNcms)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(fiscalNcms.codigo))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));
    
    res.json(ncms);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/ncm/:id", async (req: Request, res: Response) => {
  try {
    const [ncm] = await db.select().from(fiscalNcms).where(eq(fiscalNcms.id, parseInt(req.params.id)));
    if (!ncm) return res.status(404).json({ error: "NCM não encontrado" });
    res.json(ncm);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/ncm", async (req: Request, res: Response) => {
  try {
    const validated = ncmSchema.parse(req.body);
    const [ncm] = await db.insert(fiscalNcms).values(validated).returning();
    res.status(201).json(ncm);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put("/ncm/:id", async (req: Request, res: Response) => {
  try {
    const validated = ncmSchema.partial().parse(req.body);
    const [ncm] = await db.update(fiscalNcms)
      .set({ ...validated, updatedAt: new Date() })
      .where(eq(fiscalNcms.id, parseInt(req.params.id)))
      .returning();
    if (!ncm) return res.status(404).json({ error: "NCM não encontrado" });
    res.json(ncm);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

router.delete("/ncm/:id", async (req: Request, res: Response) => {
  try {
    const [deleted] = await db.delete(fiscalNcms).where(eq(fiscalNcms.id, parseInt(req.params.id))).returning();
    if (!deleted) return res.status(404).json({ error: "NCM não encontrado" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CEST ==========

router.get("/cest", async (req: Request, res: Response) => {
  try {
    const { search, limit = "100" } = req.query;
    
    const conditions: SQL[] = [];
    
    if (search) {
      conditions.push(
        or(
          sql`${fiscalCests.codigo} ILIKE ${'%' + search + '%'}`,
          sql`${fiscalCests.descricao} ILIKE ${'%' + search + '%'}`
        )!
      );
    }
    
    const cests = await db.select().from(fiscalCests)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(fiscalCests.codigo))
      .limit(parseInt(limit as string));
    
    res.json(cests);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/cest/:id", async (req: Request, res: Response) => {
  try {
    const [cest] = await db.select().from(fiscalCests).where(eq(fiscalCests.id, parseInt(req.params.id)));
    if (!cest) return res.status(404).json({ error: "CEST não encontrado" });
    res.json(cest);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/cest", async (req: Request, res: Response) => {
  try {
    const validated = cestSchema.parse(req.body);
    const [cest] = await db.insert(fiscalCests).values(validated).returning();
    res.status(201).json(cest);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put("/cest/:id", async (req: Request, res: Response) => {
  try {
    const validated = cestSchema.partial().parse(req.body);
    const [cest] = await db.update(fiscalCests)
      .set(validated)
      .where(eq(fiscalCests.id, parseInt(req.params.id)))
      .returning();
    if (!cest) return res.status(404).json({ error: "CEST não encontrado" });
    res.json(cest);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

router.delete("/cest/:id", async (req: Request, res: Response) => {
  try {
    const [deleted] = await db.delete(fiscalCests).where(eq(fiscalCests.id, parseInt(req.params.id))).returning();
    if (!deleted) return res.status(404).json({ error: "CEST não encontrado" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CFOP ==========

router.get("/cfop", async (req: Request, res: Response) => {
  try {
    const { tipo, search } = req.query;
    
    const conditions: SQL[] = [];
    if (tipo) conditions.push(eq(fiscalCfops.tipo, tipo as string));
    if (search) {
      conditions.push(
        or(
          sql`${fiscalCfops.codigo} ILIKE ${'%' + search + '%'}`,
          sql`${fiscalCfops.descricao} ILIKE ${'%' + search + '%'}`
        )!
      );
    }
    
    const cfops = await db.select().from(fiscalCfops)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(fiscalCfops.codigo));
    
    res.json(cfops);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/cfop/:id", async (req: Request, res: Response) => {
  try {
    const [cfop] = await db.select().from(fiscalCfops).where(eq(fiscalCfops.id, parseInt(req.params.id)));
    if (!cfop) return res.status(404).json({ error: "CFOP não encontrado" });
    res.json(cfop);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/cfop", async (req: Request, res: Response) => {
  try {
    const validated = cfopSchema.parse(req.body);
    const [cfop] = await db.insert(fiscalCfops).values(validated).returning();
    res.status(201).json(cfop);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put("/cfop/:id", async (req: Request, res: Response) => {
  try {
    const validated = cfopSchema.partial().parse(req.body);
    const [cfop] = await db.update(fiscalCfops)
      .set(validated)
      .where(eq(fiscalCfops.id, parseInt(req.params.id)))
      .returning();
    if (!cfop) return res.status(404).json({ error: "CFOP não encontrado" });
    res.json(cfop);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

router.delete("/cfop/:id", async (req: Request, res: Response) => {
  try {
    const [deleted] = await db.delete(fiscalCfops).where(eq(fiscalCfops.id, parseInt(req.params.id))).returning();
    if (!deleted) return res.status(404).json({ error: "CFOP não encontrado" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== GRUPOS DE TRIBUTAÇÃO ==========

router.get("/grupos-tributacao", async (req: Request, res: Response) => {
  try {
    const { tenantId, search, ncm } = req.query;
    
    const conditions: SQL[] = [];
    if (tenantId) conditions.push(eq(fiscalGruposTributacao.tenantId, parseInt(tenantId as string)));
    if (ncm) conditions.push(eq(fiscalGruposTributacao.ncm, ncm as string));
    if (search) {
      conditions.push(sql`${fiscalGruposTributacao.nome} ILIKE ${'%' + search + '%'}`);
    }
    
    const grupos = await db.select().from(fiscalGruposTributacao)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(fiscalGruposTributacao.nome));
    
    res.json(grupos);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/grupos-tributacao/:id", async (req: Request, res: Response) => {
  try {
    const [grupo] = await db.select().from(fiscalGruposTributacao)
      .where(eq(fiscalGruposTributacao.id, parseInt(req.params.id)));
    if (!grupo) return res.status(404).json({ error: "Grupo não encontrado" });
    res.json(grupo);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/grupos-tributacao", async (req: Request, res: Response) => {
  try {
    const validated = grupoTributacaoSchema.parse(req.body);
    const [grupo] = await db.insert(fiscalGruposTributacao).values(validated).returning();
    res.status(201).json(grupo);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put("/grupos-tributacao/:id", async (req: Request, res: Response) => {
  try {
    const validated = grupoTributacaoSchema.partial().parse(req.body);
    const [grupo] = await db.update(fiscalGruposTributacao)
      .set({ ...validated, updatedAt: new Date() })
      .where(eq(fiscalGruposTributacao.id, parseInt(req.params.id)))
      .returning();
    if (!grupo) return res.status(404).json({ error: "Grupo não encontrado" });
    res.json(grupo);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

router.delete("/grupos-tributacao/:id", async (req: Request, res: Response) => {
  try {
    const [deleted] = await db.delete(fiscalGruposTributacao).where(eq(fiscalGruposTributacao.id, parseInt(req.params.id))).returning();
    if (!deleted) return res.status(404).json({ error: "Grupo não encontrado" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== NATUREZA DE OPERAÇÃO ==========

router.get("/natureza-operacao", async (req: Request, res: Response) => {
  try {
    const { tenantId, search } = req.query;
    
    const conditions: SQL[] = [];
    if (tenantId) conditions.push(eq(fiscalNaturezaOperacao.tenantId, parseInt(tenantId as string)));
    if (search) {
      conditions.push(sql`${fiscalNaturezaOperacao.descricao} ILIKE ${'%' + search + '%'}`);
    }
    
    const naturezas = await db.select().from(fiscalNaturezaOperacao)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(fiscalNaturezaOperacao.descricao));
    
    res.json(naturezas);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/natureza-operacao/:id", async (req: Request, res: Response) => {
  try {
    const [natureza] = await db.select().from(fiscalNaturezaOperacao)
      .where(eq(fiscalNaturezaOperacao.id, parseInt(req.params.id)));
    if (!natureza) return res.status(404).json({ error: "Natureza não encontrada" });
    res.json(natureza);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/natureza-operacao", async (req: Request, res: Response) => {
  try {
    const validated = naturezaOperacaoSchema.parse(req.body);
    const [natureza] = await db.insert(fiscalNaturezaOperacao).values(validated).returning();
    res.status(201).json(natureza);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put("/natureza-operacao/:id", async (req: Request, res: Response) => {
  try {
    const validated = naturezaOperacaoSchema.partial().parse(req.body);
    const [natureza] = await db.update(fiscalNaturezaOperacao)
      .set({ ...validated, updatedAt: new Date() })
      .where(eq(fiscalNaturezaOperacao.id, parseInt(req.params.id)))
      .returning();
    if (!natureza) return res.status(404).json({ error: "Natureza não encontrada" });
    res.json(natureza);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

router.delete("/natureza-operacao/:id", async (req: Request, res: Response) => {
  try {
    const [deleted] = await db.delete(fiscalNaturezaOperacao).where(eq(fiscalNaturezaOperacao.id, parseInt(req.params.id))).returning();
    if (!deleted) return res.status(404).json({ error: "Natureza não encontrada" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CERTIFICADOS DIGITAIS ==========

router.get("/certificados", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    
    const conditions: SQL[] = [];
    if (tenantId) {
      conditions.push(eq(fiscalCertificados.tenantId, parseInt(tenantId as string)));
    }
    
    const certificados = await db.select({
      id: fiscalCertificados.id,
      tenantId: fiscalCertificados.tenantId,
      nome: fiscalCertificados.nome,
      tipo: fiscalCertificados.tipo,
      cnpj: fiscalCertificados.cnpj,
      razaoSocial: fiscalCertificados.razaoSocial,
      validoAte: fiscalCertificados.validoAte,
      ambiente: fiscalCertificados.ambiente,
      status: fiscalCertificados.status,
      createdAt: fiscalCertificados.createdAt,
    }).from(fiscalCertificados)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(fiscalCertificados.createdAt));
    
    res.json(certificados);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/certificados", async (req: Request, res: Response) => {
  try {
    const validated = certificadoSchema.parse(req.body);
    const [certificado] = await db.insert(fiscalCertificados).values(validated).returning();
    res.status(201).json(certificado);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

router.delete("/certificados/:id", async (req: Request, res: Response) => {
  try {
    const [deleted] = await db.delete(fiscalCertificados).where(eq(fiscalCertificados.id, parseInt(req.params.id))).returning();
    if (!deleted) return res.status(404).json({ error: "Certificado não encontrado" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CONFIGURAÇÕES FISCAIS ==========

router.get("/configuracoes/:tenantId", async (req: Request, res: Response) => {
  try {
    const [config] = await db.select().from(fiscalConfiguracoes)
      .where(eq(fiscalConfiguracoes.tenantId, parseInt(req.params.tenantId)));
    res.json(config || null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/configuracoes", async (req: Request, res: Response) => {
  try {
    const validated = configuracaoFiscalSchema.parse(req.body);
    const existing = await db.select().from(fiscalConfiguracoes)
      .where(eq(fiscalConfiguracoes.tenantId, validated.tenantId));
    
    if (existing.length > 0) {
      const [config] = await db.update(fiscalConfiguracoes)
        .set({ ...validated, updatedAt: new Date() })
        .where(eq(fiscalConfiguracoes.tenantId, validated.tenantId))
        .returning();
      return res.json(config);
    }
    
    const [config] = await db.insert(fiscalConfiguracoes).values(validated).returning();
    res.status(201).json(config);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// ========== NOTAS FISCAIS ==========

router.get("/notas", async (req: Request, res: Response) => {
  try {
    const { tenantId, modelo, status, limit = "50", offset = "0" } = req.query;
    
    const conditions: SQL[] = [];
    if (tenantId) conditions.push(eq(fiscalNotas.tenantId, parseInt(tenantId as string)));
    if (modelo) conditions.push(eq(fiscalNotas.modelo, modelo as string));
    if (status) conditions.push(eq(fiscalNotas.status, status as string));
    
    const notas = await db.select().from(fiscalNotas)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(fiscalNotas.dataEmissao))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));
    
    res.json(notas);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/notas/:id", async (req: Request, res: Response) => {
  try {
    const [nota] = await db.select().from(fiscalNotas)
      .where(eq(fiscalNotas.id, parseInt(req.params.id)));
    
    if (!nota) return res.status(404).json({ error: "Nota não encontrada" });
    
    const itens = await db.select().from(fiscalNotaItens)
      .where(eq(fiscalNotaItens.notaId, nota.id))
      .orderBy(asc(fiscalNotaItens.ordem));
    
    const eventos = await db.select().from(fiscalEventos)
      .where(eq(fiscalEventos.notaId, nota.id))
      .orderBy(desc(fiscalEventos.createdAt));
    
    res.json({ ...nota, itens, eventos });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/notas", async (req: Request, res: Response) => {
  try {
    const validated = notaFiscalComItensSchema.parse(req.body);
    const { itens, ...notaData } = validated;
    
    const [nota] = await db.insert(fiscalNotas).values(notaData).returning();
    
    if (itens && itens.length > 0) {
      const itensComNotaId = itens.map((item, index) => ({
        ...item,
        notaId: nota.id,
        ordem: index + 1,
      }));
      await db.insert(fiscalNotaItens).values(itensComNotaId);
    }
    
    res.status(201).json(nota);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put("/notas/:id", async (req: Request, res: Response) => {
  try {
    const validated = notaFiscalComItensSchema.partial().parse(req.body);
    const { itens, ...notaData } = validated;
    
    const [nota] = await db.update(fiscalNotas)
      .set({ ...notaData, updatedAt: new Date() })
      .where(eq(fiscalNotas.id, parseInt(req.params.id)))
      .returning();
    
    if (!nota) return res.status(404).json({ error: "Nota não encontrada" });
    
    if (itens) {
      await db.delete(fiscalNotaItens).where(eq(fiscalNotaItens.notaId, nota.id));
      
      if (itens.length > 0) {
        const itensComNotaId = itens.map((item, index) => ({
          ...item,
          notaId: nota.id,
          ordem: index + 1,
        }));
        await db.insert(fiscalNotaItens).values(itensComNotaId);
      }
    }
    
    res.json(nota);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

router.delete("/notas/:id", async (req: Request, res: Response) => {
  try {
    const [nota] = await db.select().from(fiscalNotas)
      .where(eq(fiscalNotas.id, parseInt(req.params.id)));
    
    if (!nota) return res.status(404).json({ error: "Nota não encontrada" });
    
    if (nota.status !== 'rascunho') {
      return res.status(400).json({ error: "Apenas notas em rascunho podem ser excluídas" });
    }
    
    await db.delete(fiscalNotaItens).where(eq(fiscalNotaItens.notaId, nota.id));
    await db.delete(fiscalNotas).where(eq(fiscalNotas.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== EVENTOS FISCAIS ==========

router.post("/notas/:id/eventos", async (req: Request, res: Response) => {
  try {
    const notaId = parseInt(req.params.id);
    const validated = eventoFiscalSchema.parse(req.body);
    
    const [nota] = await db.select().from(fiscalNotas).where(eq(fiscalNotas.id, notaId));
    if (!nota) return res.status(404).json({ error: "Nota não encontrada" });
    
    const existingEvents = await db.select().from(fiscalEventos)
      .where(and(
        eq(fiscalEventos.notaId, notaId),
        eq(fiscalEventos.tipoEvento, validated.tipoEvento)
      ));
    
    const [evento] = await db.insert(fiscalEventos).values({
      ...validated,
      notaId,
      sequencia: existingEvents.length + 1,
      dataEvento: new Date(),
    }).returning();
    
    res.status(201).json(evento);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== IBPT ==========

router.get("/ibpt/:ncm", async (req: Request, res: Response) => {
  try {
    const [ibpt] = await db.select().from(fiscalIbpt)
      .where(eq(fiscalIbpt.ncm, req.params.ncm))
      .orderBy(desc(fiscalIbpt.vigenciaInicio))
      .limit(1);
    res.json(ibpt || null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/ibpt/importar", async (req: Request, res: Response) => {
  try {
    const validated = ibptImportSchema.parse(req.body);
    
    let importados = 0;
    for (const item of validated.dados) {
      try {
        await db.insert(fiscalIbpt).values(item);
        importados++;
      } catch (e) {
      }
    }
    
    res.json({ success: true, importados });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// ========== ESTATÍSTICAS ==========

router.get("/stats/:tenantId", async (req: Request, res: Response) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    
    const notasResult = await db.execute(sql`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'autorizada') as autorizadas,
        COUNT(*) FILTER (WHERE status = 'rascunho') as rascunhos,
        COUNT(*) FILTER (WHERE status = 'cancelada') as canceladas,
        COUNT(*) FILTER (WHERE status = 'rejeitada') as rejeitadas,
        COALESCE(SUM(valor_total) FILTER (WHERE status = 'autorizada'), 0) as valor_total
      FROM fiscal_notas
      WHERE tenant_id = ${tenantId}
        AND EXTRACT(MONTH FROM data_emissao) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM data_emissao) = EXTRACT(YEAR FROM CURRENT_DATE)
    `);
    
    const gruposCount = await db.select({ count: sql<number>`count(*)` })
      .from(fiscalGruposTributacao)
      .where(eq(fiscalGruposTributacao.tenantId, tenantId));
    
    const naturezasCount = await db.select({ count: sql<number>`count(*)` })
      .from(fiscalNaturezaOperacao)
      .where(eq(fiscalNaturezaOperacao.tenantId, tenantId));
    
    res.json({
      notas: notasResult.rows?.[0] || {},
      grupos: gruposCount[0]?.count || 0,
      naturezas: naturezasCount[0]?.count || 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== INTEGRAÇÃO COM SERVIÇO PYTHON NF-e ==========

const FISCO_PYTHON_URL = process.env.FISCO_PYTHON_URL || "http://localhost:8002";

async function callFiscoPython(endpoint: string, method: string = "GET", body?: any) {
  const fetch = (await import("node-fetch")).default;
  const url = `${FISCO_PYTHON_URL}${endpoint}`;
  
  const options: any = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(url, options);
  return response.json();
}

router.get("/nfe/service-status", async (req: Request, res: Response) => {
  try {
    const result = await callFiscoPython("/");
    res.json(result);
  } catch (error: any) {
    res.status(503).json({ 
      error: "Serviço Python não disponível", 
      details: error.message,
      hint: "Verifique se o serviço fisco_service.py está rodando na porta 8002"
    });
  }
});

router.post("/nfe/validar-certificado", async (req: Request, res: Response) => {
  try {
    const result = await callFiscoPython("/certificado/validar", "POST", req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/nfe/gerar-xml", async (req: Request, res: Response) => {
  try {
    const result = await callFiscoPython("/nfe/gerar-xml", "POST", req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/nfe/emitir", async (req: Request, res: Response) => {
  try {
    const { notaId, certificadoId } = req.body;
    
    const [nota] = await db.select().from(fiscalNotas).where(eq(fiscalNotas.id, notaId));
    if (!nota) return res.status(404).json({ error: "Nota não encontrada" });
    
    const [certificado] = await db.select().from(fiscalCertificados).where(eq(fiscalCertificados.id, certificadoId));
    if (!certificado) return res.status(404).json({ error: "Certificado não encontrado" });
    
    const itens = await db.select().from(fiscalNotaItens).where(eq(fiscalNotaItens.notaId, notaId));
    
    const [config] = await db.select().from(fiscalConfiguracoes)
      .where(eq(fiscalConfiguracoes.tenantId, nota.tenantId));
    
    const payload = {
      dados: {
        modelo: nota.modelo,
        serie: nota.serie || 1,
        numero: nota.numero || 1,
        natureza_operacao: nota.naturezaOperacao || "VENDA",
        tipo_operacao: nota.tipoOperacao || "1",
        ambiente: config?.ambiente || "2",
        emitente: {
          cnpj: config?.cnpjEmitente || "",
          ie: config?.ieEmitente || "",
          razao_social: config?.razaoSocialEmitente || "",
          nome_fantasia: config?.nomeFantasiaEmitente || "",
          endereco: config?.enderecoEmitente || "",
          numero: config?.numeroEmitente || "",
          bairro: config?.bairroEmitente || "",
          municipio: config?.municipioEmitente || "",
          cod_municipio: config?.codMunicipioEmitente || "",
          uf: config?.ufEmitente || "",
          cep: config?.cepEmitente || "",
          crt: config?.crt || "3",
        },
        destinatario: {
          cpf_cnpj: nota.destinatarioCnpjCpf || "",
          razao_social: nota.destinatarioNome || "",
          ie: nota.destinatarioIe || "",
          endereco: nota.destinatarioEndereco || "",
          municipio: nota.destinatarioMunicipio || "",
          uf: nota.destinatarioUf || "",
          cep: nota.destinatarioCep || "",
          ind_ie_dest: "9",
        },
        itens: itens.map((item, idx) => ({
          numero: idx + 1,
          codigo: item.produtoCodigo || "",
          descricao: item.produtoDescricao || "",
          ncm: item.ncm || "",
          cfop: item.cfop || "",
          unidade: item.unidade || "UN",
          quantidade: parseFloat(item.quantidade || "1"),
          valor_unitario: parseFloat(item.valorUnitario || "0"),
          valor_total: parseFloat(item.valorTotal || "0"),
          cst_icms: item.cstIcms || "00",
          aliq_icms: parseFloat(item.percIcms || "0"),
          valor_icms: parseFloat(item.valorIcms || "0"),
          cst_pis: item.cstPis || "01",
          aliq_pis: parseFloat(item.percPis || "0"),
          valor_pis: parseFloat(item.valorPis || "0"),
          cst_cofins: item.cstCofins || "01",
          aliq_cofins: parseFloat(item.percCofins || "0"),
          valor_cofins: parseFloat(item.valorCofins || "0"),
        })),
        valor_produtos: parseFloat(nota.valorProdutos || "0"),
        valor_total: parseFloat(nota.valorTotal || "0"),
        valor_desconto: parseFloat(nota.valorDesconto || "0"),
        valor_frete: parseFloat(nota.valorFrete || "0"),
        valor_seguro: parseFloat(nota.valorSeguro || "0"),
        valor_outros: parseFloat(nota.valorOutros || "0"),
        info_complementar: nota.informacoesAdicionais || "",
      },
      certificado: {
        arquivo_base64: certificado.arquivoBase64 || "",
        senha: certificado.senha || "",
      },
    };
    
    const result: any = await callFiscoPython("/nfe/emitir", "POST", payload);
    
    if (result.sucesso) {
      await db.update(fiscalNotas)
        .set({
          status: "autorizada",
          chaveAcesso: result.chave_nfe,
          protocolo: result.protocolo,
          xmlAutorizado: result.xml_autorizado,
          dataAutorizacao: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(fiscalNotas.id, notaId));
    }
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/nfe/consultar", async (req: Request, res: Response) => {
  try {
    const result = await callFiscoPython("/nfe/consultar", "POST", req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/nfe/cancelar", async (req: Request, res: Response) => {
  try {
    const { notaId, justificativa, certificadoId } = req.body;
    
    const [nota] = await db.select().from(fiscalNotas).where(eq(fiscalNotas.id, notaId));
    if (!nota) return res.status(404).json({ error: "Nota não encontrada" });
    
    const [certificado] = await db.select().from(fiscalCertificados).where(eq(fiscalCertificados.id, certificadoId));
    if (!certificado) return res.status(404).json({ error: "Certificado não encontrado" });
    
    const [config] = await db.select().from(fiscalConfiguracoes)
      .where(eq(fiscalConfiguracoes.tenantId, nota.tenantId));
    
    const payload = {
      chave_nfe: nota.chaveAcesso,
      protocolo_autorizacao: nota.protocolo,
      justificativa,
      ambiente: config?.ambiente || "2",
      certificado: {
        arquivo_base64: certificado.arquivoBase64 || "",
        senha: certificado.senha || "",
      },
    };
    
    const result: any = await callFiscoPython("/nfe/cancelar", "POST", payload);
    
    if (result.sucesso) {
      await db.update(fiscalNotas)
        .set({
          status: "cancelada",
          updatedAt: new Date(),
        })
        .where(eq(fiscalNotas.id, notaId));
      
      await db.insert(fiscalEventos).values({
        notaId,
        tipoEvento: "110111",
        descricaoEvento: "Cancelamento",
        sequencia: 1,
        dataEvento: new Date(),
        protocolo: result.protocolo,
        justificativa,
        status: "registrado",
      });
    }
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/nfe/inutilizar", async (req: Request, res: Response) => {
  try {
    const result = await callFiscoPython("/nfe/inutilizar", "POST", req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
