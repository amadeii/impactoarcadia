import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ExternalLink, RefreshCw, AlertCircle, Brain, Loader2, Check, Sparkles, LogIn } from "lucide-react";
import { LoginBridgePopup } from "@/components/LoginBridgePopup";
import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useNavigationTracking } from "@/hooks/use-navigation-tracking";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

const CAPTURE_COOLDOWN_MS = 30 * 60 * 1000;
const AUTO_CAPTURE_DELAY_MS = 3000;


function getLastCaptureTime(url: string): number {
  try {
    const stored = localStorage.getItem('capture_timestamps');
    if (!stored) return 0;
    const timestamps = JSON.parse(stored) as Record<string, number>;
    return timestamps[url] || 0;
  } catch {
    return 0;
  }
}

function setLastCaptureTime(url: string): void {
  try {
    const stored = localStorage.getItem('capture_timestamps');
    const timestamps = stored ? JSON.parse(stored) as Record<string, number> : {};
    timestamps[url] = Date.now();
    const keys = Object.keys(timestamps);
    if (keys.length > 100) {
      const sorted = keys.sort((a, b) => timestamps[a] - timestamps[b]);
      for (let i = 0; i < 50; i++) {
        delete timestamps[sorted[i]];
      }
    }
    localStorage.setItem('capture_timestamps', JSON.stringify(timestamps));
  } catch {}
}

function canAutoCapture(url: string): boolean {
  const lastCapture = getLastCaptureTime(url);
  return Date.now() - lastCapture > CAPTURE_COOLDOWN_MS;
}

interface Application {
  id: string;
  name: string;
  category: string;
  icon: string;
  status: string;
  url?: string;
  description?: string;
}

function normalizeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function isExternalUrl(url: string): boolean {
  if (url.startsWith("/")) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname !== window.location.hostname;
  } catch {
    return false;
  }
}

function getProxiedUrl(url: string): string {
  if (!isExternalUrl(url)) return url;
  return `/api/proxy/frame?url=${encodeURIComponent(url)}`;
}

