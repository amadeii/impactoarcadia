/**
 * FISC-01 — routes.ts
 * Endpoints de diagnóstico e preview fiscal de pessoas.
 */

import type { Express } from "express";
import { isAuthenticated } from "../portableAuth";
import { tenantContext, requireTenant } from "../tenantContext";
import { pool } from "../../db/index";
import { runMigrationFisc01 } from "./migration_fisc01";
import { montarDestinatarioNfe, resolverCamposFiscaisPessoa } from "./schema_patch_pessoas";

const auth = [isAuthenticated, tenantContext, requireTenant];

export function registerFisc01Routes(app: Express): void {

  // ── Migration (master only) ────────────────────────────────────────────────
  app.post("/api/fisc/migrate-fisc01", isAuthenticated, async (req: any, res) => {
    if (!req.isMaster) return res.status(403).json({ error: "master_required" });
    try {
      await runMigrationFisc01();
      res.json({ ok: true, message: "FISC-01 migration executada." });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── PJ sem IE (triagem) ────────────────────────────────────────────────────
  app.get("/api/fisc/pessoas-sem-ie", ...auth, async (req: any, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, nome_fantasia, cnpj_cpf, rg_ie, ie, contribuinte
         FROM pessoas
         WHERE tenant_id = $1
           AND tipo_pessoa = 'PJ'
           AND (ie IS NULL OR ie = '')
         ORDER BY nome_fantasia
         LIMIT 200`,
        [req.tenantId]
      );
      res.json({ ok: true, total: rows.length, data: rows });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Preview destinatário NF-e de uma pessoa ────────────────────────────────
  app.get("/api/fisc/pessoas/:id/destinatario-nfe", ...auth, async (req: any, res) => {
    try {
      const { rows: [p] } = await pool.query(
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
        [req.params.id, req.tenantId]
      );

      if (!p) return res.status(404).json({ ok: false, error: "Pessoa não encontrada." });

      const fiscal = resolverCamposFiscaisPessoa({
        tipoPessoa:      p.tipo_pessoa,
        rgIe:            p.rg_ie,
        rg:              p.rg,
        ie:              p.ie,
        contribuinte:    p.contribuinte,
        consumidorFinal: p.consumidor_final,
      });

      const destinatario = montarDestinatarioNfe({
        tipoPessoa:      p.tipo_pessoa,
        nomeFantasia:    p.nome_fantasia,
        razaoSocial:     p.razao_social,
        cnpjCpf:         p.cnpj_cpf,
        rg:              p.rg,
        ie:              p.ie,
        rgIe:            p.rg_ie,
        contribuinte:    p.contribuinte,
        consumidorFinal: p.consumidor_final,
        email:           p.email_principal,
        telefone:        p.telefone_principal,
        enderecoPrincipal: p.logradouro ? {
          logradouro:      p.logradouro,
          numero:          p.numero,
          complemento:     p.complemento,
          bairro:          p.bairro,
          cidade:          p.cidade,
          codigoMunicipio: p.codigo_municipio,
          uf:              p.uf,
          cep:             p.cep,
          pais:            p.pais,
          codigoPais:      p.codigo_pais,
        } : null,
      });

      const alertas: string[] = [];
      if (!destinatario.cpf_cnpj || destinatario.cpf_cnpj.length < 11) {
        alertas.push("CPF/CNPJ ausente ou inválido — NF-e será rejeitada.");
      }
      if (p.tipo_pessoa === 'PJ' && destinatario.ind_ie_dest === 1 && !destinatario.ie) {
        alertas.push("Contribuinte marcado mas IE ausente — NF-e será rejeitada (rejeição 561).");
      }
      if (!destinatario.endereco) {
        alertas.push("Endereço principal não cadastrado — obrigatório para NF-e.");
      }
      if (destinatario.endereco && !destinatario.endereco.codigo_municipio) {
        alertas.push("Código IBGE do município não preenchido — obrigatório para NF-e.");
      }

      res.json({
        ok: true,
        data: {
          campos_fiscais:   fiscal,
          destinatario_nfe: destinatario,
          alertas,
          status: alertas.length === 0 ? 'pronto' : 'pendencias',
        }
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ── Relatório IE de todas as PJ do tenant ──────────────────────────────────
  app.get("/api/fisc/relatorio-ie", ...auth, async (req: any, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT
           p.id,
           p.nome_fantasia,
           p.cnpj_cpf,
           p.ie,
           p.rg_ie        AS ie_legado,
           p.contribuinte,
           p.consumidor_final,
           CASE
             WHEN p.ie IS NOT NULL AND p.ie != '' THEN 'ok'
             WHEN p.rg_ie IS NOT NULL AND p.rg_ie != '' THEN 'migrar'
             ELSE 'ausente'
           END             AS status_ie,
           e.codigo_municipio,
           e.uf
         FROM pessoas p
         LEFT JOIN enderecos e ON e.pessoa_id = p.id AND e.tipo = 'principal'
         WHERE p.tenant_id = $1 AND p.tipo_pessoa = 'PJ'
         ORDER BY status_ie, p.nome_fantasia`,
        [req.tenantId]
      );
      const summary = {
        total:   rows.length,
        ok:      rows.filter(r => r.status_ie === 'ok').length,
        migrar:  rows.filter(r => r.status_ie === 'migrar').length,
        ausente: rows.filter(r => r.status_ie === 'ausente').length,
      };
      res.json({ ok: true, summary, data: rows });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });
}
