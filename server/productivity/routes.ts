import { Router } from "express";
import { db } from "../../db";
import { 
  workspacePages, pageBlocks, pageLinks, dashboardWidgets, 
  quickNotes, activityFeed, userFavorites, commandHistory,
  insertWorkspacePageSchema, insertPageBlockSchema, insertDashboardWidgetSchema,
  insertQuickNoteSchema, insertActivityFeedSchema, insertUserFavoriteSchema,
  pcClients, pcProjects, pcTasks, conversations, knowledgeBase
} from "@shared/schema";
import { eq, desc, and, or, ilike, sql } from "drizzle-orm";

const router = Router();

const requireAuth = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
};

// ========== UNIVERSAL SEARCH ==========
router.get("/search", requireAuth, async (req, res) => {
  try {
    const { q, modules, limit = 20 } = req.query;
    const userId = req.user!.id;
    const searchQuery = `%${q}%`;
    const limitNum = Math.min(parseInt(limit as string) || 20, 50);

    const results: any = { pages: [], clients: [], projects: [], tasks: [], conversations: [], knowledge: [] };

    const moduleFilter = modules ? (modules as string).split(',') : ['all'];
    const searchAll = moduleFilter.includes('all');

    if (searchAll || moduleFilter.includes('pages')) {
      const pages = await db.select()
        .from(workspacePages)
        .where(and(
          eq(workspacePages.userId, userId),
          eq(workspacePages.isArchived, 0),
          ilike(workspacePages.title, searchQuery)
        ))
        .limit(limitNum);
      results.pages = pages.map(p => ({ ...p, _type: 'page', _module: 'workspace' }));
    }

    if (searchAll || moduleFilter.includes('clients')) {
      const clients = await db.select()
        .from(pcClients)
        .where(or(
          ilike(pcClients.name, searchQuery),
          ilike(pcClients.email, searchQuery),
          ilike(pcClients.phone, searchQuery)
        ))
        .limit(limitNum);
      results.clients = clients.map(c => ({ ...c, _type: 'client', _module: 'compass' }));
    }

    if (searchAll || moduleFilter.includes('projects')) {
      const projects = await db.select()
        .from(pcProjects)
        .where(or(
          ilike(pcProjects.name, searchQuery),
          ilike(pcProjects.description, searchQuery)
        ))
        .limit(limitNum);
      results.projects = projects.map(p => ({ ...p, _type: 'project', _module: 'compass' }));
    }

    if (searchAll || moduleFilter.includes('tasks')) {
      const tasks = await db.select()
        .from(pcTasks)
        .where(or(
          ilike(pcTasks.title, searchQuery),
          ilike(pcTasks.description, searchQuery)
        ))
        .limit(limitNum);
      results.tasks = tasks.map(t => ({ ...t, _type: 'task', _module: 'compass' }));
    }

    if (searchAll || moduleFilter.includes('conversations')) {
      const convs = await db.select()
        .from(conversations)
        .where(and(
          eq(conversations.userId, userId),
          ilike(conversations.title, searchQuery)
        ))
        .limit(limitNum);
      results.conversations = convs.map(c => ({ ...c, _type: 'conversation', _module: 'agent' }));
    }

    if (searchAll || moduleFilter.includes('knowledge')) {
      const knowledge = await db.select()
        .from(knowledgeBase)
        .where(or(
          ilike(knowledgeBase.title, searchQuery),
          ilike(knowledgeBase.content, searchQuery)
        ))
        .limit(limitNum);
      results.knowledge = knowledge.map(k => ({ ...k, _type: 'knowledge', _module: 'agent' }));
    }

    const allResults = [
      ...results.pages,
      ...results.clients,
      ...results.projects,
      ...results.tasks,
      ...results.conversations,
      ...results.knowledge
    ];

    res.json({ results: allResults, grouped: results });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

// ========== WORKSPACE PAGES ==========
router.get("/pages", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { parentId, archived } = req.query;
    
    let whereClause = and(
      eq(workspacePages.userId, userId),
      eq(workspacePages.isArchived, archived === 'true' ? 1 : 0)
    );
    
    if (parentId) {
      whereClause = and(whereClause, eq(workspacePages.parentId, parseInt(parentId as string)));
    } else {
      whereClause = and(whereClause, sql`${workspacePages.parentId} IS NULL`);
    }
    
    const pages = await db.select()
      .from(workspacePages)
      .where(whereClause)
      .orderBy(workspacePages.orderIndex);
    
    res.json(pages);
  } catch (error) {
    console.error("Error fetching pages:", error);
    res.status(500).json({ error: "Failed to fetch pages" });
  }
});

router.get("/pages/favorites", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const pages = await db.select()
      .from(workspacePages)
      .where(and(
        eq(workspacePages.userId, userId),
        eq(workspacePages.isFavorite, 1),
        eq(workspacePages.isArchived, 0)
      ))
      .orderBy(workspacePages.title);
    res.json(pages);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch favorite pages" });
  }
});

