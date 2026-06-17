import { Router, Request, Response } from "express";
import { db } from "../../db/index";
import { 
  contabilPlanoContas, contabilCentrosCusto, contabilLancamentos,
  contabilPartidas, contabilPeriodos, contabilConfigLancamento, contabilSaldos,
  insertContabilPlanoContasSchema, insertContabilCentroCustoSchema,
  insertContabilLancamentoSchema, insertContabilPartidaSchema
} from "@shared/schema";
import { eq, and, desc, sql, like, gte, lte } from "drizzle-orm";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { PDFParse } from "pdf-parse";

const router = Router();

const uploadDir = path.join(process.cwd(), "uploads", "contabil");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".pdf") {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos PDF são suportados"));
    }
  },
});

const CONTABIL_SERVICE_URL = process.env.CONTABIL_PYTHON_URL || "http://localhost:8003";

// ========== Proxy para serviço Python ==========

async function proxyToContabilService(path: string, method: string = "GET", body?: any) {
  try {
    const response = await fetch(`${CONTABIL_SERVICE_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return await response.json();
  } catch (error) {
    console.error("Erro ao conectar com serviço contábil:", error);
    throw new Error("Serviço contábil indisponível");
  }
}

// ========== Health Check ==========

router.get("/health", async (req: Request, res: Response) => {
  try {
    const pythonHealth = await proxyToContabilService("/health");
    res.json({ 
      status: "healthy", 
      database: "connected",
      pythonService: pythonHealth 
    });
  } catch (error) {
    res.json({ 
      status: "partial", 
      database: "connected",
      pythonService: "unavailable" 
    });
  }
});

// ========== Plano de Contas ==========

router.get("/plano-contas", async (req: Request, res: Response) => {
  try {
    const { tenantId, tipo, search } = req.query;
    
    let query = db.select().from(contabilPlanoContas);
    
    if (tenantId) {
      query = query.where(eq(contabilPlanoContas.tenantId, Number(tenantId))) as any;
    }
    
    const contas = await query.orderBy(contabilPlanoContas.codigo);
    res.json(contas);
  } catch (error) {
    console.error("Erro ao listar plano de contas:", error);
    res.status(500).json({ error: "Erro ao listar plano de contas" });
  }
});

router.get("/plano-contas/padrao", async (req: Request, res: Response) => {
  try {
    const resultado = await proxyToContabilService("/plano-contas/padrao");
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: "Erro ao obter plano de contas padrão" });
  }
});

router.get("/plano-contas/:id", async (req: Request, res: Response) => {
  try {
    const conta = await db.select().from(contabilPlanoContas)
      .where(eq(contabilPlanoContas.id, Number(req.params.id)))
      .limit(1);
    
    if (conta.length === 0) {
      return res.status(404).json({ error: "Conta não encontrada" });
    }
    
    res.json(conta[0]);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar conta" });
  }
});

router.post("/plano-contas", async (req: Request, res: Response) => {
  try {
    const validatedData = insertContabilPlanoContasSchema.parse(req.body);
    
    const [conta] = await db.insert(contabilPlanoContas)
      .values(validatedData)
      .returning();
    
    res.status(201).json(conta);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos", details: error.errors });
    }
    res.status(500).json({ error: "Erro ao criar conta" });
  }
});

router.post("/plano-contas/importar-padrao", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.body;
    const padrao = await proxyToContabilService("/plano-contas/padrao");
    
    const contasCriadas = [];
    for (const conta of padrao.planoContas) {
      const [novaConta] = await db.insert(contabilPlanoContas)
        .values({
          tenantId: tenantId || null,
          codigo: conta.codigo,
          descricao: conta.descricao,
          tipo: conta.tipo,
          natureza: conta.natureza,
          nivel: conta.nivel,
          aceitaLancamento: conta.nivel >= 4 ? 1 : 0,
        })
        .returning();
      contasCriadas.push(novaConta);
    }
    
    res.status(201).json({ 
      message: "Plano de contas importado",
      total: contasCriadas.length 
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao importar plano de contas" });
  }
});

router.put("/plano-contas/:id", async (req: Request, res: Response) => {
  try {
    const [conta] = await db.update(contabilPlanoContas)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(contabilPlanoContas.id, Number(req.params.id)))
      .returning();
    
    res.json(conta);
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar conta" });
  }
});

router.delete("/plano-contas/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(contabilPlanoContas)
      .where(eq(contabilPlanoContas.id, Number(req.params.id)));
    
    res.json({ message: "Conta excluída" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao excluir conta" });
  }
});

// ========== Centros de Custo ==========

router.get("/centros-custo", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    
    let query = db.select().from(contabilCentrosCusto);
    
    if (tenantId) {
      query = query.where(eq(contabilCentrosCusto.tenantId, Number(tenantId))) as any;
    }
    
    const centros = await query.orderBy(contabilCentrosCusto.codigo);
    res.json(centros);
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar centros de custo" });
  }
});

router.post("/centros-custo", async (req: Request, res: Response) => {
  try {
    const validatedData = insertContabilCentroCustoSchema.parse(req.body);
    
    const [centro] = await db.insert(contabilCentrosCusto)
      .values(validatedData)
      .returning();
    
    res.status(201).json(centro);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos", details: error.errors });
    }
    res.status(500).json({ error: "Erro ao criar centro de custo" });
  }
});

router.put("/centros-custo/:id", async (req: Request, res: Response) => {
  try {
    const [centro] = await db.update(contabilCentrosCusto)
      .set(req.body)
      .where(eq(contabilCentrosCusto.id, Number(req.params.id)))
      .returning();
    
    res.json(centro);
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar centro de custo" });
  }
});

router.delete("/centros-custo/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(contabilCentrosCusto)
      .where(eq(contabilCentrosCusto.id, Number(req.params.id)));
    
    res.json({ message: "Centro de custo excluído" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao excluir centro de custo" });
  }
});

// ========== Lançamentos Contábeis ==========

router.get("/lancamentos", async (req: Request, res: Response) => {
  try {
    const { tenantId, status, limit = 100 } = req.query;
    
    const conditions = [];
    if (tenantId) {
      conditions.push(eq(contabilLancamentos.tenantId, Number(tenantId)));
    }
    if (status) {
      conditions.push(eq(contabilLancamentos.status, String(status)));
    }
    
    let query = db.select().from(contabilLancamentos);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const lancamentos = await query
      .orderBy(desc(contabilLancamentos.dataLancamento))
      .limit(Number(limit));
    
    res.json(lancamentos);
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar lançamentos" });
  }
});

router.get("/lancamentos/:id", async (req: Request, res: Response) => {
  try {
    const [lancamento] = await db.select().from(contabilLancamentos)
      .where(eq(contabilLancamentos.id, Number(req.params.id)))
      .limit(1);
    
    if (!lancamento) {
      return res.status(404).json({ error: "Lançamento não encontrado" });
    }
    
    const partidas = await db.select().from(contabilPartidas)
      .where(eq(contabilPartidas.lancamentoId, lancamento.id));
    
    res.json({ ...lancamento, partidas });
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar lançamento" });
  }
});

router.post("/lancamentos", async (req: Request, res: Response) => {
  try {
    const { partidas, ...lancamentoData } = req.body;
    
    // Validar lançamento via serviço Python
    const validacao = await proxyToContabilService("/validar-lancamento", "POST", {
      ...lancamentoData,
      partidas
    });
    
    if (!validacao.valido) {
      return res.status(400).json({ 
        error: "Lançamento desbalanceado",
        detalhes: validacao 
      });
    }
    
    // Calcular valor total
    const valor = partidas
      .filter((p: any) => p.tipo === "debito")
      .reduce((acc: number, p: any) => acc + Number(p.valor), 0);
    
    // Criar lançamento
    const [lancamento] = await db.insert(contabilLancamentos)
      .values({
        ...lancamentoData,
        valor: valor.toString(),
        dataLancamento: new Date(lancamentoData.dataLancamento),
        dataCompetencia: lancamentoData.dataCompetencia ? new Date(lancamentoData.dataCompetencia) : null,
      })
      .returning();
    
    // Criar partidas
    for (const partida of partidas) {
      await db.insert(contabilPartidas).values({
        lancamentoId: lancamento.id,
        contaId: partida.contaId,
        centroCustoId: partida.centroCustoId || null,
        tipo: partida.tipo,
        valor: partida.valor.toString(),
        historico: partida.historico || null,
      });
    }
    
    res.status(201).json(lancamento);
  } catch (error) {
    console.error("Erro ao criar lançamento:", error);
    res.status(500).json({ error: "Erro ao criar lançamento" });
  }
});

router.delete("/lancamentos/:id", async (req: Request, res: Response) => {
  try {
    // Partidas são excluídas em cascata
    await db.delete(contabilLancamentos)
      .where(eq(contabilLancamentos.id, Number(req.params.id)));
    
    res.json({ message: "Lançamento excluído" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao excluir lançamento" });
  }
});

// ========== Relatórios via Serviço Python ==========

router.post("/relatorios/dre", async (req: Request, res: Response) => {
  try {
    const resultado = await proxyToContabilService("/calcular-dre", "POST", req.body);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: "Erro ao calcular DRE" });
  }
});

router.post("/relatorios/balanco", async (req: Request, res: Response) => {
  try {
    const resultado = await proxyToContabilService("/calcular-balanco", "POST", req.body);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: "Erro ao calcular balanço" });
  }
});

router.post("/relatorios/balancete", async (req: Request, res: Response) => {
  try {
    const resultado = await proxyToContabilService("/calcular-balancete", "POST", req.body);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: "Erro ao calcular balancete" });
  }
});

router.post("/relatorios/razao", async (req: Request, res: Response) => {
  try {
    const resultado = await proxyToContabilService("/gerar-razao", "POST", req.body);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: "Erro ao gerar razão" });
  }
});

router.post("/relatorios/diario", async (req: Request, res: Response) => {
  try {
    const resultado = await proxyToContabilService("/gerar-diario", "POST", req.body);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: "Erro ao gerar diário" });
  }
});

// ========== SPED ECD ==========

router.get("/sped/contas-referenciais", async (req: Request, res: Response) => {
  try {
    const resultado = await proxyToContabilService("/tabela-contas-referenciais");
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: "Erro ao obter contas referenciais" });
  }
});

router.post("/sped/exportar-ecd", async (req: Request, res: Response) => {
  try {
    const resultado = await proxyToContabilService("/exportar-sped-ecd", "POST", req.body);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: "Erro ao exportar SPED ECD" });
  }
});

// ========== Integrações ==========

router.post("/integrar/nfe", async (req: Request, res: Response) => {
  try {
    const resultado = await proxyToContabilService("/integrar-nfe", "POST", req.body);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: "Erro ao integrar NF-e" });
  }
});

router.post("/integrar/folha", async (req: Request, res: Response) => {
  try {
    const resultado = await proxyToContabilService("/integrar-folha", "POST", req.body);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: "Erro ao integrar folha" });
  }
});

// ========== Importação de Balanço ==========

router.post("/extrair-pdf", upload.single("pdf"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo PDF enviado" });
    }

    const pdfBuffer = fs.readFileSync(req.file.path);
    const parser = new PDFParse({ data: pdfBuffer });
    const result = await parser.getText();
    await parser.destroy();
    
    fs.unlinkSync(req.file.path);
    
    res.json({
      success: true,
      texto: result.text,
      paginas: result.numPages || 1
    });
  } catch (error) {
    console.error("Erro ao extrair texto do PDF:", error);
    res.status(500).json({ error: "Erro ao processar PDF" });
  }
});

router.post("/importar-balanco", async (req: Request, res: Response) => {
  try {
    const { texto, dataBalanco, tenantId, criarContas = true, criarAbertura = true } = req.body;
    
    if (!texto) {
      return res.status(400).json({ error: "Texto do balanço é obrigatório" });
    }
    
    const resultado = await proxyToContabilService("/importar-balanco", "POST", {
      texto,
      dataBalanco: dataBalanco || new Date().toISOString().split("T")[0],
      criarContas,
      criarAbertura
    });
    
    if (!resultado.success) {
      return res.status(400).json({ error: resultado.detail || "Erro ao processar balanço" });
    }
    
    const contasCriadas = [];
    const lancamentosCriados = [];
    
    if (criarContas && resultado.planoContas) {
      for (const conta of resultado.planoContas) {
        try {
          const [novaConta] = await db.insert(contabilPlanoContas)
            .values({
              tenantId: tenantId || null,
              codigo: conta.codigo,
              descricao: conta.descricao,
              tipo: conta.tipo,
              natureza: conta.natureza,
              nivel: conta.nivel,
              aceitaLancamento: conta.aceitaLancamento ? 1 : 0,
              status: "ativo"
            })
            .returning();
          contasCriadas.push(novaConta);
        } catch (err) {
          console.log(`Conta ${conta.codigo} já existe ou erro:`, err);
        }
      }
    }
    
    if (criarAbertura && resultado.lancamentosAbertura && resultado.lancamentosAbertura.length > 0) {
      const dataAberturaStr = dataBalanco || new Date().toISOString().split("T")[0];
      const dataAberturaDate = new Date(dataAberturaStr);
      
      const [lancamento] = await db.insert(contabilLancamentos)
        .values({
          tenantId: tenantId || null,
          dataLancamento: dataAberturaDate,
          dataCompetencia: dataAberturaDate,
          tipoDocumento: "ABERTURA",
          numeroDocumento: `AB-${Date.now()}`,
          historico: `Lançamento de abertura - Importação de balanço ${dataAberturaStr}`,
          valor: String(resultado.resumo.totalDebito || 0),
          status: "confirmado"
        })
        .returning();
      
      for (const partida of resultado.lancamentosAbertura) {
        const contaExistente = await db.select().from(contabilPlanoContas)
          .where(eq(contabilPlanoContas.codigo, partida.conta))
          .limit(1);
        
        if (contaExistente.length > 0) {
          await db.insert(contabilPartidas).values({
            lancamentoId: lancamento.id,
            contaId: contaExistente[0].id,
            tipo: partida.tipo,
            valor: String(partida.valor),
            historico: partida.historico
          });
        }
      }
      
      lancamentosCriados.push(lancamento);
    }
    
    res.json({
      success: true,
      contasCriadas: contasCriadas.length,
      lancamentosCriados: lancamentosCriados.length,
      resumo: resultado.resumo
    });
  } catch (error) {
    console.error("Erro ao importar balanço:", error);
    res.status(500).json({ error: "Erro ao importar balanço" });
  }
});

// ========== Estatísticas ==========

router.get("/stats/:tenantId?", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    
    let contasQuery = db.select({ count: sql`count(*)` }).from(contabilPlanoContas);
    let centrosQuery = db.select({ count: sql`count(*)` }).from(contabilCentrosCusto);
    let lancamentosQuery = db.select({ count: sql`count(*)` }).from(contabilLancamentos);
    
    if (tenantId) {
      contasQuery = contasQuery.where(eq(contabilPlanoContas.tenantId, Number(tenantId))) as any;
      centrosQuery = centrosQuery.where(eq(contabilCentrosCusto.tenantId, Number(tenantId))) as any;
      lancamentosQuery = lancamentosQuery.where(eq(contabilLancamentos.tenantId, Number(tenantId))) as any;
    }
    
    const totalContas = await contasQuery;
    const totalCentros = await centrosQuery;
    const totalLancamentos = await lancamentosQuery;
    
    res.json({
      totalContas: Number(totalContas[0]?.count || 0),
      totalCentrosCusto: Number(totalCentros[0]?.count || 0),
      totalLancamentos: Number(totalLancamentos[0]?.count || 0),
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao obter estatísticas" });
  }
});

export default router;
