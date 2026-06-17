import nodemailer from "nodemailer";
import Imap from "imap";
import { simpleParser, type ParsedMail } from "mailparser";
import { db } from "../../db/index";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  emailAccounts,
  emailMessages,
  emailFolders,
} from "@shared/schema";

type EmailAccount = typeof emailAccounts.$inferSelect;
type EmailMessage = typeof emailMessages.$inferSelect;

interface EmailConfig {
  email: string;
  password: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  useTls: boolean;
}

interface SendEmailParams {
  accountId: number;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  isHtml?: boolean;
  replyToMessageId?: number;
}

class EmailService {
  private imapConnections: Map<number, Imap> = new Map();
  private pollingIntervals: Map<number, NodeJS.Timeout> = new Map();

  getProviderConfig(provider: string): Partial<EmailConfig> {
    const configs: Record<string, Partial<EmailConfig>> = {
      gmail: {
        imapHost: "imap.gmail.com",
        imapPort: 993,
        smtpHost: "smtp.gmail.com",
        smtpPort: 587,
        useTls: true,
      },
      outlook: {
        imapHost: "outlook.office365.com",
        imapPort: 993,
        smtpHost: "smtp.office365.com",
        smtpPort: 587,
        useTls: true,
      },
      yahoo: {
        imapHost: "imap.mail.yahoo.com",
        imapPort: 993,
        smtpHost: "smtp.mail.yahoo.com",
        smtpPort: 587,
        useTls: true,
      },
    };
    return configs[provider] || {};
  }

