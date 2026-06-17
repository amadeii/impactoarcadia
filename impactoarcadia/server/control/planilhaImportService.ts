/**
 * Sprint C-E11 — Import Planilha Impacto (SheetJS)
 * Lê .xlsm/.xlsx e importa: bancos+saldos, plano de contas, clientes, fornecedores.
 */
import * as XLSX from "xlsx";
import { pool } from "../../db/index";

export interface ImportPreview {
  bancos: { nome: string; tipo: string; saldo: number }[];
  clientes: { nome: string; cnpj?: string; tipo: "J" | "F" }[];
  fornecedores: { nome: string; cnpj?: string; tipo: "J" | "F" }[];
  planosContas: { codigo: string; descricao: string; tipo: string }[];
  metas: { descricao: string; valor: number; competencia: string }[];
  stats: {
    totalBancos: number; totalClientes: number; totalFornecedores: number;
    totalPlanosContas: number; totalMetas: number;
  };
}

function cleanCnpj(v: any): string | undefined {
  if (!v) return undefined;
  const s = String(v).replace(/\D/g, "");
  return s.length >= 11 ? s : undefined;
}

function detectTipo(nome: string): "J" | "F" {
  const lower = nome.toLowerCase();
  if (lower.includes("ltda") || lower.includes("s.a") || lower.includes("eireli") || lower.includes("me ")) return "J";
  return "J"; // default empresas
}

/** Lê buffer da planilha e retorna preview sem gravar no banco */
export function parsePreview(buffer: Buffer): ImportPreview {
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const preview: ImportPreview = {
    bancos: [], clientes: [], fornecedores: [],
    planosContas: [], metas: [],
    stats: { totalBancos: 0, totalClientes: 0, totalFornecedores: 0, totalPlanosContas: 0, totalMetas: 0 },
  };

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    if (rows.length < 2) continue;

    const header = (rows[0] as any[]).map((h: any) => String(h ?? "").toLowerCase().trim());
    const nameLower = sheetName.toLowerCase();

    if (nameLower.includes("banco") || nameLower.includes("conta")) {
      for (const row of rows.slice(1)) {
        const nome = String(row[0] ?? "").trim();
        if (!nome) continue;
        preview.bancos.push({
          nome,
          tipo: String(row[1] ?? "corrente").toLowerCase().includes("poup") ? "poupanca" : "corrente",
          saldo: Number(row[2] ?? 0),
        });
      }
    } else if (nameLower.includes("cliente")) {
      for (const row of rows.slice(1)) {
        const nome = String(row[0] ?? "").trim();
        if (!nome) continue;
        preview.clientes.push({ nome, cnpj: cleanCnpj(row[1]), tipo: detectTipo(nome) });
      }
    } else if (nameLower.includes("fornecedor") || nameLower.includes("supplier")) {
      for (const row of rows.slice(1)) {
        const nome = String(row[0] ?? "").trim();
        if (!nome) continue;
        preview.fornecedores.push({ nome, cnpj: cleanCnpj(row[1]), tipo: detectTipo(nome) });
      }
    } else if (nameLower.includes("plano") || nameLower.includes("conta")) {
      for (const row of rows.slice(1)) {
        const codigo = String(row[0] ?? "").trim();
        const descricao = String(row[1] ?? "").trim();
        if (!descricao) continue;
        preview.planosContas.push({
          codigo,
          descricao,
          tipo: String(row[2] ?? "despesa").toLowerCase().includes("receit") ? "receita" : "despesa",
        });
      }
    } else if (nameLower.includes("meta") || nameLower.includes("orcamento") || nameLower.includes("budget")) {
      for (const row of rows.slice(1)) {
        const descricao = String(row[0] ?? "").trim();
        const valor = Number(row[1] ?? 0);
        if (!descricao || !valor) continue;
        preview.metas.push({ descricao, valor, competencia: String(row[2] ?? "") });
      }
    }
  }

  preview.stats = {
    totalBancos: preview.bancos.length,
    totalClientes: preview.clientes.length,
    totalFornecedores: preview.fornecedores.length,
    totalPlanosContas: preview.planosContas.length,
    totalMetas: preview.metas.length,
  };

  return preview;
}

