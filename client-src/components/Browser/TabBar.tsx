import { Plus } from "lucide-react";
import { Tab } from "./Tab";
import { Reorder } from "framer-motion";

interface TabData {
  id: string;
  title: string;
  url: string;
  active: boolean;
  favicon?: string;
}

interface TabBarProps {
  tabs: TabData[];
  onTabClick: (id: string) => void;
  onTabClose: (id: string) => void;
  onNewTab: () => void;
}

export function TabBar({ tabs, onTabClick, onTabClose, onNewTab }: TabBarProps) {
  return (
    <div className="flex items-end h-full w-full gap-1 overflow-x-auto no-scrollbar pt-2">
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          id={tab.id}
          title={tab.title}
          isActive={tab.active}
          favicon={tab.favicon}
          onClick={() => onTabClick(tab.id)}
          onClose={(e) => {
            e.stopPropagation();
            onTabClose(tab.id);
          }}
        />
      ))}
      <button
        onClick={onNewTab}
        className="p-2 ml-1 mb-1 rounded-full hover:bg-white/50 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}