import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MessageSquare, 
  Send, 
  Plus, 
  Trash2, 
  Bot,
  User,
  Loader2,
  Paperclip,
  FileText,
  X,
  Zap,
  Play,
  CheckCircle,
  XCircle,
  Brain,
  Wrench,
  Search,
  Database,
  Calculator,
  Calendar,
  Globe,
  Sparkles,
  MessageCircle,
  ChevronDown,
  ChevronRight,
  Download,
  FileDown,
  Table,
  Compass,
  FolderKanban,
  Pencil,
  Check,
  HelpCircle,
  ArrowRight,
  Network,
  Mail,
  BarChart3,
  Settings2,
  ThumbsUp,
  ThumbsDown,
  Eye,
  TrendingUp,
  Clock
} from "lucide-react";
import { CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";
import html2canvas from "html2canvas";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { ResultViewer } from "@/components/ResultViewer";
import DevHistory from "@/components/DevHistory";

interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'area';
  title: string;
  data: Record<string, any>[];
  xKey: string;
  yKeys: string[];
  colors: string[];
}

function parseChartData(text: string): ChartData | null {
  const match = text.match(/__CHART_DATA__([\s\S]*?)__END_CHART_DATA__/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }
  return null;
}

function MarkdownTable({ content }: { content: string }) {
  const lines = content.split('\n').filter(line => line.includes('|'));
  if (lines.length < 2) return null;

  const parseRow = (line: string) => 
    line.split('|').map(cell => cell.trim()).filter(cell => cell && !cell.match(/^-+$/));

  const headers = parseRow(lines[0]);
  const dataRows = lines.slice(2).map(parseRow).filter(row => row.length > 0);

  if (headers.length === 0) return null;

  return (
    <div className="overflow-x-auto my-4">
      <table className="min-w-full border-collapse border border-gray-300 rounded-lg overflow-hidden">
        <thead className="bg-[#1f334d]">
          <tr>
            {headers.map((header, idx) => (
              <th key={idx} className="px-4 py-3 text-left text-sm font-semibold text-white border-b border-gray-300">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, rowIdx) => (
            <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="px-4 py-3 text-sm text-[#1f334d] border-b border-gray-200">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RichTextRenderer({ content }: { content: string }) {
  const hasTable = content.includes('|') && content.split('\n').filter(l => l.includes('|')).length >= 2;
  
  if (!hasTable) {
    return <p className="text-[#1f334d] leading-relaxed whitespace-pre-wrap">{content}</p>;
  }

  const parts: React.ReactNode[] = [];
  const lines = content.split('\n');
  let currentText: string[] = [];
  let inTable = false;
  let tableLines: string[] = [];

  lines.forEach((line, idx) => {
    const isTableLine = line.includes('|') && line.trim().startsWith('|');
    
    if (isTableLine && !inTable) {
      if (currentText.length > 0) {
        parts.push(<p key={`text-${idx}`} className="text-[#1f334d] leading-relaxed whitespace-pre-wrap mb-3">{currentText.join('\n')}</p>);
        currentText = [];
      }
      inTable = true;
      tableLines = [line];
    } else if (isTableLine && inTable) {
      tableLines.push(line);
    } else if (!isTableLine && inTable) {
      parts.push(<MarkdownTable key={`table-${idx}`} content={tableLines.join('\n')} />);
      tableLines = [];
      inTable = false;
      if (line.trim()) currentText.push(line);
    } else {
      currentText.push(line);
    }
  });

  if (inTable && tableLines.length > 0) {
    parts.push(<MarkdownTable key="table-final" content={tableLines.join('\n')} />);
  }
  if (currentText.length > 0) {
    parts.push(<p key="text-final" className="text-[#1f334d] leading-relaxed whitespace-pre-wrap">{currentText.join('\n')}</p>);
  }

  return <>{parts}</>;
}

function ChartRenderer({ chart }: { chart: ChartData }) {
  const formatValue = (value: number) => {
    if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}K`;
    return `R$ ${value.toFixed(0)}`;
  };

  const renderChart = () => {
    switch (chart.type) {
      case 'bar':
        return (
          <BarChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={chart.xKey} />
            <YAxis tickFormatter={formatValue} />
            <Tooltip formatter={(value: number) => formatValue(value)} />
            <Legend />
            {chart.yKeys.map((key, idx) => (
              <Bar key={key} dataKey={key} fill={chart.colors[idx] || '#8884d8'} name={key} />
            ))}
          </BarChart>
        );
      case 'line':
        return (
          <LineChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={chart.xKey} />
            <YAxis tickFormatter={formatValue} />
            <Tooltip formatter={(value: number) => formatValue(value)} />
            <Legend />
            {chart.yKeys.map((key, idx) => (
              <Line key={key} type="monotone" dataKey={key} stroke={chart.colors[idx] || '#8884d8'} name={key} />
            ))}
          </LineChart>
        );
      case 'area':
        return (
          <AreaChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={chart.xKey} />
            <YAxis tickFormatter={formatValue} />
            <Tooltip formatter={(value: number) => formatValue(value)} />
            <Legend />
            {chart.yKeys.map((key, idx) => (
              <Area key={key} type="monotone" dataKey={key} fill={chart.colors[idx] || '#8884d8'} stroke={chart.colors[idx] || '#8884d8'} fillOpacity={0.3} name={key} />
            ))}
          </AreaChart>
        );
      case 'pie':
        return (
          <PieChart>
            <Pie
              data={chart.data}
              dataKey={chart.yKeys[0]}
              nameKey={chart.xKey}
              cx="50%"
              cy="50%"
              outerRadius={120}
              label={({ name, value }) => `${name}: ${formatValue(value)}`}
            >
              {chart.data.map((_, idx) => (
                <Cell key={`cell-${idx}`} fill={chart.colors[idx % chart.colors.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => formatValue(value)} />
            <Legend />
          </PieChart>
        );
      default:
        return <div>Tipo de gráfico não suportado</div>;
    }
  };

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200 my-4">
      <h3 className="text-lg font-semibold text-center mb-4">{chart.title}</h3>
      <ResponsiveContainer width="100%" height={350}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  interactionId?: number;
  feedback?: 'positive' | 'negative' | 'neutral' | null;
}

interface Conversation {
  id: number;
  title: string;
  userId: string;
  createdAt: string;
  messages?: Message[];
}

interface AttachedFile {
  name: string;
  content: string;
  base64?: string;
  isImage?: boolean;
  preview?: string;
}

interface ManusStep {
  id: number;
  stepNumber: number;
  thought: string | null;
  tool: string | null;
  toolInput: string | null;
  toolOutput: string | null;
  status: string | null;
  createdAt: string;
}

interface ManusRun {
  id: number;
  userId: string;
  prompt: string;
  status: string | null;
  result: string | null;
  createdAt: string;
  completedAt: string | null;
  steps?: ManusStep[];
}

async function fetchConversations(): Promise<Conversation[]> {
  const response = await fetch("/api/conversations", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch conversations");
  return response.json();
}

async function fetchConversation(id: number): Promise<Conversation> {
  const response = await fetch(`/api/conversations/${id}`, { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch conversation");
  return response.json();
}

async function createConversation(title: string = "Nova Conversa"): Promise<Conversation> {
  const response = await fetch("/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to create conversation");
  return response.json();
}

function generateConversationTitle(message: string): string {
  const cleanMessage = message.replace(/\[📎.*?\]\s*/g, "").trim();
  const words = cleanMessage.split(/\s+/).slice(0, 6).join(" ");
  if (words.length > 40) {
    return words.substring(0, 40) + "...";
  }
  return words || "Nova Conversa";
}

async function deleteConversation(id: number): Promise<void> {
  const response = await fetch(`/api/conversations/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to delete conversation");
}

async function updateConversation(id: number, title: string): Promise<Conversation> {
  const response = await fetch(`/api/conversations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to update conversation");
  return response.json();
}

async function fetchManusRuns(): Promise<ManusRun[]> {
  const response = await fetch("/api/manus/runs", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch runs");
  return response.json();
}

async function fetchManusRun(id: number): Promise<ManusRun> {
  const response = await fetch(`/api/manus/runs/${id}`, { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch run");
  return response.json();
}

async function startManusRun(data: { prompt: string; attachedFiles?: AttachedFile[]; conversationHistory?: Array<{role: string; content: string}> }): Promise<{ runId: number }> {
  const response = await fetch("/api/manus/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      prompt: data.prompt, 
      attachedFiles: data.attachedFiles,
      conversationHistory: data.conversationHistory
    }),
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to start run");
  return response.json();
}

const TOOL_NAMES: Record<string, string> = {
  web_search: "Pesquisa Web",
  web_browse: "Navegar Site",
  knowledge_query: "Base de Conhecimento",
  erp_query: "Consulta ERP",
  calculate: "Cálculo",
  send_message: "Enviar Mensagem",
  generate_report: "Gerar Relatório",
  schedule_task: "Agendar Tarefa",
  analyze_file: "Analisar Arquivo",
  finish: "Finalizar",
};

const TOOL_ICONS: Record<string, React.ReactNode> = {
  web_search: <Globe className="w-4 h-4" />,
  web_browse: <Globe className="w-4 h-4" />,
  knowledge_query: <Search className="w-4 h-4" />,
  erp_query: <Database className="w-4 h-4" />,
  calculate: <Calculator className="w-4 h-4" />,
  send_message: <MessageSquare className="w-4 h-4" />,
  generate_report: <FileText className="w-4 h-4" />,
  schedule_task: <Calendar className="w-4 h-4" />,
  analyze_file: <Paperclip className="w-4 h-4" />,
  finish: <CheckCircle className="w-4 h-4" />,
};

type ProcessingMode = "idle" | "thinking" | "using_tools";
type AgentMode = "chat" | "autonomous";

function StepCard({ step, isFinish, prompt }: { step: ManusStep; isFinish: boolean; prompt?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [showViewer, setShowViewer] = useState(false);

  const exportToPDF = async () => {
    if (!step.toolOutput) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    
    doc.setFontSize(16);
    doc.setTextColor(31, 51, 77);
    doc.text("Arcádia Agent - Resultado", margin, 20);
    
    let currentY = 30;
    
    if (prompt) {
      doc.setFontSize(10);
      doc.setTextColor(90, 108, 125);
      doc.text("Tarefa:", margin, currentY);
      currentY += 7;
      const promptLines = doc.splitTextToSize(prompt, maxWidth);
      doc.text(promptLines, margin, currentY);
      currentY += promptLines.length * 5 + 10;
    }
    
    doc.setFontSize(12);
    doc.setTextColor(31, 51, 77);
    doc.text("Resposta:", margin, currentY);
    currentY += 8;
    
    const textContent = step.toolOutput.replace(/__CHART_DATA__[\s\S]*?__END_CHART_DATA__/g, '').trim();
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(textContent, maxWidth);
    doc.text(lines, margin, currentY);
    currentY += lines.length * 5 + 10;
    
    const chartData = parseChartData(step.toolOutput);
    if (chartData) {
      const chartContainer = document.querySelector('[data-testid="step-final-response"] .recharts-wrapper');
      if (chartContainer) {
        try {
          const canvas = await html2canvas(chartContainer as HTMLElement, {
            backgroundColor: '#ffffff',
            scale: 2
          });
          const imgData = canvas.toDataURL('image/png');
          const imgWidth = maxWidth;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          
          if (currentY + imgHeight > doc.internal.pageSize.getHeight() - margin) {
            doc.addPage();
            currentY = margin;
          }
          
          doc.addImage(imgData, 'PNG', margin, currentY, imgWidth, imgHeight);
        } catch (e) {
          console.error('Error capturing chart:', e);
        }
      }
    }
    
    doc.save("arcadia-resultado.pdf");
  };

  const exportToWord = async () => {
    if (!step.toolOutput) return;
    
    const paragraphs = [];
    
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: "Arcádia Agent - Resultado", bold: true, size: 32 })],
      })
    );
    
    if (prompt) {
      paragraphs.push(
        new Paragraph({ children: [] }),
        new Paragraph({
          children: [new TextRun({ text: "Tarefa: ", bold: true }), new TextRun({ text: prompt })],
        })
      );
    }
    
    paragraphs.push(
      new Paragraph({ children: [] }),
      new Paragraph({
        children: [new TextRun({ text: "Resposta:", bold: true })],
      })
    );
    
    step.toolOutput.split("\n").forEach((line) => {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: line })] }));
    });
    
    const doc = new Document({
      sections: [{ properties: {}, children: paragraphs }],
    });
    
    const blob = await Packer.toBlob(doc);
    saveAs(blob, "arcadia-resultado.docx");
  };

  const exportToText = () => {
    if (!step.toolOutput) return;
    const content = prompt ? `Tarefa: ${prompt}\n\nResposta:\n${step.toolOutput}` : step.toolOutput;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    saveAs(blob, "arcadia-resultado.txt");
  };

  const exportToCSV = () => {
    if (!step.toolOutput) return;
    const lines = step.toolOutput.split("\n");
    let csvContent = "";
    
    for (const line of lines) {
      if (line.includes("|")) {
        const cells = line.split("|").map(cell => cell.trim()).filter(cell => cell && !cell.match(/^[-:]+$/));
        if (cells.length > 0) {
          csvContent += cells.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",") + "\n";
        }
      } else if (line.includes("\t")) {
        csvContent += line.split("\t").map(cell => `"${cell.trim().replace(/"/g, '""')}"`).join(",") + "\n";
      } else if (line.trim()) {
        csvContent += `"${line.replace(/"/g, '""')}"\n`;
      }
    }
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    saveAs(blob, "arcadia-resultado.csv");
  };

  const detectTableContent = () => {
    if (!step.toolOutput) return false;
    const lines = step.toolOutput.split("\n");
    let tableLines = 0;
    for (const line of lines) {
      if ((line.includes("|") && line.split("|").length >= 3) || 
          (line.includes("\t") && line.split("\t").length >= 2)) {
        tableLines++;
      }
    }
    return tableLines >= 2;
  };

  const hasTableContent = detectTableContent();

  if (isFinish) {
    return (
      <div className="bg-[#e8f5e9] border-l-4 border-[#4caf50] rounded-r-lg p-4" data-testid="step-final-response">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-[#4caf50]" />
            <span className="text-sm font-semibold text-[#2e7d32] uppercase tracking-wide">Resposta Final</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowViewer(true)}
              className="h-8 px-2 text-[#1565c0] hover:bg-[#e3f2fd]"
              title="Ver como documento"
              data-testid="button-view-document"
            >
              <Eye className="w-4 h-4 mr-1" />
              <span className="text-xs">Ver</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={exportToPDF}
              className="h-8 px-2 text-[#2e7d32] hover:bg-[#c8e6c9]"
              title="Baixar PDF"
              data-testid="button-export-pdf"
            >
              <FileDown className="w-4 h-4 mr-1" />
              <span className="text-xs">PDF</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={exportToWord}
              className="h-8 px-2 text-[#2e7d32] hover:bg-[#c8e6c9]"
              title="Baixar Word"
              data-testid="button-export-word"
            >
              <FileText className="w-4 h-4 mr-1" />
              <span className="text-xs">Word</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={exportToText}
              className="h-8 px-2 text-[#2e7d32] hover:bg-[#c8e6c9]"
              title="Baixar Texto"
              data-testid="button-export-text"
            >
              <Download className="w-4 h-4 mr-1" />
              <span className="text-xs">TXT</span>
            </Button>
            {hasTableContent && (
              <Button
                variant="ghost"
                size="sm"
                onClick={exportToCSV}
                className="h-8 px-2 text-[#2e7d32] hover:bg-[#c8e6c9]"
                title="Baixar CSV para importar no Sheets"
                data-testid="button-export-csv"
              >
                <Table className="w-4 h-4 mr-1" />
                <span className="text-xs">CSV</span>
              </Button>
            )}
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#c8e6c9]">
          {(() => {
            const chartData = step.toolOutput ? parseChartData(step.toolOutput) : null;
            const textContent = step.toolOutput?.replace(/__CHART_DATA__[\s\S]*?__END_CHART_DATA__/g, '').trim();
            return (
              <>
                {chartData && <ChartRenderer chart={chartData} />}
                {textContent && <RichTextRenderer content={textContent} />}
              </>
            );
          })()}
        </div>
        <ResultViewer
          isOpen={showViewer}
          onClose={() => setShowViewer(false)}
          title="Resultado - Arcádia Agent"
          sender="Arcadia Business Sistema Integrado de Gestão LTDA"
          content={step.toolOutput?.replace(/__CHART_DATA__[\s\S]*?__END_CHART_DATA__/g, '').trim() || ''}
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-[#e1e8f0] overflow-hidden" data-testid={`step-card-${step.stepNumber}`}>
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-[#f5f7fa] transition-colors"
        data-testid={`button-toggle-step-${step.stepNumber}`}
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-[#5a6c7d] shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[#5a6c7d] shrink-0" />
        )}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded-full bg-[#1f334d] flex items-center justify-center text-white text-xs font-medium">
            {step.stepNumber}
          </div>
          {step.tool && (
            <Badge variant="outline" className="text-[#5a6c7d] border-[#e1e8f0] text-xs">
              {TOOL_ICONS[step.tool] || <Wrench className="w-3 h-3" />}
              <span className="ml-1">{TOOL_NAMES[step.tool] || step.tool}</span>
            </Badge>
          )}
        </div>
        <p className="text-sm text-[#1f334d] flex-1 line-clamp-1">{step.thought}</p>
      </button>
      
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-[#e1e8f0] bg-[#fafbfc]">
          {step.thought && (
            <div className="mt-3">
              <p className="text-xs text-[#5a6c7d] font-medium mb-1">Raciocínio:</p>
              <p className="text-sm text-[#1f334d]">{step.thought}</p>
            </div>
          )}
          {step.toolInput && (
            <div className="mt-3">
              <p className="text-xs text-[#5a6c7d] font-medium mb-1">Entrada:</p>
              <pre className="text-xs text-[#5a6c7d] bg-white rounded p-2 border border-[#e1e8f0] overflow-x-auto">
                {step.toolInput}
              </pre>
            </div>
          )}
          {step.toolOutput && (
            <div className="mt-3">
              <p className="text-xs text-[#5a6c7d] font-medium mb-1">Resultado:</p>
              <div className="text-sm text-[#1f334d] bg-white rounded p-2 border border-[#e1e8f0] whitespace-pre-wrap">
                {(() => {
                  const chartData = parseChartData(step.toolOutput);
                  const textContent = step.toolOutput?.replace(/__CHART_DATA__[\s\S]*?__END_CHART_DATA__/g, '').trim();
                  return (
                    <>
                      {chartData && <ChartRenderer chart={chartData} />}
                      {textContent}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Agent() {
  const queryClient = useQueryClient();
  
  // Unified interface - auto-detects mode internally
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [isNewConversation, setIsNewConversation] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [processingMode, setProcessingMode] = useState<ProcessingMode>("idle");
  const [currentToolName, setCurrentToolName] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // For Manus execution when tools are needed
  const [autonomousInput, setAutonomousInput] = useState("");
  const [selectedRun, setSelectedRun] = useState<number | null>(null);
  const [autonomousFiles, setAutonomousFiles] = useState<AttachedFile[]>([]);
  const stepsEndRef = useRef<HTMLDivElement>(null);
  const autonomousFileInputRef = useRef<HTMLInputElement>(null);
  
  // Mode is now auto-detected, not manually selected
  const mode = "chat";
  const setMode = (_: any) => {};
  const [agentView, setAgentView] = useState<"chat" | "history">("chat");

  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  
  const [editingConversationId, setEditingConversationId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const { data: tenants = [] } = useQuery({
    queryKey: ["/api/compass/tenants"],
    queryFn: async () => {
      const res = await fetch("/api/compass/tenants", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["/api/compass/projects", selectedTenantId],
    queryFn: async () => {
      if (!selectedTenantId) return [];
      const res = await fetch(`/api/compass/projects?tenantId=${selectedTenantId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedTenantId,
  });

  const { data: conversations = [], isLoading: loadingConversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: fetchConversations,
  });

  const { data: currentConversation, isLoading: loadingMessages } = useQuery({
    queryKey: ["conversation", selectedConversation],
    queryFn: () => selectedConversation ? fetchConversation(selectedConversation) : null,
    enabled: !!selectedConversation,
  });

  const { data: manusRuns = [], isLoading: loadingRuns } = useQuery({
    queryKey: ["manus-runs"],
    queryFn: fetchManusRuns,
  });

  const { data: currentRun, isLoading: loadingRun } = useQuery({
    queryKey: ["manus-run", selectedRun],
    queryFn: () => selectedRun ? fetchManusRun(selectedRun) : null,
    enabled: !!selectedRun,
    refetchInterval: (query) => {
      const run = query.state.data as ManusRun | null | undefined;
      return run?.status === "running" ? 1500 : false;
    },
  });

  useEffect(() => {
    if (currentConversation?.messages) {
      setMessages(currentConversation.messages);
    }
  }, [currentConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  useEffect(() => {
    stepsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentRun?.steps]);

  const createMutation = useMutation({
    mutationFn: createConversation,
    onSuccess: (newConv) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setSelectedConversation(newConv.id);
      setMessages([]);
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: async ({ interactionId, feedback }: { interactionId: number; feedback: 'positive' | 'negative' }) => {
      const res = await fetch(`/api/learning/interactions/${interactionId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to save feedback');
      return res.json();
    },
    onSuccess: (_, variables) => {
      setMessages(prev => prev.map(msg => 
        msg.interactionId === variables.interactionId 
          ? { ...msg, feedback: variables.feedback }
          : msg
      ));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (selectedConversation) {
        setSelectedConversation(null);
        setMessages([]);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) => updateConversation(id, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setEditingConversationId(null);
      setEditingTitle("");
    },
  });

  const handleStartEditing = (conv: Conversation) => {
    setEditingConversationId(conv.id);
    setEditingTitle(conv.title);
  };

  const handleSaveTitle = () => {
    if (editingConversationId && editingTitle.trim()) {
      updateMutation.mutate({ id: editingConversationId, title: editingTitle.trim() });
    }
  };

  const handleCancelEditing = () => {
    setEditingConversationId(null);
    setEditingTitle("");
  };

  const startManusMutation = useMutation({
    mutationFn: startManusRun,
    onSuccess: (result) => {
      setSelectedRun(result.runId);
      setAutonomousInput("");
      setAutonomousFiles([]);
      queryClient.invalidateQueries({ queryKey: ["manus-runs"] });
    },
  });

  const handleAutonomousFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) {
        alert(`Arquivo ${file.name} muito grande. Máximo 5MB.`);
        continue;
      }

      try {
        const isPdf = file.name.toLowerCase().endsWith('.pdf');
        
        if (isPdf) {
          const arrayBuffer = await file.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          setAutonomousFiles(prev => [...prev, { name: file.name, content: "[PDF - conteúdo será extraído no servidor]", base64 }]);
        } else {
          const content = await file.text();
          setAutonomousFiles(prev => [...prev, { name: file.name, content }]);
        }
      } catch (error) {
        console.error("Error reading file:", error);
      }
    }

    if (autonomousFileInputRef.current) {
      autonomousFileInputRef.current.value = "";
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("Arquivo muito grande. Máximo 10MB.");
      return;
    }

    try {
      const isImage = file.type.startsWith("image/");
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      
      if (isImage) {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          setAttachedFile({ name: file.name, content: `[🖼️ Imagem: ${file.name}]`, base64, isImage: true, preview: base64 });
        };
        reader.readAsDataURL(file);
      } else if (isPdf) {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        setAttachedFile({ name: file.name, content: "[PDF - conteúdo será extraído no servidor]", base64 });
      } else {
        const content = await file.text();
        setAttachedFile({ name: file.name, content });
      }
    } catch (error) {
      console.error("Error reading file:", error);
      alert("Erro ao ler o arquivo.");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePasteImage = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageItem = Array.from(items).find(item => item.type.startsWith("image/"));
    if (!imageItem) return;
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("Imagem muito grande. Máximo 10MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const name = `imagem-colada-${Date.now()}.png`;
      setAttachedFile({ name, content: `[🖼️ Imagem colada]`, base64, isImage: true, preview: base64 });
    };
    reader.readAsDataURL(file);
  };

  // Auto-detect if message needs Manus tools
  const detectNeedsTools = (content: string, hasFile: boolean): boolean => {
    const toolKeywords = [
      // Reports and exports
      'gerar relatório', 'criar relatório', 'exportar', 'enviar para', 
      'relatório financeiro', 'relatório de vendas', 'relatório gerencial',
      // Web search
      'pesquisar na web', 'buscar na web', 'pesquisar online', 'buscar online',
      // Calculations and analysis
      'calcular', 'analisar dados', 'análise swot', 'análise de dados',
      'comparar com', 'pesquisa de mercado', 'estatísticas',
      // BI and charts
      'criar gráfico', 'gerar gráfico', 'dashboard', 'bi',
      'dataset', 'enviar para bi', 'visualizar dados',
      // ERP and business data
      'consultar erp', 'consulta erp', 'dados do erp', 'buscar dados',
      'vendas do', 'estoque', 'notas fiscais', 'nfe', 'nfce',
      'clientes do', 'fornecedores', 'financeiro', 'contas a pagar',
      'contas a receber', 'faturamento',
      // CRM
      'consultar crm', 'dados do crm', 'leads', 'pipeline',
      // Knowledge base
      'base de conhecimento', 'documentos da empresa', 'conhecimento',
      // Files
      'excel', 'planilha', 'xlsx', 'pdf', 'csv',
      'analisar arquivo', 'processar arquivo', 'extrair dados',
      // Finance
      'balanço', 'demonstrativo', 'dre', 'fluxo de caixa',
      'balancete', 'receitas', 'despesas',
      // Tasks
      'agendar', 'criar tarefa', 'lembrete', 'agendar reunião',
      // Messages
      'enviar mensagem', 'notificar', 'avisar'
    ];
    const contentLower = content.toLowerCase();
    const matchesKeyword = toolKeywords.some(kw => contentLower.includes(kw));
    const hasFileAndNeedsProcessing = hasFile && (
      contentLower.includes('analis') || contentLower.includes('process') || 
      contentLower.includes('relat') || contentLower.includes('export') ||
      contentLower.includes('extrair') || contentLower.includes('import')
    );
    return matchesKeyword || hasFileAndNeedsProcessing;
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isStreaming) return;
    if (!selectedConversation && !isNewConversation) return;

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: attachedFile ? `[📎 ${attachedFile.name}]\n\n${chatInput}` : chatInput,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = chatInput;
    const currentFile = attachedFile;
    setChatInput("");
    setAttachedFile(null);
    setIsStreaming(true);
    setStreamingContent("");
    
    // Ensure conversation exists (shared for both paths)
    let conversationId = selectedConversation;
    let isNewConv = false;
    if (isNewConversation && !selectedConversation) {
      try {
        const title = generateConversationTitle(currentInput);
        const newConv = await createConversation(title);
        conversationId = newConv.id;
        setSelectedConversation(newConv.id);
        setIsNewConversation(false);
        isNewConv = true;
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      } catch (error) {
        console.error("Error creating conversation:", error);
        setIsStreaming(false);
        return;
      }
    }
    
    // Check if this message needs Manus tools
    const needsTools = detectNeedsTools(currentInput, !!currentFile);
    
    if (needsTools) {
      // Use Manus for tool-based tasks
      setProcessingMode("using_tools");
      setCurrentToolName(null);
      
      try {
        const attachedFiles = currentFile ? [currentFile] : [];
        // Include conversation history for context
        const recentHistory = messages.slice(-6).map(m => ({
          role: m.role,
          content: m.content
        }));
        const result = await startManusRun({ 
          prompt: currentInput, 
          attachedFiles: attachedFiles.length > 0 ? attachedFiles : undefined,
          conversationHistory: recentHistory.length > 0 ? recentHistory : undefined
        });
        setSelectedRun(result.runId);
        
        // Poll for completion
        const pollForResult = async () => {
          let attempts = 0;
          const maxAttempts = 80; // 2 minutes max (80 * 1.5s = 120s)
          
          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            const runData = await fetchManusRun(result.runId);
            
            if (runData.status === "completed" && runData.result) {
              // Add to local state
              const assistantMessage: Message = {
                id: Date.now() + 1,
                role: "assistant",
                content: runData.result,
                createdAt: new Date().toISOString(),
              };
              setMessages((prev) => [...prev, assistantMessage]);
              
              // Persist to server if we have a conversation (idempotent via runId)
              if (conversationId) {
                try {
                  await fetch(`/api/conversations/${conversationId}/manus-result`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                      userMessage: currentInput,
                      assistantMessage: runData.result,
                      runId: result.runId,
                      includeUserMessage: true // User message needs to be saved
                    }),
                    credentials: "include",
                  });
                } catch (e) {
                  console.error("Error saving Manus result to conversation:", e);
                }
              }
              
              setIsStreaming(false);
              setProcessingMode("idle");
              setCurrentToolName(null);
              setSelectedRun(null);
              queryClient.invalidateQueries({ queryKey: ["manus-runs"] });
              queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
              return;
            } else if (runData.status === "error" || runData.status === "stopped") {
              const errorMessage: Message = {
                id: Date.now() + 1,
                role: "assistant",
                content: "Desculpe, ocorreu um erro ao processar sua solicitação. Tente novamente.",
                createdAt: new Date().toISOString(),
              };
              setMessages((prev) => [...prev, errorMessage]);
              setIsStreaming(false);
              setProcessingMode("idle");
              setCurrentToolName(null);
              setSelectedRun(null);
              return;
            }
            
            // Update current tool being used
            const currentStep = runData.steps?.find(s => s.status === "running" || s.status === "pending");
            if (currentStep?.tool) {
              setCurrentToolName(TOOL_NAMES[currentStep.tool] || currentStep.tool);
            }
            
            attempts++;
          }
          
          // Timeout - show message to user and persist it
          const timeoutContent = "A tarefa está demorando mais do que o esperado. Você pode verificar o status na lista de execuções ou tentar novamente.";
          const timeoutMessage: Message = {
            id: Date.now() + 1,
            role: "assistant",
            content: timeoutContent,
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, timeoutMessage]);
          
          // Persist timeout message to server
          if (conversationId) {
            try {
              await fetch(`/api/conversations/${conversationId}/manus-result`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                  userMessage: currentInput,
                  assistantMessage: timeoutContent,
                  runId: `timeout-${result.runId}`,
                  includeUserMessage: true
                }),
                credentials: "include",
              });
            } catch (e) {
              console.error("Error saving timeout message:", e);
            }
          }
          
          setIsStreaming(false);
          setProcessingMode("idle");
          setCurrentToolName(null);
          setSelectedRun(null);
        };
        
        pollForResult();
        return;
      } catch (error) {
        console.error("Error starting Manus run:", error);
        const errorMessage: Message = {
          id: Date.now() + 1,
          role: "assistant",
          content: "Não foi possível iniciar a tarefa. Por favor, tente novamente.",
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        setIsStreaming(false);
        setProcessingMode("idle");
        setCurrentToolName(null);
        setSelectedRun(null);
        return;
      }
    }
    
    // Regular chat mode - conversation already exists at this point
    setProcessingMode("thinking");

    if (!conversationId) {
      setIsStreaming(false);
      return;
    }

    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          content: currentInput,
          fileName: currentFile?.name,
          fileContent: currentFile?.content,
          fileBase64: currentFile?.base64,
          tenantId: selectedTenantId,
          projectId: selectedProjectId,
        }),
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  fullContent += data.content;
                  setStreamingContent(fullContent);
                }
                if (data.done) {
                  const assistantMessage: Message = {
                    id: data.messageId || Date.now() + 1,
                    role: "assistant",
                    content: fullContent,
                    createdAt: new Date().toISOString(),
                    interactionId: data.interactionId,
                  };
                  setMessages((prev) => [...prev, assistantMessage]);
                  setStreamingContent("");
                }
              } catch (e) {
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsStreaming(false);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
      }
    }
  };

  const handleNewConversation = () => {
    setSelectedConversation(null);
    setIsNewConversation(true);
    setMessages([]);
    setChatInput("");
    setAttachedFile(null);
    setTimeout(() => chatInputRef.current?.focus(), 100);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("pt-BR", { 
      day: "2-digit", 
      month: "2-digit", 
      hour: "2-digit", 
      minute: "2-digit" 
    });
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "running":
        return (
          <Badge className="bg-[#1f334d] text-white">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />Executando
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-[#4caf50] text-white">
            <CheckCircle className="w-3 h-3 mr-1" />Concluído
          </Badge>
        );
      case "error":
      case "stopped":
        return (
          <Badge className="bg-red-600 text-white">
            <XCircle className="w-3 h-3 mr-1" />Erro
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const finishStep = currentRun?.steps?.find(s => s.tool === "finish");
  const workSteps = currentRun?.steps?.filter(s => s.tool !== "finish") || [];

  return (
    <BrowserFrame>
      <div className="h-full w-full flex bg-[#f5f7fa]">
        <div className="w-72 bg-[#1f334d] flex flex-col shadow-xl">
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#c89b3c] flex items-center justify-center shadow-lg">
                <Bot className="w-5 h-5 text-[#1f334d]" />
              </div>
              <div>
                <h1 className="text-white font-semibold tracking-tight">Arcádia Agent</h1>
                <p className="text-xs text-[#c89b3c]">Inteligência Empresarial</p>
              </div>
            </div>
            
            <div className="flex gap-1 bg-[#162638] border border-white/10 rounded-md p-1">
              <button
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                  agentView === "chat" ? "bg-[#c89b3c] text-[#1f334d]" : "text-white/60 hover:text-white/80"
                }`}
                onClick={() => setAgentView("chat")}
                data-testid="btn-agent-chat"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Chat
              </button>
              <button
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                  agentView === "history" ? "bg-[#c89b3c] text-[#1f334d]" : "text-white/60 hover:text-white/80"
                }`}
                onClick={() => setAgentView("history")}
                data-testid="btn-agent-history"
              >
                <Clock className="w-3.5 h-3.5" />
                Histórico
              </button>
            </div>
          </div>

          {mode === "chat" ? (
            <>
              <div className="p-3 border-b border-white/10">
                <Button 
                  onClick={handleNewConversation}
                  className="w-full bg-[#c89b3c] hover:bg-[#d4a94a] text-[#1f334d] font-medium text-sm"
                  data-testid="button-new-conversation"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Conversa
                </Button>
              </div>
              <ScrollArea className="flex-1">
                {loadingConversations ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-[#c89b3c]" />
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="text-center py-8 text-white/50 text-sm">
                    Nenhuma conversa ainda
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {conversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                          selectedConversation === conv.id
                            ? "bg-[#c89b3c]/20 border border-[#c89b3c]/50"
                            : "hover:bg-[#162638] border border-transparent"
                        }`}
                        onClick={() => {
                          if (editingConversationId !== conv.id) {
                            setSelectedConversation(conv.id);
                            setIsNewConversation(false);
                          }
                        }}
                        data-testid={`conversation-${conv.id}`}
                      >
                        <MessageSquare className="w-4 h-4 text-[#c89b3c] shrink-0" />
                        {editingConversationId === conv.id ? (
                          <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                            <Input
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              className="h-6 text-sm bg-[#1f334d] border-white/20 text-white flex-1"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveTitle();
                                if (e.key === "Escape") handleCancelEditing();
                              }}
                              data-testid={`input-rename-conversation-${conv.id}`}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 hover:bg-green-500/20"
                              onClick={handleSaveTitle}
                              disabled={updateMutation.isPending}
                              data-testid={`save-conversation-${conv.id}`}
                            >
                              <Check className="w-3 h-3 text-green-400" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 hover:bg-red-500/20"
                              onClick={handleCancelEditing}
                              data-testid={`cancel-rename-conversation-${conv.id}`}
                            >
                              <X className="w-3 h-3 text-red-400" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <span className="text-sm text-white truncate flex-1">{conv.title}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-[#c89b3c]/20"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEditing(conv);
                              }}
                              data-testid={`edit-conversation-${conv.id}`}
                            >
                              <Pencil className="w-3 h-3 text-[#c89b3c]" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-red-500/20"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteMutation.mutate(conv.id);
                              }}
                              data-testid={`delete-conversation-${conv.id}`}
                            >
                              <Trash2 className="w-3 h-3 text-red-400" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </>
          ) : (
            <>
              <div className="p-3 border-b border-white/10">
                <Button 
                  onClick={() => setSelectedRun(null)}
                  className="w-full bg-[#c89b3c] hover:bg-[#d4a94a] text-[#1f334d] font-medium text-sm"
                  data-testid="button-new-task"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Tarefa
                </Button>
              </div>
              <div className="px-3 pt-3 pb-1">
                <p className="text-xs text-white/40 uppercase tracking-wider font-medium">Todas as Tarefas</p>
              </div>
              <ScrollArea className="flex-1 px-2">
                {loadingRuns ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-[#c89b3c]" />
                  </div>
                ) : manusRuns.length === 0 ? (
                  <p className="text-sm text-white/40 p-3">Nenhuma execução ainda</p>
                ) : (
                  <div className="space-y-1 pb-2">
                    {manusRuns.map((run) => (
                      <button
                        key={run.id}
                        onClick={() => setSelectedRun(run.id)}
                        className={`w-full text-left p-2.5 rounded-lg transition-all ${
                          selectedRun === run.id 
                            ? "bg-[#c89b3c]/20 border border-[#c89b3c]/50" 
                            : "hover:bg-[#162638] border border-transparent"
                        }`}
                        data-testid={`run-${run.id}`}
                      >
                        <p className="text-xs text-white line-clamp-2 mb-1.5">{run.prompt}</p>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(run.status)}
                          <span className="text-[10px] text-white/40">{formatTime(run.createdAt)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </div>

        <div className="flex-1 flex flex-col">
          {agentView === "history" ? (
            <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-br from-[#f5f7fa] to-[#e8ecf1]">
              <div className="max-w-6xl mx-auto">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1f334d] to-[#2d4a6b] flex items-center justify-center shadow-lg">
                    <Clock className="w-5 h-5 text-[#c89b3c]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-[#1f334d]">Histórico de Desenvolvimento</h2>
                    <p className="text-xs text-[#5a6c7d]">Todas as tarefas executadas pelos agentes autônomos</p>
                  </div>
                </div>
                <DevHistory embedded />
              </div>
            </div>
          ) : mode === "chat" ? (
            !selectedConversation && !isNewConversation ? (
              <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gradient-to-br from-[#f5f7fa] to-[#e8ecf1]">
                <div className="max-w-4xl mx-auto space-y-6">
                  <div className="flex flex-col items-center py-6 md:py-8">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1f334d] to-[#2d4a6b] flex items-center justify-center mb-4 shadow-xl">
                      <Bot className="w-10 h-10 text-[#c89b3c]" />
                    </div>
                    <h1 className="text-2xl md:text-3xl font-light text-[#1f334d] mb-2" data-testid="text-agent-welcome">
                      Arcádia <span className="text-[#c89b3c] font-medium">Agent</span>
                    </h1>
                    <p className="text-[#5a6c7d] text-center max-w-lg mb-4 text-sm">
                      Seu assistente de IA empresarial. Converse, analise documentos, consulte dados e obtenha insights acionáveis em tempo real.
                    </p>
                    <Button
                      onClick={handleNewConversation}
                      className="bg-[#c89b3c] hover:bg-[#d4a94a] text-[#1f334d] font-semibold px-6"
                      data-testid="button-start-conversation"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Iniciar Nova Conversa
                    </Button>
                  </div>

                  <Card className="border-[#c89b3c]/30 bg-gradient-to-r from-amber-50 to-orange-50">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-[#c89b3c]" />
                        <CardTitle className="text-lg text-[#1f334d]">Como funciona o Agent</CardTitle>
                      </div>
                      <CardDescription>
                        O Arcádia Agent possui dois modos de operação para atender diferentes necessidades
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-4 bg-white rounded-lg border border-[#e1e8f0]">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                              <MessageCircle className="w-4 h-4 text-blue-600" />
                            </div>
                            <h3 className="font-medium text-[#1f334d]">Modo Conversar</h3>
                          </div>
                          <p className="text-sm text-[#5a6c7d]">
                            Chat interativo com IA. Faça perguntas, anexe documentos para análise e receba respostas em tempo real com streaming.
                          </p>
                        </div>
                        <div className="p-4 bg-white rounded-lg border border-[#e1e8f0]">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                              <Zap className="w-4 h-4 text-amber-600" />
                            </div>
                            <h3 className="font-medium text-[#1f334d]">Modo Executar</h3>
                          </div>
                          <p className="text-sm text-[#5a6c7d]">
                            Agente autônomo (Manus) que executa tarefas complexas usando Pensamento-Ação-Observação com ferramentas especializadas.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div>
                    <h2 className="font-semibold text-[#1f334d] mb-4 flex items-center gap-2">
                      <Wrench className="w-4 h-4" />
                      Ferramentas Disponíveis
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { icon: Globe, name: "Pesquisa Web", desc: "Busca na internet", color: "bg-blue-100 text-blue-600" },
                        { icon: Network, name: "Conhecimento", desc: "Consulta base interna", color: "bg-emerald-100 text-emerald-600" },
                        { icon: Database, name: "ERP Query", desc: "Dados do sistema", color: "bg-purple-100 text-purple-600" },
                        { icon: Calculator, name: "Cálculos", desc: "Operações matemáticas", color: "bg-orange-100 text-orange-600" },
                        { icon: Mail, name: "Mensagens", desc: "Envia comunicações", color: "bg-pink-100 text-pink-600" },
                        { icon: BarChart3, name: "Relatórios", desc: "Gera análises", color: "bg-cyan-100 text-cyan-600" },
                        { icon: Calendar, name: "Agendamento", desc: "Cria tarefas", color: "bg-indigo-100 text-indigo-600" },
                        { icon: FileText, name: "Documentos", desc: "Analisa arquivos", color: "bg-slate-100 text-slate-600" },
                      ].map((tool, i) => (
                        <Card key={i} className="p-3 hover:shadow-md transition-shadow" data-testid={`tool-card-${i}`}>
                          <div className="flex items-start gap-3">
                            <div className={`w-9 h-9 rounded-lg ${tool.color} flex items-center justify-center shrink-0`}>
                              <tool.icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm text-[#1f334d] truncate">{tool.name}</p>
                              <p className="text-xs text-[#5a6c7d] truncate">{tool.desc}</p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <Card className="bg-[#1f334d] text-white">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-[#c89b3c] flex items-center justify-center shrink-0">
                          <Sparkles className="w-5 h-5 text-[#1f334d]" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold mb-1">Dica: Use o Modo Executar para tarefas complexas</h3>
                          <p className="text-sm text-white/70">
                            Para tarefas que requerem múltiplas etapas (pesquisar, analisar, calcular e gerar relatório), 
                            use o modo Executar. O agente mostrará cada passo do raciocínio.
                          </p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="border-white/30 text-white hover:bg-white/10 shrink-0"
                          onClick={() => setMode("autonomous")}
                          data-testid="button-switch-to-autonomous"
                        >
                          Experimentar
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <>
                <div className="border-b border-[#e1e8f0] bg-white px-6 py-3 shadow-sm">
                  <h3 className="font-medium text-[#1f334d]">
                    {currentConversation?.title || "Conversa"}
                  </h3>
                </div>

                <ScrollArea className="flex-1 p-6">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-[#c89b3c]" />
                    </div>
                  ) : messages.length === 0 && !streamingContent ? (
                    <div className="text-center py-12 text-[#5a6c7d]">
                      <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Envie uma mensagem ou anexe um documento para começar</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-w-3xl mx-auto">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex gap-3 ${
                            msg.role === "user" ? "justify-end" : "justify-start"
                          }`}
                          data-testid={`message-${msg.id}`}
                        >
                          {msg.role === "assistant" && (
                            <div className="w-8 h-8 rounded-full bg-[#1f334d] flex items-center justify-center shrink-0">
                              <Bot className="w-4 h-4 text-[#c89b3c]" />
                            </div>
                          )}
                          <div className="flex flex-col max-w-[80%]">
                            <Card
                              className={`px-4 py-3 ${
                                msg.role === "user"
                                  ? "bg-[#1f334d] text-white"
                                  : "bg-white border border-[#e1e8f0]"
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            </Card>
                            {msg.role === "assistant" && msg.interactionId && (
                              <div className="flex items-center gap-1 mt-1 ml-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`h-6 w-6 ${msg.feedback === 'positive' ? 'text-green-500 bg-green-50' : 'text-[#5a6c7d] hover:text-green-500 hover:bg-green-50'}`}
                                  onClick={() => feedbackMutation.mutate({ interactionId: msg.interactionId!, feedback: 'positive' })}
                                  disabled={feedbackMutation.isPending}
                                  data-testid={`feedback-positive-${msg.id}`}
                                  title="Resposta útil"
                                >
                                  <ThumbsUp className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`h-6 w-6 ${msg.feedback === 'negative' ? 'text-red-500 bg-red-50' : 'text-[#5a6c7d] hover:text-red-500 hover:bg-red-50'}`}
                                  onClick={() => feedbackMutation.mutate({ interactionId: msg.interactionId!, feedback: 'negative' })}
                                  disabled={feedbackMutation.isPending}
                                  data-testid={`feedback-negative-${msg.id}`}
                                  title="Resposta não útil"
                                >
                                  <ThumbsDown className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                            {msg.role === "assistant" && messages[messages.length - 1]?.id === msg.id && !isStreaming && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-2 ml-1">
                                <span className="text-[10px] text-[#5a6c7d] mr-1">Continuar:</span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-[10px] px-2 border-[#e1e8f0] hover:bg-[#f5f7fa] hover:border-[#c89b3c]"
                                  onClick={() => setChatInput("Gerar relatório completo sobre isso")}
                                  data-testid={`quick-action-report-${msg.id}`}
                                >
                                  <FileText className="w-3 h-3 mr-1" />
                                  Relatório
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-[10px] px-2 border-[#e1e8f0] hover:bg-[#f5f7fa] hover:border-[#c89b3c]"
                                  onClick={() => setChatInput("Exportar esses dados para Excel")}
                                  data-testid={`quick-action-excel-${msg.id}`}
                                >
                                  <Download className="w-3 h-3 mr-1" />
                                  Excel
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-[10px] px-2 border-[#e1e8f0] hover:bg-[#f5f7fa] hover:border-[#c89b3c]"
                                  onClick={() => setChatInput("Enviar esses dados para o BI")}
                                  data-testid={`quick-action-bi-${msg.id}`}
                                >
                                  <BarChart3 className="w-3 h-3 mr-1" />
                                  Enviar BI
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-[10px] px-2 border-[#e1e8f0] hover:bg-[#f5f7fa] hover:border-[#c89b3c]"
                                  onClick={() => setChatInput("Comparar com outras empresas do setor")}
                                  data-testid={`quick-action-compare-${msg.id}`}
                                >
                                  <TrendingUp className="w-3 h-3 mr-1" />
                                  Comparar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-[10px] px-2 border-[#e1e8f0] hover:bg-[#f5f7fa] hover:border-[#c89b3c]"
                                  onClick={() => setChatInput("Fazer pesquisa de mercado sobre esse tema")}
                                  data-testid={`quick-action-market-${msg.id}`}
                                >
                                  <Search className="w-3 h-3 mr-1" />
                                  Mercado
                                </Button>
                              </div>
                            )}
                          </div>
                          {msg.role === "user" && (
                            <div className="w-8 h-8 rounded-full bg-[#c89b3c] flex items-center justify-center shrink-0">
                              <User className="w-4 h-4 text-[#1f334d]" />
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {isStreaming && !streamingContent && (
                        <div className="flex gap-3 justify-start" data-testid="thinking-indicator">
                          <div className="w-8 h-8 rounded-full bg-[#1f334d] flex items-center justify-center shrink-0">
                            <Bot className="w-4 h-4 text-[#c89b3c]" />
                          </div>
                          <Card className="px-4 py-3 bg-white border border-[#e1e8f0]">
                            <div className="flex items-center gap-2">
                              {processingMode === "using_tools" ? (
                                <>
                                  <Wrench className="w-4 h-4 animate-pulse text-[#c89b3c]" />
                                  <span className="text-sm text-[#5a6c7d]">
                                    {currentToolName ? `Usando: ${currentToolName}` : "Executando tarefa..."}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin text-[#c89b3c]" />
                                  <span className="text-sm text-[#5a6c7d]">Pensando...</span>
                                </>
                              )}
                            </div>
                          </Card>
                        </div>
                      )}

                      {streamingContent && (
                        <div className="flex gap-3 justify-start">
                          <div className="w-8 h-8 rounded-full bg-[#1f334d] flex items-center justify-center shrink-0">
                            <Bot className="w-4 h-4 text-[#c89b3c]" />
                          </div>
                          <Card className="px-4 py-3 max-w-[80%] bg-white border border-[#e1e8f0]">
                            <p className="text-sm whitespace-pre-wrap">{streamingContent}</p>
                          </Card>
                        </div>
                      )}
                      
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                <div className="border-t border-[#e1e8f0] bg-white p-4">
                  <div className="max-w-3xl mx-auto mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-2 text-xs text-[#5a6c7d]">
                        <Compass className="w-3.5 h-3.5" />
                        <span>Contexto Process Compass:</span>
                      </div>
                      <Select 
                        value={selectedTenantId?.toString() || "__none__"} 
                        onValueChange={(v) => {
                          setSelectedTenantId(v === "__none__" ? null : parseInt(v));
                          setSelectedProjectId(null);
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs w-[140px] border-[#e1e8f0]" data-testid="select-agent-tenant">
                          <SelectValue placeholder="Organização" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nenhuma</SelectItem>
                          {tenants.map((t: any) => (
                            <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedTenantId && (
                        <Select 
                          value={selectedProjectId?.toString() || "__all__"} 
                          onValueChange={(v) => setSelectedProjectId(v === "__all__" ? null : parseInt(v))}
                        >
                          <SelectTrigger className="h-7 text-xs w-[140px] border-[#e1e8f0]" data-testid="select-agent-project">
                            <SelectValue placeholder="Projeto" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">Todos</SelectItem>
                            {projects.map((p: any) => (
                              <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {(selectedTenantId || selectedProjectId) && (
                        <Badge variant="outline" className="text-xs bg-[#f5f7fa]">
                          <FolderKanban className="w-3 h-3 mr-1" />
                          Diagnósticos ativos
                        </Badge>
                      )}
                    </div>
                  </div>
                  {attachedFile && (
                    <div className="max-w-3xl mx-auto mb-3">
                      <div className="inline-flex items-center gap-2 bg-[#f5f7fa] rounded-lg px-3 py-2 text-sm text-[#1f334d] border border-[#e1e8f0]">
                        {attachedFile.isImage && attachedFile.preview ? (
                          <img src={attachedFile.preview} alt={attachedFile.name} className="w-12 h-12 object-cover rounded" />
                        ) : (
                          <FileText className="w-4 h-4 text-[#c89b3c]" />
                        )}
                        <span className="truncate max-w-[200px]">{attachedFile.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 hover:bg-red-100"
                          onClick={() => setAttachedFile(null)}
                          data-testid="button-remove-file"
                        >
                          <X className="w-3 h-3 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="max-w-3xl mx-auto flex gap-3">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept=".txt,.csv,.json,.md,.pdf,image/*"
                      className="hidden"
                      data-testid="input-file"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isStreaming}
                      title="Anexar arquivo"
                      className="border-[#e1e8f0] hover:bg-[#f5f7fa]"
                      data-testid="button-attach-file"
                    >
                      <Paperclip className="w-4 h-4 text-[#5a6c7d]" />
                    </Button>
                    <Input
                      ref={chatInputRef}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                      onPaste={handlePasteImage}
                      placeholder="Digite sua pergunta, anexe documentos ou cole imagens (Ctrl+V)..."
                      disabled={isStreaming}
                      className="flex-1 border-[#e1e8f0] focus:border-[#c89b3c] focus:ring-[#c89b3c]/20"
                      data-testid="input-message"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!chatInput.trim() || isStreaming}
                      className="bg-[#1f334d] hover:bg-[#2a4562] text-white"
                      data-testid="button-send"
                    >
                      {isStreaming ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )
          ) : (
            !selectedRun ? (
              <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 bg-white">
                <div className="w-full max-w-2xl space-y-8">
                  <div className="text-center">
                    <h1 className="text-3xl md:text-4xl font-light text-[#1f334d] mb-6" data-testid="text-manus-welcome">
                      O que posso fazer por você?
                    </h1>
                  </div>

                  <div className="relative">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
                      <textarea
                        value={autonomousInput}
                        onChange={(e) => setAutonomousInput(e.target.value)}
                        placeholder="Atribua uma tarefa ou pergunte qualquer coisa"
                        className="w-full h-24 p-4 text-[#1f334d] placeholder:text-slate-400 focus:outline-none resize-none text-base"
                        data-testid="input-autonomous-main"
                      />
                      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => autonomousFileInputRef.current?.click()}
                            className="h-8 w-8 text-slate-400 hover:text-slate-600"
                            title="Anexar arquivo"
                            data-testid="button-attach-main"
                          >
                            <Plus className="w-5 h-5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-slate-600"
                            title="Configurações"
                          >
                            <Settings2 className="w-5 h-5" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          {autonomousFiles.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-[#c89b3c]">
                              <Paperclip className="w-3 h-3" />
                              {autonomousFiles.length} arquivo(s)
                            </div>
                          )}
                          <Button
                            onClick={() => startManusMutation.mutate({ prompt: autonomousInput, attachedFiles: autonomousFiles.length > 0 ? autonomousFiles : undefined })}
                            disabled={!autonomousInput.trim() || startManusMutation.isPending}
                            size="icon"
                            className="h-9 w-9 rounded-full bg-[#1f334d] hover:bg-[#2a4562] text-white"
                            data-testid="button-send-main"
                          >
                            {startManusMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <ArrowRight className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    {autonomousFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {autonomousFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full text-sm">
                            <Paperclip className="w-3 h-3 text-slate-500" />
                            <span className="truncate max-w-[150px]">{file.name}</span>
                            <button
                              onClick={() => setAutonomousFiles(prev => prev.filter((_, i) => i !== idx))}
                              className="text-slate-400 hover:text-red-500"
                              data-testid={`remove-file-main-${idx}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {startManusMutation.isPending && (
                    <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50" data-testid="agent-thinking-indicator">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
                          </div>
                          <div>
                            <p className="font-medium text-[#1f334d]">Iniciando agente...</p>
                            <p className="text-sm text-[#5a6c7d]">Preparando para executar sua tarefa</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {!startManusMutation.isPending && (
                    <div className="flex flex-wrap justify-center gap-2">
                      {[
                        { icon: BarChart3, label: "Criar relatório" },
                        { icon: Globe, label: "Pesquisar" },
                        { icon: Database, label: "Consultar ERP" },
                        { icon: FileText, label: "Analisar documento" },
                        { icon: Calculator, label: "Calcular" },
                      ].map((action, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          className="rounded-full border-slate-200 text-slate-600 hover:bg-slate-50 gap-2"
                          onClick={() => setAutonomousInput(action.label)}
                          data-testid={`quick-action-${i}`}
                        >
                          <action.icon className="w-4 h-4" />
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  )}

                  <input
                    type="file"
                    ref={autonomousFileInputRef}
                    onChange={handleAutonomousFileSelect}
                    className="hidden"
                    multiple
                    accept=".txt,.csv,.json,.md,.xml,.html,.js,.ts,.py,.pdf"
                    data-testid="input-file-main"
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col bg-white overflow-hidden">
                <ScrollArea className="flex-1 h-0">
                  <div className="max-w-4xl mx-auto p-6">
                    {loadingRun ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-[#c89b3c]" />
                      </div>
                    ) : (
                      <>
                        <div className="mb-6">
                          <div className="flex items-start gap-3 mb-4">
                            <div className="w-8 h-8 rounded-full bg-[#c89b3c] flex items-center justify-center shrink-0 mt-0.5">
                              <User className="w-4 h-4 text-[#1f334d]" />
                            </div>
                            <div className="flex-1">
                              <p className="text-[#1f334d] leading-relaxed">{currentRun?.prompt}</p>
                              <p className="text-xs text-[#5a6c7d] mt-1">
                                {currentRun && formatTime(currentRun.createdAt)}
                              </p>
                            </div>
                            {currentRun && getStatusBadge(currentRun.status)}
                          </div>
                        </div>

                        {workSteps.length > 0 && (
                          <div className="mb-6">
                            <p className="text-xs text-[#5a6c7d] font-medium uppercase tracking-wide mb-3">
                              Passos Executados ({workSteps.length})
                            </p>
                            <div className="space-y-2">
                              {workSteps.map((step) => (
                                <StepCard key={step.id} step={step} isFinish={false} />
                              ))}
                            </div>
                          </div>
                        )}

                        {currentRun?.status === "running" && (
                          <div className="flex items-center gap-3 py-4 px-4 bg-[#f5f7fa] rounded-lg border border-[#e1e8f0]">
                            <Loader2 className="w-5 h-5 animate-spin text-[#c89b3c]" />
                            <span className="text-sm text-[#1f334d]">Processando...</span>
                          </div>
                        )}

                        {finishStep && (
                          <div className="mt-6">
                            <StepCard step={finishStep} isFinish={true} prompt={currentRun?.prompt} />
                          </div>
                        )}

                        <div ref={stepsEndRef} />
                      </>
                    )}
                  </div>
                </ScrollArea>

                {currentRun?.status === "completed" && (
                  <div className="border-t border-[#4caf50] bg-[#e8f5e9] px-6 py-4">
                    <div className="max-w-4xl mx-auto flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-[#4caf50]" />
                      <span className="text-sm font-medium text-[#2e7d32]">Tarefa concluída</span>
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </BrowserFrame>
  );
}
