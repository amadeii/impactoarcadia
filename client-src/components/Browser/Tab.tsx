import { X, Globe, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface TabProps {
  id: string;
  title: string;
  isActive: boolean;
  favicon?: string;
  onClose: (e: React.MouseEvent) => void;
  onClick: () => void;
}

export function Tab({ id, title, isActive, favicon, onClose, onClick }: TabProps) {
  return (
    <motion.div
      layout
      initial={false}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-2 px-3 py-2 text-sm max-w-[240px] min-w-[120px] flex-1 cursor-default select-none transition-colors",
        isActive 
          ? "bg-background text-foreground rounded-t-lg shadow-sm z-10" 
          : "text-muted-foreground hover:bg-white/50 dark:hover:bg-white/5 rounded-t-lg"
      )}
    >
      {/* Divider - only show if not active and previous is not active (simplified logic for now) */}
      {!isActive && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[1px] h-4 bg-border group-hover:hidden" />
      )}

      {favicon ? (
        <img src={favicon} alt="" className="w-4 h-4 rounded-sm object-cover" />
      ) : (
        <Globe className="w-4 h-4 text-muted-foreground" />
      )}
      
      <span className="truncate flex-1 font-medium">{title}</span>
      
      <button
        onClick={onClose}
        className={cn(
          "p-0.5 rounded-full hover:bg-muted opacity-0 group-hover:opacity-100 transition-all",
          isActive && "opacity-100"
        )}
      >
        <X className="w-3 h-3" />
      </button>
    </motion.div>
  );
}
