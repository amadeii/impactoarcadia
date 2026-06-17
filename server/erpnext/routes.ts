import { Router, Request, Response } from "express";
import * as erpnextService from "./service";

const router = Router();

router.get("/status", async (_req: Request, res: Response) => {
  try {
    const config = erpnextService.getConfig();
    if (!config.configured) {
      return res.json({ 
        connected: false, 
        message: "ERPNext não configurado. Configure as credenciais nas secrets." 
      });
    }

    const result = await erpnextService.testConnection();
    return res.json({
      connected: result.success,
      message: result.message,
      user: result.user,
      url: config.url,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ connected: false, message });
  }
});

router.get("/doctypes", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const doctypes = await erpnextService.listDocTypes(limit);
    return res.json({ data: doctypes });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ error: message });
  }
});

router.get("/doctype/:doctype/fields", async (req: Request, res: Response) => {
  try {
    const { doctype } = req.params;
    const fields = await erpnextService.getDocTypeFields(doctype);
    return res.json({ data: fields });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ error: message });
  }
});

router.get("/resource/:doctype", async (req: Request, res: Response) => {
  try {
    const { doctype } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    const fields = req.query.fields ? JSON.parse(req.query.fields as string) : undefined;
    const filters = req.query.filters ? JSON.parse(req.query.filters as string) : undefined;
    const orderBy = req.query.order_by as string | undefined;

    const documents = await erpnextService.getDocuments(doctype, filters, fields, limit, orderBy);
    return res.json({ data: documents });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ error: message });
  }
});

router.get("/resource/:doctype/:name", async (req: Request, res: Response) => {
  try {
    const { doctype, name } = req.params;
    const document = await erpnextService.getDocument(doctype, name);
    return res.json({ data: document });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ error: message });
  }
});

router.post("/resource/:doctype", async (req: Request, res: Response) => {
  try {
    const { doctype } = req.params;
    const document = await erpnextService.createDocument(doctype, req.body);
    return res.status(201).json({ data: document });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ error: message });
  }
});

router.put("/resource/:doctype/:name", async (req: Request, res: Response) => {
  try {
    const { doctype, name } = req.params;
    const document = await erpnextService.updateDocument(doctype, name, req.body);
    return res.json({ data: document });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ error: message });
  }
});

router.delete("/resource/:doctype/:name", async (req: Request, res: Response) => {
  try {
    const { doctype, name } = req.params;
    const result = await erpnextService.deleteDocument(doctype, name);
    return res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ error: message });
  }
});

router.get("/search/:doctype", async (req: Request, res: Response) => {
  try {
    const { doctype } = req.params;
    const q = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 20;
    const fields = req.query.fields ? JSON.parse(req.query.fields as string) : undefined;

    if (!q) {
      return res.status(400).json({ error: "Parâmetro 'q' é obrigatório" });
    }

    const documents = await erpnextService.searchDocuments(doctype, q, fields, limit);
    return res.json({ data: documents });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ error: message });
  }
});

router.get("/report/:reportName", async (req: Request, res: Response) => {
  try {
    const { reportName } = req.params;
    const filters = req.query.filters ? JSON.parse(req.query.filters as string) : undefined;

    const result = await erpnextService.runReport(reportName, filters);
    return res.json({ data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ error: message });
  }
});

router.post("/method/:method", async (req: Request, res: Response) => {
  try {
    const { method } = req.params;
    const result = await erpnextService.callMethod(method, req.body);
    return res.json({ data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ error: message });
  }
});

export default router;