  async connectAccount(
    userId: string,
    tenantId: number | undefined,
    email: string,
    password: string,
    provider: string = "gmail",
    displayName?: string
  ): Promise<EmailAccount> {
    const providerConfig = this.getProviderConfig(provider);
    
    const config: EmailConfig = {
      email,
      password,
      imapHost: providerConfig.imapHost || "imap.gmail.com",
      imapPort: providerConfig.imapPort || 993,
      smtpHost: providerConfig.smtpHost || "smtp.gmail.com",
      smtpPort: providerConfig.smtpPort || 587,
      useTls: providerConfig.useTls ?? true,
    };

    await this.testImapConnection(config);
    await this.testSmtpConnection(config);

    const [existing] = await db.select().from(emailAccounts)
      .where(and(eq(emailAccounts.userId, userId), eq(emailAccounts.email, email)));
    
    if (existing) {
      const [updated] = await db.update(emailAccounts)
        .set({
          password,
          imapHost: config.imapHost,
          imapPort: config.imapPort,
          smtpHost: config.smtpHost,
          smtpPort: config.smtpPort,
          status: "connected",
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(emailAccounts.id, existing.id))
        .returning();
      
      this.startPolling(updated.id);
      return updated;
    }

    const [account] = await db.insert(emailAccounts).values({
      userId,
      tenantId,
      email,
      password,
      displayName: displayName || email.split("@")[0],
      provider,
      imapHost: config.imapHost,
      imapPort: config.imapPort,
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      status: "connected",
      lastSyncAt: new Date(),
    }).returning();

    await this.createDefaultFolders(account.id);
    this.startPolling(account.id);
    
    return account;
  }

  private async testImapConnection(config: EmailConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const imap = new Imap({
        user: config.email,
        password: config.password,
        host: config.imapHost,
        port: config.imapPort,
        tls: config.useTls,
        tlsOptions: { rejectUnauthorized: false },
        connTimeout: 10000,
        authTimeout: 10000,
      });

      imap.once("ready", () => {
        imap.end();
        resolve();
      });

      imap.once("error", (err: Error) => {
        reject(new Error(`IMAP connection failed: ${err.message}`));
      });

      imap.connect();
    });
  }

  private async testSmtpConnection(config: EmailConfig): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: {
        user: config.email,
        pass: config.password,
      },
    });

    await transporter.verify();
  }

  private async createDefaultFolders(accountId: number): Promise<void> {
    const folders = [
      { name: "INBOX", type: "inbox" },
      { name: "Sent", type: "sent" },
      { name: "Drafts", type: "drafts" },
      { name: "Trash", type: "trash" },
      { name: "Spam", type: "spam" },
    ];

    for (const folder of folders) {
      await db.insert(emailFolders).values({
        accountId,
        name: folder.name,
        type: folder.type,
        unreadCount: 0,
        totalCount: 0,
      }).onConflictDoNothing();
    }
  }

  async disconnectAccount(accountId: number): Promise<void> {
    this.stopPolling(accountId);
    
    const imap = this.imapConnections.get(accountId);
    if (imap) {
      imap.end();
      this.imapConnections.delete(accountId);
    }

    await db.update(emailAccounts)
      .set({ status: "disconnected", updatedAt: new Date() })
      .where(eq(emailAccounts.id, accountId));
  }

  async sendEmail(params: SendEmailParams): Promise<EmailMessage> {
    const [account] = await db.select().from(emailAccounts)
      .where(eq(emailAccounts.id, params.accountId));
    
    if (!account) throw new Error("Email account not found");

    const transporter = nodemailer.createTransport({
      host: account.smtpHost || "smtp.gmail.com",
      port: account.smtpPort || 587,
      secure: (account.smtpPort || 587) === 465,
      auth: {
        user: account.email,
        pass: account.password || "",
      },
    } as nodemailer.TransportOptions);

    const mailOptions = {
      from: `${account.displayName || account.email} <${account.email}>`,
      to: params.to,
      cc: params.cc,
      bcc: params.bcc,
      subject: params.subject,
      [params.isHtml ? "html" : "text"]: params.body,
    };

    const info = await transporter.sendMail(mailOptions);

    const [sentFolder] = await db.select().from(emailFolders)
      .where(and(eq(emailFolders.accountId, params.accountId), eq(emailFolders.type, "sent")));

    const [message] = await db.insert(emailMessages).values({
      accountId: params.accountId,
      folderId: sentFolder?.id,
      messageId: info.messageId,
      fromAddress: account.email,
      fromName: account.displayName,
      toAddresses: [params.to],
      ccAddresses: params.cc ? [params.cc] : [],
      subject: params.subject,
      bodyText: params.isHtml ? undefined : params.body,
      bodyHtml: params.isHtml ? params.body : undefined,
      snippet: params.body.substring(0, 200),
      isRead: 1,
      isStarred: 0,
      hasAttachments: 0,
      sentAt: new Date(),
      replyToId: params.replyToMessageId,
    }).returning();

    return message;
  }

  async fetchEmails(accountId: number, folderName: string = "INBOX", limit: number = 50): Promise<void> {
    const [account] = await db.select().from(emailAccounts)
      .where(eq(emailAccounts.id, accountId));
    
    if (!account) throw new Error("Email account not found");

    const imap = new Imap({
      user: account.email,
      password: account.password || "",
      host: account.imapHost || "imap.gmail.com",
      port: account.imapPort || 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });

    return new Promise((resolve, reject) => {
      imap.once("ready", () => {
        imap.openBox(folderName, true, async (err, box) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          const totalMessages = box.messages.total;
          const start = Math.max(1, totalMessages - limit + 1);
          const fetchRange = `${start}:${totalMessages}`;

          const fetch = imap.seq.fetch(fetchRange, {
            bodies: "",
            struct: true,
          });

          const messages: ParsedMail[] = [];

          fetch.on("message", (msg) => {
            msg.on("body", (stream: any) => {
              simpleParser(stream as any, async (parseErr: any, parsed: ParsedMail) => {
                if (!parseErr) {
                  messages.push(parsed);
                }
              });
            });
          });

          fetch.once("error", (fetchErr) => {
            imap.end();
            reject(fetchErr);
          });

          fetch.once("end", async () => {
            imap.end();
            
            const [folder] = await db.select().from(emailFolders)
              .where(and(eq(emailFolders.accountId, accountId), eq(emailFolders.name, folderName)));

            for (const parsed of messages) {
              const existingMsg = await db.select().from(emailMessages)
                .where(and(
                  eq(emailMessages.accountId, accountId),
                  eq(emailMessages.messageId, parsed.messageId || "")
                ));

              if (existingMsg.length === 0 && parsed.messageId) {
                await db.insert(emailMessages).values({
                  accountId,
                  folderId: folder?.id,
                  messageId: parsed.messageId,
                  fromAddress: (Array.isArray(parsed.from?.value) ? parsed.from?.value[0]?.address : parsed.from?.value?.address) || "",
                  fromName: (Array.isArray(parsed.from?.value) ? parsed.from?.value[0]?.name : parsed.from?.value?.name) || undefined,
                  toAddresses: (Array.isArray(parsed.to) ? parsed.to : parsed.to?.value)?.map((v: any) => v.address || "") || [],
                  ccAddresses: (Array.isArray(parsed.cc) ? parsed.cc : parsed.cc?.value)?.map((v: any) => v.address || "") || [],
                  subject: parsed.subject || "(No subject)",
                  bodyText: typeof parsed.text === 'string' ? parsed.text.substring(0, 50000) : undefined,
                  bodyHtml: typeof parsed.html === 'string' ? parsed.html.substring(0, 100000) : undefined,
                  snippet: typeof parsed.text === 'string' ? parsed.text.substring(0, 200) : "",
                  isRead: 0,
                  isStarred: 0,
                  hasAttachments: (parsed.attachments?.length || 0) > 0 ? 1 : 0,
                  receivedAt: parsed.date || new Date(),
                }).catch(() => {});
              }
            }

            await db.update(emailAccounts)
              .set({ lastSyncAt: new Date(), updatedAt: new Date() })
              .where(eq(emailAccounts.id, accountId));

            resolve();
          });
        });
      });

      imap.once("error", (err: Error) => {
        reject(new Error(`IMAP error: ${err.message}`));
      });

      imap.connect();
    });
  }

  startPolling(accountId: number, intervalMs: number = 60000): void {
    this.stopPolling(accountId);
    
    const interval = setInterval(async () => {
      try {
        await this.fetchEmails(accountId);
      } catch (error) {
        console.error(`[EmailService] Polling error for account ${accountId}:`, error);
      }
    }, intervalMs);

    this.pollingIntervals.set(accountId, interval);
    console.log(`[EmailService] Started polling for account ${accountId}`);
  }

  stopPolling(accountId: number): void {
    const interval = this.pollingIntervals.get(accountId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(accountId);
      console.log(`[EmailService] Stopped polling for account ${accountId}`);
    }
  }

  async getMessages(accountId: number, folderId?: number, limit: number = 50): Promise<EmailMessage[]> {
    const conditions = [eq(emailMessages.accountId, accountId)];
    if (folderId) conditions.push(eq(emailMessages.folderId, folderId));

    return db.select().from(emailMessages)
      .where(and(...conditions))
      .orderBy(desc(emailMessages.receivedAt))
      .limit(limit);
  }

  async getMessage(messageId: number): Promise<EmailMessage | null> {
    const [message] = await db.select().from(emailMessages)
      .where(eq(emailMessages.id, messageId));
    return message || null;
  }

  async markAsRead(messageId: number): Promise<void> {
    await db.update(emailMessages)
      .set({ isRead: 1, updatedAt: new Date() })
      .where(eq(emailMessages.id, messageId));
  }

  async markAsStarred(messageId: number, starred: boolean): Promise<void> {
    await db.update(emailMessages)
      .set({ isStarred: starred ? 1 : 0, updatedAt: new Date() })
      .where(eq(emailMessages.id, messageId));
  }

  async moveToTrash(messageId: number): Promise<void> {
    const [message] = await db.select().from(emailMessages)
      .where(eq(emailMessages.id, messageId));
    
    if (!message) return;

    const [trashFolder] = await db.select().from(emailFolders)
      .where(and(eq(emailFolders.accountId, message.accountId), eq(emailFolders.type, "trash")));

    if (trashFolder) {
      await db.update(emailMessages)
        .set({ folderId: trashFolder.id, updatedAt: new Date() })
        .where(eq(emailMessages.id, messageId));
    }
  }

  async deletePermanently(messageId: number): Promise<void> {
    await db.delete(emailMessages).where(eq(emailMessages.id, messageId));
  }

  async getFolders(accountId: number): Promise<any[]> {
    return db.select().from(emailFolders)
      .where(eq(emailFolders.accountId, accountId));
  }

  async getAccounts(userId: string): Promise<EmailAccount[]> {
    return db.select().from(emailAccounts)
      .where(eq(emailAccounts.userId, userId));
  }

  async getUnreadCount(accountId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(emailMessages)
      .where(and(eq(emailMessages.accountId, accountId), eq(emailMessages.isRead, 0)));
    return Number(result[0]?.count || 0);
  }
}

export const emailService = new EmailService();