router.get("/pages/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const [page] = await db.select()
      .from(workspacePages)
      .where(and(
        eq(workspacePages.id, parseInt(req.params.id)),
        or(eq(workspacePages.userId, userId), eq(workspacePages.isPublic, 1))
      ));
    
    if (!page) {
      return res.status(404).json({ error: "Page not found" });
    }
    
    res.json(page);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch page" });
  }
});

router.post("/pages", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const data = insertWorkspacePageSchema.parse({ ...req.body, userId });
    
    const [page] = await db.insert(workspacePages).values(data).returning();
    
    await db.insert(activityFeed).values({
      userId,
      actorId: userId,
      type: 'created',
      module: 'workspace',
      entityType: 'page',
      entityId: page.id.toString(),
      entityTitle: page.title,
      description: `Criou a página "${page.title}"`
    });
    
    res.status(201).json(page);
  } catch (error) {
    console.error("Error creating page:", error);
    res.status(500).json({ error: "Failed to create page" });
  }
});

router.patch("/pages/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const pageId = parseInt(req.params.id);
    
    const [existing] = await db.select()
      .from(workspacePages)
      .where(and(eq(workspacePages.id, pageId), eq(workspacePages.userId, userId)));
    
    if (!existing) {
      return res.status(404).json({ error: "Page not found" });
    }
    
    const updateData = { ...req.body, updatedAt: new Date() };
    delete updateData.id;
    delete updateData.userId;
    delete updateData.createdAt;
    
    const [updated] = await db.update(workspacePages)
      .set(updateData)
      .where(eq(workspacePages.id, pageId))
      .returning();
    
    res.json(updated);
  } catch (error) {
    console.error("Error updating page:", error);
    res.status(500).json({ error: "Failed to update page" });
  }
});

router.delete("/pages/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const pageId = parseInt(req.params.id);
    
    const [deleted] = await db.delete(workspacePages)
      .where(and(eq(workspacePages.id, pageId), eq(workspacePages.userId, userId)))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ error: "Page not found" });
    }
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete page" });
  }
});

// ========== PAGE BLOCKS ==========
router.get("/pages/:pageId/blocks", requireAuth, async (req, res) => {
  try {
    const pageId = parseInt(req.params.pageId);
    const blocks = await db.select()
      .from(pageBlocks)
      .where(eq(pageBlocks.pageId, pageId))
      .orderBy(pageBlocks.orderIndex);
    res.json(blocks);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch blocks" });
  }
});

router.post("/pages/:pageId/blocks", requireAuth, async (req, res) => {
  try {
    const pageId = parseInt(req.params.pageId);
    const data = insertPageBlockSchema.parse({ ...req.body, pageId });
    
    const [block] = await db.insert(pageBlocks).values(data).returning();
    res.status(201).json(block);
  } catch (error) {
    console.error("Error creating block:", error);
    res.status(500).json({ error: "Failed to create block" });
  }
});

router.patch("/blocks/:id", requireAuth, async (req, res) => {
  try {
    const blockId = parseInt(req.params.id);
    const updateData = { ...req.body, updatedAt: new Date() };
    delete updateData.id;
    delete updateData.pageId;
    delete updateData.createdAt;
    
    const [updated] = await db.update(pageBlocks)
      .set(updateData)
      .where(eq(pageBlocks.id, blockId))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: "Block not found" });
    }
    
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update block" });
  }
});

