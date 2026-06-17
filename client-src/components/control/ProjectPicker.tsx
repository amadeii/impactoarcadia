/**
 * ProjectPicker — busca projetos de Hub (Engineering) e Compass em paralelo,
 * normaliza os campos e exibe lista unificada com badge de origem.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, FolderOpen, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface UnifiedProject {
  id: string;
  nome: string;
  codigo?: string;
  status?: string;
  origem: "hub" | "compass";
}

export interface ProjectPickerProps {
  value?: string;
  label?: string;
  onChange: (projetoId: string | null, projeto: UnifiedProject | null) => void;
  placeholder?: string;
  className?: string;
}

function normalizeHub(p: any): UnifiedProject {
  return {
    id: String(p.id),
    nome: p.title ?? p.nome ?? "(sem título)",
    codigo: p.project_code ?? p.codigo ?? undefined,
    status: p.status ?? undefined,
    origem: "hub",
  };
}

function normalizeCompass(p: any): UnifiedProject {
  return {
    id: String(p.id),
    nome: p.name ?? p.nome ?? "(sem título)",
    codigo: p.compassProjectId ?? p.codigo ?? undefined,
    status: p.status ?? undefined,
    origem: "compass",
  };
}

export function ProjectPicker({
  value,
  label: initialLabel,
  onChange,
  placeholder = "Buscar projeto...",
  className,
}: ProjectPickerProps) {
  const [query, setQuery] = useState(initialLabel ?? "");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: hubProjects = [], isLoading: loadingHub } = useQuery<UnifiedProject[]>({
    queryKey: ["/api/hub/projects", "picker", query],
    queryFn: async () => {
      const res = await fetch(
        `/api/hub/projects?q=${encodeURIComponent(query)}&limit=20`,
        { credentials: "include" }
      );
      if (!res.ok) return [];
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data.data ?? []);
      return arr.map(normalizeHub);
    },
    staleTime: 30_000,
  });

  const { data: compassProjects = [], isLoading: loadingCompass } = useQuery<UnifiedProject[]>({
    queryKey: ["/api/compass/projects", "picker", query],
    queryFn: async () => {
      const res = await fetch(
        `/api/compass/projects?limit=50`,
        { credentials: "include" }
      );
      if (!res.ok) return [];
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data.data ?? []);
      return arr.map(normalizeCompass);
    },
    staleTime: 30_000,
  });

  const isLoading = loadingHub || loadingCompass;

  const allProjects = [...hubProjects, ...compassProjects];

  const filtered = query.length >= 1
    ? allProjects.filter((p) =>
        p.nome.toLowerCase().includes(query.toLowerCase()) ||
        (p.codigo ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : allProjects.slice(0, 10);

  const handleSelect = useCallback((p: UnifiedProject) => {
    setQuery(p.codigo ? `[${p.codigo}] ${p.nome}` : p.nome);
    setOpen(false);
    onChange(p.id, p);
  }, [onChange]);

  const handleClear = useCallback(() => {
    setQuery("");
    setOpen(false);
    onChange(null, null);
  }, [onChange]);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div className="relative flex items-center">
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-9 pr-8"
          data-testid="project-picker-input"
        />
        {(value || query) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 h-6 w-6"
            onClick={handleClear}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-72 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando projetos...
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="p-3 text-sm text-muted-foreground">
              Nenhum projeto encontrado.
            </div>
          )}

          {filtered.map((p) => (
            <button
              key={`${p.origem}-${p.id}`}
              type="button"
              className="w-full flex items-center gap-3 p-3 hover:bg-muted text-left transition-colors"
              onClick={() => handleSelect(p)}
              data-testid={`project-option-${p.id}`}
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                <FolderOpen className="h-4 w-4 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.nome}</p>
                {p.codigo && (
                  <p className="text-xs text-muted-foreground">{p.codigo}</p>
                )}
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs flex-shrink-0",
                  p.origem === "hub"
                    ? "border-blue-300 text-blue-600"
                    : "border-green-300 text-green-600"
                )}
              >
                {p.origem === "hub" ? "Hub" : "Compass"}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
