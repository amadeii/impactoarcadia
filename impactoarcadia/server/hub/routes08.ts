/**
 * Arcádia Project Hub — Routes HUB-08
 * Fiscal events já existem (hub04). Este sprint adiciona:
 * - Emissão NFS-e via Control Plus API (plusFetch)
 * - Cálculo de retenções por perfil fiscal
 * - Painel de conformidade fiscal do projeto
 * - Endpoint para atualizar nfse_number após emissão
 */
import type { Express } from "express";
import { pool } from "../../db/index";
import { z } from "zod";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant } from "../tenantContext";
import { gerarLancamentoReceber, resolveClienteControlId, findOrCreateClienteByNome } from "../control/arService";

const auth = [isAuthenticated, tenantContext, requireTenant];

// Taxas de retenção padrão (podem ser sobrescritas por perfil)
const DEFAULT_RATES = {
  iss_pct:  0.05,   // 5% ISS padrão — varia por município e serviço
  ir_pct:   0.015,  // 1,5% IR para PJ
  pcc_pct:  0.0465, // PIS 0,65% + COFINS 3% + CSLL 1% = 4,65%
};

// Municípios com alíquota ISS diferenciada (sample — expandir conforme necessário)
const ISS_MUNICIPIOS: Record<string, number> = {
  "4205407": 0.03,  // Florianópolis 3%
  "3550308": 0.05,  // São Paulo 5%
  "3304557": 0.05,  // Rio de Janeiro 5%
  "4106902": 0.02,  // Curitiba 2%
  "5300108": 0.05,  // Brasília 5%
};

function calcularRetencoes(amount: number, municipioIbge?: string | null): {
  iss: number; ir: number; pcc: number; liquido: number;
} {
  const issPct = (municipioIbge && ISS_MUNICIPIOS[municipioIbge]) ?? DEFAULT_RATES.iss_pct;
  const iss  = amount * issPct;
  const ir   = amount * DEFAULT_RATES.ir_pct;
  const pcc  = amount * DEFAULT_RATES.pcc_pct;
  return { iss, ir, pcc, liquido: amount - iss - ir - pcc };
}

// ── Helper: gerar AR no Control após emissão de NFS-e ────────────────────────
async function gerarARParaNfse(
  evt: any, nfseNumber: string, tenantId: string, userId: string | null
): Promise<{ arId: string | null; jaExistia: boolean }> {
  try {
    // 1. Se o marco já tem AR (criado pelo accept), apenas vincula ao fiscal_event
    if (evt.milestone_id) {
      const mr = await pool.query(
        `SELECT ar_lancamento_id, due_date FROM project_billing_milestones WHERE id = $1`,
        [evt.milestone_id]
      );
      const marco = mr.rows[0];
      if (marco?.ar_lancamento_id) {
        // AR já existe pelo aceite do marco — só vincula, não duplica
        await pool.query(
          `UPDATE project_fiscal_events SET ar_lancamento_id = $1 WHERE id = $2`,
          [marco.ar_lancamento_id, evt.id]
        );
        console.log(`[HUB-08] AR já existia pelo marco (${marco.ar_lancamento_id}) — vinculado ao fiscal_event`);
        return { arId: marco.ar_lancamento_id, jaExistia: true };
      }
    }

    // 2. Verificar se o próprio fiscal_event já tem AR (idempotência)
    if (evt.ar_lancamento_id) {
      return { arId: evt.ar_lancamento_id, jaExistia: true };
    }

    // 3. Resolver clienteControlId
    let clienteControlId: string | null = null;
    if (evt.cliente_id) {
      clienteControlId = await resolveClienteControlId(evt.cliente_id, tenantId);
    }
    if (!clienteControlId) {
      const r = await pool.query(
        `SELECT id FROM clients WHERE tenant_id = $1 ORDER BY created_at LIMIT 1`,
        [tenantId]
      );
      clienteControlId = r.rows[0]?.id ?? null;
    }
    // Fallback final: find-or-create client pelo nome externo do projeto
    if (!clienteControlId) {
      const nomeExterno = evt.cliente_externo_nome ?? evt.cliente_nome ?? null;
      if (nomeExterno) {
        clienteControlId = await findOrCreateClienteByNome(nomeExterno, tenantId);
      }
    }
    if (!clienteControlId) {
      console.warn(`[HUB-08] Fiscal event ${evt.id} sem clienteControlId — AR não gerado`);
      return { arId: null, jaExistia: false };
    }

    // 4. Calcular vencimento
    let dataVencimento: string;
    if (evt.milestone_id) {
      const mr = await pool.query(
        `SELECT due_date FROM project_billing_milestones WHERE id = $1`, [evt.milestone_id]);
      dataVencimento = mr.rows[0]?.due_date
        ? String(mr.rows[0].due_date).split("T")[0]
        : (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0]; })();
    } else {
      const d = new Date(); d.setDate(d.getDate() + 30);
      dataVencimento = d.toISOString().split("T")[0];
    }

    // 5. Criar lançamento de contas a receber
    const result = await gerarLancamentoReceber({
      tenantId,
      clienteControlId,
      pessoaId: evt.cliente_id || null,
      favorecido: evt.cliente_externo_nome ?? evt.cliente_nome ?? undefined,
      descricao: `NFS-e ${nfseNumber} — ${evt.project_code ?? evt.project_title ?? "Projeto"}`,
      valor: parseFloat(evt.amount),
      dataVencimento,
      origemRefTipo: "nfe",
      origemRefId: evt.id,
      criadoPor: userId,
      observacoes: `NFS-e emitida pelo Hub de Projetos`,
    });

    if (result.jaExiste) {
      return { arId: result.lancamentos?.[0]?.id ?? null, jaExistia: true };
    }
    if (result.ok && result.lancamentos?.[0]) {
      const arId = result.lancamentos[0].id;
      await pool.query(
        `UPDATE project_fiscal_events SET ar_lancamento_id = $1 WHERE id = $2`,
        [arId, evt.id]
      );
      if (evt.milestone_id) {
        await pool.query(
          `UPDATE project_billing_milestones
           SET ar_lancamento_id = COALESCE(ar_lancamento_id, $1),
               fiscal_event_id  = COALESCE(fiscal_event_id,  $2)
           WHERE id = $3`,
          [arId, evt.id, evt.milestone_id]
        );
      }
      return { arId, jaExistia: false };
    }
    console.error(`[HUB-08] Erro ao gerar AR:`, result.error);
    return { arId: null, jaExistia: false };
  } catch (e: any) {
    console.error(`[HUB-08] Exceção ao gerar AR pós-NFS-e:`, e.message);
    return { arId: null, jaExistia: false };
  }
}

