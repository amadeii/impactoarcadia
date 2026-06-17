// Rotas CRUD para /api/pessoas — cadastro unificado de pessoas físicas e jurídicas
import type { Express } from "express";
import { db } from "./db";
import { pool } from "../db/index";
import {
  pessoas, enderecos, contatos, pessoaPapeis, tenants,
  insertPessoaSchema, insertEnderecoSchema, insertContatoSchema, insertPessoaPapelSchema,
} from "@shared/schema";
import { eq, and, desc, ilike, or, sql, count } from "drizzle-orm";
import { isAuthenticated } from "./portableAuth";
import { tenantContext, requireTenant } from "./tenantContext";
import { parsePlanilha, importarPessoas } from "./pessoaImportService";
import multer from "multer";

const auth = [isAuthenticated, tenantContext, requireTenant];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

/** FISC-01: normaliza body de pessoa para gravar rg/ie nos campos corretos */
function normalizarBodyPessoa(body: Record<string, any>): Record<string, any> {
  const result = { ...body };
  const tipoPessoa = result.tipoPessoa as string | undefined;
  const temRgExplicito = result.rg !== undefined;
  const temIeExplicito = result.ie !== undefined;

  if (result.rgIe !== undefined && result.rgIe !== null) {
    if (tipoPessoa === 'PF' && !temRgExplicito) {
      result.rg = result.rgIe;
    }
    if (tipoPessoa === 'PJ' && !temIeExplicito) {
      result.ie = String(result.rgIe).replace(/[^0-9A-Za-z]/g, '') || null;
    }
  }
  if (tipoPessoa === 'PF' && temRgExplicito) result.rgIe = result.rg;
  if (tipoPessoa === 'PJ' && temIeExplicito) result.rgIe = result.ie;

  if (result.ie && result.contribuinte === undefined) {
    const ie = String(result.ie).toUpperCase().trim();
    if (ie === 'ISENTO' || ie === 'ISE' || ie === 'EX') result.contribuinte = 'I';
    else if (ie.length > 0) result.contribuinte = 'S';
  }
  return result;
}

