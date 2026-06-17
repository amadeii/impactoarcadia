import { db } from "../db/index";
import { users, applications, userApplications, profiles, crmPartners, tenants, tenantUsers, type User, type InsertUser, type Application, type InsertApplication } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import pg from "pg";

const PostgresSessionStore = connectPg(session);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface IStorage {
  sessionStore: session.Store;
  
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getEnrichedUser(user: User): Promise<any>;
  
  getApplications(): Promise<Application[]>;
  getApplication(id: string): Promise<Application | undefined>;
  createApplication(app: InsertApplication): Promise<Application>;
  updateApplication(id: string, app: Partial<InsertApplication>): Promise<Application | undefined>;
  deleteApplication(id: string): Promise<boolean>;
  
  getUserApplications(userId: string): Promise<Application[]>;
  assignApplicationToUser(userId: string, applicationId: string): Promise<void>;
  removeApplicationFromUser(userId: string, applicationId: string): Promise<void>;
  getTenants(): Promise<{ id: number; name: string; slug: string }[]>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getApplications(): Promise<Application[]> {
    return await db.select().from(applications);
  }

  async getApplication(id: string): Promise<Application | undefined> {
    const [app] = await db.select().from(applications).where(eq(applications.id, id));
    return app;
  }

  async createApplication(app: InsertApplication): Promise<Application> {
    const [newApp] = await db.insert(applications).values(app).returning();
    return newApp;
  }

  async updateApplication(id: string, app: Partial<InsertApplication>): Promise<Application | undefined> {
    const [updated] = await db.update(applications)
      .set(app)
      .where(eq(applications.id, id))
      .returning();
    return updated;
  }

  async deleteApplication(id: string): Promise<boolean> {
    const result = await db.delete(applications).where(eq(applications.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getUserApplications(userId: string): Promise<Application[]> {
    const result = await db
      .select({ application: applications })
      .from(userApplications)
      .innerJoin(applications, eq(userApplications.applicationId, applications.id))
      .where(eq(userApplications.userId, userId));
    return result.map(r => r.application);
  }

  async assignApplicationToUser(userId: string, applicationId: string): Promise<void> {
    await db.insert(userApplications).values({ userId, applicationId }).onConflictDoNothing();
  }

  async removeApplicationFromUser(userId: string, applicationId: string): Promise<void> {
    await db.delete(userApplications).where(
      and(
        eq(userApplications.userId, userId),
        eq(userApplications.applicationId, applicationId)
      )
    );
  }

  async getEnrichedUser(user: User): Promise<any> {
    const enriched: any = { ...user };
    
    if (user.profileId) {
      const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.profileId));
      if (profile) {
        enriched.profile = profile;
        enriched.allowedModules = profile.allowedModules || [];
      }
    }
    
    if (user.partnerId) {
      const [partner] = await db.select().from(crmPartners).where(eq(crmPartners.id, user.partnerId));
      if (partner) {
        enriched.partner = partner;
      }
    }
    
    // Buscar tenant do usuário (apenas campos seguros para o cliente)
    const [tenantUser] = await db.select().from(tenantUsers).where(eq(tenantUsers.userId, user.id));
    if (tenantUser) {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantUser.tenantId));
      if (tenant) {
        // Expor apenas campos seguros do tenant
        enriched.tenant = {
          id: tenant.id,
          name: tenant.name,
          tenantType: tenant.tenantType,
          plan: tenant.plan,
          status: tenant.status
        };
        enriched.tenantId = tenant.id;
        enriched.tenantType = tenant.tenantType;
        enriched.tenantRole = tenantUser.role;
        enriched.isOwner = tenantUser.isOwner === "true";
      }
    }
    
    return enriched;
  }

  async getTenants(): Promise<{ id: number; name: string; slug: string }[]> {
    const result = await db.select({ 
      id: tenants.id, 
      name: tenants.name, 
      slug: tenants.slug 
    }).from(tenants);
    return result.map(t => ({ id: t.id, name: t.name || '', slug: t.slug || '' }));
  }
}

export const storage = new DatabaseStorage();
