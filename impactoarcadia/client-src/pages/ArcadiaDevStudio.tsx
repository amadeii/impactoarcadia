import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Zap, Plus, FolderOpen, FileCode, Send,
  Brain, Layers, CheckSquare, Code2, Network, Database,
  Check, AlertCircle, Loader2, X, Monitor, Wand2,
  RefreshCw, ExternalLink, Layout, ChevronLeft, Search,
  Globe, Terminal, Activity, Filter, Maximize2, Minimize2,
  PanelLeftClose, PanelLeftOpen
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────
interface SessionMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "text" | "plan" | "execution" | "verification" | "error" | "ki";
  steps?: any[];
  filesModified?: string[];
  timestamp: string;
}

interface DevSession {
  id: string;
  name: string;
  status: "active" | "archived";
  phase: "idle" | "planning" | "execution" | "verification" | "done";
  taskMd: string;
  implementationPlanMd: string;
  messages: SessionMessage[];
  ki: any[];
  createdAt: string;
  updatedAt: string;
}

interface AppPage {
  path: string;
  component: string;
  category: string;
}

// ── Helpers ───────────────────────────────────────────────────────
async function apiCall(url: string, opts?: RequestInit) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  return res.json();
}

const PHASE_COLORS: Record<string, string> = {
  idle: "bg-gray-700 text-gray-300",
  planning: "bg-blue-900 text-blue-300",
  execution: "bg-amber-900 text-amber-300",
  verification: "bg-purple-900 text-purple-300",
  done: "bg-emerald-900 text-emerald-300",
};
const PHASE_LABELS: Record<string, string> = {
  idle: "Aguardando", planning: "Planejando", execution: "Executando",
  verification: "Verificando", done: "Concluído",
};

function PhaseBadge({ phase }: { phase: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${PHASE_COLORS[phase] || PHASE_COLORS.idle}`}>
      {phase === "execution" && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
      {PHASE_LABELS[phase] || phase}
    </span>
  );
}

const CATEGORY_ICONS: Record<string, string> = {
  Core: "⚡", XOS: "🧠", Negócio: "💼", RH: "👥",
  Comunicação: "💬", IA: "🤖", Ferramentas: "🔧", Dev: "🛠️",
};

// ── Message Card ──────────────────────────────────────────────────
function MessageCard({ msg }: { msg: SessionMessage }) {
  const isUser = msg.role === "user";
  const time = new Date(msg.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  if (isUser) {
    return (
      <div className="flex justify-end mb-2.5">
        <div className="max-w-[82%] bg-emerald-700 text-white rounded-2xl rounded-tr-sm px-3.5 py-2 text-sm">
          <p className="whitespace-pre-wrap">{msg.content}</p>
          <p className="text-[10px] text-emerald-300 mt-1 text-right">{time}</p>
        </div>
      </div>
    );
  }

  if (msg.type === "plan") {
    return (
      <div className="mb-2.5">
        <div className="rounded-xl border border-blue-800 bg-blue-950/60 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-800/50 text-blue-200">
            <Brain className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">Plano de Implementação</span>
            <span className="ml-auto text-[10px] text-blue-400">{time}</span>
          </div>
          <div className="px-3 py-2.5 max-h-72 overflow-y-auto">
            <pre className="text-[11px] text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">{msg.content}</pre>
          </div>
          <div className="px-3 pb-2 text-[10px] text-blue-400 font-medium">
            ✓ Plano gerado — clique "⚡ Executar" para implementar
          </div>
        </div>
      </div>
    );
  }

  if (msg.type === "execution") {
    return (
      <div className="mb-2.5">
        <div className="rounded-xl border border-amber-800 bg-amber-950/40 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-800/40 text-amber-200">
            <Zap className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">Execução</span>
            <Badge className="ml-auto bg-amber-900/80 text-amber-300 text-[10px] border-0">
              {msg.steps?.length || 0} passos
            </Badge>
          </div>
          {msg.steps && msg.steps.length > 0 && (
            <div className="px-3 py-1.5 space-y-0.5 max-h-36 overflow-y-auto border-b border-amber-900/40">
              {msg.steps.map((s, i) => (
                <div key={i} className="text-[10px] flex items-start gap-1.5 text-gray-400">
                  {s.tool ? (
                    <><span className="text-amber-500 font-mono font-bold shrink-0">{s.tool}</span>
                      <span className="truncate">{s.toolInput?.path || s.toolInput?.query || s.toolInput?.command || ""}</span></>
                  ) : <span className="italic truncate">{s.thought?.slice(0, 80)}</span>}
                </div>
              ))}
            </div>
          )}
          {msg.filesModified && msg.filesModified.length > 0 && (
            <div className="px-3 py-1.5 flex flex-wrap gap-1 border-b border-amber-900/30">
              {msg.filesModified.map(f => (
                <span key={f} className="text-[10px] bg-amber-900/40 text-amber-400 border border-amber-800/50 px-1.5 py-0.5 rounded">
                  {f.split("/").pop()}
                </span>
              ))}
            </div>
          )}
          <div className="px-3 py-2 text-sm text-gray-300">
            <p className="whitespace-pre-wrap">{msg.content}</p>
            <p className="text-[10px] text-gray-600 mt-1">{time}</p>
          </div>
        </div>
      </div>
    );
  }

  if (msg.type === "verification") {
    const passed = msg.content.includes("✓") || msg.content.toLowerCase().includes("ok");
    return (
      <div className="mb-2.5">
        <div className={`rounded-xl border overflow-hidden ${passed ? "border-emerald-800 bg-emerald-950/40" : "border-red-900 bg-red-950/40"}`}>
          <div className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold ${passed ? "text-emerald-300" : "text-red-300"}`}>
            {passed ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            Verificação {passed ? "OK" : "com problemas"}
          </div>
          <div className="px-3 py-2 text-sm text-gray-300">
            <p className="whitespace-pre-wrap">{msg.content}</p>
            <p className="text-[10px] text-gray-600 mt-1">{time}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 mb-2.5">
      <div className="w-6 h-6 rounded-full bg-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
        <Zap className="w-3 h-3 text-white" />
      </div>
      <div className="max-w-[85%] bg-gray-800 rounded-xl rounded-tl-sm px-3.5 py-2 text-sm text-gray-200">
        <p className="whitespace-pre-wrap">{msg.content}</p>
        <p className="text-[10px] text-gray-600 mt-1">{time}</p>
      </div>
    </div>
  );
}

