/**
 * Arcádia Project Hub — Aba Field
 * Sprint HUB-07: Field Forms dinâmicos + mini-mapa GPS + workflow
 */
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  MapPin, Plus, CheckCircle2, Clock, AlertCircle,
  XCircle, FileText, Camera, Navigation, Send,
  ChevronRight, Download, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface FormField {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  unit?: string;
  placeholder?: string;
}

interface FormTemplate {
  id: string;
  form_type: string;
  label: string;
  icon: string;
  fields: FormField[];
}

interface FieldRecord {
  id: string;
  form_type: string;
  form_label?: string;
  point_id?: string;
  sequence_number: number;
  collected_by_name?: string;
  collected_at?: string;
  latitude?: number;
  longitude?: number;
  location_name?: string;
  field_data: Record<string, any>;
  status: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  review_notes?: string;
  wbs_title?: string;
}

interface MapPoint {
  id: string;
  form_type: string;
  point_id?: string;
  status: string;
  latitude: number;
  longitude: number;
  collected_by_name?: string;
}

// ── Configs ──────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  rascunho:  { label:"Rascunho",  color:"text-gray-500",  bg:"bg-gray-50 dark:bg-gray-900/30",   icon:Clock       },
  submetido: { label:"Submetido", color:"text-blue-600",  bg:"bg-blue-50 dark:bg-blue-900/20",   icon:Send        },
  revisado:  { label:"Revisado",  color:"text-amber-600", bg:"bg-amber-50 dark:bg-amber-900/20", icon:AlertCircle },
  aprovado:  { label:"Aprovado",  color:"text-green-600", bg:"bg-green-50 dark:bg-green-900/20", icon:CheckCircle2},
  rejeitado: { label:"Rejeitado", color:"text-red-600",   bg:"bg-red-50 dark:bg-red-900/20",     icon:XCircle     },
};

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";

