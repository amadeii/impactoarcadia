import { db } from "../../db/index";
import { eq, and, desc, ilike, or } from "drizzle-orm";
import {
  valuationProjects,
  valuationInputs,
  valuationAssumptions,
  valuationCalculations,
  valuationMaturityScores,
  valuationCapTable,
  valuationTransactions,
  valuationDocuments,
  valuationDocumentLogs,
  valuationCanvas,
  valuationAgentInsights,
  valuationChecklistCategories,
  valuationChecklistItems,
  valuationChecklistProgress,
  valuationChecklistAttachments,
  valuationCategoryWeights,
  valuationSectorBenchmarks,
  valuationSectorScores,
  valuationCanvasBlocks,
  valuationCanvasSnapshots,
  valuationGovernance,
  valuationPdca,
  valuationSwot,
  valuationResults,
  valuationAssets,
  valuationReports,
  valuationAiLog,
  crmClients,
  InsertValuationProject,
  InsertValuationInput,
  InsertValuationAssumption,
  InsertValuationCalculation,
  InsertValuationMaturityScore,
  InsertValuationCapTableEntry,
  InsertValuationTransaction,
  InsertValuationDocument,
  InsertValuationDocumentLog,
  InsertValuationCanvasBlock,
  InsertValuationAgentInsight,
  InsertValuationChecklistProgress,
  InsertValuationChecklistAttachment,
  InsertValuationCategoryWeight,
  InsertValuationSectorBenchmark,
  InsertValuationSectorScore,
  InsertValuationCanvasSnapshot,
  InsertValuationGovernance,
  InsertValuationPdca,
  InsertValuationSwot,
  InsertValuationResult,
  InsertValuationAsset,
  InsertValuationReport,
  InsertValuationAiLog,
} from "@shared/schema";

