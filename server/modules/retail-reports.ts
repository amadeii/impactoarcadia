import { Router } from "express";
import { db } from "../../db";
import { retailTradeIns } from "@shared/schemas/retail-reports";

const router = Router();

// GET /trade-ins - Fetch trade-ins with optional filters
router.get("/trade-ins", async (req, res) => {
  const { sellerId, companyId, clientId } = req.query;

  try {
    const tradeIns = await db.select().from(retailTradeIns).where((builder) => {
      if (sellerId) builder = builder.where(retailTradeIns.sellerId.eq(sellerId));
      if (companyId) builder = builder.where(retailTradeIns.companyId.eq(companyId));
      if (clientId) builder = builder.where(retailTradeIns.clientId.eq(clientId));
      return builder;
    });

    res.json(tradeIns);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch trade-ins." });
  }
});

// GET /trade-ins/:id - Fetch specific trade-in by ID
router.get("/trade-ins/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const tradeIn = await db.select().from(retailTradeIns).where(retailTradeIns.id.eq(Number(id))).limit(1);

    if (tradeIn.length === 0) {
      return res.status(404).json({ error: "Trade-in not found." });
    }

    res.json(tradeIn[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch trade-in." });
  }
});

// POST /trade-ins/print - Generate printable trade-ins
router.post("/trade-ins/print", async (req, res) => {
  const { tradeInIds } = req.body;

  if (!Array.isArray(tradeInIds) || tradeInIds.length === 0) {
    return res.status(400).json({ error: "Invalid trade-in IDs." });
  }

  try {
    const tradeIns = await db.select().from(retailTradeIns).where(retailTradeIns.id.in(tradeInIds));

    // Simulate file generation (e.g., PDF or CSV)
    const fileContent = tradeIns.map((tradeIn) => JSON.stringify(tradeIn)).join("\n");

    res.setHeader("Content-Disposition", "attachment; filename=trade-ins.txt");
    res.setHeader("Content-Type", "text/plain");
    res.send(fileContent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate printable trade-ins." });
  }
});

export default router;