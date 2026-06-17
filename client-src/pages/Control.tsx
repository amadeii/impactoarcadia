import React, { useEffect, useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Wallet, ArrowRight, Search, Sparkles, Building2, ExternalLink, MapPin } from "lucide-react";
import { ModuleAgentBanner } from "@/components/agent/ModuleAgentBanner";

interface TenantEmpresa {
  id: number;
  tenantId: number;
  razaoSocial: string;
  nomeFantasia?: string | null;
  cnpj: string;
  email?: string | null;
  phone?: string | null;
  tipo?: string | null;
  status?: string | null;
  regimeTributario?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

interface PlanoConta {
  id: string;
  codigo: string;
}

export default function Control() {
  const [search, setSearch] = useState("");

  const { data: clientes = [], isLoading } = useQuery<TenantEmpresa[]>({
    queryKey: ["/api/admin/empresas"],
    queryFn: async () => {
      const res = await fetch("/api/admin/empresas", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data.filter((e: TenantEmpresa) => e.status !== "inactive") : [];
    },
  });
  const { data: planosContas = [] } = useQuery<PlanoConta[]>({ queryKey: ["/api/control/planos-contas"] });

  const bootstrap = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/control/bootstrap"),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/control/planos-contas"] });
    },
  });

  useEffect(() => {
    if (planosContas.length === 0 && !bootstrap.isPending) {
      bootstrap.mutate();
    }
  }, [planosContas.length]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) => {
      const haystack = [c.razaoSocial, c.nomeFantasia, c.cnpj, c.email, c.cidade]
        .filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [clientes, search]);

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-control">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wallet className="h-8 w-8 text-primary" />
            Arcádia Control
          </h1>
          <p className="text-muted-foreground mt-1">
            Controller as a Service — selecione uma empresa para abrir o workspace financeiro
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1" data-testid="badge-plano-contas">
            <Sparkles className="h-3 w-3" />
            Plano de contas: {planosContas.length} contas
          </Badge>
          <Link href="/crm">
            <Button variant="outline" className="gap-1" data-testid="btn-ir-mp">
              <ExternalLink className="h-4 w-4" />
              Manager Partners
            </Button>
          </Link>
        </div>
      </div>

      <ModuleAgentBanner module="control" label="Arcádia Control" />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Empresas-Cliente</CardTitle>
          <CardDescription>
            Clientes cadastrados no Manager Partners. Clique para abrir o workspace financeiro de cada empresa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar empresa por nome ou CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-cliente"
            />
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>
                {search
                  ? "Nenhuma empresa encontrada para essa busca."
                  : "Nenhum cliente encontrado. Cadastre clientes no Manager Partners (CRM)."}
              </p>
              {!search && (
                <Link href="/crm">
                  <Button variant="outline" size="sm" className="mt-3" data-testid="btn-ir-crm-empty">
                    Ir para o Manager Partners
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((cliente) => (
                <Link key={cliente.id} href={`/control/${cliente.id}`}>
                  <Card
                    className="hover-elevate active-elevate-2 cursor-pointer transition-shadow"
                    data-testid={`card-cliente-${cliente.id}`}
                  >
                    <CardContent className="p-4 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate" data-testid={`text-cliente-nome-${cliente.id}`}>
                          {cliente.nomeFantasia || cliente.razaoSocial}
                        </div>
                        {cliente.nomeFantasia && cliente.nomeFantasia !== cliente.razaoSocial && (
                          <div className="text-xs text-muted-foreground mt-1 truncate">{cliente.razaoSocial}</div>
                        )}
                        {cliente.cnpj && (
                          <div className="text-xs text-muted-foreground font-mono mt-1">{cliente.cnpj}</div>
                        )}
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {cliente.tipo && (
                            <Badge variant="outline" className="text-xs capitalize">{cliente.tipo}</Badge>
                          )}
                          {(cliente.cidade || cliente.uf) && (
                            <span className="text-xs text-muted-foreground">
                              {[cliente.cidade, cliente.uf].filter(Boolean).join(" / ")}
                            </span>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground self-center" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
