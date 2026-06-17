import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Search,
  Globe,
  Key,
  Zap,
  Database,
  RefreshCw,
  Settings,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  Code,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  Edit,
  PlugZap,
  Server,
  FileJson,
  Send,
} from "lucide-react";

interface ApiConnection {
  id: number;
  name: string;
  type: string;
  baseUrl: string;
  status: "connected" | "disconnected" | "error";
  lastSync?: string;
  description?: string;
  icon?: string;
}

interface ApiEndpoint {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  description: string;
  params?: { name: string; type: string; required: boolean }[];
}

const DEMO_CONNECTIONS: ApiConnection[] = [
  { id: 1, name: "Frappe ERPNext", type: "frappe", baseUrl: "https://erp.arcadia.io", status: "disconnected", description: "ERP e CRM integrado" },
  { id: 2, name: "OpenAI GPT-4", type: "openai", baseUrl: "https://api.openai.com", status: "connected", lastSync: "2 min atrás", description: "IA para chat e análise" },
  { id: 3, name: "WhatsApp Business", type: "whatsapp", baseUrl: "wss://web.whatsapp.com", status: "connected", lastSync: "online", description: "Mensagens e atendimento" },
  { id: 4, name: "Stripe Payments", type: "stripe", baseUrl: "https://api.stripe.com", status: "disconnected", description: "Processamento de pagamentos" },
  { id: 5, name: "SEFAZ NFe", type: "sefaz", baseUrl: "https://nfe.fazenda.gov.br", status: "disconnected", description: "Emissão de notas fiscais" },
];

const DEMO_ENDPOINTS: Record<string, ApiEndpoint[]> = {
  frappe: [
    { id: "1", method: "GET", path: "/api/resource/Customer", description: "Listar clientes", params: [{ name: "limit_page_length", type: "number", required: false }] },
    { id: "2", method: "GET", path: "/api/resource/Item", description: "Listar produtos", params: [{ name: "filters", type: "json", required: false }] },
    { id: "3", method: "POST", path: "/api/resource/Sales Order", description: "Criar pedido de venda", params: [{ name: "data", type: "json", required: true }] },
    { id: "4", method: "GET", path: "/api/method/frappe.auth.get_logged_user", description: "Usuário logado", params: [] },
  ],
  openai: [
    { id: "1", method: "POST", path: "/v1/chat/completions", description: "Chat com GPT", params: [{ name: "model", type: "string", required: true }, { name: "messages", type: "array", required: true }] },
    { id: "2", method: "POST", path: "/v1/embeddings", description: "Gerar embeddings", params: [{ name: "input", type: "string", required: true }, { name: "model", type: "string", required: true }] },
  ],
  whatsapp: [
    { id: "1", method: "POST", path: "/send", description: "Enviar mensagem", params: [{ name: "to", type: "string", required: true }, { name: "message", type: "string", required: true }] },
    { id: "2", method: "GET", path: "/contacts", description: "Listar contatos", params: [] },
  ],
  stripe: [
    { id: "1", method: "POST", path: "/v1/charges", description: "Criar cobrança", params: [{ name: "amount", type: "number", required: true }, { name: "currency", type: "string", required: true }] },
    { id: "2", method: "GET", path: "/v1/customers", description: "Listar clientes", params: [] },
  ],
  sefaz: [
    { id: "1", method: "POST", path: "/nfe/autorizacao", description: "Autorizar NFe", params: [{ name: "xml", type: "string", required: true }] },
    { id: "2", method: "GET", path: "/nfe/consulta", description: "Consultar NFe", params: [{ name: "chave", type: "string", required: true }] },
  ],
};

