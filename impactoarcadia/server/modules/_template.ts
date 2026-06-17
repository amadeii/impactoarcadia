/**
 * TEMPLATE - Exemplo de módulo de rotas para o Dev Center
 * 
 * Copie este arquivo e renomeie para criar as rotas de um módulo.
 * Exemplo: server/modules/bsc.ts
 * 
 * REGRAS:
 * 1. Exporte default um Router do Express
 * 2. O prefixo /api/modules/{nomeModulo} é adicionado automaticamente
 * 3. Importe schemas do módulo via @shared/schemas/{nomeModulo}
 * 4. Use db de ../../db para queries
 * 5. Valide inputs com Zod/drizzle-zod
 * 
 * IMPORTANTE:
 * - O auto-loader monta as rotas em /api/modules/{nomeDoArquivo}
 * - Arquivos que começam com _ são ignorados (_template.ts, _utils.ts)
 */

/*
import { Router } from "express";
import { db } from "../../db";
import { exemploItems, insertExemploItemSchema } from "@shared/schemas/exemplo";
import { eq } from "drizzle-orm";

const router = Router();

// GET /api/modules/exemplo - Listar items
router.get("/", async (req, res) => {
  try {
    const items = await db.select().from(exemploItems);
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/modules/exemplo - Criar item
router.post("/", async (req, res) => {
  try {
    const parsed = insertExemploItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }
    const [item] = await db.insert(exemploItems).values(parsed.data).returning();
    res.status(201).json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/modules/exemplo/:id - Buscar por ID
router.get("/:id", async (req, res) => {
  try {
    const [item] = await db.select().from(exemploItems)
      .where(eq(exemploItems.id, parseInt(req.params.id)));
    if (!item) return res.status(404).json({ error: "Não encontrado" });
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
*/
