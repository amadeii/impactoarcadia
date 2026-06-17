import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantStore, tenantStore, type TenantInfo } from '../hooks/useTenant';
import { apiFetch } from '../lib/apiClient';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, ChevronDown, Check, Loader2 } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  master:  'Master',
  partner: 'Parceiro',
  client:  'Cliente',
};

const TYPE_COLORS: Record<string, string> = {
  master:  'bg-purple-100 text-purple-700 border-purple-200',
  partner: 'bg-blue-100 text-blue-700 border-blue-200',
  client:  'bg-emerald-100 text-emerald-700 border-emerald-200',
};

export function TenantSwitcher() {
  const qc = useQueryClient();
  const { activeTenantId, activeTenant, tenants } = useTenantStore();

  const { data, isLoading } = useQuery({
    queryKey: ['my-tenants'],
    queryFn: async () => {
      const res = await apiFetch('/api/tenants/mine');
      if (!res.ok) throw new Error('Falha ao carregar tenants');
      return res.json() as Promise<{ tenants: TenantInfo[] }>;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!data?.tenants) return;
    tenantStore.setTenants(data.tenants);
    if (!tenantStore.getState().activeTenant) {
      const stored = tenantStore.getState().activeTenantId
        ? data.tenants.find(t => (t.tenantId ?? t.id) === tenantStore.getState().activeTenantId)
        : null;
      const toActivate = stored ?? data.tenants[0];
      if (toActivate) tenantStore.setActiveTenant(toActivate);
    }
  }, [data]);

  const switchMutation = useMutation({
    mutationFn: async (tenantId: number) => {
      const res = await apiFetch('/api/tenants/switch', {
        method: 'POST',
        body: JSON.stringify({ tenantId }),
      });
      if (!res.ok) throw new Error('Falha ao trocar tenant');
      return res.json();
    },
    onSuccess: (_data, tenantId) => {
      const tenant = tenantStore.getState().tenants.find(
        t => (t.tenantId ?? t.id) === tenantId
      );
      if (tenant) tenantStore.setActiveTenant(tenant);
      qc.invalidateQueries();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" />
      </div>
    );
  }

  if (!tenants || tenants.length <= 1) return null;

  const activeType = activeTenant?.type ?? activeTenant?.tenantType ?? 'client';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 max-w-[220px] gap-1.5 font-medium text-xs border-slate-200 hover:border-slate-300"
          data-testid="button-tenant-switcher"
        >
          <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="truncate">{activeTenant?.name ?? 'Selecionar empresa'}</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal pb-1">
          Empresas acessíveis
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          {tenants.filter(t => !t._viaPartner).map(t => {
            const id = t.tenantId ?? t.id;
            const isActive = id === activeTenantId;
            const type = t.type ?? t.tenantType ?? 'client';
            return (
              <DropdownMenuItem
                key={id}
                onClick={() => !isActive && id && switchMutation.mutate(id)}
                className="gap-2 cursor-pointer"
                data-testid={`tenant-option-${id}`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1 py-0 shrink-0 ${TYPE_COLORS[type] ?? TYPE_COLORS.client}`}
                  >
                    {TYPE_LABELS[type] ?? type}
                  </Badge>
                  <span className="truncate text-sm">{t.name}</span>
                </div>
                {isActive && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                {switchMutation.isPending && switchMutation.variables === id && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>

        {tenants.filter(t => !!t._viaPartner).length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] text-muted-foreground font-normal px-2 py-1">
              Clientes gerenciados
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {tenants.filter(t => !!t._viaPartner).map(t => {
                const id = t.tenantId ?? t.id;
                const isActive = id === activeTenantId;
                return (
                  <DropdownMenuItem
                    key={id}
                    onClick={() => !isActive && id && switchMutation.mutate(id)}
                    className="gap-2 cursor-pointer pl-5"
                    data-testid={`tenant-option-${id}`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1 py-0 shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200"
                      >
                        Cliente
                      </Badge>
                      <span className="truncate text-sm">{t.name}</span>
                    </div>
                    {isActive && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                    {switchMutation.isPending && switchMutation.variables === id && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * TenantInit — componente não-visual que inicializa o store
 * de tenant em background. Usar em App.tsx.
 */
export function TenantInit() {
  useQuery({
    queryKey: ['my-tenants-init'],
    queryFn: async () => {
      const res = await apiFetch('/api/tenants/mine');
      if (!res.ok) return null;
      const data = await res.json() as { tenants: TenantInfo[] };
      if (data?.tenants) {
        tenantStore.setTenants(data.tenants);
        const state = tenantStore.getState();
        if (!state.activeTenant && data.tenants.length > 0) {
          const stored = state.activeTenantId
            ? data.tenants.find(t => (t.tenantId ?? t.id) === state.activeTenantId)
            : null;
          tenantStore.setActiveTenant(stored ?? data.tenants[0]);
        }
      }
      return data;
    },
    staleTime: 120_000,
    retry: false,
  });

  return null;
}
