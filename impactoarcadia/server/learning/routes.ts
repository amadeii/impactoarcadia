import type { Express, Request, Response } from "express";
import { learningService, startPatternDetectionJob, runPatternDetectionNow, startIndexingJob } from "./service";

interface CollectorEvent {
  type: string;
  module: string;
  data: Record<string, any>;
  timestamp: number;
  sessionId: string;
}

export function registerLearningRoutes(app: Express): void {
  app.post("/api/collector/events", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const userId = req.user!.id;
      const { events } = req.body as { events: CollectorEvent[] };

      if (!events || !Array.isArray(events)) {
        return res.status(400).json({ error: "events array is required" });
      }

      const savedCount = await learningService.saveEvents(userId, events);
      
      console.log(`[Collector] Saved ${savedCount} events for user ${userId}`);
      res.json({ success: true, count: savedCount });
    } catch (error) {
      console.error("Error saving collector events:", error);
      res.status(500).json({ error: "Failed to save events" });
    }
  });

  app.get("/api/collector/events", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const limit = parseInt(req.query.limit as string) || 100;
      const eventType = req.query.type as string | undefined;
      const events = await learningService.getEvents(limit, eventType);
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.get("/api/collector/stats", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const stats = await learningService.getEventStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching event stats:", error);
      res.status(500).json({ error: "Failed to fetch event stats" });
    }
  });

  app.post("/api/learning/navigation", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const userId = req.user!.id;
      const { module, action, metadata } = req.body;
      
      if (!module || !action) {
        return res.status(400).json({ error: "module and action are required" });
      }

      const question = `Navegação: ${action} em ${module}`;
      const answer = metadata ? JSON.stringify(metadata) : `Usuário acessou ${module}`;

      await learningService.saveInteraction({
        userId,
        source: 'navigation',
        sessionId: `nav_${Date.now()}`,
        question,
        answer,
        toolsUsed: [module],
        context: metadata,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking navigation:", error);
      res.status(500).json({ error: "Failed to track navigation" });
    }
  });
  app.get("/api/learning/stats", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const stats = await learningService.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching learning stats:", error);
      res.status(500).json({ error: "Failed to fetch learning stats" });
    }
  });

  app.get("/api/learning/interactions", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const limit = parseInt(req.query.limit as string) || 50;
      const interactions = await learningService.getRecentInteractions(limit);
      res.json(interactions);
    } catch (error) {
      console.error("Error fetching interactions:", error);
      res.status(500).json({ error: "Failed to fetch interactions" });
    }
  });

  app.get("/api/learning/patterns", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const patterns = await learningService.getActivePatterns();
      res.json(patterns);
    } catch (error) {
      console.error("Error fetching patterns:", error);
      res.status(500).json({ error: "Failed to fetch patterns" });
    }
  });

  app.get("/api/learning/codes", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const codeType = req.query.type as string | undefined;
      const codes = await learningService.getGeneratedCodes(codeType);
      res.json(codes);
    } catch (error) {
      console.error("Error fetching codes:", error);
      res.status(500).json({ error: "Failed to fetch codes" });
    }
  });

  app.post("/api/learning/patterns", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const { name, description, patternType, sourceDataset, sourceTable, pattern, confidence } = req.body;
      if (!name || !patternType || !pattern) {
        return res.status(400).json({ error: "name, patternType, and pattern are required" });
      }
      const id = await learningService.savePattern({
        name,
        description,
        patternType,
        sourceDataset,
        sourceTable,
        pattern,
        confidence,
      });
      res.status(201).json({ id });
    } catch (error) {
      console.error("Error saving pattern:", error);
      res.status(500).json({ error: "Failed to save pattern" });
    }
  });

  app.post("/api/learning/codes", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const { name, description, language, codeType, code, parameters, generatedFrom } = req.body;
      if (!name || !codeType || !code) {
        return res.status(400).json({ error: "name, codeType, and code are required" });
      }
      const id = await learningService.saveGeneratedCode({
        name,
        description,
        language,
        codeType,
        code,
        parameters,
        generatedFrom,
      });
      res.status(201).json({ id });
    } catch (error) {
      console.error("Error saving code:", error);
      res.status(500).json({ error: "Failed to save code" });
    }
  });

  app.post("/api/learning/interactions/:id/feedback", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const { feedback } = req.body;
      if (!['positive', 'negative', 'neutral'].includes(feedback)) {
        return res.status(400).json({ error: "feedback must be 'positive', 'negative', or 'neutral'" });
      }
      await learningService.updateInteractionFeedback(id, feedback);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating feedback:", error);
      res.status(500).json({ error: "Failed to update feedback" });
    }
  });

  app.post("/api/learning/index", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const result = await learningService.indexInteractionsToChromaDB();
      res.json(result);
    } catch (error) {
      console.error("Error indexing:", error);
      res.status(500).json({ error: "Failed to index interactions" });
    }
  });

  app.post("/api/learning/search", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ error: "query is required" });
      }
      const results = await learningService.searchSimilarInteractions(query);
      res.json(results);
    } catch (error) {
      console.error("Error searching:", error);
      res.status(500).json({ error: "Failed to search interactions" });
    }
  });

  app.post("/api/learning/capture", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const userId = req.user!.id;
      const { url, appName, extractRequirements, context } = req.body;

      if (!url) {
        return res.status(400).json({ error: "url is required" });
      }

      const { spawn } = await import('child_process');
      const path = await import('path');
      
      const scriptPath = path.join(process.cwd(), 'python-service', 'scripts', 'run_capture.py');
      const args = [scriptPath, url, '--wait', '2000'];
      if (extractRequirements) {
        args.push('--extract');
        if (context) {
          args.push('--context', context);
        }
      }

      const captureResult = await new Promise<any>((resolve, reject) => {
        const proc = spawn('python3', args, {
          timeout: 45000,
          cwd: process.cwd()
        });
        
        let stdout = '';
        let stderr = '';
        
        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });
        
        proc.on('close', (code) => {
          if (code === 0 && stdout) {
            try {
              resolve(JSON.parse(stdout.trim()));
            } catch (e) {
              reject(new Error(`Failed to parse output: ${stdout}`));
            }
          } else {
            reject(new Error(stderr || `Process exited with code ${code}`));
          }
        });
        
        proc.on('error', (err) => reject(err));
        
        setTimeout(() => {
          proc.kill();
          reject(new Error('Capture timeout (45s)'));
        }, 45000);
      });

      if (!captureResult.success) {
        return res.status(500).json(captureResult);
      }

      const interactionId = await learningService.saveInteraction({
        userId,
        source: 'web_capture',
        sessionId: `capture_${Date.now()}`,
        question: `Captura de conhecimento: ${captureResult.title || url}`,
        answer: captureResult.text_content?.substring(0, 5000) || '',
        toolsUsed: ['web_capture', 'httpx'],
        context: {
          url,
          appName,
          title: captureResult.title,
          headings: captureResult.headings,
          links: captureResult.links?.slice(0, 10),
          images: captureResult.images?.slice(0, 10),
          meta: captureResult.meta,
          extraction: captureResult.extraction,
          word_count: captureResult.word_count,
          captured_at: captureResult.captured_at
        }
      });

      res.json({
        success: true,
        interactionId,
        title: captureResult.title,
        word_count: captureResult.word_count,
        headings_count: captureResult.headings?.length || 0,
        links_count: captureResult.links?.length || 0,
        images_count: captureResult.images?.length || 0,
        extraction: captureResult.extraction,
        screenshot_base64: captureResult.screenshot_base64
      });
    } catch (error) {
      console.error("Error capturing URL:", error);
      res.status(500).json({ error: "Failed to capture URL" });
    }
  });

  app.get("/api/learning/captures", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const captures = await learningService.getRecentInteractions(30);
      const webCaptures = captures.filter((c: any) => c.source === 'web_capture');
      res.json(webCaptures);
    } catch (error) {
      console.error("Error fetching captures:", error);
      res.status(500).json({ error: "Failed to fetch captures" });
    }
  });

  app.post("/api/learning/learn-url", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const userId = req.user!.id;
      const { url, priority } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: "url is required" });
      }

      const { spawn } = await import('child_process');
      const path = await import('path');
      const captureScript = path.join(process.cwd(), 'python-service', 'scripts', 'run_capture.py');
      const proc = spawn('python3', [captureScript, url]);
      
      const captureResult: any = await new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';
        
        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });
        
        proc.on('close', (code) => {
          if (code === 0 && stdout) {
            try {
              resolve(JSON.parse(stdout.trim()));
            } catch (e) {
              reject(new Error(`Failed to parse output: ${stdout}`));
            }
          } else {
            reject(new Error(stderr || `Process exited with code ${code}`));
          }
        });
        
        proc.on('error', (err) => reject(err));
        
        setTimeout(() => {
          proc.kill();
          reject(new Error('Capture timeout (45s)'));
        }, 45000);
      });

      if (!captureResult.success) {
        return res.status(500).json(captureResult);
      }

      const nodeId = `url_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const textContent = captureResult.text_content || '';

      try {
        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || "http://localhost:8001";
        await fetch(`${pythonServiceUrl}/documents/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            doc_id: nodeId,
            document: textContent.substring(0, 10000),
            metadata: {
              type: 'url_learned',
              url,
              title: captureResult.title,
              priority: priority || 'normal',
              userId,
              capturedAt: new Date().toISOString()
            }
          })
        });
      } catch (embeddingError) {
        console.warn("Embedding service unavailable, continuing without embeddings:", embeddingError);
      }

      await learningService.saveInteraction({
        userId,
        source: 'url_learned',
        sessionId: `learn_${nodeId}`,
        question: `Aprendizado de URL: ${captureResult.title || url}`,
        answer: textContent.substring(0, 5000),
        toolsUsed: ['learn_url', 'web_capture'],
        context: {
          url,
          nodeId,
          title: captureResult.title,
          priority: priority || 'normal',
          headings: captureResult.headings?.slice(0, 10),
          word_count: captureResult.word_count
        }
      });

      res.json({
        success: true,
        nodeId,
        title: captureResult.title,
        contentLength: textContent.length,
        priority: priority || 'normal'
      });
    } catch (error) {
      console.error("Error learning URL:", error);
      res.status(500).json({ error: "Failed to learn URL" });
    }
  });

  app.post("/api/learning/detect-patterns", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const result = await runPatternDetectionNow();
      res.json({ success: true, patternsDetected: result.detected });
    } catch (error) {
      console.error("Error running pattern detection:", error);
      res.status(500).json({ error: "Failed to run pattern detection" });
    }
  });

  startIndexingJob(60000);
  startPatternDetectionJob(300000);
  console.log("[Learning] Background jobs started (indexing: 60s, pattern detection: 300s)");
}
