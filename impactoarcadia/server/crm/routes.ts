import { Router } from "express";
import { crmStorage } from "./storage";
import { whatsappBridge } from "./whatsapp-bridge";
import { communicationService } from "./communication";

whatsappBridge.init(communicationService);

import {
  insertCrmPartnerSchema,
  insertCrmPartnerCertificationSchema,
  insertCrmPartnerPerformanceSchema,
  insertCrmContractSchema,
  insertCrmChannelSchema,
  insertCrmThreadSchema,
  insertCrmMessageSchema,
  insertCrmEventSchema,
  insertCrmCommissionRuleSchema,
  insertCrmProductSchema,
  insertCrmClientSchema,
  insertCrmPipelineStageSchema,
  insertCrmLeadSchema,
  insertCrmOpportunitySchema,
  insertCrmOpportunityProductSchema,
  insertCrmProposalSchema,
  insertCrmProposalItemSchema,
  insertCrmContractMilestoneSchema,
  insertCrmFrappeConnectorSchema,
  insertCrmFrappeMappingSchema,
} from "@shared/schema";
import { createFrappeService } from "./frappe-service";
import { z } from "zod";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

router.get("/partners", requireAuth, async (req, res) => {
  try {
    const tenantId = req.query.tenantId ? Number(req.query.tenantId) : undefined;
    const partners = await crmStorage.getPartners(tenantId);
    res.json(partners);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch partners" });
  }
});

router.get("/partners/:id", requireAuth, async (req, res) => {
  try {
    const partner = await crmStorage.getPartner(Number(req.params.id));
    if (!partner) {
      return res.status(404).json({ error: "Partner not found" });
    }
    res.json(partner);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch partner" });
  }
});

