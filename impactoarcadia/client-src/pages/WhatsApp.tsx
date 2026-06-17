import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Smartphone,
  QrCode,
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Send,
  Phone,
  MessageSquare,
  Wifi,
  WifiOff,
  LogOut
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import QRCode from "qrcode";

interface WhatsAppStatus {
  status: "disconnected" | "connecting" | "qr_pending" | "connected";
  qrCode: string | null;
  phoneNumber: string | null;
}

async function fetchStatus(): Promise<WhatsAppStatus> {
  const response = await fetch("/api/whatsapp/status", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch status");
  return response.json();
}

async function connectWhatsApp(): Promise<WhatsAppStatus> {
  const response = await fetch("/api/whatsapp/connect", {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to connect");
  return response.json();
}

async function disconnectWhatsApp(): Promise<void> {
  const response = await fetch("/api/whatsapp/disconnect", {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to disconnect");
}

export default function WhatsApp() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ["whatsapp-status"],
    queryFn: fetchStatus,
    refetchInterval: isPolling ? 2000 : false,
  });

  const connectMutation = useMutation({
    mutationFn: connectWhatsApp,
    onSuccess: (data) => {
      setIsPolling(true);
      if (data.qrCode) {
        generateQrDataUrl(data.qrCode);
      }
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectWhatsApp,
    onSuccess: () => {
      setIsPolling(false);
      setQrDataUrl(null);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
    },
  });

  const generateQrDataUrl = async (qr: string) => {
    try {
      const url = await QRCode.toDataURL(qr, { 
        width: 256,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" }
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error("QR generation error:", err);
    }
  };

  useEffect(() => {
    if (status?.qrCode && status.status === "qr_pending") {
      generateQrDataUrl(status.qrCode);
    }
    if (status?.status === "connected") {
      setIsPolling(false);
      setQrDataUrl(null);
    }
  }, [status?.qrCode, status?.status]);

  const handleConnect = () => {
    connectMutation.mutate();
  };

  const handleDisconnect = () => {
    disconnectMutation.mutate();
  };

  const getStatusBadge = () => {
    switch (status?.status) {
      case "connected":
        return <Badge className="bg-green-600"><Wifi className="w-3 h-3 mr-1" /> Conectado</Badge>;
      case "connecting":
        return <Badge className="bg-yellow-600"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Conectando</Badge>;
      case "qr_pending":
        return <Badge className="bg-blue-600"><QrCode className="w-3 h-3 mr-1" /> Aguardando QR</Badge>;
      default:
        return <Badge variant="secondary"><WifiOff className="w-3 h-3 mr-1" /> Desconectado</Badge>;
    }
  };

  return (
    <BrowserFrame>
      <div className="h-full w-full flex bg-[#111b21]">
        <div className="flex-1 flex flex-col">
          <div className="h-16 bg-[#202c33] flex items-center justify-between px-6 border-b border-[#222d34]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-white font-semibold">WhatsApp Web</h1>
                <div className="flex items-center gap-2">
                  {getStatusBadge()}
                  {status?.phoneNumber && (
                    <span className="text-xs text-[#8696a0]">+{status.phoneNumber}</span>
                  )}
                </div>
              </div>
            </div>
            {status?.status === "connected" && (
              <Button 
                variant="ghost" 
                size="sm"
                className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                onClick={handleDisconnect}
                disabled={disconnectMutation.isPending}
                data-testid="button-disconnect"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Desconectar
              </Button>
            )}
          </div>

          <div className="flex-1 flex items-center justify-center p-8">
            {isLoading ? (
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-[#00a884] animate-spin mx-auto mb-4" />
                <p className="text-[#8696a0]">Carregando...</p>
              </div>
            ) : status?.status === "connected" ? (
              <Card className="bg-[#202c33] border-[#222d34] max-w-lg w-full">
                <CardHeader className="text-center">
                  <div className="w-20 h-20 rounded-full bg-green-600 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-10 h-10 text-white" />
                  </div>
                  <CardTitle className="text-white">WhatsApp Conectado</CardTitle>
                  <CardDescription className="text-[#8696a0]">
                    Seu WhatsApp está conectado ao Arcádia Suite
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-[#111b21] rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-[#00a884]" />
                      <div>
                        <p className="text-sm text-[#8696a0]">Número conectado</p>
                        <p className="text-white font-medium">+{status.phoneNumber}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#111b21] rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <MessageSquare className="w-5 h-5 text-[#00a884]" />
                      <div>
                        <p className="text-sm text-[#8696a0]">Status</p>
                        <p className="text-green-400 font-medium">Online e sincronizado</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-[#8696a0] text-center">
                    As mensagens recebidas aparecerão automaticamente no chat interno.
                  </p>
                </CardContent>
              </Card>
            ) : status?.status === "qr_pending" && qrDataUrl ? (
              <Card className="bg-[#202c33] border-[#222d34] max-w-lg w-full">
                <CardHeader className="text-center">
                  <CardTitle className="text-white">Escaneie o QR Code</CardTitle>
                  <CardDescription className="text-[#8696a0]">
                    Abra o WhatsApp no seu celular e escaneie o código abaixo
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-6">
                  <div className="bg-white p-4 rounded-lg">
                    <img 
                      src={qrDataUrl} 
                      alt="WhatsApp QR Code" 
                      className="w-64 h-64"
                      data-testid="qr-code"
                    />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-sm text-[#8696a0]">
                      1. Abra o WhatsApp no seu celular
                    </p>
                    <p className="text-sm text-[#8696a0]">
                      2. Toque em <span className="text-white">Menu</span> ou <span className="text-white">Configurações</span>
                    </p>
                    <p className="text-sm text-[#8696a0]">
                      3. Selecione <span className="text-white">Aparelhos conectados</span>
                    </p>
                    <p className="text-sm text-[#8696a0]">
                      4. Toque em <span className="text-white">Conectar um aparelho</span>
                    </p>
                    <p className="text-sm text-[#8696a0]">
                      5. Aponte seu celular para esta tela
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => refetch()}
                    className="border-[#00a884] text-[#00a884] hover:bg-[#00a884]/10"
                    data-testid="button-refresh-qr"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Atualizar QR Code
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-[#202c33] border-[#222d34] max-w-lg w-full">
                <CardHeader className="text-center">
                  <div className="w-20 h-20 rounded-full bg-[#00a884] flex items-center justify-center mx-auto mb-4">
                    <Smartphone className="w-10 h-10 text-white" />
                  </div>
                  <CardTitle className="text-white">Conectar WhatsApp</CardTitle>
                  <CardDescription className="text-[#8696a0]">
                    Conecte sua conta do WhatsApp para enviar e receber mensagens
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  <Button 
                    onClick={handleConnect}
                    disabled={connectMutation.isPending}
                    className="bg-[#00a884] hover:bg-[#00a884]/90 text-white w-full"
                    data-testid="button-connect"
                  >
                    {connectMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Gerando QR Code...
                      </>
                    ) : (
                      <>
                        <QrCode className="w-4 h-4 mr-2" />
                        Gerar QR Code
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-[#8696a0] text-center">
                    Você precisará escanear um QR Code com seu celular para conectar.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}
