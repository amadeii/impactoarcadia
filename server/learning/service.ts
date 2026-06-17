import { db } from "../../db/index";
import { learnedInteractions, learnedPatterns, generatedCode, learningEvents } from "@shared/schema";
import { eq, desc, sql, and } from "drizzle-orm";

interface CollectorEvent {
  type: string;
  module: string;
  data: Record<string, any>;
  timestamp: number;
  sessionId: string;
}

export type InteractionSource = 'agent_chat' | 'manus_agent' | 'support_chat' | 'whatsapp' | 'navigation' | 'web_capture' | 'url_learned';

export interface InteractionData {
  tenantId?: number;
  userId?: string;
  source: InteractionSource;
  sessionId?: string;
  question: string;
  answer: string;
  context?: Record<string, any>;
  toolsUsed?: string[];
  dataSourcesAccessed?: string[];
  confidence?: number;
  category?: string;
  tags?: string[];
}

export interface PatternData {
  tenantId?: number;
  name: string;
  description?: string;
  patternType: 'correlation' | 'trend' | 'anomaly' | 'rule' | 'template';
  sourceDataset?: string;
  sourceTable?: string;
  pattern: Record<string, any>;
  confidence?: number;
}

export interface CodeData {
  tenantId?: number;
  name: string;
  description?: string;
  language?: 'python' | 'sql' | 'javascript';
  codeType: 'analysis' | 'automation' | 'transformation' | 'report';
  code: string;
  parameters?: Record<string, any>;
  generatedFrom?: string;
}

class LearningService {
  async saveInteraction(data: InteractionData): Promise<number> {
    try {
      const category = data.category || this.inferCategory(data.question);
      const tags = data.tags || this.extractTags(data.question, data.answer);

      const [result] = await db.insert(learnedInteractions).values({
        tenantId: data.tenantId,
        userId: data.userId,
        source: data.source,
        sessionId: data.sessionId,
        question: data.question,
        answer: data.answer,
        context: data.context,
        toolsUsed: data.toolsUsed,
        dataSourcesAccessed: data.dataSourcesAccessed,
        confidence: data.confidence?.toString(),
        category,
        tags,
        isIndexed: 0,
      }).returning({ id: learnedInteractions.id });

      console.log(`[Learning] Interaction saved: ${result.id} (${data.source})`);
      return result.id;
    } catch (error) {
      console.error("[Learning] Error saving interaction:", error);
      throw error;
    }
  }

  async savePattern(data: PatternData): Promise<number> {
    try {
      const [result] = await db.insert(learnedPatterns).values({
        tenantId: data.tenantId,
        name: data.name,
        description: data.description,
        patternType: data.patternType,
        sourceDataset: data.sourceDataset,
        sourceTable: data.sourceTable,
        pattern: data.pattern,
        confidence: data.confidence?.toString(),
        usageCount: 0,
        isActive: 1,
      }).returning({ id: learnedPatterns.id });

      console.log(`[Learning] Pattern saved: ${result.id} (${data.patternType})`);
      return result.id;
    } catch (error) {
      console.error("[Learning] Error saving pattern:", error);
      throw error;
    }
  }

  async saveGeneratedCode(data: CodeData): Promise<number> {
    try {
      const [result] = await db.insert(generatedCode).values({
        tenantId: data.tenantId,
        name: data.name,
        description: data.description,
        language: data.language || 'python',
        codeType: data.codeType,
        code: data.code,
        parameters: data.parameters,
        generatedFrom: data.generatedFrom,
        usageCount: 0,
        isActive: 1,
      }).returning({ id: generatedCode.id });

      console.log(`[Learning] Code saved: ${result.id} (${data.codeType})`);
      return result.id;
    } catch (error) {
      console.error("[Learning] Error saving code:", error);
      throw error;
    }
  }

  async getRecentInteractions(limit: number = 50): Promise<any[]> {
    return db.select()
      .from(learnedInteractions)
      .orderBy(desc(learnedInteractions.createdAt))
      .limit(limit);
  }