export function registerPessoasRoutes(app: Express) {
  // GET /api/pessoas/counts — contadores por papel
  app.get("/api/pessoas/counts", ...auth, async (req: any, res) => {
    try {
      const tenantId: string = req.tenantId;
      const rows = await db.select({
        tipoPapel: pessoaPapeis.tipoPapel,
        total: count(),
      })
        .from(pessoaPapeis)
        .where(eq(pessoaPapeis.tenantId, tenantId))
        .groupBy(pessoaPapeis.tipoPapel);
      const result: Record<string, number> = { total: 0 };
      for (const r of rows) {
        result[r.tipoPapel] = Number(r.total);
        result.total += Number(r.total);
      }
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/pessoas — lista com busca SQL + filtro por papel
  app.get("/api/pessoas", ...auth, async (req: any, res) => {
    try {
      const tenantId: string = String(req.tenantId ?? "");
      const { search, q: qParam, papel, tipos, limit } = req.query as Record<string, string>;
      const searchTerm = (qParam ?? search ?? "").trim();

      // Monta conditions SQL
      const conditions: ReturnType<typeof eq>[] = [eq(pessoas.tenantId, tenantId)];
      if (searchTerm) {
        const pat = `%${searchTerm}%`;
        conditions.push(
          or(
            ilike(pessoas.nomeFantasia, pat),
            ilike(pessoas.razaoSocial, pat),
            ilike(pessoas.cnpjCpf, pat),
          ) as any
        );
      }

      const lim = limit ? Math.min(Number(limit), 100) : 200;

      let rows = await db.select().from(pessoas)
        .where(and(...conditions))
        .orderBy(desc(pessoas.createdAt))
        .limit(lim);

      // Filtro por papel/tipo (join via pessoaPapeis)
      const papelFilter = papel || null;
      const tiposArray = tipos ? tipos.split(",").map(t => t.trim()).filter(Boolean) : null;

      if (papelFilter || tiposArray) {
        const papConditions: any[] = [eq(pessoaPapeis.tenantId, tenantId)];
        if (papelFilter) papConditions.push(eq(pessoaPapeis.tipoPapel, papelFilter));
        if (tiposArray?.length) {
          papConditions.push(
            sql`${pessoaPapeis.tipoPapel} = ANY(ARRAY[${sql.join(tiposArray.map(t => sql`${t}::text`), sql`, `)}])`
          );
        }
        const withPapel = await db.select({ pessoaId: pessoaPapeis.pessoaId })
          .from(pessoaPapeis).where(and(...papConditions));
        const papelIds = new Set(withPapel.map(r => r.pessoaId));
        rows = rows.filter(r => papelIds.has(r.id));
      }

      // Enriquecer com papéis
      const rowIds = rows.map(r => r.id);
      const papeis = rowIds.length
        ? await db.select().from(pessoaPapeis).where(and(
          eq(pessoaPapeis.tenantId, tenantId),
          sql`${pessoaPapeis.pessoaId} = ANY(ARRAY[${sql.join(rowIds.map(id => sql`${id}::text`), sql`, `)}])`
        ))
        : [];

      const result = rows.map(p => ({
        ...p,
        papeis: papeis.filter(pp => pp.pessoaId === p.id),
      }));

      res.json(result);
    } catch (e: any) {
      console.error("[pessoasRoutes] GET /api/pessoas erro:", e.message, e.stack?.split("\n")[1]);
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/pessoas/:id
  app.get("/api/pessoas/:id", ...auth, async (req: any, res) => {
    try {
      const tenantId: string = req.tenantId;
      const [pessoa] = await db.select().from(pessoas)
        .where(and(eq(pessoas.id, req.params.id), eq(pessoas.tenantId, tenantId)))
        .limit(1);
      if (!pessoa) return res.status(404).json({ message: "Pessoa não encontrada" });

      const [ends, cts, paps] = await Promise.all([
        db.select().from(enderecos).where(eq(enderecos.pessoaId, pessoa.id)),
        db.select().from(contatos).where(eq(contatos.pessoaId, pessoa.id)),
        db.select().from(pessoaPapeis).where(and(
          eq(pessoaPapeis.pessoaId, pessoa.id),
          eq(pessoaPapeis.tenantId, tenantId),
        )),
      ]);

      res.json({ ...pessoa, enderecos: ends, contatos: cts, papeis: paps });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/pessoas
  app.post("/api/pessoas", ...auth, async (req: any, res) => {
    try {
      const tenantId: string = req.tenantId;
      const body = insertPessoaSchema.parse({ ...req.body, tenantId });
      const [row] = await db.insert(pessoas).values(body).returning();

      // Salvar papéis enviados no body
      const papeisInput: Array<{ tipoPapel: string }> = Array.isArray(req.body.papeis)
        ? req.body.papeis
        : [];
      let savedPapeis: any[] = [];
      if (papeisInput.length > 0) {
        const papelRows = papeisInput.map(p =>
          insertPessoaPapelSchema.parse({ pessoaId: row.id, tipoPapel: p.tipoPapel, tenantId })
        );
        savedPapeis = await db.insert(pessoaPapeis).values(papelRows).returning();
      }

      res.status(201).json({ ...row, papeis: savedPapeis });
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  // PATCH /api/pessoas/:id
  app.patch("/api/pessoas/:id", ...auth, async (req: any, res) => {
    try {
      const partial = insertPessoaSchema.partial().parse(normalizarBodyPessoa(req.body));
      const [row] = await db.update(pessoas)
        .set({ ...partial, updatedAt: new Date() })
        .where(and(eq(pessoas.id, req.params.id), eq(pessoas.tenantId, req.tenantId)))
        .returning();
      if (!row) return res.status(404).json({ message: "Pessoa não encontrada" });
      res.json(row);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  // DELETE /api/pessoas/:id
  app.delete("/api/pessoas/:id", ...auth, async (req: any, res) => {
    try {
      const [row] = await db.delete(pessoas)
        .where(and(eq(pessoas.id, req.params.id), eq(pessoas.tenantId, req.tenantId)))
        .returning({ id: pessoas.id });
      if (!row) return res.status(404).json({ message: "Pessoa não encontrada" });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/pessoas/:id/papeis
  app.post("/api/pessoas/:id/papeis", ...auth, async (req: any, res) => {
    try {
      const body = insertPessoaPapelSchema.parse({
        ...req.body,
        pessoaId: req.params.id,
        tenantId: req.tenantId,
      });
      const [row] = await db.insert(pessoaPapeis).values(body).returning();

      // FIX-03.A: papel 'cliente' → upsert xos_contact
      if (body.tipoPapel === "cliente" || body.tipoPapel === "cliente_engenharia") {
        try {
          const [p] = await db.select().from(pessoas).where(eq(pessoas.id, req.params.id)).limit(1);
          if (p) {
            const existing = await pool.query(
              `SELECT id FROM xos_contacts WHERE pessoa_id = $1 LIMIT 1`, [p.id]
            );
            if (existing.rows.length === 0) {
              await pool.query(`
                INSERT INTO xos_contacts (name, email, phone, type, pessoa_id, created_at, updated_at)
                VALUES ($1, $2, $3, 'customer', $4, NOW(), NOW())
                ON CONFLICT DO NOTHING
              `, [p.nomeFantasia || p.razaoSocial || "Sem nome", p.email || null, p.telefone || null, p.id]);
            } else {
              await pool.query(`UPDATE xos_contacts SET type = 'customer' WHERE pessoa_id = $1`, [p.id]);
            }
          }
        } catch (_) {}
      }

      res.status(201).json(row);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  // DELETE /api/pessoas/:id/papeis/:papelId
  app.delete("/api/pessoas/:id/papeis/:papelId", ...auth, async (req: any, res) => {
    try {
      await db.delete(pessoaPapeis)
        .where(and(eq(pessoaPapeis.id, req.params.papelId), eq(pessoaPapeis.pessoaId, req.params.id)));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // DELETE /api/papeis/:id — alias sem pessoaId no path (usado pelo frontend)
  app.delete("/api/papeis/:id", ...auth, async (req: any, res) => {
    try {
      await db.delete(pessoaPapeis).where(eq(pessoaPapeis.id, req.params.id));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // PATCH /api/pessoas/:id/papeis/:papelId — atualizar metadata de papel existente
  app.patch("/api/pessoas/:id/papeis/:papelId", ...auth, async (req: any, res) => {
    try {
      const { metadata, status, dataFim } = req.body;
      const updates: any = { updatedAt: new Date() };
      if (metadata !== undefined) updates.metadata = metadata;
      if (status !== undefined)   updates.status = status;
      if (dataFim !== undefined)  updates.dataFim = dataFim;
      const [row] = await db.update(pessoaPapeis)
        .set(updates)
        .where(and(eq(pessoaPapeis.id, req.params.papelId), eq(pessoaPapeis.pessoaId, req.params.id)))
        .returning();
      if (!row) return res.status(404).json({ message: "Papel não encontrado" });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/pessoa-grupos — listar grupos do tenant
  app.get("/api/pessoa-grupos", ...auth, async (req: any, res) => {
    try {
      const r = await pool.query(
        `SELECT * FROM pessoa_grupos WHERE tenant_id = $1 ORDER BY nome`,
        [req.tenantId]
      );
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/pessoa-grupos — criar grupo
  app.post("/api/pessoa-grupos", ...auth, async (req: any, res) => {
    try {
      const { nome, descricao, cor } = req.body;
      if (!nome) return res.status(400).json({ message: "Nome obrigatório" });
      const r = await pool.query(
        `INSERT INTO pessoa_grupos (tenant_id, nome, descricao, cor)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id, nome) DO UPDATE SET descricao = EXCLUDED.descricao, cor = EXCLUDED.cor
         RETURNING *`,
        [req.tenantId, nome, descricao || null, cor || null]
      );
      res.status(201).json(r.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // PATCH /api/pessoa-grupos/:id — editar grupo
  app.patch("/api/pessoa-grupos/:id", ...auth, async (req: any, res) => {
    try {
      const { nome, descricao, cor } = req.body;
      const r = await pool.query(
        `UPDATE pessoa_grupos SET
           nome = COALESCE($1, nome),
           descricao = COALESCE($2, descricao),
           cor = COALESCE($3, cor)
         WHERE id = $4 AND tenant_id = $5 RETURNING *`,
        [nome || null, descricao || null, cor || null, req.params.id, req.tenantId]
      );
      if (!r.rowCount) return res.status(404).json({ message: "Grupo não encontrado" });
      res.json(r.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // DELETE /api/pessoa-grupos/:id — remover grupo (pessoas ficam com grupo_id = NULL)
  app.delete("/api/pessoa-grupos/:id", ...auth, async (req: any, res) => {
    try {
      await pool.query(
        `DELETE FROM pessoa_grupos WHERE id = $1 AND tenant_id = $2`,
        [req.params.id, req.tenantId]
      );
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/pessoas/:pessoaId/enderecos
  app.post("/api/pessoas/:pessoaId/enderecos", ...auth, async (req: any, res) => {
    try {
      const body = insertEnderecoSchema.parse({ ...req.body, pessoaId: req.params.pessoaId });
      const [row] = await db.insert(enderecos).values(body).returning();
      res.status(201).json(row);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  // PATCH /api/enderecos/:id
  app.patch("/api/enderecos/:id", ...auth, async (req: any, res) => {
    try {
      const partial = insertEnderecoSchema.partial().parse(req.body);
      const [row] = await db.update(enderecos).set(partial)
        .where(eq(enderecos.id, req.params.id)).returning();
      if (!row) return res.status(404).json({ message: "Endereço não encontrado" });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // DELETE /api/enderecos/:id
  app.delete("/api/enderecos/:id", ...auth, async (req: any, res) => {
    try {
      await db.delete(enderecos).where(eq(enderecos.id, req.params.id));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/pessoas/:pessoaId/contatos
  app.post("/api/pessoas/:pessoaId/contatos", ...auth, async (req: any, res) => {
    try {
      const body = insertContatoSchema.parse({ ...req.body, pessoaId: req.params.pessoaId });
      const [row] = await db.insert(contatos).values(body).returning();
      res.status(201).json(row);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ message: e.errors });
      res.status(500).json({ message: e.message });
    }
  });

  // PATCH /api/contatos/:id
  app.patch("/api/contatos/:id", ...auth, async (req: any, res) => {
    try {
      const partial = insertContatoSchema.partial().parse(req.body);
      const [row] = await db.update(contatos).set(partial)
        .where(eq(contatos.id, req.params.id)).returning();
      if (!row) return res.status(404).json({ message: "Contato não encontrado" });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // DELETE /api/contatos/:id
  app.delete("/api/contatos/:id", ...auth, async (req: any, res) => {
    try {
      await db.delete(contatos).where(eq(contatos.id, req.params.id));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/pessoas/import — importa XLSX/CSV
  app.post("/api/pessoas/import", ...auth, upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Arquivo não enviado" });
      const result = await importarPessoas(req.file.buffer, req.tenantId);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/pessoas/migrate-legacy-clientes — migra crm_clients para pessoas
  app.post("/api/pessoas/migrate-legacy-clientes", ...auth, async (req: any, res) => {
    // Por agora retorna sucesso sem dados (migração real seria implementada futuramente)
    res.json({ migrated: 0, skipped: 0, errors: [] });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SOE-01: Aliases /api/soe/persons* → tabela pessoas (fonte canônica)
  // URL rewrite em server/erp/routes.ts exclui /api/soe/persons* do rewrite.
  // ═══════════════════════════════════════════════════════════════════════════

  const roleEnToPt: Record<string, string> = {
    customer: "cliente", supplier: "fornecedor",
    employee: "funcionario", technician: "tecnico", partner: "parceiro",
  };
  const rolePtToEn: Record<string, string> = Object.fromEntries(
    Object.entries(roleEnToPt).map(([en, pt]) => [pt, en])
  );

  function pessoaToPersonView(p: any) {
    return {
      id: p.id,
      fullName: p.nomeFantasia || p.razaoSocial || "",
      cpfCnpj: p.cnpjCpf || "",
      email: p.email || "",
      phone: p.telefone || p.celular || "",
      whatsapp: p.whatsapp || "",
      address: [p.logradouro, p.numero].filter(Boolean).join(", "),
      city: p.municipio || "",
      state: p.uf || "",
      zipCode: p.cep || "",
      notes: p.observacoes || "",
      roles: (p.papeis || []).map((pp: any) => rolePtToEn[pp.tipoPapel] || pp.tipoPapel),
      tenantId: p.tenantId,
      createdAt: p.createdAt,
    };
  }

  // GET /api/soe/persons
  app.get("/api/soe/persons", ...auth, async (req: any, res) => {
    try {
      const tenantId: string = req.tenantId;
      const { search, q: qParam, roleFilter } = req.query as Record<string, string>;
      const searchTerm = qParam ?? search;
      let rows = await db.select().from(pessoas)
        .where(eq(pessoas.tenantId, tenantId))
        .orderBy(desc(pessoas.createdAt));
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        rows = rows.filter(r =>
          (r.nomeFantasia || "").toLowerCase().includes(q) ||
          (r.razaoSocial ?? "").toLowerCase().includes(q) ||
          (r.cnpjCpf ?? "").includes(q)
        );
      }
      const ids = rows.map(r => r.id);
      const papeis = ids.length
        ? await db.select().from(pessoaPapeis).where(and(
          eq(pessoaPapeis.tenantId, tenantId),
          sql`${pessoaPapeis.pessoaId} = ANY(ARRAY[${sql.join(ids.map(id => sql`${id}::text`), sql`, `)}])`
        ))
        : [];
      let result = rows.map(p => ({ ...p, papeis: papeis.filter(pp => pp.pessoaId === p.id) }));
      if (roleFilter && roleFilter !== "all") {
        const ptRole = roleEnToPt[roleFilter] || roleFilter;
        result = result.filter(p => p.papeis.some((pp: any) => pp.tipoPapel === ptRole));
      }
      res.json(result.map(pessoaToPersonView));
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/soe/persons/:id
  app.get("/api/soe/persons/:id", ...auth, async (req: any, res) => {
    try {
      const tenantId: string = req.tenantId;
      const [pessoa] = await db.select().from(pessoas)
        .where(and(eq(pessoas.id, req.params.id), eq(pessoas.tenantId, tenantId)))
        .limit(1);
      if (!pessoa) return res.status(404).json({ message: "Pessoa não encontrada" });
      const papeis = await db.select().from(pessoaPapeis)
        .where(and(eq(pessoaPapeis.pessoaId, pessoa.id), eq(pessoaPapeis.tenantId, tenantId)));
      res.json(pessoaToPersonView({ ...pessoa, papeis }));
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/soe/persons
  app.post("/api/soe/persons", ...auth, async (req: any, res) => {
    try {
      const { fullName, cpfCnpj, email, phone, whatsapp, city, state, zipCode, notes, roles = [] } = req.body;
      const tipoPessoa = cpfCnpj && cpfCnpj.replace(/\D/g, "").length > 11 ? "PJ" : "PF";
      const [pessoa] = await db.insert(pessoas).values({
        tenantId: req.tenantId,
        tipoPessoa,
        nomeFantasia: fullName || "",
        cnpjCpf: cpfCnpj || `temp-${Date.now()}`,
        email: email || "",
        telefone: phone || "",
        whatsapp: whatsapp || "",
        municipio: city || "",
        uf: state || "",
        cep: zipCode || "",
        observacoes: notes || "",
      }).returning();
      for (const roleEn of (roles as string[])) {
        const tipoPapel = roleEnToPt[roleEn] || roleEn;
        await db.insert(pessoaPapeis).values({ pessoaId: pessoa.id, tipoPapel, tenantId: req.tenantId });
      }
      const papeis = await db.select().from(pessoaPapeis).where(eq(pessoaPapeis.pessoaId, pessoa.id));
      res.status(201).json(pessoaToPersonView({ ...pessoa, papeis }));
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // PUT /api/soe/persons/:id — bridge para tabela pessoas
  app.put("/api/soe/persons/:id", ...auth, async (req: any, res) => {
    try {
      const { fullName, cpfCnpj, email, phone, whatsapp, city, state, zipCode, notes, roles } = req.body;
      const [pessoa] = await db.update(pessoas)
        .set({
          nomeFantasia: fullName,
          cnpjCpf: cpfCnpj,
          email: email || "",
          telefone: phone || "",
          whatsapp: whatsapp || "",
          municipio: city || "",
          uf: state || "",
          cep: zipCode || "",
          observacoes: notes || "",
          updatedAt: new Date(),
        })
        .where(and(eq(pessoas.id, req.params.id), eq(pessoas.tenantId, req.tenantId)))
        .returning();
      if (!pessoa) return res.status(404).json({ message: "Pessoa não encontrada" });
      if (Array.isArray(roles)) {
        await db.delete(pessoaPapeis).where(and(
          eq(pessoaPapeis.pessoaId, pessoa.id),
          eq(pessoaPapeis.tenantId, req.tenantId)
        ));
        for (const roleEn of roles) {
          const tipoPapel = roleEnToPt[roleEn] || roleEn;
          await db.insert(pessoaPapeis).values({ pessoaId: pessoa.id, tipoPapel, tenantId: req.tenantId });
        }
      }
      const papeis = await db.select().from(pessoaPapeis).where(eq(pessoaPapeis.pessoaId, pessoa.id));
      res.json(pessoaToPersonView({ ...pessoa, papeis }));
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SOE-04: Converter lead XOS → pessoa SOE
  // ═══════════════════════════════════════════════════════════════════════════

  // POST /api/soe/pessoas/from-xos-contact
  app.post("/api/soe/pessoas/from-xos-contact", ...auth, async (req: any, res) => {
    try {
      const { contactId, cpfCnpj, tipoPapel = "cliente" } = req.body;
      if (!contactId) return res.status(400).json({ message: "contactId é obrigatório" });
      const contactResult = await db.execute(sql`SELECT * FROM xos_contacts WHERE id = ${contactId}`);
      const contact = (contactResult as any).rows?.[0];
      if (!contact) return res.status(404).json({ message: "Contato XOS não encontrado" });
      // Se já vinculado, retorna pessoa existente
      if (contact.pessoa_id) {
        const [existente] = await db.select().from(pessoas).where(eq(pessoas.id, contact.pessoa_id)).limit(1);
        if (existente) {
          const papeis = await db.select().from(pessoaPapeis).where(eq(pessoaPapeis.pessoaId, existente.id));
          return res.json({ pessoa: pessoaToPersonView({ ...existente, papeis }), created: false });
        }
      }
      // Verificar duplicação por CNPJ/CPF
      if (cpfCnpj) {
        const cnpjLimpo = cpfCnpj.replace(/\D/g, "");
        const [dup] = await db.select().from(pessoas)
          .where(and(eq(pessoas.cnpjCpf, cnpjLimpo), eq(pessoas.tenantId, req.tenantId)))
          .limit(1);
        if (dup) {
          await db.execute(sql`UPDATE xos_contacts SET pessoa_id = ${dup.id} WHERE id = ${contactId}`);
          const papeis = await db.select().from(pessoaPapeis).where(eq(pessoaPapeis.pessoaId, dup.id));
          return res.json({ pessoa: pessoaToPersonView({ ...dup, papeis }), created: false, linked: true });
        }
      }
      const cnpjFinal = cpfCnpj ? cpfCnpj.replace(/\D/g, "") : `xos-${contactId}`;
      const tipoPessoa = cnpjFinal.replace(/\D/g, "").length > 11 ? "PJ" : "PF";
      const [nova] = await db.insert(pessoas).values({
        tenantId: req.tenantId,
        tipoPessoa,
        nomeFantasia: contact.name || contact.company || "Sem nome",
        cnpjCpf: cnpjFinal,
        email: contact.email || "",
        telefone: contact.phone || "",
        whatsapp: contact.whatsapp || contact.phone || "",
        observacoes: `Criado a partir do contato XOS #${contactId}`,
      }).returning();
      await db.insert(pessoaPapeis).values({ pessoaId: nova.id, tipoPapel, tenantId: req.tenantId });
      await db.execute(sql`UPDATE xos_contacts SET pessoa_id = ${nova.id} WHERE id = ${contactId}`);
      const papeis = await db.select().from(pessoaPapeis).where(eq(pessoaPapeis.pessoaId, nova.id));
      res.status(201).json({ pessoa: pessoaToPersonView({ ...nova, papeis }), created: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SOE-05: Info do tenant (segmento)
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /api/soe/tenant/info
  app.get("/api/soe/tenant/info", ...auth, async (req: any, res) => {
    try {
      const tenantId: string = req.tenantId;
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
      if (!tenant) return res.status(404).json({ message: "Tenant não encontrado" });
      res.json({
        id: tenant.id,
        name: tenant.name,
        segment: (tenant as any).segment || null,
        features: (tenant as any).features || {},
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });
}
