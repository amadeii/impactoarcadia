import { Sparkles } from "lucide-react";

interface ModuleAgentBannerProps {
  module: string;
  label: string;
  description?: string;
}

export function ModuleAgentBanner({ label, description }: ModuleAgentBannerProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-lg mb-4">
      <Sparkles className="h-4 w-4 text-indigo-500 shrink-0" />
      <div className="min-w-0">
        <span className="text-sm font-medium text-indigo-700">{label}</span>
        {description && (
          <span className="text-xs text-indigo-500 ml-2">{description}</span>
        )}
      </div>
    </div>
  );
}
