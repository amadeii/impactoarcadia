import { db } from "../../db/index";
import {
  xosContractRegistry,
  xosToolRegistry,
  xosSkillRegistry,
  xosPolicyRules,
  xosAuditTrail,
  type XosContract,
  type InsertXosContract,
  type XosTool,
  type InsertXosTool,
  type XosSkill,
  type InsertXosSkill,
  type XosPolicyRule,
  type InsertXosPolicyRule,
  type XosAuditEntry,
  type InsertXosAuditEntry,
} from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";

export interface PolicyEvaluation {
  allowed: boolean;
  reason: string;
  matchedPolicyId?: number;
  matchedPolicyName?: string;
}

export interface AuditEvent {
  agentName: string;
  action: string;
  target?: string;
  decision: string;
  justification?: string;
  input?: any;
  output?: any;
  taskId?: number;
  policyId?: number;
  metadata?: any;
}

class GovernanceService {
  async evaluatePolicy(
    agent: string,
    action: string,
    target: string,
    context?: any
  ): Promise<PolicyEvaluation> {
    try {
      const rules = await db
        .select()
        .from(xosPolicyRules)
        .where(eq(xosPolicyRules.isActive, true))
        .orderBy(xosPolicyRules.priority);

      for (const rule of rules) {
        if (!this.ruleMatchesRequest(rule, agent, action, target, context)) continue;

        const allowed = rule.effect === "allow";
        const evaluation: PolicyEvaluation = {
          allowed,
          reason: rule.description || `Regra "${rule.name}" ${allowed ? "permite" : "bloqueia"} esta ação`,
          matchedPolicyId: rule.id,
          matchedPolicyName: rule.name,
        };

        await this.recordAudit({
          agentName: agent,
          action,
          target,
          decision: allowed ? "allowed" : "denied",
          justification: evaluation.reason,
          input: context,
          policyId: rule.id,
        });

        return evaluation;
      }

      await this.recordAudit({
        agentName: agent,
        action,
        target,
        decision: "allowed",
        justification: "Nenhuma política aplicável - permitido por padrão",
        input: context,
      });

      return {
        allowed: true,
        reason: "Nenhuma política aplicável - permitido por padrão",
      };
    } catch (error) {
      console.error("[Governance] Erro ao avaliar política:", error);
      return { allowed: false, reason: "Erro na avaliação de política - bloqueado por segurança (fail-closed)" };
    }
  }

  private ruleMatchesRequest(
    rule: XosPolicyRule,
    agent: string,
    action: string,
    target: string,
    context?: any
  ): boolean {
    if (rule.scope === "tool") {
      if (rule.target !== action && !action.startsWith(rule.target + ".")) return false;
    }
    if (rule.scope === "contract" && rule.target !== action) return false;
    if (rule.scope === "agent" && rule.target !== agent) return false;

    const conditions = rule.conditions as any;
    if (!conditions || Object.keys(conditions).length === 0) return true;

    if (conditions.pathPatterns && target) {
      const blocked = conditions.pathPatterns.some((pattern: string) =>
        target.includes(pattern) || target === pattern
      );
      if (blocked) return true;
      return false;
    }

    if (conditions.blockedCommands && context?.command) {
      const blocked = conditions.blockedCommands.some((cmd: string) =>
        context.command.toLowerCase().includes(cmd.toLowerCase())
      );
      if (blocked) return true;
      return false;
    }

    if (conditions.allowedAgents) {
      return conditions.allowedAgents.includes(agent);
    }

    if (conditions.requiresHumanApproval) return true;

    if (conditions.minValidationScore !== undefined && context?.validationScore !== undefined) {
      return context.validationScore >= conditions.minValidationScore;
    }

    return true;
  }

  async recordAudit(event: AuditEvent): Promise<void> {
    try {
      await db.insert(xosAuditTrail).values({
        agentName: event.agentName,
        action: event.action,
        target: event.target || null,
        decision: event.decision,
        justification: event.justification || null,
        input: event.input || null,
        output: event.output || null,
        taskId: event.taskId || null,
        policyId: event.policyId || null,
        metadata: event.metadata || null,
      });
    } catch (error) {
      console.error("[Governance] Erro ao registrar audit:", error);
    }
  }

  async syncToolsFromManager(tools: Array<{ name: string; description: string; category?: string }>): Promise<number> {
    let synced = 0;
    for (const tool of tools) {
      try {
        await db
          .insert(xosToolRegistry)
          .values({
            name: tool.name,
            category: tool.category || "general",
            description: tool.description,
            version: "1.0.0",
            isActive: true,
          })
          .onConflictDoUpdate({
            target: xosToolRegistry.name,
            set: {
              description: tool.description,
              category: tool.category || "general",
            },
          });
        synced++;
      } catch (error) {
        console.error(`[Governance] Erro ao sincronizar tool ${tool.name}:`, error);
      }
    }
    console.log(`[Governance] ${synced} ferramentas sincronizadas no Tool Registry`);
    return synced;
  }

