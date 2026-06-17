import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Play,
  Save,
  Trash2,
  Edit,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  PlugZap,
  Code,
  FileJson,
} from "lucide-react";

interface ApiConnection {
  id: number;
  name: string;
  type: string;
  base_url: string;
  api_key?: string;
  status: string;
  last_sync_at?: string;
}

interface ApiEndpoint {
  id: number;
  connection_id: number;
  name: string;
  method: string;
  path: string;
  description?: string;
  headers?: Record<string, string>;
  body_template?: string;
}

interface ApiLog {
  id: number;
  method: string;
  url: string;
  response_status: number;
  latency_ms: number;
  created_at: string;
}

export default function ApiTester() {
  const queryClient = useQueryClient();
  const [showNewConnectionDialog, setShowNewConnectionDialog] = useState(false);
  const [showNewEndpointDialog, setShowNewEndpointDialog] = useState(false);
  const [showExecuteDialog, setShowExecuteDialog] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<ApiConnection | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  
  const [newConnection, setNewConnection] = useState({
    name: "",
    type: "rest",
    baseUrl: "",
    apiKey: "",
    apiSecret: "",
  });
  
  const [newEndpoint, setNewEndpoint] = useState({
    name: "",
    method: "GET",
    path: "",
    description: "",
    bodyTemplate: "",
  });
  
  const [executeRequest, setExecuteRequest] = useState({
    method: "GET",
    url: "",
    headers: "{}",
    body: "",
  });
  
  const [executeResponse, setExecuteResponse] = useState<{
    status?: number;
    body?: string;
    latency?: number;
    error?: string;
  } | null>(null);

  const { data: connections = [] } = useQuery<ApiConnection[]>({
    queryKey: ["/api/api-central/connections"],
    queryFn: async () => {
      const res = await fetch("/api/api-central/connections", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: endpoints = [] } = useQuery<ApiEndpoint[]>({
    queryKey: ["/api/api-central/endpoints", selectedConnection?.id],
    queryFn: async () => {
      if (!selectedConnection) return [];
      const res = await fetch(`/api/api-central/connections/${selectedConnection.id}/endpoints`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedConnection,
  });

  const { data: logs = [] } = useQuery<ApiLog[]>({
    queryKey: ["/api/api-central/logs"],
    queryFn: async () => {
      const res = await fetch("/api/api-central/logs?limit=20", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createConnectionMutation = useMutation({
    mutationFn: async (data: typeof newConnection) => {
      const res = await fetch("/api/api-central/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          type: data.type,
          baseUrl: data.baseUrl,
          apiKey: data.apiKey,
          apiSecret: data.apiSecret,
        }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao criar conexão");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-central/connections"] });
      setShowNewConnectionDialog(false);
      setNewConnection({ name: "", type: "rest", baseUrl: "", apiKey: "", apiSecret: "" });
    },
  });

  const deleteConnectionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/api-central/connections/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao deletar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-central/connections"] });
      setSelectedConnection(null);
    },
  });

  const createEndpointMutation = useMutation({
    mutationFn: async (data: typeof newEndpoint) => {
      if (!selectedConnection) throw new Error("Selecione uma conexão");
      const res = await fetch(`/api/api-central/connections/${selectedConnection.id}/endpoints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao criar endpoint");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-central/endpoints", selectedConnection?.id] });
      setShowNewEndpointDialog(false);
      setNewEndpoint({ name: "", method: "GET", path: "", description: "", bodyTemplate: "" });
    },
  });

  const executeMutation = useMutation({
    mutationFn: async (data: typeof executeRequest) => {
      const res = await fetch("/api/api-central/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: selectedConnection?.id,
          method: data.method,
          url: data.url,
          headers: JSON.parse(data.headers || "{}"),
          body: data.body ? JSON.parse(data.body) : undefined,
        }),
        credentials: "include",
      });
      return res.json();
    },
    onSuccess: (result) => {
      setExecuteResponse({
        status: result.status,
        body: result.body,
        latency: result.latency,
        error: result.error,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/api-central/logs"] });
    },
    onError: (error: any) => {
      setExecuteResponse({ error: error.message });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/api-central/connections/${id}/test`, {
        method: "POST",
        credentials: "include",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-central/connections"] });
    },
  });

  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET": return "bg-green-500/20 text-green-400";
      case "POST": return "bg-blue-500/20 text-blue-400";
      case "PUT": return "bg-amber-500/20 text-amber-400";
      case "DELETE": return "bg-red-500/20 text-red-400";
      default: return "bg-slate-500/20 text-slate-400";
    }
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "bg-green-500/20 text-green-400";
    if (status >= 400) return "bg-red-500/20 text-red-400";
    return "bg-amber-500/20 text-amber-400";
  };

  return (
    <div className="h-full flex bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Sidebar - Conexões */}
      <div className="w-72 border-r border-slate-700/50 flex flex-col">
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <PlugZap className="h-5 w-5 text-cyan-400" />
              Minhas Conexões
            </h2>
            <Button 
              size="sm" 
              className="bg-cyan-600 hover:bg-cyan-700 h-8"
              onClick={() => setShowNewConnectionDialog(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {connections.map((conn) => (
              <div
                key={conn.id}
                onClick={() => setSelectedConnection(conn)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedConnection?.id === conn.id
                    ? "bg-cyan-500/20 border border-cyan-500/30"
                    : "hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate">{conn.name}</span>
                  <div className={`w-2 h-2 rounded-full ${
                    conn.status === "connected" ? "bg-green-500" : "bg-slate-500"
                  }`} />
                </div>
                <p className="text-xs text-slate-500 truncate mt-1">{conn.base_url}</p>
              </div>
            ))}
            {connections.length === 0 && (
              <div className="text-center text-slate-500 py-8">
                <PlugZap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma conexão</p>
                <p className="text-xs">Clique em + para adicionar</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {selectedConnection ? (
          <Tabs defaultValue="endpoints" className="flex-1 flex flex-col">
            <div className="p-4 border-b border-slate-700/50">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-xl font-bold">{selectedConnection.name}</h2>
                  <p className="text-sm text-slate-400">{selectedConnection.base_url}</p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="border-slate-600"
                    onClick={() => testConnectionMutation.mutate(selectedConnection.id)}
                    disabled={testConnectionMutation.isPending}
                  >
                    {testConnectionMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Testar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                    onClick={() => {
                      if (confirm("Deletar esta conexão?")) {
                        deleteConnectionMutation.mutate(selectedConnection.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <TabsList className="bg-slate-800">
                <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
                <TabsTrigger value="execute">Executar</TabsTrigger>
                <TabsTrigger value="logs">Logs</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="endpoints" className="flex-1 p-4 mt-0 overflow-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Endpoints Salvos</h3>
                <Button 
                  size="sm" 
                  className="bg-cyan-600 hover:bg-cyan-700"
                  onClick={() => setShowNewEndpointDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Novo Endpoint
                </Button>
              </div>
              <div className="space-y-2">
                {endpoints.map((endpoint) => (
                  <Card key={endpoint.id} className="bg-slate-800/50 border-slate-700">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge className={getMethodColor(endpoint.method)}>
                          {endpoint.method}
                        </Badge>
                        <code className="text-cyan-300 text-sm">{endpoint.path}</code>
                        {endpoint.name && (
                          <span className="text-slate-400 text-sm">- {endpoint.name}</span>
                        )}
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => {
                          setExecuteRequest({
                            method: endpoint.method,
                            url: selectedConnection.base_url + endpoint.path,
                            headers: JSON.stringify(endpoint.headers || {}, null, 2),
                            body: endpoint.body_template || "",
                          });
                          setShowExecuteDialog(true);
                        }}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Executar
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {endpoints.length === 0 && (
                  <div className="text-center text-slate-500 py-12">
                    <Code className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum endpoint salvo</p>
                    <p className="text-sm">Adicione endpoints para reutilizar</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="execute" className="flex-1 p-4 mt-0 overflow-auto">
              <div className="grid grid-cols-2 gap-4 h-full">
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <select
                      value={executeRequest.method}
                      onChange={(e) => setExecuteRequest({ ...executeRequest, method: e.target.value })}
                      className="bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white w-28"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                      <option value="PATCH">PATCH</option>
                    </select>
                    <Input
                      value={executeRequest.url}
                      onChange={(e) => setExecuteRequest({ ...executeRequest, url: e.target.value })}
                      placeholder="https://api.exemplo.com/endpoint"
                      className="flex-1 bg-slate-800 border-slate-700 text-white"
                    />
                    <Button 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => executeMutation.mutate(executeRequest)}
                      disabled={executeMutation.isPending}
                    >
                      {executeMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 mb-1 block">Headers (JSON)</label>
                    <Textarea
                      value={executeRequest.headers}
                      onChange={(e) => setExecuteRequest({ ...executeRequest, headers: e.target.value })}
                      placeholder='{"Authorization": "Bearer token"}'
                      className="bg-slate-800 border-slate-700 text-white font-mono text-sm h-24"
                    />
                  </div>
                  {executeRequest.method !== "GET" && (
                    <div>
                      <label className="text-sm text-slate-400 mb-1 block">Body (JSON)</label>
                      <Textarea
                        value={executeRequest.body}
                        onChange={(e) => setExecuteRequest({ ...executeRequest, body: e.target.value })}
                        placeholder='{"key": "value"}'
                        className="bg-slate-800 border-slate-700 text-white font-mono text-sm h-32"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-slate-400">Resposta</label>
                    {executeResponse?.status && (
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(executeResponse.status)}>
                          {executeResponse.status}
                        </Badge>
                        <span className="text-xs text-slate-500">{executeResponse.latency}ms</span>
                      </div>
                    )}
                  </div>
                  <div className="bg-slate-950 rounded-lg p-4 h-[calc(100%-2rem)] overflow-auto font-mono text-sm">
                    {executeResponse?.body ? (
                      <pre className="text-green-400 whitespace-pre-wrap">{executeResponse.body}</pre>
                    ) : executeResponse?.error ? (
                      <pre className="text-red-400">{executeResponse.error}</pre>
                    ) : (
                      <span className="text-slate-500">Execute uma requisição para ver a resposta</span>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="logs" className="flex-1 p-4 mt-0 overflow-auto">
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className="p-3 rounded-lg bg-slate-800/50 flex items-center gap-3">
                      <span className="text-slate-500 text-xs w-20">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </span>
                      <Badge className={getStatusColor(log.response_status)}>
                        {log.response_status}
                      </Badge>
                      <Badge className={getMethodColor(log.method)}>
                        {log.method}
                      </Badge>
                      <span className="text-slate-300 text-sm truncate flex-1">{log.url}</span>
                      <span className="text-slate-500 text-xs">{log.latency_ms}ms</span>
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <div className="text-center text-slate-500 py-12">
                      <FileJson className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Nenhum log ainda</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <PlugZap className="h-16 w-16 mx-auto mb-4 text-slate-600" />
              <h2 className="text-xl font-semibold mb-2">API Tester</h2>
              <p className="text-slate-400 mb-6">
                Crie conexões e teste APIs em tempo real
              </p>
              <Button 
                className="bg-cyan-600 hover:bg-cyan-700"
                onClick={() => setShowNewConnectionDialog(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Conexão
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dialog: Nova Conexão */}
      <Dialog open={showNewConnectionDialog} onOpenChange={setShowNewConnectionDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Nova Conexão de API</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Nome</label>
              <Input
                value={newConnection.name}
                onChange={(e) => setNewConnection({ ...newConnection, name: e.target.value })}
                placeholder="Minha API"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">URL Base</label>
              <Input
                value={newConnection.baseUrl}
                onChange={(e) => setNewConnection({ ...newConnection, baseUrl: e.target.value })}
                placeholder="https://api.exemplo.com"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">API Key (opcional)</label>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={newConnection.apiKey}
                  onChange={(e) => setNewConnection({ ...newConnection, apiKey: e.target.value })}
                  placeholder="sua-api-key"
                  className="bg-slate-800 border-slate-700 text-white pr-10"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewConnectionDialog(false)}>
              Cancelar
            </Button>
            <Button 
              className="bg-cyan-600 hover:bg-cyan-700"
              onClick={() => createConnectionMutation.mutate(newConnection)}
              disabled={createConnectionMutation.isPending || !newConnection.name || !newConnection.baseUrl}
            >
              {createConnectionMutation.isPending ? "Criando..." : "Criar Conexão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Novo Endpoint */}
      <Dialog open={showNewEndpointDialog} onOpenChange={setShowNewEndpointDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Novo Endpoint</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="w-28">
                <label className="text-sm text-slate-400 mb-1 block">Método</label>
                <select
                  value={newEndpoint.method}
                  onChange={(e) => setNewEndpoint({ ...newEndpoint, method: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-sm text-slate-400 mb-1 block">Path</label>
                <Input
                  value={newEndpoint.path}
                  onChange={(e) => setNewEndpoint({ ...newEndpoint, path: e.target.value })}
                  placeholder="/users"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Nome (opcional)</label>
              <Input
                value={newEndpoint.name}
                onChange={(e) => setNewEndpoint({ ...newEndpoint, name: e.target.value })}
                placeholder="Listar usuários"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Descrição (opcional)</label>
              <Input
                value={newEndpoint.description}
                onChange={(e) => setNewEndpoint({ ...newEndpoint, description: e.target.value })}
                placeholder="Retorna todos os usuários do sistema"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewEndpointDialog(false)}>
              Cancelar
            </Button>
            <Button 
              className="bg-cyan-600 hover:bg-cyan-700"
              onClick={() => createEndpointMutation.mutate(newEndpoint)}
              disabled={createEndpointMutation.isPending || !newEndpoint.path}
            >
              {createEndpointMutation.isPending ? "Criando..." : "Criar Endpoint"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
