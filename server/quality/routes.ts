/**
 * Quality Routes — /api/quality/*
 *
 * SPRINT-1 (SEC): auth + tenantId em todos os 37 endpoints
 *   - isAuthenticated + tenantContext + requireTenant em cada rota
 *   - Todas as queries filtradas por tenantId (integer via TENANT_ADAPTER)
 *   - Operações de escrita verificam ownership antes de UPDATE/DELETE
 */

import { Router, type Request, type Response } from "express";
import { db } from "../../db/index";
import {
  qualitySamples, qualityLabReports, qualityNonConformities,
  qualityDocuments, qualityDocumentRevisions, qualityFieldForms,
  qualityTrainingMatrix, fieldExpenses, suppliers, environmentalServices,
  insertQualitySampleSchema, insertQualityLabReportSchema,
  insertQualityNonConformitySchema, insertQualityDocumentSchema,
  insertQualityFieldFormSchema, insertQualityTrainingMatrixSchema,
  insertFieldExpenseSchema, insertEnvironmentalServiceSchema,
} from "@shared/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant } from "../tenantContext";

const router = Router();

// Middleware stack aplicado em TODOS os endpoints deste router
const auth = [isAuthenticated, tenantContext, requireTenant] as const;

// Helper: extrai tenantId como integer (tabelas quality usam integer FK)
function tid(req: Request): number {
  return Number((req as any).tenantId);
}

// ========== AMOSTRAS (RF-QC01) ==========

router.get("/samples", ...auth, async (req: Request, res: Response) => {
  try {
    const tenantId = tid(req);
    const { projectId, engProjectId, status, startDate, endDate, limit = 50 } = req.query;

    const conditions: any[] = [eq(qualitySamples.tenantId, tenantId)];
    if (projectId)    conditions.push(eq(qualitySamples.projectId,           Number(projectId)));
    if (engProjectId) conditions.push(eq((qualitySamples as any).engineeringProjectId, engProjectId as string));
    if (status)       conditions.push(eq(qualitySamples.status,              status as string));
    if (startDate)    conditions.push(gte(qualitySamples.collectionDate,     new Date(startDate as string)));
    if (endDate)      conditions.push(lte(qualitySamples.collectionDate,     new Date(endDate as string)));

    const samples = await db.select()
      .from(qualitySamples)
      .where(and(...conditions))
      .orderBy(desc(qualitySamples.createdAt))
      .limit(Number(limit));

    return res.json({ data: samples });
  } catch (error) {
    console.error("[Quality] Error fetching samples:", error);
    return res.status(500).json({ error: "Erro ao buscar amostras" });
  }
});

router.post("/samples", ...auth, async (req: Request, res: Response) => {
  try {
    const validated = insertQualitySampleSchema.parse({
      ...req.body,
      tenantId: tid(req),
    });
    const [sample] = await db.insert(qualitySamples).values(validated).returning();
    return res.status(201).json({ data: sample });
  } catch (error) {
    console.error("[Quality] Error creating sample:", error);
    return res.status(500).json({ error: "Erro ao criar amostra" });
  }
});

router.get("/samples/:id", ...auth, async (req: Request, res: Response) => {
  try {
    const [sample] = await db.select()
      .from(qualitySamples)
      .where(and(
        eq(qualitySamples.id, Number(req.params.id)),
        eq(qualitySamples.tenantId, tid(req)),
      ));

    if (!sample) return res.status(404).json({ error: "Amostra não encontrada" });
    return res.json({ data: sample });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao buscar amostra" });
  }
});

router.put("/samples/:id", ...auth, async (req: Request, res: Response) => {
  try {
    const partialSchema = insertQualitySampleSchema.partial();
    const validated = partialSchema.parse(req.body);
    const [sample] = await db.update(qualitySamples)
      .set({ ...validated, updatedAt: new Date() })
      .where(and(
        eq(qualitySamples.id, Number(req.params.id)),
        eq(qualitySamples.tenantId, tid(req)),
      ))
      .returning();

    if (!sample) return res.status(404).json({ error: "Amostra não encontrada" });
    return res.json({ data: sample });
  } catch (error) {
    console.error("[Quality] Error updating sample:", error);
    return res.status(500).json({ error: "Erro ao atualizar amostra" });
  }
});

