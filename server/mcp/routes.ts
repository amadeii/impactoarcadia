import type { Express, Request, Response } from "express";
import { db } from "../../db/index";
import { customMcpServers, insertCustomMcpServerSchema } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export function registerCustomMcpRoutes(app: Express): void {
  app.get("/api/mcp/custom", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const servers = await db.select().from(customMcpServers)
        .where(eq(customMcpServers.userId, req.user!.id));
      
      res.json(servers);
    } catch (error) {
      console.error("Error fetching custom MCP servers:", error);
      res.status(500).json({ error: "Failed to fetch MCP servers" });
    }
  });

  app.post("/api/mcp/custom", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const validatedData = insertCustomMcpServerSchema.parse({
        ...req.body,
        userId: req.user!.id
      });

      const [server] = await db.insert(customMcpServers)
        .values(validatedData)
        .returning();
      
      res.json(server);
    } catch (error: any) {
      console.error("Error creating custom MCP server:", error);
      res.status(400).json({ error: error.message || "Failed to create MCP server" });
    }
  });

  app.post("/api/mcp/custom/import", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { config } = req.body;
      if (!config) {
        return res.status(400).json({ error: "Config is required" });
      }

      let parsed: any;
      try {
        parsed = typeof config === 'string' ? JSON.parse(config) : config;
      } catch (e) {
        return res.status(400).json({ error: "Invalid JSON format. Please check your configuration." });
      }
      
      if (typeof parsed !== 'object' || parsed === null) {
        return res.status(400).json({ error: "Config must be a valid JSON object" });
      }

      const createdServers: any[] = [];

      if (parsed.mcpServers) {
        for (const [name, serverConfig] of Object.entries(parsed.mcpServers)) {
          const cfg = serverConfig as any;
          const serverData = {
            userId: req.user!.id,
            name,
            transportType: cfg.url ? "http" : "stdio",
            serverUrl: cfg.url || null,
            command: cfg.command || null,
            args: cfg.args || null,
            description: cfg.description || null,
            customHeaders: cfg.headers || null,
          };

          const [server] = await db.insert(customMcpServers)
            .values(serverData)
            .returning();
          createdServers.push(server);
        }
      } else if (parsed.url || parsed.command) {
        const serverData = {
          userId: req.user!.id,
          name: parsed.name || "Imported Server",
          transportType: parsed.url ? "http" : "stdio",
          serverUrl: parsed.url || null,
          command: parsed.command || null,
          args: parsed.args || null,
          description: parsed.description || null,
          customHeaders: parsed.headers || null,
        };

        const [server] = await db.insert(customMcpServers)
          .values(serverData)
          .returning();
        createdServers.push(server);
      }

      res.json({ imported: createdServers.length, servers: createdServers });
    } catch (error: any) {
      console.error("Error importing MCP servers:", error);
      res.status(400).json({ error: error.message || "Failed to import MCP servers" });
    }
  });

  app.put("/api/mcp/custom/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const id = parseInt(req.params.id);
      const { name, transportType, serverUrl, command, args, iconUrl, description, customHeaders, isActive } = req.body;

      const [server] = await db.update(customMcpServers)
        .set({
          name,
          transportType,
          serverUrl,
          command,
          args,
          iconUrl,
          description,
          customHeaders,
          isActive,
          updatedAt: new Date()
        })
        .where(and(
          eq(customMcpServers.id, id),
          eq(customMcpServers.userId, req.user!.id)
        ))
        .returning();
      
      if (!server) {
        return res.status(404).json({ error: "MCP server not found" });
      }
      
      res.json(server);
    } catch (error: any) {
      console.error("Error updating custom MCP server:", error);
      res.status(400).json({ error: error.message || "Failed to update MCP server" });
    }
  });

  app.delete("/api/mcp/custom/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const id = parseInt(req.params.id);
      
      const [deleted] = await db.delete(customMcpServers)
        .where(and(
          eq(customMcpServers.id, id),
          eq(customMcpServers.userId, req.user!.id)
        ))
        .returning();
      
      if (!deleted) {
        return res.status(404).json({ error: "MCP server not found" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting custom MCP server:", error);
      res.status(400).json({ error: error.message || "Failed to delete MCP server" });
    }
  });

  app.post("/api/mcp/custom/:id/test", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const id = parseInt(req.params.id);
      
      const [server] = await db.select().from(customMcpServers)
        .where(and(
          eq(customMcpServers.id, id),
          eq(customMcpServers.userId, req.user!.id)
        ));
      
      if (!server) {
        return res.status(404).json({ error: "MCP server not found" });
      }

      if (server.transportType === "http" && server.serverUrl) {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (server.customHeaders && typeof server.customHeaders === 'object') {
            Object.assign(headers, server.customHeaders);
          }

          const response = await fetch(`${server.serverUrl}/tools`, {
            method: 'GET',
            headers
          });

          if (response.ok) {
            const tools = await response.json();
            return res.json({ 
              success: true, 
              message: "Connection successful",
              toolsCount: Array.isArray(tools) ? tools.length : 0
            });
          } else {
            return res.json({ 
              success: false, 
              message: `Server returned status ${response.status}`
            });
          }
        } catch (e: any) {
          return res.json({ 
            success: false, 
            message: `Connection failed: ${e.message}`
          });
        }
      }

      res.json({ 
        success: true, 
        message: "STDIO servers will be tested on first use"
      });
    } catch (error: any) {
      console.error("Error testing MCP server:", error);
      res.status(400).json({ error: error.message || "Failed to test MCP server" });
    }
  });
}
