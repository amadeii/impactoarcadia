import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: React.ComponentType<any>;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen bg-slate-100">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  // Wouter v3: usar children-as-function garante que ParamsContext seja
  // configurado corretamente, permitindo useParams() em todos os componentes filhos.
  // O pattern <Route component={X} /> não envolve em ParamsContext.Provider.
  return (
    <Route path={path}>
      {(params: Record<string, string>) => <Component {...params} />}
    </Route>
  );
}