  async registerContract(contract: InsertXosContract): Promise<XosContract> {
    const [created] = await db.insert(xosContractRegistry).values(contract).returning();
    return created;
  }

  async getContracts(): Promise<XosContract[]> {
    return db.select().from(xosContractRegistry).where(eq(xosContractRegistry.isActive, true));
  }

  async getTools(): Promise<XosTool[]> {
    return db.select().from(xosToolRegistry).where(eq(xosToolRegistry.isActive, true));
  }

  async createSkill(skill: InsertXosSkill): Promise<XosSkill> {
    const [created] = await db.insert(xosSkillRegistry).values(skill).returning();
    return created;
  }

  async getSkills(status?: string): Promise<XosSkill[]> {
    if (status) {
      return db.select().from(xosSkillRegistry).where(eq(xosSkillRegistry.status, status));
    }
    return db.select().from(xosSkillRegistry);
  }

  async getSkill(id: number): Promise<XosSkill | undefined> {
    const [skill] = await db.select().from(xosSkillRegistry).where(eq(xosSkillRegistry.id, id));
    return skill;
  }

  async incrementSkillUsage(id: number, success: boolean): Promise<void> {
    const skill = await this.getSkill(id);
    if (!skill) return;
    const newCount = (skill.usageCount || 0) + 1;
    const currentSuccesses = Math.round(((skill.successRate || 0) / 100) * (skill.usageCount || 0));
    const newSuccesses = success ? currentSuccesses + 1 : currentSuccesses;
    const newRate = Math.round((newSuccesses / newCount) * 100);
    await db.update(xosSkillRegistry).set({ usageCount: newCount, successRate: newRate }).where(eq(xosSkillRegistry.id, id));
  }

  async deactivateSkill(id: number): Promise<void> {
    await db.update(xosSkillRegistry).set({ status: "inactive" }).where(eq(xosSkillRegistry.id, id));
  }

  async updateToolRBAC(toolId: number, allowedAgents: string[]): Promise<void> {
    await db.update(xosToolRegistry).set({
      allowedAgents: allowedAgents.length > 0 ? allowedAgents : null,
    }).where(eq(xosToolRegistry.id, toolId));
  }

  async getPolicies(): Promise<XosPolicyRule[]> {
    return db.select().from(xosPolicyRules).where(eq(xosPolicyRules.isActive, true)).orderBy(xosPolicyRules.priority);
  }

  async createPolicy(policy: InsertXosPolicyRule): Promise<XosPolicyRule> {
    const [created] = await db.insert(xosPolicyRules).values(policy).returning();
    return created;
  }

  async getAuditTrail(limit: number = 50, agentName?: string): Promise<XosAuditEntry[]> {
    if (agentName) {
      return db.select().from(xosAuditTrail)
        .where(eq(xosAuditTrail.agentName, agentName))
        .orderBy(desc(xosAuditTrail.createdAt))
        .limit(limit);
    }
    return db.select().from(xosAuditTrail).orderBy(desc(xosAuditTrail.createdAt)).limit(limit);
  }

  async getGovernanceStats(): Promise<{
    totalContracts: number;
    totalTools: number;
    totalSkills: number;
    totalPolicies: number;
    totalAuditEntries: number;
    recentDenials: number;
  }> {
    const [contracts] = await db.select({ count: sql<number>`count(*)` }).from(xosContractRegistry).where(eq(xosContractRegistry.isActive, true));
    const [tools] = await db.select({ count: sql<number>`count(*)` }).from(xosToolRegistry).where(eq(xosToolRegistry.isActive, true));
    const [skills] = await db.select({ count: sql<number>`count(*)` }).from(xosSkillRegistry);
    const [policies] = await db.select({ count: sql<number>`count(*)` }).from(xosPolicyRules).where(eq(xosPolicyRules.isActive, true));
    const [audit] = await db.select({ count: sql<number>`count(*)` }).from(xosAuditTrail);
    const [denials] = await db.select({ count: sql<number>`count(*)` }).from(xosAuditTrail)
      .where(and(eq(xosAuditTrail.decision, "denied"), sql`created_at > NOW() - INTERVAL '24 hours'`));

    return {
      totalContracts: Number(contracts.count),
      totalTools: Number(tools.count),
      totalSkills: Number(skills.count),
      totalPolicies: Number(policies.count),
      totalAuditEntries: Number(audit.count),
      recentDenials: Number(denials.count),
    };
  }
}

export const governanceService = new GovernanceService();
