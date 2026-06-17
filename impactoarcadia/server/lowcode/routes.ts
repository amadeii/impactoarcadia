import { Router } from "express";
import { db } from "../../db/index";
import { z } from "zod";
import { sql, eq, and, asc } from "drizzle-orm";

const router = Router();

const createDocTypeSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  module: z.string().optional(),
  description: z.string().optional(),
  icon: z.string().default("FileText"),
  color: z.string().default("blue"),
  isSubmittable: z.boolean().default(false),
  isSingle: z.boolean().default(false),
  isTree: z.boolean().default(false),
  hasWebView: z.boolean().default(true),
});

const createFieldSchema = z.object({
  docTypeId: z.number(),
  fieldName: z.string().min(1),
  label: z.string().min(1),
  fieldType: z.string().min(1),
  options: z.string().optional(),
  defaultValue: z.string().optional(),
  mandatory: z.boolean().default(false),
  inListView: z.boolean().default(false),
  inFilter: z.boolean().default(false),
  sortOrder: z.number().default(0),
  section: z.string().optional(),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
});

router.get("/doctypes", async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT * FROM arc_doctypes 
      WHERE status = 'active' 
      ORDER BY module, label
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching doctypes:", error);
    res.status(500).json({ error: "Failed to fetch doctypes" });
  }
});

router.get("/doctypes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.execute(sql`
      SELECT * FROM arc_doctypes WHERE id = ${parseInt(id)}
    `);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "DocType not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching doctype:", error);
    res.status(500).json({ error: "Failed to fetch doctype" });
  }
});

router.post("/doctypes", async (req, res) => {
  try {
    const data = createDocTypeSchema.parse(req.body);
    const result = await db.execute(sql`
      INSERT INTO arc_doctypes (name, label, module, description, icon, color, is_submittable, is_single, is_tree, has_web_view)
      VALUES (${data.name}, ${data.label}, ${data.module || null}, ${data.description || null}, 
              ${data.icon}, ${data.color}, ${data.isSubmittable}, ${data.isSingle}, ${data.isTree}, ${data.hasWebView})
      RETURNING *
    `);
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error creating doctype:", error);
    res.status(500).json({ error: "Failed to create doctype" });
  }
});

router.put("/doctypes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const data = createDocTypeSchema.partial().parse(req.body);
    
    const result = await db.execute(sql`
      UPDATE arc_doctypes SET
        name = COALESCE(${data.name}, name),
        label = COALESCE(${data.label}, label),
        module = COALESCE(${data.module}, module),
        description = COALESCE(${data.description}, description),
        icon = COALESCE(${data.icon}, icon),
        color = COALESCE(${data.color}, color),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating doctype:", error);
    res.status(500).json({ error: "Failed to update doctype" });
  }
});

router.delete("/doctypes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute(sql`
      UPDATE arc_doctypes SET status = 'deleted' WHERE id = ${parseInt(id)}
    `);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting doctype:", error);
    res.status(500).json({ error: "Failed to delete doctype" });
  }
});

router.get("/doctypes/:id/fields", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.execute(sql`
      SELECT * FROM arc_fields 
      WHERE doctype_id = ${parseInt(id)}
      ORDER BY sort_order, id
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching fields:", error);
    res.status(500).json({ error: "Failed to fetch fields" });
  }
});

router.post("/fields", async (req, res) => {
  try {
    const data = createFieldSchema.parse(req.body);
    const result = await db.execute(sql`
      INSERT INTO arc_fields (
        doctype_id, field_name, label, field_type, options, default_value,
        mandatory, in_list_view, in_filter, sort_order, section, placeholder, help_text
      )
      VALUES (
        ${data.docTypeId}, ${data.fieldName}, ${data.label}, ${data.fieldType},
        ${data.options || null}, ${data.defaultValue || null}, ${data.mandatory},
        ${data.inListView}, ${data.inFilter}, ${data.sortOrder},
        ${data.section || null}, ${data.placeholder || null}, ${data.helpText || null}
      )
      RETURNING *
    `);
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error creating field:", error);
    res.status(500).json({ error: "Failed to create field" });
  }
});

router.put("/fields/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const data = createFieldSchema.partial().parse(req.body);
    
    const result = await db.execute(sql`
      UPDATE arc_fields SET
        field_name = COALESCE(${data.fieldName}, field_name),
        label = COALESCE(${data.label}, label),
        field_type = COALESCE(${data.fieldType}, field_type),
        options = COALESCE(${data.options}, options),
        mandatory = COALESCE(${data.mandatory}, mandatory),
        in_list_view = COALESCE(${data.inListView}, in_list_view),
        in_filter = COALESCE(${data.inFilter}, in_filter),
        sort_order = COALESCE(${data.sortOrder}, sort_order),
        section = COALESCE(${data.section}, section),
        placeholder = COALESCE(${data.placeholder}, placeholder),
        help_text = COALESCE(${data.helpText}, help_text)
      WHERE id = ${parseInt(id)}
      RETURNING *
    `);
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating field:", error);
    res.status(500).json({ error: "Failed to update field" });
  }
});

