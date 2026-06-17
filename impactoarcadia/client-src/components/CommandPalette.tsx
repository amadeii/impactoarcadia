import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { 
  Search, FileText, Users, FolderKanban, CheckSquare, 
  MessageSquare, BookOpen, Plus, Settings, Home, 
  BarChart3, Bot, Compass, MessageCircle, Zap, X, Handshake, TrendingUp, Globe,
  Calculator, Receipt, UserCog
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface SearchResult {
  id: number | string;
  title?: string;
  name?: string;
  content?: string;
  _type: string;
  _module: string;
}

interface CommandItem {
  id: string;
  name: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
  group: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "F1") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const { data: searchResults } = useQuery<{ results: SearchResult[] }>({
    queryKey: ["/api/productivity/search", search],
    queryFn: async () => {
      if (!search || search.length < 2) return { results: [] };
      const res = await fetch(`/api/productivity/search?q=${encodeURIComponent(search)}&limit=10`, { credentials: "include" });
      if (!res.ok) return { results: [] };
      return res.json();
    },
    enabled: search.length >= 2 && open,
    staleTime: 1000,
  });

  const trackCommand = useMutation({
    mutationFn: async (command: string) => {
      await fetch("/api/productivity/commands/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
        credentials: "include",
      });
    },
  });

  const runCommand = useCallback((callback: () => void, commandId?: string) => {
    setOpen(false);
    setSearch("");
    if (commandId) {
      trackCommand.mutate(commandId);
    }
    callback();
  }, [trackCommand]);

  const navigateTo = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  const commands: CommandItem[] = useMemo(() => [
    {
      id: "nav-home",
      name: "Ir para Início",
      shortcut: "⌘H",
      icon: <Home className="h-4 w-4" />,
      action: () => navigateTo("/"),
      keywords: ["home", "início", "dashboard"],
      group: "Navegação",
    },
    {
      id: "nav-agent",
      name: "Abrir Arcádia Agent",
      icon: <Bot className="h-4 w-4" />,
      action: () => navigateTo("/agent"),
      keywords: ["ia", "assistente", "chat", "gpt"],
      group: "Navegação",
    },
    {
      id: "nav-hub",
      name: "Abrir Process Compass",
      icon: <Compass className="h-4 w-4" />,
      action: () => navigateTo("/hub"),
      keywords: ["projetos", "clientes", "consultoria"],
      group: "Navegação",
    },
    {
      id: "nav-crm",
      name: "Abrir Manager Partners",
      icon: <Handshake className="h-4 w-4" />,
      action: () => navigateTo("/crm"),
      keywords: ["crm", "parceiros", "contratos", "manager", "partners"],
      group: "Navegação",
    },
    {
      id: "nav-insights",
      name: "Abrir Arcádia Insights",
      icon: <BarChart3 className="h-4 w-4" />,
      action: () => navigateTo("/insights"),
      keywords: ["bi", "dados", "relatórios", "analytics"],
      group: "Navegação",
    },
    {
      id: "nav-automations",
      name: "Abrir Automações",
      icon: <Zap className="h-4 w-4" />,
      action: () => navigateTo("/automations"),
      keywords: ["workflows", "automação"],
      group: "Navegação",
    },
    {
      id: "nav-communities",
      name: "Abrir Comunidades",
      icon: <MessageCircle className="h-4 w-4" />,
      action: () => navigateTo("/communities"),
      keywords: ["discord", "comunidades", "chat", "mensagens", "comunicação", "equipe"],
      group: "Navegação",
    },
    {
      id: "nav-admin",
      name: "Painel de Administração",
      icon: <Settings className="h-4 w-4" />,
      action: () => navigateTo("/admin"),
      keywords: ["config", "usuários", "permissões"],
      group: "Navegação",
    },
    {
      id: "nav-central-apis",
      name: "Abrir Central de APIs",
      icon: <Globe className="h-4 w-4" />,
      action: () => navigateTo("/central-apis"),
      keywords: ["api", "integrações", "sefaz", "nfe", "pix", "bancos", "marketplace"],
      group: "Navegação",
    },
    {
      id: "nav-pessoas",
      name: "Abrir Pessoas (cadastro unificado)",
      icon: <UserCog className="h-4 w-4" />,
      action: () => navigateTo("/pessoas"),
      keywords: ["pessoas", "clientes", "fornecedores", "colaboradores", "papéis", "cadastro"],
      group: "Navegação",
    },
    {
      id: "nav-hr",
      name: "Abrir RH / DP",
      icon: <UserCog className="h-4 w-4" />,
      action: () => navigateTo("/hr"),
      keywords: ["rh", "folha", "funcionários", "inss", "fgts", "esocial", "férias", "ponto"],
      group: "Navegação",
    },
    {
      id: "nav-control",
      name: "Abrir Arcádia Control (Financeiro)",
      icon: <Calculator className="h-4 w-4" />,
      action: () => navigateTo("/control"),
      keywords: ["control", "financeiro", "dre", "fluxo de caixa", "orçamento", "lançamentos", "fleuriet", "contas", "conciliação", "bpo"],
      group: "Navegação",
    },
    {
      id: "nav-contabil",
      name: "Abrir Arcádia Contábil",
      icon: <Calculator className="h-4 w-4" />,
      action: () => navigateTo("/contabil"),
      keywords: ["contabilidade", "plano de contas", "lançamento", "dre", "balanço", "sped"],
      group: "Navegação",
    },
    {
      id: "nav-fisco",
      name: "Abrir Arcádia Fisco",
      icon: <Receipt className="h-4 w-4" />,
      action: () => navigateTo("/fisco"),
      keywords: ["fiscal", "nfe", "ncm", "cfop", "imposto", "tributário"],
      group: "Navegação",
    },
    {
      id: "create-page",
      name: "Criar Nova Página",
      shortcut: "⌘N",
      icon: <Plus className="h-4 w-4" />,
      action: () => {
        window.dispatchEvent(new CustomEvent("create-new-page"));
      },
      keywords: ["novo", "documento", "nota"],
      group: "Criar",
    },
    {
      id: "create-note",
      name: "Criar Nota Rápida",
      icon: <FileText className="h-4 w-4" />,
      action: () => {
        window.dispatchEvent(new CustomEvent("create-quick-note"));
      },
      keywords: ["nota", "lembrete"],
      group: "Criar",
    },
  ], [navigateTo]);

  const getResultIcon = (type: string) => {
    switch (type) {
      case "page": return <FileText className="h-4 w-4" />;
      case "client": return <Users className="h-4 w-4" />;
      case "project": return <FolderKanban className="h-4 w-4" />;
      case "task": return <CheckSquare className="h-4 w-4" />;
      case "conversation": return <MessageSquare className="h-4 w-4" />;
      case "knowledge": return <BookOpen className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getResultPath = (result: SearchResult): string => {
    switch (result._type) {
      case "page": return `/page/${result.id}`;
      case "client": return `/compass?tab=clients&id=${result.id}`;
      case "project": return `/hub/${result.id}`;
      case "task": return `/compass?tab=tasks&id=${result.id}`;
      case "conversation": return `/agent?conversation=${result.id}`;
      case "knowledge": return `/agent?knowledge=${result.id}`;
      default: return "/";
    }
  };

  const getModuleLabel = (module: string) => {
    switch (module) {
      case "workspace": return "Páginas";
      case "hub": return "Project Hub";
      case "agent": return "Arcádia Agent";
      default: return module;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "page": return "Página";
      case "client": return "Cliente";
      case "project": return "Projeto";
      case "task": return "Tarefa";
      case "conversation": return "Conversa";
      case "knowledge": return "Conhecimento";
      default: return type;
    }
  };

  const filteredCommands = useMemo(() => {
    if (!search) return commands;
    const lower = search.toLowerCase();
    return commands.filter(cmd => 
      cmd.name.toLowerCase().includes(lower) ||
      cmd.keywords?.some(k => k.toLowerCase().includes(lower))
    );
  }, [commands, search]);

  const allItems = useMemo(() => {
    const items: { type: 'result' | 'command'; data: SearchResult | CommandItem }[] = [];
    
    if (searchResults?.results) {
      searchResults.results.forEach(r => items.push({ type: 'result', data: r }));
    }
    
    filteredCommands.forEach(c => items.push({ type: 'command', data: c }));
    
    return items;
  }, [searchResults?.results, filteredCommands]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = allItems[selectedIndex];
      if (item) {
        if (item.type === 'result') {
          runCommand(() => navigateTo(getResultPath(item.data as SearchResult)));
        } else {
          const cmd = item.data as CommandItem;
          runCommand(cmd.action, cmd.id);
        }
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const groupedCommands = useMemo(() => {
    return filteredCommands.reduce((acc, cmd) => {
      if (!acc[cmd.group]) acc[cmd.group] = [];
      acc[cmd.group].push(cmd);
      return acc;
    }, {} as Record<string, CommandItem[]>);
  }, [filteredCommands]);

  let itemIndex = -1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 shadow-lg max-w-[640px]" data-testid="command-palette">
        <VisuallyHidden>
          <DialogTitle>Paleta de Comandos</DialogTitle>
          <DialogDescription>Pesquise ou execute comandos</DialogDescription>
        </VisuallyHidden>
        <div className="flex flex-col">
          <div className="flex items-center border-b px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              ref={inputRef}
              placeholder="Pesquisar ou digitar comando..."
              className="flex-1 border-none focus-visible:ring-0 shadow-none"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              data-testid="command-input"
            />
            {search && (
              <button onClick={() => setSearch("")} className="p-1 hover:bg-muted rounded">
                <X className="h-4 w-4 opacity-50" />
              </button>
            )}
          </div>
          
          <div className="max-h-[400px] overflow-y-auto overflow-x-hidden p-2">
            {allItems.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Nenhum resultado encontrado.
              </div>
            )}

            {searchResults?.results && searchResults.results.length > 0 && (
              <div className="mb-2">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                  Resultados da Busca
                </div>
                {searchResults.results.map((result) => {
                  itemIndex++;
                  const isSelected = itemIndex === selectedIndex;
                  return (
                    <div
                      key={`${result._type}-${result.id}`}
                      className={`flex items-center gap-2 px-2 py-2 cursor-pointer rounded ${isSelected ? 'bg-accent' : 'hover:bg-muted'}`}
                      onClick={() => runCommand(() => navigateTo(getResultPath(result)))}
                      data-testid={`search-result-${result._type}-${result.id}`}
                    >
                      {getResultIcon(result._type)}
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="truncate text-sm">{result.title || result.name || "Sem título"}</span>
                        <span className="text-xs text-muted-foreground">
                          {getTypeLabel(result._type)} · {getModuleLabel(result._module)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {Object.entries(groupedCommands).map(([group, items]) => (
              <div key={group} className="mb-2">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                  {group}
                </div>
                {items.map((cmd) => {
                  itemIndex++;
                  const isSelected = itemIndex === selectedIndex;
                  return (
                    <div
                      key={cmd.id}
                      className={`flex items-center gap-2 px-2 py-2 cursor-pointer rounded ${isSelected ? 'bg-accent' : 'hover:bg-muted'}`}
                      onClick={() => runCommand(cmd.action, cmd.id)}
                      data-testid={`command-${cmd.id}`}
                    >
                      {cmd.icon}
                      <span className="flex-1 text-sm">{cmd.name}</span>
                      {cmd.shortcut && (
                        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          
          <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
            <div className="flex gap-2">
              <span>↑↓ Navegar</span>
              <span>↵ Selecionar</span>
              <span>Esc Fechar</span>
            </div>
            <span>⌘K para abrir</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