// ========== LAUDOS LABORATORIAIS (RF-QC01) ==========

router.get("/lab-reports", ...auth, async (req: Request, res: Response) => {
  try {
    const tenantId = tid(req);
    const { sampleId, laboratoryId, status, limit = 50 } = req.query;

    const conditions: any[] = [eq(qualityLabReports.tenantId, tenantId)];
    if (sampleId)     conditions.push(eq(qualityLabReports.sampleId,     Number(sampleId)));
    if (laboratoryId) conditions.push(eq(qualityLabReports.laboratoryId, Number(laboratoryId)));
    if (status)       conditions.push(eq(qualityLabReports.status,       status as string));

    const reports = await db.select()
      .from(qualityLabReports)
      .where(and(...conditions))
      .orderBy(desc(qualityLabReports.createdAt))
      .limit(Number(limit));

    return res.json({ data: reports });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao buscar laudos" });
  }
});

router.post("/lab-reports", ...auth, async (req: Request, res: Response) => {
  try {
    const validated = insertQualityLabReportSchema.parse({
      ...req.body,
      tenantId: tid(req),
    });
    const [report] = await db.insert(qualityLabReports).values(validated).returning();
    return res.status(201).json({ data: report });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao criar laudo" });
  }
});

router.put("/lab-reports/:id", ...auth, async (req: Request, res: Response) => {
  try {
    const partialSchema = insertQualityLabReportSchema.partial();
    const validated = partialSchema.parse(req.body);
    const [report] = await db.update(qualityLabReports)
      .set({ ...validated, updatedAt: new Date() })
      .where(and(
        eq(qualityLabReports.id, Number(req.params.id)),
        eq(qualityLabReports.tenantId, tid(req)),
      ))
      .returning();

    if (!report) return res.status(404).json({ error: "Laudo não encontrado" });
    return res.json({ data: report });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao atualizar laudo" });
  }
});

// ========== NÃO CONFORMIDADES / RNC (RF-QC03) ==========

router.get("/non-conformities", ...auth, async (req: Request, res: Response) => {
  try {
    const tenantId = tid(req);
    const { projectId, engProjectId, status, type, severity, limit = 50 } = req.query;

    const conditions: any[] = [eq(qualityNonConformities.tenantId, tenantId)];
    if (projectId)    conditions.push(eq(qualityNonConformities.projectId,  Number(projectId)));
    if (engProjectId) conditions.push(eq((qualityNonConformities as any).engineeringProjectId, engProjectId as string));
    if (status)       conditions.push(eq(qualityNonConformities.status,     status as string));
    if (type)         conditions.push(eq(qualityNonConformities.type,       type as string));
    if (severity)     conditions.push(eq(qualityNonConformities.severity,   severity as string));

    const rncs = await db.select()
      .from(qualityNonConformities)
      .where(and(...conditions))
      .orderBy(desc(qualityNonConformities.createdAt))
      .limit(Number(limit));

    return res.json({ data: rncs });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao buscar não conformidades" });
  }
});

router.post("/non-conformities", ...auth, async (req: Request, res: Response) => {
  try {
    const validated = insertQualityNonConformitySchema.parse({
      ...req.body,
      tenantId: tid(req),
    });
    const [rnc] = await db.insert(qualityNonConformities).values(validated).returning();
    return res.status(201).json({ data: rnc });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao criar não conformidade" });
  }
});

router.put("/non-conformities/:id", ...auth, async (req: Request, res: Response) => {
  try {
    const partialSchema = insertQualityNonConformitySchema.partial();
    const validated = partialSchema.parse(req.body);
    const [rnc] = await db.update(qualityNonConformities)
      .set({ ...validated, updatedAt: new Date() })
      .where(and(
        eq(qualityNonConformities.id, Number(req.params.id)),
        eq(qualityNonConformities.tenantId, tid(req)),
      ))
      .returning();

    if (!rnc) return res.status(404).json({ error: "RNC não encontrada" });
    return res.json({ data: rnc });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao atualizar não conformidade" });
  }
});

