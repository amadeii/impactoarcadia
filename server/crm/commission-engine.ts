import { db } from "../../db/index";
import { eq, and, gte, lte, isNull, or, sql } from "drizzle-orm";
import {
  crmContracts,
  crmRevenueSchedule,
  crmCommissionRules,
  crmCommissions,
  type CrmContract,
  type CrmRevenueSchedule,
  type CrmCommissionRule,
  type InsertCrmCommission,
  type InsertCrmRevenueSchedule,
} from "@shared/schema";

export class CommissionEngine {
  async generateRevenueSchedule(contractId: number): Promise<CrmRevenueSchedule[]> {
    const contract = await db.select().from(crmContracts).where(eq(crmContracts.id, contractId)).then(r => r[0]);
    if (!contract) throw new Error("Contract not found");

    const existing = await db.select().from(crmRevenueSchedule).where(eq(crmRevenueSchedule.contractId, contractId));
    if (existing.length > 0) return existing;

    const startDate = new Date(contract.startDate);
    const endDate = contract.endDate ? new Date(contract.endDate) : null;
    const monthlyValue = contract.monthlyValue || 0;
    const schedules: InsertCrmRevenueSchedule[] = [];

    if (contract.billingCycle === "monthly" && monthlyValue > 0) {
      let currentMonth = 1;
      let currentDate = new Date(startDate);
      const now = new Date();
      const maxProjectionMonths = 24;
      
      while (true) {
        if (endDate && currentDate > endDate) break;
        if (!endDate && currentMonth > maxProjectionMonths) break;
        
        schedules.push({
          contractId,
          month: currentMonth,
          dueDate: new Date(currentDate),
          value: monthlyValue,
          status: "pending",
        });
        currentDate.setMonth(currentDate.getMonth() + 1);
        currentMonth++;
      }
    } else if (contract.billingCycle === "yearly" && monthlyValue > 0) {
      const yearlyValue = monthlyValue * 12;
      let currentDate = new Date(startDate);
      let year = 1;
      const maxProjectionYears = 10;
      
      while (true) {
        if (endDate && currentDate > endDate) break;
        if (!endDate && year > maxProjectionYears) break;
        
        schedules.push({
          contractId,
          month: year,
          dueDate: new Date(currentDate),
          value: yearlyValue,
          status: "pending",
        });
        currentDate.setFullYear(currentDate.getFullYear() + 1);
        year++;
      }
    } else if (contract.totalValue && contract.totalValue > 0) {
      schedules.push({
        contractId,
        month: 1,
        dueDate: startDate,
        value: contract.totalValue,
        status: "pending",
      });
    }

    if (schedules.length > 0) {
      await db.insert(crmRevenueSchedule).values(schedules);
      return db.select().from(crmRevenueSchedule).where(eq(crmRevenueSchedule.contractId, contractId));
    }

    return [];
  }

  async getApplicableRules(revenueType: string, saleScenario: string, month: number): Promise<CrmCommissionRule[]> {
    const rules = await db.select().from(crmCommissionRules)
      .where(
        and(
          eq(crmCommissionRules.isActive, "true"),
          eq(crmCommissionRules.revenueType, revenueType),
          eq(crmCommissionRules.saleScenario, saleScenario)
        )
      );

    return rules.filter(rule => {
      const start = rule.monthRangeStart || 1;
      const end = rule.monthRangeEnd || 999;
      return month >= start && month <= end;
    });
  }

  async calculateCommissions(revenueScheduleId: number, salesUserId?: string): Promise<void> {
    const [schedule] = await db.select().from(crmRevenueSchedule)
      .where(eq(crmRevenueSchedule.id, revenueScheduleId));
    
    if (!schedule) throw new Error("Revenue schedule not found");
    
    const [contract] = await db.select().from(crmContracts)
      .where(eq(crmContracts.id, schedule.contractId));
    
    if (!contract) throw new Error("Contract not found");

    const existingCommissions = await db.select().from(crmCommissions)
      .where(eq(crmCommissions.revenueScheduleId, revenueScheduleId));
    
    if (existingCommissions.length > 0) return;

    const isRecurring = contract.type === "saas" || contract.type === "subscription";
    const revenueType = isRecurring ? "recurring" : "one_time";
    const period = `${new Date(schedule.dueDate).getFullYear()}-${String(new Date(schedule.dueDate).getMonth() + 1).padStart(2, "0")}`;

    const hasPartner = !!contract.partnerId;
    
    if (hasPartner) {
      const partnerRules = await this.getApplicableRules(revenueType, "partner_sale", schedule.month);
      
      for (const rule of partnerRules) {
        if (rule.role === "partner") {
          const commissionValue = Math.round((schedule.value * rule.percentage) / 100);
          
          if (commissionValue > 0) {
            await db.insert(crmCommissions).values({
              contractId: contract.id,
              revenueScheduleId: schedule.id,
              ruleId: rule.id,
              partnerId: contract.partnerId,
              role: "partner",
              baseValue: schedule.value,
              percentage: rule.percentage,
              commissionValue,
              period,
              status: "pending",
            });
          }
        }
      }
    }
    
    if (salesUserId) {
      const directRules = await this.getApplicableRules(revenueType, "direct_sale", schedule.month);
      
      for (const rule of directRules) {
        if (rule.role === "sales" || rule.role === "internal") {
          const commissionValue = Math.round((schedule.value * rule.percentage) / 100);
          
          if (commissionValue > 0) {
            await db.insert(crmCommissions).values({
              contractId: contract.id,
              revenueScheduleId: schedule.id,
              ruleId: rule.id,
              userId: salesUserId,
              role: rule.role,
              baseValue: schedule.value,
              percentage: rule.percentage,
              commissionValue,
              period,
              status: "pending",
            });
          }
        }
      }
    }
  }