export default function ApiCentralModule() {
  const [selectedConnection, setSelectedConnection] = useState<ApiConnection | null>(null);
  const [showNewConnectionDialog, setShowNewConnectionDialog] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testEndpoint, setTestEndpoint] = useState<ApiEndpoint | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [testResponse, setTestResponse] = useState<string>("");
  const [testLoading, setTestLoading] = useState(false);
  
  const [newConnection, setNewConnection] = useState({
    name: "",
    type: "rest",
    baseUrl: "",
    apiKey: "",
    apiSecret: "",
  });

  const filteredConnections = DEMO_CONNECTIONS.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected": return "bg-green-500";
      case "disconnected": return "bg-slate-500";
      case "error": return "bg-red-500";
      default: return "bg-slate-500";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected": return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Conectado</Badge>;
      case "disconnected": return <Badge variant="outline" className="text-slate-400">Desconectado</Badge>;
      case "error": return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Erro</Badge>;
      default: return <Badge variant="outline">Desconhecido</Badge>;
    }
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET": return "bg-green-500/20 text-green-400";
      case "POST": return "bg-blue-500/20 text-blue-400";
      case "PUT": return "bg-amber-500/20 text-amber-400";
      case "DELETE": return "bg-red-500/20 text-red-400";
      case "PATCH": return "bg-purple-500/20 text-purple-400";
      default: return "bg-slate-500/20 text-slate-400";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "frappe": return <Database className="h-5 w-5 text-blue-400" />;
      case "openai": return <Zap className="h-5 w-5 text-green-400" />;
      case "whatsapp": return <Globe className="h-5 w-5 text-emerald-400" />;
      case "stripe": return <Key className="h-5 w-5 text-purple-400" />;
      case "sefaz": return <FileJson className="h-5 w-5 text-amber-400" />;
      default: return <Server className="h-5 w-5 text-slate-400" />;
    }
  };

  const handleTestEndpoint = async () => {
    if (!testEndpoint || !selectedConnection) return;
    setTestLoading(true);
    setTestResponse("");
    
    await new Promise(r => setTimeout(r, 1000));
    
    const mockResponses: Record<string, any> = {
      "GET /api/resource/Customer": {
        data: [
          { name: "CUST-0001", customer_name: "Empresa ABC Ltda", territory: "Brasil" },
          { name: "CUST-0002", customer_name: "Comércio XYZ", territory: "Brasil" },
        ]
      },
      "POST /v1/chat/completions": {
        choices: [{ message: { content: "Olá! Como posso ajudar?" } }],
        usage: { total_tokens: 42 }
      },
    };
    
    const key = `${testEndpoint.method} ${testEndpoint.path}`;
    const response = mockResponses[key] || { success: true, message: "Endpoint executado com sucesso" };
    setTestResponse(JSON.stringify(response, null, 2));
    setTestLoading(false);
  };

  return (
    <div className="h-full flex bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Sidebar - Lista de Conexões */}
      <div className="w-80 border-r border-slate-700/50 flex flex-col">
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PlugZap className="h-5 w-5 text-cyan-400" />
              <h2 className="font-semibold text-white">Central de APIs</h2>
            </div>
            <Button 
              size="sm" 
              className="bg-cyan-600 hover:bg-cyan-700"
              onClick={() => setShowNewConnectionDialog(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Nova
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar conexões..."
              className="pl-9 bg-slate-800/50 border-slate-700 text-white"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredConnections.map((connection) => (
              <div
                key={connection.id}
                onClick={() => setSelectedConnection(connection)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedConnection?.id === connection.id
                    ? "bg-cyan-500/20 border border-cyan-500/30"
                    : "hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-800">
                    {getTypeIcon(connection.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-white truncate">{connection.name}</h3>
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(connection.status)}`} />
                    </div>
                    <p className="text-xs text-slate-500 truncate">{connection.baseUrl}</p>
                    {connection.lastSync && (
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        {connection.lastSync}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {selectedConnection ? (
          <>
            {/* Header */}
            <div className="p-6 border-b border-slate-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-slate-800">
                    {getTypeIcon(selectedConnection.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl font-bold text-white">{selectedConnection.name}</h1>
                      {getStatusBadge(selectedConnection.status)}
                    </div>
                    <p className="text-slate-400">{selectedConnection.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="border-slate-600 text-slate-300">
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Sincronizar
                  </Button>
                  <Button variant="outline" size="sm" className="border-slate-600 text-slate-300">
                    <Settings className="h-4 w-4 mr-1" />
                    Configurar
                  </Button>
                  {selectedConnection.status === "disconnected" ? (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700">
                      <Zap className="h-4 w-4 mr-1" />
                      Conectar
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10">
                      Desconectar
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="endpoints" className="flex-1 flex flex-col">
              <div className="px-6 border-b border-slate-700/50">
                <TabsList className="bg-transparent border-b-0">
                  <TabsTrigger value="endpoints" className="data-[state=active]:bg-slate-800">
                    <Code className="h-4 w-4 mr-2" />
                    Endpoints
                  </TabsTrigger>
                  <TabsTrigger value="credentials" className="data-[state=active]:bg-slate-800">
                    <Key className="h-4 w-4 mr-2" />
                    Credenciais
                  </TabsTrigger>
                  <TabsTrigger value="logs" className="data-[state=active]:bg-slate-800">
                    <FileJson className="h-4 w-4 mr-2" />
                    Logs
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="endpoints" className="flex-1 p-6 mt-0">
                <div className="grid gap-3">
                  {(DEMO_ENDPOINTS[selectedConnection.type] || []).map((endpoint) => (
                    <Card key={endpoint.id} className="bg-slate-800/50 border-slate-700/50">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge className={getMethodColor(endpoint.method)}>
                              {endpoint.method}
                            </Badge>
                            <code className="text-sm text-cyan-300 font-mono">{endpoint.path}</code>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-slate-400 hover:text-white"
                              onClick={() => {
                                setTestEndpoint(endpoint);
                                setShowTestDialog(true);
                                setTestResponse("");
                              }}
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Testar
                            </Button>
                            <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white">
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-slate-400 mt-2">{endpoint.description}</p>
                        {endpoint.params && endpoint.params.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {endpoint.params.map((param, i) => (
                              <Badge key={i} variant="outline" className="text-xs text-slate-400">
                                {param.name}: {param.type}
                                {param.required && <span className="text-red-400 ml-1">*</span>}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="credentials" className="flex-1 p-6 mt-0">
                <Card className="bg-slate-800/50 border-slate-700/50 max-w-xl">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Key className="h-5 w-5 text-amber-400" />
                      Credenciais de Acesso
                    </CardTitle>
                    <CardDescription>
                      Configure as credenciais para autenticação na API
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm text-slate-400 mb-1 block">URL Base</label>
                      <Input
                        value={selectedConnection.baseUrl}
                        readOnly
                        className="bg-slate-900 border-slate-700 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400 mb-1 block">API Key</label>
                      <div className="relative">
                        <Input
                          type={showApiKey ? "text" : "password"}
                          value="sk-demo-xxxx-xxxx-xxxx"
                          readOnly
                          className="bg-slate-900 border-slate-700 text-white pr-10"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                          onClick={() => setShowApiKey(!showApiKey)}
                        >
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-4">
                      <div className="flex items-center gap-2">
                        <Switch id="auto-refresh" />
                        <label htmlFor="auto-refresh" className="text-sm text-slate-300">
                          Renovar token automaticamente
                        </label>
                      </div>
                      <Button variant="outline" size="sm" className="border-slate-600">
                        Atualizar Credenciais
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="logs" className="flex-1 p-6 mt-0">
                <Card className="bg-slate-800/50 border-slate-700/50">
                  <CardHeader>
                    <CardTitle className="text-white">Logs de Requisições</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2 font-mono text-sm">
                        <div className="p-2 rounded bg-slate-900/50 flex items-center gap-3">
                          <span className="text-slate-500">14:32:15</span>
                          <Badge className="bg-green-500/20 text-green-400">200</Badge>
                          <span className="text-slate-300">GET /api/resource/Customer</span>
                          <span className="text-slate-500 ml-auto">42ms</span>
                        </div>
                        <div className="p-2 rounded bg-slate-900/50 flex items-center gap-3">
                          <span className="text-slate-500">14:31:02</span>
                          <Badge className="bg-green-500/20 text-green-400">200</Badge>
                          <span className="text-slate-300">POST /v1/chat/completions</span>
                          <span className="text-slate-500 ml-auto">1.2s</span>
                        </div>
                        <div className="p-2 rounded bg-slate-900/50 flex items-center gap-3">
                          <span className="text-slate-500">14:28:45</span>
                          <Badge className="bg-red-500/20 text-red-400">401</Badge>
                          <span className="text-slate-300">GET /api/resource/Item</span>
                          <span className="text-slate-500 ml-auto">89ms</span>
                        </div>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <PlugZap className="h-10 w-10 text-slate-600" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Central de APIs</h2>
              <p className="text-slate-400 mb-6 max-w-md">
                Gerencie todas as conexões com APIs externas. Conecte-se a ERPs, 
                serviços de IA, gateways de pagamento e muito mais.
              </p>
              <Button 
                className="bg-cyan-600 hover:bg-cyan-700"
                onClick={() => setShowNewConnectionDialog(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Conexão
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dialog: Nova Conexão */}
      <Dialog open={showNewConnectionDialog} onOpenChange={setShowNewConnectionDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-cyan-400" />
              Nova Conexão de API
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Nome da Conexão</label>
              <Input
                value={newConnection.name}
                onChange={(e) => setNewConnection({ ...newConnection, name: e.target.value })}
                placeholder="Meu ERP"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Tipo</label>
              <select
                value={newConnection.type}
                onChange={(e) => setNewConnection({ ...newConnection, type: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-white"
              >
                <option value="rest">REST API</option>
                <option value="frappe">Frappe/ERPNext</option>
                <option value="graphql">GraphQL</option>
                <option value="soap">SOAP/XML</option>
              </select>
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
              <label className="text-sm text-slate-400 mb-1 block">API Key</label>
              <Input
                type="password"
                value={newConnection.apiKey}
                onChange={(e) => setNewConnection({ ...newConnection, apiKey: e.target.value })}
                placeholder="Sua chave de API"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">API Secret (opcional)</label>
              <Input
                type="password"
                value={newConnection.apiSecret}
                onChange={(e) => setNewConnection({ ...newConnection, apiSecret: e.target.value })}
                placeholder="Seu secret"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewConnectionDialog(false)}>
              Cancelar
            </Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700">
              <Zap className="h-4 w-4 mr-1" />
              Conectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Testar Endpoint */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-green-400" />
              Testar Endpoint
            </DialogTitle>
          </DialogHeader>
          {testEndpoint && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
                <Badge className={getMethodColor(testEndpoint.method)}>
                  {testEndpoint.method}
                </Badge>
                <code className="text-cyan-300 font-mono flex-1">{testEndpoint.path}</code>
              </div>
              
              {testEndpoint.params && testEndpoint.params.length > 0 && (
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">Parâmetros</label>
                  <div className="space-y-2">
                    {testEndpoint.params.map((param, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <label className="text-sm text-slate-300 w-32">{param.name}</label>
                        <Input
                          placeholder={`${param.type}${param.required ? " (obrigatório)" : ""}`}
                          className="bg-slate-800 border-slate-700 text-white flex-1"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-slate-400">Resposta</label>
                  {testLoading && <RefreshCw className="h-4 w-4 animate-spin text-cyan-400" />}
                </div>
                <div className="bg-slate-950 rounded-lg p-4 font-mono text-sm min-h-[200px] max-h-[300px] overflow-auto">
                  {testResponse ? (
                    <pre className="text-green-400">{testResponse}</pre>
                  ) : (
                    <span className="text-slate-500">Clique em "Executar" para ver a resposta</span>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowTestDialog(false)}>
              Fechar
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={handleTestEndpoint}
              disabled={testLoading}
            >
              <Send className="h-4 w-4 mr-1" />
              {testLoading ? "Executando..." : "Executar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