router.post("/non-conformities/:id/close", ...auth, async (req: Request, res: Response) => {
  try {
    const { closedBy, verifiedBy, effectivenessVerified } = req.body;
    const [rnc] = await db.update(qualityNonConformities)
      .set({
        status: "fechada",
        closedAt: new Date(),
        closedBy,
        verifiedBy,
        verificationDate: new Date(),
        effectivenessVerified: effectivenessVerified ? 1 : 0,
        updatedAt: new Date(),
      })
      .where(and(
        eq(qualityNonConformities.id, Number(req.params.id)),
        eq(qualityNonConformities.tenantId, tid(req)),
      ))
      .returning();

    if (!rnc) return res.status(404).json({ error: "RNC não encontrada" });
    return res.json({ data: rnc, message: "RNC fechada com sucesso" });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao fechar não conformidade" });
  }
});

// ========== DOCUMENTOS QMS (RF-QC02) ==========

router.get("/documents", ...auth, async (req: Request, res: Response) => {
  try {
    const tenantId = tid(req);
    const { type, category, status, limit = 50 } = req.query;

    const conditions: any[] = [eq(qualityDocuments.tenantId, tenantId)];
    if (type)     conditions.push(eq(qualityDocuments.type,     type as string));
    if (category) conditions.push(eq(qualityDocuments.category, category as string));
    if (status)   conditions.push(eq(qualityDocuments.status,   status as string));

    const docs = await db.select()
      .from(qualityDocuments)
      .where(and(...conditions))
      .orderBy(desc(qualityDocuments.createdAt))
      .limit(Number(limit));

    return res.json({ data: docs });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao buscar documentos" });
  }
});

router.post("/documents", ...auth, async (req: Request, res: Response) => {
  try {
    const validated = insertQualityDocumentSchema.parse({
      ...req.body,
      tenantId: tid(req),
    });
    const [doc] = await db.insert(qualityDocuments).values(validated).returning();
    return res.status(201).json({ data: doc });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao criar documento" });
  }
});

router.put("/documents/:id", ...auth, async (req: Request, res: Response) => {
  try {
    const partialSchema = insertQualityDocumentSchema.partial();
    const validated = partialSchema.parse(req.body);
    const [doc] = await db.update(qualityDocuments)
      .set({ ...validated, updatedAt: new Date() })
      .where(and(
        eq(qualityDocuments.id, Number(req.params.id)),
        eq(qualityDocuments.tenantId, tid(req)),
      ))
      .returning();

    if (!doc) return res.status(404).json({ error: "Documento não encontrado" });
    return res.json({ data: doc });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao atualizar documento" });
  }
});

router.post("/documents/:id/revision", ...auth, async (req: Request, res: Response) => {
  try {
    const tenantId = tid(req);
    const documentId = Number(req.params.id);
    const { changeDescription, revisedBy, fileUrl } = req.body;

    const [currentDoc] = await db.select()
      .from(qualityDocuments)
      .where(and(
        eq(qualityDocuments.id, documentId),
        eq(qualityDocuments.tenantId, tenantId),
      ));

    if (!currentDoc) return res.status(404).json({ error: "Documento não encontrado" });

    const newRevision = (currentDoc.revisionNumber || 0) + 1;
    const newVersion  = String(newRevision).padStart(2, "0");

    await db.insert(qualityDocumentRevisions).values({
      documentId,
      version: currentDoc.version,
      revisionNumber: currentDoc.revisionNumber,
      changeDescription,
      revisedBy,
      fileUrl: currentDoc.fileUrl,
    });

    const [updatedDoc] = await db.update(qualityDocuments)
      .set({
        version: newVersion,
        revisionNumber: newRevision,
        status: "em_revisao",
        fileUrl: fileUrl || currentDoc.fileUrl,
        updatedAt: new Date(),
      })
      .where(and(
        eq(qualityDocuments.id, documentId),
        eq(qualityDocuments.tenantId, tenantId),
      ))
      .returning();

    return res.json({ data: updatedDoc, message: `Revisão ${newVersion} criada` });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao criar revisão" });
  }
});

