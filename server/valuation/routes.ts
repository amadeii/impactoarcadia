import { Router } from "express";
import { z } from "zod";
import { valuationStorage } from "./storage";
import { compassStorage } from "../compass/storage";
import {
  insertValuationProjectSchema,
  insertValuationInputSchema,
  insertValuationAssumptionSchema,
  insertValuationCalculationSchema,
  insertValuationMaturityScoreSchema,
  insertValuationCapTableSchema,
  insertValuationTransactionSchema,
  insertValuationDocumentSchema,
  insertValuationCanvasSchema,
  insertValuationAgentInsightSchema,
  insertValuationGovernanceSchema,
  insertValuationPdcaSchema,
  insertValuationSwotSchema,
  insertValuationAssetSchema,
} from "@shared/schema";
import {
  runFullValuation,
  sensitivityAnalysis,
  calculateWACC,
  calculateGovernanceImpact,
  generateProjections,
  calculateScenarioWeighted,
  type FinancialData,
  type AssumptionData,
  type GovernanceCriterion,
} from "./engine";
import { GOVERNANCE_CRITERIA, CHECKLIST_ITEMS, CANVAS_BLOCKS } from "./constants";
import multer from "multer";
import * as XLSX from "xlsx";
import OpenAI from "openai";
import fs from "fs";
import pathModule from "path";

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

async function getUserTenantId(req: any): Promise<number | null> {
  const userId = req.user?.id;
  if (!userId) return null;
  
  const headerTenantId = req.headers["x-tenant-id"];
  if (headerTenantId) {
    const tenantId = parseInt(headerTenantId as string);
    const isMember = await compassStorage.isUserInTenant(userId, tenantId);
    return isMember ? tenantId : null;
  }
  
  const tenants = await compassStorage.getUserTenants(userId);
  return tenants.length > 0 ? tenants[0].id : null;
}

// ========== PROJECTS ==========
router.get("/projects", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const projects = await valuationStorage.getProjects(tenantId);
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

router.get("/projects/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

router.post("/projects", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const data = insertValuationProjectSchema.parse({ ...req.body, tenantId, consultantId: req.user.id });
    const project = await valuationStorage.createProject(data);
    res.status(201).json(project);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to create project" });
  }
});

router.patch("/projects/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const data = insertValuationProjectSchema.partial().parse(req.body);
    delete (data as any).tenantId;
    const project = await valuationStorage.updateProject(Number(req.params.id), tenantId, data);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update project" });
  }
});

router.delete("/projects/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const deleted = await valuationStorage.deleteProject(Number(req.params.id), tenantId);
    if (!deleted) return res.status(404).json({ error: "Project not found" });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete project" });
  }
});

// ========== INPUTS ==========
router.get("/projects/:projectId/inputs", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const inputs = await valuationStorage.getInputs(project.id);
    res.json(inputs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch inputs" });
  }
});

router.post("/projects/:projectId/inputs", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const data = insertValuationInputSchema.parse({ ...req.body, projectId: project.id });
    const input = await valuationStorage.createInput(data);
    res.status(201).json(input);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to create input" });
  }
});

router.patch("/projects/:projectId/inputs/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const data = insertValuationInputSchema.partial().parse(req.body);
    delete (data as any).projectId;
    const input = await valuationStorage.updateInput(Number(req.params.id), project.id, data);
    if (!input) return res.status(404).json({ error: "Input not found" });
    res.json(input);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update input" });
  }
});

router.delete("/projects/:projectId/inputs/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const deleted = await valuationStorage.deleteInput(Number(req.params.id), project.id);
    if (!deleted) return res.status(404).json({ error: "Input not found" });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete input" });
  }
});

// ========== ASSUMPTIONS ==========
router.get("/projects/:projectId/assumptions", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const assumptions = await valuationStorage.getAssumptions(project.id);
    res.json(assumptions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch assumptions" });
  }
});

router.post("/projects/:projectId/assumptions", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const data = insertValuationAssumptionSchema.parse({ ...req.body, projectId: project.id });
    const assumption = await valuationStorage.createAssumption(data);
    res.status(201).json(assumption);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to create assumption" });
  }
});

router.patch("/projects/:projectId/assumptions/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const data = insertValuationAssumptionSchema.partial().parse(req.body);
    delete (data as any).projectId;
    const assumption = await valuationStorage.updateAssumption(Number(req.params.id), project.id, data);
    if (!assumption) return res.status(404).json({ error: "Assumption not found" });
    res.json(assumption);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update assumption" });
  }
});

router.delete("/projects/:projectId/assumptions/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const deleted = await valuationStorage.deleteAssumption(Number(req.params.id), project.id);
    if (!deleted) return res.status(404).json({ error: "Assumption not found" });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete assumption" });
  }
});

// ========== CALCULATIONS ==========
router.get("/projects/:projectId/calculations", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const calculations = await valuationStorage.getCalculations(project.id);
    res.json(calculations);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch calculations" });
  }
});

router.post("/projects/:projectId/calculations", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const data = insertValuationCalculationSchema.parse({ ...req.body, projectId: project.id, calculatedBy: req.user.id });
    const calculation = await valuationStorage.createCalculation(data);
    res.status(201).json(calculation);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to create calculation" });
  }
});

router.patch("/projects/:projectId/calculations/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const data = insertValuationCalculationSchema.partial().parse(req.body);
    delete (data as any).projectId;
    const calculation = await valuationStorage.updateCalculation(Number(req.params.id), project.id, data);
    if (!calculation) return res.status(404).json({ error: "Calculation not found" });
    res.json(calculation);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update calculation" });
  }
});

router.delete("/projects/:projectId/calculations/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const deleted = await valuationStorage.deleteCalculation(Number(req.params.id), project.id);
    if (!deleted) return res.status(404).json({ error: "Calculation not found" });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete calculation" });
  }
});

// ========== MATURITY SCORES ==========
router.get("/projects/:projectId/maturity", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const scores = await valuationStorage.getMaturityScores(project.id);
    res.json(scores);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch maturity scores" });
  }
});

router.post("/projects/:projectId/maturity", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const data = insertValuationMaturityScoreSchema.parse({ ...req.body, projectId: project.id });
    const score = await valuationStorage.createMaturityScore(data);
    res.status(201).json(score);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to create maturity score" });
  }
});

router.patch("/projects/:projectId/maturity/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const data = insertValuationMaturityScoreSchema.partial().parse(req.body);
    delete (data as any).projectId;
    const score = await valuationStorage.updateMaturityScore(Number(req.params.id), project.id, data);
    if (!score) return res.status(404).json({ error: "Maturity score not found" });
    res.json(score);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update maturity score" });
  }
});

// ========== CAP TABLE ==========
router.get("/projects/:projectId/captable", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const entries = await valuationStorage.getCapTable(project.id);
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch cap table" });
  }
});

router.post("/projects/:projectId/captable", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const data = insertValuationCapTableSchema.parse({ ...req.body, projectId: project.id });
    const entry = await valuationStorage.createCapTableEntry(data);
    res.status(201).json(entry);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to create cap table entry" });
  }
});

