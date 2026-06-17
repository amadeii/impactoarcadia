import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, Database, FileJson, ArrowRight, Check, X, AlertCircle, 
  RefreshCw, Play, Eye, Settings, Trash2, Download, Loader2
} from "lucide-react";

interface MigrationJob {
  id: number;
  name: string;
  sourceType: string;
  sourceSystem: string;
  status: string;
  fileName: string;
  fileSize: number;
  totalRecords: number;
  importedRecords: number;
  failedRecords: number;
  analysisResult: any;
  createdAt: string;
}

interface MigrationMapping {
  id: number;
  jobId: number;
  sourceEntity: string;
  targetEntity: string;
  fieldMappings: Record<string, string>;
  isEnabled: boolean;
  recordCount: number;
  importedCount: number;
}

interface TargetEntity {
  id: string;
  name: string;
  description: string;
  module?: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-gray-500",
  analyzing: "bg-blue-500",
  mapping: "bg-yellow-500",
  importing: "bg-purple-500",
  completed: "bg-green-500",
  failed: "bg-red-500"
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  analyzing: "Analisando",
  mapping: "Mapeando",
  importing: "Importando",
  completed: "Concluído",
  failed: "Falhou"
};

export default function Migration() {
  const [selectedJob, setSelectedJob] = useState<MigrationJob | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [previewCollection, setPreviewCollection] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading: loadingJobs } = useQuery<MigrationJob[]>({
    queryKey: ["/api/migration/jobs"],
  });

  const { data: tenants = [] } = useQuery<{ id: number; name: string; slug: string }[]>({
    queryKey: ["/api/tenants"],
  });

  const { data: entities = [] } = useQuery<TargetEntity[]>({
    queryKey: ["/api/migration/entities"],
  });

  const { data: jobDetails, refetch: refetchJob } = useQuery<MigrationJob & { mappings: MigrationMapping[] }>({
    queryKey: ["/api/migration/jobs", selectedJob?.id],
    enabled: !!selectedJob?.id,
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/migration/upload", {
        method: "POST",
        body: formData
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Upload concluído", description: "Backup enviado e analisado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/migration/jobs"] });
      setSelectedJob(data);
      setUploadFile(null);
      setUploadName("");
    },
    onError: (error: any) => {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
    }
  });

  const importMutation = useMutation({
    mutationFn: async (jobId: number) => {
      const res = await fetch(`/api/migration/jobs/${jobId}/import`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Importação concluída", description: "Dados importados com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/migration/jobs"] });
      refetchJob();
    },
    onError: (error: any) => {
      toast({ title: "Erro na importação", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (jobId: number) => {
      const res = await fetch(`/api/migration/jobs/${jobId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Job excluído" });
      queryClient.invalidateQueries({ queryKey: ["/api/migration/jobs"] });
      setSelectedJob(null);
    }
  });

  const updateMappingsMutation = useMutation({
    mutationFn: async ({ jobId, mappings }: { jobId: number; mappings: MigrationMapping[] }) => {
      const res = await fetch(`/api/migration/jobs/${jobId}/mappings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Mapeamentos atualizados" });
      refetchJob();
    }
  });

  const reimportMutation = useMutation({
    mutationFn: async ({ jobId, mappingId }: { jobId: number; mappingId: number }) => {
      const res = await fetch(`/api/migration/jobs/${jobId}/reimport/${mappingId}`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Reimportação concluída", 
        description: `${data.result.imported} registros importados, ${data.result.failed} falhas` 
      });
      refetchJob();
      queryClient.invalidateQueries({ queryKey: ["/api/migration/jobs"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro na reimportação", description: error.message, variant: "destructive" });
    }
  });

  const handleUpload = () => {
    if (!uploadFile) return;
    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("name", uploadName || `Migração ${new Date().toLocaleDateString('pt-BR')}`);
    if (selectedTenantId) formData.append("tenantId", selectedTenantId);
    uploadMutation.mutate(formData);
  };

  const handlePreview = async (collection: string) => {
    if (!selectedJob) return;
    try {
      const res = await fetch(`/api/migration/jobs/${selectedJob.id}/preview/${collection}?limit=5`);
      const data = await res.json();
      setPreviewCollection(collection);
      setPreviewData(data.documents || []);
    } catch (error) {
      toast({ title: "Erro ao carregar preview", variant: "destructive" });
    }
  };

  const toggleMapping = (mapping: MigrationMapping) => {
    if (!jobDetails) return;
    const updated = jobDetails.mappings.map(m => 
      m.id === mapping.id ? { ...m, isEnabled: !m.isEnabled } : m
    );
    updateMappingsMutation.mutate({ jobId: jobDetails.id, mappings: updated });
  };

  const changeTargetEntity = (mapping: MigrationMapping, newTarget: string) => {
    if (!jobDetails) return;
    const updated = jobDetails.mappings.map(m => 
      m.id === mapping.id ? { ...m, targetEntity: newTarget } : m
    );
    updateMappingsMutation.mutate({ jobId: jobDetails.id, mappings: updated });
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6" data-testid="migration-page">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Migração de Dados</h1>
            <p className="text-gray-500 mt-1">Importe dados de sistemas legados para o Arcádia Suite</p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button data-testid="btn-new-migration">
                <Upload className="w-4 h-4 mr-2" />
                Nova Migração
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Upload de Backup</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Nome da migração</Label>
                  <Input 
                    placeholder="Ex: Backup sistema antigo" 
                    value={uploadName}
                    onChange={e => setUploadName(e.target.value)}
                    data-testid="input-migration-name"
                  />
                </div>
                <div>
                  <Label>Empresa/Tenant (destino dos dados)</Label>
                  <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                    <SelectTrigger data-testid="select-tenant">
                      <SelectValue placeholder="Selecione a empresa..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map(t => (
                        <SelectItem key={t.id} value={t.id.toString()}>
                          {t.name} {t.slug ? `(${t.slug})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Arquivo de backup</Label>
                  <div className="mt-2 border-2 border-dashed rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept=".zip,.json,.csv"
                      className="hidden"
                      id="backup-file"
                      onChange={e => setUploadFile(e.target.files?.[0] || null)}
                      data-testid="input-backup-file"
                    />
                    <label htmlFor="backup-file" className="cursor-pointer">
                      <Upload className="w-10 h-10 mx-auto text-gray-400" />
                      <p className="mt-2 text-sm text-gray-500">
                        {uploadFile ? uploadFile.name : "Clique para selecionar"}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">ZIP (MongoDB), JSON ou CSV</p>
                    </label>
                  </div>
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleUpload}
                  disabled={!uploadFile || uploadMutation.isPending}
                  data-testid="btn-upload"
                >
                  {uploadMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                  ) : (
                    <><Upload className="w-4 h-4 mr-2" /> Enviar e Analisar</>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Jobs de Migração</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  {loadingJobs ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : jobs.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Nenhuma migração encontrada</p>
                      <p className="text-sm">Faça upload de um backup para começar</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {jobs.map(job => (
                        <div
                          key={job.id}
                          onClick={() => setSelectedJob(job)}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedJob?.id === job.id 
                              ? "border-blue-500 bg-blue-50" 
                              : "hover:bg-gray-50"
                          }`}
                          data-testid={`job-item-${job.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate">{job.name}</span>
                            <Badge className={statusColors[job.status]}>
                              {statusLabels[job.status]}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                            <FileJson className="w-3 h-3" />
                            <span>{job.fileName}</span>
                            <span>•</span>
                            <span>{formatBytes(job.fileSize)}</span>
                          </div>
                          {job.status === "completed" && (
                            <div className="mt-2">
                              <Progress 
                                value={(job.importedRecords / (job.totalRecords || 1)) * 100} 
                                className="h-1"
                              />
                              <span className="text-xs text-gray-500">
                                {job.importedRecords}/{job.totalRecords} registros
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="col-span-8">
            {selectedJob && jobDetails ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{jobDetails.name}</CardTitle>
                      <CardDescription>
                        {jobDetails.sourceSystem} • {jobDetails.totalRecords} registros
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {jobDetails.status === "mapping" && (
                        <Button 
                          onClick={() => importMutation.mutate(jobDetails.id)}
                          disabled={importMutation.isPending}
                          data-testid="btn-start-import"
                        >
                          {importMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4 mr-2" />
                          )}
                          Iniciar Importação
                        </Button>
                      )}
                      <Button 
                        variant="destructive" 
                        size="icon"
                        onClick={() => deleteMutation.mutate(jobDetails.id)}
                        data-testid="btn-delete-job"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="collections">
                    <TabsList>
                      <TabsTrigger value="collections">Coleções</TabsTrigger>
                      <TabsTrigger value="mappings">Mapeamentos</TabsTrigger>
                      <TabsTrigger value="logs">Logs</TabsTrigger>
                    </TabsList>

                    <TabsContent value="collections" className="mt-4">
                      <ScrollArea className="h-[500px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Coleção</TableHead>
                              <TableHead className="text-right">Registros</TableHead>
                              <TableHead>Campos</TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {jobDetails.analysisResult?.collections?.map((col: any) => (
                              <TableRow key={col.name}>
                                <TableCell className="font-medium">{col.name}</TableCell>
                                <TableCell className="text-right">{col.count}</TableCell>
                                <TableCell>
                                  <span className="text-xs text-gray-500">
                                    {col.fields?.slice(0, 5).join(", ")}
                                    {col.fields?.length > 5 && ` +${col.fields.length - 5}`}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={() => handlePreview(col.name)}
                                    data-testid={`btn-preview-${col.name}`}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="mappings" className="mt-4">
                      <ScrollArea className="h-[500px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Ativo</TableHead>
                              <TableHead>Origem</TableHead>
                              <TableHead></TableHead>
                              <TableHead>Destino</TableHead>
                              <TableHead className="text-right">Registros</TableHead>
                              <TableHead className="text-right">Importados</TableHead>
                              <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {jobDetails.mappings?.map((mapping) => (
                              <TableRow key={mapping.id}>
                                <TableCell>
                                  <Switch
                                    checked={mapping.isEnabled}
                                    onCheckedChange={() => toggleMapping(mapping)}
                                    data-testid={`switch-mapping-${mapping.id}`}
                                  />
                                </TableCell>
                                <TableCell className="font-medium">{mapping.sourceEntity}</TableCell>
                                <TableCell>
                                  <ArrowRight className="w-4 h-4 text-gray-400" />
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={mapping.targetEntity}
                                    onValueChange={(v) => changeTargetEntity(mapping, v)}
                                  >
                                    <SelectTrigger className="w-[180px]" data-testid={`select-target-${mapping.id}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[300px]">
                                      {Object.entries(
                                        entities.reduce((acc, e) => {
                                          const mod = e.module || 'Outros';
                                          if (!acc[mod]) acc[mod] = [];
                                          acc[mod].push(e);
                                          return acc;
                                        }, {} as Record<string, TargetEntity[]>)
                                      ).map(([module, items]) => (
                                        <SelectGroup key={module}>
                                          <SelectLabel className="text-xs font-semibold text-muted-foreground">{module}</SelectLabel>
                                          {items.map(e => (
                                            <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                                          ))}
                                        </SelectGroup>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="text-right">{mapping.recordCount}</TableCell>
                                <TableCell className="text-right">
                                  {mapping.importedCount > 0 && (
                                    <Badge variant="outline" className="bg-green-50">
                                      {mapping.importedCount}
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={reimportMutation.isPending}
                                    onClick={() => reimportMutation.mutate({ jobId: jobDetails.id, mappingId: mapping.id })}
                                    data-testid={`btn-reimport-${mapping.id}`}
                                    title="Reimportar registros"
                                  >
                                    <RefreshCw className={`w-4 h-4 ${reimportMutation.isPending ? 'animate-spin' : ''}`} />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="logs" className="mt-4">
                      <div className="h-[500px] bg-gray-900 rounded-lg p-4 overflow-auto">
                        <pre className="text-sm text-gray-300 font-mono">
                          {jobDetails.status === "completed" 
                            ? `✓ Migração concluída com sucesso\n` +
                              `  Importados: ${jobDetails.importedRecords}\n` +
                              `  Falhas: ${jobDetails.failedRecords}`
                            : "Aguardando importação..."}
                        </pre>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ) : (
              <Card className="h-full flex items-center justify-center">
                <div className="text-center text-gray-500 py-20">
                  <Database className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">Selecione um job de migração</p>
                  <p className="text-sm">ou crie um novo para começar</p>
                </div>
              </Card>
            )}
          </div>
        </div>

        <Dialog open={!!previewCollection} onOpenChange={() => setPreviewCollection(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Preview: {previewCollection}</DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[60vh]">
              <div className="space-y-4">
                {previewData.map((doc, i) => (
                  <Card key={i}>
                    <CardContent className="pt-4">
                      <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto">
                        {JSON.stringify(doc, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