router.get("/documents/:id/revisions", ...auth, async (req: Request, res: Response) => {
  try {
    const tenantId = tid(req);
    // Verifica ownership do documento pai antes de listar revisões
    const [doc] = await db.select({ id: qualityDocuments.id })
      .from(qualityDocuments)
      .where(and(
        eq(qualityDocuments.id, Number(req.params.id)),
        eq(qualityDocuments.tenantId, tenantId),
      ));

    if (!doc) return res.status(404).json({ error: "Documento não encontrado" });

    const revisions = await db.select()
      .from(qualityDocumentRevisions)
      .where(eq(qualityDocumentRevisions.documentId, Number(req.params.id)))
      .orderBy(desc(qualityDocumentRevisions.revisionNumber));

    return res.json({ data: revisions });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao buscar revisões" });
  }
});

// ========== FORMULÁRIOS DE CAMPO (RF-OP03) ==========

router.get("/field-forms", ...auth, async (req: Request, res: Response) => {
  try {
    const tenantId = tid(req);
    const { projectId, formType, status, limit = 50 } = req.query;

    const conditions: any[] = [eq(qualityFieldForms.tenantId, tenantId)];
    if (projectId) conditions.push(eq(qualityFieldForms.projectId, Number(projectId)));
    if (formType)  conditions.push(eq(qualityFieldForms.formType,  formType as string));
    if (status)    conditions.push(eq(qualityFieldForms.status,    status as string));

    const forms = await db.select()
      .from(qualityFieldForms)
      .where(and(...conditions))
      .orderBy(desc(qualityFieldForms.createdAt))
      .limit(Number(limit));

    return res.json({ data: forms });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao buscar formulários" });
  }
});

router.post("/field-forms", ...auth, async (req: Request, res: Response) => {
  try {
    const validated = insertQualityFieldFormSchema.parse({
      ...req.body,
      tenantId: tid(req),
    });
    const [form] = await db.insert(qualityFieldForms).values(validated).returning();
    return res.status(201).json({ data: form });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao criar formulário" });
  }
});

router.put("/field-forms/:id", ...auth, async (req: Request, res: Response) => {
  try {
    const partialSchema = insertQualityFieldFormSchema.partial();
    const validated = partialSchema.parse(req.body);
    const [form] = await db.update(qualityFieldForms)
      .set({ ...validated, updatedAt: new Date(), syncedAt: new Date() })
      .where(and(
        eq(qualityFieldForms.id, Number(req.params.id)),
        eq(qualityFieldForms.tenantId, tid(req)),
      ))
      .returning();

    if (!form) return res.status(404).json({ error: "Formulário não encontrado" });
    return res.json({ data: form });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao atualizar formulário" });
  }
});

// ========== MATRIZ DE TREINAMENTOS (FT-57) ==========

router.get("/training-matrix", ...auth, async (req: Request, res: Response) => {
  try {
    const tenantId = tid(req);
    const { employeeId, status, trainingType, limit = 100 } = req.query;

    const conditions: any[] = [eq(qualityTrainingMatrix.tenantId, tenantId)];
    if (employeeId)   conditions.push(eq(qualityTrainingMatrix.employeeId,   employeeId as string));
    if (status)       conditions.push(eq(qualityTrainingMatrix.status,       status as string));
    if (trainingType) conditions.push(eq(qualityTrainingMatrix.trainingType, trainingType as string));

    const trainings = await db.select()
      .from(qualityTrainingMatrix)
      .where(and(...conditions))
      .orderBy(desc(qualityTrainingMatrix.createdAt))
      .limit(Number(limit));

    return res.json({ data: trainings });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao buscar treinamentos" });
  }
});