router.patch("/projects/:projectId/captable/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const data = insertValuationCapTableSchema.partial().parse(req.body);
    delete (data as any).projectId;
    const entry = await valuationStorage.updateCapTableEntry(Number(req.params.id), project.id, data);
    if (!entry) return res.status(404).json({ error: "Cap table entry not found" });
    res.json(entry);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update cap table entry" });
  }
});

router.delete("/projects/:projectId/captable/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const deleted = await valuationStorage.deleteCapTableEntry(Number(req.params.id), project.id);
    if (!deleted) return res.status(404).json({ error: "Cap table entry not found" });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete cap table entry" });
  }
});

// ========== TRANSACTIONS ==========
router.get("/projects/:projectId/transactions", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const transactions = await valuationStorage.getTransactions(project.id);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

router.post("/projects/:projectId/transactions", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const data = insertValuationTransactionSchema.parse({ ...req.body, projectId: project.id });
    const transaction = await valuationStorage.createTransaction(data);
    res.status(201).json(transaction);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to create transaction" });
  }
});

router.patch("/projects/:projectId/transactions/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const data = insertValuationTransactionSchema.partial().parse(req.body);
    delete (data as any).projectId;
    const transaction = await valuationStorage.updateTransaction(Number(req.params.id), project.id, data);
    if (!transaction) return res.status(404).json({ error: "Transaction not found" });
    res.json(transaction);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update transaction" });
  }
});

router.delete("/projects/:projectId/transactions/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const deleted = await valuationStorage.deleteTransaction(Number(req.params.id), project.id);
    if (!deleted) return res.status(404).json({ error: "Transaction not found" });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete transaction" });
  }
});

// ========== DOCUMENTS ==========
router.get("/projects/:projectId/documents", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const documents = await valuationStorage.getDocuments(project.id);
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

router.post("/projects/:projectId/documents", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const data = insertValuationDocumentSchema.parse({ ...req.body, projectId: project.id, uploadedBy: req.user.id });
    const document = await valuationStorage.createDocument(data);
    res.status(201).json(document);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to create document" });
  }
});

router.delete("/projects/:projectId/documents/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const deleted = await valuationStorage.deleteDocument(Number(req.params.id), project.id);
    if (!deleted) return res.status(404).json({ error: "Document not found" });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete document" });
  }
});

// Document upload with file
const documentUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = "uploads/valuation_documents";
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + "-" + file.originalname);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/pdf",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
      "application/json",
      "application/xml",
      "text/xml",
      "image/jpeg",
      "image/png",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type"));
    }
  },
});

router.post("/projects/:projectId/documents/upload", requireAuth, documentUpload.single("file"), async (req: any, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    const document = await valuationStorage.createDocument({
      projectId: project.id,
      name: req.file.originalname,
      folder: req.body.documentType || "other",
      fileUrl: req.file.path,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedBy: req.user.id,
    });
    res.status(201).json(document);
  } catch (error) {
    res.status(500).json({ error: "Failed to upload document" });
  }
});

router.get("/projects/:projectId/documents/:id/download", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    
    const document = await valuationStorage.getDocument(Number(req.params.id), project.id);
    if (!document || !document.fileUrl) {
      return res.status(404).json({ error: "Document not found" });
    }
    res.download(document.fileUrl, document.name || "download");
  } catch (error) {
    res.status(500).json({ error: "Failed to download document" });
  }
});

// ========== CANVAS ==========
router.get("/projects/:projectId/canvas", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const canvas = await valuationStorage.getCanvas(project.id);
    res.json(canvas);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch canvas" });
  }
});

router.post("/projects/:projectId/canvas", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const data = insertValuationCanvasSchema.parse({ ...req.body, projectId: project.id });
    const block = await valuationStorage.createCanvasBlock(data);
    res.status(201).json(block);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to create canvas block" });
  }
});

router.patch("/projects/:projectId/canvas/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const data = insertValuationCanvasSchema.partial().parse(req.body);
    delete (data as any).projectId;
    const block = await valuationStorage.updateCanvasBlock(Number(req.params.id), project.id, data);
    if (!block) return res.status(404).json({ error: "Canvas block not found" });
    res.json(block);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update canvas block" });
  }
});

// ========== AGENT INSIGHTS ==========
router.get("/projects/:projectId/insights", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const insights = await valuationStorage.getAgentInsights(project.id);
    res.json(insights);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch insights" });
  }
});

router.post("/projects/:projectId/insights", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const data = insertValuationAgentInsightSchema.parse({ ...req.body, projectId: project.id });
    const insight = await valuationStorage.createAgentInsight(data);
    res.status(201).json(insight);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to create insight" });
  }
});

router.patch("/projects/:projectId/insights/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const data = insertValuationAgentInsightSchema.partial().parse(req.body);
    delete (data as any).projectId;
    const insight = await valuationStorage.updateAgentInsight(Number(req.params.id), project.id, data);
    if (!insight) return res.status(404).json({ error: "Insight not found" });
    res.json(insight);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update insight" });
  }
});

// ========== CRM CLIENTS (for Valuation) ==========
router.get("/crm-clients", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const search = req.query.search as string | undefined;
    const clients = await valuationStorage.getCrmClients(tenantId, search);
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch CRM clients" });
  }
});

router.get("/crm-clients/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const client = await valuationStorage.getCrmClient(Number(req.params.id), tenantId);
    if (!client) return res.status(404).json({ error: "Client not found" });
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch CRM client" });
  }
});

