import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Circle,
  Square,
  Diamond,
  ArrowRight,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Save,
  Play,
  StopCircle,
  Timer,
  Mail,
  MessageSquare,
  GitBranch,
  Layers,
  Move,
} from "lucide-react";

// ═══════════════════════════════════════════════════
// TIPOS BPMN
// ═══════════════════════════════════════════════════

export type BpmnElementType =
  | "startEvent"
  | "endEvent"
  | "task"
  | "userTask"
  | "serviceTask"
  | "timerEvent"
  | "messageEvent"
  | "exclusiveGateway"
  | "parallelGateway"
  | "inclusiveGateway"
  | "subProcess"
  | "lane";

export interface BpmnNode {
  id: string;
  type: BpmnElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color?: string;
}

export interface BpmnConnection {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
}

export interface BpmnDiagramData {
  nodes: BpmnNode[];
  connections: BpmnConnection[];
}

// ═══════════════════════════════════════════════════
// PALETA DE ELEMENTOS BPMN
// ═══════════════════════════════════════════════════

const BPMN_PALETTE: {
  category: string;
  items: { type: BpmnElementType; label: string; icon: any }[];
}[] = [
  {
    category: "Eventos",
    items: [
      { type: "startEvent", label: "Início", icon: Play },
      { type: "endEvent", label: "Fim", icon: StopCircle },
      { type: "timerEvent", label: "Timer", icon: Timer },
      { type: "messageEvent", label: "Mensagem", icon: Mail },
    ],
  },
  {
    category: "Atividades",
    items: [
      { type: "task", label: "Tarefa", icon: Square },
      { type: "userTask", label: "Tarefa Usuário", icon: MessageSquare },
      { type: "serviceTask", label: "Tarefa Serviço", icon: Layers },
      { type: "subProcess", label: "Sub-Processo", icon: GitBranch },
    ],
  },
  {
    category: "Gateways",
    items: [
      { type: "exclusiveGateway", label: "Exclusivo (XOR)", icon: Diamond },
      { type: "parallelGateway", label: "Paralelo (AND)", icon: Diamond },
      { type: "inclusiveGateway", label: "Inclusivo (OR)", icon: Diamond },
    ],
  },
];

const DEFAULT_SIZES: Record<BpmnElementType, { w: number; h: number }> = {
  startEvent: { w: 40, h: 40 },
  endEvent: { w: 40, h: 40 },
  timerEvent: { w: 40, h: 40 },
  messageEvent: { w: 40, h: 40 },
  task: { w: 140, h: 60 },
  userTask: { w: 140, h: 60 },
  serviceTask: { w: 140, h: 60 },
  subProcess: { w: 160, h: 80 },
  exclusiveGateway: { w: 50, h: 50 },
  parallelGateway: { w: 50, h: 50 },
  inclusiveGateway: { w: 50, h: 50 },
  lane: { w: 600, h: 200 },
};

// ═══════════════════════════════════════════════════
// RENDERIZADORES SVG DOS ELEMENTOS
// ═══════════════════════════════════════════════════