router.post("/training-matrix", ...auth, async (req: Request, res: Response) => {
  try {
    const validated = insertQualityTrainingMatrixSchema.parse({
      ...req.body,
      tenantId: tid(req),
    });
    const [training] = await db.insert(qualityTrainingMatrix).values(validated).returning();
    return res.status(201).json({ data: training });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao criar treinamento" });
  }
});

router.get("/training-matrix/expiring", ...auth, async (req: Request, res: Response) => {
  try {
    const tenantId = tid(req);
    const daysAhead = Number(req.query.days) || 30;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const expiring = await db.select()
      .from(qualityTrainingMatrix)
      .where(and(
        eq(qualityTrainingMatrix.tenantId, tenantId),
        lte(qualityTrainingMatrix.expiryDate, futureDate),
        gte(qualityTrainingMatrix.expiryDate, new Date()),
      ))
      .orderBy(qualityTrainingMatrix.expiryDate);

    return res.json({ data: expiring });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao buscar treinamentos vencendo" });
  }
});

// ========== DESPESAS DE CAMPO (RF-AF05) ==========

router.get("/field-expenses", ...auth, async (req: Request, res: Response) => {
  try {
    const tenantId = tid(req);
    const { projectId, responsibleId, status, category, limit = 50 } = req.query;

    const conditions: any[] = [eq(fieldExpenses.tenantId, tenantId)];
    if (projectId)     conditions.push(eq(fieldExpenses.projectId,     Number(projectId)));
    if (responsibleId) conditions.push(eq(fieldExpenses.responsibleId, responsibleId as string));
    if (status)        conditions.push(eq(fieldExpenses.status,        status as string));
    if (category)      conditions.push(eq(fieldExpenses.category,      category as string));

    const expenses = await db.select()
      .from(fieldExpenses)
      .where(and(...conditions))
      .orderBy(desc(fieldExpenses.createdAt))
      .limit(Number(limit));

    return res.json({ data: expenses });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao buscar despesas" });
  }
});

router.post("/field-expenses", ...auth, async (req: Request, res: Response) => {
  try {
    const validated = insertFieldExpenseSchema.parse({
      ...req.body,
      tenantId: tid(req),
    });
    const [expense] = await db.insert(fieldExpenses).values(validated).returning();
    return res.status(201).json({ data: expense });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao criar despesa" });
  }
});

router.post("/field-expenses/:id/approve-leader", ...auth, async (req: Request, res: Response) => {
  try {
    const { approvedBy } = req.body;
    const [expense] = await db.update(fieldExpenses)
      .set({
        status: "aprovado_lider",
        approvedByLeader: approvedBy,
        approvedByLeaderAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(fieldExpenses.id, Number(req.params.id)),
        eq(fieldExpenses.tenantId, tid(req)),
      ))
      .returning();

    if (!expense) return res.status(404).json({ error: "Despesa não encontrada" });
    return res.json({ data: expense, message: "Aprovado pelo líder" });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao aprovar despesa" });
  }
});

router.post("/field-expenses/:id/approve-finance", ...auth, async (req: Request, res: Response) => {
  try {
    const { approvedBy } = req.body;
    const [expense] = await db.update(fieldExpenses)
      .set({
        status: "aprovado_financeiro",
        approvedByFinance: approvedBy,
        approvedByFinanceAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(fieldExpenses.id, Number(req.params.id)),
        eq(fieldExpenses.tenantId, tid(req)),
      ))
      .returning();

    if (!expense) return res.status(404).json({ error: "Despesa não encontrada" });
    return res.json({ data: expense, message: "Aprovado pelo financeiro" });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao aprovar despesa" });
  }
});

router.post("/field-expenses/:id/reject", ...auth, async (req: Request, res: Response) => {
  try {
    const { rejectionReason } = req.body;
    const [expense] = await db.update(fieldExpenses)
      .set({
        status: "rejeitado",
        rejectionReason,
        updatedAt: new Date(),
      })
      .where(and(
        eq(fieldExpenses.id, Number(req.params.id)),
        eq(fieldExpenses.tenantId, tid(req)),
      ))
      .returning();

    if (!expense) return res.status(404).json({ error: "Despesa não encontrada" });
    return res.json({ data: expense, message: "Despesa rejeitada" });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao rejeitar despesa" });
  }
});

