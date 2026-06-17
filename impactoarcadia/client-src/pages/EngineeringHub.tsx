import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Beaker, MapPin, Droplets, Shield, Star, FileText,
  ArrowRight, CheckCircle2, Clock, AlertTriangle, RefreshCw, Link2
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ModuleCard {
  id: string;
  name: string;
  description: string;
  route: string;
  icon: React.ReactNode;
  color: string;
  stats: { label: string; value: string | number; status?: string }[];
}

const modules: ModuleCard[] = [
  {
    id: "quality",
    name: "Qualidade (ISO 17025)",
    description: "Amostras, laudos laboratoriais, RNC, documentos QMS, matriz de treinamentos e homologação de fornecedores",
    route: "/quality",
    icon: <Beaker className="h-8 w-8" />,
    color: "from-green-500 to-emerald-700",
    stats: [
      { label: "Amostras Ativas", value: 47, status: "normal" },
      { label: "Laudos Pendentes", value: 12, status: "warning" },
      { label: "RNCs Abertas", value: 3, status: "alert" },
    ],
  },
  {
    id: "field-ops",
    name: "Operações de Campo",
    description: "Programação de campanhas, equipes, permissões de trabalho, hospedagem e controle de veículos",
    route: "/field-ops",
    icon: <MapPin className="h-8 w-8" />,
    color: "from-blue-500 to-indigo-700",
    stats: [
      { label: "Campanhas Ativas", value: 8, status: "normal" },
      { label: "Equipes em Campo", value: 4, status: "normal" },
      { label: "PTs Vencendo", value: 2, status: "warning" },
    ],
  },
  {
    id: "commercial",
    name: "Comercial Ambiental",
    description: "Propostas, catálogo de serviços, projetos e integração com clientes do ERP",
    route: "/commercial-env",
    icon: <FileText className="h-8 w-8" />,
    color: "from-amber-500 to-orange-700",
    stats: [
      { label: "Propostas Abertas", value: 15, status: "normal" },
      { label: "Em Negociação", value: 6, status: "normal" },
      { label: "Aprovadas (Mês)", value: 4, status: "success" },
    ],
  },
  {
    id: "technical",
    name: "Técnico",
    description: "Poços de monitoramento, planos de amostragem, métodos analíticos e equipamentos de campo",
    route: "/technical",
    icon: <Droplets className="h-8 w-8" />,
    color: "from-teal-500 to-cyan-700",
    stats: [
      { label: "Poços Ativos", value: 156, status: "normal" },
      { label: "Planos Ativos", value: 23, status: "normal" },
      { label: "Calibrações Vencidas", value: 5, status: "alert" },
    ],
  },
  {
    id: "suppliers",
    name: "Portal de Fornecedores",
    description: "Cadastro, homologação, documentos e alertas de fornecedores e laboratórios",
    route: "/suppliers",
    icon: <Shield className="h-8 w-8" />,
    color: "from-indigo-500 to-purple-700",
    stats: [
      { label: "Homologados", value: 18, status: "normal" },
      { label: "Pendentes", value: 4, status: "warning" },
      { label: "Vencidos", value: 2, status: "alert" },
    ],
  },
  {
    id: "nps",
    name: "NPS e Satisfação",
    description: "Pesquisas de satisfação, respostas de clientes, análise de NPS e pontos de melhoria",
    route: "/nps",
    icon: <Star className="h-8 w-8" />,
    color: "from-yellow-500 to-orange-600",
    stats: [
      { label: "NPS Score", value: 50, status: "success" },
      { label: "Respostas (Mês)", value: 26, status: "normal" },
      { label: "Taxa Resposta", value: "74%", status: "normal" },
    ],
  },
];

export default function EngineeringHub() {
  const [, setLocation] = useLocation();

  const { data: erpStatus } = useQuery<{ connected: boolean; url?: string }>({
    queryKey: ["/api/erpnext/status"],
    retry: false,
  });

  const isErpConnected = erpStatus?.connected === true;

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case "warning":
        return <Clock className="h-3 w-3 text-yellow-500" />;
      case "alert":
        return <AlertTriangle className="h-3 w-3 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <BrowserFrame>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Central de Engenharia Ambiental</h1>
            <p className="text-muted-foreground text-lg">
              Módulos integrados para gestão de projetos ambientais com conformidade ISO 17025
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isErpConnected ? (
              <Badge className="bg-green-100 text-green-700 border-green-300 flex items-center gap-1.5 px-3 py-1.5">
                <Link2 className="h-3.5 w-3.5" />
                Sincronizado com Arcádia SOE
              </Badge>
            ) : (
              <Badge variant="secondary" className="flex items-center gap-1.5 px-3 py-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Arcádia SOE não conectado
              </Badge>
            )}
            <Button variant="outline" size="sm" data-testid="btn-refresh-engineering">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => (
            <Card
              key={module.id}
              className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1 group"
              onClick={() => setLocation(module.route)}
              data-testid={`module-card-${module.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-lg bg-gradient-to-br ${module.color} text-white`}>
                    {module.icon}
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <CardTitle className="text-lg mt-3">{module.name}</CardTitle>
                <CardDescription className="text-sm">{module.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {module.stats.map((stat, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        {getStatusIcon(stat.status)}
                        {stat.label}
                      </span>
                      <Badge
                        variant={stat.status === "alert" ? "destructive" : stat.status === "warning" ? "secondary" : "outline"}
                        className="font-medium"
                      >
                        {stat.value}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">Visão Geral do Segmento</CardTitle>
            <CardDescription>Impacto Geologia - Engenharia Ambiental e Serviços</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-green-600">156</div>
                <div className="text-sm text-muted-foreground">Poços Monitorados</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-blue-600">47</div>
                <div className="text-sm text-muted-foreground">Projetos Ativos</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-purple-600">18</div>
                <div className="text-sm text-muted-foreground">Labs Homologados</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-amber-600">50</div>
                <div className="text-sm text-muted-foreground">NPS Score</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </BrowserFrame>
  );
}