router.delete("/blocks/:id", requireAuth, async (req, res) => {
  try {
    const blockId = parseInt(req.params.id);
    const [deleted] = await db.delete(pageBlocks)
      .where(eq(pageBlocks.id, blockId))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ error: "Block not found" });
    }
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete block" });
  }
});

router.post("/pages/:pageId/blocks/reorder", requireAuth, async (req, res) => {
  try {
    const { blocks } = req.body;
    
    for (const { id, orderIndex } of blocks) {
      await db.update(pageBlocks)
        .set({ orderIndex, updatedAt: new Date() })
        .where(eq(pageBlocks.id, id));
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to reorder blocks" });
  }
});

// ========== DASHBOARD WIDGETS ==========
router.get("/widgets", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const widgets = await db.select()
      .from(dashboardWidgets)
      .where(eq(dashboardWidgets.userId, userId));
    res.json(widgets);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch widgets" });
  }
});

router.post("/widgets", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const data = insertDashboardWidgetSchema.parse({ ...req.body, userId });
    
    const [widget] = await db.insert(dashboardWidgets).values(data).returning();
    res.status(201).json(widget);
  } catch (error) {
    res.status(500).json({ error: "Failed to create widget" });
  }
});

router.patch("/widgets/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const widgetId = parseInt(req.params.id);
    
    const updateData = { ...req.body };
    delete updateData.id;
    delete updateData.userId;
    delete updateData.createdAt;
    
    const [updated] = await db.update(dashboardWidgets)
      .set(updateData)
      .where(and(eq(dashboardWidgets.id, widgetId), eq(dashboardWidgets.userId, userId)))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: "Widget not found" });
    }
    
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update widget" });
  }
});

router.delete("/widgets/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const widgetId = parseInt(req.params.id);
    
    const [deleted] = await db.delete(dashboardWidgets)
      .where(and(eq(dashboardWidgets.id, widgetId), eq(dashboardWidgets.userId, userId)))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ error: "Widget not found" });
    }
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete widget" });
  }
});

router.post("/widgets/defaults", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    const existingWidgets = await db.select().from(dashboardWidgets).where(eq(dashboardWidgets.userId, userId));
    
    if (existingWidgets.length > 0) {
      return res.json({ message: "Widgets already exist", widgets: existingWidgets });
    }
    
    const defaultWidgets = [
      { userId, type: 'tasks', title: 'Tarefas Pendentes', position: JSON.stringify({ x: 0, y: 0, w: 2, h: 2 }), isVisible: 1 },
      { userId, type: 'recent_activity', title: 'Atividades Recentes', position: JSON.stringify({ x: 2, y: 0, w: 2, h: 2 }), isVisible: 1 },
      { userId, type: 'quick_notes', title: 'Notas Rápidas', position: JSON.stringify({ x: 0, y: 2, w: 2, h: 1 }), isVisible: 1 },
      { userId, type: 'favorites', title: 'Favoritos', position: JSON.stringify({ x: 2, y: 2, w: 2, h: 1 }), isVisible: 1 },
    ];
    
    const widgets = await db.insert(dashboardWidgets).values(defaultWidgets).returning();
    res.status(201).json(widgets);
  } catch (error) {
    res.status(500).json({ error: "Failed to create default widgets" });
  }
});

// ========== QUICK NOTES ==========
router.get("/notes", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const notes = await db.select()
      .from(quickNotes)
      .where(eq(quickNotes.userId, userId))
      .orderBy(desc(quickNotes.isPinned), desc(quickNotes.updatedAt));
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

router.post("/notes", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const data = insertQuickNoteSchema.parse({ ...req.body, userId });
    
    const [note] = await db.insert(quickNotes).values(data).returning();
    res.status(201).json(note);
  } catch (error) {
    res.status(500).json({ error: "Failed to create note" });
  }
});

router.patch("/notes/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const noteId = parseInt(req.params.id);
    
    const updateData = { ...req.body, updatedAt: new Date() };
    delete updateData.id;
    delete updateData.userId;
    delete updateData.createdAt;
    
    const [updated] = await db.update(quickNotes)
      .set(updateData)
      .where(and(eq(quickNotes.id, noteId), eq(quickNotes.userId, userId)))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: "Note not found" });
    }
    
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update note" });
  }
});

