import { db } from "../../db/index";
import { eq } from "drizzle-orm";
import { whatsappService } from "../whatsapp/service";
import { crmChannels } from "@shared/schema";
import type { CommunicationService } from "./communication";

class WhatsAppBridge {
  private initialized = false;
  private sessionChannelMap: Map<string, number> = new Map();
  private channelSessionMap: Map<number, string> = new Map();
  private communicationService: CommunicationService | null = null;

  init(commService: CommunicationService): void {
    if (this.initialized) return;
    this.communicationService = commService;
    
    whatsappService.on("message", async (data: { 
      userId: string; 
      from: string; 
      messageId: string; 
      text: string; 
      timestamp: number; 
      pushName: string;
    }) => {
      try {
        const channelId = this.sessionChannelMap.get(data.userId);
        if (channelId && this.communicationService) {
          await this.handleIncomingMessage(channelId, data);
        }
      } catch (error) {
        console.error("Error processing incoming WhatsApp message:", error);
      }
    });

    whatsappService.on("connected", async (data: { userId: string; phoneNumber: string }) => {
      try {
        const channelId = this.sessionChannelMap.get(data.userId);
        if (channelId) {
          await db.update(crmChannels)
            .set({ 
              status: "connected", 
              identifier: data.phoneNumber,
              lastConnectedAt: new Date(),
              updatedAt: new Date() 
            })
            .where(eq(crmChannels.id, channelId));
        }
      } catch (error) {
        console.error("Error updating channel status on connect:", error);
      }
    });

    whatsappService.on("disconnected", async (data: { userId: string; shouldReconnect: boolean }) => {
      try {
        const channelId = this.sessionChannelMap.get(data.userId);
        if (channelId) {
          await db.update(crmChannels)
            .set({ status: "disconnected", updatedAt: new Date() })
            .where(eq(crmChannels.id, channelId));
        }
      } catch (error) {
        console.error("Error updating channel status on disconnect:", error);
      }
    });

    whatsappService.on("qr", async (data: { userId: string; qr: string }) => {
      try {
        const channelId = this.sessionChannelMap.get(data.userId);
        if (channelId) {
          await db.update(crmChannels)
            .set({ qrCode: data.qr, status: "pending_qr", updatedAt: new Date() })
            .where(eq(crmChannels.id, channelId));
        }
      } catch (error) {
        console.error("Error updating channel QR code:", error);
      }
    });

    commService.setWhatsAppBridge(this);
    
    this.initialized = true;
    console.log("[WhatsApp Bridge] Initialized and listening for messages");
  }

  private async handleIncomingMessage(
    channelId: number, 
    data: { from: string; messageId: string; text: string; pushName: string }
  ): Promise<void> {
    if (!this.communicationService) return;
    
    const phone = data.from.replace("@s.whatsapp.net", "").replace("@c.us", "");
    
    await this.communicationService.receiveMessage(
      channelId,
      phone,
      data.pushName || null,
      data.text,
      data.messageId,
      "text"
    );
  }

  bindChannel(channelId: number, sessionKey: string): void {
    this.sessionChannelMap.set(sessionKey, channelId);
    this.channelSessionMap.set(channelId, sessionKey);
  }

  unbindChannel(channelId: number): void {
    const sessionKey = this.channelSessionMap.get(channelId);
    if (sessionKey) {
      this.sessionChannelMap.delete(sessionKey);
      this.channelSessionMap.delete(channelId);
    }
  }

  getSessionKey(channelId: number): string | undefined {
    return this.channelSessionMap.get(channelId);
  }

  getChannelId(sessionKey: string): number | undefined {
    return this.sessionChannelMap.get(sessionKey);
  }
}

export const whatsappBridge = new WhatsAppBridge();