  async getActivePatterns(): Promise<any[]> {
    return db.select()
      .from(learnedPatterns)
      .where(eq(learnedPatterns.isActive, 1))
      .orderBy(desc(learnedPatterns.usageCount));
  }

  async getGeneratedCodes(codeType?: string): Promise<any[]> {
    if (codeType) {
      return db.select()
        .from(generatedCode)
        .where(eq(generatedCode.codeType, codeType))
        .orderBy(desc(generatedCode.usageCount));
    }
    return db.select()
      .from(generatedCode)
      .where(eq(generatedCode.isActive, 1))
      .orderBy(desc(generatedCode.usageCount));
  }

  async incrementPatternUsage(patternId: number): Promise<void> {
    await db.update(learnedPatterns)
      .set({
        usageCount: sql`${learnedPatterns.usageCount} + 1`,
        lastUsedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(learnedPatterns.id, patternId));
  }

  async incrementCodeUsage(codeId: number): Promise<void> {
    await db.update(generatedCode)
      .set({
        usageCount: sql`${generatedCode.usageCount} + 1`,
        lastUsedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(generatedCode.id, codeId));
  }

  async getStats(): Promise<{
    totalInteractions: number;
    totalPatterns: number;
    totalCodes: number;
    bySource: Record<string, number>;
  }> {
    const interactions = await db.select({ count: sql<number>`count(*)` })
      .from(learnedInteractions);
    
    const patterns = await db.select({ count: sql<number>`count(*)` })
      .from(learnedPatterns)
      .where(eq(learnedPatterns.isActive, 1));
    
    const codes = await db.select({ count: sql<number>`count(*)` })
      .from(generatedCode)
      .where(eq(generatedCode.isActive, 1));

    const bySource = await db.select({
      source: learnedInteractions.source,
      count: sql<number>`count(*)`,
    })
      .from(learnedInteractions)
      .groupBy(learnedInteractions.source);

    return {
      totalInteractions: Number(interactions[0]?.count || 0),
      totalPatterns: Number(patterns[0]?.count || 0),
      totalCodes: Number(codes[0]?.count || 0),
      bySource: bySource.reduce((acc, { source, count }) => {
        acc[source] = Number(count);
        return acc;
      }, {} as Record<string, number>),
    };
  }

  private inferCategory(question: string): string {
    const q = question.toLowerCase();
    if (q.includes('financeiro') || q.includes('custo') || q.includes('receita') || q.includes('lucro')) {
      return 'financeiro';
    }
    if (q.includes('cliente') || q.includes('parceiro') || q.includes('contrato')) {
      return 'crm';
    }
    if (q.includes('produto') || q.includes('estoque') || q.includes('venda')) {
      return 'vendas';
    }
    if (q.includes('relatório') || q.includes('gráfico') || q.includes('dashboard')) {
      return 'analytics';
    }
    if (q.includes('processo') || q.includes('projeto') || q.includes('tarefa')) {
      return 'processos';
    }
    return 'geral';
  }

  private extractTags(question: string, answer: string): string[] {
    const tags: string[] = [];
    const combined = `${question} ${answer}`.toLowerCase();
    
    const keywords = [
      'análise', 'relatório', 'gráfico', 'dashboard', 'cliente', 'parceiro',
      'contrato', 'financeiro', 'vendas', 'estoque', 'produto', 'processo',
      'projeto', 'tarefa', 'bi', 'erp', 'crm', 'automação', 'consulta'
    ];
    
    for (const kw of keywords) {
      if (combined.includes(kw)) {
        tags.push(kw);
      }
    }
    
    return tags.slice(0, 10);
  }

  async getUnindexedInteractions(limit: number = 50): Promise<any[]> {
    return db.select()
      .from(learnedInteractions)
      .where(eq(learnedInteractions.isIndexed, 0))
      .orderBy(learnedInteractions.createdAt)
      .limit(limit);
  }

  async markAsIndexed(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    
    for (const id of ids) {
      await db.update(learnedInteractions)
        .set({ isIndexed: 1 })
        .where(eq(learnedInteractions.id, id));
    }
    console.log(`[Learning] Marked ${ids.length} interactions as indexed`);
  }

  async indexInteractionsToChromaDB(): Promise<{ indexed: number; errors: number }> {
    const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8001";
    const unindexed = await this.getUnindexedInteractions(100);
    
    if (unindexed.length === 0) {
      return { indexed: 0, errors: 0 };
    }

    let indexed = 0;
    let errors = 0;
    const indexedIds: number[] = [];

    for (const interaction of unindexed) {
      try {
        const document = `Pergunta: ${interaction.question}\n\nResposta: ${interaction.answer}`;
        const metadata = {
          type: 'learned_interaction',
          source: interaction.source,
          category: interaction.category || 'geral',
          userId: interaction.userId,
          createdAt: interaction.createdAt?.toISOString(),
        };

        const response = await fetch(`${PYTHON_SERVICE_URL}/embeddings/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            doc_id: `interaction_${interaction.id}`,
            document,
            metadata,
          }),
        });

        if (response.ok) {
          indexedIds.push(interaction.id);
          indexed++;
        } else {
          errors++;
        }
      } catch (error) {
        errors++;
        console.error(`[Learning] Error indexing interaction ${interaction.id}:`, error);
      }
    }

    if (indexedIds.length > 0) {
      await this.markAsIndexed(indexedIds);
    }

    console.log(`[Learning] Indexing complete: ${indexed} indexed, ${errors} errors`);
    return { indexed, errors };
  }

  async updateInteractionFeedback(id: number, feedback: 'positive' | 'negative' | 'neutral'): Promise<void> {
    await db.update(learnedInteractions)
      .set({ feedback })
      .where(eq(learnedInteractions.id, id));
    console.log(`[Learning] Feedback updated for interaction ${id}: ${feedback}`);
  }

  async searchSimilarInteractions(query: string): Promise<any[]> {
    const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8001";
    
    try {
      const response = await fetch(`${PYTHON_SERVICE_URL}/embeddings/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, n_results: 5 }),
      });

      if (!response.ok) {
        return [];
      }

      const results = await response.json();
      return results.documents?.[0] || [];
    } catch (error) {
      console.error("[Learning] Error searching similar interactions:", error);
      return [];
    }
  }