export function registerHub08Routes(app: Express) {

  // ── Migration idempotente — adiciona ar_lancamento_id em fiscal_events ─────
  pool.query(`
    ALTER TABLE project_fiscal_events
      ADD COLUMN IF NOT EXISTS ar_lancamento_id VARCHAR
  `).catch(() => { /* tabela pode não existir ainda */ });

  // ── Emitir NFS-e via Control Plus ─────────────────────────────────────────
  // POST /api/hub/fiscal-events/:eventId/emit-nfse
  app.post("/api/hub/fiscal-events/:eventId/emit-nfse", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const userId   = (req as any).user?.id as string;
    const { serviceDescription, serviceCode, empresaId } = req.body;

    try {
      // Buscar evento fiscal + projeto
      const { rows: [evt] } = await pool.query(
        `SELECT fe.*, p.title AS project_title, p.project_code,
           p.cliente_nome, p.cliente_externo_nome, p.cliente_id
         FROM project_fiscal_events fe
         JOIN projects p ON p.id = fe.project_id
         WHERE fe.id = $1 AND fe.tenant_id = $2
           AND fe.event_status = 'aprovado'`,
        [req.params.eventId, tenantId]
      );
      if (!evt) return res.status(404).json({ error: "Evento não encontrado ou não aprovado" });

      // Calcular retenções
      const retencoes = calcularRetencoes(Number(evt.amount), evt.municipio_ibge);

      // Chamar Control Plus via plusFetch
      const PLUS_URL = process.env.PLUS_URL || process.env.CONTROL_PLUS_URL || "";
      const PLUS_TOKEN = process.env.PLUS_API_TOKEN || process.env.CONTROL_PLUS_SUPERADMIN_TOKEN || "";

      if (!PLUS_URL || !PLUS_TOKEN) {
        // Modo simulado para desenvolvimento
        const fakeNfse = `SIMUL-${Date.now()}`;
        await pool.query(
          `UPDATE project_fiscal_events
           SET event_status = 'emitido', nfse_number = $1, approved_by = $2, approved_at = NOW()
           WHERE id = $3`,
          [fakeNfse, userId, req.params.eventId]
        );
        // Gerar AR no Control mesmo em modo simulado
        const ar = await gerarARParaNfse(
          { ...evt, nfse_number: fakeNfse }, fakeNfse, tenantId, userId
        );
        return res.json({
          ok: true, simulated: true,
          nfseNumber: fakeNfse,
          arLancamentoId: ar.arId,
          arJaExistia: ar.jaExistia,
          message: ar.arId
            ? `Modo simulado — AR criado no Control (${ar.arId.substring(0,8)}...)`
            : "Control Plus não configurado — modo simulado (sem clienteControlId para AR)",
        });
      }

      // FISC-01: enriquecer tomador com dados fiscais completos
      let tomadorEnriquecido: any = {
        nome: evt.cliente_externo_nome ?? evt.cliente_nome ?? "Cliente",
      };
      if (evt.cliente_id) {
        const { rows: [pessoaRow] } = await pool.query(
          `SELECT p.*,
                  e.logradouro, e.numero, e.complemento, e.bairro,
                  e.cidade, e.codigo_municipio, e.uf, e.cep, e.pais, e.codigo_pais,
                  c_email.valor AS email_principal,
                  c_tel.valor   AS telefone_principal
           FROM pessoas p
           LEFT JOIN enderecos e
             ON e.pessoa_id = p.id AND e.tipo = 'principal'
           LEFT JOIN contatos c_email
             ON c_email.pessoa_id = p.id AND c_email.tipo = 'email' AND c_email.is_principal = 1
           LEFT JOIN contatos c_tel
             ON c_tel.pessoa_id = p.id AND c_tel.tipo IN ('telefone','celular') AND c_tel.is_principal = 1
           WHERE p.id = $1 AND p.tenant_id = $2
           LIMIT 1`,
          [evt.cliente_id, tenantId]
        );
        if (pessoaRow) {
          const { montarDestinatarioNfe } = await import("../fisc/schema_patch_pessoas");
          tomadorEnriquecido = montarDestinatarioNfe({
            tipoPessoa:      pessoaRow.tipo_pessoa,
            nomeFantasia:    pessoaRow.nome_fantasia,
            razaoSocial:     pessoaRow.razao_social,
            cnpjCpf:         pessoaRow.cnpj_cpf,
            rg:              pessoaRow.rg,
            ie:              pessoaRow.ie,
            rgIe:            pessoaRow.rg_ie,
            contribuinte:    pessoaRow.contribuinte,
            consumidorFinal: pessoaRow.consumidor_final,
            email:           pessoaRow.email_principal,
            telefone:        pessoaRow.telefone_principal,
            enderecoPrincipal: pessoaRow.logradouro ? {
              logradouro: pessoaRow.logradouro, numero: pessoaRow.numero,
              complemento: pessoaRow.complemento, bairro: pessoaRow.bairro,
              cidade: pessoaRow.cidade, codigoMunicipio: pessoaRow.codigo_municipio,
              uf: pessoaRow.uf, cep: pessoaRow.cep,
              pais: pessoaRow.pais, codigoPais: pessoaRow.codigo_pais,
            } : null,
          });
        }
      }

      // Payload para NFS-e no Control Plus
      const nfsePayload = {
        empresa_id: empresaId ?? 1,
        tomador: tomadorEnriquecido,
        servico: {
          descricao: serviceDescription ?? `Serviços de engenharia — ${evt.project_code}`,
          codigo_servico: serviceCode ?? evt.service_code ?? "7.01",
          valor: Number(evt.amount),
          municipio_ibge: evt.municipio_ibge,
        },
        retencoes: {
          iss:  retencoes.iss,
          ir:   retencoes.ir,
          pcc:  retencoes.pcc,
        },
        competencia: evt.competencia ?? new Date().toISOString().split("T")[0],
        natureza_operacao: "Tributação no Município",
      };

      const response = await fetch(`${PLUS_URL}/api/nfse/emitir`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${PLUS_TOKEN}`,
        },
        body: JSON.stringify(nfsePayload),
      });

      const result = await response.json();

      if (result.success || result.numero) {
        const nfseNumber = result.numero ?? result.nfse_number ?? String(Date.now());
        await pool.query(
          `UPDATE project_fiscal_events
           SET event_status = 'emitido', nfse_number = $1,
               retention_iss = $2, retention_ir = $3, retention_pcc = $4,
               approved_at = NOW()
           WHERE id = $5`,
          [nfseNumber, retencoes.iss, retencoes.ir, retencoes.pcc, req.params.eventId]
        );
        // Gerar AR no Control após emissão confirmada
        const ar = await gerarARParaNfse(evt, nfseNumber, tenantId, userId);
        res.json({ ok: true, nfseNumber, retencoes, result, arLancamentoId: ar.arId, arJaExistia: ar.jaExistia });
      } else {
        res.status(422).json({ error: result.message ?? "Erro ao emitir NFS-e", detail: result });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Calcular retenções preview ─────────────────────────────────────────────
  app.post("/api/hub/fiscal/calcular-retencoes", ...auth, async (req, res) => {
    const { amount, municipioIbge } = req.body;
    if (!amount) return res.status(400).json({ error: "amount obrigatório" });
    res.json(calcularRetencoes(Number(amount), municipioIbge));
  });

  // ── Cancelar NFS-e ─────────────────────────────────────────────────────────
  app.post("/api/hub/fiscal-events/:eventId/cancel", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const { justificativa } = req.body;
    if (!justificativa) return res.status(400).json({ error: "justificativa obrigatória" });
    try {
      const { rows: [evt] } = await pool.query(
        `SELECT * FROM project_fiscal_events WHERE id = $1 AND tenant_id = $2 AND event_status = 'emitido'`,
        [req.params.eventId, tenantId]
      );
      if (!evt) return res.status(404).json({ error: "Evento não encontrado ou não emitido" });

      const PLUS_URL = process.env.PLUS_URL || process.env.CONTROL_PLUS_URL || "";
      const PLUS_TOKEN = process.env.PLUS_API_TOKEN || process.env.CONTROL_PLUS_SUPERADMIN_TOKEN || "";

      if (PLUS_URL && PLUS_TOKEN && evt.nfse_number) {
        await fetch(`${PLUS_URL}/api/nfse/cancelar`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${PLUS_TOKEN}` },
          body: JSON.stringify({ numero: evt.nfse_number, justificativa }),
        });
      }

      await pool.query(
        `UPDATE project_fiscal_events SET event_status = 'cancelado' WHERE id = $1`,
        [req.params.eventId]
      );
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Painel fiscal do projeto ───────────────────────────────────────────────
  app.get("/api/hub/projects/:id/fiscal-dashboard", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    try {
      // Eventos por status
      const { rows: byStatus } = await pool.query(
        `SELECT event_status, COUNT(*) AS count,
           COALESCE(SUM(amount),0) AS total_amount,
           COALESCE(SUM(retention_iss),0) AS total_iss,
           COALESCE(SUM(retention_ir),0) AS total_ir,
           COALESCE(SUM(retention_pcc),0) AS total_pcc
         FROM project_fiscal_events
         WHERE project_id = $1 AND tenant_id = $2
         GROUP BY event_status`,
        [req.params.id, tenantId]
      );

      // Eventos pendentes de emissão (aprovados)
      const { rows: pendentes } = await pool.query(
        `SELECT fe.*, m.title AS milestone_title
         FROM project_fiscal_events fe
         LEFT JOIN project_billing_milestones m ON m.id = fe.milestone_id
         WHERE fe.project_id = $1 AND fe.tenant_id = $2
           AND fe.event_status IN ('pendente','aprovado')
         ORDER BY fe.created_at`,
        [req.params.id, tenantId]
      );

      // Já emitidos
      const { rows: emitidos } = await pool.query(
        `SELECT fe.*, m.title AS milestone_title
         FROM project_fiscal_events fe
         LEFT JOIN project_billing_milestones m ON m.id = fe.milestone_id
         WHERE fe.project_id = $1 AND fe.tenant_id = $2
           AND fe.event_status = 'emitido'
         ORDER BY fe.approved_at DESC`,
        [req.params.id, tenantId]
      );

      // Totais consolidados
      const totais = byStatus.reduce((acc: any, r: any) => ({
        totalEmitido:   acc.totalEmitido   + (r.event_status === "emitido"  ? Number(r.total_amount) : 0),
        totalPendente:  acc.totalPendente  + (r.event_status !== "emitido" && r.event_status !== "cancelado" ? Number(r.total_amount) : 0),
        totalIss:       acc.totalIss       + Number(r.total_iss),
        totalIr:        acc.totalIr        + Number(r.total_ir),
        totalPcc:       acc.totalPcc       + Number(r.total_pcc),
        totalRetencoes: acc.totalRetencoes + Number(r.total_iss) + Number(r.total_ir) + Number(r.total_pcc),
      }), { totalEmitido:0, totalPendente:0, totalIss:0, totalIr:0, totalPcc:0, totalRetencoes:0 });

      res.json({ byStatus, pendentes, emitidos, totais });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Atualizar nfse_number manualmente (pós-emissão externa) ───────────────
  app.patch("/api/hub/fiscal-events/:eventId/nfse", ...auth, async (req, res) => {
    const tenantId = (req as any).tenantId as string;
    const { nfseNumber, retentionIss, retentionIr, retentionPcc } = req.body;
    if (!nfseNumber) return res.status(400).json({ error: "nfseNumber obrigatório" });
    try {
      const { rows } = await pool.query(
        `UPDATE project_fiscal_events
         SET nfse_number = $1, event_status = 'emitido',
             retention_iss = COALESCE($2, retention_iss),
             retention_ir = COALESCE($3, retention_ir),
             retention_pcc = COALESCE($4, retention_pcc),
             approved_at = COALESCE(approved_at, NOW())
         WHERE id = $5 AND tenant_id = $6 RETURNING *`,
        [nfseNumber, retentionIss ?? null, retentionIr ?? null, retentionPcc ?? null,
         req.params.eventId, tenantId]
      );
      if (!rows[0]) return res.status(404).json({ error: "Evento não encontrado" });
      res.json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
}