export default function AppViewer() {
  const [, params] = useRoute("/app/:id");
  const [, navigate] = useLocation();
  const appId = params?.id;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showCaptureDialog, setShowCaptureDialog] = useState(false);
  const [captureResult, setCaptureResult] = useState<any>(null);
  const [extractRequirements, setExtractRequirements] = useState(true);
  const [showLoginBridge, setShowLoginBridge] = useState(false);
  const [loginPending, setLoginPending] = useState(false);
  const [useDirectMode, setUseDirectMode] = useState(false);
  const [externalWindow, setExternalWindow] = useState<Window | null>(null);
  const [externalMode, setExternalMode] = useState(false);
  const { trackAppOpen, trackSiteNavigation, trackIframeInteraction } = useNavigationTracking();
  const { toast } = useToast();

  const { data: app, isLoading: appLoading } = useQuery<Application>({
    queryKey: ["/api/applications", appId],
    queryFn: async () => {
      const res = await fetch(`/api/applications/${appId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch application");
      return res.json();
    },
    enabled: !!appId,
  });

  const normalizedUrl = useMemo(() => normalizeUrl(app?.url), [app?.url]);
  const proxiedUrl = useMemo(() => normalizedUrl ? getProxiedUrl(normalizedUrl) : undefined, [normalizedUrl]);
  const isExternal = useMemo(() => normalizedUrl ? isExternalUrl(normalizedUrl) : false, [normalizedUrl]);

  const captureMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/learning/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          url: normalizedUrl,
          appName: app?.name,
          extractRequirements,
          context: `Aplicativo: ${app?.name}, Categoria: ${app?.category}`
        })
      });
      if (!res.ok) throw new Error("Falha na captura");
      return res.json();
    },
    onSuccess: (data) => {
      setCaptureResult(data);
      setShowCaptureDialog(true);
      toast({
        title: "Conhecimento capturado!",
        description: `${data.word_count} palavras extraídas de ${data.title || app?.name}`,
      });
    },
    onError: () => {
      toast({
        title: "Erro na captura",
        description: "Não foi possível capturar o conteúdo da página",
        variant: "destructive"
      });
    }
  });

  useEffect(() => {
    if (app && normalizedUrl) {
      trackAppOpen(app.name, normalizedUrl, app.category);
      trackSiteNavigation(app.name, normalizedUrl);
    }
  }, [app, normalizedUrl, trackAppOpen, trackSiteNavigation]);

  const autoCaptureSilent = useCallback(async () => {
    if (!normalizedUrl || !app) return;
    if (!canAutoCapture(normalizedUrl)) {
      console.debug('[AutoCapture] Skipped - within cooldown for', normalizedUrl);
      return;
    }
    try {
      const res = await fetch("/api/learning/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          url: normalizedUrl,
          appName: app.name,
          extractRequirements: false,
          context: `Captura automática: ${app.name}`
        })
      });
      if (res.ok) {
        setLastCaptureTime(normalizedUrl);
        const data = await res.json();
        console.debug('[AutoCapture] Success:', data.word_count, 'words from', data.title);
      }
    } catch (err) {
      console.debug('[AutoCapture] Failed silently:', err);
    }
  }, [normalizedUrl, app]);

  const handleIframeLoad = () => {
    setIsLoading(false);
    if (app && normalizedUrl) {
      trackIframeInteraction(app.name, normalizedUrl, "iframe_loaded");
      setTimeout(() => {
        autoCaptureSilent();
      }, AUTO_CAPTURE_DELAY_MS);
    }
  };

  const handleRefresh = () => {
    if (iframeRef.current && proxiedUrl) {
      setIsLoading(true);
      setHasError(false);
      iframeRef.current.src = proxiedUrl;
    }
  };

  const handleOpenExternal = () => {
    if (normalizedUrl) {
      window.open(normalizedUrl, "_blank");
    }
  };

  const handleOpenExternalWithTracking = () => {
    if (normalizedUrl) {
      const win = window.open(normalizedUrl, `arcadia_${app?.name || 'app'}`);
      if (win) {
        setExternalWindow(win);
        setExternalMode(true);
        toast({
          title: "Navegador externo aberto",
          description: "Use o botão 'Capturar' para salvar o conhecimento da página atual.",
        });
      }
    }
  };

  const handleCaptureExternal = async () => {
    if (!normalizedUrl || !app) return;
    
    captureMutation.mutate();
  };

  // Auto-capture em modo externo - captura a cada 30 segundos
  const [autoCapturing, setAutoCapturing] = useState(false);
  const [captureCount, setCaptureCount] = useState(0);
  const autoCaptureIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startAutoCapture = () => {
    if (autoCaptureIntervalRef.current) return;
    
    setAutoCapturing(true);
    toast({
      title: "Monitoramento ativo",
      description: "Capturando conhecimento automaticamente a cada 30 segundos.",
    });

    // Captura inicial
    handleCaptureExternal();
    setCaptureCount(1);

    // Intervalo de captura
    autoCaptureIntervalRef.current = setInterval(() => {
      handleCaptureExternal();
      setCaptureCount(c => c + 1);
    }, 30000); // 30 segundos
  };

  const stopAutoCapture = () => {
    if (autoCaptureIntervalRef.current) {
      clearInterval(autoCaptureIntervalRef.current);
      autoCaptureIntervalRef.current = null;
    }
    setAutoCapturing(false);
    toast({
      title: "Monitoramento pausado",
      description: `${captureCount} capturas realizadas.`,
    });
  };

  // Limpar intervalo ao desmontar ou sair do modo externo
  useEffect(() => {
    return () => {
      if (autoCaptureIntervalRef.current) {
        clearInterval(autoCaptureIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!externalMode && autoCaptureIntervalRef.current) {
      clearInterval(autoCaptureIntervalRef.current);
      autoCaptureIntervalRef.current = null;
      setAutoCapturing(false);
    }
  }, [externalMode]);

  if (appLoading) {
    return (
      <BrowserFrame>
        <div className="h-full flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-slate-500">Carregando aplicativo...</p>
          </div>
        </div>
      </BrowserFrame>
    );
  }

  if (!app) {
    return (
      <BrowserFrame>
        <div className="h-full flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-700 mb-2">Aplicativo não encontrado</h2>
            <Button variant="outline" onClick={() => navigate("/")}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Voltar para Início
            </Button>
          </div>
        </div>
      </BrowserFrame>
    );
  }

  if (!normalizedUrl) {
    return (
      <BrowserFrame>
        <div className="h-full flex items-center justify-center bg-slate-50">
          <div className="text-center max-w-md">
            <div className={`w-16 h-16 rounded-xl ${app.icon} flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4`}>
              {app.name[0]}
            </div>
            <h2 className="text-xl font-semibold text-slate-700 mb-2">{app.name}</h2>
            <p className="text-slate-500 mb-4">{app.description || "Este aplicativo não possui uma URL configurada."}</p>
            <Button variant="outline" onClick={() => navigate("/")}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Voltar para Início
            </Button>
          </div>
        </div>
      </BrowserFrame>
    );
  }

  return (
    <BrowserFrame>
      <div className="h-full flex flex-col bg-white">
        <div className="flex items-center gap-3 px-4 py-2 border-b bg-slate-50 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")} data-testid="back-button">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className={`w-8 h-8 rounded-lg ${app.icon} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
            {app.name[0]}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">{app.name}</span>
              <span className="text-xs text-slate-400 truncate hidden sm:inline">{normalizedUrl}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isExternal && (
              <>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2 gap-1 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                  onClick={() => setShowLoginBridge(true)}
                  data-testid="login-bridge-button"
                >
                  <LogIn className="h-4 w-4" />
                  <span className="hidden sm:inline text-xs">Login</span>
                </Button>
                <Button 
                  variant={externalMode ? "default" : "ghost"}
                  size="sm" 
                  className={`h-8 px-2 gap-1 text-xs ${externalMode ? 'bg-green-600 hover:bg-green-700 text-white' : 'text-green-600 hover:bg-green-50'}`}
                  onClick={handleOpenExternalWithTracking}
                  data-testid="external-mode-button"
                  title="Abrir em janela externa com captura de conhecimento"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="hidden sm:inline">Janela</span>
                </Button>
              </>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 px-2 gap-1 text-purple-600 hover:bg-purple-50 hover:text-purple-700"
              onClick={() => captureMutation.mutate()}
              disabled={captureMutation.isPending}
              data-testid="capture-button"
            >
              {captureMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Brain className="h-4 w-4" />
              )}
              <span className="hidden sm:inline text-xs">Capturar</span>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh} data-testid="refresh-button">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleOpenExternal} data-testid="external-button">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
                <p className="text-sm text-slate-500">Carregando {app.name}...</p>
              </div>
            </div>
          )}

          {(hasError || externalMode) && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 z-10">
              <div className="text-center max-w-lg px-6">
                <div className={`w-20 h-20 rounded-2xl ${app.icon} flex items-center justify-center text-white text-3xl font-bold mx-auto mb-6 shadow-lg`}>
                  {app.name[0]}
                </div>
                
                <h2 className="text-2xl font-bold text-slate-800 mb-2">{app.name}</h2>
                <p className="text-slate-500 mb-6">
                  {externalMode 
                    ? "Navegando em janela externa. O Arcadia está monitorando e pode capturar conhecimento."
                    : "Este site funciona melhor em janela externa."}
                </p>

                <div className="bg-white rounded-xl p-6 shadow-lg border space-y-4">
                  {!externalMode ? (
                    <>
                      <Button 
                        onClick={handleOpenExternalWithTracking} 
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        size="lg"
                      >
                        <ExternalLink className="h-5 w-5 mr-2" />
                        Abrir {app.name} em Nova Janela
                      </Button>
                      <p className="text-xs text-slate-400">
                        O Arcadia continua ativo e pode capturar o que você está vendo
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-center gap-2 text-green-600 mb-4">
                        <div className={`w-3 h-3 rounded-full ${autoCapturing ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
                        <span className="font-medium">
                          {autoCapturing ? `Monitorando... (${captureCount} capturas)` : 'Janela externa ativa'}
                        </span>
                      </div>

                      {!autoCapturing ? (
                        <Button 
                          onClick={startAutoCapture}
                          className="w-full bg-green-600 hover:bg-green-700"
                          size="lg"
                        >
                          <Brain className="h-5 w-5 mr-2" />
                          Iniciar Monitoramento Automático
                        </Button>
                      ) : (
                        <Button 
                          onClick={stopAutoCapture}
                          variant="outline"
                          className="w-full border-red-300 text-red-600 hover:bg-red-50"
                          size="lg"
                        >
                          <AlertCircle className="h-5 w-5 mr-2" />
                          Pausar Monitoramento
                        </Button>
                      )}

                      <div className="text-xs text-slate-500 text-center py-2">
                        {autoCapturing 
                          ? "Capturando automaticamente a cada 30 segundos"
                          : "O motor vai capturar conhecimento enquanto você navega"}
                      </div>
                      
                      <Button 
                        onClick={handleCaptureExternal}
                        variant="outline"
                        className="w-full"
                        disabled={captureMutation.isPending}
                      >
                        {captureMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Brain className="h-4 w-4 mr-2" />
                        )}
                        Capturar Agora (Manual)
                      </Button>
                      
                      <Button 
                        onClick={handleOpenExternalWithTracking}
                        variant="ghost"
                        className="w-full text-slate-500"
                        size="sm"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Reabrir Janela
                      </Button>
                    </>
                  )}
                </div>

                {externalMode && (
                  <p className="text-xs text-slate-400 mt-4">
                    Navegue normalmente na janela externa. Clique em "Capturar" a qualquer momento para salvar o conteúdo na base de conhecimento.
                  </p>
                )}
              </div>
            </div>
          )}

          <iframe
            ref={iframeRef}
            src={useDirectMode ? normalizedUrl : proxiedUrl}
            className="w-full h-full border-0"
            title={app.name}
            onLoad={handleIframeLoad}
            onError={() => { setIsLoading(false); setHasError(true); }}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-top-navigation-by-user-activation"
            data-testid="app-iframe"
          />

          {/* Botão flutuante para concluir login */}
          {loginPending && (
            <div className="absolute bottom-4 right-4 z-50 animate-bounce">
              <Button 
                onClick={() => setShowLoginBridge(true)}
                className="bg-green-600 hover:bg-green-700 text-white shadow-lg rounded-full px-6 py-6 text-lg font-bold"
                size="lg"
              >
                <Check className="h-6 w-6 mr-2" />
                Concluir Login
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showCaptureDialog} onOpenChange={setShowCaptureDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Conhecimento Capturado
            </DialogTitle>
            <DialogDescription>
              Conteúdo extraído de {captureResult?.title || app?.name}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 p-1">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-purple-600">{captureResult?.word_count || 0}</p>
                  <p className="text-xs text-slate-500">Palavras</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-600">{captureResult?.headings_count || 0}</p>
                  <p className="text-xs text-slate-500">Títulos</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-600">{captureResult?.links_count || 0}</p>
                  <p className="text-xs text-slate-500">Links</p>
                </div>
              </div>

              {captureResult?.screenshot_base64 && (
                <div>
                  <p className="text-sm font-medium mb-2">Preview da Página</p>
                  <img 
                    src={`data:image/png;base64,${captureResult.screenshot_base64}`}
                    alt="Screenshot"
                    className="w-full rounded-lg border shadow-sm"
                  />
                </div>
              )}

              {captureResult?.extraction && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    <p className="text-sm font-medium">Análise com IA</p>
                  </div>
                  
                  {captureResult.extraction.RESUMO && (
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <p className="text-xs font-medium text-purple-700 mb-1">Resumo</p>
                      <p className="text-sm text-slate-700">{captureResult.extraction.RESUMO}</p>
                    </div>
                  )}

                  {captureResult.extraction.FUNCIONALIDADES && (
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-xs font-medium text-blue-700 mb-2">Funcionalidades Identificadas</p>
                      <div className="flex flex-wrap gap-1">
                        {(Array.isArray(captureResult.extraction.FUNCIONALIDADES) 
                          ? captureResult.extraction.FUNCIONALIDADES 
                          : [captureResult.extraction.FUNCIONALIDADES]
                        ).map((func: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs">{func}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {captureResult.extraction.REQUISITOS && (
                    <div className="bg-green-50 p-3 rounded-lg">
                      <p className="text-xs font-medium text-green-700 mb-2">Requisitos Detectados</p>
                      <ul className="text-sm text-slate-700 space-y-1">
                        {(Array.isArray(captureResult.extraction.REQUISITOS) 
                          ? captureResult.extraction.REQUISITOS 
                          : [captureResult.extraction.REQUISITOS]
                        ).map((req: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                            <span>{req}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {captureResult.extraction.TERMOS_CHAVE && (
                    <div>
                      <p className="text-xs font-medium text-slate-600 mb-2">Termos-Chave</p>
                      <div className="flex flex-wrap gap-1">
                        {(Array.isArray(captureResult.extraction.TERMOS_CHAVE) 
                          ? captureResult.extraction.TERMOS_CHAVE 
                          : [captureResult.extraction.TERMOS_CHAVE]
                        ).map((term: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">{term}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-3 border-t">
                <p className="text-xs text-slate-500 text-center">
                  Este conteúdo foi salvo na Base de Conhecimento e está disponível para consulta no módulo Cientista.
                </p>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {normalizedUrl && app && (
        <LoginBridgePopup
          isOpen={showLoginBridge}
          onClose={() => setShowLoginBridge(false)}
          targetUrl={normalizedUrl}
          appName={app.name}
          onLoginComplete={() => {
            setLoginPending(false);
            handleRefresh();
          }}
          onLoginPending={setLoginPending}
        />
      )}
    </BrowserFrame>
  );
}
