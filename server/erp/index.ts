import { db } from "../../db/index";
import { erpConnections, agentTasks, taskExecutions } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface ErpApiClient {
  testConnection(): Promise<boolean>;
  getFinancialData(params?: any): Promise<any>;
  getInventoryData(params?: any): Promise<any>;
  getSalesData(params?: any): Promise<any>;
  getPayables(params?: any): Promise<any>;
  getReceivables(params?: any): Promise<any>;
}

export class ArcadiaPlusClient implements ErpApiClient {
  private baseUrl: string;
  private apiKey: string;
  private apiSecret: string;

  constructor(baseUrl: string, apiKey: string, apiSecret: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  private async request(endpoint: string, method = "GET", body?: any) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
        "X-API-Secret": this.apiSecret,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request("/api/v1/status");
      return true;
    } catch {
      return false;
    }
  }

  async getFinancialData(params?: any) {
    return this.request("/api/v1/financial/balance", "GET");
  }

  async getInventoryData(params?: any) {
    return this.request("/api/v1/inventory/stock", "GET");
  }

  async getSalesData(params?: any) {
    return this.request("/api/v1/sales/summary", "GET");
  }

  async getPayables(params?: any) {
    return this.request("/api/v1/financial/payables", "GET");
  }

  async getReceivables(params?: any) {
    return this.request("/api/v1/financial/receivables", "GET");
  }
}

export class ArcadiaNextClient implements ErpApiClient {
  private baseUrl: string;
  private apiKey: string;
  private apiSecret: string;

  constructor(baseUrl: string, apiKey: string, apiSecret: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  private async request(endpoint: string, method = "GET", body?: any) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `token ${this.apiKey}:${this.apiSecret}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request("/api/method/frappe.auth.get_logged_user");
      return true;
    } catch {
      return false;
    }
  }

  async getFinancialData(params?: any) {
    return this.request("/api/resource/GL Entry?limit_page_length=100");
  }

  async getInventoryData(params?: any) {
    return this.request("/api/resource/Stock Ledger Entry?limit_page_length=100");
  }

  async getSalesData(params?: any) {
    return this.request("/api/resource/Sales Invoice?limit_page_length=100");
  }

  async getPayables(params?: any) {
    return this.request("/api/resource/Purchase Invoice?filters=[[\"outstanding_amount\",\">\",0]]");
  }

  async getReceivables(params?: any) {
    return this.request("/api/resource/Sales Invoice?filters=[[\"outstanding_amount\",\">\",0]]");
  }
}

export function createErpClient(connection: typeof erpConnections.$inferSelect): ErpApiClient {
  switch (connection.type) {
    case "arcadia_plus":
      return new ArcadiaPlusClient(
        connection.baseUrl,
        connection.apiKey || "",
        connection.apiSecret || ""
      );
    case "arcadia_next":
      return new ArcadiaNextClient(
        connection.baseUrl,
        connection.apiKey || "",
        connection.apiSecret || ""
      );
    default:
      throw new Error(`Unknown ERP type: ${connection.type}`);
  }
}

export const erpStorage = {
  async getConnections() {
    return db.select().from(erpConnections).orderBy(desc(erpConnections.createdAt));
  },

  async getConnection(id: number) {
    const [connection] = await db.select().from(erpConnections).where(eq(erpConnections.id, id));
    return connection;
  },

  async createConnection(data: Omit<typeof erpConnections.$inferInsert, "id" | "createdAt">) {
    const [connection] = await db.insert(erpConnections).values(data).returning();
    return connection;
  },

  async updateConnection(id: number, data: Partial<typeof erpConnections.$inferInsert>) {
    const [connection] = await db.update(erpConnections).set(data).where(eq(erpConnections.id, id)).returning();
    return connection;
  },

  async deleteConnection(id: number) {
    await db.delete(erpConnections).where(eq(erpConnections.id, id));
  },

  async getTasks() {
    return db.select().from(agentTasks).orderBy(desc(agentTasks.createdAt));
  },

  async getTask(id: number) {
    const [task] = await db.select().from(agentTasks).where(eq(agentTasks.id, id));
    return task;
  },

  async createTask(data: Omit<typeof agentTasks.$inferInsert, "id" | "createdAt" | "lastRun" | "nextRun">) {
    const [task] = await db.insert(agentTasks).values(data).returning();
    return task;
  },

  async updateTask(id: number, data: Partial<typeof agentTasks.$inferInsert>) {
    const [task] = await db.update(agentTasks).set(data).where(eq(agentTasks.id, id)).returning();
    return task;
  },

  async deleteTask(id: number) {
    await db.delete(agentTasks).where(eq(agentTasks.id, id));
  },

  async getTaskExecutions(taskId: number) {
    return db.select().from(taskExecutions).where(eq(taskExecutions.taskId, taskId)).orderBy(desc(taskExecutions.startedAt));
  },

  async createTaskExecution(data: Omit<typeof taskExecutions.$inferInsert, "id" | "startedAt">) {
    const [execution] = await db.insert(taskExecutions).values(data).returning();
    return execution;
  },

  async updateTaskExecution(id: number, data: Partial<typeof taskExecutions.$inferInsert>) {
    const [execution] = await db.update(taskExecutions).set(data).where(eq(taskExecutions.id, id)).returning();
    return execution;
  },
};
