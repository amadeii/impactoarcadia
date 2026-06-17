// Sprint C10 — G14 Estado global do exercício fiscal selecionado.
// Persistido em localStorage por clienteId. Default = ano atual.

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, createElement } from "react";

interface Ctx {
  ano: number;
  setAno: (ano: number) => void;
  clienteId: string | null;
  setClienteId: (id: string | null) => void;
}

const ExercicioCtx = createContext<Ctx | null>(null);
const KEY_PREFIX = "control:exercicio:";

export function ExercicioProvider({ children }: { children: ReactNode }) {
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [ano, setAnoState] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    if (!clienteId) return;
    try {
      const stored = localStorage.getItem(KEY_PREFIX + clienteId);
      if (stored) {
        const n = Number(stored);
        if (n > 1900 && n < 2200) setAnoState(n);
      }
    } catch { /* ignore */ }
  }, [clienteId]);

  const setAno = useCallback((novo: number) => {
    setAnoState(novo);
    if (clienteId) {
      try { localStorage.setItem(KEY_PREFIX + clienteId, String(novo)); } catch { /* ignore */ }
    }
  }, [clienteId]);

  return createElement(ExercicioCtx.Provider, { value: { ano, setAno, clienteId, setClienteId } }, children);
}

export function useExercicio() {
  const ctx = useContext(ExercicioCtx);
  if (!ctx) {
    // Fallback gracioso quando usado fora do provider (ex.: páginas standalone).
    const ano = new Date().getFullYear();
    return { ano, setAno: () => {}, clienteId: null, setClienteId: () => {} };
  }
  return ctx;
}
