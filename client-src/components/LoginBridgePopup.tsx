import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExternalLink, CheckCircle, Loader2, AlertCircle } from "lucide-react";

interface LoginBridgePopupProps {
  isOpen: boolean;
  onClose: () => void;
  targetUrl: string;
  appName: string;
  onLoginComplete: () => void;
  onLoginPending?: (pending: boolean) => void;
}

export function LoginBridgePopup({
  isOpen,
  onClose,
  targetUrl,
  appName,
  onLoginComplete,
  onLoginPending,
}: LoginBridgePopupProps) {
  const [status, setStatus] = useState<"idle" | "waiting" | "syncing" | "complete" | "error">("idle");
  const [popupWindow, setPopupWindow] = useState<Window | null>(null);

  // Notificar quando o status muda para waiting
  useEffect(() => {
    onLoginPending?.(status === "waiting");
  }, [status, onLoginPending]);

  const openLoginPopup = useCallback(() => {
    const width = 900;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      targetUrl,
      `login_${appName}`,
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=yes,status=yes`
    );

    if (popup) {
      setPopupWindow(popup);
      setStatus("waiting");

      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setPopupWindow(null);
        }
      }, 500);
    }
  }, [targetUrl, appName]);

  const handleLoginComplete = useCallback(async () => {
    setStatus("syncing");

    try {
      await fetch("/api/login-bridge/mark-logged-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          url: targetUrl,
          timestamp: Date.now()
        }),
      });

      setStatus("complete");
      
      if (popupWindow && !popupWindow.closed) {
        popupWindow.close();
      }
      
      setTimeout(() => {
        onLoginComplete();
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Failed to mark login complete:", err);
      setStatus("error");
    }
  }, [targetUrl, popupWindow, onLoginComplete, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setStatus("idle");
      if (popupWindow && !popupWindow.closed) {
        popupWindow.close();
      }
      setPopupWindow(null);
    }
  }, [isOpen, popupWindow]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Login Externo - {appName}
          </DialogTitle>
          <DialogDescription>
            Faça login na janela que será aberta e depois clique em "Concluir Login".
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {status === "idle" && (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Clique no botão abaixo para abrir a página de login em uma nova janela.
              </p>
              <Button onClick={openLoginPopup} className="w-full">
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir Página de Login
              </Button>
            </div>
          )}

          {status === "waiting" && (
            <div className="text-center space-y-4">
              <div className="bg-green-50 border-2 border-green-400 rounded-lg p-4 text-left">
                <p className="text-lg font-bold text-green-800 mb-3 text-center">Já fez login na outra janela?</p>
                <p className="text-sm text-green-700 mb-4 text-center">
                  Se você já logou no site externo, clique no botão abaixo para concluir!
                </p>
                <Button onClick={handleLoginComplete} className="w-full bg-green-600 hover:bg-green-700" size="lg">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Sim, Concluir Login!
                </Button>
              </div>
              
              <div className="text-xs text-muted-foreground border-t pt-3">
                <p className="mb-2">Ainda não logou? Siga os passos:</p>
                <ol className="text-left space-y-1 list-decimal list-inside">
                  <li>Faça login na janela que abriu</li>
                  <li>Volte para esta aba do navegador</li>
                  <li>Clique em "Concluir Login" acima</li>
                </ol>
              </div>
              
              <Button 
                onClick={openLoginPopup} 
                variant="outline" 
                size="sm"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir janela de login novamente
              </Button>
            </div>
          )}

          {status === "syncing" && (
            <div className="text-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm">Sincronizando sessão...</p>
            </div>
          )}

          {status === "complete" && (
            <div className="text-center space-y-2">
              <CheckCircle className="h-8 w-8 mx-auto text-green-500" />
              <p className="text-sm font-medium text-green-600">Login concluído!</p>
              <p className="text-xs text-muted-foreground">Recarregando o aplicativo...</p>
            </div>
          )}

          {status === "error" && (
            <div className="text-center space-y-4">
              <AlertCircle className="h-8 w-8 mx-auto text-red-500" />
              <p className="text-sm text-red-600">Erro ao sincronizar. Tente novamente.</p>
              <Button onClick={() => setStatus("idle")} variant="outline">
                Tentar Novamente
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
