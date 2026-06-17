import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Printer, Save, FileText, Pen, X, RotateCcw, Search, User } from "lucide-react";

interface Person {
  id: number;
  fullName: string;
  cpfCnpj: string;
  phone?: string;
  email?: string;
}

interface TradeInFormProps {
  onClose: () => void;
  onSave?: (data: any) => void;
  initialEvaluation?: any;
  customerId?: number;
}

interface ChecklistItem {
  id: string;
  description: string;
  value: "sim" | "nao" | "";
  observation: string;
}

interface PartItem {
  peca: string;
  valor: string;
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: "liga", description: "Aparelho liga corretamente", value: "", observation: "" },
  { id: "avarias", description: "Avarias, travamentos ou toque fantasma", value: "", observation: "" },
  { id: "manchas_tela", description: "Manchas na tela", value: "", observation: "" },
  { id: "botoes", description: "Botões funcionando", value: "", observation: "" },
  { id: "marcas_uso", description: "Marcas de uso", value: "", observation: "" },
  { id: "wifi", description: "Wi-Fi funcionando", value: "", observation: "" },
  { id: "chip", description: "Chip funcionando", value: "", observation: "" },
  { id: "4g5g", description: "4G/5G funcionando", value: "", observation: "" },
  { id: "sensores", description: "Sensores funcionando / NFC", value: "", observation: "" },
  { id: "faceid", description: "Face ID / Touch ID funcionando", value: "", observation: "" },
  { id: "microfones", description: "Microfones funcionando", value: "", observation: "" },
  { id: "auricular", description: "Áudio auricular funcionando", value: "", observation: "" },
  { id: "altofalante", description: "Áudio alto-falante funcionando", value: "", observation: "" },
  { id: "carregamento", description: "Entrada de carregamento funcionando", value: "", observation: "" },
  { id: "cameras", description: "Câmeras funcionando / Manchas", value: "", observation: "" },
  { id: "flash", description: "Flash funcionando", value: "", observation: "" },
  { id: "carregador", description: "Possui carregador", value: "", observation: "" },
  { id: "3utools", description: "Análise pelo 3uTools OK", value: "", observation: "" },
];

