import { useState, useMemo, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInputBR } from "@/components/ui/date-input-br";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Plus, Trash2, Wand2 } from "lucide-react";
import * as XLSX from "xlsx";
import { parseValorBR, formatValorBR } from "@shared/parse-valor";

const COLUNAS = [
  "tipo",
  "status",
  "descricao",
  "favorecido",
  "documento",
  "valor",
  "dataEmissao",
  "dataVencimento",
  "planoContaCodigo",
  "centroCustoCodigo",
  "contaBancariaBanco",
  "observacoes",
] as const;

type LinhaCsv = Record<string, string>;

const TEMPLATE_EXEMPLO: LinhaCsv[] = [
  {
    tipo: "pagar",
    status: "previsto",
    descricao: "Aluguel sala comercial — Maio/2026",
    favorecido: "Imobiliária Central LTDA",
    documento: "BOL-2026-05-001",
    valor: "3500.00",
    dataEmissao: "25/04/2026",
    dataVencimento: "05/05/2026",
    planoContaCodigo: "4.1.01",
    centroCustoCodigo: "ADM",
    contaBancariaBanco: "Itaú",
    observacoes: "Pagar via PIX",
  },
  {
    tipo: "receber",
    status: "previsto",
    descricao: "Mensalidade consultoria — Cliente XYZ",
    favorecido: "Cliente XYZ S/A",
    documento: "NF-2026-001",
    valor: "12000.00",
    dataEmissao: "20/04/2026",
    dataVencimento: "10/05/2026",
    planoContaCodigo: "3.1.01",
    centroCustoCodigo: "COMERCIAL",
    contaBancariaBanco: "Bradesco",
    observacoes: "",
  },
];

function escapeCsv(v: string): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function gerarCsvTemplate(): string {
  const linhas = [COLUNAS.join(",")];
  TEMPLATE_EXEMPLO.forEach((ex) => {
    linhas.push(COLUNAS.map((c) => escapeCsv(ex[c] ?? "")).join(","));
  });
  return linhas.join("\n");
}