function renderBpmnElement(
  node: BpmnNode,
  isSelected: boolean,
  isConnecting: boolean
) {
  const { x, y, width, height, type, label } = node;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const strokeColor = isSelected ? "#3b82f6" : isConnecting ? "#f59e0b" : "#64748b";
  const strokeWidth = isSelected ? 2.5 : 1.5;

  switch (type) {
    case "startEvent":
      return (
        <g key={node.id}>
          <circle cx={cx} cy={cy} r={18} fill="#dcfce7" stroke="#22c55e" strokeWidth={strokeWidth} />
          <polygon points={`${cx - 5},${cy - 8} ${cx - 5},${cy + 8} ${cx + 7},${cy}`} fill="#22c55e" />
          <text x={cx} y={cy + 32} textAnchor="middle" fontSize={11} fill="#374151">{label}</text>
        </g>
      );

    case "endEvent":
      return (
        <g key={node.id}>
          <circle cx={cx} cy={cy} r={18} fill="#fce7f3" stroke="#ef4444" strokeWidth={3} />
          <rect x={cx - 6} y={cy - 6} width={12} height={12} rx={2} fill="#ef4444" />
          <text x={cx} y={cy + 32} textAnchor="middle" fontSize={11} fill="#374151">{label}</text>
        </g>
      );

    case "timerEvent":
      return (
        <g key={node.id}>
          <circle cx={cx} cy={cy} r={18} fill="#fef3c7" stroke="#f59e0b" strokeWidth={strokeWidth} />
          <circle cx={cx} cy={cy} r={12} fill="none" stroke="#f59e0b" strokeWidth={1} />
          <line x1={cx} y1={cy} x2={cx} y2={cy - 8} stroke="#f59e0b" strokeWidth={1.5} />
          <line x1={cx} y1={cy} x2={cx + 6} y2={cy + 3} stroke="#f59e0b" strokeWidth={1.5} />
          <text x={cx} y={cy + 32} textAnchor="middle" fontSize={11} fill="#374151">{label}</text>
        </g>
      );

    case "messageEvent":
      return (
        <g key={node.id}>
          <circle cx={cx} cy={cy} r={18} fill="#dbeafe" stroke="#3b82f6" strokeWidth={strokeWidth} />
          <rect x={cx - 9} y={cy - 6} width={18} height={12} rx={1} fill="none" stroke="#3b82f6" strokeWidth={1.2} />
          <polyline points={`${cx - 9},${cy - 6} ${cx},${cy + 1} ${cx + 9},${cy - 6}`} fill="none" stroke="#3b82f6" strokeWidth={1.2} />
          <text x={cx} y={cy + 32} textAnchor="middle" fontSize={11} fill="#374151">{label}</text>
        </g>
      );

    case "task":
    case "userTask":
    case "serviceTask":
      const taskFill = type === "userTask" ? "#eff6ff" : type === "serviceTask" ? "#f0fdf4" : "#fff";
      const taskStroke = type === "userTask" ? "#3b82f6" : type === "serviceTask" ? "#22c55e" : strokeColor;
      const iconChar = type === "userTask" ? "👤" : type === "serviceTask" ? "⚙️" : "";
      return (
        <g key={node.id}>
          <rect x={x} y={y} width={width} height={height} rx={8} fill={taskFill}
            stroke={taskStroke} strokeWidth={strokeWidth} filter="url(#shadow)" />
          {iconChar && (
            <text x={x + 8} y={y + 16} fontSize={12}>{iconChar}</text>
          )}
          <text x={cx} y={cy + 4} textAnchor="middle" fontSize={12} fill="#1f2937" fontWeight="500">
            {label.length > 18 ? label.slice(0, 18) + "…" : label}
          </text>
        </g>
      );

    case "subProcess":
      return (
        <g key={node.id}>
          <rect x={x} y={y} width={width} height={height} rx={8} fill="#faf5ff"
            stroke="#8b5cf6" strokeWidth={strokeWidth} strokeDasharray="6 3" filter="url(#shadow)" />
          <text x={cx} y={cy + 4} textAnchor="middle" fontSize={12} fill="#1f2937" fontWeight="500">
            {label.length > 20 ? label.slice(0, 20) + "…" : label}
          </text>
          <rect x={cx - 6} y={y + height - 14} width={12} height={8} rx={1} fill="none" stroke="#8b5cf6" strokeWidth={1} />
          <line x1={cx} y1={y + height - 14} x2={cx} y2={y + height - 6} stroke="#8b5cf6" strokeWidth={1} />
        </g>
      );

    case "exclusiveGateway":
    case "parallelGateway":
    case "inclusiveGateway": {
      const gFill = type === "exclusiveGateway" ? "#fef9c3" : type === "parallelGateway" ? "#cffafe" : "#fce7f3";
      const gStroke = type === "exclusiveGateway" ? "#eab308" : type === "parallelGateway" ? "#06b6d4" : "#ec4899";
      return (
        <g key={node.id}>
          <polygon
            points={`${cx},${y} ${x + width},${cy} ${cx},${y + height} ${x},${cy}`}
            fill={gFill} stroke={gStroke} strokeWidth={strokeWidth}
          />
          {type === "exclusiveGateway" && (
            <>
              <line x1={cx - 8} y1={cy - 8} x2={cx + 8} y2={cy + 8} stroke={gStroke} strokeWidth={2.5} />
              <line x1={cx + 8} y1={cy - 8} x2={cx - 8} y2={cy + 8} stroke={gStroke} strokeWidth={2.5} />
            </>
          )}
          {type === "parallelGateway" && (
            <>
              <line x1={cx} y1={cy - 10} x2={cx} y2={cy + 10} stroke={gStroke} strokeWidth={2.5} />
              <line x1={cx - 10} y1={cy} x2={cx + 10} y2={cy} stroke={gStroke} strokeWidth={2.5} />
            </>
          )}
          {type === "inclusiveGateway" && (
            <circle cx={cx} cy={cy} r={10} fill="none" stroke={gStroke} strokeWidth={2.5} />
          )}
          <text x={cx} y={cy + height / 2 + 16} textAnchor="middle" fontSize={11} fill="#374151">{label}</text>
        </g>
      );
    }

    default:
      return null;
  }
}