// ========== HOMOLOGAÇÃO DE FORNECEDORES (RF-QC04) ==========

router.get("/homologated-suppliers", ...auth, async (req: Request, res: Response) => {
  try {
    const tenantId = tid(req);
    const { status, limit = 50 } = req.query;

    const conditions: any[] = [
      eq(suppliers.isHomologated, 1),
      eq(suppliers.tenantId, tenantId),
    ];
    if (status) conditions.push(eq(suppliers.homologationStatus, status as string));

    const suppliersList = await db.select()
      .from(suppliers)
      .where(and(...conditions))
      .orderBy(desc(suppliers.qualityScore))
      .limit(Number(limit));

    return res.json({ data: suppliersList });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao buscar fornecedores homologados" });
  }
});

router.post("/suppliers/:id/homologate", ...auth, async (req: Request, res: Response) => {
  try {
    const { certifications, qualityScore, expiryMonths = 12 } = req.body;
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + expiryMonths);

    const [supplier] = await db.update(suppliers)
      .set({
        isHomologated: 1,
        homologationDate: new Date(),
        homologationExpiry: expiryDate,
        homologationStatus: "approved",
        certifications,
        qualityScore,
        blockedForPurchase: 0,
        updatedAt: new Date(),
      })
      .where(and(
        eq(suppliers.id, Number(req.params.id)),
        eq(suppliers.tenantId, tid(req)),
      ))
      .returning();

    if (!supplier) return res.status(404).json({ error: "Fornecedor não encontrado" });
    return res.json({ data: supplier, message: "Fornecedor homologado" });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao homologar fornecedor" });
  }
});

router.post("/suppliers/:id/block", ...auth, async (req: Request, res: Response) => {
  try {
    const { blockReason } = req.body;
    const [supplier] = await db.update(suppliers)
      .set({
        blockedForPurchase: 1,
        blockReason,
        homologationStatus: "blocked",
        updatedAt: new Date(),
      })
      .where(and(
        eq(suppliers.id, Number(req.params.id)),
        eq(suppliers.tenantId, tid(req)),
      ))
      .returning();

    if (!supplier) return res.status(404).json({ error: "Fornecedor não encontrado" });
    return res.json({ data: supplier, message: "Fornecedor bloqueado" });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao bloquear fornecedor" });
  }
});

router.get("/suppliers/expiring-homologation", ...auth, async (req: Request, res: Response) => {
  try {
    const tenantId = tid(req);
    const daysAhead = Number(req.query.days) || 60;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const expiring = await db.select()
      .from(suppliers)
      .where(and(
        eq(suppliers.tenantId, tenantId),
        eq(suppliers.isHomologated, 1),
        lte(suppliers.homologationExpiry, futureDate),
        gte(suppliers.homologationExpiry, new Date()),
      ))
      .orderBy(suppliers.homologationExpiry);

    return res.json({ data: expiring });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao buscar homologações vencendo" });
  }
});

// ========== DASHBOARD QUALIDADE ==========