  async saveEvents(userId: string, events: CollectorEvent[]): Promise<number> {
    try {
      let savedCount = 0;
      
      for (const event of events) {
        const url = event.data?.url || event.data?.href || event.data?.path;
        let timeSpent: number | null = null;
        if (typeof event.data?.timeSpent === 'number') {
          timeSpent = event.data.timeSpent;
        } else if (typeof event.data?.timeSpentSeconds === 'number') {
          timeSpent = event.data.timeSpentSeconds * 1000;
        }

        await db.insert(learningEvents).values({
          userId,
          sessionId: event.sessionId,
          eventType: event.type,
          module: event.module,
          data: event.data,
          url,
          timeSpent,
          isProcessed: 0,
        });
        savedCount++;
      }

      return savedCount;
    } catch (error) {
      console.error("[Learning] Error saving events:", error);
      throw error;
    }
  }

  async getEvents(limit: number = 100, eventType?: string): Promise<any[]> {
    if (eventType) {
      return db.select()
        .from(learningEvents)
        .where(eq(learningEvents.eventType, eventType))
        .orderBy(desc(learningEvents.createdAt))
        .limit(limit);
    }
    return db.select()
      .from(learningEvents)
      .orderBy(desc(learningEvents.createdAt))
      .limit(limit);
  }