function downloadFile(name: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob(["\ufeff" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadXlsxTemplate(filename: string) {
  const linhas = TEMPLATE_EXEMPLO.map((row) => {
    const obj: LinhaCsv = {};
    COLUNAS.forEach((c) => { obj[c] = row[c] ?? ""; });
    return obj;
  });
  const ws = XLSX.utils.json_to_sheet(linhas, { header: [...COLUNAS] });
  ws["!cols"] = COLUNAS.map((c) => ({
    wch: c === "descricao" || c === "favorecido" || c === "observacoes" ? 32 : Math.max(c.length + 2, 14),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Lancamentos");
  const instrucoes = [
    ["Template — Lançamentos Financeiros (Arcádia Control)"],
    [],
    ["Colunas obrigatórias", "tipo (pagar|receber), descricao, valor, dataVencimento (dd/mm/aaaa)"],
    ["Lookups por código", "planoContaCodigo / centroCustoCodigo (use o código, não o ID)"],
    ["Lookup por nome", "contaBancariaBanco (nome do banco — case insensitive)"],
    ["Limite por arquivo", "2000 linhas — tudo gravado em transação atômica"],
    [],
    ["Formato de data", "dd/mm/aaaa (ex: 10/05/2026) — também aceito: aaaa-mm-dd"],
    ["Formato de valor", "número decimal com ponto (ex: 1500.50) — vírgula BR também aceita"],
    ["Status válidos", "previsto | pago | recebido | vencido | cancelado"],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instrucoes);
  wsInstr["!cols"] = [{ wch: 28 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, "Instruções");
  XLSX.writeFile(wb, filename);
}

const COLUNAS_DATA = new Set(["dataEmissao", "dataVencimento", "dataPagamento"]);
const COLUNAS_NUMERO = new Set(["valor"]);

const HEADER_ALIASES: Record<string, (typeof COLUNAS)[number]> = {
  tipo: "tipo",
  status: "status",
  situacao: "status",
  descricao: "descricao",
  descrição: "descricao",
  desc: "descricao",
  historico: "descricao",
  histórico: "descricao",
  favorecido: "favorecido",
  beneficiario: "favorecido",
  beneficiário: "favorecido",
  fornecedor: "favorecido",
  cliente: "favorecido",
  pagadorrecebedor: "favorecido",
  documento: "documento",
  doc: "documento",
  numerodocumento: "documento",
  nrdoc: "documento",
  notafiscal: "documento",
  nf: "documento",
  valor: "valor",
  valorrs: "valor",
  valor_rs: "valor",
  valortotal: "valor",
  total: "valor",
  preco: "valor",
  preço: "valor",
  dataemissao: "dataEmissao",
  dataemissão: "dataEmissao",
  emissao: "dataEmissao",
  emissão: "dataEmissao",
  dtemissao: "dataEmissao",
  dtemissão: "dataEmissao",
  datadeemissao: "dataEmissao",
  datadeemissão: "dataEmissao",
  datavencimento: "dataVencimento",
  vencimento: "dataVencimento",
  dtvencimento: "dataVencimento",
  vencto: "dataVencimento",
  vcto: "dataVencimento",
  datadevencimento: "dataVencimento",
  vence: "dataVencimento",
  planocontacodigo: "planoContaCodigo",
  planoconta: "planoContaCodigo",
  planodecontas: "planoContaCodigo",
  plano: "planoContaCodigo",
  conta: "planoContaCodigo",
  codigoconta: "planoContaCodigo",
  centrocustocodigo: "centroCustoCodigo",
  centrocusto: "centroCustoCodigo",
  centrodecusto: "centroCustoCodigo",
  centro: "centroCustoCodigo",
  codigocentro: "centroCustoCodigo",
  contabancariabanco: "contaBancariaBanco",
  contabancaria: "contaBancariaBanco",
  banco: "contaBancariaBanco",
  bancoinstituicao: "contaBancariaBanco",
  bancoinstituição: "contaBancariaBanco",
  instituicao: "contaBancariaBanco",
  instituição: "contaBancariaBanco",
  observacoes: "observacoes",
  observações: "observacoes",
  observacao: "observacoes",
  observação: "observacoes",
  obs: "observacoes",
  notas: "observacoes",
};

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function canonicalKey(rawKey: string): (typeof COLUNAS)[number] | null {
  if (!rawKey) return null;
  const k = stripAccents(String(rawKey).trim().toLowerCase()).replace(/[\s_\-./()]/g, "");
  return HEADER_ALIASES[k] ?? null;
}

function normalizeRow(rawRow: Record<string, unknown>): { row: LinhaCsv; rawKeys: string[]; mappedKeys: string[] } {
  const obj: LinhaCsv = {};
  COLUNAS.forEach((c) => { obj[c] = ""; });
  const rawKeys: string[] = [];
  const mappedKeys: string[] = [];
  Object.keys(rawRow).forEach((rawK) => {
    rawKeys.push(rawK);
    const canonical = canonicalKey(rawK);
    if (canonical) {
      mappedKeys.push(rawK);
      obj[canonical] = normalizeCellValue(canonical, rawRow[rawK]);
    }
  });
  // Normaliza tipo/status para minúscula (Excel pode salvar "Pagar" / "Previsto")
  if (obj.tipo) obj.tipo = String(obj.tipo).trim().toLowerCase();
  if (obj.status) obj.status = String(obj.status).trim().toLowerCase();
  return { row: obj, rawKeys, mappedKeys };
}

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n); }
function dateToIso(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function normalizeCellValue(coluna: string, v: unknown): string {
  if (v == null || v === "") return "";
  if (COLUNAS_DATA.has(coluna)) {
    if (v instanceof Date && !isNaN(v.getTime())) return dateToIso(v);
    if (typeof v === "number" && Number.isFinite(v)) {
      const ms = Math.round((v - 25569) * 86400 * 1000);
      const d = new Date(ms);
      if (!isNaN(d.getTime())) return dateToIso(d);
    }
    if (typeof v === "string") {
      const s = v.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const m = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
      if (m) return `${m[3]}-${m[2]}-${m[1]}`;
      return s;
    }
    return String(v);
  }
  if (COLUNAS_NUMERO.has(coluna)) {
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    if (typeof v === "string") return v.trim();
    return String(v);
  }
  if (v instanceof Date && !isNaN(v.getTime())) return dateToIso(v);
  return String(v).trim();
}

function parseCsv(text: string): LinhaCsv[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  function parseLine(line: string): string[] {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === sep) { out.push(cur); cur = ""; }
        else cur += ch;
      }
    }
    out.push(cur);
    return out;
  }
  const header = parseLine(lines[0]).map((h) => h.trim().replace(/^\uFEFF/, ""));
  return lines.slice(1).map((l) => {
    const cells = parseLine(l);
    const obj: LinhaCsv = {};
    header.forEach((h, i) => { obj[h] = (cells[i] ?? "").trim(); });
    return obj;
  });
}

function linhaVazia(): LinhaCsv {
  const o: LinhaCsv = {};
  COLUNAS.forEach((c) => { o[c] = ""; });
  o.tipo = "pagar";
  o.status = "previsto";
  return o;
}

interface PlanoConta { id: string; codigo: string; descricao: string; permiteLancamento: boolean; }
interface CentroCusto { id: string; codigo: string; nome: string; ativo: boolean; }
interface ContaBancaria { id: string; banco: string; agencia?: string | null; conta?: string | null; ativo: boolean; }

interface Props { clienteId: string; }

const STATUS_OPTIONS = ["previsto", "aprovado", "pago"];

export function ImportLancamentosDialog({ clienteId }: Props) {
  const [open, setOpen] = useState(false);
  const [linhas, setLinhas] = useState<LinhaCsv[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [resultado, setResultado] = useState<{ criados: number; totalLinhas: number; erros: { linha: number; motivo: string }[] } | null>(null);

  // Toolbar bulk
  const [bulkPlano, setBulkPlano] = useState<string>("");
  const [bulkCentro, setBulkCentro] = useState<string>("");
  const [bulkBanco, setBulkBanco] = useState<string>("");
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [bulkTipo, setBulkTipo] = useState<string>("");

  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: planos = [] } = useQuery<PlanoConta[]>({ queryKey: ["/api/control/planos-contas"], enabled: open });
  const { data: centros = [] } = useQuery<CentroCusto[]>({ queryKey: ["/api/control/clientes", clienteId, "centros-custo"], enabled: open });
  const { data: contas = [] } = useQuery<ContaBancaria[]>({ queryKey: ["/api/control/clientes", clienteId, "contas-bancarias"], enabled: open });

  const planosValidos = useMemo(() => planos.filter((p) => p.permiteLancamento), [planos]);
  const centrosValidos = useMemo(() => centros.filter((c) => c.ativo), [centros]);
  const contasValidas = useMemo(() => contas.filter((c) => c.ativo), [contas]);

  const planosCodigos = useMemo(() => new Set(planosValidos.map((p) => p.codigo)), [planosValidos]);
  const centrosCodigos = useMemo(() => new Set(centrosValidos.map((c) => c.codigo)), [centrosValidos]);
  const bancosNomes = useMemo(() => new Set(contasValidas.map((c) => c.banco.toLowerCase())), [contasValidas]);

  const LIMITE_LINHAS = 2000;
  const acimaDoLimite = linhas.length > LIMITE_LINHAS;

  // Validação por linha — retorna erros (vazio = válida)
  const errosPorLinha = useMemo(() => {
    return linhas.map((l) => {
      const errs: string[] = [];
      if (!l.tipo || (l.tipo !== "pagar" && l.tipo !== "receber")) errs.push("tipo deve ser pagar ou receber");
      if (!l.descricao || l.descricao.trim().length < 2) errs.push("descrição muito curta");
      else if (l.descricao.length > 500) errs.push("descrição máx. 500 caracteres");
      if (l.status && !["previsto", "aprovado", "pago"].includes(l.status)) errs.push(`status '${l.status}' inválido (use previsto/aprovado/pago)`);
      const v = parseValorBR(l.valor);
      if (!Number.isFinite(v) || v <= 0) errs.push("valor inválido (use 1500,00 ou 1500.00)");
      if (!l.dataVencimento || !/^\d{4}-\d{2}-\d{2}$/.test(l.dataVencimento)) errs.push("dataVencimento inválida (use dd/mm/aaaa)");
      if (l.dataEmissao && !/^\d{4}-\d{2}-\d{2}$/.test(l.dataEmissao)) errs.push("dataEmissao inválida (use dd/mm/aaaa)");
      if (l.planoContaCodigo && planosCodigos.size > 0 && !planosCodigos.has(l.planoContaCodigo)) errs.push(`plano '${l.planoContaCodigo}' não cadastrado`);
      if (l.centroCustoCodigo && centrosCodigos.size > 0 && !centrosCodigos.has(l.centroCustoCodigo)) errs.push(`centro '${l.centroCustoCodigo}' não cadastrado`);
      if (l.contaBancariaBanco && bancosNomes.size > 0 && !bancosNomes.has(l.contaBancariaBanco.toLowerCase())) errs.push(`banco '${l.contaBancariaBanco}' não cadastrado`);
      return errs;
    });
  }, [linhas, planosCodigos, centrosCodigos, bancosNomes]);

  const linhasValidas = errosPorLinha.filter((e) => e.length === 0).length;
  const linhasComErro = linhas.length - linhasValidas;

  function handleFile(file: File) {
    setFileName(file.name);
    setResultado(null);
    setLinhas([]);
    const lower = file.name.toLowerCase();
    const isXlsx = lower.endsWith(".xlsx") || lower.endsWith(".xls");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        let parsed: LinhaCsv[] = [];
        let abaLida: string | undefined;
        let temAbaLanc = false;
        let rawRows: Record<string, unknown>[] = [];
        if (isXlsx) {
          const data = new Uint8Array(reader.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array", cellDates: true });
          const abaLanc = wb.SheetNames.find((n) => n.toLowerCase().startsWith("lanc"));
          temAbaLanc = Boolean(abaLanc);
          const sheetName = abaLanc || wb.SheetNames[0];
          if (!sheetName) throw new Error("Arquivo XLSX sem nenhuma aba");
          abaLida = sheetName;
          const ws = wb.Sheets[sheetName];
          rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true });
        } else {
          rawRows = parseCsv(String(reader.result || "")) as unknown as Record<string, unknown>[];
        }

        // Diagnóstico do cabeçalho: detecta colunas reconhecidas vs não reconhecidas
        const headersLidos = Array.from(new Set(rawRows.flatMap((r) => Object.keys(r))));
        const headersReconhecidos = headersLidos.filter((h) => canonicalKey(h) !== null);
        const headersIgnorados = headersLidos.filter((h) => canonicalKey(h) === null);

        const normalizados = rawRows.map((r) => normalizeRow(r));
        parsed = normalizados.map((n) => n.row);
        setLinhas(parsed);

        if (parsed.length === 0) {
          toast({
            title: "Arquivo vazio",
            description: `Nenhuma linha encontrada no ${isXlsx ? "XLSX" : "CSV"}`,
            variant: "destructive",
          });
        } else if (headersReconhecidos.length === 0) {
          toast({
            title: "Cabeçalho não reconhecido",
            description: `Nenhuma coluna conhecida no arquivo. Encontrados: ${headersLidos.slice(0, 6).join(", ")}${headersLidos.length > 6 ? "…" : ""}. Use o template em "Baixar modelo" como referência.`,
            variant: "destructive",
          });
        } else {
          if (isXlsx && !temAbaLanc) {
            toast({ title: "Aba 'Lançamentos' não encontrada", description: `Lendo a primeira aba ("${abaLida}")` });
          }
          if (headersIgnorados.length > 0) {
            toast({
              title: `${parsed.length} linhas lidas`,
              description: `Colunas ignoradas (não reconhecidas): ${headersIgnorados.slice(0, 5).join(", ")}${headersIgnorados.length > 5 ? "…" : ""}`,
            });
          }
        }
      } catch (e: any) {
        setLinhas([]);
        toast({ title: "Erro ao ler arquivo", description: e?.message ?? "Falha no parser", variant: "destructive" });
      }
    };
    if (isXlsx) reader.readAsArrayBuffer(file);
    else reader.readAsText(file, "utf-8");
  }

  const updateCell = useCallback((idx: number, col: string, val: string) => {
    setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, [col]: val } : l)));
  }, []);

  const removerLinha = (idx: number) => setLinhas((prev) => prev.filter((_, i) => i !== idx));
  const adicionarLinha = () => setLinhas((prev) => [...prev, linhaVazia()]);

  const aplicarBulk = (col: string, valor: string, label: string, somenteVazias = true) => {
    if (!valor) return;
    setLinhas((prev) => prev.map((l) => (somenteVazias && l[col] ? l : { ...l, [col]: valor })));
    toast({ title: `${label} aplicado`, description: somenteVazias ? "Apenas linhas vazias foram preenchidas" : "Aplicado em todas" });
  };

  // Snapshot estável: guardamos uma cópia das linhas submetidas para reconciliar
  // erros de volta no grid mesmo se o usuário tiver editado/adicionado/removido
  // linhas durante o request. Reconciliação é feita por conteúdo (não por índice).
  const snapshotRef = useRef<LinhaCsv[] | null>(null);

  const importar = useMutation({
    mutationFn: async () => {
      // Apenas linhas válidas no momento do submit
      const validas = linhas.filter((_, i) => (errosPorLinha[i] ?? []).length === 0);
      snapshotRef.current = validas.map((l) => ({ ...l }));
      const r = await apiRequest("POST", `/api/control/clientes/${clienteId}/lancamentos/import-massa`, { linhas: validas });
      return await r.json();
    },
    onSuccess: (data) => {
      setResultado(data);
      qc.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "lancamentos"] });
      qc.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "overview"] });
      // Reconcilia: remove do grid apenas as linhas do snapshot que foram criadas
      // com sucesso. Linhas adicionadas durante o request, ou ainda inválidas, ficam.
      // Backend retorna `linha = idx + 2` referente ao snapshot enviado.
      const snapshot = snapshotRef.current ?? [];
      const indicesComErroSnapshot = new Set<number>((data.erros || []).map((e: any) => e.linha - 2));
      const conteudoComErroOuNaoEnviado = new Set<string>();
      snapshot.forEach((l, i) => {
        if (indicesComErroSnapshot.has(i)) conteudoComErroOuNaoEnviado.add(JSON.stringify(l));
      });
      setLinhas((prev) => prev.filter((l, i) => {
        // Mantém se: ainda é inválida (não foi enviada), OU está no set de erros do snapshot, OU foi adicionada após o snapshot.
        const errsAgora = (errosPorLinha[i] ?? []).length > 0;
        if (errsAgora) return true;
        const key = JSON.stringify(l);
        if (conteudoComErroOuNaoEnviado.has(key)) return true;
        // Linha que estava no snapshot e não veio com erro = criada com sucesso, remove.
        // Linha nova (não está no snapshot) = mantém.
        const estavaNoSnapshot = snapshot.some((s) => JSON.stringify(s) === key);
        return !estavaNoSnapshot;
      }));
      snapshotRef.current = null;
      if (data.erros && data.erros.length > 0) {
        toast({ title: `${data.criados} criados`, description: `${data.erros.length} linhas com erro permanecem para correção`, variant: "destructive" });
      } else {
        toast({ title: "Importação completa", description: `${data.criados} lançamentos criados` });
      }
    },
    onError: (e: any) => {
      const issues = e?.body?.erros;
      if (issues) setResultado({ criados: 0, totalLinhas: linhas.length, erros: issues });
      snapshotRef.current = null;
      toast({ title: "Erro ao importar", description: e?.message ?? "Falha", variant: "destructive" });
    },
  });

  function reset() {
    setLinhas([]);
    setFileName("");
    setResultado(null);
    setBulkPlano(""); setBulkCentro(""); setBulkBanco(""); setBulkStatus(""); setBulkTipo("");
  }

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <Button variant="outline" onClick={() => setOpen(true)} data-testid="button-abrir-import-massa">
        <Upload className="h-4 w-4 mr-1" />Importar em massa
      </Button>
      <DialogContent className="max-w-[95vw] max-h-[92vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar lançamentos — planilha editável
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Passo 1 — Template */}
          <Card>
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <div className="text-sm">
                <strong>1. Baixe o modelo</strong>
                <span className="text-muted-foreground ml-2">edite no Excel/Sheets ou cole/edite direto na planilha abaixo.</span>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm"
                  onClick={() => downloadFile(`template-lancamentos-${hoje}.csv`, gerarCsvTemplate())}
                  data-testid="button-baixar-template-csv">
                  <Download className="h-3 w-3 mr-1" />CSV
                </Button>
                <Button type="button" variant="outline" size="sm"
                  onClick={() => downloadXlsxTemplate(`template-lancamentos-${hoje}.xlsx`)}
                  data-testid="button-baixar-template-xlsx">
                  <Download className="h-3 w-3 mr-1" />XLSX
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Passo 2 — Upload */}
          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-3">
                <strong className="text-sm shrink-0">2. Carregar arquivo:</strong>
                <Input
                  type="file"
                  accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                  data-testid="input-arquivo-import"
                  className="max-w-sm"
                />
                <Button variant="ghost" size="sm" onClick={adicionarLinha} data-testid="button-adicionar-linha">
                  <Plus className="h-3 w-3 mr-1" />Adicionar linha em branco
                </Button>
              </div>
              {fileName && <p className="text-xs text-muted-foreground">{fileName} — {linhas.length} linha{linhas.length !== 1 ? "s" : ""}</p>}
            </CardContent>
          </Card>

          {/* Toolbar suspensa de aplicação em lote */}
          {linhas.length > 0 && (
            <Card className="border-primary/30 sticky top-0 z-20 bg-background shadow-sm" data-testid="toolbar-bulk">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Wand2 className="h-4 w-4 text-primary" />
                  Aplicar em lote (apenas linhas com o campo vazio)
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                  <BulkApplier label="Plano" value={bulkPlano} onChange={setBulkPlano}
                    options={planosValidos.map((p) => ({ value: p.codigo, label: `${p.codigo} — ${p.descricao}` }))}
                    onApply={() => aplicarBulk("planoContaCodigo", bulkPlano, "Plano de contas")}
                    testid="bulk-plano" />
                  <BulkApplier label="Centro" value={bulkCentro} onChange={setBulkCentro}
                    options={centrosValidos.map((c) => ({ value: c.codigo, label: `${c.codigo} — ${c.nome}` }))}
                    onApply={() => aplicarBulk("centroCustoCodigo", bulkCentro, "Centro de custo")}
                    testid="bulk-centro" />
                  <BulkApplier label="Banco" value={bulkBanco} onChange={setBulkBanco}
                    options={contasValidas.map((c) => ({ value: c.banco, label: `${c.banco}${c.agencia ? ` • Ag ${c.agencia}` : ""}` }))}
                    onApply={() => aplicarBulk("contaBancariaBanco", bulkBanco, "Banco")}
                    testid="bulk-banco" />
                  <BulkApplier label="Status" value={bulkStatus} onChange={setBulkStatus}
                    options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
                    onApply={() => aplicarBulk("status", bulkStatus, "Status")}
                    testid="bulk-status" />
                  <BulkApplier label="Tipo" value={bulkTipo} onChange={setBulkTipo}
                    options={[{ value: "pagar", label: "Pagar" }, { value: "receber", label: "Receber" }]}
                    onApply={() => aplicarBulk("tipo", bulkTipo, "Tipo", false)}
                    testid="bulk-tipo" />
                </div>
                <div className="flex items-center justify-between pt-1 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3 inline mr-1" />
                      <strong data-testid="text-validas">{linhasValidas}</strong> válidas
                    </span>
                    {linhasComErro > 0 && (
                      <span className="text-destructive">
                        <AlertCircle className="h-3 w-3 inline mr-1" />
                        <strong data-testid="text-com-erro">{linhasComErro}</strong> com erro
                      </span>
                    )}
                    {acimaDoLimite && (
                      <span className="text-destructive font-medium" data-testid="alert-limite-linhas">
                        ⚠ Acima do limite de {LIMITE_LINHAS} linhas
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Grid editável */}
          {linhas.length > 0 && (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead className="w-8"></TableHead>
                      <TableHead className="w-24">Tipo*</TableHead>
                      <TableHead className="w-28">Status</TableHead>
                      <TableHead className="min-w-[200px]">Descrição*</TableHead>
                      <TableHead className="min-w-[150px]">Favorecido</TableHead>
                      <TableHead className="w-28">Documento</TableHead>
                      <TableHead className="w-28">Valor*</TableHead>
                      <TableHead className="w-36">Vencimento*</TableHead>
                      <TableHead className="w-36">Emissão</TableHead>
                      <TableHead className="w-44">Plano</TableHead>
                      <TableHead className="w-40">Centro</TableHead>
                      <TableHead className="w-40">Banco</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.map((l, i) => {
                      const errs = errosPorLinha[i] ?? [];
                      const valida = errs.length === 0;
                      return (
                        <TableRow key={i} className={!valida ? "bg-destructive/5" : ""} data-testid={`row-edit-${i}`}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell>
                            {valida ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <span title={errs.join("; ")} data-testid={`cell-erros-${i}`}>
                                <AlertCircle className="h-4 w-4 text-destructive" />
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Select value={l.tipo || "pagar"} onValueChange={(v) => updateCell(i, "tipo", v)}>
                              <SelectTrigger className="h-7 text-xs" data-testid={`cell-tipo-${i}`}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pagar">Pagar</SelectItem>
                                <SelectItem value="receber">Receber</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select value={l.status || "previsto"} onValueChange={(v) => updateCell(i, "status", v)}>
                              <SelectTrigger className="h-7 text-xs" data-testid={`cell-status-${i}`}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input className="h-7 text-xs" value={l.descricao || ""}
                              onChange={(e) => updateCell(i, "descricao", e.target.value)}
                              data-testid={`cell-descricao-${i}`} />
                          </TableCell>
                          <TableCell>
                            <Input className="h-7 text-xs" value={l.favorecido || ""}
                              onChange={(e) => updateCell(i, "favorecido", e.target.value)}
                              data-testid={`cell-favorecido-${i}`} />
                          </TableCell>
                          <TableCell>
                            <Input className="h-7 text-xs" value={l.documento || ""}
                              onChange={(e) => updateCell(i, "documento", e.target.value)} />
                          </TableCell>
                          <TableCell>
                            <Input className="h-7 text-xs text-right font-mono" value={l.valor || ""}
                              onChange={(e) => updateCell(i, "valor", e.target.value)}
                              data-testid={`cell-valor-${i}`} />
                            {l.valor ? (
                              Number.isFinite(parseValorBR(l.valor)) && parseValorBR(l.valor) > 0 ? (
                                <div className="text-[10px] text-right text-muted-foreground font-mono mt-0.5" data-testid={`preview-valor-${i}`}>
                                  = {formatValorBR(l.valor)}
                                </div>
                              ) : (
                                <div className="text-[10px] text-right text-destructive font-mono mt-0.5">inválido</div>
                              )
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <DateInputBR className="h-7 text-xs" value={l.dataVencimento || ""}
                              onChange={(v) => updateCell(i, "dataVencimento", v)}
                              data-testid={`cell-vencimento-${i}`} />
                          </TableCell>
                          <TableCell>
                            <DateInputBR className="h-7 text-xs" value={l.dataEmissao || ""}
                              onChange={(v) => updateCell(i, "dataEmissao", v)} />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={l.planoContaCodigo || "__empty__"}
                              onValueChange={(v) => updateCell(i, "planoContaCodigo", v === "__empty__" ? "" : v)}
                            >
                              <SelectTrigger className="h-7 text-xs" data-testid={`cell-plano-${i}`}><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__empty__">—</SelectItem>
                                {planosValidos.map((p) => (
                                  <SelectItem key={p.id} value={p.codigo}>{p.codigo} — {p.descricao}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={l.centroCustoCodigo || "__empty__"}
                              onValueChange={(v) => updateCell(i, "centroCustoCodigo", v === "__empty__" ? "" : v)}
                            >
                              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__empty__">—</SelectItem>
                                {centrosValidos.map((c) => (
                                  <SelectItem key={c.id} value={c.codigo}>{c.codigo} — {c.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={l.contaBancariaBanco || "__empty__"}
                              onValueChange={(v) => updateCell(i, "contaBancariaBanco", v === "__empty__" ? "" : v)}
                            >
                              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__empty__">—</SelectItem>
                                {contasValidas.map((c) => (
                                  <SelectItem key={c.id} value={c.banco}>{c.banco}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => removerLinha(i)}
                              data-testid={`button-remover-linha-${i}`}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Resultado */}
          {resultado && (
            <Card>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  {resultado.erros.length === 0 ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  )}
                  <h3 className="font-medium" data-testid="text-resultado-import">
                    {resultado.criados} criado{resultado.criados !== 1 ? "s" : ""} de {resultado.totalLinhas} • {resultado.erros.length} erro{resultado.erros.length !== 1 ? "s" : ""}
                  </h3>
                </div>
                {resultado.erros.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    As linhas com erro permanecem na planilha — corrija e clique em "Importar" novamente.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {linhas.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-md">
              Carregue um arquivo CSV/XLSX acima ou clique em "Adicionar linha em branco" para começar.
            </div>
          )}
        </div>

        <DialogFooter className="sticky bottom-0 bg-background pt-2 border-t">
          <div className="flex-1 text-xs text-muted-foreground">
            {linhas.length > 0 && `Pronto para importar ${linhasValidas} de ${linhas.length} linhas`}
          </div>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-fechar-import">
            {resultado ? "Fechar" : "Cancelar"}
          </Button>
          <Button
            type="button"
            disabled={importar.isPending || linhas.length === 0 || linhasValidas === 0 || acimaDoLimite}
            onClick={() => importar.mutate()}
            data-testid="button-confirmar-import"
          >
            {importar.isPending ? "Importando..." : `Importar ${linhasValidas} válidas`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface BulkApplierProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  onApply: () => void;
  testid: string;
}

function BulkApplier({ label, value, onChange, options, onApply, testid }: BulkApplierProps) {
  return (
    <div className="flex items-center gap-1">
      <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
        <SelectTrigger className="h-7 text-xs" data-testid={`select-${testid}`}>
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">{label}…</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" size="sm" variant="outline" className="h-7 px-2" disabled={!value}
        onClick={onApply} data-testid={`button-apply-${testid}`}>
        Aplicar
      </Button>
    </div>
  );
}