// ── Console Log Entry ─────────────────────────────────────────────
function ConsoleEntry({ log }: { log: any }) {
  const levelColor: Record<string, string> = {
    error: "text-red-400 bg-red-950/30 border-red-900/40",
    warn: "text-amber-400 bg-amber-950/20 border-amber-900/30",
    debug: "text-gray-500 bg-transparent border-transparent",
    log: "text-gray-300 bg-transparent border-transparent",
  };
  const cls = levelColor[log.level] || levelColor.log;
  const content = Array.isArray(log.content) ? log.content.join(" ") : String(log.content);
  const time = log.ts ? new Date(log.ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
  return (
    <div className={`flex gap-2 px-2 py-0.5 text-[10px] font-mono border-b ${cls} border-gray-800/30`}>
      <span className="text-gray-600 shrink-0 w-14">{time}</span>
      <span className="truncate">{content}</span>
    </div>
  );
}

// ── Network Entry ─────────────────────────────────────────────────
function NetworkEntry({ req }: { req: any }) {
  const methodColor: Record<string, string> = {
    GET: "text-blue-400", POST: "text-emerald-400", PUT: "text-amber-400",
    PATCH: "text-orange-400", DELETE: "text-red-400",
  };
  const statusColor = req.status >= 500 ? "text-red-400" : req.status >= 400 ? "text-amber-400" : "text-emerald-400";
  return (
    <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-800/30 hover:bg-gray-800/30 text-[10px] font-mono group">
      <span className={`font-bold shrink-0 w-12 ${methodColor[req.method] || "text-gray-400"}`}>{req.method}</span>
      <span className="flex-1 text-gray-400 truncate">{req.path}</span>
      <span className={`shrink-0 ${statusColor}`}>{req.status}</span>
      <span className="shrink-0 text-gray-600">{req.duration}ms</span>
    </div>
  );
}

// ── Preview Panel ─────────────────────────────────────────────────
function PreviewPanel({
  selectedPage,
  session,
  onAdjust,
  onClose,
  autoRefreshTrigger,
  maximized,
  onToggleMaximize,
}: {
  selectedPage: AppPage | null;
  session: DevSession | null;
  onAdjust: (page: AppPage, instruction: string) => void;
  onClose: () => void;
  autoRefreshTrigger: number;
  maximized?: boolean;
  onToggleMaximize?: () => void;
}) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustText, setAdjustText] = useState("");
  const [iframeKey, setIframeKey] = useState(0);
  const [pageSearch, setPageSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"preview" | "console" | "network" | "server">("preview");
  const [logFilter, setLogFilter] = useState("");
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { data: pagesData } = useQuery({
    queryKey: ["/api/arcadia-dev/pages"],
    queryFn: () => apiCall("/api/arcadia-dev/pages"),
  });
  const { data: consoleLogs, refetch: refetchConsole } = useQuery({
    queryKey: ["/api/arcadia-dev/console-logs"],
    queryFn: () => apiCall("/api/arcadia-dev/console-logs"),
    enabled: activeTab === "console",
    refetchInterval: activeTab === "console" ? 5000 : false,
  });
  const { data: networkData, refetch: refetchNetwork } = useQuery({
    queryKey: ["/api/arcadia-dev/network-requests"],
    queryFn: () => apiCall("/api/arcadia-dev/network-requests"),
    enabled: activeTab === "network",
    refetchInterval: activeTab === "network" ? 5000 : false,
  });
  const { data: serverLogs, refetch: refetchServer } = useQuery({
    queryKey: ["/api/arcadia-dev/server-logs", logFilter],
    queryFn: () => apiCall(`/api/arcadia-dev/server-logs?filter=${encodeURIComponent(logFilter)}`),
    enabled: activeTab === "server",
    refetchInterval: activeTab === "server" ? 5000 : false,
  });

  const pages: AppPage[] = pagesData?.pages || [];
  const [currentPage, setCurrentPage] = useState<AppPage | null>(selectedPage);

  useEffect(() => { if (selectedPage) setCurrentPage(selectedPage); }, [selectedPage]);
  useEffect(() => {
    if (autoRefreshTrigger > 0 && currentPage) {
      setTimeout(() => setIframeKey(k => k + 1), 1500);
    }
  }, [autoRefreshTrigger]);
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [consoleLogs]);

  const grouped = pages.reduce<Record<string, AppPage[]>>((acc, p) => {
    if (pageSearch && !p.path.includes(pageSearch) && !p.component.toLowerCase().includes(pageSearch.toLowerCase())) return acc;
    (acc[p.category] = acc[p.category] || []).push(p);
    return acc;
  }, {});

  const consoleLs: any[] = consoleLogs?.logs || [];
  const networkReqs: any[] = networkData?.requests || [];
  const serverLs: any[] = serverLogs?.logs || [];

  const errorCount = consoleLs.filter(l => l.level === "error").length;
  const warnCount = consoleLs.filter(l => l.level === "warn").length;
  const netErrorCount = networkReqs.filter(r => r.status >= 400).length;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Page browser */}
      <div className="w-40 border-r border-gray-800 flex flex-col shrink-0">
        <div className="px-2 py-1.5 border-b border-gray-800">
          <div className="flex items-center gap-1 bg-gray-800/60 rounded px-2 py-1">
            <Search className="w-3 h-3 text-gray-600 shrink-0" />
            <input value={pageSearch} onChange={e => setPageSearch(e.target.value)}
              placeholder="Filtrar..." className="bg-transparent text-[11px] text-gray-300 outline-none w-full placeholder-gray-600" />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="py-1">
            {Object.entries(grouped).map(([cat, catPages]) => (
              <div key={cat}>
                <div className="px-2 py-1 text-[9px] font-bold text-gray-600 uppercase tracking-widest">
                  {CATEGORY_ICONS[cat]} {cat}
                </div>
                {catPages.map(page => (
                  <button key={page.path}
                    onClick={() => { setCurrentPage(page); setIframeKey(k => k + 1); setActiveTab("preview"); }}
                    className={`w-full text-left px-2.5 py-1 text-[11px] transition-colors flex items-center gap-1 ${currentPage?.path === page.path ? "bg-emerald-900/40 text-emerald-300" : "text-gray-500 hover:bg-gray-800/60 hover:text-gray-300"}`}>
                    <Layout className="w-2.5 h-2.5 shrink-0 opacity-60" />
                    <span className="truncate">{page.component}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tabs toolbar */}
        <div className="flex items-center border-b border-gray-800 bg-gray-900/50 shrink-0">
          {[
            { id: "preview", icon: Monitor, label: "Preview" },
            { id: "console", icon: Terminal, label: "Console", badge: errorCount > 0 ? errorCount : warnCount > 0 ? warnCount : undefined, badgeColor: errorCount > 0 ? "bg-red-600" : "bg-amber-600" },
            { id: "network", icon: Activity, label: "Rede", badge: netErrorCount > 0 ? netErrorCount : undefined, badgeColor: "bg-amber-600" },
            { id: "server", icon: Database, label: "Servidor" },
          ].map(({ id, icon: Icon, label, badge, badgeColor }) => (
            <button key={id} onClick={() => setActiveTab(id as any)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium transition-colors relative ${activeTab === id ? "text-white border-b-2 border-emerald-500 bg-gray-800/30" : "text-gray-500 hover:text-gray-300"}`}>
              <Icon className="w-3 h-3" />
              {label}
              {badge !== undefined && (
                <span className={`ml-0.5 text-[9px] ${badgeColor} text-white rounded-full w-4 h-4 flex items-center justify-center font-bold`}>{badge}</span>
              )}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1 px-2">
            {activeTab === "preview" && (
              <>
                <button onClick={() => setIframeKey(k => k + 1)} title="Recarregar" className="text-gray-600 hover:text-gray-300 p-1 transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                {currentPage && (
                  <a href={currentPage.path} target="_blank" rel="noreferrer" title="Abrir em nova aba" className="text-gray-600 hover:text-gray-300 p-1 transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </>
            )}
            {activeTab === "console" && (
              <button onClick={() => refetchConsole()} className="text-gray-600 hover:text-gray-300 p-1 transition-colors" title="Atualizar">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
            {activeTab === "network" && (
              <button onClick={() => refetchNetwork()} className="text-gray-600 hover:text-gray-300 p-1 transition-colors" title="Atualizar">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
            {activeTab === "server" && (
              <button onClick={() => refetchServer()} className="text-gray-600 hover:text-gray-300 p-1 transition-colors" title="Atualizar">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
            {onToggleMaximize && (
              <button onClick={onToggleMaximize} className="text-gray-600 hover:text-gray-300 p-1 transition-colors" title={maximized ? "Restaurar" : "Maximizar"}>
                {maximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            )}
            <button onClick={onClose} className="text-gray-700 hover:text-gray-400 p-1 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* URL bar (preview only) */}
        {activeTab === "preview" && (
          <div className="flex items-center gap-2 px-3 py-1 bg-gray-900/30 border-b border-gray-800/50 shrink-0">
            <Globe className="w-3 h-3 text-gray-600 shrink-0" />
            <span className="text-[11px] text-gray-500 font-mono truncate flex-1">
              {currentPage ? window.location.origin + currentPage.path : "—"}
            </span>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === "preview" && (
            currentPage ? (
              <iframe key={iframeKey} ref={iframeRef} src={currentPage.path}
                className="flex-1 border-0 w-full h-full" title={`Preview: ${currentPage.component}`} />
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 text-gray-600">
                <Monitor className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm">Selecione uma página para visualizar</p>
              </div>
            )
          )}

          {activeTab === "console" && (
            <div className="flex flex-col flex-1 overflow-hidden bg-gray-950">
              <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-800/50 shrink-0">
                <span className="text-[10px] text-gray-600">{consoleLs.length} entradas</span>
                {errorCount > 0 && <span className="text-[10px] text-red-400">{errorCount} erros</span>}
                {warnCount > 0 && <span className="text-[10px] text-amber-400">{warnCount} avisos</span>}
              </div>
              <ScrollArea className="flex-1">
                {consoleLs.length === 0
                  ? <p className="text-[11px] text-gray-600 text-center py-8">Nenhum log do browser ainda</p>
                  : consoleLs.map((log, i) => <ConsoleEntry key={i} log={log} />)}
                <div ref={consoleEndRef} />
              </ScrollArea>
            </div>
          )}

          {activeTab === "network" && (
            <div className="flex flex-col flex-1 overflow-hidden bg-gray-950">
              <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-800/50 shrink-0 text-[10px] text-gray-600 font-mono">
                <span className="w-12 font-bold">METHOD</span>
                <span className="flex-1">PATH</span>
                <span className="w-10">STATUS</span>
                <span className="w-12">TEMPO</span>
              </div>
              <ScrollArea className="flex-1">
                {networkReqs.length === 0
                  ? <p className="text-[11px] text-gray-600 text-center py-8">Nenhuma requisição registrada</p>
                  : [...networkReqs].reverse().map((req, i) => <NetworkEntry key={i} req={req} />)}
              </ScrollArea>
            </div>
          )}

          {activeTab === "server" && (
            <div className="flex flex-col flex-1 overflow-hidden bg-gray-950">
              <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-800/50 shrink-0">
                <Filter className="w-3 h-3 text-gray-600" />
                <input value={logFilter} onChange={e => setLogFilter(e.target.value)}
                  placeholder="Filtrar logs do servidor..."
                  className="flex-1 bg-transparent text-[11px] text-gray-300 outline-none placeholder-gray-600 font-mono" />
              </div>
              <ScrollArea className="flex-1">
                {serverLs.length === 0
                  ? <p className="text-[11px] text-gray-600 text-center py-8">Nenhum log do servidor</p>
                  : serverLs.map((log, i) => (
                    <div key={i} className={`px-2 py-0.5 text-[10px] font-mono border-b border-gray-800/20 ${log.level === "error" ? "text-red-400 bg-red-950/20" : log.level === "warn" ? "text-amber-400" : "text-gray-500"}`}>
                      {log.content}
                    </div>
                  ))}
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Adjust bar */}
        {currentPage && (
          <div className="border-t border-gray-800 bg-gray-900/70 px-3 py-2 shrink-0">
            {!adjustOpen ? (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-600 font-mono truncate flex-1">{currentPage.component}</span>
                <button onClick={() => setAdjustOpen(true)} disabled={!session}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs rounded-lg transition-colors font-medium shrink-0">
                  <Wand2 className="w-3 h-3" /> Ajustar com AI
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                    <Wand2 className="w-3 h-3" /> {currentPage.component}
                  </span>
                  <button onClick={() => setAdjustOpen(false)} className="text-gray-600 hover:text-gray-300"><X className="w-3.5 h-3.5" /></button>
                </div>
                <Textarea value={adjustText} onChange={e => setAdjustText(e.target.value)} autoFocus
                  placeholder={`ex: "adicionar botão exportar", "mudar cor do header", "adicionar coluna na tabela"`}
                  className="min-h-[52px] text-xs resize-none bg-gray-800 border-gray-700 text-white placeholder-gray-600 rounded-lg" />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" className="h-6 text-xs text-gray-500" onClick={() => setAdjustOpen(false)}>Cancelar</Button>
                  <Button size="sm" disabled={!adjustText.trim()} className="h-6 text-xs bg-emerald-700 hover:bg-emerald-600 text-white"
                    onClick={() => { if (currentPage && adjustText.trim()) { onAdjust(currentPage, adjustText.trim()); setAdjustText(""); setAdjustOpen(false); } }}>
                    <Wand2 className="w-3 h-3 mr-1" /> Enviar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────
export default function ArcadiaDevStudio() {
  const qc = useQueryClient();
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sidebarTab, setSidebarTab] = useState<"sessions" | "explorer" | "tasks" | "ki">("sessions");
  const [explorerTab, setExplorerTab] = useState<"files" | "schemas" | "routes">("files");
  const [explorerPath, setExplorerPath] = useState(".");
  const [openedFile, setOpenedFile] = useState<{ path: string; content: string } | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const [showNewSession, setShowNewSession] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [rightMode, setRightMode] = useState<"preview" | "code" | "closed">("closed");
  const [selectedPage, setSelectedPage] = useState<AppPage | null>(null);
  const [autoRefreshTrigger, setAutoRefreshTrigger] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(580);
  const [rightPanelMaximized, setRightPanelMaximized] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: rightPanelWidth };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startX - ev.clientX;
      const next = Math.max(320, Math.min(window.innerWidth - 400, dragRef.current.startW + delta));
      setRightPanelWidth(next);
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [rightPanelWidth]);

  const { data: sessionsData, refetch: refetchSessions } = useQuery({
    queryKey: ["/api/arcadia-dev/sessions"],
    queryFn: () => apiCall("/api/arcadia-dev/sessions"),
  });
  const { data: sessionData, refetch: refetchSession } = useQuery({
    queryKey: ["/api/arcadia-dev/sessions", activeSession],
    queryFn: () => activeSession ? apiCall(`/api/arcadia-dev/sessions/${activeSession}`) : null,
    enabled: !!activeSession,
    refetchInterval: isActionLoading ? 2000 : false,
  });
  const { data: explorerData } = useQuery({
    queryKey: ["/api/arcadia-dev/explore", explorerPath, explorerTab],
    queryFn: () => {
      if (explorerTab === "schemas") return apiCall("/api/arcadia-dev/explore/schemas");
      if (explorerTab === "routes") return apiCall("/api/arcadia-dev/explore/routes");
      return apiCall(`/api/arcadia-dev/explore?path=${encodeURIComponent(explorerPath)}&type=dir`);
    },
    enabled: sidebarTab === "explorer",
  });

  const session: DevSession | null = sessionData?.session || null;
  const sessions: DevSession[] = sessionsData?.sessions || [];

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [session?.messages?.length]);

  const createSession = async () => {
    if (!newSessionName.trim()) return;
    const res = await apiCall("/api/arcadia-dev/sessions", {
      method: "POST", body: JSON.stringify({ name: newSessionName.trim() }),
    });
    if (res.success) {
      setNewSessionName(""); setShowNewSession(false);
      setActiveSession(res.session.id); refetchSessions();
    }
  };

  const openFile = async (path: string) => {
    setRightMode("code");
    setOpenedFile({ path, content: "Carregando..." });
    const res = await apiCall(`/api/arcadia-dev/explore?path=${encodeURIComponent(path)}&type=file`);
    if (res.success) setOpenedFile({ path, content: res.content || "Arquivo vazio" });
  };

  const handleAction = async (action: "plan" | "execute" | "verify" | "chat") => {
    if (!activeSession) return;
    if (action !== "verify" && action !== "execute" && !input.trim()) return;
    setIsActionLoading(true); setPendingAction(action);
    const prompt = input.trim(); setInput("");

    try {
      let endpoint = `/api/arcadia-dev/sessions/${activeSession}/chat`;
      let body: any = { content: prompt, role: "user" };
      if (action === "plan") { endpoint = `/api/arcadia-dev/sessions/${activeSession}/plan`; body = { prompt }; }
      else if (action === "execute") { endpoint = `/api/arcadia-dev/sessions/${activeSession}/execute`; body = { prompt: prompt || session?.implementationPlanMd, planContext: session?.implementationPlanMd }; }
      else if (action === "verify") { endpoint = `/api/arcadia-dev/sessions/${activeSession}/verify`; const last = session?.messages.findLast(m => m.type === "execution"); body = { filesModified: last?.filesModified || [] }; }
      await apiCall(endpoint, { method: "POST", body: JSON.stringify(body) });
      refetchSession();
      if (action === "execute") setAutoRefreshTrigger(t => t + 1);
    } catch (e) { console.error(e); }
    finally { setIsActionLoading(false); setPendingAction(null); }
  };

  const handleAdjustPage = async (page: AppPage, instruction: string) => {
    if (!activeSession) return;
    setIsActionLoading(true); setPendingAction("plan");
    try {
      await apiCall(`/api/arcadia-dev/sessions/${activeSession}/adjust-page`, {
        method: "POST",
        body: JSON.stringify({ pagePath: page.path, component: page.component, instruction }),
      });
      refetchSession();
      setRightMode("preview");
    } catch (e) { console.error(e); }
    finally { setIsActionLoading(false); setPendingAction(null); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAction("chat");
  };

  const openPreview = (page?: AppPage) => {
    if (page) setSelectedPage(page);
    setRightMode("preview");
  };

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── LEFT SIDEBAR ── */}
      <div
        className="border-r border-gray-800 flex flex-col shrink-0 bg-gray-900/50 transition-all duration-200"
        style={{ width: sidebarCollapsed ? 44 : 208 }}
      >
        {/* Header */}
        <div className="px-2 py-2.5 border-b border-gray-800 flex items-center gap-2 min-h-[44px]">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-white leading-none">Dev Studio</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Arcádia</p>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(c => !c)}
            className="text-gray-600 hover:text-gray-300 transition-colors ml-auto shrink-0"
            title={sidebarCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Sidebar tab icons */}
        <div className={`flex border-b border-gray-800 ${sidebarCollapsed ? "flex-col" : ""}`}>
          {[
            { id: "sessions", icon: Layers, tip: "Sessões" },
            { id: "explorer", icon: FolderOpen, tip: "Explorador" },
            { id: "tasks", icon: CheckSquare, tip: "Tarefas" },
            { id: "ki", icon: Brain, tip: "Conhecimento" },
          ].map(({ id, icon: Icon, tip }) => (
            <button key={id} onClick={() => { setSidebarTab(id as any); if (sidebarCollapsed) setSidebarCollapsed(false); }} title={tip}
              className={`flex-1 py-2 flex items-center justify-center transition-colors ${sidebarTab === id ? "text-emerald-400 border-b-2 border-emerald-500" : "text-gray-600 hover:text-gray-400"} ${sidebarCollapsed ? "border-b-0 border-l-2" : ""}`}>
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>

        {/* Sessions */}
        {!sidebarCollapsed && sidebarTab === "sessions" && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-2 pt-2 pb-1.5">
              {showNewSession ? (
                <div className="space-y-1.5">
                  <Input value={newSessionName} onChange={e => setNewSessionName(e.target.value)}
                    placeholder="Nome da sessão..." autoFocus
                    className="h-7 text-[11px] bg-gray-800 border-gray-700 text-white placeholder-gray-600"
                    onKeyDown={e => e.key === "Enter" && createSession()} />
                  <div className="flex gap-1">
                    <Button size="sm" onClick={createSession} className="h-6 flex-1 text-[11px] bg-emerald-700 hover:bg-emerald-600">Criar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowNewSession(false)} className="h-6 text-[11px] text-gray-500">×</Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" onClick={() => setShowNewSession(true)}
                  className="w-full h-7 text-[11px] bg-emerald-900/40 text-emerald-400 border border-emerald-800/50 hover:bg-emerald-800/40">
                  <Plus className="w-3 h-3 mr-1" /> Nova sessão
                </Button>
              )}
            </div>
            <ScrollArea className="flex-1">
              <div className="px-2 space-y-1 pb-2">
                {sessions.map(s => (
                  <button key={s.id} onClick={() => setActiveSession(s.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors ${activeSession === s.id ? "bg-emerald-900/30 border border-emerald-800/40" : "hover:bg-gray-800/60"}`}>
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-[11px] font-medium text-gray-200 truncate flex-1">{s.name}</span>
                      <PhaseBadge phase={s.phase} />
                    </div>
                    <p className="text-[10px] text-gray-600 mt-0.5">{s.messages.length} msgs</p>
                  </button>
                ))}
                {sessions.length === 0 && <p className="text-[11px] text-gray-600 text-center py-4">Nenhuma sessão</p>}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Explorer */}
        {!sidebarCollapsed && sidebarTab === "explorer" && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex border-b border-gray-800">
              {[
                { id: "files", icon: FolderOpen, tip: "Arquivos" },
                { id: "schemas", icon: Database, tip: "Schemas" },
                { id: "routes", icon: Network, tip: "Rotas API" },
              ].map(({ id, icon: Icon, tip }) => (
                <button key={id} onClick={() => setExplorerTab(id as any)} title={tip}
                  className={`flex-1 py-1.5 flex items-center justify-center transition-colors ${explorerTab === id ? "text-emerald-400 bg-emerald-900/20" : "text-gray-600 hover:text-gray-400"}`}>
                  <Icon className="w-3 h-3" />
                </button>
              ))}
            </div>
            {explorerTab === "files" && (
              <>
                {explorerPath !== "." && (
                  <button onClick={() => setExplorerPath(explorerPath.split("/").slice(0, -1).join("/") || ".")}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-500 hover:text-gray-200 w-full">
                    <ChevronLeft className="w-3 h-3" /> voltar
                  </button>
                )}
                <ScrollArea className="flex-1">
                  {(explorerData?.items || []).map((item: any) => (
                    <div key={item.path} onClick={() => item.type === "directory" ? setExplorerPath(item.path) : openFile(item.path)}
                      className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-gray-400 hover:bg-gray-800 cursor-pointer">
                      {item.type === "directory" ? <FolderOpen className="w-3 h-3 text-amber-500 shrink-0" /> : <FileCode className="w-3 h-3 text-blue-400 shrink-0" />}
                      <span className="truncate">{item.name}</span>
                    </div>
                  ))}
                </ScrollArea>
              </>
            )}
            {(explorerTab === "schemas" || explorerTab === "routes") && (
              <ScrollArea className="flex-1">
                <div className="py-1">
                  {(explorerData?.items || []).slice(0, 60).map((item: any, i: number) => (
                    <div key={i} onClick={() => openFile(item.file)}
                      className="px-2 py-1 hover:bg-gray-800 cursor-pointer">
                      <span className="text-[10px] text-emerald-500 font-mono">{item.file?.split("/").pop()}</span>
                      <span className="text-[10px] text-gray-700">:{item.line}</span>
                      <p className="text-[10px] text-gray-500 truncate">{item.content?.slice(0, 50)}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        {/* Tasks */}
        {!sidebarCollapsed && sidebarTab === "tasks" && (
          <ScrollArea className="flex-1">
            <div className="px-3 py-2">
              {session
                ? <pre className="text-[11px] text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">{session.taskMd}</pre>
                : <p className="text-[11px] text-gray-600 text-center py-6">Selecione uma sessão</p>}
            </div>
          </ScrollArea>
        )}

        {/* KI */}
        {!sidebarCollapsed && sidebarTab === "ki" && (
          <ScrollArea className="flex-1">
            <div className="px-2 py-2 space-y-2">
              {session?.ki?.length ? session.ki.map((ki: any) => (
                <div key={ki.id} className="bg-gray-800/60 rounded-lg p-2 border border-gray-700/40">
                  <p className="text-[11px] font-semibold text-emerald-400">{ki.topic}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{ki.content.slice(0, 120)}</p>
                </div>
              )) : <p className="text-[11px] text-gray-600 text-center py-6">Nenhum conhecimento</p>}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* ── CENTER: CHAT ── */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 bg-gray-900/70 shrink-0">
          {session ? (
            <>
              <Zap className="w-4 h-4 text-emerald-500 shrink-0" />
              <p className="text-sm font-semibold text-white truncate flex-1">{session.name}</p>
              <PhaseBadge phase={session.phase} />
            </>
          ) : (
            <p className="text-sm text-gray-500 flex-1">Arcádia Dev Studio</p>
          )}
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => setRightMode(rightMode === "preview" ? "closed" : "preview")}
              title="Preview de páginas"
              className={`p-1.5 rounded transition-colors ${rightMode === "preview" ? "bg-blue-800/50 text-blue-400" : "text-gray-600 hover:text-gray-300"}`}>
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setRightMode(rightMode === "code" ? "closed" : "code")}
              title="Visualizador de código"
              className={`p-1.5 rounded transition-colors ${rightMode === "code" ? "bg-gray-700 text-gray-200" : "text-gray-600 hover:text-gray-300"}`}>
              <Code2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Empty state */}
        {!session ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-900/30 border border-emerald-800/30 flex items-center justify-center mb-4">
              <Zap className="w-8 h-8 text-emerald-600" />
            </div>
            <p className="text-lg font-semibold text-gray-400">Arcádia Dev Studio</p>
            <p className="text-sm text-gray-600 mt-1 mb-4">Sessões persistentes · Preview ao vivo · Ajuste com AI</p>
            <div className="flex gap-3">
              <Button onClick={() => { setSidebarTab("sessions"); setShowNewSession(true); }}
                className="bg-emerald-700 hover:bg-emerald-600 text-white">
                <Plus className="w-4 h-4 mr-2" /> Nova sessão
              </Button>
              <Button variant="outline" onClick={() => openPreview()}
                className="border-gray-700 text-gray-300 hover:bg-gray-800">
                <Monitor className="w-4 h-4 mr-2" /> Preview de páginas
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-3">
              {session.messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <Brain className="w-8 h-8 text-emerald-700/40 mb-2" />
                  <p className="text-gray-600 text-sm">Sessão iniciada</p>
                  <p className="text-gray-700 text-xs mt-1">Use "📋 Planejar" para gerar um plano antes de executar</p>
                </div>
              )}
              {session.messages.map(msg => <MessageCard key={msg.id} msg={msg} />)}
              {isActionLoading && (
                <div className="flex gap-2 mb-2.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-700 flex items-center justify-center shrink-0">
                    <Loader2 className="w-3 h-3 text-white animate-spin" />
                  </div>
                  <div className="bg-gray-800 rounded-xl px-3.5 py-2 text-sm text-gray-400">
                    {pendingAction === "plan" && "Analisando e criando plano..."}
                    {pendingAction === "execute" && "Executando implementação..."}
                    {pendingAction === "verify" && "Verificando código..."}
                    {pendingAction === "chat" && "Processando..."}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </ScrollArea>

            {/* Phase quick actions */}
            {session.phase !== "idle" && (
              <div className="flex items-center gap-2 px-4 py-1 border-t border-gray-800/60 bg-gray-900/30">
                <span className="text-[10px] text-gray-600 shrink-0">Fluxo:</span>
                <button disabled={!input.trim() || isActionLoading} onClick={() => handleAction("plan")}
                  className="text-[11px] text-blue-400 hover:text-blue-300 disabled:opacity-30 transition-colors">📋 Planejar</button>
                <span className="text-gray-800">·</span>
                <button disabled={!session.implementationPlanMd || isActionLoading} onClick={() => handleAction("execute")}
                  className="text-[11px] text-amber-400 hover:text-amber-300 disabled:opacity-30 transition-colors">⚡ Executar</button>
                <span className="text-gray-800">·</span>
                <button disabled={isActionLoading} onClick={() => handleAction("verify")}
                  className="text-[11px] text-purple-400 hover:text-purple-300 disabled:opacity-30 transition-colors">✓ Verificar</button>
                <span className="text-gray-800">·</span>
                <button onClick={() => openPreview()}
                  className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-0.5">
                  <Monitor className="w-2.5 h-2.5" /> Preview
                </button>
              </div>
            )}

            {/* Input */}
            <div className="px-4 py-3 border-t border-gray-800 bg-gray-900/50">
              <div className="flex gap-2 items-end">
                <Textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                  placeholder="Descreva a tarefa... (Ctrl+Enter para enviar)"
                  className="flex-1 min-h-[56px] max-h-[120px] text-sm resize-none bg-gray-800 border-gray-700 text-white placeholder-gray-600 rounded-xl"
                  disabled={isActionLoading} />
                <div className="flex flex-col gap-1.5 shrink-0">
                  <Button size="sm" onClick={() => handleAction("plan")} disabled={!input.trim() || isActionLoading}
                    className="h-7 px-2.5 bg-blue-700 hover:bg-blue-600 text-white text-xs">
                    <Brain className="w-3.5 h-3.5 mr-1" /> Planejar
                  </Button>
                  <Button size="sm" onClick={() => handleAction("chat")} disabled={!input.trim() || isActionLoading}
                    className="h-7 px-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs">
                    <Send className="w-3.5 h-3.5 mr-1" /> Enviar
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── RIGHT PANEL ── */}
      {rightMode !== "closed" && (
        <div
          className={`border-l border-gray-800 flex shrink-0 bg-gray-900 transition-none ${rightPanelMaximized ? "fixed inset-0 z-50 border-0" : "relative flex-col"}`}
          style={!rightPanelMaximized ? { width: rightMode === "preview" ? rightPanelWidth : 320 } : undefined}
        >
          {/* Drag handle (left edge) */}
          {!rightPanelMaximized && rightMode === "preview" && (
            <div
              onMouseDown={handleDragStart}
              className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-emerald-500/40 transition-colors z-10 group"
              title="Arrastar para redimensionar"
            >
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 bg-gray-700 group-hover:bg-emerald-500 rounded-full transition-colors" />
            </div>
          )}

          <div className="flex flex-col flex-1 overflow-hidden">
          {rightMode === "preview" ? (
            <PreviewPanel
              selectedPage={selectedPage}
              session={session}
              onAdjust={handleAdjustPage}
              onClose={() => { setRightMode("closed"); setRightPanelMaximized(false); }}
              autoRefreshTrigger={autoRefreshTrigger}
              maximized={rightPanelMaximized}
              onToggleMaximize={() => setRightPanelMaximized(m => !m)}
            />
          ) : (
            <>
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 shrink-0">
                <Code2 className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-gray-400 truncate flex-1">{openedFile?.path || "Código"}</span>
                <button onClick={() => setRightMode("closed")} className="text-gray-700 hover:text-gray-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ScrollArea className="flex-1">
                <pre className="text-[11px] text-gray-300 font-mono px-3 py-2 whitespace-pre-wrap leading-relaxed">
                  {openedFile?.content || "Clique em um arquivo no explorador"}
                </pre>
              </ScrollArea>
              {session?.implementationPlanMd && !openedFile && (
                <div className="border-t border-gray-800 p-3">
                  <p className="text-[10px] text-gray-600 font-semibold uppercase mb-1">Plano Ativo</p>
                  <pre className="text-[10px] text-gray-400 whitespace-pre-wrap max-h-48 overflow-y-auto">{session.implementationPlanMd}</pre>
                </div>
              )}
            </>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
