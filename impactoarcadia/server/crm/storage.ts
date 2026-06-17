import { db } from "../../db/index";
import { eq, and, or, desc, sql } from "drizzle-orm";
import {
  crmPartners,
  crmPartnerCertifications,
  crmPartnerPerformance,
  crmContracts,
  crmRevenueSchedule,
  crmCommissionRules,
  crmCommissions,
  crmChannels,
  crmThreads,
  crmMessages,
  crmQuickMessages,
  crmCampaigns,
  crmCampaignContacts,
  crmEvents,
  crmGoogleTokens,
  crmOpportunityRegistrations,
  crmProducts,
  crmClients,
  crmPipelineStages,
  crmLeads,
  crmOpportunities,
  crmOpportunityProducts,
  crmProposals,
  crmProposalItems,
  crmContractMilestones,
  crmFrappeConnectors,
  crmFrappeMappings,
  crmSyncLogs,
  pcProjects,
  type PcProject,
  type InsertPcProject,
  type CrmPartner,
  type InsertCrmPartner,
  type CrmPartnerCertification,
  type InsertCrmPartnerCertification,
  type CrmPartnerPerformance,
  type InsertCrmPartnerPerformance,
  type CrmContract,
  type InsertCrmContract,
  type CrmRevenueSchedule,
  type InsertCrmRevenueSchedule,
  type CrmCommissionRule,
  type InsertCrmCommissionRule,
  type CrmCommission,
  type InsertCrmCommission,
  type CrmChannel,
  type InsertCrmChannel,
  type CrmThread,
  type InsertCrmThread,
  type CrmMessage,
  type InsertCrmMessage,
  type CrmEvent,
  type InsertCrmEvent,
  type CrmProduct,
  type InsertCrmProduct,
  type CrmClient,
  type InsertCrmClient,
  type CrmPipelineStage,
  type InsertCrmPipelineStage,
  type CrmLead,
  type InsertCrmLead,
  type CrmOpportunity,
  type InsertCrmOpportunity,
  type CrmOpportunityProduct,
  type InsertCrmOpportunityProduct,
  type CrmProposal,
  type InsertCrmProposal,
  type CrmProposalItem,
  type InsertCrmProposalItem,
  type CrmContractMilestone,
  type InsertCrmContractMilestone,
  type CrmFrappeConnector,
  type InsertCrmFrappeConnector,
  type CrmFrappeMapping,
  type InsertCrmFrappeMapping,
  type CrmSyncLog,
  type InsertCrmSyncLog,
} from "@shared/schema";

export class CrmStorage {
  async getPartners(tenantId?: number): Promise<CrmPartner[]> {
    if (tenantId) {
      return db.select().from(crmPartners).where(eq(crmPartners.tenantId, tenantId)).orderBy(desc(crmPartners.createdAt));
    }
    return db.select().from(crmPartners).orderBy(desc(crmPartners.createdAt));
  }

  async getPartner(id: number): Promise<CrmPartner | undefined> {
    const [partner] = await db.select().from(crmPartners).where(eq(crmPartners.id, id));
    return partner;
  }

  async createPartner(data: InsertCrmPartner): Promise<CrmPartner> {
    const [partner] = await db.insert(crmPartners).values(data).returning();
    return partner;
  }

  async updatePartner(id: number, data: Partial<InsertCrmPartner>): Promise<CrmPartner | undefined> {
    const [partner] = await db.update(crmPartners).set({ ...data, updatedAt: new Date() }).where(eq(crmPartners.id, id)).returning();
    return partner;
  }