// ========== FINANCIAL DATA IMPORT ==========
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post("/projects/:projectId/import-financial", requireAuth, upload.single("file"), async (req: any, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    
    const buffer = req.file.buffer;
    const filename = req.file.originalname.toLowerCase();
    
    let rawData: any[] = [];
    
    if (filename.endsWith(".csv")) {
      const csvText = buffer.toString("utf-8");
      const lines = csvText.split("\n").filter((l: string) => l.trim());
      if (lines.length > 1) {
        const headers = lines[0].split(/[,;]/).map((h: string) => h.trim().toLowerCase());
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(/[,;]/);
          const row: any = {};
          headers.forEach((h: string, idx: number) => {
            row[h] = values[idx]?.trim() || "";
          });
          rawData.push(row);
        }
      }
    } else {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      rawData = XLSX.utils.sheet_to_json(sheet);
    }
    
    if (rawData.length === 0) {
      return res.status(400).json({ error: "No data found in file" });
    }
    
    const dataPreview = JSON.stringify(rawData.slice(0, 10), null, 2);
    
    const agentResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Você é um especialista em análise de demonstrações financeiras brasileiras. Analise os dados fornecidos e extraia informações financeiras estruturadas.

Retorne APENAS um JSON válido no formato:
{
  "analysis": "Breve análise dos dados encontrados (2-3 frases)",
  "rows": [
    {
      "year": 2023,
      "isProjection": 0,
      "revenue": "1000000",
      "ebitda": "200000",
      "netIncome": "150000",
      "totalAssets": "5000000",
      "totalEquity": "2000000"
    }
  ]
}

Campos possíveis: year, isProjection (0=realizado, 1=projeção), revenue (Receita), ebitda, netIncome (Lucro Líquido), totalAssets (Ativo Total), totalEquity (Patrimônio Líquido), totalLiabilities (Passivo Total), cash (Caixa), debt (Dívidas).

Converta valores de texto para números (ex: "1.234.567,89" -> "1234567.89").
Identifique o ano de cada linha pelos dados ou cabeçalhos.`
        },
        {
          role: "user",
          content: `Analise estes dados financeiros da empresa "${project.companyName}" e extraia as informações:\n\n${dataPreview}`
        }
      ],
      temperature: 0.1,
    });
    
    const content = agentResponse.choices[0]?.message?.content || "";
    
    let result = { analysis: "", rows: [] as any[] };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      result.analysis = "Não foi possível processar os dados automaticamente. Verifique o formato do arquivo.";
    }
    
    res.json(result);
  } catch (error) {
    console.error("Import error:", error);
    res.status(500).json({ error: "Failed to import financial data" });
  }
});

// ========== CHECKLIST ==========
router.get("/checklist/categories", requireAuth, async (req, res) => {
  try {
    const segment = req.query.segment as string | undefined;
    const categories = await valuationStorage.getChecklistCategories(segment);
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch checklist categories" });
  }
});

router.get("/checklist/items", requireAuth, async (req, res) => {
  try {
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const segment = req.query.segment as string | undefined;
    const items = await valuationStorage.getChecklistItems(categoryId, segment);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch checklist items" });
  }
});

router.get("/projects/:projectId/checklist", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    
    const progress = await valuationStorage.getChecklistProgress(Number(req.params.projectId));
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch checklist progress" });
  }
});

router.post("/projects/:projectId/checklist/initialize", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    
    const segmentMap: Record<string, string> = {
      "Tecnologia": "technology",
      "Fintech": "fintech",
      "E-commerce": "ecommerce",
      "Indústria": "industry",
      "Agronegócio": "agro",
    };
    const segment = segmentMap[project.sector] || "";
    
    const progress = await valuationStorage.initializeProjectChecklist(Number(req.params.projectId), segment);
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: "Failed to initialize checklist" });
  }
});

router.put("/projects/:projectId/checklist/:itemId", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    
    const userId = (req.user as any)?.id;
    const data = {
      projectId: Number(req.params.projectId),
      itemId: Number(req.params.itemId),
      status: req.body.status,
      notes: req.body.notes,
      documentId: req.body.documentId,
      dataJson: req.body.dataJson,
      agentAnalysis: req.body.agentAnalysis,
      completedAt: req.body.status === "completed" ? new Date() : undefined,
      completedBy: req.body.status === "completed" ? userId : undefined,
    };
    
    const progress = await valuationStorage.upsertChecklistProgress(data);
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: "Failed to update checklist progress" });
  }
});

router.post("/projects/:projectId/checklist/:itemId/agent-assist", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    
    const items = await valuationStorage.getChecklistItems();
    const item = items.find(i => i.id === Number(req.params.itemId));
    if (!item) return res.status(404).json({ error: "Item not found" });
    
    const { content, fileData } = req.body;
    
    const systemPrompt = item.agentPrompt || `Você é um especialista em valuation empresarial. Analise as informações fornecidas para o item "${item.title}" e forneça insights relevantes para a avaliação.`;
    
    const userContent = fileData 
      ? `Empresa: ${project.companyName}\nSetor: ${project.sector}\n\nDados do documento:\n${JSON.stringify(fileData, null, 2)}\n\nInformações adicionais:\n${content || "Nenhuma"}`
      : `Empresa: ${project.companyName}\nSetor: ${project.sector}\n\nInformações fornecidas:\n${content}`;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ],
      temperature: 0.3,
    });
    
    const analysis = response.choices[0]?.message?.content || "";
    
    await valuationStorage.upsertChecklistProgress({
      projectId: Number(req.params.projectId),
      itemId: Number(req.params.itemId),
      agentAnalysis: analysis,
      status: "in_progress",
    });
    
    res.json({ analysis });
  } catch (error) {
    console.error("Agent assist error:", error);
    res.status(500).json({ error: "Failed to get agent assistance" });
  }
});

// ========== CHECKLIST ATTACHMENTS ==========
const checklistUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = "uploads/checklist";
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + "-" + file.originalname);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/pdf",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
      "application/json",
      "text/xml",
      "application/xml",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/webp",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de arquivo não suportado"));
    }
  },
});

router.get("/projects/:projectId/checklist/:itemId/attachments", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    
    const progress = await valuationStorage.getChecklistProgressItem(
      Number(req.params.projectId),
      Number(req.params.itemId)
    );
    if (!progress) return res.json([]);
    
    const attachments = await valuationStorage.getChecklistAttachments(progress.id);
    res.json(attachments);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch attachments" });
  }
});

router.post("/projects/:projectId/checklist/:itemId/attachments", requireAuth, checklistUpload.single("file"), async (req: any, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    
    let progress = await valuationStorage.getChecklistProgressItem(
      Number(req.params.projectId),
      Number(req.params.itemId)
    );
    
    if (!progress) {
      progress = await valuationStorage.upsertChecklistProgress({
        projectId: Number(req.params.projectId),
        itemId: Number(req.params.itemId),
        status: "in_progress",
      });
    }
    
    const attachment = await valuationStorage.createChecklistAttachment({
      progressId: progress.id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      storagePath: req.file.path,
      uploadedBy: req.user?.id,
    });
    
    res.status(201).json(attachment);
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Failed to upload file" });
  }
});

router.delete("/projects/:projectId/checklist/:itemId/attachments/:attachmentId", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.projectId), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    
    const attachment = await valuationStorage.getChecklistAttachment(Number(req.params.attachmentId));
    if (!attachment) return res.status(404).json({ error: "Attachment not found" });
    
    if (fs.existsSync(attachment.storagePath)) {
      fs.unlinkSync(attachment.storagePath);
    }
    
    await valuationStorage.deleteChecklistAttachment(Number(req.params.attachmentId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete attachment" });
  }
});

router.get("/checklist/attachments/:id/download", requireAuth, async (req, res) => {
  try {
    const attachment = await valuationStorage.getChecklistAttachment(Number(req.params.id));
    if (!attachment) return res.status(404).json({ error: "Attachment not found" });
    
    res.download(attachment.storagePath, attachment.originalName);
  } catch (error) {
    res.status(500).json({ error: "Failed to download file" });
  }
});

// ========== SECTOR ANALYSIS ==========
router.get("/sector/benchmarks/:segment", requireAuth, async (req, res) => {
  try {
    const benchmarks = await valuationStorage.getSectorBenchmarks(req.params.segment);
    res.json(benchmarks);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch benchmarks" });
  }
});

router.get("/sector/weights/:segment", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    const weights = await valuationStorage.getCategoryWeights(tenantId, req.params.segment);
    res.json(weights);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch weights" });
  }
});

router.post("/sector/weights", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const weight = await valuationStorage.upsertCategoryWeight({ ...req.body, tenantId });
    res.json(weight);
  } catch (error) {
    res.status(500).json({ error: "Failed to save weight" });
  }
});

router.get("/projects/:id/sector-analysis", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    
    const latestScore = await valuationStorage.getLatestSectorScore(project.id);
    const allScores = await valuationStorage.getSectorScores(project.id);
    res.json({ latest: latestScore, history: allScores });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sector analysis" });
  }
});

router.post("/projects/:id/sector-analysis/calculate", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    
    const segment = project.sector?.toLowerCase().includes("indústria") ? "industry" : 
                    project.sector?.toLowerCase().includes("serviço") ? "services" :
                    project.sector?.toLowerCase().includes("varejo") ? "retail" :
                    project.sector?.toLowerCase().includes("tecnologia") ? "technology" : "general";
    
    const checklist = await valuationStorage.getChecklistProgress(project.id);
    const inputs = await valuationStorage.getInputs(project.id);
    const maturity = await valuationStorage.getMaturityScores(project.id);
    const weights = await valuationStorage.getCategoryWeights(tenantId, segment);
    
    const completedItems = checklist.filter(c => c.status === "completed").length;
    const totalItems = checklist.length || 1;
    const checklistCompletion = Math.round((completedItems / totalItems) * 100);
    
    const categoryScores: Record<string, number> = {};
    const categoryProgress: Record<string, { completed: number; total: number }> = {};
    
    const allItems = await valuationStorage.getChecklistItems(null, segment);
    const categories = await valuationStorage.getChecklistCategories(segment);
    const categoryMap = new Map(categories.map(c => [c.id, c]));
    const itemCategoryMap = new Map(allItems.map(i => [i.id, categoryMap.get(i.categoryId)]));
    
    for (const item of checklist) {
      const category = itemCategoryMap.get(item.itemId);
      if (category) {
        const code = category.code || "other";
        if (!categoryProgress[code]) {
          categoryProgress[code] = { completed: 0, total: 0 };
        }
        categoryProgress[code].total++;
        if (item.status === "completed") categoryProgress[code].completed++;
      }
    }
    
    for (const [code, prog] of Object.entries(categoryProgress)) {
      categoryScores[code] = Math.round((prog.completed / (prog.total || 1)) * 100);
    }
    
    let totalWeight = 0;
    let weightedSum = 0;
    for (const weight of weights) {
      const score = categoryScores[weight.categoryCode] || 0;
      weightedSum += score * weight.weight;
      totalWeight += weight.weight;
    }
    
    const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : checklistCompletion;
    
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const recommendations: string[] = [];
    
    for (const [code, score] of Object.entries(categoryScores)) {
      if (score >= 80) {
        strengths.push(`Categoria ${code} bem documentada (${score}%)`);
      } else if (score < 50) {
        weaknesses.push(`Categoria ${code} necessita mais informações (${score}%)`);
        recommendations.push(`Completar documentação da categoria ${code}`);
      }
    }
    
    if (inputs.length === 0) {
      weaknesses.push("Dados financeiros não inseridos");
      recommendations.push("Inserir dados financeiros históricos para análise completa");
    }
    
    if (maturity.length === 0) {
      weaknesses.push("Avaliação de maturidade não realizada");
      recommendations.push("Realizar avaliação de maturidade organizacional");
    }
    
    const indicatorScores: Record<string, any> = {};
    if (inputs.length > 0) {
      const latestInput = inputs[inputs.length - 1];
      if (latestInput.revenue && latestInput.ebitda) {
        const ebitdaMargin = (Number(latestInput.ebitda) / Number(latestInput.revenue)) * 100;
        indicatorScores.ebitda_margin = { value: ebitdaMargin.toFixed(1), unit: "%" };
      }
      if (latestInput.revenue && latestInput.netIncome) {
        const netMargin = (Number(latestInput.netIncome) / Number(latestInput.revenue)) * 100;
        indicatorScores.net_margin = { value: netMargin.toFixed(1), unit: "%" };
      }
    }
    
    const existingScores = await valuationStorage.getSectorScores(project.id);
    const version = existingScores.length + 1;
    
    const result = await valuationStorage.createSectorScore({
      projectId: project.id,
      overallScore,
      categoryScores,
      indicatorScores,
      strengths,
      weaknesses,
      recommendations,
      calculatedBy: req.user?.id,
      version,
    });
    
    res.json(result);
  } catch (error) {
    console.error("Sector analysis error:", error);
    res.status(500).json({ error: "Failed to calculate sector analysis" });
  }
});

// ========== CANVAS ==========
router.get("/projects/:id/canvas", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    
    const blocks = await valuationStorage.getCanvasBlocks(project.id);
    res.json(blocks);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch canvas" });
  }
});

router.put("/projects/:id/canvas/:blockType", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    
    const block = await valuationStorage.upsertCanvasBlock(project.id, req.params.blockType, req.body);
    res.json(block);
  } catch (error) {
    res.status(500).json({ error: "Failed to save canvas block" });
  }
});

router.get("/projects/:id/canvas/snapshots", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    
    const snapshots = await valuationStorage.getCanvasSnapshots(project.id);
    res.json(snapshots);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch snapshots" });
  }
});

router.post("/projects/:id/canvas/snapshots", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    
    const blocks = await valuationStorage.getCanvasBlocks(project.id);
    const canvasData = blocks.reduce((acc, b) => {
      acc[b.blockType] = { items: b.items, notes: b.notes, title: b.title };
      return acc;
    }, {} as Record<string, any>);
    
    const requiredBlocks = ["value_proposition", "customer_segments", "revenue_streams"];
    const missingBlocks = requiredBlocks.filter(b => !canvasData[b] || !canvasData[b].items?.length);
    const consistencyScore = Math.round(((requiredBlocks.length - missingBlocks.length) / requiredBlocks.length) * 100);
    const consistencyNotes = missingBlocks.map(b => `Bloco ${b} não preenchido`);
    
    const snapshot = await valuationStorage.createCanvasSnapshot({
      projectId: project.id,
      name: req.body.name || `Snapshot ${new Date().toLocaleDateString("pt-BR")}`,
      canvasData,
      consistencyScore,
      consistencyNotes,
      createdBy: req.user?.id,
    });
    
    res.status(201).json(snapshot);
  } catch (error) {
    res.status(500).json({ error: "Failed to create snapshot" });
  }
});

// ========== CALCULATION ENGINE ==========
router.post("/projects/:id/calculate", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const inputs = await valuationStorage.getInputs(project.id);
    const assumptions = await valuationStorage.getAssumptions(project.id);
    const govCriteria = await valuationStorage.getGovernanceCriteria(project.id);
    const assets = await valuationStorage.getAssets(project.id);

    const financials: FinancialData[] = inputs.map((i) => ({
      year: i.year,
      isProjection: i.isProjection || 0,
      revenue: parseFloat(i.revenue || "0"),
      grossRevenue: parseFloat(i.grossRevenue || "0"),
      cogs: parseFloat(i.cogs || "0"),
      grossProfit: parseFloat(i.grossProfit || "0"),
      operatingExpenses: parseFloat(i.operatingExpenses || "0"),
      ebitda: parseFloat(i.ebitda || "0"),
      ebit: parseFloat(i.ebit || "0"),
      netIncome: parseFloat(i.netIncome || "0"),
      totalAssets: parseFloat(i.totalAssets || "0"),
      totalLiabilities: parseFloat(i.totalLiabilities || "0"),
      totalEquity: parseFloat(i.totalEquity || "0"),
      cash: parseFloat(i.cash || "0"),
      debt: parseFloat(i.debt || "0"),
      workingCapital: parseFloat(i.workingCapital || "0"),
      capex: parseFloat(i.capex || "0"),
      depreciation: parseFloat(i.depreciation || "0"),
      freeCashFlow: parseFloat(i.freeCashFlow || "0"),
      cashFlowOperations: parseFloat(i.cashFlowOperations || "0"),
      headcount: i.headcount || 0,
      growthRate: parseFloat(i.growthRate || "0"),
    }));

    const historical = financials.filter((f) => !f.isProjection);
    let projected = financials.filter((f) => f.isProjection);

    if (projected.length === 0 && historical.length > 0) {
      projected = generateProjections(historical, {});
    }

    const allFinancials = [...historical, ...projected];

    const firstAssumption = assumptions[0];
    const assumptionData: AssumptionData = {
      riskFreeRate: parseFloat(firstAssumption?.value || "0.1050"),
      betaUnlevered: 0.8,
      marketPremium: 0.065,
      countryRisk: 0.025,
      sizePremium: 0.035,
      specificRisk: 0.02,
      costOfDebt: 0.12,
      taxRate: 0.34,
      equityRatio: 0.7,
      debtRatio: 0.3,
      terminalGrowth: 0.035,
      projectionYears: 5,
    };

    for (const a of assumptions) {
      const key = a.key;
      const val = parseFloat(a.value || "0");
      if (key === "risk_free_rate") assumptionData.riskFreeRate = val;
      if (key === "beta") assumptionData.betaUnlevered = val;
      if (key === "market_premium") assumptionData.marketPremium = val;
      if (key === "country_risk") assumptionData.countryRisk = val;
      if (key === "size_premium") assumptionData.sizePremium = val;
      if (key === "specific_risk") assumptionData.specificRisk = val;
      if (key === "cost_of_debt") assumptionData.costOfDebt = val;
      if (key === "tax_rate") assumptionData.taxRate = val;
      if (key === "equity_ratio") assumptionData.equityRatio = val;
      if (key === "debt_ratio") assumptionData.debtRatio = val;
      if (key === "terminal_growth") assumptionData.terminalGrowth = val;
    }

    const sectorBenchmarks = await valuationStorage.getSectorBenchmarks(project.sector);
    const evEbitdaBench = sectorBenchmarks.find((b) => b.indicatorCode === "ev_ebitda");
    const evRevenueBench = sectorBenchmarks.find((b) => b.indicatorCode === "ev_revenue");

    const multiples = {
      evEbitda: parseFloat(evEbitdaBench?.median || "8"),
      evRevenue: parseFloat(evRevenueBench?.median || "2"),
    };

    const projectType = (project.projectType as "simple" | "governance") || "simple";
    const scenarios = ["conservative", "base", "optimistic"] as const;
    const scenarioResults: { scenario: string; ev: number; equity: number }[] = [];

    await valuationStorage.deleteResults(project.id);

    for (const scenario of scenarios) {
      const govCriteriaData: GovernanceCriterion[] = govCriteria.map((g) => ({
        currentScore: g.currentScore || 0,
        targetScore: g.targetScore || 10,
        weight: parseFloat(g.weight || "5"),
        valuationImpactPct: parseFloat(g.valuationImpactPct || "0"),
        equityImpactPct: parseFloat(g.equityImpactPct || "0"),
        roeImpactPct: parseFloat(g.roeImpactPct || "0"),
      }));

      const assetData = assets.map((a) => ({
        bookValue: parseFloat(a.bookValue || "0"),
        marketValue: parseFloat(a.marketValue || "0"),
        appraisedValue: a.appraisedValue ? parseFloat(a.appraisedValue) : undefined,
      }));

      const result = runFullValuation({
        financials: allFinancials,
        assumptions: assumptionData,
        multiples,
        assets: assetData,
        governanceCriteria: govCriteriaData,
        projectType,
        scenario,
      });

      for (const r of result.results) {
        await valuationStorage.createResult({
          projectId: project.id,
          scenario,
          method: r.method,
          enterpriseValue: r.enterpriseValue.toFixed(2),
          equityValue: r.equityValue.toFixed(2),
          terminalValue: r.terminalValue?.toFixed(2),
          netDebt: r.netDebt.toFixed(2),
          weight: r.weight.toFixed(4),
          calculationDetails: r.details,
        });
      }

      scenarioResults.push({
        scenario,
        ev: result.weightedEV,
        equity: result.weightedEquity,
      });
    }

    const weighted = calculateScenarioWeighted(scenarioResults);
    const wacc = calculateWACC(assumptionData);

    const govImpact = govCriteria.length > 0
      ? calculateGovernanceImpact(
          govCriteria.map((g) => ({
            currentScore: g.currentScore || 0,
            targetScore: g.targetScore || 10,
            weight: parseFloat(g.weight || "5"),
            valuationImpactPct: parseFloat(g.valuationImpactPct || "0"),
            equityImpactPct: parseFloat(g.equityImpactPct || "0"),
            roeImpactPct: parseFloat(g.roeImpactPct || "0"),
          })),
        )
      : null;

    await valuationStorage.updateProject(project.id, tenantId, {
      currentValuation: weighted.weightedEV.toFixed(2),
      projectedValuation: govImpact
        ? (weighted.weightedEV * (1 + govImpact.valuationUplift)).toFixed(2)
        : weighted.weightedEV.toFixed(2),
      governanceScore: govImpact?.currentScore?.toFixed(2),
    });

    await valuationStorage.createAiLog({
      projectId: project.id,
      eventType: "calculation",
      triggerSource: "manual",
      inputSummary: `Calculated ${scenarios.length} scenarios, ${projectType} mode`,
      outputSummary: `EV: R$ ${(weighted.weightedEV / 1e6).toFixed(2)}M`,
      fullResponse: { scenarioResults, weighted, wacc, govImpact },
      confidence: "0.95",
    });

    res.json({
      scenarioResults,
      weighted,
      wacc,
      governanceImpact: govImpact,
      projectType,
    });
  } catch (error: any) {
    console.error("Calculation error:", error);
    res.status(500).json({ error: "Failed to calculate valuation", details: error.message });
  }
});

router.get("/projects/:id/results", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const results = await valuationStorage.getResults(project.id);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch results" });
  }
});

router.post("/projects/:id/sensitivity", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const inputs = await valuationStorage.getInputs(project.id);
    const assumptions = await valuationStorage.getAssumptions(project.id);

    const projected = inputs.filter((i) => i.isProjection);
    const historical = inputs.filter((i) => !i.isProjection);
    const lastHistorical = historical.sort((a, b) => a.year - b.year).pop();

    const fcfs = projected.map((p) => parseFloat(p.freeCashFlow || "0"));
    const netDebt = lastHistorical ? parseFloat(lastHistorical.debt || "0") - parseFloat(lastHistorical.cash || "0") : 0;

    let baseWacc = 0.12;
    let baseGrowth = 0.035;
    for (const a of assumptions) {
      if (a.key === "terminal_growth") baseGrowth = parseFloat(a.value || "0.035");
    }

    const assumptionData: AssumptionData = {
      riskFreeRate: 0.1050,
      betaUnlevered: 0.8,
      marketPremium: 0.065,
      countryRisk: 0.025,
      sizePremium: 0.035,
      specificRisk: 0.02,
      costOfDebt: 0.12,
      taxRate: 0.34,
      equityRatio: 0.7,
      debtRatio: 0.3,
      terminalGrowth: baseGrowth,
      projectionYears: 5,
    };

    for (const a of assumptions) {
      const val = parseFloat(a.value || "0");
      if (a.key === "risk_free_rate") assumptionData.riskFreeRate = val;
      if (a.key === "beta") assumptionData.betaUnlevered = val;
      if (a.key === "market_premium") assumptionData.marketPremium = val;
      if (a.key === "country_risk") assumptionData.countryRisk = val;
      if (a.key === "size_premium") assumptionData.sizePremium = val;
      if (a.key === "cost_of_debt") assumptionData.costOfDebt = val;
      if (a.key === "tax_rate") assumptionData.taxRate = val;
      if (a.key === "equity_ratio") assumptionData.equityRatio = val;
      if (a.key === "debt_ratio") assumptionData.debtRatio = val;
    }

    baseWacc = calculateWACC(assumptionData);
    const gridSize = req.body.gridSize || 5;
    const matrix = sensitivityAnalysis(fcfs, baseWacc, baseGrowth, netDebt, gridSize);
    res.json({ matrix, baseWacc, baseGrowth });
  } catch (error) {
    res.status(500).json({ error: "Failed to run sensitivity analysis" });
  }
});

router.post("/projects/:id/projections", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const inputs = await valuationStorage.getInputs(project.id);
    const historical: FinancialData[] = inputs
      .filter((i) => !i.isProjection)
      .map((i) => ({
        year: i.year,
        isProjection: 0,
        revenue: parseFloat(i.revenue || "0"),
        ebitda: parseFloat(i.ebitda || "0"),
        netIncome: parseFloat(i.netIncome || "0"),
        totalEquity: parseFloat(i.totalEquity || "0"),
        totalAssets: parseFloat(i.totalAssets || "0"),
        totalLiabilities: parseFloat(i.totalLiabilities || "0"),
        cash: parseFloat(i.cash || "0"),
        debt: parseFloat(i.debt || "0"),
        capex: parseFloat(i.capex || "0"),
        depreciation: parseFloat(i.depreciation || "0"),
        workingCapital: parseFloat(i.workingCapital || "0"),
        freeCashFlow: parseFloat(i.freeCashFlow || "0"),
      }));

    const projections = generateProjections(historical, {}, req.body.years || 5);

    for (const p of projections) {
      await valuationStorage.createInput({
        projectId: project.id,
        year: p.year,
        isProjection: 1,
        revenue: p.revenue?.toFixed(2),
        ebitda: p.ebitda?.toFixed(2),
        ebit: p.ebit?.toFixed(2),
        netIncome: p.netIncome?.toFixed(2),
        totalEquity: p.totalEquity?.toFixed(2),
        totalAssets: p.totalAssets?.toFixed(2),
        cash: p.cash?.toFixed(2),
        debt: p.debt?.toFixed(2),
        capex: p.capex?.toFixed(2),
        depreciation: p.depreciation?.toFixed(2),
        freeCashFlow: p.freeCashFlow?.toFixed(2),
        workingCapital: p.workingCapital?.toFixed(2),
        growthRate: p.growthRate?.toFixed(4),
        source: "auto",
      });
    }

    res.json(projections);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate projections" });
  }
});

// ========== GOVERNANCE ==========
router.get("/projects/:id/governance", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const criteria = await valuationStorage.getGovernanceCriteria(project.id);
    res.json(criteria);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch governance criteria" });
  }
});

router.post("/projects/:id/governance/initialize", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const criteriaData = GOVERNANCE_CRITERIA.map((c) => ({
      projectId: project.id,
      criterionCode: c.code,
      criterionName: c.name,
      category: c.category,
      currentScore: 0,
      targetScore: 10,
      weight: c.weight.toString(),
      valuationImpactPct: c.valuationImpactPct.toString(),
      equityImpactPct: c.equityImpactPct.toString(),
      roeImpactPct: c.roeImpactPct.toString(),
    }));

    const result = await valuationStorage.initializeGovernance(project.id, criteriaData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to initialize governance" });
  }
});

router.patch("/projects/:id/governance/:criterionId", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const data = insertValuationGovernanceSchema.partial().parse(req.body);
    const updated = await valuationStorage.updateGovernanceCriterion(
      Number(req.params.criterionId),
      project.id,
      data,
    );
    if (!updated) return res.status(404).json({ error: "Criterion not found" });
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update governance criterion" });
  }
});

router.get("/projects/:id/governance/impact", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const criteria = await valuationStorage.getGovernanceCriteria(project.id);
    const impact = calculateGovernanceImpact(
      criteria.map((c) => ({
        currentScore: c.currentScore || 0,
        targetScore: c.targetScore || 10,
        weight: parseFloat(c.weight || "5"),
        valuationImpactPct: parseFloat(c.valuationImpactPct || "0"),
        equityImpactPct: parseFloat(c.equityImpactPct || "0"),
        roeImpactPct: parseFloat(c.roeImpactPct || "0"),
      })),
    );
    res.json(impact);
  } catch (error) {
    res.status(500).json({ error: "Failed to calculate governance impact" });
  }
});

// ========== PDCA ==========
router.get("/projects/:id/pdca", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const items = await valuationStorage.getPdcaItems(project.id);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch PDCA items" });
  }
});

router.post("/projects/:id/pdca", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const data = insertValuationPdcaSchema.parse({ ...req.body, projectId: project.id });
    const item = await valuationStorage.createPdcaItem(data);
    res.status(201).json(item);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to create PDCA item" });
  }
});

router.patch("/projects/:id/pdca/:itemId", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const data = insertValuationPdcaSchema.partial().parse(req.body);
    const updated = await valuationStorage.updatePdcaItem(Number(req.params.itemId), project.id, data);
    if (!updated) return res.status(404).json({ error: "PDCA item not found" });
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update PDCA item" });
  }
});

router.delete("/projects/:id/pdca/:itemId", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const deleted = await valuationStorage.deletePdcaItem(Number(req.params.itemId), project.id);
    if (!deleted) return res.status(404).json({ error: "PDCA item not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete PDCA item" });
  }
});

// ========== SWOT ==========
router.get("/projects/:id/swot", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const items = await valuationStorage.getSwotItems(project.id);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch SWOT items" });
  }
});

router.post("/projects/:id/swot", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const data = insertValuationSwotSchema.parse({ ...req.body, projectId: project.id });
    const item = await valuationStorage.createSwotItem(data);
    res.status(201).json(item);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to create SWOT item" });
  }
});

router.patch("/projects/:id/swot/:itemId", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const data = insertValuationSwotSchema.partial().parse(req.body);
    const updated = await valuationStorage.updateSwotItem(Number(req.params.itemId), project.id, data);
    if (!updated) return res.status(404).json({ error: "SWOT item not found" });
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update SWOT item" });
  }
});

router.delete("/projects/:id/swot/:itemId", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const deleted = await valuationStorage.deleteSwotItem(Number(req.params.itemId), project.id);
    if (!deleted) return res.status(404).json({ error: "SWOT item not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete SWOT item" });
  }
});

router.post("/projects/:id/swot/generate", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const inputs = await valuationStorage.getInputs(project.id);
    const govCriteria = await valuationStorage.getGovernanceCriteria(project.id);

    const prompt = `Analise a empresa "${project.companyName}" no setor "${project.sector}" (modelo: ${project.businessModel || "N/A"}, porte: ${project.size}).
Dados financeiros: ${JSON.stringify(inputs.slice(-3).map((i) => ({ ano: i.year, receita: i.revenue, ebitda: i.ebitda, lucro: i.netIncome })))}
Governança: ${govCriteria.length} critérios avaliados, score médio: ${govCriteria.length > 0 ? (govCriteria.reduce((s, c) => s + (c.currentScore || 0), 0) / govCriteria.length).toFixed(1) : "N/A"}

Gere uma análise SWOT com exatamente 3 itens por quadrante (Strengths, Weaknesses, Opportunities, Threats).
Para cada item, indique: item (texto), impact (low/medium/high), valuationRelevance (0-10), governanceRelevance (0-10).
Responda em JSON: { strengths: [...], weaknesses: [...], opportunities: [...], threats: [...] }`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const swotData = JSON.parse(completion.choices[0].message.content || "{}");
    const created = [];

    for (const quadrant of ["strengths", "weaknesses", "opportunities", "threats"]) {
      const items = swotData[quadrant] || [];
      for (let i = 0; i < items.length; i++) {
        const item = await valuationStorage.createSwotItem({
          projectId: project.id,
          quadrant,
          item: items[i].item,
          impact: items[i].impact || "medium",
          valuationRelevance: items[i].valuationRelevance || 5,
          governanceRelevance: items[i].governanceRelevance || 5,
          orderIndex: i,
        });
        created.push(item);
      }
    }

    await valuationStorage.createAiLog({
      projectId: project.id,
      eventType: "swot_generation",
      triggerSource: "manual",
      inputSummary: `Generated SWOT for ${project.companyName}`,
      outputSummary: `${created.length} items created`,
      fullResponse: swotData,
      confidence: "0.85",
      tokensUsed: completion.usage?.total_tokens,
    });

    res.json(created);
  } catch (error: any) {
    console.error("SWOT generation error:", error);
    res.status(500).json({ error: "Failed to generate SWOT" });
  }
});

// ========== ASSETS ==========
router.get("/projects/:id/assets", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const assets = await valuationStorage.getAssets(project.id);
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch assets" });
  }
});

router.post("/projects/:id/assets", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const data = insertValuationAssetSchema.parse({ ...req.body, projectId: project.id });
    const asset = await valuationStorage.createAsset(data);
    res.status(201).json(asset);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to create asset" });
  }
});

router.patch("/projects/:id/assets/:assetId", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const data = insertValuationAssetSchema.partial().parse(req.body);
    const updated = await valuationStorage.updateAsset(Number(req.params.assetId), project.id, data);
    if (!updated) return res.status(404).json({ error: "Asset not found" });
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update asset" });
  }
});

router.delete("/projects/:id/assets/:assetId", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const deleted = await valuationStorage.deleteAsset(Number(req.params.assetId), project.id);
    if (!deleted) return res.status(404).json({ error: "Asset not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete asset" });
  }
});

// ========== AI LOG / FEED ==========
router.get("/projects/:id/ai-feed", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const logs = await valuationStorage.getAiLogs(project.id, 20);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch AI feed" });
  }
});

router.post("/projects/:id/ai-chat", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });

    const inputs = await valuationStorage.getInputs(project.id);
    const govCriteria = await valuationStorage.getGovernanceCriteria(project.id);
    const results = await valuationStorage.getResults(project.id);
    const swot = await valuationStorage.getSwotItems(project.id);

    const systemPrompt = `Você é um consultor especialista em Valuation e M&A da Arcádia Suite.
Empresa: ${project.companyName} | Setor: ${project.sector} | Porte: ${project.size}
Status: ${project.status} | Tipo: ${project.projectType || "simple"}
Valuation Atual: R$ ${project.currentValuation || "N/A"} | Projetado: R$ ${project.projectedValuation || "N/A"}
Dados financeiros (últimos anos): ${JSON.stringify(inputs.slice(-5).map((i) => ({ ano: i.year, receita: i.revenue, ebitda: i.ebitda, lucro: i.netIncome, fcf: i.freeCashFlow })))}
Governança: ${govCriteria.length} critérios, score médio ${govCriteria.length > 0 ? (govCriteria.reduce((s, c) => s + (c.currentScore || 0), 0) / govCriteria.length).toFixed(1) : "N/A"}
Resultados: ${results.length > 0 ? results.map((r) => `${r.method}/${r.scenario}: EV=${r.enterpriseValue}`).join("; ") : "Nenhum cálculo realizado"}
SWOT: ${swot.length} itens
Responda de forma consultiva, em português, com foco em recomendações acionáveis.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
    });

    const reply = completion.choices[0].message.content || "";

    await valuationStorage.createAiLog({
      projectId: project.id,
      eventType: "chat",
      triggerSource: "user",
      inputSummary: message.substring(0, 200),
      outputSummary: reply.substring(0, 200),
      fullResponse: { message, reply },
      tokensUsed: completion.usage?.total_tokens,
    });

    res.json({ reply });
  } catch (error: any) {
    console.error("AI chat error:", error);
    res.status(500).json({ error: "Failed to process chat" });
  }
});

