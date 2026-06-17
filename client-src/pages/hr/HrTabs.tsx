import { Link, useLocation } from "wouter";
import { Users, Briefcase, Wallet, Clock, FileUp, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/hr/colaboradores", label: "Colaboradores", icon: Users, match: (p: string) => p.startsWith("/hr/colaboradores") || p.startsWith("/people/colaboradores") },
  { href: "/hr/cargos-departamentos", label: "Cargos & Departamentos", icon: Briefcase, match: (p: string) => p.startsWith("/hr/cargos-departamentos") || p.startsWith("/people/cargos-departamentos") },
  { href: "/hr/folha", label: "Folha", icon: Wallet, match: (p: string) => p.startsWith("/hr/folha") || p.startsWith("/people/folha") },
  { href: "/hr/ponto", label: "Ponto", icon: Clock, match: (p: string) => p.startsWith("/hr/ponto") || p.startsWith("/people/ponto") },
  { href: "/hr/importar", label: "Importar Domínio", icon: FileUp, match: (p: string) => p.startsWith("/hr/importar") || p.startsWith("/people/importar") },
  { href: "/hr/relatorios", label: "Relatórios", icon: BarChart3, match: (p: string) => p.startsWith("/hr/relatorios") || p.startsWith("/people/relatorios") },
];

export function HrTabs() {
  const [location] = useLocation();
  return (
    <div className="border-b border-border mb-4">
      <nav className="flex gap-1" aria-label="Abas RH/DP">
        {TABS.map(t => {
          const active = t.match(location);
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href}>
              <button
                data-testid={`tab-${t.href.replace(/\//g, "-")}`}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