  async deletePartner(id: number): Promise<boolean> {
    const result = await db.delete(crmPartners).where(eq(crmPartners.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getPartnerCertifications(partnerId: number): Promise<CrmPartnerCertification[]> {
    return db.select().from(crmPartnerCertifications).where(eq(crmPartnerCertifications.partnerId, partnerId));
  }

  async createCertification(data: InsertCrmPartnerCertification): Promise<CrmPartnerCertification> {
    const [cert] = await db.insert(crmPartnerCertifications).values(data).returning();
    return cert;
  }

  async getPartnerPerformance(partnerId: number): Promise<CrmPartnerPerformance[]> {
    return db.select().from(crmPartnerPerformance).where(eq(crmPartnerPerformance.partnerId, partnerId)).orderBy(desc(crmPartnerPerformance.createdAt));
  }

  async createPerformance(data: InsertCrmPartnerPerformance): Promise<CrmPartnerPerformance> {
    const [perf] = await db.insert(crmPartnerPerformance).values(data).returning();
    return perf;
  }

  async getContracts(tenantId?: number, partnerId?: number, clientId?: number): Promise<CrmContract[]> {
    let query = db.select().from(crmContracts);
    const conditions = [];
    if (tenantId) conditions.push(eq(crmContracts.tenantId, tenantId));
    if (partnerId) conditions.push(eq(crmContracts.partnerId, partnerId));
    if (clientId) conditions.push(eq(crmContracts.clientId, clientId));
    
    if (conditions.length > 0) {
      return db.select().from(crmContracts).where(and(...conditions)).orderBy(desc(crmContracts.createdAt));
    }
    return db.select().from(crmContracts).orderBy(desc(crmContracts.createdAt));
  }

  async getContract(id: number): Promise<CrmContract | undefined> {
    const [contract] = await db.select().from(crmContracts).where(eq(crmContracts.id, id));
    return contract;
  }

  async createContract(data: InsertCrmContract): Promise<CrmContract> {
    const [contract] = await db.insert(crmContracts).values(data).returning();
    return contract;
  }

  async updateContract(id: number, data: Partial<InsertCrmContract>): Promise<CrmContract | undefined> {
    const [contract] = await db.update(crmContracts).set({ ...data, updatedAt: new Date() }).where(eq(crmContracts.id, id)).returning();
    return contract;
  }

  async getRevenueSchedule(contractId: number): Promise<CrmRevenueSchedule[]> {
    return db.select().from(crmRevenueSchedule).where(eq(crmRevenueSchedule.contractId, contractId)).orderBy(crmRevenueSchedule.month);
  }

  async createRevenueSchedule(data: InsertCrmRevenueSchedule): Promise<CrmRevenueSchedule> {
    const [schedule] = await db.insert(crmRevenueSchedule).values(data).returning();
    return schedule;
  }

  async getCommissionRules(): Promise<CrmCommissionRule[]> {
    return db.select().from(crmCommissionRules).where(eq(crmCommissionRules.isActive, "true"));
  }

  async createCommissionRule(data: InsertCrmCommissionRule): Promise<CrmCommissionRule> {
    const [rule] = await db.insert(crmCommissionRules).values(data).returning();
    return rule;
  }

  async getCommissions(partnerId?: number, userId?: string): Promise<CrmCommission[]> {
    const conditions = [];
    if (partnerId) conditions.push(eq(crmCommissions.partnerId, partnerId));
    if (userId) conditions.push(eq(crmCommissions.userId, userId));
    
    if (conditions.length > 0) {
      return db.select().from(crmCommissions).where(and(...conditions)).orderBy(desc(crmCommissions.createdAt));
    }
    return db.select().from(crmCommissions).orderBy(desc(crmCommissions.createdAt));
  }

  async createCommission(data: InsertCrmCommission): Promise<CrmCommission> {
    const [commission] = await db.insert(crmCommissions).values(data).returning();
    return commission;
  }

  async getChannels(tenantId?: number): Promise<CrmChannel[]> {
    if (tenantId) {
      return db.select().from(crmChannels).where(eq(crmChannels.tenantId, tenantId));
    }
    return db.select().from(crmChannels);
  }

  async getChannel(id: number): Promise<CrmChannel | undefined> {
    const [channel] = await db.select().from(crmChannels).where(eq(crmChannels.id, id));
    return channel;
  }

  async createChannel(data: InsertCrmChannel): Promise<CrmChannel> {
    const [channel] = await db.insert(crmChannels).values(data).returning();
    return channel;
  }

  async updateChannel(id: number, data: Partial<InsertCrmChannel>): Promise<CrmChannel | undefined> {
    const [channel] = await db.update(crmChannels).set({ ...data, updatedAt: new Date() }).where(eq(crmChannels.id, id)).returning();
    return channel;
  }

  async getThreads(tenantId?: number, channelId?: number, status?: string): Promise<CrmThread[]> {
    const conditions = [];
    if (tenantId) conditions.push(eq(crmThreads.tenantId, tenantId));
    if (channelId) conditions.push(eq(crmThreads.channelId, channelId));
    if (status) conditions.push(eq(crmThreads.status, status));
    
    if (conditions.length > 0) {
      return db.select().from(crmThreads).where(and(...conditions)).orderBy(desc(crmThreads.lastMessageAt));
    }
    return db.select().from(crmThreads).orderBy(desc(crmThreads.lastMessageAt));
  }

  async getThread(id: number): Promise<CrmThread | undefined> {
    const [thread] = await db.select().from(crmThreads).where(eq(crmThreads.id, id));
    return thread;
  }

  async createThread(data: InsertCrmThread): Promise<CrmThread> {
    const [thread] = await db.insert(crmThreads).values(data).returning();
    return thread;
  }

  async updateThread(id: number, data: Partial<InsertCrmThread>): Promise<CrmThread | undefined> {
    const [thread] = await db.update(crmThreads).set({ ...data, updatedAt: new Date() }).where(eq(crmThreads.id, id)).returning();
    return thread;
  }

  async getMessages(threadId: number, limit: number = 50): Promise<CrmMessage[]> {
    return db.select().from(crmMessages).where(eq(crmMessages.threadId, threadId)).orderBy(desc(crmMessages.createdAt)).limit(limit);
  }

  async createMessage(data: InsertCrmMessage): Promise<CrmMessage> {
    const [message] = await db.insert(crmMessages).values(data).returning();
    await db.update(crmThreads).set({ lastMessageAt: new Date(), updatedAt: new Date() }).where(eq(crmThreads.id, data.threadId));
    return message;
  }

  async getEvents(userId: string, startDate?: Date, endDate?: Date): Promise<CrmEvent[]> {
    const conditions = [eq(crmEvents.userId, userId)];
    if (startDate) conditions.push(sql`${crmEvents.startAt} >= ${startDate}`);
    if (endDate) conditions.push(sql`${crmEvents.startAt} <= ${endDate}`);
    
    return db.select().from(crmEvents).where(and(...conditions)).orderBy(crmEvents.startAt);
  }

  async getEvent(id: number): Promise<CrmEvent | undefined> {
    const [event] = await db.select().from(crmEvents).where(eq(crmEvents.id, id));
    return event;
  }

  async createEvent(data: InsertCrmEvent): Promise<CrmEvent> {
    const [event] = await db.insert(crmEvents).values(data).returning();
    return event;
  }

  async updateEvent(id: number, data: Partial<InsertCrmEvent>): Promise<CrmEvent | undefined> {
    const [event] = await db.update(crmEvents).set({ ...data, updatedAt: new Date() }).where(eq(crmEvents.id, id)).returning();
    return event;
  }

  async deleteEvent(id: number): Promise<boolean> {
    const result = await db.delete(crmEvents).where(eq(crmEvents.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getStats(tenantId?: number) {
    const partnerCount = await db.select({ count: sql<number>`count(*)` }).from(crmPartners);
    const contractCount = await db.select({ count: sql<number>`count(*)` }).from(crmContracts);
    const threadCount = await db.select({ count: sql<number>`count(*)` }).from(crmThreads).where(eq(crmThreads.status, "open"));
    
    return {
      totalPartners: Number(partnerCount[0]?.count || 0),
      totalContracts: Number(contractCount[0]?.count || 0),
      openThreads: Number(threadCount[0]?.count || 0),
    };
  }

  // ========== PRODUCTS ==========
  async getProducts(tenantId?: number): Promise<CrmProduct[]> {
    if (tenantId) {
      return db.select().from(crmProducts).where(eq(crmProducts.tenantId, tenantId)).orderBy(desc(crmProducts.createdAt));
    }
    return db.select().from(crmProducts).orderBy(desc(crmProducts.createdAt));
  }

  async getProduct(id: number): Promise<CrmProduct | undefined> {
    const [product] = await db.select().from(crmProducts).where(eq(crmProducts.id, id));
    return product;
  }

  async createProduct(data: InsertCrmProduct): Promise<CrmProduct> {
    const [product] = await db.insert(crmProducts).values(data).returning();
    return product;
  }

  async updateProduct(id: number, data: Partial<InsertCrmProduct>): Promise<CrmProduct | undefined> {
    const [product] = await db.update(crmProducts).set({ ...data, updatedAt: new Date() }).where(eq(crmProducts.id, id)).returning();
    return product;
  }

  async deleteProduct(id: number): Promise<boolean> {
    const result = await db.delete(crmProducts).where(eq(crmProducts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ========== CLIENTS ==========
  async getClients(tenantId?: number, partnerId?: number, createdByUserId?: string): Promise<CrmClient[]> {
    const conditions = [];
    if (tenantId) {
      conditions.push(eq(crmClients.tenantId, tenantId));
    }
    if (partnerId || createdByUserId) {
      const partnerConditions = [];
      if (partnerId) {
        partnerConditions.push(eq(crmClients.partnerId, partnerId));
      }
      if (createdByUserId) {
        partnerConditions.push(eq(crmClients.createdBy, createdByUserId));
      }
      if (partnerConditions.length > 1) {
        conditions.push(or(...partnerConditions));
      } else if (partnerConditions.length === 1) {
        conditions.push(partnerConditions[0]);
      }
    }
    if (conditions.length > 0) {
      return db.select().from(crmClients).where(and(...conditions)).orderBy(desc(crmClients.createdAt));
    }
    return db.select().from(crmClients).orderBy(desc(crmClients.createdAt));
  }

  async getClient(id: number): Promise<CrmClient | undefined> {
    const [client] = await db.select().from(crmClients).where(eq(crmClients.id, id));
    return client;
  }

  async createClient(data: InsertCrmClient): Promise<CrmClient> {
    const [client] = await db.insert(crmClients).values(data).returning();
    return client;
  }

  async updateClient(id: number, data: Partial<InsertCrmClient>): Promise<CrmClient | undefined> {
    const [client] = await db.update(crmClients).set({ ...data, updatedAt: new Date() }).where(eq(crmClients.id, id)).returning();
    return client;
  }

  async deleteClient(id: number): Promise<boolean> {
    const result = await db.delete(crmClients).where(eq(crmClients.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async convertPartnerToClient(partnerId: number, additionalData?: Partial<InsertCrmClient>): Promise<CrmClient | undefined> {
    const partner = await this.getPartner(partnerId);
    if (!partner) return undefined;
    
    const clientData: InsertCrmClient = {
      tenantId: partner.tenantId,
      name: partner.name,
      tradeName: partner.tradeName,
      cnpj: partner.cnpj,
      email: partner.email,
      phone: partner.phone,
      website: partner.website,
      primaryContactName: partner.primaryContactName,
      primaryContactEmail: partner.primaryContactEmail,
      source: "partner",
      convertedFromPartnerId: partnerId,
      status: "active",
      ...additionalData,
    };
    
    return this.createClient(clientData);
  }

  // ========== PIPELINE STAGES ==========
  async getPipelineStages(tenantId?: number): Promise<CrmPipelineStage[]> {
    if (tenantId) {
      return db.select().from(crmPipelineStages).where(eq(crmPipelineStages.tenantId, tenantId)).orderBy(crmPipelineStages.orderIndex);
    }
    return db.select().from(crmPipelineStages).orderBy(crmPipelineStages.orderIndex);
  }

  async getPipelineStage(id: number): Promise<CrmPipelineStage | undefined> {
    const [stage] = await db.select().from(crmPipelineStages).where(eq(crmPipelineStages.id, id));
    return stage;
  }

  async createPipelineStage(data: InsertCrmPipelineStage): Promise<CrmPipelineStage> {
    const [stage] = await db.insert(crmPipelineStages).values(data).returning();
    return stage;
  }

  async updatePipelineStage(id: number, data: Partial<InsertCrmPipelineStage>): Promise<CrmPipelineStage | undefined> {
    const [stage] = await db.update(crmPipelineStages).set(data).where(eq(crmPipelineStages.id, id)).returning();
    return stage;
  }

  async deletePipelineStage(id: number): Promise<boolean> {
    const result = await db.delete(crmPipelineStages).where(eq(crmPipelineStages.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ========== LEADS ==========
  async getLeads(tenantId?: number, status?: string): Promise<CrmLead[]> {
    const conditions = [];
    if (tenantId) conditions.push(eq(crmLeads.tenantId, tenantId));
    if (status) conditions.push(eq(crmLeads.status, status));
    
    if (conditions.length > 0) {
      return db.select().from(crmLeads).where(and(...conditions)).orderBy(desc(crmLeads.createdAt));
    }
    return db.select().from(crmLeads).orderBy(desc(crmLeads.createdAt));
  }

  async getLead(id: number): Promise<CrmLead | undefined> {
    const [lead] = await db.select().from(crmLeads).where(eq(crmLeads.id, id));
    return lead;
  }

  async createLead(data: InsertCrmLead): Promise<CrmLead> {
    const [lead] = await db.insert(crmLeads).values(data).returning();
    return lead;
  }

  async updateLead(id: number, data: Partial<InsertCrmLead>): Promise<CrmLead | undefined> {
    const [lead] = await db.update(crmLeads).set({ ...data, updatedAt: new Date() }).where(eq(crmLeads.id, id)).returning();
    return lead;
  }

  async deleteLead(id: number): Promise<boolean> {
    const result = await db.delete(crmLeads).where(eq(crmLeads.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async convertLeadToOpportunity(leadId: number, opportunityData: InsertCrmOpportunity): Promise<CrmOpportunity> {
    const [opportunity] = await db.insert(crmOpportunities).values({ ...opportunityData, leadId }).returning();
    await db.update(crmLeads).set({ status: "converted", convertedAt: new Date(), updatedAt: new Date() }).where(eq(crmLeads.id, leadId));
    return opportunity;
  }

  // ========== OPPORTUNITIES ==========
  async getOpportunities(tenantId?: number, stageId?: number, status?: string): Promise<CrmOpportunity[]> {
    const conditions = [];
    if (tenantId) conditions.push(eq(crmOpportunities.tenantId, tenantId));
    if (stageId) conditions.push(eq(crmOpportunities.stageId, stageId));
    if (status) conditions.push(eq(crmOpportunities.status, status));
    
    if (conditions.length > 0) {
      return db.select().from(crmOpportunities).where(and(...conditions)).orderBy(desc(crmOpportunities.createdAt));
    }
    return db.select().from(crmOpportunities).orderBy(desc(crmOpportunities.createdAt));
  }

  async getOpportunity(id: number): Promise<CrmOpportunity | undefined> {
    const [opp] = await db.select().from(crmOpportunities).where(eq(crmOpportunities.id, id));
    return opp;
  }

  async createOpportunity(data: InsertCrmOpportunity): Promise<CrmOpportunity> {
    const [opp] = await db.insert(crmOpportunities).values(data).returning();
    return opp;
  }

  async updateOpportunity(id: number, data: Partial<InsertCrmOpportunity>): Promise<CrmOpportunity | undefined> {
    const updateData: any = { ...data, updatedAt: new Date() };
    if (data.status === "won" || data.status === "lost") {
      updateData.actualCloseDate = new Date();
    }
    const [opp] = await db.update(crmOpportunities).set(updateData).where(eq(crmOpportunities.id, id)).returning();
    return opp;
  }

  async deleteOpportunity(id: number): Promise<boolean> {
    const result = await db.delete(crmOpportunities).where(eq(crmOpportunities.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async moveOpportunityToStage(id: number, stageId: number): Promise<CrmOpportunity | undefined> {
    const stage = await this.getPipelineStage(stageId);
    const probability = stage?.probability ?? 50;
    const [opp] = await db.update(crmOpportunities).set({ stageId, probability, updatedAt: new Date() }).where(eq(crmOpportunities.id, id)).returning();
    return opp;
  }

  // ========== OPPORTUNITY PRODUCTS ==========
  async getOpportunityProducts(opportunityId: number): Promise<CrmOpportunityProduct[]> {
    return db.select().from(crmOpportunityProducts).where(eq(crmOpportunityProducts.opportunityId, opportunityId));
  }

  async addProductToOpportunity(data: InsertCrmOpportunityProduct): Promise<CrmOpportunityProduct> {
    const total = (data.quantity || 1) * (data.unitPrice || 0) * (1 - (data.discount || 0) / 100);
    const [oppProduct] = await db.insert(crmOpportunityProducts).values({ ...data, total: Math.round(total) }).returning();
    await this.recalculateOpportunityValue(data.opportunityId);
    return oppProduct;
  }

  async removeProductFromOpportunity(id: number): Promise<boolean> {
    const [oppProduct] = await db.select().from(crmOpportunityProducts).where(eq(crmOpportunityProducts.id, id));
    if (!oppProduct) return false;
    await db.delete(crmOpportunityProducts).where(eq(crmOpportunityProducts.id, id));
    await this.recalculateOpportunityValue(oppProduct.opportunityId);
    return true;
  }

  async recalculateOpportunityValue(opportunityId: number): Promise<void> {
    const products = await this.getOpportunityProducts(opportunityId);
    const totalValue = products.reduce((sum, p) => sum + (p.total || 0), 0);
    await db.update(crmOpportunities).set({ value: totalValue, updatedAt: new Date() }).where(eq(crmOpportunities.id, opportunityId));
  }

  // ========== CRM STATS ==========
  async getCrmStats(tenantId?: number) {
    const leadConditions = tenantId ? [eq(crmLeads.tenantId, tenantId)] : [];
    const oppConditions = tenantId ? [eq(crmOpportunities.tenantId, tenantId)] : [];

    const [leadStats] = await db.select({
      total: sql<number>`count(*)`,
      newLeads: sql<number>`count(*) filter (where status = 'new')`,
      qualified: sql<number>`count(*) filter (where status = 'qualified')`,
      converted: sql<number>`count(*) filter (where status = 'converted')`,
    }).from(crmLeads).where(leadConditions.length > 0 ? and(...leadConditions) : undefined);

    const [oppStats] = await db.select({
      total: sql<number>`count(*)`,
      open: sql<number>`count(*) filter (where status = 'open')`,
      won: sql<number>`count(*) filter (where status = 'won')`,
      lost: sql<number>`count(*) filter (where status = 'lost')`,
      totalValue: sql<number>`coalesce(sum(value), 0)`,
      wonValue: sql<number>`coalesce(sum(value) filter (where status = 'won'), 0)`,
    }).from(crmOpportunities).where(oppConditions.length > 0 ? and(...oppConditions) : undefined);

    return {
      leads: {
        total: Number(leadStats?.total || 0),
        new: Number(leadStats?.newLeads || 0),
        qualified: Number(leadStats?.qualified || 0),
        converted: Number(leadStats?.converted || 0),
      },
      opportunities: {
        total: Number(oppStats?.total || 0),
        open: Number(oppStats?.open || 0),
        won: Number(oppStats?.won || 0),
        lost: Number(oppStats?.lost || 0),
        totalValue: Number(oppStats?.totalValue || 0),
        wonValue: Number(oppStats?.wonValue || 0),
        winRate: oppStats?.won && oppStats?.total ? Math.round((Number(oppStats.won) / (Number(oppStats.won) + Number(oppStats.lost))) * 100) : 0,
      },
    };
  }

  // ========== Frappe Connector Methods ==========
  async getFrappeConnectors(tenantId?: number): Promise<CrmFrappeConnector[]> {
    if (tenantId) {
      return db.select().from(crmFrappeConnectors).where(eq(crmFrappeConnectors.tenantId, tenantId)).orderBy(desc(crmFrappeConnectors.createdAt));
    }
    return db.select().from(crmFrappeConnectors).orderBy(desc(crmFrappeConnectors.createdAt));
  }

  async getFrappeConnector(id: number): Promise<CrmFrappeConnector | undefined> {
    const [connector] = await db.select().from(crmFrappeConnectors).where(eq(crmFrappeConnectors.id, id));
    return connector;
  }

  async createFrappeConnector(data: InsertCrmFrappeConnector): Promise<CrmFrappeConnector> {
    const [connector] = await db.insert(crmFrappeConnectors).values(data).returning();
    return connector;
  }

  async updateFrappeConnector(id: number, data: Partial<InsertCrmFrappeConnector>): Promise<CrmFrappeConnector | undefined> {
    const [connector] = await db.update(crmFrappeConnectors).set({ ...data, updatedAt: new Date() }).where(eq(crmFrappeConnectors.id, id)).returning();
    return connector;
  }

  async deleteFrappeConnector(id: number): Promise<boolean> {
    const result = await db.delete(crmFrappeConnectors).where(eq(crmFrappeConnectors.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getFrappeMappings(connectorId: number): Promise<CrmFrappeMapping[]> {
    return db.select().from(crmFrappeMappings).where(eq(crmFrappeMappings.connectorId, connectorId));
  }

  async createFrappeMapping(data: InsertCrmFrappeMapping): Promise<CrmFrappeMapping> {
    const [mapping] = await db.insert(crmFrappeMappings).values(data).returning();
    return mapping;
  }

  async updateFrappeMapping(id: number, data: Partial<InsertCrmFrappeMapping>): Promise<CrmFrappeMapping | undefined> {
    const [mapping] = await db.update(crmFrappeMappings).set(data).where(eq(crmFrappeMappings.id, id)).returning();
    return mapping;
  }

  async deleteFrappeMapping(id: number): Promise<boolean> {
    const result = await db.delete(crmFrappeMappings).where(eq(crmFrappeMappings.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getSyncLogs(connectorId: number, limit: number = 50): Promise<CrmSyncLog[]> {
    return db.select().from(crmSyncLogs).where(eq(crmSyncLogs.connectorId, connectorId)).orderBy(desc(crmSyncLogs.startedAt)).limit(limit);
  }

  async createSyncLog(data: InsertCrmSyncLog): Promise<CrmSyncLog> {
    const [log] = await db.insert(crmSyncLogs).values(data).returning();
    return log;
  }

  async updateSyncLog(id: number, data: Partial<CrmSyncLog>): Promise<CrmSyncLog | undefined> {
    const [log] = await db.update(crmSyncLogs).set(data).where(eq(crmSyncLogs.id, id)).returning();
    return log;
  }

  // ========== PROCESS COMPASS INTEGRATION ==========
  async createProcessCompassProject(data: InsertPcProject): Promise<PcProject> {
    const [project] = await db.insert(pcProjects).values(data).returning();
    return project;
  }

  // ========== PROPOSALS (PROPOSTAS COMERCIAIS) ==========
  async getProposals(tenantId: number): Promise<CrmProposal[]> {
    return db.select().from(crmProposals).where(eq(crmProposals.tenantId, tenantId)).orderBy(desc(crmProposals.createdAt));
  }

  async getProposal(id: number, tenantId: number): Promise<CrmProposal | undefined> {
    const [proposal] = await db.select().from(crmProposals).where(and(eq(crmProposals.id, id), eq(crmProposals.tenantId, tenantId)));
    return proposal;
  }

  async getProposalsByOpportunity(opportunityId: number): Promise<CrmProposal[]> {
    return db.select().from(crmProposals).where(eq(crmProposals.opportunityId, opportunityId)).orderBy(desc(crmProposals.createdAt));
  }

  async createProposal(data: InsertCrmProposal): Promise<CrmProposal> {
    const [proposal] = await db.insert(crmProposals).values(data).returning();
    return proposal;
  }

  async updateProposal(id: number, tenantId: number, data: Partial<InsertCrmProposal>): Promise<CrmProposal | undefined> {
    const [proposal] = await db.update(crmProposals)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(crmProposals.id, id), eq(crmProposals.tenantId, tenantId)))
      .returning();
    return proposal;
  }

  async deleteProposal(id: number, tenantId: number): Promise<boolean> {
    const [deleted] = await db.delete(crmProposals).where(and(eq(crmProposals.id, id), eq(crmProposals.tenantId, tenantId))).returning();
    return !!deleted;
  }

  // ========== PROPOSAL ITEMS ==========
  async getProposalItems(proposalId: number): Promise<CrmProposalItem[]> {
    return db.select().from(crmProposalItems).where(eq(crmProposalItems.proposalId, proposalId)).orderBy(crmProposalItems.orderIndex);
  }

  async createProposalItem(data: InsertCrmProposalItem): Promise<CrmProposalItem> {
    const [item] = await db.insert(crmProposalItems).values(data).returning();
    return item;
  }

  async updateProposalItem(id: number, data: Partial<InsertCrmProposalItem>): Promise<CrmProposalItem | undefined> {
    const [item] = await db.update(crmProposalItems).set(data).where(eq(crmProposalItems.id, id)).returning();
    return item;
  }

  async deleteProposalItem(id: number): Promise<boolean> {
    const [deleted] = await db.delete(crmProposalItems).where(eq(crmProposalItems.id, id)).returning();
    return !!deleted;
  }

  // ========== CONTRACT MILESTONES ==========
  async getContractMilestones(contractId: number): Promise<CrmContractMilestone[]> {
    return db.select().from(crmContractMilestones).where(eq(crmContractMilestones.contractId, contractId)).orderBy(crmContractMilestones.orderIndex);
  }

  async getContractMilestone(id: number): Promise<CrmContractMilestone | undefined> {
    const [milestone] = await db.select().from(crmContractMilestones).where(eq(crmContractMilestones.id, id));
    return milestone;
  }

  async createContractMilestone(data: InsertCrmContractMilestone): Promise<CrmContractMilestone> {
    const [milestone] = await db.insert(crmContractMilestones).values(data).returning();
    return milestone;
  }

  async updateContractMilestone(id: number, data: Partial<InsertCrmContractMilestone>): Promise<CrmContractMilestone | undefined> {
    const [milestone] = await db.update(crmContractMilestones).set(data).where(eq(crmContractMilestones.id, id)).returning();
    return milestone;
  }

  async deleteContractMilestone(id: number): Promise<boolean> {
    const [deleted] = await db.delete(crmContractMilestones).where(eq(crmContractMilestones.id, id)).returning();
    return !!deleted;
  }
}

export const crmStorage = new CrmStorage();