router.post("/partners", requireAuth, async (req, res) => {
  try {
    const data = insertCrmPartnerSchema.parse(req.body);
    const partner = await crmStorage.createPartner(data);

    // Provisionar tenant do parceiro automaticamente (best-effort)
    try {
      const provisionRes = await fetch(`${req.protocol}://${req.get('host')}/api/tenants/provision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': req.headers.cookie ?? '',
          'x-tenant-id': String((req as any).tenantId ?? ''),
        },
        body: JSON.stringify({
          name:       partner.name,
          email:      partner.email ?? `${partner.name.toLowerCase().replace(/\s+/g, '.')}@partner.arcadia`,
          plan:       'partner_starter',
          tenantType: 'partner',
          adminName:  partner.primaryContactName ?? partner.name,
          modules:    ['xos', 'crm', 'financeiro', 'rh', 'bi', 'valuation'],
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (provisionRes.ok) {
        const provisionData = await provisionRes.json();
        // Atualizar o parceiro com o suiteTenantId
        try {
          await crmStorage.updatePartner(partner.id, {
            suiteTenantId: provisionData.tenant?.id,
          } as any);
          (partner as any).suiteTenantId = provisionData.tenant?.id;
        } catch { /* campo pode não existir ainda */ }
      }
    } catch (provErr: any) {
      console.warn('[manager-partners] provision falhou:', provErr.message);
    }

    res.status(201).json(partner);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to create partner" });
  }
});

router.patch("/partners/:id", requireAuth, async (req, res) => {
  try {
    const data = insertCrmPartnerSchema.partial().parse(req.body);
    const partner = await crmStorage.updatePartner(Number(req.params.id), data);
    if (!partner) {
      return res.status(404).json({ error: "Partner not found" });
    }
    res.json(partner);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to update partner" });
  }
});

router.delete("/partners/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await crmStorage.deletePartner(Number(req.params.id));
    if (!deleted) {
      return res.status(404).json({ error: "Partner not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete partner" });
  }
});

router.get("/partners/:id/certifications", requireAuth, async (req, res) => {
  try {
    const certs = await crmStorage.getPartnerCertifications(Number(req.params.id));
    res.json(certs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch certifications" });
  }
});

router.post("/partners/:id/certifications", requireAuth, async (req, res) => {
  try {
    const data = insertCrmPartnerCertificationSchema.parse({ ...req.body, partnerId: Number(req.params.id) });
    const cert = await crmStorage.createCertification(data);
    res.status(201).json(cert);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to create certification" });
  }
});

router.get("/partners/:id/performance", requireAuth, async (req, res) => {
  try {
    const perf = await crmStorage.getPartnerPerformance(Number(req.params.id));
    res.json(perf);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch performance" });
  }
});

router.post("/partners/:id/performance", requireAuth, async (req, res) => {
  try {
    const data = insertCrmPartnerPerformanceSchema.parse({ ...req.body, partnerId: Number(req.params.id) });
    const perf = await crmStorage.createPerformance(data);
    res.status(201).json(perf);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to create performance record" });
  }
});

router.get("/contracts", requireAuth, async (req, res) => {
  try {
    const tenantId = req.query.tenantId ? Number(req.query.tenantId) : undefined;
    const partnerId = req.query.partnerId ? Number(req.query.partnerId) : undefined;
    const clientId = req.query.clientId ? Number(req.query.clientId) : undefined;
    const contracts = await crmStorage.getContracts(tenantId, partnerId, clientId);
    res.json(contracts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch contracts" });
  }
});

router.get("/contracts/:id", requireAuth, async (req, res) => {
  try {
    const contract = await crmStorage.getContract(Number(req.params.id));
    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }
    res.json(contract);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch contract" });
  }
});

router.post("/contracts", requireAuth, async (req, res) => {
  try {
    const data = insertCrmContractSchema.parse(req.body);
    const contract = await crmStorage.createContract(data);
    res.status(201).json(contract);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to create contract" });
  }
});

router.patch("/contracts/:id", requireAuth, async (req, res) => {
  try {
    const data = insertCrmContractSchema.partial().parse(req.body);
    const contract = await crmStorage.updateContract(Number(req.params.id), data);
    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }
    res.json(contract);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to update contract" });
  }
});

router.get("/contracts/:id/revenue", requireAuth, async (req, res) => {
  try {
    const schedule = await crmStorage.getRevenueSchedule(Number(req.params.id));
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch revenue schedule" });
  }
});

router.get("/channels", requireAuth, async (req, res) => {
  try {
    const tenantId = req.query.tenantId ? Number(req.query.tenantId) : undefined;
    const channels = await crmStorage.getChannels(tenantId);
    res.json(channels);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch channels" });
  }
});

router.post("/channels", requireAuth, async (req, res) => {
  try {
    const data = insertCrmChannelSchema.parse(req.body);
    const channel = await crmStorage.createChannel(data);
    res.status(201).json(channel);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to create channel" });
  }
});

router.patch("/channels/:id", requireAuth, async (req, res) => {
  try {
    const data = insertCrmChannelSchema.partial().parse(req.body);
    const channel = await crmStorage.updateChannel(Number(req.params.id), data);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }
    res.json(channel);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to update channel" });
  }
});

router.get("/threads", requireAuth, async (req, res) => {
  try {
    const tenantId = req.query.tenantId ? Number(req.query.tenantId) : undefined;
    const channelId = req.query.channelId ? Number(req.query.channelId) : undefined;
    const status = req.query.status as string | undefined;
    const threads = await crmStorage.getThreads(tenantId, channelId, status);
    res.json(threads);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch threads" });
  }
});

router.get("/threads/:id", requireAuth, async (req, res) => {
  try {
    const thread = await crmStorage.getThread(Number(req.params.id));
    if (!thread) {
      return res.status(404).json({ error: "Thread not found" });
    }
    res.json(thread);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch thread" });
  }
});

router.post("/threads", requireAuth, async (req, res) => {
  try {
    const data = insertCrmThreadSchema.parse(req.body);
    const thread = await crmStorage.createThread(data);
    res.status(201).json(thread);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to create thread" });
  }
});

router.patch("/threads/:id", requireAuth, async (req, res) => {
  try {
    const data = insertCrmThreadSchema.partial().parse(req.body);
    const thread = await crmStorage.updateThread(Number(req.params.id), data);
    if (!thread) {
      return res.status(404).json({ error: "Thread not found" });
    }
    res.json(thread);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to update thread" });
  }
});

router.get("/threads/:id/messages", requireAuth, async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const messages = await crmStorage.getMessages(Number(req.params.id), limit);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/threads/:id/messages", requireAuth, async (req, res) => {
  try {
    const data = insertCrmMessageSchema.parse({ ...req.body, threadId: Number(req.params.id) });
    const message = await crmStorage.createMessage(data);
    res.status(201).json(message);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to create message" });
  }
});

router.get("/events", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const events = await crmStorage.getEvents(userId, startDate, endDate);
    const serializedEvents = events.map(e => ({
      ...e,
      startAt: e.startAt instanceof Date ? e.startAt.toISOString() : e.startAt,
      endAt: e.endAt instanceof Date ? e.endAt.toISOString() : e.endAt,
      createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
      updatedAt: e.updatedAt instanceof Date ? e.updatedAt.toISOString() : e.updatedAt,
      completedAt: e.completedAt instanceof Date ? e.completedAt.toISOString() : e.completedAt,
    }));
    res.json(serializedEvents);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

router.post("/events", requireAuth, async (req, res) => {
  try {
    const data = insertCrmEventSchema.parse({ ...req.body, userId: req.user!.id });
    const event = await crmStorage.createEvent(data);
    res.status(201).json(event);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to create event" });
  }
});

router.patch("/events/:id", requireAuth, async (req, res) => {
  try {
    const data = insertCrmEventSchema.partial().parse(req.body);
    const event = await crmStorage.updateEvent(Number(req.params.id), data);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json(event);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to update event" });
  }
});

router.delete("/events/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await crmStorage.deleteEvent(Number(req.params.id));
    if (!deleted) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete event" });
  }
});

router.get("/commission-rules", requireAuth, async (req, res) => {
  try {
    const rules = await crmStorage.getCommissionRules();
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch commission rules" });
  }
});

router.post("/commission-rules", requireAuth, async (req, res) => {
  try {
    const data = insertCrmCommissionRuleSchema.parse(req.body);
    const rule = await crmStorage.createCommissionRule(data);
    res.status(201).json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to create commission rule" });
  }
});

router.get("/commissions", requireAuth, async (req, res) => {
  try {
    const partnerId = req.query.partnerId ? Number(req.query.partnerId) : undefined;
    const userId = req.query.userId as string | undefined;
    const commissions = await crmStorage.getCommissions(partnerId, userId);
    res.json(commissions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch commissions" });
  }
});

router.get("/stats", requireAuth, async (req, res) => {
  try {
    const tenantId = req.query.tenantId ? Number(req.query.tenantId) : undefined;
    const stats = await crmStorage.getStats(tenantId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

import { commissionEngine } from "./commission-engine";

router.post("/channels/:id/whatsapp/connect", requireAuth, async (req, res) => {
  try {
    const channelId = Number(req.params.id);
    const tenantId = req.body.tenantId || 1;
    const channelName = req.body.name || "WhatsApp Principal";
    const channel = await communicationService.connectWhatsAppChannel(channelId, tenantId, channelName);
    res.json(channel);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to connect WhatsApp" });
  }
});

router.post("/channels/whatsapp/new", requireAuth, async (req, res) => {
  try {
    const tenantId = req.body.tenantId || 1;
    const channelName = req.body.name || "WhatsApp Principal";
    const channel = await communicationService.connectNewWhatsAppChannel(tenantId, channelName);
    res.json(channel);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create WhatsApp channel" });
  }
});

router.post("/channels/:id/whatsapp/disconnect", requireAuth, async (req, res) => {
  try {
    await communicationService.disconnectWhatsAppChannel(Number(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to disconnect WhatsApp" });
  }
});

router.post("/threads/:id/send", requireAuth, async (req, res) => {
  try {
    const { content, type } = req.body;
    if (!content) {
      return res.status(400).json({ error: "content is required" });
    }
    const message = await communicationService.sendMessage(
      Number(req.params.id),
      content,
      req.user!.id,
      type || "text",
      "whatsapp"
    );
    res.status(201).json(message);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to send message" });
  }
});

router.post("/threads/:id/read", requireAuth, async (req, res) => {
  try {
    await communicationService.markThreadRead(Number(req.params.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark thread as read" });
  }
});

router.post("/threads/:id/assign", requireAuth, async (req, res) => {
  try {
    const { assignedToId } = req.body;
    if (!assignedToId) {
      return res.status(400).json({ error: "assignedToId is required" });
    }
    await communicationService.assignThread(Number(req.params.id), assignedToId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to assign thread" });
  }
});

router.post("/threads/:id/close", requireAuth, async (req, res) => {
  try {
    await communicationService.closeThread(Number(req.params.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to close thread" });
  }
});

router.post("/threads/:id/reopen", requireAuth, async (req, res) => {
  try {
    await communicationService.reopenThread(Number(req.params.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to reopen thread" });
  }
});

router.get("/quick-messages", requireAuth, async (req, res) => {
  try {
    const tenantId = req.query.tenantId ? Number(req.query.tenantId) : undefined;
    const messages = await communicationService.getQuickMessages(tenantId, req.user!.id);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch quick messages" });
  }
});

router.post("/quick-messages", requireAuth, async (req, res) => {
  try {
    const { tenantId, shortcut, title, content, category, isGlobal } = req.body;
    if (!shortcut || !title || !content) {
      return res.status(400).json({ error: "shortcut, title, and content are required" });
    }
    const message = await communicationService.createQuickMessage(
      tenantId,
      req.user!.id,
      shortcut,
      title,
      content,
      category,
      isGlobal
    );
    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ error: "Failed to create quick message" });
  }
});

router.get("/threads/stats", requireAuth, async (req, res) => {
  try {
    const tenantId = req.query.tenantId ? Number(req.query.tenantId) : undefined;
    const stats = await communicationService.getThreadStats(tenantId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch thread stats" });
  }
});

router.post("/commission-rules/seed", requireAuth, async (req, res) => {
  try {
    await commissionEngine.seedDefaultRules();
    res.json({ success: true, message: "Default commission rules created" });
  } catch (error) {
    res.status(500).json({ error: "Failed to seed commission rules" });
  }
});

router.post("/contracts/:id/process-commissions", requireAuth, async (req, res) => {
  try {
    const salesUserId = req.body.salesUserId || req.user!.id;
    const processed = await commissionEngine.processContractCommissions(Number(req.params.id), salesUserId);
    res.json({ success: true, processed });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to process commissions" });
  }
});

router.get("/commissions/summary", requireAuth, async (req, res) => {
  try {
    const partnerId = req.query.partnerId ? Number(req.query.partnerId) : undefined;
    const userId = req.query.userId as string | undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const summary = await commissionEngine.getCommissionSummary(partnerId, userId, startDate, endDate);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch commission summary" });
  }
});

router.post("/commissions/:id/mark-paid", requireAuth, async (req, res) => {
  try {
    await commissionEngine.markCommissionPaid(Number(req.params.id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark commission as paid" });
  }
});

router.post("/contracts/:id/extend-schedule", requireAuth, async (req, res) => {
  try {
    const monthsAhead = req.body.monthsAhead || 12;
    const schedules = await commissionEngine.extendRevenueSchedule(Number(req.params.id), monthsAhead);
    res.json({ success: true, schedules });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to extend schedule" });
  }
});

router.post("/contracts/extend-all", requireAuth, async (req, res) => {
  try {
    const monthsAhead = req.body.monthsAhead || 12;
    const extended = await commissionEngine.extendAllActiveContracts(monthsAhead);
    res.json({ success: true, extended });
  } catch (error) {
    res.status(500).json({ error: "Failed to extend schedules" });
  }
});

import { googleCalendarService } from "./google-calendar";

router.get("/google/auth", requireAuth, (req, res) => {
  try {
    const authUrl = googleCalendarService.getAuthUrl(req.user!.id);
    res.json({ url: authUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get auth URL" });
  }
});

router.get("/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.status(400).send("Missing code or state");
    }
    await googleCalendarService.handleCallback(code as string, state as string);
    res.redirect("/crm?google_connected=true");
  } catch (error: any) {
    res.status(500).send(`Failed to connect: ${error.message}`);
  }
});

router.get("/google/status", requireAuth, async (req, res) => {
  try {
    const connected = await googleCalendarService.isConnected(req.user!.id);
    res.json({ connected });
  } catch (error) {
    res.status(500).json({ error: "Failed to check status" });
  }
});

router.post("/google/disconnect", requireAuth, async (req, res) => {
  try {
    await googleCalendarService.disconnect(req.user!.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

router.post("/google/sync", requireAuth, async (req, res) => {
  try {
    const startDate = req.body.startDate ? new Date(req.body.startDate) : new Date();
    const endDate = req.body.endDate ? new Date(req.body.endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await googleCalendarService.syncEvents(req.user!.id, startDate, endDate);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to sync events" });
  }
});

router.get("/google/events", requireAuth, async (req, res) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const events = await googleCalendarService.getEvents(req.user!.id, startDate, endDate);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

router.post("/google/events", requireAuth, async (req, res) => {
  try {
    const data = insertCrmEventSchema.parse(req.body);
    const event = await crmStorage.createEvent({ ...data, userId: req.user!.id });
    
    const isConnected = await googleCalendarService.isConnected(req.user!.id);
    if (isConnected) {
      const googleEventId = await googleCalendarService.createEvent(req.user!.id, event);
      if (googleEventId) {
        await crmStorage.updateEvent(event.id, { googleEventId });
      }
    }
    
    res.status(201).json(event);
  } catch (error: any) {
    if (error.errors) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to create event" });
  }
});

router.put("/events/:id", requireAuth, async (req, res) => {
  try {
    const event = await crmStorage.updateEvent(Number(req.params.id), req.body);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    
    if (event.googleEventId) {
      await googleCalendarService.updateEvent(req.user!.id, event.googleEventId, event);
    }
    
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: "Failed to update event" });
  }
});

router.delete("/events/:id", requireAuth, async (req, res) => {
  try {
    const event = await crmStorage.getEvent(Number(req.params.id));
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    
    if (event.googleEventId) {
      await googleCalendarService.deleteEvent(req.user!.id, event.googleEventId);
    }
    
    await crmStorage.deleteEvent(event.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete event" });
  }
});

// ========== PRODUCTS ==========
router.get("/products", requireAuth, async (req, res) => {
  try {
    const tenantId = req.query.tenantId ? Number(req.query.tenantId) : undefined;
    const products = await crmStorage.getProducts(tenantId);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.get("/products/:id", requireAuth, async (req, res) => {
  try {
    const product = await crmStorage.getProduct(Number(req.params.id));
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

router.post("/products", requireAuth, async (req, res) => {
  try {
    const data = insertCrmProductSchema.parse(req.body);
    const product = await crmStorage.createProduct(data);
    res.status(201).json(product);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to create product" });
  }
});

router.patch("/products/:id", requireAuth, async (req, res) => {
  try {
    const data = insertCrmProductSchema.partial().parse(req.body);
    const product = await crmStorage.updateProduct(Number(req.params.id), data);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update product" });
  }
});

router.delete("/products/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await crmStorage.deleteProduct(Number(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Product not found" });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// ========== CLIENTS ==========
router.get("/clients", requireAuth, async (req, res) => {
  try {
    const tenantId = req.query.tenantId ? Number(req.query.tenantId) : undefined;
    const user = req.user as any;
    const allowedModules = user?.allowedModules || user?.profile?.allowedModules || [];
    const isAdmin = user?.role === "admin" || allowedModules.includes("admin");
    const partnerId = !isAdmin && user?.partnerId ? Number(user.partnerId) : undefined;
    const userId = !isAdmin && user?.partnerId ? user.id : undefined;
    const clients = await crmStorage.getClients(tenantId, partnerId, userId);
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch clients" });
  }
});

router.get("/clients/:id", requireAuth, async (req, res) => {
  try {
    const client = await crmStorage.getClient(Number(req.params.id));
    if (!client) return res.status(404).json({ error: "Client not found" });
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch client" });
  }
});

router.post("/clients", requireAuth, async (req, res) => {
  try {
    const data = insertCrmClientSchema.parse(req.body);
    const client = await crmStorage.createClient(data);
    res.status(201).json(client);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to create client" });
  }
});

router.patch("/clients/:id", requireAuth, async (req, res) => {
  try {
    const data = insertCrmClientSchema.partial().parse(req.body);
    const client = await crmStorage.updateClient(Number(req.params.id), data);
    if (!client) return res.status(404).json({ error: "Client not found" });
    res.json(client);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update client" });
  }
});

router.delete("/clients/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await crmStorage.deleteClient(Number(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Client not found" });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete client" });
  }
});

router.post("/partners/:id/convert-to-client", requireAuth, async (req, res) => {
  try {
    const partnerId = Number(req.params.id);
    const additionalData = req.body || {};
    const client = await crmStorage.convertPartnerToClient(partnerId, additionalData);
    if (!client) return res.status(404).json({ error: "Partner not found" });
    res.status(201).json(client);
  } catch (error) {
    res.status(500).json({ error: "Failed to convert partner to client" });
  }
});

// ========== PIPELINE STAGES ==========
router.get("/pipeline-stages", requireAuth, async (req, res) => {
  try {
    const tenantId = req.query.tenantId ? Number(req.query.tenantId) : undefined;
    const stages = await crmStorage.getPipelineStages(tenantId);
    res.json(stages);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch pipeline stages" });
  }
});

router.post("/pipeline-stages", requireAuth, async (req, res) => {
  try {
    const data = insertCrmPipelineStageSchema.parse(req.body);
    const stage = await crmStorage.createPipelineStage(data);
    res.status(201).json(stage);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to create pipeline stage" });
  }
});

router.patch("/pipeline-stages/:id", requireAuth, async (req, res) => {
  try {
    const data = insertCrmPipelineStageSchema.partial().parse(req.body);
    const stage = await crmStorage.updatePipelineStage(Number(req.params.id), data);
    if (!stage) return res.status(404).json({ error: "Stage not found" });
    res.json(stage);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update pipeline stage" });
  }
});

router.delete("/pipeline-stages/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await crmStorage.deletePipelineStage(Number(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Stage not found" });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete pipeline stage" });
  }
});

// ========== LEADS ==========
router.get("/leads", requireAuth, async (req, res) => {
  try {
    const tenantId = req.query.tenantId ? Number(req.query.tenantId) : undefined;
    const status = req.query.status as string | undefined;
    const leads = await crmStorage.getLeads(tenantId, status);
    res.json(leads);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch leads" });
  }
});

router.get("/leads/:id", requireAuth, async (req, res) => {
  try {
    const lead = await crmStorage.getLead(Number(req.params.id));
    if (!lead) return res.status(404).json({ error: "Lead not found" });
    res.json(lead);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch lead" });
  }
});

router.post("/leads", requireAuth, async (req, res) => {
  try {
    const data = insertCrmLeadSchema.parse({ ...req.body, userId: req.user!.id });
    const lead = await crmStorage.createLead(data);
    res.status(201).json(lead);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to create lead" });
  }
});

router.patch("/leads/:id", requireAuth, async (req, res) => {
  try {
    const data = insertCrmLeadSchema.partial().parse(req.body);
    const lead = await crmStorage.updateLead(Number(req.params.id), data);
    if (!lead) return res.status(404).json({ error: "Lead not found" });
    res.json(lead);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update lead" });
  }
});

router.delete("/leads/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await crmStorage.deleteLead(Number(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Lead not found" });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete lead" });
  }
});

router.post("/leads/:id/convert", requireAuth, async (req, res) => {
  try {
    const leadId = Number(req.params.id);
    const lead = await crmStorage.getLead(leadId);
    if (!lead) return res.status(404).json({ error: "Lead not found" });
    
    const opportunityData = insertCrmOpportunitySchema.parse({
      tenantId: lead.tenantId,
      userId: req.user!.id,
      name: req.body.name || `Oportunidade - ${lead.name}`,
      description: req.body.description || lead.notes,
      stageId: req.body.stageId,
      value: req.body.value || 0,
      expectedCloseDate: req.body.expectedCloseDate,
      assignedTo: lead.assignedTo || req.user!.id,
    });
    
    const opportunity = await crmStorage.convertLeadToOpportunity(leadId, opportunityData);
    res.status(201).json(opportunity);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to convert lead" });
  }
});

// ========== OPPORTUNITIES ==========
router.get("/opportunities", requireAuth, async (req, res) => {
  try {
    const tenantId = req.query.tenantId ? Number(req.query.tenantId) : undefined;
    const stageId = req.query.stageId ? Number(req.query.stageId) : undefined;
    const status = req.query.status as string | undefined;
    const opportunities = await crmStorage.getOpportunities(tenantId, stageId, status);
    res.json(opportunities);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch opportunities" });
  }
});

router.get("/opportunities/:id", requireAuth, async (req, res) => {
  try {
    const opportunity = await crmStorage.getOpportunity(Number(req.params.id));
    if (!opportunity) return res.status(404).json({ error: "Opportunity not found" });
    res.json(opportunity);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch opportunity" });
  }
});

router.post("/opportunities", requireAuth, async (req, res) => {
  try {
    const data = insertCrmOpportunitySchema.parse({ ...req.body, userId: req.user!.id });
    const opportunity = await crmStorage.createOpportunity(data);
    res.status(201).json(opportunity);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to create opportunity" });
  }
});

router.patch("/opportunities/:id", requireAuth, async (req, res) => {
  try {
    const data = insertCrmOpportunitySchema.partial().parse(req.body);
    const opportunity = await crmStorage.updateOpportunity(Number(req.params.id), data);
    if (!opportunity) return res.status(404).json({ error: "Opportunity not found" });
    res.json(opportunity);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to update opportunity" });
  }
});

router.delete("/opportunities/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await crmStorage.deleteOpportunity(Number(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Opportunity not found" });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete opportunity" });
  }
});

router.patch("/opportunities/:id/stage", requireAuth, async (req, res) => {
  try {
    const { stageId } = req.body;
    if (!stageId) return res.status(400).json({ error: "stageId is required" });
    const opportunity = await crmStorage.moveOpportunityToStage(Number(req.params.id), stageId);
    if (!opportunity) return res.status(404).json({ error: "Opportunity not found" });
    res.json(opportunity);
  } catch (error) {
    res.status(500).json({ error: "Failed to move opportunity" });
  }
});

router.post("/opportunities/:id/won", requireAuth, async (req, res) => {
  try {
    const opportunity = await crmStorage.updateOpportunity(Number(req.params.id), { status: "won" });
    if (!opportunity) return res.status(404).json({ error: "Opportunity not found" });
    res.json(opportunity);
  } catch (error) {
    res.status(500).json({ error: "Failed to mark opportunity as won" });
  }
});

router.post("/opportunities/:id/lost", requireAuth, async (req, res) => {
  try {
    const { lossReason } = req.body;
    const opportunity = await crmStorage.updateOpportunity(Number(req.params.id), { status: "lost", lossReason });
    if (!opportunity) return res.status(404).json({ error: "Opportunity not found" });
    res.json(opportunity);
  } catch (error) {
    res.status(500).json({ error: "Failed to mark opportunity as lost" });
  }
});

// ========== OPPORTUNITY PRODUCTS ==========
router.get("/opportunities/:id/products", requireAuth, async (req, res) => {
  try {
    const products = await crmStorage.getOpportunityProducts(Number(req.params.id));
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch opportunity products" });
  }
});

router.post("/opportunities/:id/products", requireAuth, async (req, res) => {
  try {
    const data = insertCrmOpportunityProductSchema.parse({ ...req.body, opportunityId: Number(req.params.id) });
    const product = await crmStorage.addProductToOpportunity(data);
    res.status(201).json(product);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Failed to add product to opportunity" });
  }
});

router.delete("/opportunity-products/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await crmStorage.removeProductFromOpportunity(Number(req.params.id));
    if (!deleted) return res.status(404).json({ error: "Product not found" });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to remove product from opportunity" });
  }
});

// ========== OPPORTUNITY APPROVAL & PROJECT CREATION ==========
router.post("/opportunities/:id/approve", requireAuth, async (req, res) => {
  try {
    const opportunity = await crmStorage.getOpportunity(Number(req.params.id));
    if (!opportunity) return res.status(404).json({ error: "Opportunity not found" });
    
    if (opportunity.approvalStatus === "approved") {
      return res.status(400).json({ error: "Opportunity already approved" });
    }

    const updated = await crmStorage.updateOpportunity(Number(req.params.id), {
      approvalStatus: "approved",
      approvedAt: new Date(),
      approvedBy: req.user!.id,
      status: "won"
    });
    
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to approve opportunity" });
  }
});

router.post("/opportunities/:id/reject", requireAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    const opportunity = await crmStorage.getOpportunity(Number(req.params.id));
    if (!opportunity) return res.status(404).json({ error: "Opportunity not found" });
    
    const updated = await crmStorage.updateOpportunity(Number(req.params.id), {
      approvalStatus: "rejected",
      lossReason: reason,
      status: "lost"
    });
    
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to reject opportunity" });
  }
});

router.post("/opportunities/:id/open-project", requireAuth, async (req, res) => {
  try {
    const opportunity = await crmStorage.getOpportunity(Number(req.params.id));
    if (!opportunity) return res.status(404).json({ error: "Opportunity not found" });
    
    if (opportunity.approvalStatus !== "approved") {
      return res.status(400).json({ error: "Opportunity must be approved before opening a project" });
    }

    if (opportunity.processCompassProjectId) {
      return res.status(400).json({ error: "Project already created for this opportunity" });
    }

    const { tenantId, clientId } = req.body;
    if (!tenantId || !clientId) {
      return res.status(400).json({ error: "tenantId and clientId are required" });
    }

    const project = await crmStorage.createProcessCompassProject({
      tenantId,
      clientId,
      userId: req.user!.id,
      name: `Projeto: ${opportunity.name}`,
      description: opportunity.description || `Projeto originado da oportunidade #${opportunity.id}`,
      status: "backlog"
    });

    const updated = await crmStorage.updateOpportunity(Number(req.params.id), {
      processCompassProjectId: project.id
    });

    res.json({ opportunity: updated, project });
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ error: "Failed to create project" });
  }
});

