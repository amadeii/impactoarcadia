import type { Express, Request, Response } from "express";
import OpenAI from "openai";
import { chatStorage } from "./storage";
import { buildPromptWithContext } from "./prompt";
import { compassStorage } from "../../compass/storage";
import { PDFParse } from "pdf-parse";
import { learningService } from "../../learning/service";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export function registerChatRoutes(app: Express): void {
  app.get("/api/conversations", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const userId = req.user!.id;
      const conversations = await chatStorage.getUserConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const userId = req.user!.id;
      const conversation = await chatStorage.getConversation(id);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      if (conversation.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const messages = await chatStorage.getMessagesByConversation(id);
      res.json({ ...conversation, messages });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.post("/api/conversations", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const userId = req.user!.id;
      const { title } = req.body;
      const conversation = await chatStorage.createConversation(userId, title || "Nova Conversa");
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.patch("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const userId = req.user!.id;
      const { title } = req.body;
      
      if (!title || typeof title !== "string" || title.trim().length === 0) {
        return res.status(400).json({ error: "Title is required" });
      }
      
      const conversation = await chatStorage.getConversation(id);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      if (conversation.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const updated = await chatStorage.updateConversation(id, title.trim());
      res.json(updated);
    } catch (error) {
      console.error("Error updating conversation:", error);
      res.status(500).json({ error: "Failed to update conversation" });
    }
  });

  app.delete("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const userId = req.user!.id;
      const conversation = await chatStorage.getConversation(id);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      if (conversation.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      await chatStorage.deleteConversation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  app.post("/api/conversations/:id/messages", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const conversationId = parseInt(req.params.id);
      const userId = req.user!.id;
      const { content, fileContent, fileName, fileBase64, projectId, tenantId } = req.body;

      const conversation = await chatStorage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      if (conversation.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      let processedFileContent = fileContent;
      
      if (fileName && fileBase64 && fileName.toLowerCase().endsWith('.pdf')) {
        try {
          const pdfBuffer = Buffer.from(fileBase64, 'base64');
          const parser = new PDFParse({ data: pdfBuffer });
          const result = await parser.getText();
          processedFileContent = result.text;
          await parser.destroy();
        } catch (pdfError) {
          console.error("Error parsing PDF:", pdfError);
          processedFileContent = "[Erro ao processar PDF - arquivo pode estar corrompido ou protegido]";
        }
      }

      let messageContent = content;
      if (fileName && (processedFileContent || fileContent)) {
        messageContent = `[Arquivo anexado: ${fileName}]\n\n${content}`;
      }

      const userMessage = await chatStorage.createMessage(conversationId, "user", messageContent);

      if (fileName && (processedFileContent || fileContent)) {
        await chatStorage.createAttachment(userMessage.id, fileName, "text", processedFileContent || fileContent);
      }

      const knowledgeResults = await chatStorage.searchKnowledgeBase(content);
      let knowledgeContext = "";
      if (knowledgeResults.length > 0) {
        knowledgeContext = knowledgeResults.map(kb => 
          `---\nDocumento: ${kb.title}\nAutor: ${kb.author}\nCategoria: ${kb.category}\nConteúdo: ${kb.content}\n---`
        ).join("\n\n");
      }

      let diagnosticContext: any = undefined;
      
      const diagnosticKeywords = ['canvas', 'swot', 'pdca', 'processo', 'requisito', 'diagnóstico', 'análise', 'forças', 'fraquezas', 'oportunidades', 'ameaças', 'melhoria', 'ciclo', 'modelo de negócio', 'bmca', 'proposta de valor'];
      const shouldFetchDiagnostics = diagnosticKeywords.some(keyword => 
        content.toLowerCase().includes(keyword)
      );

      if (shouldFetchDiagnostics && tenantId) {
        try {
          const isMember = await compassStorage.isUserInTenant(userId, tenantId);
          
          if (isMember) {
            let validProjectId: number | undefined = undefined;
            
            if (projectId) {
              const project = await compassStorage.getProject(projectId, tenantId);
              if (project) {
                validProjectId = projectId;
              }
            }

            diagnosticContext = {};
            
            const tenant = await compassStorage.getTenant(tenantId);
            if (tenant) {
              diagnosticContext.tenantName = tenant.name;
            }

            if (validProjectId) {
              const project = await compassStorage.getProject(validProjectId, tenantId);
              if (project) {
                diagnosticContext.projectName = project.name;
              }
              
              const canvasBlocks = await compassStorage.getCanvasBlocks(validProjectId);
              if (canvasBlocks.length > 0) {
                diagnosticContext.canvas = canvasBlocks;
              }

              const swotAnalyses = await compassStorage.getSwotAnalyses(validProjectId);
              if (swotAnalyses.length > 0) {
                const allSwotItems: any[] = [];
                for (const analysis of swotAnalyses) {
                  const items = await compassStorage.getSwotItems(analysis.id);
                  allSwotItems.push(...items);
                }
                diagnosticContext.swot = { analyses: swotAnalyses, items: allSwotItems };
              }

              const processes = await compassStorage.getProcesses(validProjectId);
              if (processes.length > 0) {
                const allSteps: any[] = [];
                for (const process of processes) {
                  const steps = await compassStorage.getProcessSteps(process.id);
                  allSteps.push(...steps);
                }
                diagnosticContext.processes = { processes, steps: allSteps };
              }
            }

            const pdcaCycles = await compassStorage.getPdcaCycles(tenantId, validProjectId);
            if (pdcaCycles.length > 0) {
              const allActions: any[] = [];
              for (const cycle of pdcaCycles) {
                const actions = await compassStorage.getPdcaActions(cycle.id);
                allActions.push(...actions);
              }
              diagnosticContext.pdca = { cycles: pdcaCycles, actions: allActions };
            }

            const requirements = await compassStorage.getRequirements(tenantId, validProjectId);
            if (requirements.length > 0) {
              diagnosticContext.requirements = requirements;
            }

            if (Object.keys(diagnosticContext).filter(k => k !== 'tenantName' && k !== 'projectName').length === 0) {
              diagnosticContext = undefined;
            }
          }
        } catch (e) {
          console.error("Error fetching diagnostic context:", e);
        }
      }

      const systemPrompt = buildPromptWithContext(knowledgeContext, processedFileContent || fileContent, diagnosticContext);

      const messages = await chatStorage.getMessagesByConversation(conversationId);
      const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: chatMessages,
        stream: true,
        max_tokens: 4096,
      });

      let fullResponse = "";

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      let interactionId: number | undefined;
      try {
        interactionId = await learningService.saveInteraction({
          userId,
          tenantId: tenantId || undefined,
          source: 'agent_chat',
          sessionId: conversationId.toString(),
          question: content,
          answer: fullResponse,
          context: diagnosticContext ? { diagnostics: true } : undefined,
          dataSourcesAccessed: knowledgeResults.length > 0 ? ['knowledge_base'] : undefined,
        });
      } catch (err) {
        console.error("[Learning] Error saving chat interaction:", err);
      }

      const assistantMessage = await chatStorage.createMessage(conversationId, "assistant", fullResponse, interactionId);

      res.write(`data: ${JSON.stringify({ done: true, messageId: assistantMessage.id, interactionId })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error sending message:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to send message" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to send message" });
      }
    }
  });

  app.get("/api/knowledge-base", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const entries = await chatStorage.getAllKnowledgeBase();
      res.json(entries);
    } catch (error) {
      console.error("Error fetching knowledge base:", error);
      res.status(500).json({ error: "Failed to fetch knowledge base" });
    }
  });

  app.post("/api/knowledge-base", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const { title, content, author, category, source } = req.body;
      
      if (!title || !content || !author || !category) {
        return res.status(400).json({ error: "Missing required fields: title, content, author, category" });
      }
      
      const entry = await chatStorage.createKnowledgeBaseEntry({ title, content, author, category, source });
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating knowledge base entry:", error);
      res.status(500).json({ error: "Failed to create knowledge base entry" });
    }
  });

  app.delete("/api/knowledge-base/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const id = parseInt(req.params.id);
      await chatStorage.deleteKnowledgeBaseEntry(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting knowledge base entry:", error);
      res.status(500).json({ error: "Failed to delete knowledge base entry" });
    }
  });

  app.post("/api/agent/chat", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const { message, conversationHistory = [] } = req.body;
      
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }
      
      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        {
          role: "system",
          content: `Você é o Arcádia Agent, um assistente inteligente de negócios especializado em gestão de projetos, metodologias ágeis (Scrum/Kanban), consultoria empresarial e análise de dados. Você ajuda profissionais a:
- Gerenciar tarefas e sprints de projetos
- Aplicar metodologias ágeis corretamente
- Analisar problemas de gestão e propor soluções
- Criar estimativas de esforço e custo
- Melhorar processos e produtividade

Responda de forma clara, objetiva e prática. Use exemplos quando apropriado.`
        }
      ];
      
      for (const msg of conversationHistory) {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
      
      messages.push({ role: "user", content: message });
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        max_tokens: 2048,
        temperature: 0.7,
      });
      
      const responseContent = completion.choices[0]?.message?.content || "Desculpe, não consegui gerar uma resposta.";
      
      res.json({ response: responseContent });
    } catch (error) {
      console.error("Error in agent chat:", error);
      res.status(500).json({ error: "Failed to process chat request" });
    }
  });

  // Save Manus result to conversation history (idempotent via runId)
  app.post("/api/conversations/:id/manus-result", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const conversationId = parseInt(req.params.id);
      const userId = req.user!.id;
      const { userMessage, assistantMessage, runId, includeUserMessage } = req.body;

      const conversation = await chatStorage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      if (conversation.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Check if this runId was already saved (idempotency) using metadata pattern
      const existingMessages = await chatStorage.getMessagesByConversation(conversationId);
      const alreadySaved = existingMessages.some(m => 
        m.role === "assistant" && m.content?.startsWith(assistantMessage?.substring(0, 100))
      );
      
      if (alreadySaved && runId) {
        return res.json({ success: true, alreadySaved: true });
      }

      // Only save user message if explicitly requested (for new conversations)
      if (includeUserMessage && userMessage) {
        await chatStorage.createMessage(conversationId, "user", userMessage);
      }
      
      // Save assistant message (clean, no markers)
      const savedMessage = await chatStorage.createMessage(
        conversationId, 
        "assistant", 
        assistantMessage
      );

      res.json({ success: true, messageId: savedMessage.id });
    } catch (error) {
      console.error("Error saving Manus result:", error);
      res.status(500).json({ error: "Failed to save result" });
    }
  });

  // Unified Agent endpoint - auto-detects if message needs tools (Manus) or simple chat
  app.post("/api/agent/unified", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const { content, conversationId, attachedFiles } = req.body;
      const userId = req.user!.id;
      
      if (!content || typeof content !== "string") {
        return res.status(400).json({ error: "Content is required" });
      }

      // Keywords that indicate the message needs Manus tools
      const toolKeywords = [
        // Actions
        'gerar relatório', 'criar relatório', 'exportar', 'enviar para', 
        'pesquisar', 'buscar na web', 'calcular', 'analisar dados',
        'comparar com', 'pesquisa de mercado', 'agendar', 'criar gráfico',
        // ERP/BI
        'consultar erp', 'consulta erp', 'dados do erp', 'vendas', 'estoque',
        'notas fiscais', 'clientes', 'fornecedores', 'financeiro',
        'dataset', 'bi', 'dashboard',
        // Knowledge
        'base de conhecimento', 'documentos', 'aprender',
        // Excel
        'excel', 'planilha', 'xlsx',
        // Complex analysis with files
        'analisar arquivo', 'processar arquivo', 'extrair dados'
      ];

      // Check if message contains tool keywords or has attached files
      const contentLower = content.toLowerCase();
      const needsTools = toolKeywords.some(kw => contentLower.includes(kw)) || 
                        (attachedFiles && attachedFiles.length > 0 && 
                         (contentLower.includes('analis') || contentLower.includes('process') || 
                          contentLower.includes('relat') || contentLower.includes('export')));

      res.json({ 
        mode: needsTools ? 'manus' : 'chat',
        needsTools 
      });
    } catch (error) {
      console.error("Error in unified agent:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  });
}
