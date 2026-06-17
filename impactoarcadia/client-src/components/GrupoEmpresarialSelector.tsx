import { Building2, ChevronDown, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useGrupoEmpresarial, type GrupoCtx } from "@/hooks/useGrupoEmpresarial";
import { cn } from "@/lib/utils";

interface GrupoEmpresarialSelectorProps {
  className?: string;
  compact?: boolean;
}

export function GrupoEmpresarialSelector({ className, compact = false }: GrupoEmpresarialSelectorProps) {
  const { grupos, selectedGrupo, selectedGrupoId, setSelectedGrupoId, grupoEmpresas, gruposLoading } = useGrupoEmpresarial();

  if (gruposLoading) return null;
  if (grupos.length === 0) return null;

  const label = selectedGrupo?.nome ?? "Todos os grupos";

  return (
    <div className={cn("flex items-center gap-2", className)} data-testid="grupo-empresarial-selector">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={selectedGrupoId ? "secondary" : "outline"}
            size="sm"
            className={cn(
              "gap-2 h-8 text-xs font-medium border",
              selectedGrupoId
                ? "bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100"
                : "text-slate-600 hover:bg-slate-50"
            )}
            data-testid="btn-grupo-selector"
          >
            <Building2 className="h-3.5 w-3.5" />
            {!compact && <span className="max-w-[140px] truncate">{label}</span>}
            {compact && selectedGrupoId && <span className="max-w-[80px] truncate">{label}</span>}
            {!compact && !selectedGrupoId && <span>Grupo</span>}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="flex items-center gap-2 text-xs text-slate-500">
            <Users className="h-3.5 w-3.5" />
            Grupos Empresariais
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setSelectedGrupoId(null)}
            className={cn("text-sm", !selectedGrupoId && "font-medium bg-slate-50")}
            data-testid="grupo-option-todos"
          >
            <span className="flex-1">Todas as empresas</span>
            {!selectedGrupoId && <Badge variant="secondary" className="text-xs px-1.5">Ativo</Badge>}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {grupos.map((g: GrupoCtx) => (
            <DropdownMenuItem
              key={g.id}
              onClick={() => setSelectedGrupoId(g.id)}
              className={cn("text-sm", selectedGrupoId === g.id && "font-medium bg-violet-50")}
              data-testid={`grupo-option-${g.id}`}
            >
              <span className="flex-1 truncate">{g.nome}</span>
              <div className="flex items-center gap-1 ml-2">
                {g.membros && (
                  <span className="text-xs text-slate-400">{g.membros.length}</span>
                )}
                {selectedGrupoId === g.id && (
                  <Badge className="text-xs px-1.5 bg-violet-100 text-violet-700 border-0">Ativo</Badge>
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedGrupoId && (
        <button
          onClick={() => setSelectedGrupoId(null)}
          className="h-5 w-5 rounded-full flex items-center justify-center bg-violet-100 hover:bg-violet-200 text-violet-600 transition-colors"
          title="Limpar filtro de grupo"
          data-testid="btn-grupo-clear"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      {selectedGrupoId && grupoEmpresas.length > 0 && (
        <span className="text-xs text-violet-600 font-medium" data-testid="grupo-empresas-count">
          {grupoEmpresas.length} empresa{grupoEmpresas.length > 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

interface GrupoBannerProps {
  className?: string;
}

export function GrupoBanner({ className }: GrupoBannerProps) {
  const { selectedGrupo, grupoEmpresas, setSelectedGrupoId } = useGrupoEmpresarial();

  if (!selectedGrupo) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2 bg-violet-50 border border-violet-200 rounded-lg text-sm",
        className
      )}
      data-testid="grupo-banner"
    >
      <div className="flex items-center gap-2 text-violet-700">
        <Building2 className="h-4 w-4 flex-shrink-0" />
        <span className="font-semibold">{selectedGrupo.nome}</span>
        {selectedGrupo.tipo && (
          <Badge variant="outline" className="text-xs border-violet-300 text-violet-600 px-1.5">
            {selectedGrupo.tipo}
          </Badge>
        )}
      </div>

      {grupoEmpresas.length > 0 && (
        <>
          <span className="text-violet-400">·</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {grupoEmpresas.slice(0, 4).map(e => (
              <Badge
                key={e.empresaId}
                variant="outline"
                className="text-xs border-violet-200 bg-white text-violet-700 px-1.5"
              >
                {e.papel === "matriz" ? "🏢 " : "🏬 "}
                {e.nomeFantasia ?? e.razaoSocial ?? `Empresa ${e.empresaId}`}
              </Badge>
            ))}
            {grupoEmpresas.length > 4 && (
              <span className="text-xs text-violet-500">+{grupoEmpresas.length - 4} mais</span>
            )}
          </div>
        </>
      )}

      <button
        onClick={() => setSelectedGrupoId(null)}
        className="ml-auto h-5 w-5 rounded-full flex items-center justify-center bg-violet-100 hover:bg-violet-200 text-violet-500 transition-colors flex-shrink-0"
        title="Remover filtro de grupo"
        data-testid="grupo-banner-clear"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