/** Confirma importação — grava no banco em transação */
export async function confirmImport(
  tenantId: string,
  clienteId: string,
  preview: ImportPreview,
  userId?: string,
): Promise<{ importados: Record<string, number>; erros: string[] }> {
  const erros: string[] = [];
  const importados: Record<string, number> = { bancos: 0, clientes: 0, fornecedores: 0, planosContas: 0, metas: 0 };
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Bancos
    for (const b of preview.bancos) {
      try {
        await client.query(`
          INSERT INTO contas_bancarias (tenant_id, cliente_id, banco, tipo, saldo_inicial, saldo_atual, ativo)
          VALUES ($1,$2,$3,$4,$5,$5,true)
          ON CONFLICT DO NOTHING
        `, [tenantId, clienteId, b.nome, b.tipo, b.saldo]);
        importados.bancos++;
      } catch (e: any) { erros.push(`Banco "${b.nome}": ${e.message}`); }
    }

    // Clientes (pessoas com papel=cliente)
    for (const c of preview.clientes) {
      try {
        // Verifica duplicata por CNPJ
        if (c.cnpj) {
          const ex = await client.query(`SELECT id FROM pessoas WHERE tenant_id=$1 AND cnpj_cpf=$2 LIMIT 1`, [tenantId, c.cnpj]);
          if (ex.rows[0]) { importados.clientes++; continue; }
        }
        const ins = await client.query(`
          INSERT INTO pessoas (tenant_id, nome_fantasia, cnpj_cpf, tipo_pessoa)
          VALUES ($1,$2,$3,$4) RETURNING id
        `, [tenantId, c.nome, c.cnpj ?? null, c.tipo]);
        await client.query(`
          INSERT INTO pessoa_papeis (tenant_id, pessoa_id, tipo_papel)
          VALUES ($1,$2,'cliente') ON CONFLICT DO NOTHING
        `, [tenantId, ins.rows[0].id]);
        importados.clientes++;
      } catch (e: any) { erros.push(`Cliente "${c.nome}": ${e.message}`); }
    }

    // Fornecedores (pessoas com papel=fornecedor)
    for (const f of preview.fornecedores) {
      try {
        if (f.cnpj) {
          const ex = await client.query(`SELECT id FROM pessoas WHERE tenant_id=$1 AND cnpj_cpf=$2 LIMIT 1`, [tenantId, f.cnpj]);
          if (ex.rows[0]) {
            await client.query(`
              INSERT INTO pessoa_papeis (tenant_id, pessoa_id, tipo_papel)
              VALUES ($1,$2,'fornecedor') ON CONFLICT DO NOTHING
            `, [tenantId, ex.rows[0].id]);
            importados.fornecedores++; continue;
          }
        }
        const ins = await client.query(`
          INSERT INTO pessoas (tenant_id, nome_fantasia, cnpj_cpf, tipo_pessoa)
          VALUES ($1,$2,$3,$4) RETURNING id
        `, [tenantId, f.nome, f.cnpj ?? null, f.tipo]);
        await client.query(`
          INSERT INTO pessoa_papeis (tenant_id, pessoa_id, tipo_papel)
          VALUES ($1,$2,'fornecedor') ON CONFLICT DO NOTHING
        `, [tenantId, ins.rows[0].id]);
        importados.fornecedores++;
      } catch (e: any) { erros.push(`Fornecedor "${f.nome}": ${e.message}`); }
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  return { importados, erros };
}

/**
 * parseOrcamentoPlanilha — CTL-03-B
 * Extrai orçamento das abas MetaDespesas e MetaReceitas da planilha Impacto.
 *
 * Layout esperado:
 *   Linha 1: cabeçalho (Col A = nome/código, Cols B-M = Jan..Dez)
 *   Linhas de grupo: Col A começa com "2.X" ou "1.X"
 *   Linhas de item:  Col A = descrição, Cols B-M = valores mensais
 */
export function parseOrcamentoPlanilha(
  buffer: Buffer,
  _ano: number,
): Array<{ descricao: string; grupoCodigo: string; meses: Record<number, number> }> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const resultado: Array<{ descricao: string; grupoCodigo: string; meses: Record<number, number> }> = [];

  for (const abaAlvo of ["MetaDespesas", "MetaReceitas"]) {
    const ws = wb.Sheets[abaAlvo];
    if (!ws) continue;

    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    if (rows.length < 2) continue;

    let grupoAtual = "";

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row[0] == null) continue;

      const col0 = String(row[0]).trim();
      if (!col0) continue;

      // Linha de grupo: começa com padrão "1.X" ou "2.X"
      if (/^[12]\.\d{1,2}/.test(col0)) {
        grupoAtual = col0.split(" ")[0];
        continue;
      }

      // Linha de item de orçamento
      const meses: Record<number, number> = {};
      let temValor = false;
      for (let m = 1; m <= 12; m++) {
        const val = row[m]; // colunas B(1)..M(12)
        if (val != null && !isNaN(Number(val)) && Number(val) !== 0) {
          meses[m] = Math.abs(Number(val));
          temValor = true;
        }
      }
      if (!temValor) continue;

      resultado.push({ descricao: col0, grupoCodigo: grupoAtual, meses });
    }
  }

  return resultado;
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTAÇÃO COMPLETA — Lançamentos (ContasReceber + ContasPagar + Saldo Inicial)
// Sprint CTL-IMPORT-01
// ─────────────────────────────────────────────────────────────────────────────

