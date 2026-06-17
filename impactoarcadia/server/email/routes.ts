import { Router, type Request, type Response } from "express";
import { emailService } from "./service";

const router = Router();

function requireAuth(req: Request, res: Response): boolean {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

async function verifyAccountOwnership(req: Request, accountId: number): Promise<boolean> {
  if (!req.user) return false;
  const accounts = await emailService.getAccounts(req.user.id);
  return accounts.some(a => a.id === accountId);
}

async function getAccountIdForMessage(messageId: number): Promise<number | null> {
  const message = await emailService.getMessage(messageId);
  return message?.accountId || null;
}

router.get("/accounts", async (req: Request, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    const accounts = await emailService.getAccounts(req.user!.id);
    res.json(accounts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/accounts/connect", async (req: Request, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    const { email, password, provider, displayName } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const account = await emailService.connectAccount(
      req.user!.id,
      undefined,
      email,
      password,
      provider || "gmail",
      displayName
    );
    
    res.json(account);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/accounts/:id/disconnect", async (req: Request, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    const accountId = parseInt(req.params.id);
    
    if (!await verifyAccountOwnership(req, accountId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    await emailService.disconnectAccount(accountId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/accounts/:id/sync", async (req: Request, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    const accountId = parseInt(req.params.id);
    
    if (!await verifyAccountOwnership(req, accountId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const folder = req.body.folder || "INBOX";
    await emailService.fetchEmails(accountId, folder);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/accounts/:id/folders", async (req: Request, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    const accountId = parseInt(req.params.id);
    
    if (!await verifyAccountOwnership(req, accountId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const folders = await emailService.getFolders(accountId);
    res.json(folders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/accounts/:id/messages", async (req: Request, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    const accountId = parseInt(req.params.id);
    
    if (!await verifyAccountOwnership(req, accountId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const folderId = req.query.folderId ? parseInt(req.query.folderId as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    
    const messages = await emailService.getMessages(accountId, folderId, limit);
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/messages/:id", async (req: Request, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    const messageId = parseInt(req.params.id);
    
    const accountId = await getAccountIdForMessage(messageId);
    if (!accountId || !await verifyAccountOwnership(req, accountId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const message = await emailService.getMessage(messageId);
    
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    
    await emailService.markAsRead(messageId);
    res.json(message);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/messages/send", async (req: Request, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    const { accountId, to, cc, bcc, subject, body, isHtml, replyToMessageId } = req.body;
    
    if (!accountId || !to || !subject || !body) {
      return res.status(400).json({ error: "accountId, to, subject, and body are required" });
    }

    if (!await verifyAccountOwnership(req, accountId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const message = await emailService.sendEmail({
      accountId,
      to,
      cc,
      bcc,
      subject,
      body,
      isHtml,
      replyToMessageId,
    });
    
    res.json(message);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/messages/:id/read", async (req: Request, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    const messageId = parseInt(req.params.id);
    
    const accountId = await getAccountIdForMessage(messageId);
    if (!accountId || !await verifyAccountOwnership(req, accountId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    await emailService.markAsRead(messageId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/messages/:id/star", async (req: Request, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    const messageId = parseInt(req.params.id);
    
    const accountId = await getAccountIdForMessage(messageId);
    if (!accountId || !await verifyAccountOwnership(req, accountId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const { starred } = req.body;
    await emailService.markAsStarred(messageId, starred !== false);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/messages/:id/trash", async (req: Request, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    const messageId = parseInt(req.params.id);
    
    const accountId = await getAccountIdForMessage(messageId);
    if (!accountId || !await verifyAccountOwnership(req, accountId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    await emailService.moveToTrash(messageId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/messages/:id", async (req: Request, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    const messageId = parseInt(req.params.id);
    
    const accountId = await getAccountIdForMessage(messageId);
    if (!accountId || !await verifyAccountOwnership(req, accountId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    await emailService.deletePermanently(messageId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/accounts/:id/unread", async (req: Request, res: Response) => {
  try {
    if (!requireAuth(req, res)) return;
    const accountId = parseInt(req.params.id);
    
    if (!await verifyAccountOwnership(req, accountId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const count = await emailService.getUnreadCount(accountId);
    res.json({ unreadCount: count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