function getConnectionPoint(node: BpmnNode, side: "left" | "right" | "top" | "bottom") {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  switch (side) {
    case "right": return { x: node.x + node.width, y: cy };
    case "left": return { x: node.x, y: cy };
    case "bottom": return { x: cx, y: node.y + node.height };
    case "top": return { x: cx, y: node.y };
  }
}

function getBestConnectionPoints(source: BpmnNode, target: BpmnNode) {
  const scx = source.x + source.width / 2;
  const scy = source.y + source.height / 2;
  const tcx = target.x + target.width / 2;
  const tcy = target.y + target.height / 2;

  const dx = tcx - scx;
  const dy = tcy - scy;

  let sourceSide: "left" | "right" | "top" | "bottom";
  let targetSide: "left" | "right" | "top" | "bottom";

  if (Math.abs(dx) > Math.abs(dy)) {
    sourceSide = dx > 0 ? "right" : "left";
    targetSide = dx > 0 ? "left" : "right";
  } else {
    sourceSide = dy > 0 ? "bottom" : "top";
    targetSide = dy > 0 ? "top" : "bottom";
  }

  return {
    source: getConnectionPoint(source, sourceSide),
    target: getConnectionPoint(target, targetSide),
  };
}

// ═══════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════

interface BpmnDiagramProps {
  initialData?: BpmnDiagramData;
  onSave?: (data: BpmnDiagramData) => void;
  processName?: string;
}