router.get("/dashboard", ...auth, async (req: Request, res: Response) => {
  try {
    const tenantId = tid(req);

    const [samplesCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(qualitySamples)
      .where(eq(qualitySamples.tenantId, tenantId));

    const [openRncsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(qualityNonConformities)
      .where(and(
        eq(qualityNonConformities.tenantId, tenantId),
        eq(qualityNonConformities.status, "aberta"),
      ));

    const [pendingExpenses] = await db
      .select({
        count: sql<number>`count(*)`,
        total: sql<number>`COALESCE(sum(amount), 0)`,
      })
      .from(fieldExpenses)
      .where(and(
        eq(fieldExpenses.tenantId, tenantId),
        eq(fieldExpenses.status, "pendente"),
      ));

    const [activeDocuments] = await db
      .select({ count: sql<number>`count(*)` })
      .from(qualityDocuments)
      .where(and(
        eq(qualityDocuments.tenantId, tenantId),
        eq(qualityDocuments.status, "vigente"),
      ));

    const thirtyDays = new Date();
    thirtyDays.setDate(thirtyDays.getDate() + 30);

    const [expiringTrainings] = await db
      .select({ count: sql<number>`count(*)` })
      .from(qualityTrainingMatrix)
      .where(and(
        eq(qualityTrainingMatrix.tenantId, tenantId),
        lte(qualityTrainingMatrix.expiryDate, thirtyDays),
        gte(qualityTrainingMatrix.expiryDate, new Date()),
      ));

    return res.json({
      samples:          { total: samplesCount?.count || 0 },
      nonConformities:  { open: openRncsCount?.count || 0 },
      expenses:         { pending: pendingExpenses?.count || 0, totalPending: pendingExpenses?.total || 0 },
      documents:        { active: activeDocuments?.count || 0 },
      trainings:        { expiringSoon: expiringTrainings?.count || 0 },
    });
  } catch (error) {
    console.error("[Quality] Dashboard error:", error);
    return res.status(500).json({ error: "Erro ao carregar dashboard" });
  }
});

// ========== SERVIÇOS AMBIENTAIS ==========

router.get("/services", ...auth, async (req: Request, res: Response) => {
  try {
    const tenantId = tid(req);
    const { category, isActive = "1", limit = 100 } = req.query;

    const conditions: any[] = [eq(environmentalServices.tenantId, tenantId)];
    if (category) conditions.push(eq(environmentalServices.category, category as string));
    if (isActive !== undefined) conditions.push(eq(environmentalServices.isActive, Number(isActive)));

    const services = await db.select()
      .from(environmentalServices)
      .where(and(...conditions))
      .orderBy(environmentalServices.category, environmentalServices.name)
      .limit(Number(limit));

    return res.json({ data: services });
  } catch (error) {
    console.error("[Quality] Error fetching services:", error);
    return res.status(500).json({ error: "Erro ao buscar serviços" });
  }
});

router.get("/services/:id", ...auth, async (req: Request, res: Response) => {
  try {
    const [service] = await db.select()
      .from(environmentalServices)
      .where(and(
        eq(environmentalServices.id, Number(req.params.id)),
        eq(environmentalServices.tenantId, tid(req)),
      ));

    if (!service) return res.status(404).json({ error: "Serviço não encontrado" });
    return res.json({ data: service });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao buscar serviço" });
  }
});

router.post("/services", ...auth, async (req: Request, res: Response) => {
  try {
    const validated = insertEnvironmentalServiceSchema.parse({
      ...req.body,
      tenantId: tid(req),
    });
    const [service] = await db.insert(environmentalServices).values(validated).returning();
    return res.status(201).json({ data: service });
  } catch (error) {
    console.error("[Quality] Error creating service:", error);
    return res.status(500).json({ error: "Erro ao criar serviço" });
  }
});

router.put("/services/:id", ...auth, async (req: Request, res: Response) => {
  try {
    const partialSchema = insertEnvironmentalServiceSchema.partial();
    const validated = partialSchema.parse(req.body);
    const [service] = await db.update(environmentalServices)
      .set({ ...validated, updatedAt: new Date() })
      .where(and(
        eq(environmentalServices.id, Number(req.params.id)),
        eq(environmentalServices.tenantId, tid(req)),
      ))
      .returning();

    if (!service) return res.status(404).json({ error: "Serviço não encontrado" });
    return res.json({ data: service });
  } catch (error) {
    console.error("[Quality] Error updating service:", error);
    return res.status(500).json({ error: "Erro ao atualizar serviço" });
  }
});

router.delete("/services/:id", ...auth, async (req: Request, res: Response) => {
  try {
    const [deleted] = await db.delete(environmentalServices)
      .where(and(
        eq(environmentalServices.id, Number(req.params.id)),
        eq(environmentalServices.tenantId, tid(req)),
      ))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Serviço não encontrado" });
    return res.json({ success: true });
  } catch (error) {
    console.error("[Quality] Error deleting service:", error);
    return res.status(500).json({ error: "Erro ao excluir serviço" });
  }
});

export default router;