router.post("/opportunities/:id/bill", requireAuth, async (req, res) => {
  try {
    const opportunity = await crmStorage.getOpportunity(Number(req.params.id));
    if (!opportunity) return res.status(404).json({ error: "Opportunity not found" });
    
    if (opportunity.approvalStatus !== "approved") {
      return res.status(400).json({ error: "Opportunity must be approved before billing" });
    }

    const updated = await crmStorage.updateOpportunity(Number(req.params.id), {
      billingStatus: "pending"
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update billing status" });
  }
});

// ========== CRM STATS ==========
router.get("/stats/sales", requireAuth, async (req, res) => {
  try {
    const tenantId = req.query.tenantId ? Number(req.query.tenantId) : undefined;
    const stats = await crmStorage.getCrmStats(tenantId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch CRM stats" });
  }
});

// ========== Frappe Connector Routes ==========
router.get("/frappe/connectors", requireAuth, async (req, res) => {
  try {
    const tenantId = req.query.tenantId ? Number(req.query.tenantId) : undefined;
    const connectors = await crmStorage.getFrappeConnectors(tenantId);
    const safeConnectors = connectors.map(({ apiKey, apiSecret, ...rest }) => ({
      ...rest,
      hasCredentials: Boolean(apiKey && apiSecret),
    }));
    res.json(safeConnectors);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch Frappe connectors" });
  }
});

router.get("/frappe/connectors/:id", requireAuth, async (req, res) => {
  try {
    const connector = await crmStorage.getFrappeConnector(Number(req.params.id));
    if (!connector) {
      return res.status(404).json({ error: "Connector not found" });
    }
    const { apiKey, apiSecret, ...safeConnector } = connector;
    res.json({ ...safeConnector, hasCredentials: Boolean(apiKey && apiSecret) });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch connector" });
  }
});

router.post("/frappe/connectors", requireAuth, async (req, res) => {
  try {
    const data = insertCrmFrappeConnectorSchema.parse(req.body);
    const connector = await crmStorage.createFrappeConnector(data);
    const { apiKey, apiSecret, ...safeConnector } = connector;
    res.status(201).json({ ...safeConnector, hasCredentials: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to create connector" });
  }
});

router.patch("/frappe/connectors/:id", requireAuth, async (req, res) => {
  try {
    const data = insertCrmFrappeConnectorSchema.partial().parse(req.body);
    const connector = await crmStorage.updateFrappeConnector(Number(req.params.id), data);
    if (!connector) {
      return res.status(404).json({ error: "Connector not found" });
    }
    const { apiKey, apiSecret, ...safeConnector } = connector;
    res.json({ ...safeConnector, hasCredentials: Boolean(apiKey && apiSecret) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to update connector" });
  }
});

router.delete("/frappe/connectors/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await crmStorage.deleteFrappeConnector(Number(req.params.id));
    if (!deleted) {
      return res.status(404).json({ error: "Connector not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete connector" });
  }
});

router.post("/frappe/connectors/:id/test", requireAuth, async (req, res) => {
  try {
    const frappeService = await createFrappeService(Number(req.params.id));
    if (!frappeService) {
      return res.status(404).json({ error: "Connector not found" });
    }
    const result = await frappeService.testConnection();
    
    await crmStorage.updateFrappeConnector(Number(req.params.id), {
      status: result.success ? "active" : "error",
      errorMessage: result.error || null,
    });
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/frappe/connectors/:id/sync", requireAuth, async (req, res) => {
  try {
    const connectorId = Number(req.params.id);
    const { entities } = req.body;
    
    const frappeService = await createFrappeService(connectorId);
    if (!frappeService) {
      return res.status(404).json({ error: "Connector not found" });
    }

    const syncLog = await crmStorage.createSyncLog({
      connectorId,
      syncType: "push",
      status: "running",
    });

    const results: Record<string, any> = {};
    let totalSuccess = 0;
    let totalFailed = 0;
    const allErrors: string[] = [];

    if (!entities || entities.includes("leads")) {
      const leads = await crmStorage.getLeads();
      const leadResult = await frappeService.syncLeadsToFrappe(leads);
      results.leads = leadResult;
      totalSuccess += leadResult.success;
      totalFailed += leadResult.failed;
      allErrors.push(...leadResult.errors);
    }

    if (!entities || entities.includes("opportunities")) {
      const opportunities = await crmStorage.getOpportunities();
      const oppResult = await frappeService.syncOpportunitiesToFrappe(opportunities);
      results.opportunities = oppResult;
      totalSuccess += oppResult.success;
      totalFailed += oppResult.failed;
      allErrors.push(...oppResult.errors);
    }

    if (!entities || entities.includes("products")) {
      const products = await crmStorage.getProducts();
      const productResult = await frappeService.syncProductsToFrappe(products);
      results.products = productResult;
      totalSuccess += productResult.success;
      totalFailed += productResult.failed;
      allErrors.push(...productResult.errors);
    }

    if (!entities || entities.includes("partners")) {
      const partners = await crmStorage.getPartners();
      const partnerResult = await frappeService.syncPartnersToFrappe(partners);
      results.partners = partnerResult;
      totalSuccess += partnerResult.success;
      totalFailed += partnerResult.failed;
      allErrors.push(...partnerResult.errors);
    }

    await crmStorage.updateSyncLog(syncLog.id, {
      status: totalFailed > 0 ? "completed_with_errors" : "completed",
      recordsProcessed: totalSuccess + totalFailed,
      recordsSuccess: totalSuccess,
      recordsFailed: totalFailed,
      errorDetails: allErrors.length > 0 ? allErrors.join("\n") : null,
      completedAt: new Date(),
    });

    await crmStorage.updateFrappeConnector(connectorId, {
      lastSyncAt: new Date(),
    });

    res.json({ success: true, results, totalSuccess, totalFailed });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/frappe/connectors/:id/logs", requireAuth, async (req, res) => {
  try {
    const logs = await crmStorage.getSyncLogs(Number(req.params.id));
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sync logs" });
  }
});

router.get("/frappe/connectors/:id/mappings", requireAuth, async (req, res) => {
  try {
    const mappings = await crmStorage.getFrappeMappings(Number(req.params.id));
    res.json(mappings);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch mappings" });
  }
});

router.post("/frappe/connectors/:id/mappings", requireAuth, async (req, res) => {
  try {
    const data = insertCrmFrappeMappingSchema.parse({
      ...req.body,
      connectorId: Number(req.params.id),
    });
    const mapping = await crmStorage.createFrappeMapping(data);
    res.status(201).json(mapping);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to create mapping" });
  }
});

// ========== PROPOSALS (PROPOSTAS COMERCIAIS) ==========
router.get("/proposals", requireAuth, async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] ? Number(req.headers["x-tenant-id"]) : 1;
    const proposals = await crmStorage.getProposals(tenantId);
    res.json(proposals);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch proposals" });
  }
});

router.get("/proposals/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] ? Number(req.headers["x-tenant-id"]) : 1;
    const proposal = await crmStorage.getProposal(Number(req.params.id), tenantId);
    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found" });
    }
    res.json(proposal);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch proposal" });
  }
});

router.get("/opportunities/:id/proposals", requireAuth, async (req, res) => {
  try {
    const proposals = await crmStorage.getProposalsByOpportunity(Number(req.params.id));
    res.json(proposals);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch proposals" });
  }
});

router.post("/proposals", requireAuth, async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] ? Number(req.headers["x-tenant-id"]) : 1;
    const userId = (req.user as any)?.id;
    const body = { ...req.body };
    // Coerce string dates → Date
    if (body.validUntil && typeof body.validUntil === "string") {
      body.validUntil = new Date(body.validUntil);
    }
    // Ensure totalValue is a number
    if (body.totalValue !== undefined) {
      body.totalValue = Number(body.totalValue) || 0;
    }
    const data = insertCrmProposalSchema.parse({ ...body, tenantId, createdById: userId });
    const proposal = await crmStorage.createProposal(data);
    res.status(201).json(proposal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to create proposal" });
  }
});