/** Converte número serial Excel → string "YYYY-MM-DD" */
function excelDateToISO(v: any): string | null {
  if (!v) return null;
  const n = Number(v);
  if (!isFinite(n) || n < 1) return null;
  // Serial 1 = 1900-01-01 (Excel conta errado até 60, ajuste +1 necessário)
  const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseMoeda(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Math.abs(v);
  const s = String(v).replace(/[^\d,.-]/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.abs(n);
}

function normStatus(s: string): "previsto" | "recebido" | "pago" | "cancelado" {
  const u = s.toUpperCase();
  if (u.includes("RECEBIDO")) return "recebido";
  if (u.includes("PAGO")) return "pago";
  return "previsto";
}

export interface LancamentoImport {
  tipo: "receber" | "pagar";
  data_documento: string | null;
  documento: string | null;
  plano_conta: string | null;
  projeto: string | null;
  conta_bancaria: string | null;
  parceiro: string | null;
  tipo_lanc: string | null;
  cliente_fornecedor: string | null;
  descricao: string | null;
  valor: number;
  numero_parcela: string | null;
  valor_parcela: number;
  vencimento: string | null;
  liquidacao: string | null;
  status: "previsto" | "recebido" | "pago" | "cancelado";
}

export interface ImportCompletaPreview extends ImportPreview {
  lancamentosReceber: LancamentoImport[];
  lancamentosPagar:   LancamentoImport[];
  saldosIniciais:     { conta: string; saldo: number }[];
  sheetsFound:        string[];
  statsLanc: {
    totalReceber: number;
    totalPagar:   number;
    totalSaldos:  number;
    valorReceber: number;
    valorPagar:   number;
  };
}

/** Lê as 4 colunas de cabeçalho reais em ContasReceber e ContasPagar */
function parseLancamentos(ws: any, tipo: "receber" | "pagar"): LancamentoImport[] {
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  if (rows.length < 2) return [];

  // Encontra a linha de cabeçalho real (contém "Data Dcto" ou "Data Docto" ou "Data Doc")
  const norm = (s: any) => String(s ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const r = rows[i].map(norm);
    if (r.some(c => c.includes("data dcto") || c.includes("data docto") || c.includes("data doc") || c.includes("data venc"))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const header = rows[headerIdx].map((h: any) => String(h ?? "").trim().toLowerCase());

  // Mapeia colunas pela posição do cabeçalho real da planilha Impacto
  // ContasReceber: Data Dcto | Documento | Plano de Conta | Projeto | Conta | Parceiro | Tipo | Cliente | Descrição | Recebido pelo banco | Valor R$ | Parcelas | Valor Parcela | Vencimento | Recebimento | Status
  // ContasPagar:   Data Docto | Documento | Plano de Conta | Projeto | Conta | Tipo | Fornecedor | Descrição | Pago pelo Banco | Valor R$ | Parcelas | Valor Parcela | Vencimento | Pagamento | Status
  // Normaliza removendo acentos para comparação tolerante
  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const headerNorm = header.map(normalize);
  const col = (name: string): number => {
    const n = normalize(name);
    return headerNorm.findIndex(h => h.includes(n));
  };

  const iDataDoc   = Math.max(col("data dc"), col("data do"), 0);
  const iDocumento = col("documento");
  const iPlano     = col("plano de conta");
  const iProjeto   = col("projeto");
  // Banco real: "Recebido pelo banco" (receber) ou "Pago pelo Banco" (pagar)
  // NÃO usar col("conta") pois "plano de conta" seria encontrado primeiro
  const iConta     = tipo === "receber"
    ? (col("recebido pelo banco") >= 0 ? col("recebido pelo banco") : col("recebido"))
    : (col("pago pelo banco") >= 0 ? col("pago pelo banco") : col("pago pelo"));
  const iParceiro  = tipo === "receber" ? col("parceiro") : -1;
  const iTipoLanc  = col("tipo");
  const iParteirao = tipo === "receber" ? col("cliente") : col("fornecedor");
  const iDescricao = col("descricao"); // sem acento na busca
  const iValor     = col("valor r$") >= 0 ? col("valor r$") : col("valor");
  const iParcelas  = col("parcelas");
  const iValParcela= col("valor parcela");
  const iVencto    = col("vencimento");
  const iLiquidacao= tipo === "receber" ? col("recebimento") : col("pagamento");
  const iStatus    = col("status");

  const result: LancamentoImport[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c: any) => c == null || c === "")) continue;

    const valor = parseMoeda(row[iValor]);
    if (valor <= 0) continue;

    const statusRaw = String(row[iStatus] ?? "").trim();
    // Ignora linhas de cabeçalho duplicado
    if (statusRaw.toUpperCase() === "STATUS") continue;
    // Ignora linhas de total
    if (String(row[iPlano] ?? "").toLowerCase().includes("total")) continue;

    result.push({
      tipo,
      data_documento: excelDateToISO(row[iDataDoc]),
      documento:       iDocumento >= 0 ? String(row[iDocumento] ?? "").trim() || null : null,
      plano_conta:     iPlano >= 0     ? String(row[iPlano] ?? "").trim() || null      : null,
      projeto:         iProjeto >= 0   ? String(row[iProjeto] ?? "").trim() || null    : null,
      conta_bancaria:  iConta >= 0     ? String(row[iConta] ?? "").trim() || null      : null,
      parceiro:        iParceiro >= 0  ? String(row[iParceiro] ?? "").trim() || null   : null,
      tipo_lanc:       iTipoLanc >= 0  ? String(row[iTipoLanc] ?? "").trim() || null  : null,
      cliente_fornecedor: iParteirao >= 0 ? String(row[iParteirao] ?? "").trim() || null : null,
      descricao:       iDescricao >= 0 ? String(row[iDescricao] ?? "").trim() || null  : null,
      valor,
      numero_parcela:  iParcelas >= 0  ? String(row[iParcelas] ?? "").trim() || null  : null,
      valor_parcela:   parseMoeda(row[iValParcela] ?? valor),
      vencimento:      excelDateToISO(row[iVencto]),
      liquidacao:      iLiquidacao >= 0 ? excelDateToISO(row[iLiquidacao]) : null,
      status:          normStatus(statusRaw),
    });
  }

  return result;
}

/** Parse completo incluindo lançamentos */
export function parsePreviewCompleto(buffer: Buffer): ImportCompletaPreview {
  const base = parsePreview(buffer);
  const wb = XLSX.read(buffer, { type: "buffer" });

  let lancamentosReceber: LancamentoImport[] = [];
  let lancamentosPagar:   LancamentoImport[] = [];
  const saldosIniciais: { conta: string; saldo: number }[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const lower = sheetName.toLowerCase();
    const nospace = lower.replace(/\s+/g, "");

    if (nospace.includes("contasreceber") || lower.includes("contas a receber") || lower.includes("receber")) {
      lancamentosReceber = parseLancamentos(ws, "receber");
    } else if (nospace.includes("contaspagar") || lower.includes("contas a pagar") || lower.includes("pagar")) {
      lancamentosPagar = parseLancamentos(ws, "pagar");
    } else if (lower.includes("saldo inicial") || lower.includes("saldoinicial") || lower === "saldos") {
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
      // Layout: cada grupo de 2 linhas tem [ContaNome, Valor] alinhados
      // Linha 4 em diante: col B = nome da conta, col C = saldo
      for (let i = 3; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        // Busca qualquer célula não-nula nas primeiras posições
        for (let j = 0; j < Math.min(row.length, 6); j++) {
          const nome = String(row[j] ?? "").trim();
          if (!nome || nome.length < 3) continue;
          // Procura valor numérico na mesma linha
          for (let k = j + 1; k < Math.min(row.length, j + 4); k++) {
            const val = Number(row[k]);
            if (isFinite(val) && val !== 0) {
              saldosIniciais.push({ conta: nome, saldo: val });
              break;
            }
          }
          break;
        }
      }
    }
  }

  const valorReceber = lancamentosReceber.reduce((s, l) => s + l.valor, 0);
  const valorPagar   = lancamentosPagar.reduce((s, l)   => s + l.valor, 0);

  // Log para diagnóstico
  console.log(`[import-planilha] abas encontradas: ${wb.SheetNames.join(", ")}`);
  console.log(`[import-planilha] lançamentos: receber=${lancamentosReceber.length} pagar=${lancamentosPagar.length} saldos=${saldosIniciais.length}`);

  return {
    ...base,
    lancamentosReceber,
    lancamentosPagar,
    saldosIniciais,
    sheetsFound: wb.SheetNames,
    statsLanc: {
      totalReceber: lancamentosReceber.length,
      totalPagar:   lancamentosPagar.length,
      totalSaldos:  saldosIniciais.length,
      valorReceber,
      valorPagar,
    },
  };
}

/** Confirma a importação completa incluindo lançamentos financeiros */
export async function confirmImportCompleto(
  tenantId: string,
  clienteId: string,
  preview: ImportCompletaPreview,
  userId?: string,
): Promise<{ importados: Record<string, number>; erros: string[]; total: number }> {

  // 1. Importa cadastros base (bancos, clientes, fornecedores) via serviço existente
  const baseResult = await confirmImport(tenantId, clienteId, preview, userId);

  const erros: string[] = [...baseResult.erros];
  const importados: Record<string, number> = {
    ...baseResult.importados,
    receber: 0,
    pagar:   0,
    saldos:  0,
  };

  // Abre uma única conexão com transação para agrupar todos os INSERTs
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Helper local que usa o client da transação com SAVEPOINT
    const safeRow = async (sql: string, params: any[]): Promise<string | null> => {
      const sp = "sp_" + Math.random().toString(36).slice(2, 10);
      await client.query(`SAVEPOINT ${sp}`);
      try {
        await client.query(sql, params);
        await client.query(`RELEASE SAVEPOINT ${sp}`);
        return null;
      } catch (e: any) {
        await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
        await client.query(`RELEASE SAVEPOINT ${sp}`);
        return e.message as string;
      }
    };

    // 2. Saldos iniciais — atualiza/insere na tabela contas_bancarias
    for (const s of preview.saldosIniciais) {
      if (!s.conta || s.saldo === 0) continue;
      const err = await safeRow(`
        UPDATE contas_bancarias
        SET saldo_inicial = $3, saldo_atual = $3, updated_at = NOW()
        WHERE tenant_id = $1 AND cliente_id = $2
          AND (LOWER(banco) = LOWER($4) OR LOWER(apelido) = LOWER($4))
      `, [tenantId, clienteId, s.saldo, s.conta]);
      if (err) erros.push(`Saldo "${s.conta}": ${err}`);
      else importados.saldos++;
    }

    // 3. Lançamentos a receber
    for (const l of preview.lancamentosReceber) {
      const err = await safeRow(`
        INSERT INTO lancamentos_financeiros (
          tenant_id, cliente_id, tipo, descricao, favorecido,
          valor, data_vencimento, data_liquidacao, data_documento, documento,
          status, origem, plano_conta_raw, projeto_codigo, conta_bancaria_raw,
          parceiro, tipo_lancamento, numero_parcela, valor_parcela,
          criado_por, created_at, updated_at
        ) VALUES (
          $1, $2, 'receber', $3, $4,
          $5, $6, $7, $8, $9,
          $10, 'import_planilha', $11, $12, $13,
          $14, $15, $16, $17,
          $18, NOW(), NOW()
        )
        ON CONFLICT DO NOTHING
      `, [
        tenantId, clienteId,
        l.descricao ?? l.plano_conta ?? "Importado",
        l.cliente_fornecedor,
        l.valor, l.vencimento, l.liquidacao, l.data_documento, l.documento,
        l.status,
        l.plano_conta, l.projeto, l.conta_bancaria,
        l.parceiro, l.tipo_lanc,
        l.numero_parcela ? (parseInt(l.numero_parcela) || null) : null,
        l.valor_parcela,
        userId ?? null,
      ]);
      if (err) erros.push(`AR "${l.descricao?.slice(0, 40)}": ${err}`);
      else importados.receber++;
    }

    // 4. Lançamentos a pagar
    for (const l of preview.lancamentosPagar) {
      const err = await safeRow(`
        INSERT INTO lancamentos_financeiros (
          tenant_id, cliente_id, tipo, descricao, favorecido,
          valor, data_vencimento, data_liquidacao, data_documento, documento,
          status, origem, plano_conta_raw, projeto_codigo, conta_bancaria_raw,
          tipo_lancamento, numero_parcela, valor_parcela,
          criado_por, created_at, updated_at
        ) VALUES (
          $1, $2, 'pagar', $3, $4,
          $5, $6, $7, $8, $9,
          $10, 'import_planilha', $11, $12, $13,
          $14, $15, $16,
          $17, NOW(), NOW()
        )
        ON CONFLICT DO NOTHING
      `, [
        tenantId, clienteId,
        l.descricao ?? l.plano_conta ?? "Importado",
        l.cliente_fornecedor,
        l.valor, l.vencimento, l.liquidacao, l.data_documento, l.documento,
        l.status,
        l.plano_conta, l.projeto, l.conta_bancaria,
        l.tipo_lanc,
        l.numero_parcela ? (parseInt(l.numero_parcela) || null) : null,
        l.valor_parcela,
        userId ?? null,
      ]);
      if (err) erros.push(`AP "${l.descricao?.slice(0, 40)}": ${err}`);
      else importados.pagar++;
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  const total = Object.values(importados).reduce((a, b) => a + b, 0);
  return { importados, erros, total };
}
