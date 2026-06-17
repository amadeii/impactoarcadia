import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";

const IDEModule = lazy(() => import("@/modules/ide/IDEModule"));

export default function IDE() {
  return (
    <BrowserFrame>
      <Suspense fallback={
        <div className="flex items-center justify-center h-screen bg-[#0a1628]">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
          <span className="ml-2 text-white">Carregando IDE...</span>
        </div>
      }>
        <IDEModule />
      </Suspense>
    </BrowserFrame>
  );
}
