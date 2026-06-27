import { useLocation } from "wouter";
import React, { useEffect, useState } from "react";
import { Bot, Settings, MessageCircle, Zap, LayoutDashboard, Compass, Users, Ticket, LogOut, User, Shield, Receipt, Layers, Building2, Store, Code2, HardHat, CheckSquare, MapPin, Truck, Factory, Wallet, BookOpen, Handshake, ClipboardList, Ruler, Package, Scissors, Bell, CheckCheck, AlertTriangle, Flag, Clock, Calendar } from "lucide-react";
import { EmpresaContextSelector } from "@/components/EmpresaContextSelector";
import { useAuth } from "@/hooks/use-auth";
import { useNavigationTracking } from "@/hooks/use-navigation-tracking";
import { useModules } from "@/hooks/useModules";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface BrowserFrameProps {
  children: React.ReactNode;
}

// ── NotificationBell (NOTIF-01) ───────────────────────────────────────────────
const NOTIF_ICONS: Record<string, any> = {
  task_due_soon:     Clock,
  milestone_overdue: Flag,
  project_stale:     AlertTriangle,
};

function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data } = useQuery<{ notifications: any[]; unreadCount: number }>({
    queryKey: ["/api/hub/notifications"],
    queryFn: () => apiRequest("GET", "/api/hub/notifications?limit=20").then(r => r.json()),
    refetchInterval: 60000, // re-busca a cada minuto
  });

  const readMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/hub/notifications/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/hub/notifications"] }),
  });

  const readAllMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/hub/notifications/read-all", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/hub/notifications"] }),
  });

  const notifications = data?.notifications ?? [];
  const unread = data?.unreadCount ?? 0;
  const [, navigate] = useLocation();

  const handleNotifClick = (notif: any) => {
    readMutation.mutate(notif.id);
    if (notif.entity_type === "task" && notif.project_id) {
      navigate(`/hub/${notif.project_id}?tab=kanban`);
    } else if (notif.entity_type === "milestone" && notif.project_id) {
      navigate(`/hub/${notif.project_id}?tab=contrato`);
    } else if (notif.project_id) {
      navigate(`/hub/${notif.project_id}`);
    }
    setOpen(false);
  };

  const fmtAge = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "agora";
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-2.5 border-b">
          <span className="text-sm font-semibold">Notificações</span>
          {unread > 0 && (
            <button
              onClick={() => readAllMutation.mutate()}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Marcar todas lidas
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma notificação
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto divide-y">
            {notifications.map(n => {
              const Icon = NOTIF_ICONS[n.type] ?? Bell;
              return (
                <button
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors",
                    !n.read && "bg-primary/5"
                  )}
                >
                  <div className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                    n.type === "task_due_soon"     ? "bg-amber-100 dark:bg-amber-900/40" :
                    n.type === "milestone_overdue" ? "bg-blue-100 dark:bg-blue-900/40"  :
                    "bg-orange-100 dark:bg-orange-900/40"
                  )}>
                    <Icon className={cn(
                      "h-3.5 w-3.5",
                      n.type === "task_due_soon"     ? "text-amber-600" :
                      n.type === "milestone_overdue" ? "text-blue-600"  :
                      "text-orange-600"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs leading-snug", !n.read && "font-semibold")}>
                      {n.title}
                    </p>
                    {n.project_code && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {n.project_code} {n.project_title ? `— ${n.project_title}` : ""}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    {fmtAge(n.created_at)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function NavItem({ href, label, icon: Icon, color, testId }: {
  href: string; label: string; icon: any; color: string; testId: string;
}) {
  const [, navigate] = useLocation();
  const { trackPageView } = useNavigationTracking();
  return (
    <div
      className="flex items-center gap-1 hover:bg-muted px-2 py-1.5 rounded cursor-pointer transition-colors flex-shrink-0"
      onClick={() => { trackPageView(label, href); navigate(href); }}
      data-testid={testId}
    >
      <div className={`w-4 h-4 bg-gradient-to-br ${color} rounded-sm flex items-center justify-center`}>
        <Icon className="w-2.5 h-2.5 text-white" />
      </div>
      <span className="hidden md:inline">{label}</span>
    </div>
  );
}

function CompactNavigationBar() {
  const [, setLocation] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { trackPageView } = useNavigationTracking();
  const modules = useModules();

  const navigateTo = (path: string, pageName: string) => {
    trackPageView(pageName, path);
    setLocation(path);
  };

  return (
    <div className="h-10 bg-background border-b border-border flex items-center px-3 gap-2 text-xs text-muted-foreground shadow-xs z-10">
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide flex-1">

        {/* Admin — apenas admin/master */}
        {(user?.role === "admin" || user?.role === "master") && (
          <div
            className="flex items-center gap-1 hover:bg-muted px-2 py-1.5 rounded cursor-pointer transition-colors flex-shrink-0"
            onClick={() => navigateTo("/admin", "Administração")}
            data-testid="bookmark-admin"
          >
            <div className="w-4 h-4 bg-gradient-to-br from-slate-700 to-slate-900 rounded-sm flex items-center justify-center">
              <Settings className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="hidden md:inline">Administração</span>
          </div>
        )}

        {/* ── CORE — sempre visíveis ── */}
        <div
          className="flex items-center gap-1 hover:bg-muted px-2 py-1.5 rounded cursor-pointer transition-colors flex-shrink-0"
          onClick={() => navigateTo("/", "Início")}
          data-testid="bookmark-home"
        >
          <div className="w-4 h-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-sm flex items-center justify-center">
            <LayoutDashboard className="w-2.5 h-2.5 text-white" aria-hidden="true" />
          </div>
          <span className="hidden md:inline">Início</span>
        </div>

        <NavItem href="/agent"      label="Agent"      icon={Bot}           color="from-primary to-blue-600"           testId="bookmark-agent" />
        <NavItem href="/xos/inbox"  label="Inbox"      icon={MessageCircle} color="from-[#00a884] to-[#25D366]"        testId="bookmark-xos-inbox" />
        <NavItem href="/automations" label="Automações" icon={Zap}          color="from-[#c89b3c] to-[#d4a94a]"        testId="bookmark-automations" />
        <NavItem href="/insights"   label="Insights"   icon={LayoutDashboard} color="from-[#1f334d] to-[#2d4a6f]"     testId="bookmark-insights" />
        {modules.showCompass && (
          <NavItem href="/hub"     label="Projetos"   icon={Compass}       color="from-[#c89b3c] to-[#1f334d]"        testId="bookmark-hub" />
        )}
        {modules.showSupporte && (
          <NavItem href="/support"    label="Suporte"    icon={Ticket}        color="from-rose-500 to-rose-700"          testId="bookmark-support" />
        )}
        <NavItem href="/soe"        label="SOE"        icon={Building2}     color="from-blue-600 to-blue-800"          testId="bookmark-soe" />
        <NavItem href="/control"    label="Control"    icon={Wallet}        color="from-sky-500 to-blue-600"           testId="bookmark-control" />
        <NavItem href="/fisco"      label="Fisco"      icon={Receipt}       color="from-emerald-600 to-emerald-800"    testId="bookmark-fisco" />
        <NavItem href="/xos" label="XOS" icon={Users} color="from-violet-500 to-violet-700" testId="bookmark-xos" />

        {/* ── SEGMENTO-DEPENDENTES ── */}
        {modules.engineering && (
          <NavItem href="/commercial-env" label="Comercial" icon={Handshake} color="from-violet-400 to-indigo-600" testId="bookmark-commercial" />
        )}
        {modules.engineering && (
          <NavItem href="/hub" label="Hub" icon={HardHat}     color="from-teal-500 to-green-700"   testId="bookmark-hub-eng" />
        )}
        {modules.quality && (
          <NavItem href="/quality"     label="Qualidade"  icon={CheckSquare} color="from-indigo-500 to-indigo-700" testId="bookmark-quality" />
        )}
        {modules.fieldOps && (
          <NavItem href="/field-ops"   label="Campo"      icon={MapPin}      color="from-orange-500 to-orange-700" testId="bookmark-field-ops" />
        )}
        {modules.suppliers && (
          <NavItem href="/suppliers"   label="Fornec."    icon={Truck}       color="from-amber-500 to-amber-700"   testId="bookmark-suppliers" />
        )}
        {modules.retail && (
          <NavItem href="/retail"      label="Retail"     icon={Store}       color="from-cyan-500 to-blue-600"     testId="bookmark-retail" />
        )}

        {/* ── SEGMENTO: decoracao_cortinas ── */}
        {modules.segment === "decoracao_cortinas" && (
          <NavItem href="/decor/pedidos" label="Decor" icon={Scissors} color="from-purple-500 to-purple-700" testId="bookmark-decor" />
        )}
        {modules.segment === "decoracao_cortinas" && (
          <NavItem href="/decor/agenda" label="Agenda" icon={Calendar} color="from-blue-500 to-blue-700" testId="bookmark-agenda" />
        )}
        {modules.production && (
          <NavItem href="/production"  label="Produção"   icon={Factory}     color="from-indigo-500 to-indigo-700" testId="bookmark-production" />
        )}
        {modules.contabil && (
          <NavItem href="/contabil"    label="Contábil"   icon={BookOpen}    color="from-slate-600 to-slate-800"   testId="bookmark-contabil" />
        )}

      </div>

      <div className="flex items-center gap-2 flex-shrink-0 border-l pl-3 ml-2">
        {/* Sino de notificações (NOTIF-01) */}
        <NotificationBell />
        <EmpresaContextSelector />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5" data-testid="button-user-menu">
              <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                {user?.name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || "U"}
              </div>
              <span className="hidden sm:inline text-xs">{user?.name || user?.username}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name || user?.username}</p>
                <p className="text-xs leading-none text-muted-foreground">@{user?.username}</p>
                {(user?.role === "admin" || user?.role === "master") && (
                  <p className="text-xs leading-none text-primary flex items-center gap-1 mt-1">
                    <Shield className="w-3 h-3" />
                    {user?.role === "master" ? "Administrador Master" : "Administrador"}
                  </p>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              <span>Meu Perfil</span>
            </DropdownMenuItem>
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Administração</DropdownMenuLabel>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => navigateTo("/usuarios", "Usuários")}
                data-testid="menu-usuarios"
              >
                <Users className="mr-2 h-4 w-4" />
                <span>Usuários</span>
              </DropdownMenuItem>
              {(user?.role === "admin" || user?.role === "master") && (
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => navigateTo("/development", "Desenvolvimento")}
                  data-testid="menu-development"
                >
                  <Code2 className="mr-2 h-4 w-4" />
                  <span>Centro de Desenvolvimento</span>
                </DropdownMenuItem>
              )}
            </>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={() => logoutMutation.mutate()}
              data-testid="button-logout"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function BrowserFrame({ children }: BrowserFrameProps) {
  return (
    <div className="flex flex-col h-screen w-screen bg-background overflow-hidden">
      <CompactNavigationBar />
      <div className="flex-1 bg-white relative overflow-y-auto overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