router.delete("/fields/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute(sql`DELETE FROM arc_fields WHERE id = ${parseInt(id)}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting field:", error);
    res.status(500).json({ error: "Failed to delete field" });
  }
});

router.get("/doctypes/:name/schema", async (req, res) => {
  try {
    const { name } = req.params;
    const doctypeResult = await db.execute(sql`
      SELECT * FROM arc_doctypes WHERE name = ${name} AND status = 'active'
    `);
    
    if (doctypeResult.rows.length === 0) {
      return res.status(404).json({ error: "DocType not found" });
    }
    
    const doctype = doctypeResult.rows[0] as any;
    
    const fieldsResult = await db.execute(sql`
      SELECT * FROM arc_fields 
      WHERE doctype_id = ${doctype.id}
      ORDER BY sort_order, id
    `);
    
    res.json({
      doctype,
      fields: fieldsResult.rows
    });
  } catch (error) {
    console.error("Error fetching schema:", error);
    res.status(500).json({ error: "Failed to fetch schema" });
  }
});

router.get("/pages", async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT p.*, d.label as doctype_label 
      FROM arc_pages p
      LEFT JOIN arc_doctypes d ON p.doctype_id = d.id
      WHERE p.status = 'active'
      ORDER BY p.module, p.title
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching pages:", error);
    res.status(500).json({ error: "Failed to fetch pages" });
  }
});

router.post("/pages", async (req, res) => {
  try {
    const { name, title, route, pageType, docTypeId, icon, module, layout } = req.body;
    const result = await db.execute(sql`
      INSERT INTO arc_pages (name, title, route, page_type, doctype_id, icon, module, layout)
      VALUES (${name}, ${title}, ${route}, ${pageType || 'page'}, ${docTypeId || null}, ${icon || null}, ${module || null}, ${layout ? JSON.stringify(layout) : null})
      RETURNING *
    `);
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error creating page:", error);
    res.status(500).json({ error: "Failed to create page" });
  }
});

router.get("/widgets", async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT * FROM arc_widgets WHERE status = 'active' ORDER BY category, label
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching widgets:", error);
    res.status(500).json({ error: "Failed to fetch widgets" });
  }
});

router.get("/modules", async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT DISTINCT module FROM arc_doctypes 
      WHERE module IS NOT NULL AND status = 'active'
      ORDER BY module
    `);
    res.json(result.rows.map((r: any) => r.module));
  } catch (error) {
    console.error("Error fetching modules:", error);
    res.status(500).json({ error: "Failed to fetch modules" });
  }
});

const toCamelCase = (row: any) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  nodes: row.nodes || [],
  status: row.status,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

router.get("/workflows", async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT * FROM arc_workflows WHERE status != 'deleted' ORDER BY created_at DESC
    `);
    res.json(result.rows.map(toCamelCase));
  } catch (error) {
    console.error("Error fetching workflows:", error);
    res.status(500).json({ error: "Failed to fetch workflows" });
  }
});

router.post("/workflows", async (req, res) => {
  try {
    const { name, description, nodes, status } = req.body;
    const result = await db.execute(sql`
      INSERT INTO arc_workflows (name, description, nodes, status, created_at, updated_at)
      VALUES (${name}, ${description}, ${JSON.stringify(nodes || [])}, ${status || 'draft'}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `);
    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error("Error creating workflow:", error);
    res.status(500).json({ error: "Failed to create workflow" });
  }
});

router.put("/workflows/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, nodes, status } = req.body;
    const result = await db.execute(sql`
      UPDATE arc_workflows SET
        name = COALESCE(${name}, name),
        description = COALESCE(${description}, description),
        nodes = COALESCE(${nodes ? JSON.stringify(nodes) : null}, nodes),
        status = COALESCE(${status}, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `);
    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error("Error updating workflow:", error);
    res.status(500).json({ error: "Failed to update workflow" });
  }
});

router.delete("/workflows/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute(sql`
      UPDATE arc_workflows SET status = 'deleted' WHERE id = ${parseInt(id)}
    `);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting workflow:", error);
    res.status(500).json({ error: "Failed to delete workflow" });
  }
});

export default router;