router.patch("/proposals/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] ? Number(req.headers["x-tenant-id"]) : 1;
    const proposal = await crmStorage.updateProposal(Number(req.params.id), tenantId, req.body);
    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found" });
    }
    res.json(proposal);
  } catch (error) {
    res.status(500).json({ error: "Failed to update proposal" });
  }
});

router.delete("/proposals/:id", requireAuth, async (req, res) => {
  try {
    const tenantId = req.headers["x-tenant-id"] ? Number(req.headers["x-tenant-id"]) : 1;
    const deleted = await crmStorage.deleteProposal(Number(req.params.id), tenantId);
    if (!deleted) {
      return res.status(404).json({ error: "Proposal not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete proposal" });
  }
});

// ========== PROPOSAL ITEMS ==========
router.get("/proposals/:id/items", requireAuth, async (req, res) => {
  try {
    const items = await crmStorage.getProposalItems(Number(req.params.id));
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch proposal items" });
  }
});

router.post("/proposals/:id/items", requireAuth, async (req, res) => {
  try {
    const data = insertCrmProposalItemSchema.parse({ ...req.body, proposalId: Number(req.params.id) });
    const item = await crmStorage.createProposalItem(data);
    res.status(201).json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to create proposal item" });
  }
});

router.patch("/proposal-items/:id", requireAuth, async (req, res) => {
  try {
    const item = await crmStorage.updateProposalItem(Number(req.params.id), req.body);
    if (!item) {
      return res.status(404).json({ error: "Proposal item not found" });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: "Failed to update proposal item" });
  }
});

