import { db } from "../../db/index";
import { eq, and, gte, lte } from "drizzle-orm";
import { crmEvents, crmGoogleTokens, type CrmEvent } from "@shared/schema";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:5000/api/crm/google/callback";

interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: Array<{ email: string; displayName?: string }>;
  conferenceData?: { createRequest?: { requestId: string } };
  reminders?: { useDefault: boolean };
}

export class GoogleCalendarService {
  getAuthUrl(userId: string): string {
    if (!GOOGLE_CLIENT_ID) {
      throw new Error("Google Client ID not configured");
    }

    const scopes = [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events"
    ];

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: "code",
      scope: scopes.join(" "),
      access_type: "offline",
      prompt: "consent",
      state: userId
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleCallback(code: string, userId: string): Promise<void> {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error("Google OAuth not configured");
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code"
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code: ${error}`);
    }

    const tokens: GoogleTokens = await response.json();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const [existing] = await db.select().from(crmGoogleTokens).where(eq(crmGoogleTokens.userId, userId));

    if (existing) {
      await db.update(crmGoogleTokens)
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || existing.refreshToken,
          expiresAt,
          scope: tokens.scope,
          updatedAt: new Date()
        })
        .where(eq(crmGoogleTokens.userId, userId));
    } else {
      await db.insert(crmGoogleTokens).values({
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        expiresAt,
        scope: tokens.scope
      });
    }
  }

  private async getValidAccessToken(userId: string): Promise<string> {
    const [token] = await db.select().from(crmGoogleTokens).where(eq(crmGoogleTokens.userId, userId));
    
    if (!token) {
      throw new Error("Google Calendar not connected");
    }

    if (token.expiresAt && token.expiresAt > new Date()) {
      return token.accessToken;
    }

    if (!token.refreshToken || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error("Token expired and cannot be refreshed");
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: token.refreshToken,
        grant_type: "refresh_token"
      })
    });

    if (!response.ok) {
      throw new Error("Failed to refresh token");
    }

    const tokens: GoogleTokens = await response.json();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await db.update(crmGoogleTokens)
      .set({
        accessToken: tokens.access_token,
        expiresAt,
        updatedAt: new Date()
      })
      .where(eq(crmGoogleTokens.userId, userId));

    return tokens.access_token;
  }

  async isConnected(userId: string): Promise<boolean> {
    const [token] = await db.select().from(crmGoogleTokens).where(eq(crmGoogleTokens.userId, userId));
    return !!token;
  }

  async disconnect(userId: string): Promise<void> {
    await db.delete(crmGoogleTokens).where(eq(crmGoogleTokens.userId, userId));
  }

  async createEvent(userId: string, event: CrmEvent): Promise<string | null> {
    try {
      const accessToken = await this.getValidAccessToken(userId);

      const isAllDay = event.allDay === "true";
      const startDate = event.startAt instanceof Date ? event.startAt : new Date(event.startAt);
      const endDate = event.endAt ? (event.endAt instanceof Date ? event.endAt : new Date(event.endAt)) : null;
      
      const googleEvent: GoogleCalendarEvent = {
        summary: event.title,
        description: event.description || undefined,
        location: event.location || undefined,
        start: isAllDay 
          ? { date: startDate.toISOString().split("T")[0] }
          : { dateTime: startDate.toISOString(), timeZone: "America/Sao_Paulo" },
        end: endDate
          ? (isAllDay
              ? { date: endDate.toISOString().split("T")[0] }
              : { dateTime: endDate.toISOString(), timeZone: "America/Sao_Paulo" })
          : (isAllDay
              ? { date: startDate.toISOString().split("T")[0] }
              : { dateTime: new Date(startDate.getTime() + 3600000).toISOString(), timeZone: "America/Sao_Paulo" }),
        attendees: event.attendees?.map(email => ({ email })) || undefined,
        reminders: { useDefault: true }
      };

      const response = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(googleEvent)
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error("Failed to create Google Calendar event:", error);
        return null;
      }

      const created = await response.json();
      return created.id;
    } catch (error) {
      console.error("Error creating Google Calendar event:", error);
      return null;
    }
  }

  async updateEvent(userId: string, googleEventId: string, event: CrmEvent): Promise<boolean> {
    try {
      const accessToken = await this.getValidAccessToken(userId);

      const isAllDay = event.allDay === "true";
      const startDate = event.startAt instanceof Date ? event.startAt : new Date(event.startAt);
      const endDate = event.endAt ? (event.endAt instanceof Date ? event.endAt : new Date(event.endAt)) : null;

      const googleEvent: GoogleCalendarEvent = {
        summary: event.title,
        description: event.description || undefined,
        location: event.location || undefined,
        start: isAllDay
          ? { date: startDate.toISOString().split("T")[0] }
          : { dateTime: startDate.toISOString(), timeZone: "America/Sao_Paulo" },
        end: endDate
          ? (isAllDay
              ? { date: endDate.toISOString().split("T")[0] }
              : { dateTime: endDate.toISOString(), timeZone: "America/Sao_Paulo" })
          : (isAllDay
              ? { date: startDate.toISOString().split("T")[0] }
              : { dateTime: new Date(startDate.getTime() + 3600000).toISOString(), timeZone: "America/Sao_Paulo" }),
        attendees: event.attendees?.map(email => ({ email })) || undefined
      };

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(googleEvent)
        }
      );

      return response.ok;
    } catch (error) {
      console.error("Error updating Google Calendar event:", error);
      return false;
    }
  }

  async deleteEvent(userId: string, googleEventId: string): Promise<boolean> {
    try {
      const accessToken = await this.getValidAccessToken(userId);

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );

      return response.ok || response.status === 404;
    } catch (error) {
      console.error("Error deleting Google Calendar event:", error);
      return false;
    }
  }

  async syncEvents(userId: string, startDate: Date, endDate: Date): Promise<void> {
    try {
      const accessToken = await this.getValidAccessToken(userId);

      const params = new URLSearchParams({
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: "true",
        orderBy: "startTime"
      });

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch Google Calendar events");
      }

      const data = await response.json();
      const googleEvents = data.items || [];

      for (const gEvent of googleEvents) {
        const [existing] = await db.select().from(crmEvents)
          .where(and(
            eq(crmEvents.userId, userId),
            eq(crmEvents.googleEventId, gEvent.id)
          ));

        const startAt = gEvent.start.dateTime 
          ? new Date(gEvent.start.dateTime) 
          : new Date(gEvent.start.date);
        const endAt = gEvent.end?.dateTime 
          ? new Date(gEvent.end.dateTime) 
          : gEvent.end?.date 
            ? new Date(gEvent.end.date) 
            : null;
        const allDay = !gEvent.start.dateTime ? "true" : "false";

        if (existing) {
          await db.update(crmEvents)
            .set({
              title: gEvent.summary || "Untitled",
              description: gEvent.description || null,
              location: gEvent.location || null,
              startAt,
              endAt,
              allDay,
              attendees: gEvent.attendees?.map((a: any) => a.email) || null,
              updatedAt: new Date()
            })
            .where(eq(crmEvents.id, existing.id));
        } else {
          await db.insert(crmEvents).values({
            userId,
            title: gEvent.summary || "Untitled",
            description: gEvent.description || null,
            location: gEvent.location || null,
            startAt,
            endAt,
            allDay,
            googleEventId: gEvent.id,
            attendees: gEvent.attendees?.map((a: any) => a.email) || null,
            type: "meeting",
            status: "scheduled"
          });
        }
      }
    } catch (error) {
      console.error("Error syncing Google Calendar events:", error);
      throw error;
    }
  }

  async getEvents(userId: string, startDate?: Date, endDate?: Date): Promise<CrmEvent[]> {
    const conditions = [eq(crmEvents.userId, userId)];
    
    if (startDate) {
      conditions.push(gte(crmEvents.startAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(crmEvents.startAt, endDate));
    }

    return db.select().from(crmEvents).where(and(...conditions));
  }
}

export const googleCalendarService = new GoogleCalendarService();
