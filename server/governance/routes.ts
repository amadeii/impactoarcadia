import { Router, type Request, type Response } from "express";
import { governanceService } from "./service";
import { jobQueueService } from "./jobQueue";
import { runPolicyTests } from "./policyTests";

const router = Router();

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const stats = await governanceService.getGovernanceStats();
    res.json(stats);
  } catch (error) {
    console.error("Error fetching governance stats:", error);
    res.status(500).json({ error: "Failed to fetch governance stats" });
  }
});

router.get("/policies", async (_req: Request, res: Response) => {
  try {
    const policies = await governanceService.getPolicies();
    res.json(policies);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch policies" });
  }
});

router.post("/policies", async (req: Request, res: Response) => {
  try {
    const { name, scope, target, effect, conditions, priority, description } = req.body;
    if (!name || !scope || !target || !effect) {
      return res.status(400).json({ error: "name, scope, target, effect are required" });
    }
    const policy = await governanceService.createPolicy({
      name, scope, target, effect,
      conditions: conditions || {},
      priority: priority || 100,
      description: description || null,
    });
    res.status(201).json(policy);
  } catch (error) {
    res.status(500).json({ error: "Failed to create policy" });
  }
});

router.post("/evaluate", async (req: Request, res: Response) => {
  try {
    const { agent, action, target, context } = req.body;
    if (!agent || !action || !target) {
      return res.status(400).json({ error: "agent, action, target are required" });
    }
    const result = await governanceService.evaluatePolicy(agent, action, target, context);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to evaluate policy" });
  }
});

router.get("/contracts", async (_req: Request, res: Response) => {
  try {
    const contracts = await governanceService.getContracts();
    res.json(contracts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch contracts" });
  }
});

router.post("/contracts", async (req: Request, res: Response) => {
  try {
    const { name, action, description, inputSchema, outputSchema, requiredPermissions, category } = req.body;
    if (!name || !action) {
      return res.status(400).json({ error: "name, action are required" });
    }
    const contract = await governanceService.registerContract({
      name, action,
      description: description || null,
      inputSchema: inputSchema || null,
      outputSchema: outputSchema || null,
      requiredPermissions: requiredPermissions || [],
      category: category || null,
    });
    res.status(201).json(contract);
  } catch (error) {
    res.status(500).json({ error: "Failed to create contract" });
  }
});

router.get("/tools", async (_req: Request, res: Response) => {
  try {
    const tools = await governanceService.getTools();
    res.json(tools);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tools" });
  }
});

router.get("/skills", async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const skills = await governanceService.getSkills(status);
    res.json(skills);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch skills" });
  }
});

router.post("/skills", async (req: Request, res: Response) => {
  try {
    const { name, version, description, steps, tools, inputSchema, outputSchema, createdBy } = req.body;
    if (!name || !version) {
      return res.status(400).json({ error: "name, version are required" });
    }
    const skill = await governanceService.createSkill({
      name, version,
      description: description || null,
      steps: steps || null,
      tools: tools || [],
      inputSchema: inputSchema || null,
      outputSchema: outputSchema || null,
      createdBy: createdBy || "system",
    });
    res.status(201).json(skill);
  } catch (error) {
    res.status(500).json({ error: "Failed to create skill" });
  }
});

router.get("/skills/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const skill = await governanceService.getSkill(id);
    if (!skill) return res.status(404).json({ error: "Skill not found" });
    res.json(skill);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch skill" });
  }
});

router.delete("/skills/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    await governanceService.deactivateSkill(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to deactivate skill" });
  }
});

router.get("/audit", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const agentName = req.query.agent as string | undefined;
    const trail = await governanceService.getAuditTrail(limit, agentName);
    res.json(trail);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch audit trail" });
  }
});

router.get("/jobs", async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const jobs = await jobQueueService.getJobs(status, limit);
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

router.get("/jobs/stats", async (_req: Request, res: Response) => {
  try {
    const stats = await jobQueueService.getJobStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch job stats" });
  }
});

router.post("/jobs", async (req: Request, res: Response) => {
  try {
    const { type, priority, payload, scheduledAt, maxAttempts, createdBy, parentJobId, metadata } = req.body;
    if (!type) return res.status(400).json({ error: "type is required" });
    const job = await jobQueueService.enqueue({
      type,
      priority: priority || 50,
      payload: payload || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      maxAttempts: maxAttempts || 3,
      createdBy: createdBy || "api",
      parentJobId: parentJobId || null,
      metadata: metadata || null,
    });
    res.status(201).json(job);
  } catch (error) {
    res.status(500).json({ error: "Failed to enqueue job" });
  }
});

router.post("/jobs/:id/cancel", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    await jobQueueService.cancelJob(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to cancel job" });
  }
});

router.post("/jobs/:id/retry", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const retried = await jobQueueService.retryJob(id);
    res.json({ success: retried });
  } catch (error) {
    res.status(500).json({ error: "Failed to retry job" });
  }
});

router.get("/metrics", async (req: Request, res: Response) => {
  try {
    const agent = req.query.agent as string | undefined;
    const limit = parseInt(req.query.limit as string) || 100;
    const metrics = await jobQueueService.getAgentMetrics(agent, limit);
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
});

router.get("/metrics/summary", async (_req: Request, res: Response) => {
  try {
    const summary = await jobQueueService.getAgentSummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch metrics summary" });
  }
});

router.get("/policy-tests", async (_req: Request, res: Response) => {
  try {
    const results = await runPolicyTests();
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "Failed to run policy tests" });
  }
});

router.post("/tools/:id/rbac", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const { allowedAgents } = req.body;
    if (!Array.isArray(allowedAgents)) {
      return res.status(400).json({ error: "allowedAgents must be an array" });
    }
    await governanceService.updateToolRBAC(id, allowedAgents);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update tool RBAC" });
  }
});

router.get("/dashboard", async (_req: Request, res: Response) => {
  try {
    const [govStats, jobStats, agentSummary, recentAudit, policies, skills] = await Promise.all([
      governanceService.getGovernanceStats(),
      jobQueueService.getJobStats(),
      jobQueueService.getAgentSummary(),
      governanceService.getAuditTrail(20),
      governanceService.getPolicies(),
      governanceService.getSkills("active"),
    ]);

    res.json({
      governance: govStats,
      jobs: jobStats,
      agents: agentSummary,
      recentAudit,
      policies,
      skills,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

export default router;
