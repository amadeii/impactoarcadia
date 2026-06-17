/**
 * Arcádia Project Hub — Aba WBS
 * Sprint HUB-02
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChevronRight, ChevronDown, Plus, MoreHorizontal,
  Flag, Circle, CheckCircle2, AlertCircle, XCircle, Milestone,
  Package, Layers, CheckSquare, LayoutList,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface WbsNode {
  id: string;
  parent_id?: string;
  node_type: string;
  title: string;
  code?: string;
  weight: number;
  progress_pct: number;
  progress_method: string;
  planned_start?: string;
  planned_end?: string;
  budget_amount?: string;
  assignee_name?: string;
  status: string;
  order_index: number;
  open_tasks?: number;
  total_tasks?: number;
  children?: WbsNode[];
}

// ── Configs ──────────────────────────────────────────────────────────────────
const NODE_TYPE_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  fase:       { icon: Layers,      color: "text-purple-500", label: "Fase" },
  pacote:     { icon: Package,     color: "text-blue-500",   label: "Pacote" },
  entregavel: { icon: CheckSquare, color: "text-teal-500",   label: "Entregável" },
  tarefa:     { icon: Circle,      color: "text-gray-400",   label: "Tarefa" },
  marco:      { icon: Milestone,   color: "text-amber-500",  label: "Marco" },
};

const STATUS_CONFIG: Record<string, { icon: any; color: string }> = {
  pendente:     { icon: Circle,       color: "text-gray-400"   },
  em_andamento: { icon: AlertCircle,  color: "text-blue-500"   },
  concluido:    { icon: CheckCircle2, color: "text-green-500"  },
  bloqueado:    { icon: XCircle,      color: "text-red-500"    },
  cancelado:    { icon: XCircle,      color: "text-gray-300"   },
};

const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString("pt-BR", { day:"2-digit", month:"short" }) : null;
const fmtCurrency = (v?: string) => v ? new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0}).format(Number(v)) : null;

// ── Linha de nó WBS ───────────────────────────────────────────────────────────
function WbsRow({
  node, depth, projectId, onAddChild,
}: {
  node: WbsNode;
  depth: number;
  projectId: string;
  onAddChild: (parentId: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [hovered, setHovered] = useState(false);
  const qc = useQueryClient();

  const hasChildren = node.children && node.children.length > 0;
  const typeConf = NODE_TYPE_CONFIG[node.node_type] ?? NODE_TYPE_CONFIG.tarefa;
  const statusConf = STATUS_CONFIG[node.status] ?? STATUS_CONFIG.pendente;
  const TypeIcon = typeConf.icon;
  const StatusIcon = statusConf.icon;

  const patchMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/hub/wbs/${node.id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/hub/projects/${projectId}/wbs`] }),
  });

  const progressColor = node.progress_pct >= 100
    ? "bg-green-500" : node.progress_pct >= 60
    ? "bg-blue-500" : node.progress_pct >= 30
    ? "bg-amber-500" : "bg-muted-foreground/30";

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer text-sm",
          "hover:bg-muted/60 transition-colors",
          hovered && "bg-muted/40"
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Expand/collapse */}
        <button
          className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-muted-foreground"
          onClick={() => setExpanded(e => !e)}
        >
          {hasChildren
            ? expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
            : <span className="w-3.5" />
          }
        </button>

        {/* Status icon */}
        <StatusIcon className={cn("h-3.5 w-3.5 flex-shrink-0", statusConf.color)} />

        {/* Type icon */}
        <TypeIcon className={cn("h-3.5 w-3.5 flex-shrink-0", typeConf.color)} />

        {/* Code */}
        {node.code && (
          <span className="text-xs font-mono text-muted-foreground w-10 flex-shrink-0">{node.code}</span>
        )}

        {/* Title */}
        <span className={cn(
          "flex-1 truncate",
          node.status === "concluido" && "line-through text-muted-foreground",
          node.status === "cancelado" && "text-muted-foreground/50",
        )}>
          {node.title}
        </span>

        {/* Progresso */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", progressColor)}
              style={{ width: `${node.progress_pct}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-8 text-right">{node.progress_pct}%</span>
        </div>

        {/* Meta */}
        {node.planned_end && (
          <span className="text-xs text-muted-foreground hidden lg:block w-20 text-right flex-shrink-0">
            {fmtDate(node.planned_end)}
          </span>
        )}
        {node.budget_amount && (
          <span className="text-xs text-muted-foreground hidden xl:block w-24 text-right flex-shrink-0">
            {fmtCurrency(node.budget_amount)}
          </span>
        )}
        {node.assignee_name && (
          <span className="text-xs text-muted-foreground hidden xl:block w-20 truncate flex-shrink-0">
            {node.assignee_name}
          </span>
        )}

        {/* Ações */}
        <div className={cn("flex items-center gap-1 flex-shrink-0", !hovered && "opacity-0 group-hover:opacity-100")}>
          <button
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-background text-muted-foreground"
            onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }}
            title="Adicionar filho"
          >
            <Plus className="h-3 w-3" />
          </button>
          <select
            className="text-xs bg-transparent border-0 text-muted-foreground cursor-pointer"
            value={node.status}
            onChange={(e) => patchMutation.mutate({ status: e.target.value })}
            onClick={(e) => e.stopPropagation()}
          >
            <option value="pendente">Pendente</option>
            <option value="em_andamento">Em andamento</option>
            <option value="concluido">Concluído</option>
            <option value="bloqueado">Bloqueado</option>
          </select>
        </div>
      </div>

      {/* Filhos */}
      {hasChildren && expanded && (
        <div>
          {node.children!.map(child => (
            <WbsRow
              key={child.id}
              node={child}
              depth={depth + 1}
              projectId={projectId}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Modal de criação de nó ────────────────────────────────────────────────────
function AddNodeDialog({
  open, onClose, projectId, projectType, parentId,
}: {
  open: boolean; onClose: () => void;
  projectId: string; projectType: string; parentId?: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "", nodeType: "entregavel", plannedEnd: "", budgetAmount: "", description: "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", `/api/hub/projects/${projectId}/wbs`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/hub/projects/${projectId}/wbs`] });
      onClose();
      setForm({ title: "", nodeType: "entregavel", plannedEnd: "", budgetAmount: "", description: "" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {parentId ? "Adicionar sub-item" : "Adicionar item WBS"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Título *</label>
            <Input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Tipo</label>
              <Select value={form.nodeType} onValueChange={v => setForm(f => ({...f, nodeType: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(NODE_TYPE_CONFIG).map(([v,c]) => (
                    <SelectItem key={v} value={v}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Término previsto</label>
              <Input type="date" value={form.plannedEnd}
                onChange={e => setForm(f => ({...f, plannedEnd: e.target.value}))} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Orçamento (R$)</label>
            <Input placeholder="0" value={form.budgetAmount}
              onChange={e => setForm(f => ({...f, budgetAmount: e.target.value}))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate({ ...form, parentId: parentId ?? null, budgetAmount: form.budgetAmount ? Number(form.budgetAmount) : null })}
            disabled={mutation.isPending || !form.title.trim()}
          >
            {mutation.isPending ? "Criando..." : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── ViewWBS principal ─────────────────────────────────────────────────────────
export function ViewWBS({ projectId, projectType }: { projectId: string; projectType: string }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [addParentId, setAddParentId] = useState<string | undefined>();
  const [useTemplate, setUseTemplate] = useState(false);

  const { data, isLoading } = useQuery<{ tree: WbsNode[]; flat: WbsNode[] }>({
    queryKey: [`/api/hub/projects/${projectId}/wbs`],
    queryFn: () => apiRequest("GET", `/api/hub/projects/${projectId}/wbs`).then(r => r.json()),
  });

  const { data: template } = useQuery<any[]>({
    queryKey: [`/api/hub/wbs-templates/${projectType}`],
    queryFn: () => apiRequest("GET", `/api/hub/wbs-templates/${projectType}`).then(r => r.json()),
    enabled: useTemplate,
  });

  const createFromTemplateMutation = useMutation({
    mutationFn: async (nodes: any[]) => {
      const createNode = async (node: any, parentId?: string) => {
        const res = await apiRequest("POST", `/api/hub/projects/${projectId}/wbs`, {
          ...node, parentId: parentId ?? null, children: undefined,
        });
        const created = await res.json();
        if (node.children?.length) {
          for (const child of node.children) {
            await createNode(child, created.id);
          }
        }
      };
      for (const node of nodes) await createNode(node);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/hub/projects/${projectId}/wbs`] });
      setUseTemplate(false);
    },
  });

  const tree = data?.tree ?? [];
  const flat = data?.flat ?? [];

  const totalBudget = flat.filter(n => !n.parent_id).reduce((s, n) => s + Number(n.budget_amount ?? 0), 0);
  const avgProgress = flat.filter(n => !n.parent_id).length > 0
    ? Math.round(flat.filter(n => !n.parent_id).reduce((s, n) => s + n.progress_pct, 0) / flat.filter(n => !n.parent_id).length)
    : 0;

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando WBS...</div>;

  return (
    <div className="space-y-4">
      {/* Header da WBS */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span><LayoutList className="h-4 w-4 inline mr-1" />{flat.length} itens</span>
          {totalBudget > 0 && (
            <span>Orçamento: <strong className="text-foreground">{fmtCurrency(String(totalBudget))}</strong></span>
          )}
        </div>
        <div className="flex gap-2">
          {tree.length === 0 && (
            <Button variant="outline" size="sm" onClick={() => {
              setUseTemplate(true);
              // Buscar template e criar automaticamente
              apiRequest("GET", `/api/hub/wbs-templates/${projectType}`)
                .then(r => r.json())
                .then(t => createFromTemplateMutation.mutate(t));
            }}>
              Usar template {projectType}
            </Button>
          )}
          <Button size="sm" onClick={() => { setAddParentId(undefined); setAddOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>
      </div>

      {/* Cabeçalho da tabela */}
      <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground border-b pb-2 font-medium uppercase tracking-wide">
        <div className="w-4" />
        <div className="w-4" />
        <div className="w-4" />
        <div className="w-10" />
        <div className="flex-1">Item</div>
        <div className="w-32 text-right">Progresso</div>
        <div className="w-20 text-right hidden lg:block">Término</div>
        <div className="w-24 text-right hidden xl:block">Orçamento</div>
        <div className="w-20 hidden xl:block">Responsável</div>
        <div className="w-20" />
      </div>

      {/* Árvore */}
      {tree.length === 0 ? (
        <div className="text-center py-16">
          <LayoutList className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium mb-1">WBS vazia</p>
          <p className="text-xs text-muted-foreground mb-4">
            Adicione fases, entregáveis e tarefas, ou use um template
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          {tree.map(node => (
            <WbsRow
              key={node.id}
              node={node}
              depth={0}
              projectId={projectId}
              onAddChild={(pid) => { setAddParentId(pid); setAddOpen(true); }}
            />
          ))}
        </div>
      )}

      <AddNodeDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        projectId={projectId}
        projectType={projectType}
        parentId={addParentId}
      />
    </div>
  );
}
