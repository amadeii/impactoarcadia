/**
 * Sprint C-E12 — FavorecidoPicker
 * Combobox que busca em /api/pessoas (tabela nativa — nunca ERPNext)
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, Plus, User, Building2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Pessoa {
  id: string;
  nomeFantasia: string;
  razaoSocial?: string;
  cnpjCpf?: string;
  tipoPessoa: string;
}

interface FavorecidoPickerProps {
  value?: string;
  label?: string;
  onChange: (pessoaId: string | null, pessoa: Pessoa | null) => void;
  placeholder?: string;
  tipos?: string[];
  className?: string;
  showQuickCreate?: boolean;
  onQuickCreate?: () => void;
}

export function FavorecidoPicker({
  value,
  label,
  onChange,
  placeholder = "Buscar pessoa ou empresa...",
  tipos,
  className,
  showQuickCreate = true,
  onQuickCreate,
}: FavorecidoPickerProps) {
  const [query, setQuery] = useState(label ?? "");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Sincroniza label externo (ex: ao abrir edit dialog com valor já salvo)
  useEffect(() => { if (label !== undefined) setQuery(label); }, [label]);

  const { data: results = [], isLoading } = useQuery<Pessoa[]>({
    queryKey: ["/api/pessoas", query, tipos?.join(",")],
    queryFn: async () => {
      if (query.length < 2) return [];
      const params = new URLSearchParams({ q: query, limit: "10" });
      if (tipos?.length) params.set("tipos", tipos.join(","));
      const res = await fetch(`/api/pessoas?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.data ?? []);
    },
    enabled: query.length >= 2,
  });

  const handleSelect = useCallback((p: Pessoa) => {
    setQuery(p.nomeFantasia);
    setOpen(false);
    onChange(p.id, p);
  }, [onChange]);

  const handleClear = useCallback(() => {
    setQuery("");
    setOpen(false);
    onChange(null, null);
  }, [onChange]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div className="relative flex items-center">
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => { if (query.length >= 2) setOpen(true); }}
          placeholder={placeholder}
          className="pl-9 pr-8"
          data-testid="favorecido-picker-input"
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
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-64 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
            </div>
          )}

          {!isLoading && results.length === 0 && query.length >= 2 && (
            <div className="p-3 text-sm text-muted-foreground">
              Nenhuma pessoa encontrada para "{query}".
              {showQuickCreate && onQuickCreate && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="p-0 h-auto ml-1"
                  onClick={() => { setOpen(false); onQuickCreate(); }}
                >
                  <Plus className="h-3 w-3 mr-1" /> Cadastrar nova
                </Button>
              )}
            </div>
          )}

          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full flex items-center gap-3 p-3 hover:bg-muted text-left transition-colors"
              onClick={() => handleSelect(p)}
              data-testid={`favorecido-option-${p.id}`}
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                {p.tipoPessoa === "F" ? (
                  <User className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.nomeFantasia}</p>
                {p.razaoSocial && p.razaoSocial !== p.nomeFantasia && (
                  <p className="text-xs text-muted-foreground truncate">{p.razaoSocial}</p>
                )}
              </div>
              {p.cnpjCpf && (
                <Badge variant="outline" className="text-xs flex-shrink-0">
                  {p.cnpjCpf}
                </Badge>
              )}
            </button>
          ))}

          {!isLoading && query.length >= 2 && results.length > 0 && showQuickCreate && onQuickCreate && (
            <button
              type="button"
              className="w-full flex items-center gap-2 p-3 hover:bg-muted text-sm text-primary border-t"
              onClick={() => { setOpen(false); onQuickCreate(); }}
            >
              <Plus className="h-4 w-4" /> Cadastrar nova pessoa
            </button>
          )}
        </div>
      )}
    </div>
  );
}
