import { Router, Request, Response } from "express";
import { db } from "../../db/index";
import { 
  peopleFuncionarios, peopleCargos, peopleDepartamentos, peopleDependentes,
  peopleEventosFolha, peopleFolhaPagamento, peopleFolhaItens, peopleFolhaEventos,
  peopleFerias, peoplePonto, peopleBeneficios, peopleFuncionarioBeneficios,
  peopleTabelasCalculo,
  insertPeopleFuncionarioSchema, insertPeopleCargoSchema, insertPeopleDepartamentoSchema,
  insertPeopleDependenteSchema, insertPeopleEventoFolhaSchema, insertPeopleFolhaPagamentoSchema
} from "@shared/schema";
import { eq, and, desc, sql, like } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const PEOPLE_SERVICE_URL = process.env.PEOPLE_PYTHON_URL || "http://localhost:8004";

// ========== Proxy para serviço Python ==========

async function proxyToPeopleService(path: string, method: string = "GET", body?: any) {
  try {
    const response = await fetch(`${PEOPLE_SERVICE_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return await response.json();
  } catch (error) {
    console.error("Erro ao conectar com serviço People:", error);
    throw new Error("Serviço People indisponível");
  }
}

// ========== Health Check ==========

router.get("/health", async (req: Request, res: Response) => {
  try {
    const pythonHealth = await proxyToPeopleService("/health");
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

// ========== Cargos ==========

router.get("/cargos", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    
    let query = db.select().from(peopleCargos);
    
    if (tenantId) {
      query = query.where(eq(peopleCargos.tenantId, Number(tenantId))) as any;
    }
    
    const cargos = await query.orderBy(peopleCargos.nome);
    res.json(cargos);
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar cargos" });
  }
});

router.post("/cargos", async (req: Request, res: Response) => {
  try {
    const validatedData = insertPeopleCargoSchema.parse(req.body);
    
    const [cargo] = await db.insert(peopleCargos)
      .values(validatedData)
      .returning();
    
    res.status(201).json(cargo);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos", details: error.errors });
    }
    res.status(500).json({ error: "Erro ao criar cargo" });
  }
});

router.put("/cargos/:id", async (req: Request, res: Response) => {
  try {
    const [cargo] = await db.update(peopleCargos)
      .set(req.body)
      .where(eq(peopleCargos.id, Number(req.params.id)))
      .returning();
    
    res.json(cargo);
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar cargo" });
  }
});

router.delete("/cargos/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(peopleCargos)
      .where(eq(peopleCargos.id, Number(req.params.id)));
    
    res.json({ message: "Cargo excluído" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao excluir cargo" });
  }
});

// ========== Departamentos ==========

router.get("/departamentos", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    
    const departamentos = await db.select().from(peopleDepartamentos)
      .orderBy(peopleDepartamentos.nome);
    
    res.json(departamentos);
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar departamentos" });
  }
});

router.post("/departamentos", async (req: Request, res: Response) => {
  try {
    const validatedData = insertPeopleDepartamentoSchema.parse(req.body);
    
    const [departamento] = await db.insert(peopleDepartamentos)
      .values(validatedData)
      .returning();
    
    res.status(201).json(departamento);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos", details: error.errors });
    }
    res.status(500).json({ error: "Erro ao criar departamento" });
  }
});

router.put("/departamentos/:id", async (req: Request, res: Response) => {
  try {
    const [departamento] = await db.update(peopleDepartamentos)
      .set(req.body)
      .where(eq(peopleDepartamentos.id, Number(req.params.id)))
      .returning();
    
    res.json(departamento);
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar departamento" });
  }
});

router.delete("/departamentos/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(peopleDepartamentos)
      .where(eq(peopleDepartamentos.id, Number(req.params.id)));
    
    res.json({ message: "Departamento excluído" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao excluir departamento" });
  }
});

// ========== Funcionários ==========

router.get("/funcionarios", async (req: Request, res: Response) => {
  try {
    const { tenantId, status, departamentoId, search } = req.query;
    
    let funcionarios = await db.select().from(peopleFuncionarios)
      .orderBy(peopleFuncionarios.nome);
    
    if (status) {
      funcionarios = funcionarios.filter(f => f.status === status);
    }
    
    if (departamentoId) {
      funcionarios = funcionarios.filter(f => f.departamentoId === Number(departamentoId));
    }
    
    if (search) {
      const searchLower = String(search).toLowerCase();
      funcionarios = funcionarios.filter(f => 
        f.nome.toLowerCase().includes(searchLower) ||
        f.cpf?.includes(String(search)) ||
        f.matricula?.includes(String(search))
      );
    }
    
    res.json(funcionarios);
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar funcionários" });
  }
});

router.get("/funcionarios/:id", async (req: Request, res: Response) => {
  try {
    const [funcionario] = await db.select().from(peopleFuncionarios)
      .where(eq(peopleFuncionarios.id, Number(req.params.id)))
      .limit(1);
    
    if (!funcionario) {
      return res.status(404).json({ error: "Funcionário não encontrado" });
    }
    
    // Buscar dependentes
    const dependentes = await db.select().from(peopleDependentes)
      .where(eq(peopleDependentes.funcionarioId, funcionario.id));
    
    // Buscar benefícios
    const beneficios = await db.select().from(peopleFuncionarioBeneficios)
      .where(eq(peopleFuncionarioBeneficios.funcionarioId, funcionario.id));
    
    res.json({ ...funcionario, dependentes, beneficios });
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar funcionário" });
  }
});

router.post("/funcionarios", async (req: Request, res: Response) => {
  try {
    const validatedData = insertPeopleFuncionarioSchema.parse(req.body);
    
    const [funcionario] = await db.insert(peopleFuncionarios)
      .values(validatedData)
      .returning();
    
    res.status(201).json(funcionario);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos", details: error.errors });
    }
    console.error("Erro ao criar funcionário:", error);
    res.status(500).json({ error: "Erro ao criar funcionário" });
  }
});

router.put("/funcionarios/:id", async (req: Request, res: Response) => {
  try {
    const [funcionario] = await db.update(peopleFuncionarios)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(peopleFuncionarios.id, Number(req.params.id)))
      .returning();
    
    res.json(funcionario);
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar funcionário" });
  }
});

router.delete("/funcionarios/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(peopleFuncionarios)
      .where(eq(peopleFuncionarios.id, Number(req.params.id)));
    
    res.json({ message: "Funcionário excluído" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao excluir funcionário" });
  }
});

// ========== Dependentes ==========

router.get("/funcionarios/:id/dependentes", async (req: Request, res: Response) => {
  try {
    const dependentes = await db.select().from(peopleDependentes)
      .where(eq(peopleDependentes.funcionarioId, Number(req.params.id)));
    
    res.json(dependentes);
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar dependentes" });
  }
});

router.post("/funcionarios/:id/dependentes", async (req: Request, res: Response) => {
  try {
    const [dependente] = await db.insert(peopleDependentes)
      .values({
        ...req.body,
        funcionarioId: Number(req.params.id)
      })
      .returning();
    
    res.status(201).json(dependente);
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar dependente" });
  }
});

router.delete("/dependentes/:id", async (req: Request, res: Response) => {
  try {
    await db.delete(peopleDependentes)
      .where(eq(peopleDependentes.id, Number(req.params.id)));
    
    res.json({ message: "Dependente excluído" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao excluir dependente" });
  }
});

// ========== Eventos de Folha ==========

router.get("/eventos-folha", async (req: Request, res: Response) => {
  try {
    const eventos = await db.select().from(peopleEventosFolha)
      .orderBy(peopleEventosFolha.codigo);
    
    res.json(eventos);
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar eventos" });
  }
});

router.post("/eventos-folha", async (req: Request, res: Response) => {
  try {
    const validatedData = insertPeopleEventoFolhaSchema.parse(req.body);
    
    const [evento] = await db.insert(peopleEventosFolha)
      .values(validatedData)
      .returning();
    
    res.status(201).json(evento);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos", details: error.errors });
    }
    res.status(500).json({ error: "Erro ao criar evento" });
  }
});

// ========== Folha de Pagamento ==========

router.get("/folhas", async (req: Request, res: Response) => {
  try {
    const { tenantId, competencia, status } = req.query;
    
    let folhas = await db.select().from(peopleFolhaPagamento)
      .orderBy(desc(peopleFolhaPagamento.competencia));
    
    if (competencia) {
      folhas = folhas.filter(f => f.competencia === competencia);
    }
    
    if (status) {
      folhas = folhas.filter(f => f.status === status);
    }
    
    res.json(folhas);
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar folhas" });
  }
});

router.get("/folhas/:id", async (req: Request, res: Response) => {
  try {
    const [folha] = await db.select().from(peopleFolhaPagamento)
      .where(eq(peopleFolhaPagamento.id, Number(req.params.id)))
      .limit(1);
    
    if (!folha) {
      return res.status(404).json({ error: "Folha não encontrada" });
    }
    
    const itens = await db.select().from(peopleFolhaItens)
      .where(eq(peopleFolhaItens.folhaId, folha.id));
    
    res.json({ ...folha, itens });
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar folha" });
  }
});

router.post("/folhas", async (req: Request, res: Response) => {
  try {
    const validatedData = insertPeopleFolhaPagamentoSchema.parse(req.body);
    
    const [folha] = await db.insert(peopleFolhaPagamento)
      .values(validatedData)
      .returning();
    
    res.status(201).json(folha);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos", details: error.errors });
    }
    res.status(500).json({ error: "Erro ao criar folha" });
  }
});

// ========== Cálculos via Serviço Python ==========

router.get("/tabelas/inss", async (req: Request, res: Response) => {
  try {
    const resultado = await proxyToPeopleService("/tabelas/inss");
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: "Erro ao obter tabela INSS" });
  }
});

router.get("/tabelas/irrf", async (req: Request, res: Response) => {
  try {
    const resultado = await proxyToPeopleService("/tabelas/irrf");
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: "Erro ao obter tabela IRRF" });
  }
});

router.post("/calcular/inss", async (req: Request, res: Response) => {
  try {
    const { salario } = req.body;
    const resultado = await proxyToPeopleService(`/calcular/inss?salario=${salario}`, "POST");
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: "Erro ao calcular INSS" });
  }
});

router.post("/calcular/irrf", async (req: Request, res: Response) => {
  try {
    const { base, dependentes } = req.body;
    const resultado = await proxyToPeopleService(`/calcular/irrf?base=${base}&dependentes=${dependentes || 0}`, "POST");
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: "Erro ao calcular IRRF" });
  }
});

router.post("/calcular/folha", async (req: Request, res: Response) => {
  try {
    const resultado = await proxyToPeopleService("/calcular/folha", "POST", req.body);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: "Erro ao calcular folha" });
  }
});

router.post("/calcular/ferias", async (req: Request, res: Response) => {
  try {
    const resultado = await proxyToPeopleService("/calcular/ferias", "POST", req.body);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: "Erro ao calcular férias" });
  }
});

router.post("/calcular/rescisao", async (req: Request, res: Response) => {
  try {
    const resultado = await proxyToPeopleService("/calcular/rescisao", "POST", req.body);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: "Erro ao calcular rescisão" });
  }
});

router.post("/calcular/ponto", async (req: Request, res: Response) => {
  try {
    const resultado = await proxyToPeopleService("/calcular/ponto", "POST", req.body);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: "Erro ao calcular ponto" });
  }
});

// ========== eSocial ==========

router.get("/esocial/eventos", async (req: Request, res: Response) => {
  try {
    const resultado = await proxyToPeopleService("/esocial/eventos");
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar eventos eSocial" });
  }
});

router.post("/esocial/gerar-xml/:evento", async (req: Request, res: Response) => {
  try {
    const resultado = await proxyToPeopleService(`/esocial/gerar-xml/${req.params.evento}`, "POST", req.body);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: "Erro ao gerar XML eSocial" });
  }
});

// ========== Férias ==========

router.get("/ferias", async (req: Request, res: Response) => {
  try {
    const { funcionarioId, status } = req.query;
    
    let ferias = await db.select().from(peopleFerias)
      .orderBy(desc(peopleFerias.periodoAquisitivoInicio));
    
    if (funcionarioId) {
      ferias = ferias.filter(f => f.funcionarioId === Number(funcionarioId));
    }
    
    if (status) {
      ferias = ferias.filter(f => f.status === status);
    }
    
    res.json(ferias);
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar férias" });
  }
});

router.post("/ferias", async (req: Request, res: Response) => {
  try {
    const [ferias] = await db.insert(peopleFerias)
      .values({
        ...req.body,
        periodoAquisitivoInicio: new Date(req.body.periodoAquisitivoInicio),
        periodoAquisitivoFim: new Date(req.body.periodoAquisitivoFim),
        dataInicio: req.body.dataInicio ? new Date(req.body.dataInicio) : null,
        dataFim: req.body.dataFim ? new Date(req.body.dataFim) : null,
      })
      .returning();
    
    res.status(201).json(ferias);
  } catch (error) {
    res.status(500).json({ error: "Erro ao registrar férias" });
  }
});

// ========== Ponto ==========

router.get("/ponto", async (req: Request, res: Response) => {
  try {
    const { funcionarioId, dataInicio, dataFim } = req.query;
    
    let registros = await db.select().from(peoplePonto)
      .orderBy(desc(peoplePonto.data));
    
    if (funcionarioId) {
      registros = registros.filter(r => r.funcionarioId === Number(funcionarioId));
    }
    
    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar registros de ponto" });
  }
});

router.post("/ponto", async (req: Request, res: Response) => {
  try {
    // Calcular horas via serviço Python
    const calculo = await proxyToPeopleService("/calcular/ponto", "POST", req.body);
    
    const [registro] = await db.insert(peoplePonto)
      .values({
        funcionarioId: req.body.funcionarioId,
        data: new Date(req.body.data),
        entrada1: req.body.entrada1,
        saida1: req.body.saida1,
        entrada2: req.body.entrada2 || null,
        saida2: req.body.saida2 || null,
        horasTrabalhadas: calculo.calculo?.horasTrabalhadas?.toString() || "0",
        horasExtras: calculo.calculo?.horasExtras?.toString() || "0",
        horasNoturnas: calculo.calculo?.horasNoturnas?.toString() || "0",
      })
      .returning();
    
    res.status(201).json({ ...registro, calculo });
  } catch (error) {
    res.status(500).json({ error: "Erro ao registrar ponto" });
  }
});

// ========== Benefícios ==========

router.get("/beneficios", async (req: Request, res: Response) => {
  try {
    const beneficios = await db.select().from(peopleBeneficios)
      .orderBy(peopleBeneficios.nome);
    
    res.json(beneficios);
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar benefícios" });
  }
});

router.post("/beneficios", async (req: Request, res: Response) => {
  try {
    const [beneficio] = await db.insert(peopleBeneficios)
      .values(req.body)
      .returning();
    
    res.status(201).json(beneficio);
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar benefício" });
  }
});

// ========== Estatísticas ==========

router.get("/stats/:tenantId?", async (req: Request, res: Response) => {
  try {
    const totalFuncionarios = await db.select({ count: sql`count(*)` }).from(peopleFuncionarios);
    const funcionariosAtivos = await db.select({ count: sql`count(*)` }).from(peopleFuncionarios)
      .where(eq(peopleFuncionarios.status, "ativo"));
    const totalCargos = await db.select({ count: sql`count(*)` }).from(peopleCargos);
    const totalDepartamentos = await db.select({ count: sql`count(*)` }).from(peopleDepartamentos);
    
    res.json({
      totalFuncionarios: Number(totalFuncionarios[0]?.count || 0),
      funcionariosAtivos: Number(funcionariosAtivos[0]?.count || 0),
      totalCargos: Number(totalCargos[0]?.count || 0),
      totalDepartamentos: Number(totalDepartamentos[0]?.count || 0),
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao obter estatísticas" });
  }
});

export default router;
