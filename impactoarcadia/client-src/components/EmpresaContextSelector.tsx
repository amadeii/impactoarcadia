import { useEmpresaContext } from "@/hooks/useEmpresaContext";
import type { EmpresaInfo, GrupoInfo } from "@/hooks/useEmpresaContext";
import { Building2, ChevronDown, Layers, BarChart3, Check, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function EmpresaContextSelector() {
  const {
    activeEmpresaNome, activeGrupoNome, visaoConsolidada,
    empresas, grupos, isLoading, isSwitching,
    setEmpresa, setGrupo, limparContexto,
  } = useEmpresaContext();

  if (isLoading) return (
    <div className="flex items-center gap-1 px-2 text-xs text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" />
    </div>
  );

  if (empresas.length <= 1 && grupos.length === 0) return null;

  const label = visaoConsolidada
    ? `🔗 ${activeGrupoNome}`
    : activeEmpresaNome
    ? activeEmpresaNome
    : "Todas as empresas";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-1.5 max-w-[180px] h-7 px-2 text-xs"
          disabled={isSwitching}
          data-testid="empresa-context-selector"
        >
          {isSwitching ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : visaoConsolidada ? (
            <BarChart3 className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
          ) : (
            <Building2 className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
          )}
          <span className="truncate font-medium">{label}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Contexto de visualização
        </DropdownMenuLabel>

        <DropdownMenuItem
          onClick={limparContexto}
          className="gap-2 cursor-pointer"
          data-testid="ctx-todas"
        >
          <Layers className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="flex-1">Todas as empresas</span>
          {!activeEmpresaNome && !visaoConsolidada && (
            <Check className="h-4 w-4 text-primary flex-shrink-0" />
          )}
        </DropdownMenuItem>

        {grupos.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Grupos (visão consolidada)
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {grupos.map((g: GrupoInfo) => (
                <DropdownMenuItem
                  key={g.id}
                  onClick={() => setGrupo(g)}
                  className="gap-2 cursor-pointer"
                  data-testid={`ctx-grupo-${g.id}`}
                >
                  <BarChart3 className="h-4 w-4 text-purple-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm">{g.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.totalEmpresas} empresa{Number(g.totalEmpresas) !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {visaoConsolidada && activeGrupoNome === g.nome && (
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Empresa específica
        </DropdownMenuLabel>
        <DropdownMenuGroup>
          {empresas.map((e: EmpresaInfo) => (
            <DropdownMenuItem
              key={e.id}
              onClick={() => setEmpresa(e)}
              className="gap-2 cursor-pointer"
              data-testid={`ctx-empresa-${e.id}`}
            >
              <Building2 className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm">{e.nomeFantasia || e.razaoSocial}</p>
                <p className="text-xs text-muted-foreground font-mono">{e.cnpj}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {e.tipo === "matriz" && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1">Matriz</Badge>
                )}
                {!visaoConsolidada && activeEmpresaNome === (e.nomeFantasia || e.razaoSocial) && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
