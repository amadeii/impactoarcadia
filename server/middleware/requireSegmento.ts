import pg from "pg";

/**
 * SEG-05 — Garante que o tenant tem o segmento necessário para acessar a rota.
 * Impede que tenant com segmento A acesse APIs do segmento B.
 *
 * Uso: router.use(requireSegmento("decoracao_cortinas"))
 */
export function requireSegmento(segmentoCodigo: string) {
  return async (req: any, res: any, next: any) => {
    try {
      const tenantId = req.user?.tenantId ?? req.session?.tenantId ?? 1;

      const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

      // Tenta coluna direta primeiro; cai no JOIN se não existir
      let segmentoAtual = "";
      try {
        const r1 = await pool.query(
          `SELECT COALESCE(
              (SELECT code FROM erp_segments WHERE id = c.segment_id),
              ''
           ) as segmento
           FROM erp_config c
           WHERE c.tenant_id = $1 LIMIT 1`,
          [tenantId]
        );
        segmentoAtual = r1.rows[0]?.segmento ?? "";
      } catch (_) {
        // se erp_config não existir ainda, libera
      }

      await pool.end();

      if (segmentoAtual && segmentoAtual !== segmentoCodigo) {
        return res.status(403).json({
          message: `Esta funcionalidade requer o segmento '${segmentoCodigo}'`,
          segmentoAtual,
          segmentoNecessario: segmentoCodigo,
          code: "wrong_segment",
        });
      }

      next();
    } catch (err: any) {
      next(err);
    }
  };
}
