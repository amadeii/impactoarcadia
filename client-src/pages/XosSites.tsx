import { useState } from "react";
import { Link } from "wouter";
import {
  LayoutGrid, ArrowLeft, Search, Plus, MoreVertical, Globe, Eye,
  Edit2, Copy, Trash2, ExternalLink, Settings, Palette, Code,
  Image, FileText, Layers, Monitor, Smartphone, Tablet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

interface Site {
  id: number;
  name: string;
  domain: string;
  status: string;
  template: string;
  pages: number;
  lastPublished: string;
  thumbnail: string;
}

export default function XosSites() {
  const [isNewSiteOpen, setIsNewSiteOpen] = useState(false);
  const [newSiteStep, setNewSiteStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const sites: Site[] = [
    {
      id: 1,
      name: "Landing Page Principal",
      domain: "arcadia.com.br",
      status: "published",
      template: "landing",
      pages: 5,
      lastPublished: new Date(Date.now() - 86400000).toISOString(),
      thumbnail: "/api/placeholder/300/200",
    },
    {
      id: 2,
      name: "Blog Corporativo",
      domain: "blog.arcadia.com.br",
      status: "published",
      template: "blog",
      pages: 12,
      lastPublished: new Date(Date.now() - 172800000).toISOString(),
      thumbnail: "/api/placeholder/300/200",
    },
    {
      id: 3,
      name: "Central de Ajuda",
      domain: "help.arcadia.com.br",
      status: "draft",
      template: "docs",
      pages: 8,
      lastPublished: "",
      thumbnail: "/api/placeholder/300/200",
    },
  ];

  const templates = [
    {
      id: "landing",
      name: "Landing Page",
      description: "Página de captura e conversão",
      icon: Layers,
      color: "from-blue-500 to-cyan-500",
    },
    {
      id: "blog",
      name: "Blog",
      description: "Artigos e conteúdo",
      icon: FileText,
      color: "from-green-500 to-emerald-500",
    },
    {
      id: "docs",
      name: "Documentação",
      description: "Central de ajuda e docs",
      icon: Code,
      color: "from-violet-500 to-purple-500",
    },
    {
      id: "portfolio",
      name: "Portfólio",
      description: "Showcase de trabalhos",
      icon: Image,
      color: "from-orange-500 to-red-500",
    },
    {
      id: "ecommerce",
      name: "E-commerce",
      description: "Loja virtual",
      icon: Globe,
      color: "from-pink-500 to-rose-500",
    },
    {
      id: "blank",
      name: "Em Branco",
      description: "Comece do zero",
      icon: LayoutGrid,
      color: "from-gray-400 to-gray-500",
    },
  ];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      published: "bg-green-100 text-green-700",
      draft: "bg-yellow-100 text-yellow-700",
      offline: "bg-gray-100 text-gray-700",
    };
    return colors[status] || colors.draft;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/xos">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-2 rounded-lg">
                <LayoutGrid className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Sites</h1>
                <p className="text-xs text-slate-500">Site Builder</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Buscar sites..." className="w-64 pl-10" data-testid="input-search" />
            </div>

            <Dialog open={isNewSiteOpen} onOpenChange={(open) => {
              setIsNewSiteOpen(open);
              if (!open) {
                setNewSiteStep(1);
                setSelectedTemplate("");
              }
            }}>
              <DialogTrigger asChild>
                <Button data-testid="button-new-site">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Site
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Criar Novo Site</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  {newSiteStep === 1 && (
                    <>
                      <p className="text-sm text-slate-500 mb-4">Escolha um template para começar:</p>
                      <div className="grid grid-cols-3 gap-4">
                        {templates.map((template) => (
                          <Card
                            key={template.id}
                            className={`cursor-pointer transition-all hover:shadow-md ${
                              selectedTemplate === template.id ? "ring-2 ring-cyan-500" : ""
                            }`}
                            onClick={() => setSelectedTemplate(template.id)}
                            data-testid={`template-${template.id}`}
                          >
                            <CardContent className="p-4 text-center">
                              <div className={`mx-auto w-12 h-12 rounded-xl bg-gradient-to-br ${template.color} flex items-center justify-center mb-3`}>
                                <template.icon className="h-6 w-6 text-white" />
                              </div>
                              <p className="font-medium text-slate-800">{template.name}</p>
                              <p className="text-xs text-slate-500 mt-1">{template.description}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                      {selectedTemplate && (
                        <div className="mt-6 space-y-4">
                          <div className="space-y-2">
                            <Label>Nome do Site</Label>
                            <Input placeholder="Meu Site Incrível" data-testid="input-site-name" />
                          </div>
                          <div className="space-y-2">
                            <Label>Subdomínio</Label>
                            <div className="flex">
                              <Input placeholder="meusite" className="rounded-r-none" data-testid="input-site-subdomain" />
                              <div className="px-3 bg-slate-100 border border-l-0 rounded-r-md flex items-center text-sm text-slate-500">
                                .arcadia.app
                              </div>
                            </div>
                          </div>
                          <Button className="w-full" data-testid="button-create-site">
                            <LayoutGrid className="h-4 w-4 mr-2" />
                            Criar Site
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="p-6">
        <Tabs defaultValue="all" className="mb-6">
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all">Todos</TabsTrigger>
            <TabsTrigger value="published" data-testid="tab-published">Publicados</TabsTrigger>
            <TabsTrigger value="draft" data-testid="tab-draft">Rascunhos</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sites.map((site) => (
            <Card key={site.id} className="overflow-hidden hover:shadow-lg transition-shadow" data-testid={`site-${site.id}`}>
              <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-200 relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Globe className="h-12 w-12 text-slate-300" />
                </div>
                <div className="absolute top-2 right-2">
                  <Badge className={getStatusColor(site.status)}>
                    {site.status === "published" ? "Publicado" : "Rascunho"}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-slate-800">{site.name}</h3>
                    <p className="text-sm text-slate-500 flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {site.domain}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem><Eye className="h-4 w-4 mr-2" /> Visualizar</DropdownMenuItem>
                      <DropdownMenuItem><Edit2 className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
                      <DropdownMenuItem><Settings className="h-4 w-4 mr-2" /> Configurações</DropdownMenuItem>
                      <DropdownMenuItem><Copy className="h-4 w-4 mr-2" /> Duplicar</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600">
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
                  <span>{site.pages} páginas</span>
                  {site.lastPublished && (
                    <span>Atualizado {new Date(site.lastPublished).toLocaleDateString("pt-BR")}</span>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Eye className="h-4 w-4 mr-1" />
                    Preview
                  </Button>
                  <Button size="sm" className="flex-1">
                    <Edit2 className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <Card className="border-dashed border-2 hover:border-cyan-500 hover:bg-cyan-50/50 transition-all cursor-pointer"
                onClick={() => setIsNewSiteOpen(true)}
                data-testid="card-new-site">
            <CardContent className="aspect-[4/3] flex flex-col items-center justify-center text-slate-400 hover:text-cyan-600">
              <Plus className="h-12 w-12 mb-2" />
              <p className="font-medium">Criar Novo Site</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Importar Site Existente
            </CardTitle>
            <CardDescription>
              Importe um site existente fornecendo a URL ou fazendo upload do HTML
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>URL do Site</Label>
                <div className="flex gap-2">
                  <Input placeholder="https://meusite.com" className="flex-1" data-testid="input-import-url" />
                  <Button variant="outline">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Importar
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Upload HTML/ZIP</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center text-slate-500 hover:border-cyan-500 hover:bg-cyan-50/50 cursor-pointer transition-all">
                  <Code className="h-6 w-6 mx-auto mb-2" />
                  <p className="text-sm">Arraste arquivos ou clique para selecionar</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