router.delete("/notes/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const noteId = parseInt(req.params.id);
    
    const [deleted] = await db.delete(quickNotes)
      .where(and(eq(quickNotes.id, noteId), eq(quickNotes.userId, userId)))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ error: "Note not found" });
    }
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete note" });
  }
});

// ========== ACTIVITY FEED / INBOX ==========
router.get("/activity", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { unreadOnly, module, limit = 50 } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 50, 100);
    
    let whereClause: any = eq(activityFeed.userId, userId);
    
    if (unreadOnly === 'true') {
      whereClause = and(whereClause, eq(activityFeed.isRead, 0))!;
    }
    
    if (module) {
      whereClause = and(whereClause, eq(activityFeed.module, module as string))!;
    }
    
    const activities = await db.select()
      .from(activityFeed)
      .where(whereClause as any)
      .orderBy(desc(activityFeed.createdAt))
      .limit(limitNum);
    
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch activities" });
  }
});

router.get("/activity/unread-count", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(activityFeed)
      .where(and(eq(activityFeed.userId, userId), eq(activityFeed.isRead, 0)));
    
    res.json({ count: result[0]?.count || 0 });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch unread count" });
  }
});

router.patch("/activity/:id/read", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const activityId = parseInt(req.params.id);
    
    const [updated] = await db.update(activityFeed)
      .set({ isRead: 1 })
      .where(and(eq(activityFeed.id, activityId), eq(activityFeed.userId, userId)))
      .returning();
    
    res.json(updated || { success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

router.post("/activity/mark-all-read", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    await db.update(activityFeed)
      .set({ isRead: 1 })
      .where(and(eq(activityFeed.userId, userId), eq(activityFeed.isRead, 0)));
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark all as read" });
  }
});

// ========== FAVORITES ==========
router.get("/favorites", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const favorites = await db.select()
      .from(userFavorites)
      .where(eq(userFavorites.userId, userId))
      .orderBy(userFavorites.orderIndex);
    res.json(favorites);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch favorites" });
  }
});

router.post("/favorites", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const data = insertUserFavoriteSchema.parse({ ...req.body, userId });
    
    const [favorite] = await db.insert(userFavorites).values(data).returning();
    res.status(201).json(favorite);
  } catch (error) {
    res.status(500).json({ error: "Failed to add favorite" });
  }
});

router.delete("/favorites/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const favoriteId = parseInt(req.params.id);
    
    const [deleted] = await db.delete(userFavorites)
      .where(and(eq(userFavorites.id, favoriteId), eq(userFavorites.userId, userId)))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ error: "Favorite not found" });
    }
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to remove favorite" });
  }
});

// ========== COMMAND HISTORY ==========
router.get("/commands/recent", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const commands = await db.select()
      .from(commandHistory)
      .where(eq(commandHistory.userId, userId))
      .orderBy(desc(commandHistory.frequency), desc(commandHistory.lastUsedAt))
      .limit(20);
    res.json(commands);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch command history" });
  }
});

router.post("/commands/track", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { command } = req.body;
    
    const [existing] = await db.select()
      .from(commandHistory)
      .where(and(eq(commandHistory.userId, userId), eq(commandHistory.command, command)));
    
    if (existing) {
      const [updated] = await db.update(commandHistory)
        .set({ frequency: (existing.frequency || 0) + 1, lastUsedAt: new Date() })
        .where(eq(commandHistory.id, existing.id))
        .returning();
      res.json(updated);
    } else {
      const [created] = await db.insert(commandHistory)
        .values({ userId, command })
        .returning();
      res.status(201).json(created);
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to track command" });
  }
});

// ========== PAGE BACKLINKS ==========
router.get("/pages/:id/backlinks", requireAuth, async (req, res) => {
  try {
    const pageId = parseInt(req.params.id);
    
    const backlinks = await db.select({
      id: pageLinks.id,
      sourcePageId: pageLinks.sourcePageId,
      sourcePageTitle: workspacePages.title,
      sourcePageIcon: workspacePages.icon,
      createdAt: pageLinks.createdAt
    })
      .from(pageLinks)
      .innerJoin(workspacePages, eq(pageLinks.sourcePageId, workspacePages.id))
      .where(eq(pageLinks.targetPageId, pageId));
    
    res.json(backlinks);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch backlinks" });
  }
});

export default router;