  async getEventStats(): Promise<{
    totalEvents: number;
    unprocessedEvents: number;
    byType: Record<string, number>;
    byModule: Record<string, number>;
    dwellEvents: number;
    avgDwellTime: number;
  }> {
    const total = await db.select({ count: sql<number>`count(*)` })
      .from(learningEvents);
    
    const unprocessed = await db.select({ count: sql<number>`count(*)` })
      .from(learningEvents)
      .where(eq(learningEvents.isProcessed, 0));

    const byType = await db.select({
      type: learningEvents.eventType,
      count: sql<number>`count(*)`,
    })
      .from(learningEvents)
      .groupBy(learningEvents.eventType);

    const byModule = await db.select({
      module: learningEvents.module,
      count: sql<number>`count(*)`,
    })
      .from(learningEvents)
      .groupBy(learningEvents.module);

    const dwellStats = await db.select({
      count: sql<number>`count(*)`,
      avgTime: sql<number>`avg(time_spent)`,
    })
      .from(learningEvents)
      .where(eq(learningEvents.eventType, 'page_dwell'));

    return {
      totalEvents: Number(total[0]?.count || 0),
      unprocessedEvents: Number(unprocessed[0]?.count || 0),
      byType: byType.reduce((acc, { type, count }) => {
        acc[type] = Number(count);
        return acc;
      }, {} as Record<string, number>),
      byModule: byModule.reduce((acc, { module, count }) => {
        acc[module] = Number(count);
        return acc;
      }, {} as Record<string, number>),
      dwellEvents: Number(dwellStats[0]?.count || 0),
      avgDwellTime: Number(dwellStats[0]?.avgTime || 0),
    };
  }

  async getUnprocessedEvents(limit: number = 50): Promise<any[]> {
    return db.select()
      .from(learningEvents)
      .where(eq(learningEvents.isProcessed, 0))
      .orderBy(learningEvents.createdAt)
      .limit(limit);
  }