router.delete("/proposal-items/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await crmStorage.deleteProposalItem(Number(req.params.id));
    if (!deleted) {
      return res.status(404).json({ error: "Proposal item not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete proposal item" });
  }
});

// ========== CONTRACT MILESTONES ==========
router.get("/contracts/:id/milestones", requireAuth, async (req, res) => {
  try {
    const milestones = await crmStorage.getContractMilestones(Number(req.params.id));
    res.json(milestones);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch contract milestones" });
  }
});

router.post("/contracts/:id/milestones", requireAuth, async (req, res) => {
  try {
    const data = insertCrmContractMilestoneSchema.parse({ ...req.body, contractId: Number(req.params.id) });
    const milestone = await crmStorage.createContractMilestone(data);
    res.status(201).json(milestone);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to create milestone" });
  }
});

router.patch("/milestones/:id", requireAuth, async (req, res) => {
  try {
    const milestone = await crmStorage.updateContractMilestone(Number(req.params.id), req.body);
    if (!milestone) {
      return res.status(404).json({ error: "Milestone not found" });
    }
    res.json(milestone);
  } catch (error) {
    res.status(500).json({ error: "Failed to update milestone" });
  }
});

router.delete("/milestones/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await crmStorage.deleteContractMilestone(Number(req.params.id));
    if (!deleted) {
      return res.status(404).json({ error: "Milestone not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete milestone" });
  }
});

export default router;
