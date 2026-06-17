import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  RefreshCw, CheckCircle, XCircle, Loader2, Users, Package,
  ShoppingCart, FileText, ExternalLink, Building2, Link2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Empresa {
  id: number;
  tenantId: number;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  tipo: string;
  plusEmpresaId: number | null;
  isActive: boolean;
}

interface SyncResult {
  success: boolean;
  created?: number;
  updated?: number;
  failed?: number;
  errors?: string[];
  message?: string;
}

interface PlusStatus {
  connected: boolean;
  url?: string;
  message?: string;
}

export default function PlusSyncPanel({ tenantId }: { tenantId?: number }) {
  const { toast } = useToast();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>("");
  const [plusStatus, setPlusStatus] = useState<PlusStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncingCustomers, setSyncingCustomers] = useState(false);
  const [syncingProducts, setSyncingProducts] = useState(false);
  const [syncingSales, setSyncingSales] = useState(false);
  const [importingCustomers, setImportingCustomers] = useState(false);
  const [importingProducts, setImportingProducts] = useState(false);
  const [bindPlusId, setBindPlusId] = useState("");
  const [lastResults, setLastResults] = useState<Record<string, SyncResult>>({});

  const currentTenant = tenantId || 1;

  const loadEmpresas = useCallback(async () => {
    try {
      const res = await fetch(`/api/retail/plus/empresas?tenantId=${currentTenant}`);
      if (res.ok) {
        const data = await res.json();
        setEmpresas(data);
        if (data.length > 0 && !selectedEmpresa) {
          setSelectedEmpresa(data[0].id.toString());
        }
      }
    } catch (error) {
      console.error("Error loading empresas:", error);
    }
  }, [currentTenant, selectedEmpresa]);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const empresaId = selectedEmpresa ? `?empresaId=${selectedEmpresa}` : "";
      const res = await fetch(`/api/retail/plus/status${empresaId}`);
      if (res.ok) {
        const data = await res.json();
        setPlusStatus(data);
      }
    } catch (error) {
      setPlusStatus({ connected: false, message: "Erro ao verificar conexão" });
    } finally {
      setLoading(false);
    }
  }, [selectedEmpresa]);

  useEffect(() => {
    loadEmpresas();
  }, [loadEmpresas]);

  useEffect(() => {
    if (selectedEmpresa) checkStatus();
  }, [selectedEmpresa, checkStatus]);

  const handleSync = async (action: string, setLoading: (v: boolean) => void) => {
    setLoading(true);
    try {
      const body: any = { tenantId: currentTenant };
      if (selectedEmpresa) body.empresaId = parseInt(selectedEmpresa);

      const res = await fetch(`/api/retail/plus/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setLastResults(prev => ({ ...prev, [action]: data }));

      if (data.success) {
        toast({ title: "Sincronização concluída", description: `Criados: ${data.created || 0}, Atualizados: ${data.updated || 0}` });
      } else {
        toast({ title: "Erro na sincronização", description: data.message || "Falha na operação", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erro", description: "Falha na comunicação com o servidor", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleBindEmpresa = async () => {
    if (!selectedEmpresa || !bindPlusId) return;
    try {
      const res = await fetch(`/api/retail/plus/empresas/${selectedEmpresa}/bind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plusEmpresaId: parseInt(bindPlusId) }),
      });
      if (res.ok) {
        toast({ title: "Empresa vinculada", description: "Empresa vinculada ao Plus com sucesso" });
        loadEmpresas();
        setBindPlusId("");
      }
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao vincular empresa", variant: "destructive" });
    }
  };

  const currentEmpresa = empresas.find(e => e.id.toString() === selectedEmpresa);

  const SyncResultBadge = ({ result }: { result?: SyncResult }) => {
    if (!result) return null;
    return (
      <div className="flex items-center gap-2 text-xs mt-1">
        {result.success ? (
          <Badge variant="outline" className="text-green-600 border-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            OK: {result.created || 0} criados, {result.updated || 0} atualizados
          </Badge>
        ) : (
          <Badge variant="destructive" className="text-xs">
            <XCircle className="h-3 w-3 mr-1" />
            {result.message || "Falha"}
          </Badge>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="plus-sync-panel">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Integração Plus ERP</h3>
          <p className="text-sm text-muted-foreground">Sincronização bidirecional com o Arcádia Plus (Laravel ERP)</p>
        </div>
        <div className="flex items-center gap-2">
          {plusStatus && (
            <Badge variant={plusStatus.connected ? "default" : "destructive"} data-testid="plus-connection-status">
              {plusStatus.connected ? (
                <><CheckCircle className="h-3 w-3 mr-1" /> Conectado</>
              ) : (
                <><XCircle className="h-3 w-3 mr-1" /> Desconectado</>
              )}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={checkStatus} disabled={loading} data-testid="btn-check-plus-status">
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Testar Conexão
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Empresa Ativa
          </CardTitle>
          <CardDescription>Selecione a empresa para operações de sincronização</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label>Empresa</Label>
              <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
                <SelectTrigger data-testid="select-empresa-plus">
                  <SelectValue placeholder="Selecione uma empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map(emp => (
                    <SelectItem key={emp.id} value={emp.id.toString()}>
                      {emp.nomeFantasia || emp.razaoSocial} ({emp.cnpj}) {emp.tipo === "matriz" ? "📍" : "🔗"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {currentEmpresa && (
            <div className="rounded-lg border p-3 bg-muted/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{currentEmpresa.razaoSocial}</span>
                <Badge variant="outline">{currentEmpresa.tipo === "matriz" ? "Matriz" : "Filial"}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">CNPJ: {currentEmpresa.cnpj}</div>
              <div className="flex items-center gap-2">
                <Link2 className="h-3 w-3" />
                <span className="text-xs">Plus ID: {currentEmpresa.plusEmpresaId || "Não vinculada"}</span>
                {!currentEmpresa.plusEmpresaId && (
                  <div className="flex items-center gap-1 ml-2">
                    <Input
                      type="number"
                      placeholder="ID da empresa no Plus"
                      value={bindPlusId}
                      onChange={e => setBindPlusId(e.target.value)}
                      className="h-7 w-36 text-xs"
                      data-testid="input-bind-plus-id"
                    />
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleBindEmpresa} data-testid="btn-bind-empresa">
                      Vincular
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Clientes / Fornecedores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={syncingCustomers}
                onClick={() => handleSync("sync/customers", setSyncingCustomers)}
                data-testid="btn-sync-customers-to-plus"
              >
                {syncingCustomers ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-1" />}
                Enviar → Plus
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={importingCustomers}
                onClick={() => handleSync("import/customers", setImportingCustomers)}
                data-testid="btn-import-customers-from-plus"
              >
                {importingCustomers ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-1 rotate-180" />}
                Plus → Importar
              </Button>
            </div>
            <SyncResultBadge result={lastResults["sync/customers"] || lastResults["import/customers"]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Produtos / Estoque
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={importingProducts}
                onClick={() => handleSync("import/products", setImportingProducts)}
                data-testid="btn-import-products-from-plus"
              >
                {importingProducts ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Package className="h-4 w-4 mr-1" />}
                Plus → Importar Produtos
              </Button>
            </div>
            <SyncResultBadge result={lastResults["import/products"]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Vendas PDV
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              As vendas são sincronizadas automaticamente ao finalizar no PDV.
              Use o botão abaixo para reenviar vendas pendentes.
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={syncingSales}
              onClick={() => {
                toast({ title: "Em breve", description: "Sincronização em lote será implementada" });
              }}
              data-testid="btn-sync-pending-sales"
            >
              {syncingSales ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Reenviar Pendentes
            </Button>
            <SyncResultBadge result={lastResults["sync/sales"]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documentos Fiscais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Emissão de NF-e e NFC-e via Plus ERP. Selecione a venda na aba PDV
              e use a opção "Emitir NF-e" para gerar o documento fiscal.
            </p>
            <Badge variant="outline" className="text-xs">
              <FileText className="h-3 w-3 mr-1" />
              Integrado via Plus API
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