export default function TradeInForm({ onClose, onSave, initialEvaluation, customerId }: TradeInFormProps) {
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const employeeCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [formData, setFormData] = useState({
    data: new Date().toLocaleDateString("pt-BR"),
    senha: "",
    cliente: "",
    cpf: "",
    aparelho: "",
    imei: "",
    valor: "",
    consultor: "",
    venda: "",
    saudeBateria: "",
  });

  const [availableEvaluations, setAvailableEvaluations] = useState<any[]>([]);
  const [showEvaluationPicker, setShowEvaluationPicker] = useState(false);
  const [loadingEvaluations, setLoadingEvaluations] = useState(false);
  
  const [parts, setParts] = useState<PartItem[]>([
    { peca: "", valor: "" },
    { peca: "", valor: "" },
    { peca: "", valor: "" },
    { peca: "", valor: "" },
    { peca: "", valor: "" },
  ]);
  
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);
  
  const [declarations, setDeclarations] = useState({
    removeuDados: false,
    transferePropriedade: false,
  });
  
  const [customerSignature, setCustomerSignature] = useState<string | null>(null);
  const [employeeSignature, setEmployeeSignature] = useState<string | null>(null);
  const [isSigningCustomer, setIsSigningCustomer] = useState(false);
  const [isSigningEmployee, setIsSigningEmployee] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  
  const [personsList, setPersonsList] = useState<Person[]>([]);
  const [filteredPersons, setFilteredPersons] = useState<Person[]>([]);
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const personSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadPersons = async () => {
      try {
        const res = await fetch("/api/soe/persons", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setPersonsList(data);
        }
      } catch (error) {
        console.error("Error loading persons:", error);
      }
    };
    loadPersons();
  }, []);

  useEffect(() => {
    const loadEvaluations = async () => {
      setLoadingEvaluations(true);
      try {
        const res = await fetch("/api/retail/evaluations?status=approved,pending", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setAvailableEvaluations(data);
        }
      } catch (error) {
        console.error("Error loading evaluations:", error);
      } finally {
        setLoadingEvaluations(false);
      }
    };
    loadEvaluations();
  }, []);

  useEffect(() => {
    if (initialEvaluation) {
      loadEvaluationData(initialEvaluation);
    }
  }, [initialEvaluation]);

  const loadEvaluationData = (evaluation: any) => {
    const notesData = evaluation.notes ? JSON.parse(evaluation.notes) : {};
    setFormData({
      data: evaluation.evaluationDate ? new Date(evaluation.evaluationDate).toLocaleDateString("pt-BR") : new Date().toLocaleDateString("pt-BR"),
      senha: notesData.senha || "",
      cliente: evaluation.customerName || "",
      cpf: evaluation.customerCpf || "",
      aparelho: `${evaluation.brand || ""} ${evaluation.model || ""}`.trim(),
      imei: evaluation.imei || "",
      valor: evaluation.estimatedValue ? `R$ ${parseFloat(evaluation.estimatedValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "",
      consultor: notesData.consultor || "",
      venda: notesData.venda || "",
      saudeBateria: evaluation.batteryHealth?.toString() || "",
    });
    if (notesData.parts) setParts(notesData.parts);
    if (notesData.checklist) setChecklist(notesData.checklist);
    if (notesData.declarations) setDeclarations(notesData.declarations);
    setShowEvaluationPicker(false);
    toast({ title: "Dados da avaliação carregados!" });
  };

  useEffect(() => {
    if (formData.cliente.length >= 2 && !selectedPersonId) {
      const filtered = personsList.filter(p => 
        p.fullName.toLowerCase().includes(formData.cliente.toLowerCase()) ||
        (p.cpfCnpj && p.cpfCnpj.includes(formData.cliente))
      );
      setFilteredPersons(filtered);
      setShowPersonDropdown(filtered.length > 0);
    } else {
      setShowPersonDropdown(false);
    }
  }, [formData.cliente, personsList, selectedPersonId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (personSearchRef.current && !personSearchRef.current.contains(event.target as Node)) {
        setShowPersonDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectPerson = (person: Person) => {
    setFormData({
      ...formData,
      cliente: person.fullName,
      cpf: person.cpfCnpj || "",
    });
    setSelectedPersonId(person.id);
    setShowPersonDropdown(false);
  };

  useEffect(() => {
    if (isSigningCustomer && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
    }
  }, [isSigningCustomer]);

  useEffect(() => {
    if (isSigningEmployee && employeeCanvasRef.current) {
      const canvas = employeeCanvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
    }
  }, [isSigningEmployee]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    setIsDrawing(true);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement | null) => {
    if (!isDrawing || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = (isCustomer: boolean) => {
    const canvas = isCustomer ? canvasRef.current : employeeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  const saveSignature = (isCustomer: boolean) => {
    const canvas = isCustomer ? canvasRef.current : employeeCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    if (isCustomer) {
      setCustomerSignature(dataUrl);
      setIsSigningCustomer(false);
    } else {
      setEmployeeSignature(dataUrl);
      setIsSigningEmployee(false);
    }
  };

  const updateChecklist = (id: string, field: "value" | "observation", val: any) => {
    setChecklist(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: val } : item
    ));
  };

  const updatePart = (index: number, field: "peca" | "valor", val: string) => {
    setParts(prev => prev.map((p, i) => 
      i === index ? { ...p, [field]: val } : p
    ));
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast({ title: "Erro ao abrir janela de impressão", variant: "destructive" });
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Checklist Trade-In - ${formData.cliente}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 11px; padding: 15px; }
          .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .header h1 { font-size: 16px; margin-bottom: 5px; }
          .header-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
          .field-row { display: flex; gap: 20px; margin-bottom: 8px; }
          .field { flex: 1; }
          .field-label { font-weight: bold; }
          .field-value { border-bottom: 1px solid #000; min-height: 18px; padding-left: 5px; }
          .section { margin-top: 15px; margin-bottom: 10px; }
          .section-title { font-size: 12px; font-weight: bold; background: #e0e0e0; padding: 5px; margin-bottom: 8px; }
          .parts-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 15px; }
          .part-box { border: 1px solid #ccc; padding: 5px; font-size: 10px; }
          .term { font-size: 9px; text-align: justify; background: #f5f5f5; padding: 10px; border: 1px solid #ddd; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          th, td { border: 1px solid #000; padding: 4px 6px; text-align: left; }
          th { background: #e0e0e0; font-size: 10px; }
          td { font-size: 10px; }
          .check-cell { width: 40px; text-align: center; }
          .obs-cell { width: 150px; }
          .declarations { background: #f9f9f9; padding: 10px; border: 1px solid #ddd; margin-bottom: 15px; }
          .declaration-item { margin-bottom: 8px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 30px; }
          .signature-box { width: 45%; text-align: center; }
          .signature-line { border-top: 1px solid #000; margin-top: 60px; padding-top: 5px; }
          .signature-image { max-width: 200px; max-height: 60px; margin-bottom: 5px; }
          @media print {
            body { padding: 10px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>CHECKLIST DE AVALIAÇÃO - TRADE-IN</h1>
          <h2 style="font-size: 12px; font-weight: normal;">SUPERSTORE</h2>
        </div>
        
        <div class="header-row">
          <span><strong>DATA:</strong> ${formData.data}</span>
          <span><strong>SENHA:</strong> ${formData.senha}</span>
        </div>
        
        <div class="field-row">
          <div class="field" style="flex: 2;">
            <span class="field-label">CLIENTE:</span>
            <span class="field-value">${formData.cliente}</span>
          </div>
          <div class="field">
            <span class="field-label">CPF:</span>
            <span class="field-value">${formData.cpf}</span>
          </div>
        </div>
        
        <div class="field-row">
          <div class="field">
            <span class="field-label">APARELHO:</span>
            <span class="field-value">${formData.aparelho}</span>
          </div>
          <div class="field">
            <span class="field-label">IMEI:</span>
            <span class="field-value">${formData.imei}</span>
          </div>
          <div class="field">
            <span class="field-label">VALOR:</span>
            <span class="field-value">${formData.valor}</span>
          </div>
        </div>
        
        <div class="field-row">
          <div class="field">
            <span class="field-label">CONSULTOR:</span>
            <span class="field-value">${formData.consultor}</span>
          </div>
          <div class="field">
            <span class="field-label">VENDA:</span>
            <span class="field-value">${formData.venda}</span>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">VALOR DO APARELHO E PEÇAS – RELATÓRIO INTERNO</div>
          <div class="parts-grid">
            ${parts.map((p, i) => `
              <div class="part-box">
                <div><strong>Peça ${i + 1}:</strong> ${p.peca}</div>
                <div><strong>Valor:</strong> ${p.valor}</div>
              </div>
            `).join("")}
          </div>
        </div>
        
        <div class="term">
          <strong>TERMO DE TRANSFERÊNCIA DE PROPRIEDADE DO APARELHO (CONTINGÊNCIA)</strong><br><br>
          Na condição de proprietário do aparelho acima descrito, declaro, por livre e espontânea vontade, a boa procedência do equipamento, transferindo neste ato sua propriedade à SUPERSTORE. Declaro que o aparelho não contém dados pessoais ou de terceiros. Autorizo expressamente que, caso sejam encontrados quaisquer dados no dispositivo, seja realizada a remoção e destruição definitiva das informações, sem possibilidade de recuperação. Reconheço que esta decisão é irrevogável e assumo total responsabilidade por ela.
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Descrição</th>
              <th class="check-cell">Sim</th>
              <th class="check-cell">Não</th>
              <th class="obs-cell">Observações</th>
            </tr>
          </thead>
          <tbody>
            ${checklist.map(item => `
              <tr>
                <td>${item.description}</td>
                <td class="check-cell">${item.value === "sim" ? "✓" : ""}</td>
                <td class="check-cell">${item.value === "nao" ? "✓" : ""}</td>
                <td class="obs-cell">${item.observation}</td>
              </tr>
            `).join("")}
            <tr>
              <td><strong>Saúde da Bateria</strong></td>
              <td colspan="3">${formData.saudeBateria}%</td>
            </tr>
          </tbody>
        </table>
        
        <div class="declarations">
          <div class="section-title">DECLARAÇÕES DO CLIENTE</div>
          <div class="declaration-item">
            Declaro que removi todas as minhas informações pessoais do dispositivo antes da entrega: 
            <strong>( ${declarations.removeuDados ? "X" : " "} ) Sim  ( ${!declarations.removeuDados ? "X" : " "} ) Não</strong>
          </div>
          <div class="declaration-item">
            Declaro que estou transferindo a propriedade do meu aparelho: 
            <strong>( ${declarations.transferePropriedade ? "X" : " "} ) Sim  ( ${!declarations.transferePropriedade ? "X" : " "} ) Não</strong>
          </div>
        </div>
        
        <div class="signatures">
          <div class="signature-box">
            ${employeeSignature ? `<img src="${employeeSignature}" class="signature-image" />` : ""}
            <div class="signature-line">
              <strong>Assinatura do Vendedor</strong><br>
              ${formData.consultor}
            </div>
          </div>
          <div class="signature-box">
            ${customerSignature ? `<img src="${customerSignature}" class="signature-image" />` : ""}
            <div class="signature-line">
              <strong>Assinatura do Cliente</strong><br>
              ${formData.cliente}<br>
              CPF: ${formData.cpf}
            </div>
          </div>
        </div>
        
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSave = async () => {
    if (!formData.cliente || !formData.imei || !formData.aparelho) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    
    try {
      const res = await fetch("/api/retail/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imei: formData.imei,
          brand: formData.aparelho.split(" ")[0],
          model: formData.aparelho,
          customerName: formData.cliente,
          customerCpf: formData.cpf,
          estimatedValue: formData.valor.replace(/[^\d,]/g, "").replace(",", "."),
          batteryHealth: parseInt(formData.saudeBateria) || null,
          status: "pending",
          notes: JSON.stringify({
            senha: formData.senha,
            consultor: formData.consultor,
            venda: formData.venda,
            parts,
            checklist,
            declarations,
          }),
        }),
      });
      
      if (res.ok) {
        const evaluation = await res.json();
        
        if (customerSignature) {
          await fetch("/api/retail/transfer-documents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              evaluationId: evaluation.id,
              customerName: formData.cliente,
              customerCpf: formData.cpf,
              deviceBrand: formData.aparelho.split(" ")[0],
              deviceModel: formData.aparelho,
              deviceImei: formData.imei,
              agreedValue: formData.valor.replace(/[^\d,]/g, "").replace(",", ".") || "0",
              customerSignature,
              employeeSignature,
              employeeName: formData.consultor,
              termsAccepted: declarations.transferePropriedade,
            }),
          });
        }
        
        toast({ title: "Avaliação salva com sucesso!" });
        onSave?.(evaluation);
        onClose();
      }
    } catch (error) {
      toast({ title: "Erro ao salvar avaliação", variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-auto">
      <div className="max-w-5xl mx-auto p-6" ref={printRef}>
        <div className="flex items-center justify-between mb-6 print:hidden">
          <h1 className="text-2xl font-bold">Checklist de Avaliação - Trade-In</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowEvaluationPicker(true)} data-testid="btn-load-evaluation">
              <FileText className="h-4 w-4 mr-2" />
              Carregar Avaliação
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </Button>
            <Button variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showEvaluationPicker && (
          <Card className="mb-6 border-blue-500 border-2">
            <CardHeader className="pb-2 bg-blue-50 dark:bg-blue-950">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Selecionar Avaliação Existente
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowEvaluationPicker(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {loadingEvaluations ? (
                <p className="text-center text-muted-foreground py-4">Carregando avaliações...</p>
              ) : availableEvaluations.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Nenhuma avaliação pendente ou aprovada encontrada.</p>
              ) : (
                <div className="grid gap-2 max-h-60 overflow-y-auto">
                  {availableEvaluations.map((evaluation) => (
                    <div
                      key={evaluation.id}
                      className="p-3 border rounded-lg hover:bg-accent cursor-pointer flex items-center justify-between"
                      onClick={() => loadEvaluationData(evaluation)}
                      data-testid={`evaluation-item-${evaluation.id}`}
                    >
                      <div>
                        <p className="font-medium">{evaluation.brand} {evaluation.model}</p>
                        <p className="text-sm text-muted-foreground">IMEI: {evaluation.imei}</p>
                        <p className="text-sm text-muted-foreground">Cliente: {evaluation.customerName || "Não informado"}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">
                          R$ {parseFloat(evaluation.estimatedValue || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          evaluation.status === "approved" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {evaluation.status === "approved" ? "Aprovado" : "Pendente"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Dados Gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label>Data</Label>
                <Input 
                  value={formData.data} 
                  onChange={(e) => setFormData({...formData, data: e.target.value})}
                />
              </div>
              <div>
                <Label>Senha</Label>
                <Input 
                  value={formData.senha} 
                  onChange={(e) => setFormData({...formData, senha: e.target.value})}
                  placeholder="Senha do atendimento"
                />
              </div>
              <div>
                <Label>Consultor</Label>
                <Input 
                  value={formData.consultor} 
                  onChange={(e) => setFormData({...formData, consultor: e.target.value})}
                  placeholder="Nome do vendedor"
                />
              </div>
              <div>
                <Label>Venda</Label>
                <Input 
                  value={formData.venda} 
                  onChange={(e) => setFormData({...formData, venda: e.target.value})}
                  placeholder="Nº da venda"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div ref={personSearchRef} className="relative">
                <Label>Cliente *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    value={formData.cliente} 
                    onChange={(e) => {
                      setFormData({...formData, cliente: e.target.value});
                      if (selectedPersonId) setSelectedPersonId(null);
                    }}
                    placeholder="Digite para buscar cliente..."
                    className="pl-9"
                  />
                </div>
                {showPersonDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredPersons.map((person) => (
                      <div
                        key={person.id}
                        className="px-3 py-2 hover:bg-accent cursor-pointer flex items-center gap-2"
                        onClick={() => selectPerson(person)}
                      >
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{person.fullName}</div>
                          <div className="text-xs text-muted-foreground">{person.cpfCnpj}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label>CPF</Label>
                <Input 
                  value={formData.cpf} 
                  onChange={(e) => setFormData({...formData, cpf: e.target.value})}
                  placeholder="000.000.000-00"
                  readOnly={!!selectedPersonId}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Aparelho *</Label>
                <Input 
                  value={formData.aparelho} 
                  onChange={(e) => setFormData({...formData, aparelho: e.target.value})}
                  placeholder="iPhone 13 Pro Max 256GB"
                />
              </div>
              <div>
                <Label>IMEI *</Label>
                <Input 
                  value={formData.imei} 
                  onChange={(e) => setFormData({...formData, imei: e.target.value})}
                  placeholder="000000000000000"
                />
              </div>
              <div>
                <Label>Valor</Label>
                <Input 
                  value={formData.valor} 
                  onChange={(e) => setFormData({...formData, valor: e.target.value})}
                  placeholder="R$ 2.500,00"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Valor do Aparelho e Peças – Relatório Interno</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {parts.map((part, idx) => (
                <div key={idx} className="space-y-2 p-3 border rounded-lg">
                  <div>
                    <Label className="text-xs">Peça {idx + 1}</Label>
                    <Input 
                      value={part.peca}
                      onChange={(e) => updatePart(idx, "peca", e.target.value)}
                      placeholder="Nome da peça"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Valor</Label>
                    <Input 
                      value={part.valor}
                      onChange={(e) => updatePart(idx, "valor", e.target.value)}
                      placeholder="R$ 0,00"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="pb-4 bg-muted/50">
            <CardTitle className="text-sm font-normal">
              <strong>TERMO DE TRANSFERÊNCIA DE PROPRIEDADE DO APARELHO (CONTINGÊNCIA)</strong>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground text-justify">
              Na condição de proprietário do aparelho acima descrito, declaro, por livre e espontânea vontade, 
              a boa procedência do equipamento, transferindo neste ato sua propriedade à SUPERSTORE. 
              Declaro que o aparelho não contém dados pessoais ou de terceiros. 
              Autorizo expressamente que, caso sejam encontrados quaisquer dados no dispositivo, 
              seja realizada a remoção e destruição definitiva das informações, sem possibilidade de recuperação. 
              Reconheço que esta decisão é irrevogável e assumo total responsabilidade por ela.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Checklist de Avaliação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Descrição</th>
                    <th className="w-16 text-center p-3 font-medium">Sim</th>
                    <th className="w-16 text-center p-3 font-medium">Não</th>
                    <th className="w-48 text-left p-3 font-medium">Observações</th>
                  </tr>
                </thead>
                <tbody>
                  {checklist.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-3">{item.description}</td>
                      <td className="p-2 text-center">
                        <Checkbox 
                          checked={item.value === "sim"}
                          onCheckedChange={() => updateChecklist(item.id, "value", item.value === "sim" ? "" : "sim")}
                        />
                      </td>
                      <td className="p-2 text-center">
                        <Checkbox 
                          checked={item.value === "nao"}
                          onCheckedChange={() => updateChecklist(item.id, "value", item.value === "nao" ? "" : "nao")}
                        />
                      </td>
                      <td className="p-2">
                        <Input 
                          value={item.observation}
                          onChange={(e) => updateChecklist(item.id, "observation", e.target.value)}
                          placeholder="Obs..."
                          className="h-8 text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t bg-muted/30">
                    <td className="p-3 font-medium">Saúde da Bateria</td>
                    <td colSpan={3} className="p-2">
                      <div className="flex items-center gap-2">
                        <Input 
                          type="number"
                          min="0"
                          max="100"
                          value={formData.saudeBateria}
                          onChange={(e) => setFormData({...formData, saudeBateria: e.target.value})}
                          placeholder="85"
                          className="w-24 h-8"
                        />
                        <span className="text-muted-foreground">%</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Declarações do Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <Checkbox 
                id="removeuDados"
                checked={declarations.removeuDados}
                onCheckedChange={(v) => setDeclarations({...declarations, removeuDados: v === true})}
              />
              <Label htmlFor="removeuDados" className="flex-1 cursor-pointer">
                Declaro que removi todas as minhas informações pessoais do dispositivo antes da entrega
              </Label>
            </div>
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <Checkbox 
                id="transferePropriedade"
                checked={declarations.transferePropriedade}
                onCheckedChange={(v) => setDeclarations({...declarations, transferePropriedade: v === true})}
              />
              <Label htmlFor="transferePropriedade" className="flex-1 cursor-pointer">
                Declaro que estou transferindo a propriedade do meu aparelho
              </Label>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Assinaturas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-3">Assinatura do Vendedor</h4>
                {employeeSignature ? (
                  <div className="text-center">
                    <img src={employeeSignature} alt="Assinatura do Vendedor" className="max-h-24 mx-auto border rounded" />
                    <Button variant="outline" size="sm" onClick={() => setEmployeeSignature(null)} className="mt-2">
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Refazer
                    </Button>
                  </div>
                ) : isSigningEmployee ? (
                  <div>
                    <canvas
                      ref={employeeCanvasRef}
                      width={350}
                      height={120}
                      className="border rounded bg-white cursor-crosshair w-full"
                      onMouseDown={(e) => startDrawing(e, employeeCanvasRef.current)}
                      onMouseMove={(e) => draw(e, employeeCanvasRef.current)}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={(e) => startDrawing(e, employeeCanvasRef.current)}
                      onTouchMove={(e) => draw(e, employeeCanvasRef.current)}
                      onTouchEnd={stopDrawing}
                    />
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline" onClick={() => clearSignature(false)}>
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Limpar
                      </Button>
                      <Button size="sm" onClick={() => saveSignature(false)}>
                        Confirmar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsSigningEmployee(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => setIsSigningEmployee(true)} className="w-full h-24">
                    <Pen className="h-5 w-5 mr-2" />
                    Clique para assinar
                  </Button>
                )}
                <p className="text-sm text-muted-foreground mt-2 text-center">{formData.consultor || "Nome do vendedor"}</p>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-3">Assinatura do Cliente</h4>
                {customerSignature ? (
                  <div className="text-center">
                    <img src={customerSignature} alt="Assinatura do Cliente" className="max-h-24 mx-auto border rounded" />
                    <Button variant="outline" size="sm" onClick={() => setCustomerSignature(null)} className="mt-2">
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Refazer
                    </Button>
                  </div>
                ) : isSigningCustomer ? (
                  <div>
                    <canvas
                      ref={canvasRef}
                      width={350}
                      height={120}
                      className="border rounded bg-white cursor-crosshair w-full"
                      onMouseDown={(e) => startDrawing(e, canvasRef.current)}
                      onMouseMove={(e) => draw(e, canvasRef.current)}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={(e) => startDrawing(e, canvasRef.current)}
                      onTouchMove={(e) => draw(e, canvasRef.current)}
                      onTouchEnd={stopDrawing}
                    />
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline" onClick={() => clearSignature(true)}>
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Limpar
                      </Button>
                      <Button size="sm" onClick={() => saveSignature(true)}>
                        Confirmar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsSigningCustomer(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => setIsSigningCustomer(true)} className="w-full h-24">
                    <Pen className="h-5 w-5 mr-2" />
                    Clique para assinar
                  </Button>
                )}
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  {formData.cliente || "Nome do cliente"}<br />
                  CPF: {formData.cpf || "___.___.___-__"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 print:hidden">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Salvar Avaliação
          </Button>
        </div>
      </div>
    </div>
  );
}
