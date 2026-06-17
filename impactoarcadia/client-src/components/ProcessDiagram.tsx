import { useCallback, useState, useEffect } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  Edge,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Save, Trash2, Circle, Square, Diamond, ArrowRight } from "lucide-react";

interface ProcessDiagramProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  initialViewport?: { x: number; y: number; zoom: number };
  onSave?: (nodes: Node[], edges: Edge[], viewport: { x: number; y: number; zoom: number }) => void;
  readOnly?: boolean;
}

const nodeTypes = {
  start: { label: "Início", color: "#22c55e", icon: Circle },
  end: { label: "Fim", color: "#ef4444", icon: Circle },
  process: { label: "Processo", color: "#3b82f6", icon: Square },
  decision: { label: "Decisão", color: "#f59e0b", icon: Diamond },
  subprocess: { label: "Subprocesso", color: "#8b5cf6", icon: Square },
};

export function ProcessDiagram({ initialNodes = [], initialEdges = [], initialViewport, onSave, readOnly = false }: ProcessDiagramProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [showAddNodeDialog, setShowAddNodeDialog] = useState(false);
  const [newNodeData, setNewNodeData] = useState({ label: "", type: "process" });
  const [viewport, setViewport] = useState(initialViewport || { x: 0, y: 0, zoom: 1 });

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    if (initialViewport) {
      setViewport(initialViewport);
    } else {
      setViewport({ x: 0, y: 0, zoom: 1 });
    }
  }, [initialNodes, initialEdges, initialViewport, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, type: "smoothstep" }, eds)),
    [setEdges]
  );

  const handleAddNode = () => {
    if (!newNodeData.label.trim()) return;

    const nodeConfig = nodeTypes[newNodeData.type as keyof typeof nodeTypes];
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: "default",
      position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
      data: { 
        label: newNodeData.label,
        nodeType: newNodeData.type,
      },
      style: {
        background: nodeConfig.color,
        color: "#fff",
        border: "none",
        borderRadius: newNodeData.type === "decision" ? "0" : newNodeData.type === "start" || newNodeData.type === "end" ? "50%" : "8px",
        padding: "16px",
        minWidth: "120px",
        textAlign: "center" as const,
        transform: newNodeData.type === "decision" ? "rotate(45deg)" : undefined,
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setNewNodeData({ label: "", type: "process" });
    setShowAddNodeDialog(false);
  };

  const handleDeleteSelected = () => {
    setNodes((nds) => nds.filter((node) => !node.selected));
    setEdges((eds) => eds.filter((edge) => !edge.selected));
  };

  const handleSave = () => {
    if (onSave) {
      onSave(nodes, edges, viewport);
    }
  };

  return (
    <div className="w-full h-[500px] border rounded-lg overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        onViewportChange={setViewport}
        defaultViewport={initialViewport || { x: 0, y: 0, zoom: 1 }}
        fitView={!initialViewport}
        snapToGrid
        snapGrid={[15, 15]}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        
        {!readOnly && (
          <Panel position="top-left" className="flex gap-2">
            <Button size="sm" onClick={() => setShowAddNodeDialog(true)} data-testid="btn-add-node">
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
            <Button size="sm" variant="outline" onClick={handleDeleteSelected} data-testid="btn-delete-node">
              <Trash2 className="h-4 w-4 mr-1" /> Excluir
            </Button>
            <Button size="sm" onClick={handleSave} data-testid="btn-save-diagram">
              <Save className="h-4 w-4 mr-1" /> Salvar
            </Button>
          </Panel>
        )}
      </ReactFlow>

      <Dialog open={showAddNodeDialog} onOpenChange={setShowAddNodeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Elemento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <Select value={newNodeData.type} onValueChange={(value) => setNewNodeData({ ...newNodeData, type: value })}>
                <SelectTrigger data-testid="select-node-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(nodeTypes).map(([key, { label, color }]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                        {label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome</Label>
              <Input
                value={newNodeData.label}
                onChange={(e) => setNewNodeData({ ...newNodeData, label: e.target.value })}
                placeholder="Nome do elemento"
                data-testid="input-node-label"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddNodeDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddNode} data-testid="btn-confirm-add-node">
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
