import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Play,
  Save,
  RefreshCw,
  Bot,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileCode,
  File,
  Share2,
  Upload,
  Sparkles,
  Send,
  X,
  Plus,
  MoreVertical,
  Search,
  GitBranch,
  Settings,
  Package,
  ExternalLink,
  Maximize2,
  Trash2,
  FilePlus,
  FolderPlus,
  Terminal,
  Eraser,
} from "lucide-react";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface OpenTab {
  path: string;
  content: string;
  unsaved: boolean;
}

export default function IDEModule() {
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["python-service", "server", "client/src"]));
  const [terminalOutput, setTerminalOutput] = useState<string[]>(["Arcádia IDE v1.0", "Digite um comando ou selecione um arquivo para começar.", "$"]);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Olá! Sou seu assistente de código. Como posso ajudar?" }
  ]);
  const [aiInput, setAiInput] = useState("");
  const [previewUrl, setPreviewUrl] = useState("about:blank");
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemParent, setNewItemParent] = useState("python-service");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<{file: string; line: number; content: string}[]>([]);
  const queryClient = useQueryClient();
  const terminalInputRef = useRef<HTMLInputElement>(null);
  const terminalScrollRef = useRef<HTMLDivElement>(null);

  const { data: files = [] } = useQuery<FileNode[]>({
    queryKey: ["/api/ide/files"],
    queryFn: async () => {
      const res = await fetch("/api/ide/files", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const readFileMutation = useMutation({
    mutationFn: async (path: string) => {
      const res = await fetch(`/api/ide/file?path=${encodeURIComponent(path)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to read file");
      return { content: await res.text(), path };
    },
    onSuccess: ({ content, path }) => {
      const exists = openTabs.some((t) => t.path === path);
      if (!exists) {
        setOpenTabs((prev) => [...prev, { path, content, unsaved: false }]);
      }
      setFileContent(content);
      setCurrentFile(path);
      setUnsavedChanges(false);
    },
  });

  const saveFileMutation = useMutation({
    mutationFn: async ({ path, content }: { path: string; content: string }) => {
      const res = await fetch("/api/ide/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, content }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to save file");
      return res.json();
    },
    onSuccess: () => {
      setUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/ide/files"] });
    },
  });

  const runCommandMutation = useMutation({
    mutationFn: async (command: string) => {
      const res = await fetch("/api/ide/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to execute command");
      return res.json();
    },
    onSuccess: (result) => {
      setTerminalOutput((prev) => [...prev, `$ ${result.command}`, result.output || result.error, "$"]);
    },
  });

  const createFileMutation = useMutation({
    mutationFn: async ({ filePath, content = "" }: { filePath: string; content?: string }) => {
      const res = await fetch("/api/ide/create-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath, content }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create file");
      return res.json();
    },
    onSuccess: (_, { filePath }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ide/files"] });
      setShowNewFileDialog(false);
      setNewItemName("");
      readFileMutation.mutate(filePath);
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async (folderPath: string) => {
      const res = await fetch("/api/ide/create-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderPath }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create folder");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ide/files"] });
      setShowNewFolderDialog(false);
      setNewItemName("");
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (filePath: string) => {
      const res = await fetch(`/api/ide/file?path=${encodeURIComponent(filePath)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete file");
      return res.json();
    },
    onSuccess: (_, filePath) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ide/files"] });
      if (currentFile === filePath) {
        setCurrentFile(null);
        setFileContent("");
      }
      setOpenTabs((prev) => prev.filter((t) => t.path !== filePath));
    },
  });

  const aiChatMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch("/api/ide/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, currentFile, currentContent: fileContent }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to get AI response");
      return res.json();
    },
    onSuccess: (result) => {
      setAiMessages((prev) => [...prev, { role: "assistant", content: result.response || "Desculpe, não consegui processar sua solicitação." }]);
    },
  });

  const handleFileClick = (path: string) => {
    if (unsavedChanges && currentFile) {
      setOpenTabs((prev) => 
        prev.map((t) => t.path === currentFile ? { ...t, content: fileContent, unsaved: true } : t)
      );
    }
    const existingTab = openTabs.find((t) => t.path === path);
    if (existingTab) {
      setCurrentFile(path);
      setFileContent(existingTab.content);
      setUnsavedChanges(existingTab.unsaved);
    } else {
      readFileMutation.mutate(path);
    }
  };

  const handleOpenFile = (path: string, content: string) => {
    const exists = openTabs.some((t) => t.path === path);
    if (!exists) {
      setOpenTabs((prev) => [...prev, { path, content, unsaved: false }]);
    }
    setCurrentFile(path);
    setFileContent(content);
    setUnsavedChanges(false);
  };

  const handleCloseTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tab = openTabs.find((t) => t.path === path);
    if (tab?.unsaved && !confirm("Descartar alterações não salvas?")) return;
    
    setOpenTabs((prev) => prev.filter((t) => t.path !== path));
    if (currentFile === path) {
      const remaining = openTabs.filter((t) => t.path !== path);
      if (remaining.length > 0) {
        const lastTab = remaining[remaining.length - 1];
        setCurrentFile(lastTab.path);
        setFileContent(lastTab.content);
        setUnsavedChanges(lastTab.unsaved);
      } else {
        setCurrentFile(null);
        setFileContent("");
        setUnsavedChanges(false);
      }
    }
  };

  const handleSave = () => {
    if (currentFile) {
      saveFileMutation.mutate({ path: currentFile, content: fileContent });
      setOpenTabs((prev) => 
        prev.map((t) => t.path === currentFile ? { ...t, content: fileContent, unsaved: false } : t)
      );
    }
  };

  const handleRun = () => {
    if (currentFile) {
      setTerminalOutput((prev) => [...prev, `Executando ${currentFile}...`]);
      if (currentFile.endsWith(".py")) {
        runCommandMutation.mutate(`python3 ${currentFile}`);
      } else if (currentFile.endsWith(".js")) {
        runCommandMutation.mutate(`node ${currentFile}`);
      } else if (currentFile.endsWith(".ts")) {
        runCommandMutation.mutate(`npx tsx ${currentFile}`);
      }
    }
  };

  const handleClearTerminal = () => {
    setTerminalOutput(["Terminal limpo.", "$"]);
  };

  const handleCreateFile = () => {
    if (!newItemName.trim()) return;
    const filePath = `${newItemParent}/${newItemName}`;
    createFileMutation.mutate({ filePath });
  };

  const handleCreateFolder = () => {
    if (!newItemName.trim()) return;
    const folderPath = `${newItemParent}/${newItemName}`;
    createFolderMutation.mutate(folderPath);
  };

  const handleDeleteFile = (path: string) => {
    if (confirm(`Tem certeza que deseja deletar ${path}?`)) {
      deleteFileMutation.mutate(path);
    }
  };

  const handleAiSend = () => {
    if (!aiInput.trim()) return;
    setAiMessages((prev) => [...prev, { role: "user", content: aiInput }]);
    aiChatMutation.mutate(aiInput);
    setAiInput("");
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const getFileIcon = (name: string) => {
    if (name.endsWith(".ts") || name.endsWith(".tsx")) return <FileCode className="h-4 w-4 text-blue-400" />;
    if (name.endsWith(".py")) return <FileCode className="h-4 w-4 text-yellow-400" />;
    if (name.endsWith(".js") || name.endsWith(".jsx")) return <FileCode className="h-4 w-4 text-yellow-300" />;
    if (name.endsWith(".json")) return <File className="h-4 w-4 text-orange-400" />;
    if (name.endsWith(".md")) return <File className="h-4 w-4 text-slate-400" />;
    return <File className="h-4 w-4 text-slate-500" />;
  };

  const getLanguage = (path: string | null): string => {
    if (!path) return "plaintext";
    if (path.endsWith(".ts") || path.endsWith(".tsx")) return "typescript";
    if (path.endsWith(".js") || path.endsWith(".jsx")) return "javascript";
    if (path.endsWith(".py")) return "python";
    if (path.endsWith(".json")) return "json";
    if (path.endsWith(".html")) return "html";
    if (path.endsWith(".css")) return "css";
    if (path.endsWith(".sql")) return "sql";
    if (path.endsWith(".md")) return "markdown";
    return "plaintext";
  };

  const renderFileTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedFolders.has(node.path);
      
      if (node.type === "directory") {
        return (
          <div key={node.path}>
            <div
              className="flex items-center gap-1 py-1 px-2 hover:bg-slate-700/50 rounded cursor-pointer text-slate-300"
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              onClick={() => toggleFolder(node.path)}
              data-testid={`folder-${node.name}`}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3 text-slate-500" />
              ) : (
                <ChevronRight className="h-3 w-3 text-slate-500" />
              )}
              {isExpanded ? (
                <FolderOpen className="h-4 w-4 text-amber-400" />
              ) : (
                <Folder className="h-4 w-4 text-amber-400" />
              )}
              <span className="text-sm truncate">{node.name}</span>
            </div>
            {isExpanded && node.children && renderFileTree(node.children, depth + 1)}
          </div>
        );
      }
      
      return (
        <div
          key={node.path}
          className={`flex items-center gap-2 py-1 px-2 hover:bg-slate-700/50 rounded cursor-pointer ${
            currentFile === node.path ? "bg-cyan-900/40 text-cyan-300" : "text-slate-400"
          }`}
          style={{ paddingLeft: `${depth * 12 + 20}px` }}
          onClick={() => handleFileClick(node.path)}
          data-testid={`file-${node.name}`}
        >
          {getFileIcon(node.name)}
          <span className="text-sm truncate">{node.name}</span>
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117]" data-testid="ide-module">
      {/* Top Toolbar */}
      <div className="h-12 bg-[#161b22] border-b border-slate-700/50 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            onClick={handleRun}
            disabled={!currentFile}
            data-testid="btn-run"
          >
            <Play className="h-4 w-4" />
            Run
          </Button>
          <Button 
            size="sm" 
            className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
            onClick={handleSave}
            disabled={!unsavedChanges}
            data-testid="btn-deploy"
          >
            <Upload className="h-4 w-4" />
            Deploy
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white gap-2">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          <Button 
            size="sm" 
            className={`gap-2 ${showAiAssistant ? 'bg-amber-500 text-black' : 'bg-slate-700 text-white'}`}
            onClick={() => setShowAiAssistant(!showAiAssistant)}
            data-testid="btn-ai-assistant"
          >
            <Sparkles className="h-4 w-4" />
            AI Assistant
          </Button>
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Icon Sidebar */}
        <div className="w-12 bg-[#0d1117] border-r border-slate-700/50 flex flex-col items-center py-3 gap-2">
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-700/50">
            <File className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-700/50">
            <Search className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-700/50">
            <GitBranch className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-700/50">
            <Package className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-700/50">
            <Settings className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-700/50">
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        {/* Resizable Panels */}
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Files Panel */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
            <div className="h-full bg-[#0d1117] flex flex-col">
              <div className="p-3 border-b border-slate-700/50 flex items-center justify-between">
                <span className="font-medium text-sm text-slate-300">Files</span>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-slate-500 hover:text-white"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/ide/files"] })}
                    title="Atualizar"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-white">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-slate-800 border-slate-700">
                      <DropdownMenuItem 
                        className="text-slate-300 hover:bg-slate-700 cursor-pointer"
                        onClick={() => setShowNewFileDialog(true)}
                      >
                        <FilePlus className="h-4 w-4 mr-2" />
                        Novo Arquivo
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-slate-300 hover:bg-slate-700 cursor-pointer"
                        onClick={() => setShowNewFolderDialog(true)}
                      >
                        <FolderPlus className="h-4 w-4 mr-2" />
                        Nova Pasta
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2">{renderFileTree(files)}</div>
              </ScrollArea>
            </div>
          </ResizablePanel>

          <ResizableHandle className="w-1 bg-slate-700/30 hover:bg-cyan-500/50 transition-colors" />

          {/* Editor Panel */}
          <ResizablePanel defaultSize={45} minSize={30}>
            <div className="h-full flex flex-col bg-[#0d1117]">
              {/* Editor Tabs */}
              <div className="h-9 bg-[#161b22] border-b border-slate-700/50 flex items-center px-2 overflow-x-auto">
                <div className="flex items-center gap-1">
                  {openTabs.map((tab) => (
                    <div
                      key={tab.path}
                      className={`flex items-center gap-2 px-3 py-1 rounded-t text-sm cursor-pointer group ${
                        currentFile === tab.path
                          ? "bg-[#0d1117] text-slate-300 border-t-2 border-cyan-500"
                          : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                      }`}
                      onClick={() => {
                        if (currentFile && unsavedChanges) {
                          setOpenTabs((prev) =>
                            prev.map((t) => t.path === currentFile ? { ...t, content: fileContent, unsaved: true } : t)
                          );
                        }
                        setCurrentFile(tab.path);
                        setFileContent(tab.content);
                        setUnsavedChanges(tab.unsaved);
                      }}
                    >
                      {getFileIcon(tab.path.split("/").pop() || "")}
                      <span className="max-w-24 truncate">{tab.path.split("/").pop()}</span>
                      {tab.unsaved && <span className="text-amber-400 text-xs">●</span>}
                      <button
                        className="opacity-0 group-hover:opacity-100 hover:text-red-400 ml-1"
                        onClick={(e) => handleCloseTab(tab.path, e)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 ml-auto text-slate-500 hover:text-white flex-shrink-0"
                  onClick={() => setShowNewFileDialog(true)}
                  title="Novo arquivo"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              {/* Monaco Editor */}
              <div className="flex-1">
                {currentFile ? (
                  <Editor
                    height="100%"
                    language={getLanguage(currentFile)}
                    value={fileContent}
                    onChange={(value) => {
                      setFileContent(value || "");
                      setUnsavedChanges(true);
                    }}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineNumbers: "on",
                      wordWrap: "on",
                      automaticLayout: true,
                      scrollBeyondLastLine: false,
                      padding: { top: 10 },
                    }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500">
                    <div className="text-center">
                      <FileCode className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Selecione um arquivo para editar</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle className="w-1 bg-slate-700/30 hover:bg-cyan-500/50 transition-colors" />

          {/* Right Panel (Terminal + Preview) */}
          <ResizablePanel defaultSize={35} minSize={25}>
            <ResizablePanelGroup direction="vertical">
              {/* Terminal */}
              <ResizablePanel defaultSize={50} minSize={20}>
                <div className="h-full bg-[#0d1117] flex flex-col">
                  <div className="h-9 bg-[#161b22] border-b border-slate-700/50 flex items-center px-3">
                    <Terminal className="h-4 w-4 text-green-400 mr-2" />
                    <span className="text-sm text-slate-300 font-medium">Terminal</span>
                    <div className="ml-auto flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-slate-500 hover:text-white"
                        onClick={handleClearTerminal}
                        title="Limpar terminal"
                      >
                        <Eraser className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 p-3 font-mono text-sm text-green-400 overflow-auto">
                    {terminalOutput.map((line, i) => (
                      <div key={i} className="whitespace-pre-wrap">{line}</div>
                    ))}
                  </div>
                  <div className="border-t border-slate-700/50 flex items-center px-3 py-2">
                    <span className="text-green-400 mr-2 font-mono">$</span>
                    <Input
                      ref={terminalInputRef}
                      placeholder=""
                      className="flex-1 bg-transparent border-0 text-green-400 font-mono focus-visible:ring-0 h-6 p-0"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const input = e.currentTarget;
                          if (input.value.trim()) {
                            runCommandMutation.mutate(input.value);
                            input.value = "";
                          }
                        }
                      }}
                      data-testid="terminal-input"
                    />
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle className="h-1 bg-slate-700/30 hover:bg-cyan-500/50 transition-colors" />

              {/* Live Preview */}
              <ResizablePanel defaultSize={50} minSize={20}>
                <div className="h-full bg-[#0d1117] flex flex-col">
                  <div className="h-9 bg-[#161b22] border-b border-slate-700/50 flex items-center px-3">
                    <span className="text-sm text-slate-300 font-medium">Live Preview</span>
                    <div className="ml-auto flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-white">
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-white">
                        <Maximize2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 bg-white">
                    <iframe 
                      src={previewUrl} 
                      className="w-full h-full border-0"
                      title="Live Preview"
                      sandbox="allow-scripts allow-same-origin"
                    />
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* AI Assistant Floating Panel */}
      {showAiAssistant && (
        <div className="absolute bottom-4 right-4 w-80 bg-[#1c1c1c] rounded-xl shadow-2xl border border-slate-700/50 flex flex-col overflow-hidden" style={{ height: '400px' }}>
          <div className="p-3 bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-white" />
              <span className="font-medium text-white">AI Assistant</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 text-white/80 hover:text-white hover:bg-white/20"
              onClick={() => setShowAiAssistant(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-3">
              {aiMessages.map((msg, i) => (
                <div 
                  key={i} 
                  className={`p-3 rounded-lg text-sm ${
                    msg.role === "assistant" 
                      ? "bg-amber-500/20 text-amber-100" 
                      : "bg-slate-700 text-slate-200 ml-4"
                  }`}
                >
                  {msg.content}
                </div>
              ))}
              {aiChatMutation.isPending && (
                <div className="p-3 rounded-lg text-sm bg-amber-500/20 text-amber-100 animate-pulse">
                  Pensando...
                </div>
              )}
            </div>
          </ScrollArea>
          
          <div className="p-3 border-t border-slate-700/50 flex gap-2">
            <Input
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Como posso ajudar?"
              className="flex-1 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              onKeyDown={(e) => e.key === "Enter" && handleAiSend()}
              data-testid="ai-input"
            />
            <Button 
              size="icon" 
              className="bg-amber-500 hover:bg-amber-600"
              onClick={handleAiSend}
              disabled={!aiInput.trim() || aiChatMutation.isPending}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialog: Novo Arquivo */}
      <Dialog open={showNewFileDialog} onOpenChange={setShowNewFileDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FilePlus className="h-5 w-5 text-cyan-400" />
              Criar Novo Arquivo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Pasta</label>
              <select
                value={newItemParent}
                onChange={(e) => setNewItemParent(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-white"
              >
                <option value="python-service">python-service</option>
                <option value="server">server</option>
                <option value="client/src">client/src</option>
                <option value="shared">shared</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Nome do arquivo</label>
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="exemplo.py"
                className="bg-slate-800 border-slate-600 text-white"
                onKeyDown={(e) => e.key === "Enter" && handleCreateFile()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewFileDialog(false)} className="text-slate-400">
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateFile} 
              className="bg-cyan-600 hover:bg-cyan-700"
              disabled={!newItemName.trim() || createFileMutation.isPending}
            >
              {createFileMutation.isPending ? "Criando..." : "Criar Arquivo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nova Pasta */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-amber-400" />
              Criar Nova Pasta
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Pasta pai</label>
              <select
                value={newItemParent}
                onChange={(e) => setNewItemParent(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-white"
              >
                <option value="python-service">python-service</option>
                <option value="server">server</option>
                <option value="client/src">client/src</option>
                <option value="shared">shared</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Nome da pasta</label>
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="nova_pasta"
                className="bg-slate-800 border-slate-600 text-white"
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewFolderDialog(false)} className="text-slate-400">
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateFolder} 
              className="bg-amber-600 hover:bg-amber-700"
              disabled={!newItemName.trim() || createFolderMutation.isPending}
            >
              {createFolderMutation.isPending ? "Criando..." : "Criar Pasta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