// ========== REPORTS ==========
router.get("/projects/:id/reports", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const reports = await valuationStorage.getReports(project.id);
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

router.post("/projects/:id/reports/generate", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const { reportType = "executive", format = "html" } = req.body;

    const inputs = await valuationStorage.getInputs(project.id);
    const results = await valuationStorage.getResults(project.id);
    const govCriteria = await valuationStorage.getGovernanceCriteria(project.id);
    const swot = await valuationStorage.getSwotItems(project.id);
    const pdca = await valuationStorage.getPdcaItems(project.id);
    const assets = await valuationStorage.getAssets(project.id);

    const govImpact = govCriteria.length > 0
      ? calculateGovernanceImpact(
          govCriteria.map((c) => ({
            currentScore: c.currentScore || 0,
            targetScore: c.targetScore || 10,
            weight: parseFloat(c.weight || "5"),
            valuationImpactPct: parseFloat(c.valuationImpactPct || "0"),
            equityImpactPct: parseFloat(c.equityImpactPct || "0"),
            roeImpactPct: parseFloat(c.roeImpactPct || "0"),
          })),
        )
      : null;

    const prompt = `Gere um relatório ${reportType === "executive" ? "executivo" : "técnico"} de valuation para:
Empresa: ${project.companyName} | Setor: ${project.sector} | Porte: ${project.size}
Valuation: R$ ${project.currentValuation || "N/A"} (atual) → R$ ${project.projectedValuation || "N/A"} (projetado)
Dados financeiros: ${JSON.stringify(inputs.slice(-5).map((i) => ({ ano: i.year, receita: i.revenue, ebitda: i.ebitda })))}
Resultados por método: ${results.map((r) => `${r.method} (${r.scenario}): EV R$ ${r.enterpriseValue}`).join("; ")}
Governança: Score ${govImpact?.currentScore?.toFixed(1) || "N/A"}/10, uplift potencial ${((govImpact?.valuationUplift || 0) * 100).toFixed(1)}%
SWOT: ${swot.length} itens | PDCA: ${pdca.length} ações | Ativos: ${assets.length}
Gere em formato HTML com seções claras. Use formatação profissional.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0].message.content || "";

    const report = await valuationStorage.createReport({
      projectId: project.id,
      reportType,
      format,
      fileUrl: null,
      generatedBy: req.user?.id,
    });

    await valuationStorage.createAiLog({
      projectId: project.id,
      eventType: "report_generation",
      triggerSource: "manual",
      inputSummary: `Generated ${reportType} report in ${format}`,
      outputSummary: `Report #${report.id} created`,
      fullResponse: { reportId: report.id, content },
      tokensUsed: completion.usage?.total_tokens,
    });

    res.json({ report, content });
  } catch (error: any) {
    console.error("Report generation error:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

// ========== PROJECT SUMMARY ==========
router.get("/projects/:id/summary", requireAuth, async (req, res) => {
  try {
    const tenantId = await getUserTenantId(req);
    if (!tenantId) return res.status(403).json({ error: "Tenant not found" });
    const project = await valuationStorage.getProject(Number(req.params.id), tenantId);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const [inputs, results, govCriteria, swot, pdca, assets, checklistProgress, aiLogs] =
      await Promise.all([
        valuationStorage.getInputs(project.id),
        valuationStorage.getResults(project.id),
        valuationStorage.getGovernanceCriteria(project.id),
        valuationStorage.getSwotItems(project.id),
        valuationStorage.getPdcaItems(project.id),
        valuationStorage.getAssets(project.id),
        valuationStorage.getChecklistProgress(project.id),
        valuationStorage.getAiLogs(project.id, 5),
      ]);

    const checklistTotal = checklistProgress.length;
    const checklistCompleted = checklistProgress.filter((p) => p.status === "uploaded" || p.status === "completed").length;

    const govImpact = govCriteria.length > 0
      ? calculateGovernanceImpact(
          govCriteria.map((c) => ({
            currentScore: c.currentScore || 0,
            targetScore: c.targetScore || 10,
            weight: parseFloat(c.weight || "5"),
            valuationImpactPct: parseFloat(c.valuationImpactPct || "0"),
            equityImpactPct: parseFloat(c.equityImpactPct || "0"),
            roeImpactPct: parseFloat(c.roeImpactPct || "0"),
          })),
        )
      : null;

    const baseResults = results.filter((r) => r.scenario === "base");
    const pdcaCompleted = pdca.filter((p) => p.status === "completed").length;

    res.json({
      project,
      financials: {
        historicalYears: inputs.filter((i) => !i.isProjection).length,
        projectedYears: inputs.filter((i) => i.isProjection).length,
        latestRevenue: inputs.filter((i) => !i.isProjection).sort((a, b) => b.year - a.year)[0]?.revenue,
        latestEbitda: inputs.filter((i) => !i.isProjection).sort((a, b) => b.year - a.year)[0]?.ebitda,
      },
      valuation: {
        currentEV: project.currentValuation,
        projectedEV: project.projectedValuation,
        creationOfValue: project.currentValuation && project.projectedValuation
          ? (parseFloat(project.projectedValuation) - parseFloat(project.currentValuation)).toFixed(2)
          : null,
        creationPct: project.currentValuation && project.projectedValuation && parseFloat(project.currentValuation) > 0
          ? (((parseFloat(project.projectedValuation) - parseFloat(project.currentValuation)) / parseFloat(project.currentValuation)) * 100).toFixed(1)
          : null,
        resultsByMethod: baseResults.map((r) => ({ method: r.method, ev: r.enterpriseValue, equity: r.equityValue })),
      },
      governance: govImpact
        ? {
            currentScore: govImpact.currentScore.toFixed(1),
            projectedScore: govImpact.projectedScore.toFixed(1),
            uplift: (govImpact.valuationUplift * 100).toFixed(1),
            waccReduction: (govImpact.waccReduction * 100).toFixed(2),
            criteriaCount: govCriteria.length,
          }
        : null,
      checklist: {
        total: checklistTotal,
        completed: checklistCompleted,
        progress: checklistTotal > 0 ? Math.round((checklistCompleted / checklistTotal) * 100) : 0,
      },
      swot: {
        total: swot.length,
        byQuadrant: {
          strengths: swot.filter((s) => s.quadrant === "strengths").length,
          weaknesses: swot.filter((s) => s.quadrant === "weaknesses").length,
          opportunities: swot.filter((s) => s.quadrant === "opportunities").length,
          threats: swot.filter((s) => s.quadrant === "threats").length,
        },
      },
      pdca: {
        total: pdca.length,
        completed: pdcaCompleted,
        byPhase: {
          plan: pdca.filter((p) => p.phase === "plan").length,
          do: pdca.filter((p) => p.phase === "do").length,
          check: pdca.filter((p) => p.phase === "check").length,
          act: pdca.filter((p) => p.phase === "act").length,
        },
      },
      assets: {
        total: assets.length,
        totalBookValue: assets.reduce((s, a) => s + parseFloat(a.bookValue || "0"), 0).toFixed(2),
        totalMarketValue: assets.reduce((s, a) => s + parseFloat(a.marketValue || "0"), 0).toFixed(2),
      },
      recentAiActions: aiLogs.map((l) => ({
        type: l.eventType,
        summary: l.outputSummary,
        timestamp: l.createdAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch project summary" });
  }
});

export default router;