  async seedDefaultRules(): Promise<void> {
    const existingRules = await db.select().from(crmCommissionRules);
    if (existingRules.length > 0) return;

    const defaultRules = [
      {
        name: "Comissão Aquisição Recorrente - Parceiro (Meses 1-5)",
        description: "Comissão de aquisição nos primeiros 5 meses de contratos recorrentes para parceiros",
        revenueType: "recurring",
        saleScenario: "partner_sale",
        role: "partner",
        monthRangeStart: 1,
        monthRangeEnd: 5,
        percentage: 10,
        isActive: "true" as const,
      },
      {
        name: "Comissão Manutenção Recorrente - Parceiro (Mês 6+)",
        description: "Comissão de manutenção perpétua a partir do 6º mês para parceiros",
        revenueType: "recurring",
        saleScenario: "partner_sale",
        role: "partner",
        monthRangeStart: 6,
        monthRangeEnd: null,
        percentage: 5,
        isActive: "true" as const,
      },
      {
        name: "Comissão Serviços - Parceiro",
        description: "Comissão para projetos de serviço vendidos por parceiros",
        revenueType: "one_time",
        saleScenario: "partner_sale",
        role: "partner",
        monthRangeStart: null,
        monthRangeEnd: null,
        percentage: 15,
        isActive: "true" as const,
      },
      {
        name: "Comissão Vendedor Interno - Recorrente (Meses 1-5)",
        description: "Comissão para vendedor interno em vendas diretas recorrentes",
        revenueType: "recurring",
        saleScenario: "direct_sale",
        role: "sales",
        monthRangeStart: 1,
        monthRangeEnd: 5,
        percentage: 8,
        isActive: "true" as const,
      },
      {
        name: "Comissão Vendedor Interno - Manutenção (Mês 6+)",
        description: "Comissão de manutenção para vendedor interno a partir do 6º mês",
        revenueType: "recurring",
        saleScenario: "direct_sale",
        role: "sales",
        monthRangeStart: 6,
        monthRangeEnd: null,
        percentage: 5,
        isActive: "true" as const,
      },
      {
        name: "Comissão Vendedor Interno - Serviços",
        description: "Comissão para vendedor interno em projetos de serviço",
        revenueType: "one_time",
        saleScenario: "direct_sale",
        role: "sales",
        monthRangeStart: null,
        monthRangeEnd: null,
        percentage: 10,
        isActive: "true" as const,
      },
    ];

    await db.insert(crmCommissionRules).values(defaultRules);
  }

  async processContractCommissions(contractId: number, salesUserId?: string): Promise<number> {
    let schedules = await this.generateRevenueSchedule(contractId);
    
    const contract = await db.select().from(crmContracts).where(eq(crmContracts.id, contractId)).then(r => r[0]);
    if (contract && !contract.endDate) {
      const lastSchedule = schedules[schedules.length - 1];
      if (lastSchedule) {
        const lastDueDate = new Date(lastSchedule.dueDate);
        const now = new Date();
        const monthsRemaining = (lastDueDate.getFullYear() - now.getFullYear()) * 12 + (lastDueDate.getMonth() - now.getMonth());
        if (monthsRemaining < 6) {
          schedules = await this.extendRevenueSchedule(contractId, 12);
        }
      }
    }
    
    let processed = 0;

    for (const schedule of schedules) {
      if (schedule.status === "pending") {
        await this.calculateCommissions(schedule.id, salesUserId);
        processed++;
      }
    }

    return processed;
  }

