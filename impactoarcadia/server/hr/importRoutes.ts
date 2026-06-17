// Sprint RH-3 — endpoints REST do pipeline de importação Domínio.
// Todos sob /api/hr/import e /api/hr/rubrics, com auth + tenant context.

import type { Express } from "express";
import multer from "multer";
import { z } from "zod";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant } from "../tenantContext";
import { assertClienteOfTenant } from "./employeesService";
import {
  uploadAndClassify, buildPreview, getPreview, updatePreview,
  deletePreview, confirmImport,
  listRubricMappings, upsertRubricMapping, deleteRubricMapping,
} from "./import/importService";
import { seedRubricMappings } from "./seeds/rubricMappings";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

const auth = [isAuthenticated, tenantContext, requireTenant];

function uid(req: any): string | null {
  return req.user?.id ?? req.user?.claims?.sub ?? null;
}

function handle(res: any, fn: () => Promise<any>) {
  return fn().catch((err: any) => {
    const status = err?.status ?? 400;
    console.error("[hr:import] erro:", err?.message || err);
    res.status(status).json({ message: err?.message || "Erro interno" });
  });
}

export function registerHrImportRoutes(app: Express): void {
  // 1. Upload — extrai texto + classifica + retorna metadados.
  app.post("/api/hr/import/upload", ...auth, upload.single("file"), (req: any, res) => handle(res, async () => {
    const clienteId = String(req.body?.clienteId || "");
    if (!clienteId) throw Object.assign(new Error("clienteId é obrigatório"), { status: 400 });
    if (!req.file) throw Object.assign(new Error("Arquivo PDF obrigatório (campo 'file')"), { status: 400 });
    await assertClienteOfTenant(req.tenantId, clienteId);
    const result = await uploadAndClassify(req.file.buffer);
    res.json({
      ...result,
      sourceFile: req.file.originalname,
      // Não retorna rawText completo na resposta — só indicador de tamanho.
      rawTextSize: result.rawText.length,
    });
  }));

  // 2. Preview — invoca IA + match + persiste.
  // Frontend reenvia o arquivo (multipart) OU o rawText (json) para evitar
  // dois trips com PDF grande.
  app.post("/api/hr/import/preview", ...auth, upload.single("file"), (req: any, res) => handle(res, async () => {
    const clienteId = String(req.body?.clienteId || "");
    if (!clienteId) throw Object.assign(new Error("clienteId é obrigatório"), { status: 400 });
    await assertClienteOfTenant(req.tenantId, clienteId);

    let rawText: string;
    let sourceFile: string;
    if (req.file) {
      const cls = await uploadAndClassify(req.file.buffer);
      if (cls.docType !== "extrato_mensal") {
        throw Object.assign(
          new Error(`Tipo de documento '${cls.docType}' não suportado nesta sprint (apenas extrato_mensal)`),
          { status: 422 },
        );
      }
      rawText = cls.rawText;
      sourceFile = req.file.originalname || "extrato.pdf";
    } else {
      rawText = String(req.body?.rawText || "");
      sourceFile = String(req.body?.sourceFile || "extrato.pdf");
      if (!rawText) throw Object.assign(new Error("Forneça 'file' ou 'rawText'"), { status: 400 });
    }

    const result = await buildPreview({
      tenantId: req.tenantId,
      clienteId,
      createdBy: uid(req),
      sourceFile,
      rawText,
    });
    res.json(result);
  }));

  // 3. GET preview.
  app.get("/api/hr/import/preview/:id", ...auth, (req: any, res) => handle(res, async () => {
    const row = await getPreview(req.tenantId, req.params.id);
    if (!row) return res.status(404).json({ message: "Preview não encontrado" });
    res.json(row);
  }));

  // 4. PUT preview — salva edições da tela de revisão.
  const patchSchema = z.object({
    matchResults: z.array(z.any()).optional(),
    extractedData: z.any().optional(),
    status: z.enum(["pending", "reviewed"]).optional(),
  });
  app.put("/api/hr/import/preview/:id", ...auth, (req: any, res) => handle(res, async () => {
    const patch = patchSchema.parse(req.body);
    const row = await updatePreview(req.tenantId, req.params.id, patch as any);
    if (!row) return res.status(404).json({ message: "Preview não encontrado" });
    res.json(row);
  }));

  // 5. DELETE preview — cancela.
  app.delete("/api/hr/import/preview/:id", ...auth, (req: any, res) => handle(res, async () => {
    const ok = await deletePreview(req.tenantId, req.params.id);
    res.json({ deleted: ok });
  }));

  // 6. Confirm — persiste tudo.
  app.post("/api/hr/import/preview/:id/confirm", ...auth, (req: any, res) => handle(res, async () => {
    const result = await confirmImport(req.tenantId, req.params.id, uid(req));
    res.json(result);
  }));

  // ─── Rubricas ───────────────────────────────────────────────────────────
  app.get("/api/hr/rubrics", ...auth, (req: any, res) => handle(res, async () => {
    const rows = await listRubricMappings(req.tenantId);
    res.json(rows);
  }));

  const rubricSchema = z.object({
    dominioCode: z.string().min(1).max(10),
    dominioDescription: z.string().max(200).optional(),
    type: z.enum(["earning", "discount", "informative"]),
    category: z.enum(["salary", "vacation", "leave", "inss", "fgts", "irrf", "alimony", "advance", "loan", "other"]),
    affectsControl: z.boolean().optional(),
  });
  app.post("/api/hr/rubrics", ...auth, (req: any, res) => handle(res, async () => {
    const data = rubricSchema.parse(req.body);
    const row = await upsertRubricMapping(req.tenantId, data);
    res.json(row);
  }));

  app.put("/api/hr/rubrics/:id", ...auth, (req: any, res) => handle(res, async () => {
    // upsert por código — id é só conveniência. Usa o code do body.
    const data = rubricSchema.parse(req.body);
    const row = await upsertRubricMapping(req.tenantId, data);
    res.json(row);
  }));

  app.delete("/api/hr/rubrics/:id", ...auth, (req: any, res) => handle(res, async () => {
    const ok = await deleteRubricMapping(req.tenantId, req.params.id);
    res.json({ deleted: ok });
  }));

  // 7. Seed: inicializa as 18 rubricas padrão para o tenant atual.
  app.post("/api/hr/rubrics/seed", ...auth, (req: any, res) => handle(res, async () => {
    const inserted = await seedRubricMappings(req.tenantId);
    res.json({ inserted });
  }));
}