// ── Renderizador de campo do formulário ───────────────────────────────────────
function FieldInput({
  field, value, onChange,
}: { field: FormField; value: any; onChange: (v: any) => void }) {
  const common = "w-full";

  switch (field.type) {
    case "text":
    case "number":
      return (
        <div className="relative">
          <Input
            type={field.type}
            value={value ?? ""}
            placeholder={field.placeholder}
            onChange={e => onChange(field.type === "number" ? Number(e.target.value) : e.target.value)}
            className={common}
          />
          {field.unit && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {field.unit}
            </span>
          )}
        </div>
      );

    case "textarea":
      return (
        <Textarea
          value={value ?? ""}
          placeholder={field.placeholder}
          onChange={e => onChange(e.target.value)}
          className={cn(common, "min-h-[80px]")}
        />
      );

    case "date":
      return (
        <Input type="date" value={value ?? ""} onChange={e => onChange(e.target.value)} className={common} />
      );

    case "datetime":
      return (
        <Input type="datetime-local" value={value ?? ""} onChange={e => onChange(e.target.value)} className={common} />
      );

    case "select":
      return (
        <Select value={value ?? ""} onValueChange={onChange}>
          <SelectTrigger className={common}>
            <SelectValue placeholder={`Selecionar ${field.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "multiselect":
      const selected: string[] = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-2">
          {field.options?.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                const next = selected.includes(opt)
                  ? selected.filter(s => s !== opt)
                  : [...selected, opt];
                onChange(next);
              }}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border transition-colors",
                selected.includes(opt)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:border-primary"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      );

    case "boolean":
      return (
        <div className="flex gap-3">
          {["Sim","Não","Não avaliado"].map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={cn(
                "flex-1 py-2 text-sm rounded-md border transition-colors",
                value === opt
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:border-primary"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      );

    case "coords":
      return (
        <div className="flex gap-2">
          <Input
            type="number" step="0.0001"
            placeholder="Latitude"
            value={value?.lat ?? ""}
            onChange={e => onChange({ ...value, lat: e.target.value })}
            className="flex-1"
          />
          <Input
            type="number" step="0.0001"
            placeholder="Longitude"
            value={value?.lng ?? ""}
            onChange={e => onChange({ ...value, lng: e.target.value })}
            className="flex-1"
          />
          <Button type="button" size="sm" variant="outline"
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(pos => {
                  onChange({ lat: pos.coords.latitude.toFixed(7), lng: pos.coords.longitude.toFixed(7) });
                });
              }
            }}
          >
            <Navigation className="h-4 w-4" />
          </Button>
        </div>
      );

    case "photo":
      const photos: string[] = Array.isArray(value) ? value : [];
      return (
        <div>
          <div className="flex flex-wrap gap-2 mb-2">
            {photos.map((p, i) => (
              <div key={i} className="relative h-20 w-20 rounded-lg overflow-hidden border">
                <img src={p} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => onChange(photos.filter((_, j) => j !== i))}
                  className="absolute top-0.5 right-0.5 h-5 w-5 bg-black/60 rounded-full flex items-center justify-center text-white text-xs"
                >×</button>
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground border border-dashed rounded-lg p-3 transition-colors">
            <Camera className="h-4 w-4" />
            <span>Adicionar foto</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => {
                  onChange([...photos, ev.target?.result as string]);
                };
                reader.readAsDataURL(file);
              }}
            />
          </label>
        </div>
      );

    default:
      return <Input value={value ?? ""} onChange={e => onChange(e.target.value)} className={common} />;
  }
}

// ── Modal de formulário dinâmico ──────────────────────────────────────────────
function RecordFormDialog({
  open, onClose, projectId, template, editRecord,
}: {
  open: boolean; onClose: () => void; projectId: string;
  template: FormTemplate; editRecord?: FieldRecord;
}) {
  const qc = useQueryClient();
  const [data, setData] = useState<Record<string, any>>(editRecord?.field_data ?? {});
  const [pointId, setPointId] = useState(editRecord?.point_id ?? "");
  const [notes, setNotes] = useState(editRecord?.notes ?? "");
  const [collectName, setCollectName] = useState(editRecord?.collected_by_name ?? "");
  const [coords, setCoords] = useState<{ lat?: string; lng?: string }>({
    lat: editRecord?.latitude?.toString(),
    lng: editRecord?.longitude?.toString(),
  });

  const isEdit = !!editRecord;

  const mutation = useMutation({
    mutationFn: (payload: any) => isEdit
      ? apiRequest("PATCH", `/api/hub/field-records/${editRecord!.id}`, payload)
      : apiRequest("POST", `/api/hub/projects/${projectId}/field-records`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`field-${projectId}`] });
      qc.invalidateQueries({ queryKey: [`field-map-${projectId}`] });
      onClose();
    },
  });

  const handleField = (fieldId: string, value: any) => {
    setData(d => ({ ...d, [fieldId]: value }));
  };

  const handleSave = (status: "rascunho" | "submetido") => {
    mutation.mutate({
      formType: template.form_type,
      fieldData: data,
      pointId: pointId || null,
      notes: notes || null,
      collectedByName: collectName || null,
      collectedAt: new Date().toISOString(),
      latitude: coords.lat ? parseFloat(coords.lat) : null,
      longitude: coords.lng ? parseFloat(coords.lng) : null,
      status,
    });
  };

  const requiredMissing = template.fields
    .filter(f => f.required && !data[f.id])
    .map(f => f.label);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {template.label} {pointId && <span className="text-muted-foreground font-normal">— {pointId}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Identificação */}
          <div className="grid grid-cols-2 gap-3 pb-3 border-b">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Identificação do ponto
              </label>
              <Input placeholder="PM-01, SP-03..." value={pointId}
                onChange={e => setPointId(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Responsável pela coleta
              </label>
              <Input placeholder="Nome do geólogo/técnico" value={collectName}
                onChange={e => setCollectName(e.target.value)} />
            </div>
          </div>

          {/* Campos do formulário */}
          {template.fields.map(field => (
            <div key={field.id}>
              <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                {field.label}
                {field.required && <span className="text-red-500 text-xs">*</span>}
                {field.unit && <span className="text-xs text-muted-foreground">({field.unit})</span>}
              </label>
              {field.id === "coords" ? (
                <FieldInput field={field} value={coords}
                  onChange={v => { setCoords(v); handleField(field.id, v); }} />
              ) : (
                <FieldInput field={field} value={data[field.id]}
                  onChange={v => handleField(field.id, v)} />
              )}
            </div>
          ))}

          {/* Observações gerais */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Observações gerais</label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)}
              className="min-h-[60px]" placeholder="Informações adicionais..." />
          </div>

          {/* Alertas de campos obrigatórios */}
          {requiredMissing.length > 0 && (
            <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded">
              Campos obrigatórios não preenchidos: {requiredMissing.join(", ")}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="secondary" onClick={() => handleSave("rascunho")} disabled={mutation.isPending}>
            Salvar rascunho
          </Button>
          <Button onClick={() => handleSave("submetido")}
            disabled={mutation.isPending || requiredMissing.length > 0}>
            <Send className="h-4 w-4 mr-1" />
            {mutation.isPending ? "Enviando..." : "Submeter para revisão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Cores por status ─────────────────────────────────────────────────────────
const PIN_COLORS: Record<string, string> = {
  aprovado: "#22c55e", revisado: "#f59e0b", submetido: "#3b82f6",
  rascunho: "#9ca3af", rejeitado: "#ef4444",
};

// ── FieldMap: Foto da Área + Mapa GPS ────────────────────────────────────────
interface MapConfig {
  photo: string | null;
  pins: { id: string; label: string; x: number; y: number; status?: string }[];
}

function FieldMap({
  projectId,
  gpsPoints,
  onPinClick,
}: {
  projectId: string;
  gpsPoints: MapPoint[];
  onPinClick?: (pointId: string) => void;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"foto" | "gps">("foto");
  const [addingPin, setAddingPin] = useState(false);
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null);
  const [newPinLabel, setNewPinLabel] = useState("");
  const imgRef = useRef<HTMLDivElement>(null);

  const { data: mapConfig, isLoading } = useQuery<MapConfig>({
    queryKey: [`map-config-${projectId}`],
    queryFn: () => apiRequest("GET", `/api/hub/projects/${projectId}/map-config`).then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: (body: Partial<MapConfig>) =>
      apiRequest("PATCH", `/api/hub/projects/${projectId}/map-config`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`map-config-${projectId}`] }),
  });

  const photo = mapConfig?.photo ?? null;
  const pins  = mapConfig?.pins ?? [];

  // Enriquecer pins com status dos registros GPS
  const enrichedPins = pins.map(pin => {
    const match = gpsPoints.find(g => g.point_id === pin.label);
    return { ...pin, status: match?.status ?? pin.status ?? "rascunho" };
  });

  // ── Upload de foto ─────────────────────────────────────────────────────────
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      saveMutation.mutate({ photo: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  // ── Clique na imagem para adicionar pin ───────────────────────────────────
  const handleImgClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!addingPin) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top)  / rect.height;
    setPendingPos({ x, y });
    setNewPinLabel("");
  };

  const confirmPin = () => {
    if (!pendingPos || !newPinLabel.trim()) return;
    const newPin = {
      id: `${Date.now()}`,
      label: newPinLabel.trim(),
      x: pendingPos.x,
      y: pendingPos.y,
      status: "rascunho",
    };
    saveMutation.mutate({ pins: [...pins, newPin] });
    setPendingPos(null);
    setAddingPin(false);
  };

  const removePin = (id: string) => {
    saveMutation.mutate({ pins: pins.filter(p => p.id !== id) });
  };

  // ── Mapa GPS — iframe OpenStreetMap ───────────────────────────────────────
  const gpsIframeSrc = () => {
    if (!gpsPoints.length) return null;
    const lats = gpsPoints.map(p => parseFloat(String(p.latitude)));
    const lngs = gpsPoints.map(p => parseFloat(String(p.longitude)));
    const minLat = Math.min(...lats) - 0.002;
    const maxLat = Math.max(...lats) + 0.002;
    const minLng = Math.min(...lngs) - 0.002;
    const maxLng = Math.max(...lngs) + 0.002;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng},${minLat},${maxLng},${maxLat}&layer=mapnik`;
  };

  const iframeSrc = gpsIframeSrc();

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      {/* Header com abas */}
      <div className="px-4 py-2.5 border-b flex items-center justify-between">
        <div className="flex gap-1">
          <button
            onClick={() => setTab("foto")}
            className={cn(
              "text-xs px-3 py-1.5 rounded-md font-medium transition-colors",
              tab === "foto"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            📷 Foto da Área
          </button>
          <button
            onClick={() => setTab("gps")}
            className={cn(
              "text-xs px-3 py-1.5 rounded-md font-medium transition-colors",
              tab === "gps"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            🗺️ Mapa GPS {gpsPoints.length > 0 && `(${gpsPoints.length})`}
          </button>
        </div>
        {tab === "foto" && photo && (
          <button
            onClick={() => setAddingPin(v => !v)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-md border font-medium transition-colors",
              addingPin
                ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700"
                : "border-border hover:bg-muted"
            )}
          >
            {addingPin ? "🎯 Clique para posicionar..." : "+ Adicionar ponto"}
          </button>
        )}
      </div>

      {/* ── Aba Foto da Área ─────────────────────────────────────────────── */}
      {tab === "foto" && (
        <div>
          {!photo ? (
            <label className={cn(
              "flex flex-col items-center justify-center gap-3 p-10 cursor-pointer",
              "border-2 border-dashed border-muted-foreground/20 m-3 rounded-lg",
              "hover:border-primary/40 hover:bg-muted/30 transition-colors"
            )}>
              <Camera className="h-10 w-10 text-muted-foreground/40" />
              <div className="text-center">
                <p className="text-sm font-medium">Faça upload da foto aérea ou satélite da área</p>
                <p className="text-xs text-muted-foreground mt-1">Clique para selecionar (PNG, JPG, WebP)</p>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </label>
          ) : (
            <div className="relative">
              {/* Imagem da área */}
              <div
                ref={imgRef}
                className={cn(
                  "relative overflow-hidden",
                  addingPin && "cursor-crosshair"
                )}
                onClick={handleImgClick}
              >
                <img
                  src={photo}
                  alt="Foto da área"
                  className="w-full max-h-[380px] object-contain block"
                  draggable={false}
                />

                {/* Pins sobrepostos */}
                {enrichedPins.map(pin => (
                  <div
                    key={pin.id}
                    className="absolute flex flex-col items-center"
                    style={{
                      left: `${pin.x * 100}%`,
                      top: `${pin.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                      zIndex: 10,
                    }}
                    onClick={e => { e.stopPropagation(); onPinClick?.(pin.label); }}
                  >
                    <div
                      className="w-5 h-5 rounded-full border-2 border-white shadow-lg cursor-pointer hover:scale-125 transition-transform"
                      style={{ background: PIN_COLORS[pin.status ?? "rascunho"] }}
                      title={`${pin.label} — ${STATUS_CONFIG[pin.status ?? "rascunho"]?.label}`}
                    />
                    <span className="text-[10px] font-bold text-white bg-black/60 px-1 rounded mt-0.5 leading-tight whitespace-nowrap">
                      {pin.label}
                    </span>
                  </div>
                ))}

                {/* Indicador de ponto pendente */}
                {pendingPos && (
                  <div
                    className="absolute"
                    style={{
                      left: `${pendingPos.x * 100}%`,
                      top: `${pendingPos.y * 100}%`,
                      transform: "translate(-50%,-50%)",
                      zIndex: 20,
                    }}
                  >
                    <div className="w-5 h-5 rounded-full border-2 border-white bg-amber-400 animate-pulse shadow-lg" />
                  </div>
                )}
              </div>

              {/* Dialog inline para nomear ponto pendente */}
              {pendingPos && (
                <div className="flex items-center gap-2 p-3 border-t bg-amber-50 dark:bg-amber-950/20">
                  <MapPin className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <Input
                    autoFocus
                    placeholder="PM-01, SP-03..."
                    value={newPinLabel}
                    onChange={e => setNewPinLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") confirmPin(); if (e.key === "Escape") setPendingPos(null); }}
                    className="h-8 text-sm"
                  />
                  <Button size="sm" onClick={confirmPin} disabled={!newPinLabel.trim() || saveMutation.isPending}>
                    Confirmar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPendingPos(null)}>
                    Cancelar
                  </Button>
                </div>
              )}

              {/* Rodapé: legenda + ações */}
              <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-muted-foreground">
                <div className="flex gap-3">
                  {Object.entries(PIN_COLORS).map(([s, c]) => (
                    <span key={s} className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full inline-block border border-white/30" style={{ background: c }} />
                      {STATUS_CONFIG[s]?.label}
                    </span>
                  ))}
                </div>
                <label className="cursor-pointer hover:text-foreground transition-colors ml-2">
                  <span>Trocar foto</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </label>
              </div>
            </div>
          )}

          {/* Lista de pontos marcados */}
          {enrichedPins.length > 0 && (
            <div className="border-t divide-y max-h-36 overflow-y-auto">
              {enrichedPins.map(pin => (
                <div key={pin.id} className="flex items-center gap-2 px-3 py-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: PIN_COLORS[pin.status ?? "rascunho"] }}
                  />
                  <span className="text-sm font-mono font-medium flex-1">{pin.label}</span>
                  <span className={cn("text-xs", STATUS_CONFIG[pin.status ?? "rascunho"]?.color)}>
                    {STATUS_CONFIG[pin.status ?? "rascunho"]?.label}
                  </span>
                  <button
                    onClick={() => removePin(pin.id)}
                    className="text-muted-foreground hover:text-red-500 transition-colors text-xs ml-1"
                    title="Remover ponto"
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Aba Mapa GPS ─────────────────────────────────────────────────── */}
      {tab === "gps" && (
        <div>
          {gpsPoints.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
              <Navigation className="h-8 w-8 opacity-30" />
              <p className="text-sm">Nenhum ponto com coordenadas GPS registrado</p>
              <p className="text-xs">Preencha latitude/longitude nos formulários de campo</p>
            </div>
          ) : (
            <div>
              <div className="relative" style={{ height: 320 }}>
                {iframeSrc ? (
                  <iframe
                    src={iframeSrc}
                    className="w-full h-full border-0"
                    title="Mapa de pontos"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : null}
                {/* Sobreposição de legenda no canto */}
                <div className="absolute top-2 right-2 bg-background/90 border rounded-lg p-2 text-xs space-y-1 shadow-sm">
                  {gpsPoints.map(p => (
                    <div key={p.id} className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: PIN_COLORS[p.status] ?? "#9ca3af" }}
                      />
                      <span className="font-mono">{p.point_id ?? "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Tabela GPS */}
              <div className="border-t divide-y max-h-36 overflow-y-auto">
                {gpsPoints.map(p => (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: PIN_COLORS[p.status] ?? "#9ca3af" }}
                    />
                    <span className="font-mono font-medium w-16">{p.point_id ?? "—"}</span>
                    <span className="text-muted-foreground flex-1 font-mono">
                      {parseFloat(String(p.latitude)).toFixed(6)}, {parseFloat(String(p.longitude)).toFixed(6)}
                    </span>
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}&zoom=17`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Ver ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── ViewField principal ───────────────────────────────────────────────────────
export function ViewField({ projectId, projectType }: { projectId: string; projectType: string }) {
  const qc = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [editRecord, setEditRecord] = useState<FieldRecord | undefined>();
  const [filterForm, setFilterForm] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: templates = [] } = useQuery<FormTemplate[]>({
    queryKey: [`form-templates-${projectType}`],
    queryFn: () =>
      apiRequest("GET", `/api/hub/form-templates?projectType=${projectType}`).then(r => r.json()),
  });

  const { data: recordsData, isLoading } = useQuery<{ records: FieldRecord[]; summary: any[] }>({
    queryKey: [`field-${projectId}`, filterForm, filterStatus],
    queryFn: () => {
      const p = new URLSearchParams();
      if (filterForm !== "all") p.set("formType", filterForm);
      if (filterStatus !== "all") p.set("status", filterStatus);
      return apiRequest("GET", `/api/hub/projects/${projectId}/field-records?${p}`).then(r => r.json());
    },
  });

  const { data: mapPoints = [] } = useQuery<MapPoint[]>({
    queryKey: [`field-map-${projectId}`],
    queryFn: () =>
      apiRequest("GET", `/api/hub/projects/${projectId}/field-records/map`).then(r => r.json()),
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/hub/field-records/${id}/submit`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`field-${projectId}`] }),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("POST", `/api/hub/field-records/${id}/review`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`field-${projectId}`] }),
  });

  const records = recordsData?.records ?? [];

  // Abrir formulário para novo registro
  const openNew = (template: FormTemplate) => {
    setSelectedTemplate(template);
    setEditRecord(undefined);
    setNewOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Botões de novo registro por tipo */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Novo registro de campo
        </p>
        <div className="flex flex-wrap gap-2">
          {templates.map(tpl => (
            <Button key={tpl.form_type} size="sm" variant="outline" onClick={() => openNew(tpl)}>
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              {tpl.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Mapa de campo: Foto da Área + GPS */}
      <FieldMap
        projectId={projectId}
        gpsPoints={mapPoints}
        onPinClick={(pointId) => {
          setFilterForm("all");
          setFilterStatus("all");
        }}
      />

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filterForm} onValueChange={setFilterForm}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tipo de formulário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {templates.map(t => (
              <SelectItem key={t.form_type} value={t.form_type}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([v, c]) => (
              <SelectItem key={v} value={v}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto text-sm text-muted-foreground self-center">
          {records.length} registro{records.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Lista de registros */}
      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Carregando registros...</div>
      ) : records.length === 0 ? (
        <div className="text-center py-16 border rounded-lg border-dashed">
          <MapPin className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium mb-1">Nenhum registro de campo</p>
          <p className="text-xs text-muted-foreground mb-4">
            Inicie a coleta de dados usando os botões acima
          </p>
        </div>
      ) : (
        <div className="bg-card border rounded-lg divide-y">
          {records.map(record => {
            const s = STATUS_CONFIG[record.status] ?? STATUS_CONFIG.rascunho;
            const StatusIcon = s.icon;
            const canSubmit  = record.status === "rascunho";
            const canReview  = record.status === "submetido";

            return (
              <div key={record.id} className={cn("flex items-center gap-3 px-4 py-3", s.bg)}>
                <div className={cn("h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0", s.bg)}>
                  <StatusIcon className={cn("h-4 w-4", s.color)} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium">
                      {record.form_label ?? record.form_type}
                    </span>
                    {record.point_id && (
                      <span className="text-xs font-mono text-muted-foreground">{record.point_id}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {record.collected_by_name && <span>{record.collected_by_name}</span>}
                    {record.collected_at && <span>{fmtDate(record.collected_at)}</span>}
                    {record.latitude && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" />
                        {Number(record.latitude).toFixed(4)}, {Number(record.longitude).toFixed(4)}
                      </span>
                    )}
                    {record.wbs_title && <span>{record.wbs_title}</span>}
                  </div>
                </div>

                <Badge variant="outline" className={cn("text-xs flex-shrink-0", s.color)}>
                  {s.label}
                </Badge>

                <div className="flex gap-2 flex-shrink-0">
                  {canSubmit && (
                    <Button size="sm" variant="ghost"
                      onClick={() => submitMutation.mutate(record.id)}>
                      <Send className="h-3.5 w-3.5 mr-1" /> Submeter
                    </Button>
                  )}
                  {canReview && (
                    <>
                      <Button size="sm" variant="ghost"
                        className="text-green-600"
                        onClick={() => reviewMutation.mutate({ id: record.id, status: "aprovado" })}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprovar
                      </Button>
                      <Button size="sm" variant="ghost"
                        className="text-red-600"
                        onClick={() => reviewMutation.mutate({ id: record.id, status: "rejeitado" })}>
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Rejeitar
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost"
                    onClick={() => { setEditRecord(record); setSelectedTemplate(templates.find(t => t.form_type === record.form_type) ?? null); setNewOpen(true); }}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de formulário */}
      {selectedTemplate && (
        <RecordFormDialog
          open={newOpen}
          onClose={() => { setNewOpen(false); setSelectedTemplate(null); setEditRecord(undefined); }}
          projectId={projectId}
          template={selectedTemplate}
          editRecord={editRecord}
        />
      )}
    </div>
  );
}