  async markEventsAsProcessed(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    
    for (const id of ids) {
      await db.update(learningEvents)
        .set({ 
          isProcessed: 1,
          processedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(learningEvents.id, id));
    }
    console.log(`[Learning] Marked ${ids.length} events as processed`);
  }
}

export const learningService = new LearningService();

async function detectPatterns(): Promise<{ detected: number }> {
  let detected = 0;
  let processedEventIds: number[] = [];
  
  try {
    const events = await learningService.getUnprocessedEvents(200);
    if (events.length < 10) {
      if (events.length > 0) {
        await learningService.markEventsAsProcessed(events.map(e => e.id));
      }
      return { detected: 0 };
    }
    
    processedEventIds = events.map(e => e.id);

    const moduleFrequency: Record<string, number> = {};
    const navigationSequences: string[] = [];
    const timePatterns: { module: string; avgTime: number; count: number }[] = [];
    
    for (const event of events) {
      if (event.module) {
        moduleFrequency[event.module] = (moduleFrequency[event.module] || 0) + 1;
      }
      if (event.url) {
        navigationSequences.push(event.url);
      }
    }

    for (const [module, count] of Object.entries(moduleFrequency)) {
      if (count >= 5) {
        const avgTime = events
          .filter(e => e.module === module && e.timeSpent)
          .reduce((sum, e) => sum + (e.timeSpent || 0), 0) / count;
        
        if (avgTime > 0) {
          timePatterns.push({ module, avgTime, count });
        }
      }
    }

    const sortedModules = Object.entries(moduleFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    if (sortedModules.length >= 2 && sortedModules[0][1] >= 10) {
      try {
        await learningService.savePattern({
          name: `Módulos mais usados: ${sortedModules.map(m => m[0]).join(', ')}`,
          description: `Detectado automaticamente pelo sistema com base em ${events.length} eventos`,
          patternType: 'trend',
          pattern: {
            moduleFrequency: Object.fromEntries(sortedModules),
            timePatterns,
            totalEvents: events.length,
            detectedAt: new Date().toISOString(),
            isSystemPattern: true,
          },
          confidence: Math.min(0.9, sortedModules[0][1] / 50),
        });
        detected++;
      } catch (patternError) {
        console.warn("[PatternDetection] Failed to save module pattern:", patternError);
      }
    }

    const interactions = await learningService.getRecentInteractions(100);
    const categoryCount: Record<string, number> = {};
    const toolUsageCount: Record<string, number> = {};
    
    for (const interaction of interactions) {
      if (interaction.category) {
        categoryCount[interaction.category] = (categoryCount[interaction.category] || 0) + 1;
      }
      if (interaction.toolsUsed && Array.isArray(interaction.toolsUsed)) {
        for (const tool of interaction.toolsUsed) {
          toolUsageCount[tool] = (toolUsageCount[tool] || 0) + 1;
        }
      }
    }

    const topCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0];
    if (topCategory && topCategory[1] >= 5) {
      const existingPatterns = await learningService.getActivePatterns();
      const hasSimilar = existingPatterns.some(p => 
        p.name.includes('Categoria dominante') && 
        p.pattern?.topCategory === topCategory[0]
      );
      
      if (!hasSimilar) {
        try {
          await learningService.savePattern({
            name: `Categoria dominante: ${topCategory[0]}`,
            description: `${topCategory[1]} interações focadas em "${topCategory[0]}" detectadas pelo sistema`,
            patternType: 'correlation',
            pattern: {
              topCategory: topCategory[0],
              categoryDistribution: categoryCount,
              toolUsage: toolUsageCount,
              sampleSize: interactions.length,
              detectedAt: new Date().toISOString(),
              isSystemPattern: true,
            },
            confidence: Math.min(0.85, topCategory[1] / 30),
          });
          detected++;
        } catch (patternError) {
          console.warn("[PatternDetection] Failed to save category pattern:", patternError);
        }
      }
    }

    console.log(`[PatternDetection] Analyzed ${events.length} events, ${interactions.length} interactions, detected ${detected} patterns`);
  } catch (error) {
    console.error("[PatternDetection] Error:", error);
  } finally {
    if (processedEventIds.length > 0) {
      try {
        await learningService.markEventsAsProcessed(processedEventIds);
      } catch (markError) {
        console.error("[PatternDetection] Failed to mark events as processed:", markError);
      }
    }
  }
  
  return { detected };
}

let indexingInterval: NodeJS.Timeout | null = null;
let patternDetectionInterval: NodeJS.Timeout | null = null;

export function startIndexingJob(intervalMs: number = 60000): void {
  if (indexingInterval) {
    clearInterval(indexingInterval);
  }

  console.log(`[Learning] Starting indexing job (every ${intervalMs / 1000}s)`);
  
  indexingInterval = setInterval(async () => {
    try {
      const result = await learningService.indexInteractionsToChromaDB();
      if (result.indexed > 0) {
        console.log(`[Learning] Periodic indexing: ${result.indexed} new interactions indexed`);
      }
    } catch (error) {
      console.error("[Learning] Periodic indexing error:", error);
    }
  }, intervalMs);
}

export function stopIndexingJob(): void {
  if (indexingInterval) {
    clearInterval(indexingInterval);
    indexingInterval = null;
    console.log("[Learning] Indexing job stopped");
  }
}

export function startPatternDetectionJob(intervalMs: number = 300000): void {
  if (patternDetectionInterval) {
    clearInterval(patternDetectionInterval);
  }

  console.log(`[Learning] Starting pattern detection job (every ${intervalMs / 1000}s)`);
  
  patternDetectionInterval = setInterval(async () => {
    try {
      const result = await detectPatterns();
      if (result.detected > 0) {
        console.log(`[Learning] Pattern detection: ${result.detected} new patterns detected`);
      }
    } catch (error) {
      console.error("[Learning] Pattern detection error:", error);
    }
  }, intervalMs);
}

export function stopPatternDetectionJob(): void {
  if (patternDetectionInterval) {
    clearInterval(patternDetectionInterval);
    patternDetectionInterval = null;
    console.log("[Learning] Pattern detection job stopped");
  }
}

export async function runPatternDetectionNow(): Promise<{ detected: number }> {
  return detectPatterns();
}
