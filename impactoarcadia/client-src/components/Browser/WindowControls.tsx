import { X, Minus, Square } from "lucide-react";

export function WindowControls() {
  return (
    <div className="flex items-center gap-2 px-4">
      <div className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center group cursor-pointer transition-colors">
        <X className="w-2 h-2 text-red-900 opacity-0 group-hover:opacity-100" />
      </div>
      <div className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 flex items-center justify-center group cursor-pointer transition-colors">
        <Minus className="w-2 h-2 text-yellow-900 opacity-0 group-hover:opacity-100" />
      </div>
      <div className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center group cursor-pointer transition-colors">
        <Square className="w-2 h-2 text-green-900 opacity-0 group-hover:opacity-100 fill-current" />
      </div>
    </div>
  );
}