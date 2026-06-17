import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Plus,
  Search,
  Upload,
  Users,
  Truck,
  Briefcase,
  Wallet,
  HardHat,
  Loader2,
  Eye,
  CheckCircle2,
  AlertCircle,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Pessoa, PessoaPapel } from "@shared/schema";

type PessoaListItem = Pessoa & { papeis?: { tipoPapel: string; status: string }[] };

type Counts = {
  total: number;
  cliente: number;
  fornecedor: number;
  colaborador: number;
  transportadora: number;
  credor: number;
};

const PAPEIS = [
  { value: "todos", label: "Todos os papéis" },
  { value: "cliente", label: "Clientes" },
  { value: "fornecedor", label: "Fornecedores" },
  { value: "colaborador", label: "Colaboradores" },
  { value: "transportadora", label: "Transportadoras" },
  { value: "credor", label: "Credores" },
];

const PAPEL_COLOR: Record<string, string> = {
  cliente: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  fornecedor: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  colaborador: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  transportadora: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  credor: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-100",
};

export default function Pessoas() {
  const [search, setSearch] = useState("");
  const [papel, setPapel] = useState("todos");
  const [novoOpen, setNovoOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const { toast } = useToast();

  // Migração one-shot do cadastro legado de Clientes para Pessoas (idempotente).
  type MigrationResult = {
    total: number;
    created: number;
    skipped: number;
    enderecosCreated: number;
    contatosCreated: number;
    errors: Array<{ legacyClientId: string; name: string; error: string }>;
  };
  const migrarLegado = useMutation<MigrationResult>({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/pessoas/migrate-legacy-clientes");
      return (await r.json()) as MigrationResult;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pessoas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pessoas/counts"] });
      const { total, created, skipped, errors } = res;
      const partes = [
        `${created} novas`,
        `${skipped} já existiam`,
        ...(errors.length ? [`${errors.length} erros`] : []),
      ];
      toast({
        title: total === 0 ? "Nenhum cliente legado encontrado" : "Migração concluída",
        description:
          total === 0
            ? "O cadastro antigo de Clientes deste tenant está vazio."
            : `${total} cliente(s) processado(s): ${partes.join(", ")}.`,
        variant: errors.length ? "destructive" : "default",
      });
    },
    onError: (err: any) => {
      const status = err?.message?.match(/^(\d{3}):/)?.[1];
      toast({
        title: "Erro ao migrar",
        description:
          status === "403"
            ? "Apenas administradores do tenant podem rodar a migração."
            : err?.message || "Falha desconhecida.",
        variant: "destructive",
      });
    },
  });
  const onMigrarLegado = () => migrarLegado.mutate();

  const { data: counts } = useQuery<Counts>({
    queryKey: ["/api/pessoas/counts"],
  });

  const queryUrl = `/api/pessoas?search=${encodeURIComponent(search)}${
    papel !== "todos" ? `&papel=${papel}` : ""
  }`;
  const { data: pessoas = [], isLoading } = useQuery<PessoaListItem[]>({
    queryKey: ["/api/pessoas", search, papel],
    queryFn: async () => {
      const r = await fetch(queryUrl, { credentials: "include" });
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    },
  });

  const cards = [
    { key: "todos", label: "Total", icon: Users, count: counts?.total ?? 0, color: "text-foreground" },
    { key: "cliente", label: "Clientes", icon: Users, count: counts?.cliente ?? 0, color: "text-blue-600" },
    { key: "fornecedor", label: "Fornecedores", icon: Briefcase, count: counts?.fornecedor ?? 0, color: "text-green-600" },
    { key: "colaborador", label: "Colaboradores", icon: HardHat, count: counts?.colaborador ?? 0, color: "text-purple-600" },
    { key: "transportadora", label: "Transportadoras", icon: Truck, count: counts?.transportadora ?? 0, color: "text-amber-600" },
    { key: "credor", label: "Credores", icon: Wallet, count: counts?.credor ?? 0, color: "text-rose-600" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold" data-testid="text-page-title">
            Pessoas
          </h1>
          <p className="text-muted-foreground mt-1">
            Cadastro unificado de clientes, fornecedores, colaboradores, transportadoras e credores
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={onMigrarLegado}
            disabled={migrarLegado.isPending}
            data-testid="button-migrar-legado"
            title="Copia clientes do cadastro antigo para Pessoas (idempotente — pode rodar várias vezes)"
          >
            {migrarLegado.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4 mr-2" />
            )}
            Migrar do cadastro legado
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)} data-testid="button-import">
            <Upload className="h-4 w-4 mr-2" />
            Importar planilha
          </Button>
          <Button onClick={() => setNovoOpen(true)} data-testid="button-new-pessoa">
            <Plus className="h-4 w-4 mr-2" />
            Nova pessoa
          </Button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => {
          const Icon = c.icon;
          const active = papel === c.key || (c.key === "todos" && papel === "todos");
          return (
            <Card
              key={c.key}
              className={`border-card-border cursor-pointer hover-elevate active-elevate-2 ${
                active ? "border-primary" : ""
              }`}
              onClick={() => setPapel(c.key)}
              data-testid={`card-papel-${c.key}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                    <p className={`text-2xl font-bold ${c.color}`} data-testid={`count-${c.key}`}>
                      {c.count}
                    </p>
                  </div>
                  <Icon className={`h-5 w-5 ${c.color}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CNPJ/CPF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
        <Select value={papel} onValueChange={setPapel}>
          <SelectTrigger className="w-56" data-testid="select-papel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAPEIS.map((p) => (
              <SelectItem key={p.value} value={p.value} data-testid={`option-papel-${p.value}`}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary">
          {pessoas.length} resultado{pessoas.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <Card className="border-card-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : pessoas.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground" data-testid="text-empty">
              Nenhuma pessoa encontrada. Use “Importar planilha” ou “Nova pessoa” para começar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ/CPF</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Papéis</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pessoas.map((p) => (
                  <TableRow key={p.id} data-testid={`row-pessoa-${p.id}`}>
                    <TableCell className="font-medium">
                      <Link href={`/pessoas/${p.id}`} className="hover:underline" data-testid={`link-pessoa-${p.id}`}>
                        {p.nomeFantasia}
                      </Link>
                      {p.razaoSocial && p.razaoSocial !== p.nomeFantasia && (
                        <p className="text-xs text-muted-foreground">{p.razaoSocial}</p>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{formatDoc(p.cnpjCpf)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.tipoPessoa}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(p.papeis ?? [])
                          .filter((pa) => pa.status === "ativo")
                          .map((pa) => (
                            <span
                              key={pa.tipoPapel}
                              className={`text-xs px-2 py-0.5 rounded ${PAPEL_COLOR[pa.tipoPapel] ?? "bg-muted"}`}
                              data-testid={`badge-papel-${p.id}-${pa.tipoPapel}`}
                            >
                              {pa.tipoPapel}
                            </span>
                          ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.status === "ativo" ? "default" : "secondary"}>{p.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="icon">
                        <Link href={`/pessoas/${p.id}`} data-testid={`button-view-${p.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NovaPessoaDialog open={novoOpen} onOpenChange={setNovoOpen} />
      <ImportarDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

function formatDoc(doc: string) {
  const d = (doc ?? "").replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return doc;
}

function NovaPessoaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [tipoPessoa, setTipoPessoa] = useState<"PJ" | "PF">("PJ");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpjCpf, setCnpjCpf] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [tipoPapel, setTipoPapel] = useState("cliente");

  const reset = () => {
    setTipoPessoa("PJ");
    setNomeFantasia("");
    setRazaoSocial("");
    setCnpjCpf("");
    setObservacoes("");
    setTipoPapel("cliente");
  };

  const mut = useMutation({
    mutationFn: async () => {
      const cleanDoc = cnpjCpf.replace(/\D/g, "");
      const r = await apiRequest("POST", "/api/pessoas", {
        tipoPessoa,
        nomeFantasia: nomeFantasia.trim(),
        razaoSocial: razaoSocial.trim() || undefined,
        cnpjCpf: cleanDoc,
        observacoes: observacoes.trim() || undefined,
      });
      const pessoa = await r.json();
      // cria papel inicial
      await apiRequest("POST", `/api/pessoas/${pessoa.id}/papeis`, {
        tipoPapel,
        status: "ativo",
      });
      return pessoa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pessoas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pessoas/counts"] });
      toast({ title: "Pessoa criada", description: "Cadastro adicionado com sucesso." });
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? "");
      const friendly = msg.includes("409")
        ? "Já existe uma pessoa com esse CNPJ/CPF."
        : msg.includes("400")
        ? "Dados inválidos. Confira CNPJ/CPF e nome."
        : "Não foi possível criar a pessoa.";
      toast({ title: "Erro", description: friendly, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-nova-pessoa">
        <DialogHeader>
          <DialogTitle>Nova pessoa</DialogTitle>
          <DialogDescription>Cadastro inicial. Endereços e contatos podem ser adicionados depois.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={tipoPessoa} onValueChange={(v) => setTipoPessoa(v as any)}>
                <SelectTrigger data-testid="select-tipo-pessoa">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PJ">Jurídica (PJ)</SelectItem>
                  <SelectItem value="PF">Física (PF)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Papel inicial</Label>
              <Select value={tipoPapel} onValueChange={setTipoPapel}>
                <SelectTrigger data-testid="select-papel-inicial">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAPEIS.filter((p) => p.value !== "todos").map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Nome / Nome fantasia *</Label>
            <Input
              value={nomeFantasia}
              onChange={(e) => setNomeFantasia(e.target.value)}
              data-testid="input-nome"
            />
          </div>
          {tipoPessoa === "PJ" && (
            <div>
              <Label>Razão social</Label>
              <Input
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                data-testid="input-razao-social"
              />
            </div>
          )}
          <div>
            <Label>{tipoPessoa === "PJ" ? "CNPJ" : "CPF"} *</Label>
            <Input
              value={cnpjCpf}
              onChange={(e) => setCnpjCpf(e.target.value)}
              placeholder={tipoPessoa === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"}
              data-testid="input-cnpj-cpf"
            />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              data-testid="input-observacoes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-nova">
            Cancelar
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !nomeFantasia.trim() || !cnpjCpf.trim()}
            data-testid="button-save-nova"
          >
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar pessoa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportarDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);

  const reset = () => {
    setFile(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const mut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione um arquivo");
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/pessoas/import", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`${r.status}: ${t}`);
      }
      return r.json();
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/pessoas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pessoas/counts"] });
      toast({
        title: "Importação concluída",
        description: `${data.created ?? 0} novas, ${data.updated ?? 0} atualizadas.`,
      });
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? "");
      const friendly = msg.includes("403")
        ? "Apenas administradores do tenant podem importar."
        : msg.includes("400")
        ? "Arquivo inválido. Use XLSX ou CSV."
        : "Falha na importação.";
      toast({ title: "Erro", description: friendly, variant: "destructive" });
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md" data-testid="dialog-importar">
        <DialogHeader>
          <DialogTitle>Importar planilha de pessoas</DialogTitle>
          <DialogDescription>
            Aceita XLSX e CSV. O sistema reconhece automaticamente os campos do export legado.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            data-testid="input-file"
          />
          {result && (
            <Card className="border-card-border">
              <CardContent className="p-3 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span data-testid="text-result-created">{result.created ?? 0} novas pessoas</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  <span data-testid="text-result-updated">{result.updated ?? 0} atualizadas</span>
                </div>
                {result.errors > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <span data-testid="text-result-errors">{result.errors} linhas com erro</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-import">
            Fechar
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !file}
            data-testid="button-do-import"
          >
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