export default function BpmnDiagram({ initialData, onSave, processName }: BpmnDiagramProps) {
  const [nodes, setNodes] = useState<BpmnNode[]>(initialData?.nodes || []);
  const [connections, setConnections] = useState<BpmnConnection[]>(initialData?.connections || []);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const [mode, setMode] = useState<"select" | "connect">("select");

  const generateId = () => `bpmn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const addNode = useCallback((type: BpmnElementType) => {
    const size = DEFAULT_SIZES[type];
    const newNode: BpmnNode = {
      id: generateId(),
      type,
      x: 200 + Math.random() * 300,
      y: 100 + Math.random() * 200,
      width: size.w,
      height: size.h,
      label: BPMN_PALETTE.flatMap(c => c.items).find(i => i.type === type)?.label || type,
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
  }, []);

  const deleteSelected = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes(prev => prev.filter(n => n.id !== selectedNodeId));
    setConnections(prev => prev.filter(c => c.sourceId !== selectedNodeId && c.targetId !== selectedNodeId));
    setSelectedNodeId(null);
  }, [selectedNodeId]);

  const handleSvgMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const target = e.target as SVGElement;
    const nodeG = target.closest("[data-node-id]");

    if (nodeG) {
      const nodeId = nodeG.getAttribute("data-node-id")!;
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;

      if (mode === "connect") {
        if (!connectingFrom) {
          setConnectingFrom(nodeId);
        } else if (connectingFrom !== nodeId) {
          const exists = connections.some(
            c => (c.sourceId === connectingFrom && c.targetId === nodeId)
          );
          if (!exists) {
            setConnections(prev => [...prev, {
              id: generateId(),
              sourceId: connectingFrom,
              targetId: nodeId,
            }]);
          }
          setConnectingFrom(null);
        }
        return;
      }

      setSelectedNodeId(nodeId);
      const svgRect = svgRef.current!.getBoundingClientRect();
      const mouseX = (e.clientX - svgRect.left - pan.x) / zoom;
      const mouseY = (e.clientY - svgRect.top - pan.y) / zoom;
      setDragging({ nodeId, offsetX: mouseX - node.x, offsetY: mouseY - node.y });
    } else {
      setSelectedNodeId(null);
      setConnectingFrom(null);
    }
  }, [nodes, mode, connectingFrom, connections, zoom, pan]);

  const handleSvgMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const svgRect = svgRef.current!.getBoundingClientRect();
    const mouseX = (e.clientX - svgRect.left - pan.x) / zoom;
    const mouseY = (e.clientY - svgRect.top - pan.y) / zoom;
    setNodes(prev => prev.map(n =>
      n.id === dragging.nodeId
        ? { ...n, x: Math.max(0, mouseX - dragging.offsetX), y: Math.max(0, mouseY - dragging.offsetY) }
        : n
    ));
  }, [dragging, zoom, pan]);

  const handleSvgMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handleLabelChange = useCallback((nodeId: string, newLabel: string) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, label: newLabel } : n));
  }, []);

  const handleSave = useCallback(() => {
    onSave?.({ nodes, connections });
  }, [nodes, connections, onSave]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (editingLabel) return;
        deleteSelected();
      }
      if (e.key === "Escape") {
        setSelectedNodeId(null);
        setConnectingFrom(null);
        setMode("select");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteSelected, editingLabel]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden bg-white" data-testid="bpmn-diagram">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-3 py-2 bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{processName || "Diagramador BPMN"}</span>
          <Badge variant="outline" className="text-xs">{nodes.length} elementos</Badge>
          <Badge variant="outline" className="text-xs">{connections.length} conexões</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={mode === "select" ? "default" : "ghost"}
            size="sm"
            onClick={() => { setMode("select"); setConnectingFrom(null); }}
            data-testid="btn-mode-select"
          >
            <Move className="h-4 w-4" />
          </Button>
          <Button
            variant={mode === "connect" ? "default" : "ghost"}
            size="sm"
            onClick={() => setMode("connect")}
            data-testid="btn-mode-connect"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
          <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.min(2, z + 0.1))} data-testid="btn-zoom-in">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <span className="text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} data-testid="btn-zoom-out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={resetView}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
          {selectedNodeId && (
            <Button variant="ghost" size="sm" onClick={deleteSelected} className="text-red-500" data-testid="btn-delete">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="default" size="sm" onClick={handleSave} data-testid="btn-save-bpmn">
            <Save className="h-4 w-4 mr-1" /> Salvar
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Painel lateral de elementos */}
        <div className="w-48 border-r bg-muted/20 overflow-y-auto p-2" data-testid="bpmn-palette">
          {BPMN_PALETTE.map(category => (
            <div key={category.category} className="mb-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">
                {category.category}
              </p>
              {category.items.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors text-left"
                    onClick={() => addNode(item.type)}
                    data-testid={`palette-${item.type}`}
                  >
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}

          {mode === "connect" && (
            <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
              Modo conexão: clique no elemento de origem e depois no destino.
            </div>
          )}
          {connectingFrom && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
              Conectando de: {nodes.find(n => n.id === connectingFrom)?.label}
            </div>
          )}
        </div>

        {/* Canvas SVG */}
        <div className="flex-1 relative overflow-hidden bg-[#fafbfc]">
          <svg
            ref={svgRef}
            className="w-full h-full cursor-crosshair"
            onMouseDown={handleSvgMouseDown}
            onMouseMove={handleSvgMouseMove}
            onMouseUp={handleSvgMouseUp}
            onMouseLeave={handleSvgMouseUp}
            data-testid="bpmn-canvas"
          >
            <defs>
              <filter id="shadow" x="-4%" y="-4%" width="108%" height="108%">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.1" />
              </filter>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
              </marker>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.5" fill="#e2e8f0" />
              </pattern>
            </defs>

            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {/* Grid */}
              <rect width="4000" height="4000" fill="url(#grid)" />

              {/* Conexões */}
              {connections.map(conn => {
                const source = nodes.find(n => n.id === conn.sourceId);
                const target = nodes.find(n => n.id === conn.targetId);
                if (!source || !target) return null;

                const pts = getBestConnectionPoints(source, target);
                const midX = (pts.source.x + pts.target.x) / 2;
                const midY = (pts.source.y + pts.target.y) / 2;

                return (
                  <g key={conn.id}>
                    <path
                      d={`M ${pts.source.x} ${pts.source.y} C ${midX} ${pts.source.y}, ${midX} ${pts.target.y}, ${pts.target.x} ${pts.target.y}`}
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth={1.5}
                      markerEnd="url(#arrowhead)"
                    />
                    {conn.label && (
                      <text x={midX} y={midY - 6} textAnchor="middle" fontSize={10} fill="#64748b">
                        {conn.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Nós */}
              {nodes.map(node => (
                <g
                  key={node.id}
                  data-node-id={node.id}
                  style={{ cursor: mode === "connect" ? "crosshair" : "grab" }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingLabel(node.id);
                    setSelectedNodeId(node.id);
                  }}
                >
                  {renderBpmnElement(node, selectedNodeId === node.id, connectingFrom === node.id)}

                  {/* Pontos de conexão ao selecionar */}
                  {selectedNodeId === node.id && mode === "select" && (
                    <>
                      {(["left", "right", "top", "bottom"] as const).map(side => {
                        const pt = getConnectionPoint(node, side);
                        return (
                          <circle key={side} cx={pt.x} cy={pt.y} r={4} fill="#3b82f6" stroke="white" strokeWidth={1.5} />
                        );
                      })}
                    </>
                  )}
                </g>
              ))}
            </g>
          </svg>
        </div>

        {/* Painel de propriedades */}
        {selectedNode && (
          <div className="w-56 border-l bg-muted/20 p-3 overflow-y-auto" data-testid="bpmn-properties">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Propriedades</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Nome</label>
                <Input
                  value={selectedNode.label}
                  onChange={(e) => handleLabelChange(selectedNode.id, e.target.value)}
                  className="h-8 text-sm"
                  data-testid="input-node-label"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Tipo</label>
                <Badge variant="outline" className="mt-1 block w-fit">
                  {BPMN_PALETTE.flatMap(c => c.items).find(i => i.type === selectedNode.type)?.label || selectedNode.type}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">X</label>
                  <Input value={Math.round(selectedNode.x)} readOnly className="h-7 text-xs" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Y</label>
                  <Input value={Math.round(selectedNode.y)} readOnly className="h-7 text-xs" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Conexões</label>
                <div className="mt-1 space-y-1">
                  {connections
                    .filter(c => c.sourceId === selectedNode.id || c.targetId === selectedNode.id)
                    .map(c => {
                      const other = c.sourceId === selectedNode.id
                        ? nodes.find(n => n.id === c.targetId)
                        : nodes.find(n => n.id === c.sourceId);
                      const dir = c.sourceId === selectedNode.id ? "→" : "←";
                      return (
                        <div key={c.id} className="flex items-center justify-between text-xs bg-muted rounded px-2 py-1">
                          <span>{dir} {other?.label || "?"}</span>
                          <button
                            className="text-red-400 hover:text-red-600"
                            onClick={() => setConnections(prev => prev.filter(cc => cc.id !== c.id))}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  {connections.filter(c => c.sourceId === selectedNode.id || c.targetId === selectedNode.id).length === 0 && (
                    <p className="text-xs text-muted-foreground">Sem conexões</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
