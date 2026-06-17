// Sprint C-E11 — Importar Planilha (passo 0 opcional)
// Sprint C-E07 — Seed 100 CCs série 1100
// Sprint C-E11 — G15 Wizard de Setup Guiado
// 6 passos com progresso persistido em localStorage por clienteId.

import { useEffect, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, ArrowRight, SkipForward, CheckCircle2, PartyPopper,
  Download, Upload, Layers, Loader2, Sparkles, Building, PlusCircle,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PlanilhaImportPreview } from "@/components/control/PlanilhaImportPreview";
import { PlanilhaImportPreviewCompleto } from "@/components/control/PlanilhaImportPreviewCompleto";

const STEPS = [
  "Importar Planilha",
  "Contas Bancárias",
  "Saldo Inicial",
  "Plano de Contas",
  "Centros de Custo",
  "Primeiro Lançamento",
];

export default function SetupWizard() {
  const [location, navigate] = useLocation();
  const clienteId = location.split('/').filter(Boolean)[1] ?? '';
  const { toast } = useToast();
  const key = `setup_wizard_:${clienteId}`;
  const [step, setStep] = useState(0);
  const [contaCriada, setContaCriada] = useState<{ id: string; banco: string } | null>(null);
  const [saldo, setSaldo] = useState("0");
  const [contaForm, setContaForm] = useState({ banco: "", agencia: "", conta: "", apelido: "", saldoInicial: "0" });

  // Step 1: lista de contas já existentes
  const { data: contasExistentes = [], refetch: refetchContas } = useQuery<any[]>({
    queryKey: ["/api/control/clientes", clienteId, "contas-bancarias"],
    enabled: !!clienteId && step === 1,
  });

  // C-E11 / CTL-IMPORT-01: Import planilha
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [modoCompleto, setModoCompleto] = useState(true); // CTL-IMPORT-01: importa lançamentos por padrão

  // C-E07: seed CC (legado)
  const [seedResult, setSeedResult] = useState<{ criados: number; existentes: number } | null>(null);

  // CTL-04: seed Impacto
  const [seedPCLoading, setSeedPCLoading] = useState(false);
  const [seedPCDone, setSeedPCDone] = useState(false);
  const [seedCCLoading, setSeedCCLoading] = useState(false);
  const [seedCCDone, setSeedCCDone] = useState(false);
  const [seedOrcLoading, setSeedOrcLoading] = useState(false);
  const [seedOrcDone, setSeedOrcDone] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const s = JSON.parse(raw);
        if (typeof s.step === "number") setStep(s.step);
      }
    } catch { /* ignore */ }
  }, [key]);

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify({ step })); } catch { /* ignore */ }
  }, [step, key]);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const skip = () => next();
  const finalizar = () => {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    toast({ title: "Setup concluído!", description: "Cliente pronto para operar." });
    navigate(`/control/${clienteId}`);
  };

  // C-E11: preview planilha
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setPreview(null);
    setPreviewLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // CTL-IMPORT-01: usa preview-completo (inclui lançamentos AR/AP + saldos)
      const endpoint = modoCompleto
        ? `/api/control/clientes/${clienteId}/import-planilha/preview-completo`
        : `/api/control/clientes/${clienteId}/import-planilha/preview`;
      const res = await fetch(endpoint, { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      setPreview(await res.json());
    } catch (err: any) {
      toast({ title: "Erro ao processar planilha", description: err.message, variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  };

  const confirmarImport = async () => {
    if (!preview) return;
    setConfirmando(true);
    try {
      // CTL-IMPORT-01: usa confirm-completo quando modoCompleto
      const endpoint = modoCompleto
        ? `/api/control/clientes/${clienteId}/import-planilha/confirm-completo`
        : `/api/control/clientes/${clienteId}/import-planilha/confirm`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ preview }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const erroCount = data.erros?.length ?? 0;
      const imp = data.importados ?? {};
      const detalhes = [
        imp.receber ? `${imp.receber} a receber` : "",
        imp.pagar   ? `${imp.pagar} a pagar` : "",
        imp.saldos  ? `${imp.saldos} saldos` : "",
      ].filter(Boolean).join(", ");
      toast({
        title: erroCount === 0
          ? "Planilha importada com sucesso!"
          : `Importação concluída (${erroCount} linha${erroCount > 1 ? "s" : ""} com erro)`,
        description: detalhes || data.message || `${data.total ?? 0} registros inseridos.`,
        variant: erroCount > 0 && (data.total ?? 0) === 0 ? "destructive" : "default",
      });
      if ((data.total ?? 0) > 0) next();
    } catch (err: any) {
      toast({ title: "Erro ao confirmar importação", description: err.message, variant: "destructive" });
    } finally {
      setConfirmando(false);
    }
  };

  const criarConta = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/control/clientes/${clienteId}/contas-bancarias`, {
        banco: contaForm.banco || "Conta Principal",
        agencia: contaForm.agencia || null,
        conta: contaForm.conta || null,
        apelido: contaForm.apelido || null,
        tipo: "cc",
        saldoInicial: contaForm.saldoInicial || "0",
        ativo: true,
      });
    },
    onSuccess: async (r: any) => {
      const data = await r.json?.();
      const id = data?.id ?? data?.conta?.id;
      setContaCriada({ id, banco: contaForm.apelido || contaForm.banco });
      toast({ title: `✅ Conta "${contaForm.apelido || contaForm.banco}" criada` });
      setContaForm({ banco: "", agencia: "", conta: "", apelido: "", saldoInicial: "0" });
      refetchContas();
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  const definirSaldo = useMutation({
    mutationFn: async () => {
      if (!contaCriada) return null;
      return apiRequest("POST", `/api/control/contas-bancarias/${contaCriada.id}/saldo-inicial`, {
        valor: saldo, data: new Date().toISOString().slice(0, 10),
      });
    },
    onSuccess: () => { toast({ title: "Saldo registrado" }); next(); },
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  // C-E07: seed CCs engineering
  const seedEngineering = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/control/clientes/${clienteId}/centros-custo/seed-engineering`, {});
      return await r.json();
    },
    onSuccess: (data: any) => {
      setSeedResult({ criados: data.criados, existentes: data.existentes });
      toast({ title: `✅ ${data.criados} CCs criados`, description: `${data.existentes} já existiam.` });
      queryClient.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "centros-custo"] });
    },
    onError: (e: any) => toast({ title: "Erro no seed", description: e?.message, variant: "destructive" }),
  });

  const baixarTemplate = (tipo: string) => {
    window.location.href = `/api/control/templates/${tipo}`;
  };

  const progresso = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="container mx-auto p-6 max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/control/${clienteId}`}>
          <Button variant="ghost" size="sm" data-testid="button-back"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
        </Link>
        <h1 className="text-2xl font-bold flex-1" data-testid="text-page-title">Setup do Cliente</h1>
      </div>

      <div>
        <div className="flex justify-between mb-2 text-sm">
          <span>Passo {step + 1} de {STEPS.length}: <strong>{STEPS[step]}</strong></span>
          <span className="text-muted-foreground" data-testid="text-progresso">{Math.round(progresso)}%</span>
        </div>
        <Progress value={progresso} data-testid="progress-wizard" />
        <div className="flex gap-1 mt-2 overflow-x-auto">
          {STEPS.map((s, i) => (
            <div
              key={s}
              onClick={() => i <= step ? setStep(i) : undefined}
              className={`flex-shrink-0 text-xs text-center p-1 rounded transition-colors
                ${i < step ? "text-green-600 cursor-pointer hover:bg-green-50 dark:hover:bg-green-950/30" :
                  i === step ? "font-semibold" :
                  "text-muted-foreground"}`}
            >
              {i < step ? <CheckCircle2 className="h-3 w-3 inline mr-1" /> : null}{s}
            </div>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>{STEPS[step]}</CardTitle></CardHeader>
        <CardContent className="space-y-4 overflow-y-auto max-h-[calc(100vh-220px)]">

          {/* PASSO 0 — C-E11: Import Planilha */}
          {step === 0 && (
            <>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-muted-foreground flex-1">
                  Importe a planilha Excel da Impacto para carregar automaticamente todos os
                  <strong> lançamentos a receber e a pagar</strong>, saldos iniciais, clientes,
                  fornecedores e plano de contas.
                </p>
                <button
                  onClick={() => { setModoCompleto(v => !v); setPreview(null); setUploadFile(null); }}
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline flex-shrink-0"
                >
                  {modoCompleto ? "Modo simples (só cadastros)" : "Modo completo (com lançamentos) ✓"}
                </button>
              </div>

              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  uploadFile ? "border-primary bg-primary/5" : "hover:border-primary"
                }`}
                onClick={() => fileRef.current?.click()}
                data-testid="dropzone-planilha"
              >
                {previewLoading ? (
                  <Loader2 className="h-8 w-8 mx-auto mb-2 text-primary animate-spin" />
                ) : uploadFile ? (
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                ) : (
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                )}
                <p className="text-sm font-medium">
                  {previewLoading
                    ? "Processando planilha…"
                    : uploadFile
                    ? uploadFile.name
                    : "Clique para selecionar arquivo"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">.xlsx ou .xlsm — máximo 20MB</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xlsm,.xls"
                  className="hidden"
                  onChange={handleFileChange}
                  data-testid="input-planilha-file"
                />
              </div>

              {/* Preview após carregar */}
              {preview && modoCompleto && "lancamentosReceber" in preview && (
                <PlanilhaImportPreviewCompleto preview={preview} />
              )}
              {preview && !modoCompleto && <PlanilhaImportPreview preview={preview} />}

              {/* Arquivo selecionado mas preview falhou */}
              {uploadFile && !previewLoading && !preview && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-yellow-50 border border-yellow-200 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-700 dark:text-yellow-300">
                  <span className="flex-1">Não foi possível gerar o preview. Verifique o arquivo ou clique em "Tentar novamente".</span>
                  <button
                    className="underline font-medium whitespace-nowrap"
                    onClick={() => { setPreview(null); fileRef.current?.click(); }}
                  >
                    Tentar novamente
                  </button>
                </div>
              )}

              {/* Botões de ação */}
              <div className="flex flex-wrap gap-2 pt-2">
                {preview && (
                  <Button
                    onClick={confirmarImport}
                    disabled={confirmando}
                    data-testid="button-confirmar-import"
                  >
                    {confirmando
                      ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Importando…</>
                      : <><ArrowRight className="h-4 w-4 mr-1" /> Importar e Avançar</>}
                  </Button>
                )}
                {uploadFile && !previewLoading && !preview && (
                  <Button onClick={skip} data-testid="button-avancar-sem-import">
                    <ArrowRight className="h-4 w-4 mr-1" /> Avançar sem importar
                  </Button>
                )}
                <Button variant="outline" onClick={skip} data-testid="button-skip-0">
                  <SkipForward className="h-4 w-4 mr-1" /> {uploadFile ? "Pular importação" : "Pular (configurar manualmente)"}
                </Button>
              </div>
            </>
          )}

          {/* PASSO 1 — Contas Bancárias */}
          {step === 1 && (
            <>
              <p className="text-sm text-muted-foreground">
                Cadastre as contas bancárias da empresa. Cada conta recebe um saldo inicial separado.
              </p>

              {/* Lista de contas já criadas */}
              {contasExistentes.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {contasExistentes.length} conta{contasExistentes.length > 1 ? "s" : ""} cadastrada{contasExistentes.length > 1 ? "s" : ""}
                  </p>
                  {contasExistentes.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between text-sm" data-testid={`row-conta-${c.id}`}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{c.tipo?.toUpperCase() ?? "CC"}</Badge>
                        <span className="font-medium">{c.apelido || c.banco}</span>
                        {c.agencia && <span className="text-muted-foreground text-xs">Ag {c.agencia} / Cc {c.conta}</span>}
                      </div>
                      <span className="font-mono text-xs text-green-700 dark:text-green-400">
                        R$ {Number(c.saldo_inicial ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Formulário para nova conta */}
              <div className="rounded-lg border p-3 space-y-3">
                <p className="text-xs font-medium">+ Nova conta bancária</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Banco *</Label>
                    <Input value={contaForm.banco} onChange={(e) => setContaForm((f) => ({ ...f, banco: e.target.value }))} placeholder="Ex.: Itaú, BB, Caixa…" data-testid="input-banco" />
                  </div>
                  <div>
                    <Label>Apelido</Label>
                    <Input value={contaForm.apelido} onChange={(e) => setContaForm((f) => ({ ...f, apelido: e.target.value }))} placeholder="Ex.: Itaú Principal" data-testid="input-apelido" />
                  </div>
                  <div>
                    <Label>Agência</Label>
                    <Input value={contaForm.agencia} onChange={(e) => setContaForm((f) => ({ ...f, agencia: e.target.value }))} data-testid="input-agencia" />
                  </div>
                  <div>
                    <Label>Nº da Conta</Label>
                    <Input value={contaForm.conta} onChange={(e) => setContaForm((f) => ({ ...f, conta: e.target.value }))} data-testid="input-conta" />
                  </div>
                  <div className="col-span-2">
                    <Label>Saldo Inicial (R$)</Label>
                    <Input
                      type="number" step="0.01"
                      value={contaForm.saldoInicial}
                      onChange={(e) => setContaForm((f) => ({ ...f, saldoInicial: e.target.value }))}
                      placeholder="0,00"
                      data-testid="input-saldo-inicial"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => criarConta.mutate()}
                  disabled={!contaForm.banco || criarConta.isPending}
                  data-testid="button-adicionar-conta"
                >
                  {criarConta.isPending
                    ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Salvando…</>
                    : <><PlusCircle className="h-4 w-4 mr-1" /> Adicionar conta</>}
                </Button>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  onClick={next}
                  disabled={contasExistentes.length === 0}
                  data-testid="button-avancar-contas"
                >
                  <ArrowRight className="h-4 w-4 mr-1" />
                  {contasExistentes.length > 0
                    ? `Avançar (${contasExistentes.length} conta${contasExistentes.length > 1 ? "s" : ""})`
                    : "Avançar"}
                </Button>
                <Button variant="outline" onClick={skip} data-testid="button-skip-1">
                  <SkipForward className="h-4 w-4 mr-1" /> Pular
                </Button>
              </div>
            </>
          )}

          {/* PASSO 2 — Saldo Inicial */}
          {step === 2 && (
            <>
              <p className="text-sm text-muted-foreground">Informe o saldo inicial da conta {contaCriada?.banco ?? "criada"}.</p>
              <div><Label>Saldo Inicial (R$)</Label><Input type="number" step="0.01" value={saldo} onChange={(e) => setSaldo(e.target.value)} data-testid="input-saldo" /></div>
              <div className="flex gap-2">
                <Button onClick={() => contaCriada ? definirSaldo.mutate() : next()} disabled={definirSaldo.isPending} data-testid="button-salvar-saldo"><ArrowRight className="h-4 w-4 mr-1" /> Salvar e Avançar</Button>
                <Button variant="outline" onClick={skip} data-testid="button-skip-2"><SkipForward className="h-4 w-4 mr-1" /> Pular</Button>
              </div>
            </>
          )}

          {/* PASSO 3 — Plano de Contas (CTL-04) */}
          {step === 3 && (
            <>
              <p className="text-sm text-muted-foreground">
                Configure o plano de contas. Use o seed da Impacto para carregar automaticamente
                ou faça upload de um template CSV personalizado.
              </p>

              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
                <p className="text-sm font-medium">🚀 Configuração automática — Impacto Geologia</p>
                <p className="text-xs text-muted-foreground">
                  Carrega 6 grupos de receita (1.1–1.6) e 12 grupos de despesa (2.1–2.12)
                  com todos os itens operacionais da Impacto. Rápido e pronto para operar.
                </p>
                <Button
                  onClick={async () => {
                    setSeedPCLoading(true);
                    try {
                      const r = await apiRequest("POST",
                        `/api/control/clientes/${clienteId}/plano-contas/seed-engineering`);
                      const data = await r.json();
                      toast({ title: "Plano de contas carregado!", description: data.mensagem });
                      setSeedPCDone(true);
                      queryClient.invalidateQueries({ queryKey: ["/api/control/planos-contas"] });
                    } catch (e: any) {
                      toast({ title: "Erro", description: e.message, variant: "destructive" });
                    } finally {
                      setSeedPCLoading(false);
                    }
                  }}
                  disabled={seedPCLoading || seedPCDone}
                  data-testid="button-seed-plano-contas"
                >
                  {seedPCLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> :
                   seedPCDone ? <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" /> :
                   <Sparkles className="h-4 w-4 mr-2" />}
                  {seedPCDone ? "Plano carregado ✓" : "Carregar Plano de Contas Impacto"}
                </Button>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={() => baixarTemplate("plano_contas")} data-testid="button-template-plano">
                  <Download className="h-4 w-4 mr-1" /> Template CSV
                </Button>
                <Link href={`/control/${clienteId}?tab=plano-contas`}>
                  <Button variant="outline" data-testid="button-abrir-plano">Abrir Plano de Contas</Button>
                </Link>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={next} data-testid="button-next-3"><ArrowRight className="h-4 w-4 mr-1" /> Continuar</Button>
                <Button variant="outline" onClick={skip} data-testid="button-skip-3"><SkipForward className="h-4 w-4 mr-1" /> Pular</Button>
              </div>
            </>
          )}

          {/* PASSO 4 — Centros de Custo (CTL-04: seed série 1100 Impacto) */}
          {step === 4 && (
            <>
              <p className="text-sm text-muted-foreground">
                Configure os centros de custo. Use o seed para carregar os 100 CCs
                série 1100 da Impacto automaticamente.
              </p>

              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
                <p className="text-sm font-medium">🏗️ Série 1100 — Impacto Geologia</p>
                <p className="text-xs text-muted-foreground">
                  100 CCs organizados em 10 blocos (1100–1199): Holding, Admin, Financeiro,
                  RH, TI, Marketing, Facilities, Projetos, Laboratório e Frotas.
                  CCs compartilhados já marcados para rateio Impacto/SAF.
                </p>
                <Button
                  onClick={async () => {
                    setSeedCCLoading(true);
                    try {
                      const r = await apiRequest("POST",
                        `/api/control/clientes/${clienteId}/centros-custo/seed-engineering`);
                      const data = await r.json();
                      toast({ title: "CCs carregados!", description: data.mensagem });
                      setSeedCCDone(true);
                      queryClient.invalidateQueries({ queryKey: ["/api/control/clientes", clienteId, "centros-custo"] });
                    } catch (e: any) {
                      toast({ title: "Erro", description: e.message, variant: "destructive" });
                    } finally {
                      setSeedCCLoading(false);
                    }
                  }}
                  disabled={seedCCLoading || seedCCDone}
                  data-testid="button-seed-ccs"
                >
                  {seedCCLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> :
                   seedCCDone ? <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" /> :
                   <Building className="h-4 w-4 mr-2" />}
                  {seedCCDone ? "100 CCs carregados ✓" : "Carregar Série 1100 (100 CCs)"}
                </Button>

                {/* Legado C-E07 — mantido para compatibilidade */}
                {seedResult && (
                  <div className="flex items-center gap-2 text-sm mt-1">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-green-700">{seedResult.criados} CCs criados</span>
                    {seedResult.existentes > 0 && (
                      <Badge variant="outline" className="text-xs">{seedResult.existentes} já existiam</Badge>
                    )}
                  </div>
                )}
              </div>

              {/* CTL-03-C — Seed orçamento 2026 */}
              <div className="rounded-lg border border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-2">
                <p className="text-sm font-medium">📊 Orçamento 2026 — Impacto Geologia</p>
                <p className="text-xs text-muted-foreground">
                  Carrega 13 grupos de despesa (2.1, 2.3, 2.5, 2.6, 2.11) com valores mensais
                  pré-definidos. Necessário para o dashboard mostrar previsto × realizado.
                </p>
                <Button
                  onClick={async () => {
                    setSeedOrcLoading(true);
                    try {
                      const r = await apiRequest("POST",
                        `/api/control/clientes/${clienteId}/orcamento/seed-2026`);
                      const data = await r.json();
                      toast({ title: "Orçamento 2026 carregado!", description: data.mensagem });
                      setSeedOrcDone(true);
                    } catch (e: any) {
                      toast({ title: "Erro", description: e.message, variant: "destructive" });
                    } finally {
                      setSeedOrcLoading(false);
                    }
                  }}
                  disabled={seedOrcLoading || seedOrcDone}
                  data-testid="button-seed-orcamento-2026"
                >
                  {seedOrcLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> :
                   seedOrcDone ? <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" /> :
                   <Sparkles className="h-4 w-4 mr-2" />}
                  {seedOrcDone ? "Orçamento carregado ✓" : "Carregar Orçamento 2026"}
                </Button>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={() => baixarTemplate("centros_custo")} data-testid="button-template-cc">
                  <Download className="h-4 w-4 mr-1" /> Template CSV
                </Button>
                <Link href={`/control/${clienteId}/centros-custo`}>
                  <Button variant="outline" data-testid="button-abrir-cc">Abrir Centros de Custo</Button>
                </Link>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={next} data-testid="button-next-4"><ArrowRight className="h-4 w-4 mr-1" /> Continuar</Button>
                <Button variant="outline" onClick={skip} data-testid="button-skip-4"><SkipForward className="h-4 w-4 mr-1" /> Pular</Button>
              </div>
            </>
          )}

          {/* PASSO 5 — Concluído */}
          {step === 5 && (
            <>
              <div className="flex items-center gap-2 text-green-600">
                <PartyPopper className="h-6 w-6" />
                <span className="text-lg font-semibold">Setup quase concluído!</span>
              </div>
              <p className="text-sm">Você pode lançar a primeira movimentação agora ou ir direto para o Dashboard.</p>
              <div className="flex flex-wrap gap-2">
                <Link href={`/control/${clienteId}?tab=lancamentos`}><Button variant="outline" data-testid="button-primeiro-lanc">Lançar movimentação</Button></Link>
                <Button onClick={finalizar} data-testid="button-finalizar"><CheckCircle2 className="h-4 w-4 mr-1" /> Finalizar e ir ao Dashboard</Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground ml-auto"
                  onClick={() => setStep(0)}
                  data-testid="button-reiniciar-setup"
                >
                  ↺ Reiniciar Setup (importar planilha novamente)
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