  async getCommissionSummary(partnerId?: number, userId?: string, startDate?: Date, endDate?: Date) {
    const conditions = [];
    
    if (partnerId) conditions.push(eq(crmCommissions.partnerId, partnerId));
    if (userId) conditions.push(eq(crmCommissions.userId, userId));
    
    const commissions = conditions.length > 0
      ? await db.select().from(crmCommissions).where(and(...conditions))
      : await db.select().from(crmCommissions);

    const filteredCommissions = commissions.filter(c => {
      const period = new Date(c.period + "-01");
      if (startDate && period < startDate) return false;
      if (endDate && period > endDate) return false;
      return true;
    });

    const pending = filteredCommissions.filter(c => c.status === "pending");
    const paid = filteredCommissions.filter(c => c.status === "paid");

    return {
      totalPending: pending.reduce((sum, c) => sum + c.commissionValue, 0),
      totalPaid: paid.reduce((sum, c) => sum + c.commissionValue, 0),
      countPending: pending.length,
      countPaid: paid.length,
      commissions: filteredCommissions,
    };
  }

  async markCommissionPaid(commissionId: number): Promise<void> {
    await db.update(crmCommissions)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(crmCommissions.id, commissionId));
  }

  async markSchedulePaid(scheduleId: number, invoiceNumber?: string): Promise<void> {
    await db.update(crmRevenueSchedule)
      .set({ 
        status: "paid", 
        paidAt: new Date(),
        invoiceNumber: invoiceNumber || undefined 
      })
      .where(eq(crmRevenueSchedule.id, scheduleId));
  }

  async extendRevenueSchedule(contractId: number, monthsAhead: number = 12): Promise<CrmRevenueSchedule[]> {
    const contract = await db.select().from(crmContracts).where(eq(crmContracts.id, contractId)).then(r => r[0]);
    if (!contract) throw new Error("Contract not found");

    if (contract.endDate && new Date(contract.endDate) < new Date()) {
      return [];
    }

    const existing = await db.select().from(crmRevenueSchedule)
      .where(eq(crmRevenueSchedule.contractId, contractId))
      .orderBy(sql`month DESC`);
    
    if (existing.length === 0) {
      return this.generateRevenueSchedule(contractId);
    }

    const lastSchedule = existing[0];
    const lastMonth = lastSchedule.month;
    const lastDueDate = new Date(lastSchedule.dueDate);
    const monthlyValue = contract.monthlyValue || 0;
    const endDate = contract.endDate ? new Date(contract.endDate) : null;
    
    const schedules: InsertCrmRevenueSchedule[] = [];

    if (contract.billingCycle === "monthly" && monthlyValue > 0) {
      let currentMonth = lastMonth + 1;
      let currentDate = new Date(lastDueDate);
      currentDate.setMonth(currentDate.getMonth() + 1);
      
      for (let i = 0; i < monthsAhead; i++) {
        if (endDate && currentDate > endDate) break;
        
        schedules.push({
          contractId,
          month: currentMonth,
          dueDate: new Date(currentDate),
          value: monthlyValue,
          status: "pending",
        });
        currentDate.setMonth(currentDate.getMonth() + 1);
        currentMonth++;
      }
    } else if (contract.billingCycle === "yearly" && monthlyValue > 0) {
      const yearlyValue = monthlyValue * 12;
      let year = lastMonth + 1;
      let currentDate = new Date(lastDueDate);
      currentDate.setFullYear(currentDate.getFullYear() + 1);
      
      for (let i = 0; i < Math.ceil(monthsAhead / 12); i++) {
        if (endDate && currentDate > endDate) break;
        
        schedules.push({
          contractId,
          month: year,
          dueDate: new Date(currentDate),
          value: yearlyValue,
          status: "pending",
        });
        currentDate.setFullYear(currentDate.getFullYear() + 1);
        year++;
      }
    }

    if (schedules.length > 0) {
      await db.insert(crmRevenueSchedule).values(schedules);
    }

    return db.select().from(crmRevenueSchedule).where(eq(crmRevenueSchedule.contractId, contractId));
  }

  async extendAllActiveContracts(monthsAhead: number = 12): Promise<number> {
    const activeContracts = await db.select().from(crmContracts)
      .where(
        or(
          eq(crmContracts.status, "active"),
          eq(crmContracts.status, "signed")
        )
      );
    
    let extended = 0;
    for (const contract of activeContracts) {
      const endDate = contract.endDate ? new Date(contract.endDate) : null;
      if (!endDate || endDate > new Date()) {
        const result = await this.extendRevenueSchedule(contract.id, monthsAhead);
        if (result.length > 0) extended++;
      }
    }
    
    return extended;
  }
}

export const commissionEngine = new CommissionEngine();