export const valuationStorage = {
  // ========== PROJECTS ==========
  async getProjects(tenantId: number) {
    return await db
      .select()
      .from(valuationProjects)
      .where(eq(valuationProjects.tenantId, tenantId))
      .orderBy(desc(valuationProjects.createdAt));
  },

  async getProject(id: number, tenantId: number) {
    const [project] = await db
      .select()
      .from(valuationProjects)
      .where(and(eq(valuationProjects.id, id), eq(valuationProjects.tenantId, tenantId)));
    return project;
  },

  async createProject(data: InsertValuationProject) {
    const [project] = await db.insert(valuationProjects).values(data).returning();
    return project;
  },

  async updateProject(id: number, tenantId: number, data: Partial<InsertValuationProject>) {
    const [project] = await db
      .update(valuationProjects)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(valuationProjects.id, id), eq(valuationProjects.tenantId, tenantId)))
      .returning();
    return project;
  },

  async deleteProject(id: number, tenantId: number) {
    const result = await db
      .delete(valuationProjects)
      .where(and(eq(valuationProjects.id, id), eq(valuationProjects.tenantId, tenantId)))
      .returning();
    return result.length > 0;
  },

  // ========== INPUTS ==========
  async getInputs(projectId: number) {
    return await db
      .select()
      .from(valuationInputs)
      .where(eq(valuationInputs.projectId, projectId))
      .orderBy(valuationInputs.year);
  },

  async getInput(id: number, projectId: number) {
    const [input] = await db
      .select()
      .from(valuationInputs)
      .where(and(eq(valuationInputs.id, id), eq(valuationInputs.projectId, projectId)));
    return input;
  },

  async createInput(data: InsertValuationInput) {
    const [input] = await db.insert(valuationInputs).values(data).returning();
    return input;
  },

  async updateInput(id: number, projectId: number, data: Partial<InsertValuationInput>) {
    const [input] = await db
      .update(valuationInputs)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(valuationInputs.id, id), eq(valuationInputs.projectId, projectId)))
      .returning();
    return input;
  },

  async deleteInput(id: number, projectId: number) {
    const result = await db
      .delete(valuationInputs)
      .where(and(eq(valuationInputs.id, id), eq(valuationInputs.projectId, projectId)))
      .returning();
    return result.length > 0;
  },

  // ========== ASSUMPTIONS ==========
  async getAssumptions(projectId: number) {
    return await db
      .select()
      .from(valuationAssumptions)
      .where(eq(valuationAssumptions.projectId, projectId));
  },

  async createAssumption(data: InsertValuationAssumption) {
    const [assumption] = await db.insert(valuationAssumptions).values(data).returning();
    return assumption;
  },

  async updateAssumption(id: number, projectId: number, data: Partial<InsertValuationAssumption>) {
    const [assumption] = await db
      .update(valuationAssumptions)
      .set(data)
      .where(and(eq(valuationAssumptions.id, id), eq(valuationAssumptions.projectId, projectId)))
      .returning();
    return assumption;
  },

  async deleteAssumption(id: number, projectId: number) {
    const result = await db
      .delete(valuationAssumptions)
      .where(and(eq(valuationAssumptions.id, id), eq(valuationAssumptions.projectId, projectId)))
      .returning();
    return result.length > 0;
  },

  // ========== CALCULATIONS ==========
  async getCalculations(projectId: number) {
    return await db
      .select()
      .from(valuationCalculations)
      .where(eq(valuationCalculations.projectId, projectId))
      .orderBy(desc(valuationCalculations.calculatedAt));
  },

  async getCalculation(id: number, projectId: number) {
    const [calc] = await db
      .select()
      .from(valuationCalculations)
      .where(and(eq(valuationCalculations.id, id), eq(valuationCalculations.projectId, projectId)));
    return calc;
  },

  async createCalculation(data: InsertValuationCalculation) {
    const [calc] = await db.insert(valuationCalculations).values(data).returning();
    return calc;
  },

  async updateCalculation(id: number, projectId: number, data: Partial<InsertValuationCalculation>) {
    const [calc] = await db
      .update(valuationCalculations)
      .set(data)
      .where(and(eq(valuationCalculations.id, id), eq(valuationCalculations.projectId, projectId)))
      .returning();
    return calc;
  },

  async deleteCalculation(id: number, projectId: number) {
    const result = await db
      .delete(valuationCalculations)
      .where(and(eq(valuationCalculations.id, id), eq(valuationCalculations.projectId, projectId)))
      .returning();
    return result.length > 0;
  },

  // ========== MATURITY SCORES ==========
  async getMaturityScores(projectId: number) {
    return await db
      .select()
      .from(valuationMaturityScores)
      .where(eq(valuationMaturityScores.projectId, projectId));
  },

  async createMaturityScore(data: InsertValuationMaturityScore) {
    const [score] = await db.insert(valuationMaturityScores).values(data).returning();
    return score;
  },

  async updateMaturityScore(id: number, projectId: number, data: Partial<InsertValuationMaturityScore>) {
    const [score] = await db
      .update(valuationMaturityScores)
      .set(data)
      .where(and(eq(valuationMaturityScores.id, id), eq(valuationMaturityScores.projectId, projectId)))
      .returning();
    return score;
  },

  async deleteMaturityScore(id: number, projectId: number) {
    const result = await db
      .delete(valuationMaturityScores)
      .where(and(eq(valuationMaturityScores.id, id), eq(valuationMaturityScores.projectId, projectId)))
      .returning();
    return result.length > 0;
  },

  // ========== CAP TABLE ==========
  async getCapTable(projectId: number) {
    return await db
      .select()
      .from(valuationCapTable)
      .where(eq(valuationCapTable.projectId, projectId));
  },

  async createCapTableEntry(data: InsertValuationCapTableEntry) {
    const [entry] = await db.insert(valuationCapTable).values(data).returning();
    return entry;
  },

  async updateCapTableEntry(id: number, projectId: number, data: Partial<InsertValuationCapTableEntry>) {
    const [entry] = await db
      .update(valuationCapTable)
      .set(data)
      .where(and(eq(valuationCapTable.id, id), eq(valuationCapTable.projectId, projectId)))
      .returning();
    return entry;
  },

  async deleteCapTableEntry(id: number, projectId: number) {
    const result = await db
      .delete(valuationCapTable)
      .where(and(eq(valuationCapTable.id, id), eq(valuationCapTable.projectId, projectId)))
      .returning();
    return result.length > 0;
  },

  // ========== TRANSACTIONS ==========
  async getTransactions(projectId: number) {
    return await db
      .select()
      .from(valuationTransactions)
      .where(eq(valuationTransactions.projectId, projectId))
      .orderBy(desc(valuationTransactions.createdAt));
  },

  async getTransaction(id: number, projectId: number) {
    const [transaction] = await db
      .select()
      .from(valuationTransactions)
      .where(and(eq(valuationTransactions.id, id), eq(valuationTransactions.projectId, projectId)));
    return transaction;
  },

  async createTransaction(data: InsertValuationTransaction) {
    const [transaction] = await db.insert(valuationTransactions).values(data).returning();
    return transaction;
  },

  async updateTransaction(id: number, projectId: number, data: Partial<InsertValuationTransaction>) {
    const [transaction] = await db
      .update(valuationTransactions)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(valuationTransactions.id, id), eq(valuationTransactions.projectId, projectId)))
      .returning();
    return transaction;
  },

  async deleteTransaction(id: number, projectId: number) {
    const result = await db
      .delete(valuationTransactions)
      .where(and(eq(valuationTransactions.id, id), eq(valuationTransactions.projectId, projectId)))
      .returning();
    return result.length > 0;
  },

  // ========== DOCUMENTS ==========
  async getDocuments(projectId: number) {
    return await db
      .select()
      .from(valuationDocuments)
      .where(eq(valuationDocuments.projectId, projectId))
      .orderBy(desc(valuationDocuments.createdAt));
  },

  async getDocument(id: number, projectId: number) {
    const [doc] = await db
      .select()
      .from(valuationDocuments)
      .where(and(eq(valuationDocuments.id, id), eq(valuationDocuments.projectId, projectId)));
    return doc;
  },

  async createDocument(data: InsertValuationDocument) {
    const [doc] = await db.insert(valuationDocuments).values(data).returning();
    return doc;
  },

  async updateDocument(id: number, projectId: number, data: Partial<InsertValuationDocument>) {
    const [doc] = await db
      .update(valuationDocuments)
      .set(data)
      .where(and(eq(valuationDocuments.id, id), eq(valuationDocuments.projectId, projectId)))
      .returning();
    return doc;
  },

  async deleteDocument(id: number, projectId: number) {
    const result = await db
      .delete(valuationDocuments)
      .where(and(eq(valuationDocuments.id, id), eq(valuationDocuments.projectId, projectId)))
      .returning();
    return result.length > 0;
  },

  async logDocumentAccess(data: InsertValuationDocumentLog) {
    const [log] = await db.insert(valuationDocumentLogs).values(data).returning();
    return log;
  },

  async getDocumentLogs(documentId: number) {
    return await db
      .select()
      .from(valuationDocumentLogs)
      .where(eq(valuationDocumentLogs.documentId, documentId))
      .orderBy(desc(valuationDocumentLogs.createdAt));
  },

  // ========== BUSINESS CANVAS ==========
  async getCanvas(projectId: number) {
    return await db
      .select()
      .from(valuationCanvas)
      .where(eq(valuationCanvas.projectId, projectId))
      .orderBy(valuationCanvas.orderIndex);
  },

  async createCanvasBlock(data: InsertValuationCanvasBlock) {
    const [block] = await db.insert(valuationCanvas).values(data).returning();
    return block;
  },

  async updateCanvasBlock(id: number, projectId: number, data: Partial<InsertValuationCanvasBlock>) {
    const [block] = await db
      .update(valuationCanvas)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(valuationCanvas.id, id), eq(valuationCanvas.projectId, projectId)))
      .returning();
    return block;
  },

  async deleteCanvasBlock(id: number, projectId: number) {
    const result = await db
      .delete(valuationCanvas)
      .where(and(eq(valuationCanvas.id, id), eq(valuationCanvas.projectId, projectId)))
      .returning();
    return result.length > 0;
  },

  // ========== AGENT INSIGHTS ==========
  async getAgentInsights(projectId: number) {
    return await db
      .select()
      .from(valuationAgentInsights)
      .where(eq(valuationAgentInsights.projectId, projectId))
      .orderBy(desc(valuationAgentInsights.createdAt));
  },

  async createAgentInsight(data: InsertValuationAgentInsight) {
    const [insight] = await db.insert(valuationAgentInsights).values(data).returning();
    return insight;
  },

  async updateAgentInsight(id: number, projectId: number, data: Partial<InsertValuationAgentInsight>) {
    const [insight] = await db
      .update(valuationAgentInsights)
      .set(data)
      .where(and(eq(valuationAgentInsights.id, id), eq(valuationAgentInsights.projectId, projectId)))
      .returning();
    return insight;
  },

  async deleteAgentInsight(id: number, projectId: number) {
    const result = await db
      .delete(valuationAgentInsights)
      .where(and(eq(valuationAgentInsights.id, id), eq(valuationAgentInsights.projectId, projectId)))
      .returning();
    return result.length > 0;
  },

  // ========== CRM CLIENTS ==========
  async getCrmClients(tenantId: number, search?: string) {
    const { isNull } = await import("drizzle-orm");
    const tenantFilter = or(eq(crmClients.tenantId, tenantId), isNull(crmClients.tenantId));
    
    if (search) {
      return await db
        .select()
        .from(crmClients)
        .where(and(
          tenantFilter,
          or(
            ilike(crmClients.name, `%${search}%`),
            ilike(crmClients.tradeName, `%${search}%`),
            ilike(crmClients.cnpj, `%${search}%`)
          )
        ))
        .orderBy(crmClients.name)
        .limit(50);
    }
    return await db
      .select()
      .from(crmClients)
      .where(tenantFilter)
      .orderBy(crmClients.name)
      .limit(50);
  },

  async getCrmClient(id: number, tenantId: number) {
    const { isNull } = await import("drizzle-orm");
    const [client] = await db
      .select()
      .from(crmClients)
      .where(and(eq(crmClients.id, id), or(eq(crmClients.tenantId, tenantId), isNull(crmClients.tenantId))));
    return client;
  },

  // ========== CHECKLIST ==========
  async getChecklistCategories(segment?: string) {
    const { isNull } = await import("drizzle-orm");
    const categories = await db
      .select()
      .from(valuationChecklistCategories)
      .orderBy(valuationChecklistCategories.orderIndex);
    
    if (segment) {
      return categories.filter(c => 
        !c.segmentFilter || c.segmentFilter.split(',').includes(segment)
      );
    }
    return categories.filter(c => !c.segmentFilter);
  },

  async getChecklistItems(categoryId?: number, segment?: string) {
    let query = db.select().from(valuationChecklistItems);
    
    if (categoryId) {
      query = query.where(eq(valuationChecklistItems.categoryId, categoryId)) as typeof query;
    }
    
    const items = await query.orderBy(valuationChecklistItems.orderIndex);
    
    if (segment) {
      return items.filter(i => 
        !i.segmentFilter || i.segmentFilter.split(',').includes(segment)
      );
    }
    return items;
  },

  async getChecklistProgress(projectId: number) {
    return await db
      .select()
      .from(valuationChecklistProgress)
      .where(eq(valuationChecklistProgress.projectId, projectId));
  },

  async getChecklistProgressItem(projectId: number, itemId: number) {
    const [progress] = await db
      .select()
      .from(valuationChecklistProgress)
      .where(and(
        eq(valuationChecklistProgress.projectId, projectId),
        eq(valuationChecklistProgress.itemId, itemId)
      ));
    return progress;
  },

  async upsertChecklistProgress(data: InsertValuationChecklistProgress) {
    const existing = await this.getChecklistProgressItem(data.projectId, data.itemId);
    
    if (existing) {
      const [updated] = await db
        .update(valuationChecklistProgress)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(valuationChecklistProgress.id, existing.id))
        .returning();
      return updated;
    }
    
    const [created] = await db
      .insert(valuationChecklistProgress)
      .values(data)
      .returning();
    return created;
  },

  async initializeProjectChecklist(projectId: number, segment: string) {
    const categories = await this.getChecklistCategories(segment);
    const allItems: any[] = [];
    
    for (const cat of categories) {
      const items = await this.getChecklistItems(cat.id, segment);
      allItems.push(...items);
    }
    
    const segmentCategories = await db
      .select()
      .from(valuationChecklistCategories)
      .where(eq(valuationChecklistCategories.segmentFilter, segment));
    
    for (const cat of segmentCategories) {
      const items = await this.getChecklistItems(cat.id, segment);
      allItems.push(...items);
    }
    
    for (const item of allItems) {
      const existing = await this.getChecklistProgressItem(projectId, item.id);
      if (!existing) {
        await db.insert(valuationChecklistProgress).values({
          projectId,
          itemId: item.id,
          status: "pending",
        });
      }
    }
    
    return this.getChecklistProgress(projectId);
  },

  // ========== CHECKLIST ATTACHMENTS ==========
  async getChecklistAttachments(progressId: number) {
    return await db
      .select()
      .from(valuationChecklistAttachments)
      .where(eq(valuationChecklistAttachments.progressId, progressId))
      .orderBy(desc(valuationChecklistAttachments.createdAt));
  },

  async createChecklistAttachment(data: InsertValuationChecklistAttachment) {
    const [attachment] = await db
      .insert(valuationChecklistAttachments)
      .values(data)
      .returning();
    return attachment;
  },

  async deleteChecklistAttachment(id: number) {
    const [deleted] = await db
      .delete(valuationChecklistAttachments)
      .where(eq(valuationChecklistAttachments.id, id))
      .returning();
    return deleted;
  },

  async getChecklistAttachment(id: number) {
    const [attachment] = await db
      .select()
      .from(valuationChecklistAttachments)
      .where(eq(valuationChecklistAttachments.id, id));
    return attachment;
  },

  // ========== SECTOR ANALYSIS ==========
  async getCategoryWeights(tenantId: number | null, segment: string) {
    if (tenantId) {
      const tenantWeights = await db
        .select()
        .from(valuationCategoryWeights)
        .where(and(eq(valuationCategoryWeights.tenantId, tenantId), eq(valuationCategoryWeights.segment, segment)));
      if (tenantWeights.length > 0) return tenantWeights;
    }
    return await db
      .select()
      .from(valuationCategoryWeights)
      .where(and(eq(valuationCategoryWeights.segment, segment)));
  },

  async upsertCategoryWeight(data: InsertValuationCategoryWeight) {
    const existing = await db
      .select()
      .from(valuationCategoryWeights)
      .where(and(
        eq(valuationCategoryWeights.segment, data.segment),
        eq(valuationCategoryWeights.categoryCode, data.categoryCode),
        data.tenantId ? eq(valuationCategoryWeights.tenantId, data.tenantId) : undefined
      ));
    
    if (existing.length > 0) {
      const [updated] = await db
        .update(valuationCategoryWeights)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(valuationCategoryWeights.id, existing[0].id))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(valuationCategoryWeights).values(data).returning();
    return created;
  },

  async getSectorBenchmarks(segment: string) {
    return await db
      .select()
      .from(valuationSectorBenchmarks)
      .where(eq(valuationSectorBenchmarks.segment, segment))
      .orderBy(valuationSectorBenchmarks.indicatorCode);
  },

  async createSectorBenchmark(data: InsertValuationSectorBenchmark) {
    const [benchmark] = await db.insert(valuationSectorBenchmarks).values(data).returning();
    return benchmark;
  },

  async getSectorScores(projectId: number) {
    return await db
      .select()
      .from(valuationSectorScores)
      .where(eq(valuationSectorScores.projectId, projectId))
      .orderBy(desc(valuationSectorScores.calculatedAt));
  },

  async getLatestSectorScore(projectId: number) {
    const [score] = await db
      .select()
      .from(valuationSectorScores)
      .where(eq(valuationSectorScores.projectId, projectId))
      .orderBy(desc(valuationSectorScores.calculatedAt))
      .limit(1);
    return score;
  },

  async createSectorScore(data: InsertValuationSectorScore) {
    const [score] = await db.insert(valuationSectorScores).values(data).returning();
    return score;
  },

  // ========== CANVAS BLOCKS ==========
  async getCanvasBlocks(projectId: number) {
    return await db
      .select()
      .from(valuationCanvasBlocks)
      .where(eq(valuationCanvasBlocks.projectId, projectId))
      .orderBy(valuationCanvasBlocks.orderIndex);
  },

  async getCanvasBlock(projectId: number, blockType: string) {
    const [block] = await db
      .select()
      .from(valuationCanvasBlocks)
      .where(and(eq(valuationCanvasBlocks.projectId, projectId), eq(valuationCanvasBlocks.blockType, blockType)));
    return block;
  },

  async upsertCanvasBlock(projectId: number, blockType: string, data: Partial<InsertValuationCanvasBlock>) {
    const existing = await this.getCanvasBlock(projectId, blockType);
    
    if (existing) {
      const [updated] = await db
        .update(valuationCanvasBlocks)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(valuationCanvasBlocks.id, existing.id))
        .returning();
      return updated;
    }
    
    const [created] = await db
      .insert(valuationCanvasBlocks)
      .values({ projectId, blockType, ...data })
      .returning();
    return created;
  },

  // ========== CANVAS SNAPSHOTS ==========
  async getCanvasSnapshots(projectId: number) {
    return await db
      .select()
      .from(valuationCanvasSnapshots)
      .where(eq(valuationCanvasSnapshots.projectId, projectId))
      .orderBy(desc(valuationCanvasSnapshots.createdAt));
  },

  async createCanvasSnapshot(data: InsertValuationCanvasSnapshot) {
    const [snapshot] = await db.insert(valuationCanvasSnapshots).values(data).returning();
    return snapshot;
  },

  async getCanvasSnapshot(id: number) {
    const [snapshot] = await db
      .select()
      .from(valuationCanvasSnapshots)
      .where(eq(valuationCanvasSnapshots.id, id));
    return snapshot;
  },

  // ========== GOVERNANCE ==========
  async getGovernanceCriteria(projectId: number) {
    return await db
      .select()
      .from(valuationGovernance)
      .where(eq(valuationGovernance.projectId, projectId))
      .orderBy(valuationGovernance.criterionCode);
  },

  async getGovernanceCriterion(id: number, projectId: number) {
    const [c] = await db
      .select()
      .from(valuationGovernance)
      .where(and(eq(valuationGovernance.id, id), eq(valuationGovernance.projectId, projectId)));
    return c;
  },

  async createGovernanceCriterion(data: InsertValuationGovernance) {
    const [c] = await db.insert(valuationGovernance).values(data).returning();
    return c;
  },

  async updateGovernanceCriterion(id: number, projectId: number, data: Partial<InsertValuationGovernance>) {
    const [c] = await db
      .update(valuationGovernance)
      .set(data)
      .where(and(eq(valuationGovernance.id, id), eq(valuationGovernance.projectId, projectId)))
      .returning();
    return c;
  },

  async deleteGovernanceCriterion(id: number, projectId: number) {
    const r = await db
      .delete(valuationGovernance)
      .where(and(eq(valuationGovernance.id, id), eq(valuationGovernance.projectId, projectId)))
      .returning();
    return r.length > 0;
  },

  async initializeGovernance(projectId: number, criteria: InsertValuationGovernance[]) {
    const existing = await this.getGovernanceCriteria(projectId);
    if (existing.length > 0) return existing;
    const results = [];
    for (const c of criteria) {
      const [created] = await db.insert(valuationGovernance).values({ ...c, projectId }).returning();
      results.push(created);
    }
    return results;
  },

  // ========== PDCA ==========
  async getPdcaItems(projectId: number) {
    return await db
      .select()
      .from(valuationPdca)
      .where(eq(valuationPdca.projectId, projectId))
      .orderBy(desc(valuationPdca.createdAt));
  },

  async getPdcaItem(id: number, projectId: number) {
    const [item] = await db
      .select()
      .from(valuationPdca)
      .where(and(eq(valuationPdca.id, id), eq(valuationPdca.projectId, projectId)));
    return item;
  },

  async createPdcaItem(data: InsertValuationPdca) {
    const [item] = await db.insert(valuationPdca).values(data).returning();
    return item;
  },

  async updatePdcaItem(id: number, projectId: number, data: Partial<InsertValuationPdca>) {
    const [item] = await db
      .update(valuationPdca)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(valuationPdca.id, id), eq(valuationPdca.projectId, projectId)))
      .returning();
    return item;
  },

  async deletePdcaItem(id: number, projectId: number) {
    const r = await db
      .delete(valuationPdca)
      .where(and(eq(valuationPdca.id, id), eq(valuationPdca.projectId, projectId)))
      .returning();
    return r.length > 0;
  },

  // ========== SWOT ==========
  async getSwotItems(projectId: number) {
    return await db
      .select()
      .from(valuationSwot)
      .where(eq(valuationSwot.projectId, projectId))
      .orderBy(valuationSwot.orderIndex);
  },

  async getSwotItem(id: number, projectId: number) {
    const [item] = await db
      .select()
      .from(valuationSwot)
      .where(and(eq(valuationSwot.id, id), eq(valuationSwot.projectId, projectId)));
    return item;
  },

  async createSwotItem(data: InsertValuationSwot) {
    const [item] = await db.insert(valuationSwot).values(data).returning();
    return item;
  },

  async updateSwotItem(id: number, projectId: number, data: Partial<InsertValuationSwot>) {
    const [item] = await db
      .update(valuationSwot)
      .set(data)
      .where(and(eq(valuationSwot.id, id), eq(valuationSwot.projectId, projectId)))
      .returning();
    return item;
  },

  async deleteSwotItem(id: number, projectId: number) {
    const r = await db
      .delete(valuationSwot)
      .where(and(eq(valuationSwot.id, id), eq(valuationSwot.projectId, projectId)))
      .returning();
    return r.length > 0;
  },

  // ========== RESULTS ==========
  async getResults(projectId: number) {
    return await db
      .select()
      .from(valuationResults)
      .where(eq(valuationResults.projectId, projectId))
      .orderBy(desc(valuationResults.calculatedAt));
  },

  async createResult(data: InsertValuationResult) {
    const [r] = await db.insert(valuationResults).values(data).returning();
    return r;
  },

  async deleteResults(projectId: number) {
    await db.delete(valuationResults).where(eq(valuationResults.projectId, projectId));
  },

  // ========== ASSETS ==========
  async getAssets(projectId: number) {
    return await db
      .select()
      .from(valuationAssets)
      .where(eq(valuationAssets.projectId, projectId))
      .orderBy(valuationAssets.name);
  },

  async getAsset(id: number, projectId: number) {
    const [a] = await db
      .select()
      .from(valuationAssets)
      .where(and(eq(valuationAssets.id, id), eq(valuationAssets.projectId, projectId)));
    return a;
  },

  async createAsset(data: InsertValuationAsset) {
    const [a] = await db.insert(valuationAssets).values(data).returning();
    return a;
  },

  async updateAsset(id: number, projectId: number, data: Partial<InsertValuationAsset>) {
    const [a] = await db
      .update(valuationAssets)
      .set(data)
      .where(and(eq(valuationAssets.id, id), eq(valuationAssets.projectId, projectId)))
      .returning();
    return a;
  },

  async deleteAsset(id: number, projectId: number) {
    const r = await db
      .delete(valuationAssets)
      .where(and(eq(valuationAssets.id, id), eq(valuationAssets.projectId, projectId)))
      .returning();
    return r.length > 0;
  },

  // ========== REPORTS ==========
  async getReports(projectId: number) {
    return await db
      .select()
      .from(valuationReports)
      .where(eq(valuationReports.projectId, projectId))
      .orderBy(desc(valuationReports.generatedAt));
  },

  async createReport(data: InsertValuationReport) {
    const [r] = await db.insert(valuationReports).values(data).returning();
    return r;
  },

  async deleteReport(id: number, projectId: number) {
    const r = await db
      .delete(valuationReports)
      .where(and(eq(valuationReports.id, id), eq(valuationReports.projectId, projectId)))
      .returning();
    return r.length > 0;
  },

  // ========== AI LOG ==========
  async getAiLogs(projectId: number, limit: number = 20) {
    return await db
      .select()
      .from(valuationAiLog)
      .where(eq(valuationAiLog.projectId, projectId))
      .orderBy(desc(valuationAiLog.createdAt))
      .limit(limit);
  },

  async createAiLog(data: InsertValuationAiLog) {
    const [log] = await db.insert(valuationAiLog).values(data).returning();
    return log;
  },
};
