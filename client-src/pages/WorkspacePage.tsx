import { useState, useEffect, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  ChevronLeft, Star, MoreHorizontal, Plus, Trash2, 
  FileText, Image, List, ListOrdered, CheckSquare, 
  Quote, Code, Minus, Type, Heading1, Heading2, Heading3,
  ArrowLeft, ArrowRight, RotateCw, Home
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface PageBlock {
  id: number;
  pageId: number;
  parentBlockId?: number;
  type: string;
  content?: string;
  properties?: string;
  orderIndex: number;
}

interface WorkspacePageData {
  id: number;
  userId: string;
  parentId?: number;
  title: string;
  icon?: string;
  coverImage?: string;
  isPublic: number;
  isFavorite: number;
  isArchived: number;
  orderIndex: number;
}

const BLOCK_TYPES = [
  { type: "text", label: "Texto", icon: Type },
  { type: "heading1", label: "Título 1", icon: Heading1 },
  { type: "heading2", label: "Título 2", icon: Heading2 },
  { type: "heading3", label: "Título 3", icon: Heading3 },
  { type: "bullet", label: "Lista com Marcadores", icon: List },
  { type: "numbered", label: "Lista Numerada", icon: ListOrdered },
  { type: "todo", label: "Lista de Tarefas", icon: CheckSquare },
  { type: "quote", label: "Citação", icon: Quote },
  { type: "code", label: "Código", icon: Code },
  { type: "divider", label: "Divisor", icon: Minus },
];

export default function WorkspacePage() {
  const [, params] = useRoute("/page/:id");
  const [, navigate] = useLocation();
  const pageId = params?.id ? parseInt(params.id) : null;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState("");
  const [focusedBlockId, setFocusedBlockId] = useState<number | null>(null);

  const { data: page, isLoading: pageLoading } = useQuery<WorkspacePageData>({
    queryKey: ["/api/productivity/pages", pageId],
    queryFn: async () => {
      const res = await fetch(`/api/productivity/pages/${pageId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch page");
      return res.json();
    },
    enabled: !!pageId,
  });

  const { data: blocks = [], isLoading: blocksLoading } = useQuery<PageBlock[]>({
    queryKey: ["/api/productivity/pages", pageId, "blocks"],
    queryFn: async () => {
      const res = await fetch(`/api/productivity/pages/${pageId}/blocks`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch blocks");
      return res.json();
    },
    enabled: !!pageId,
  });

  useEffect(() => {
    if (page?.title) {
      setTitle(page.title);
    }
  }, [page?.title]);

  const updatePageMutation = useMutation({
    mutationFn: async (data: Partial<WorkspacePageData>) => {
      const res = await fetch(`/api/productivity/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update page");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/productivity/pages"] });
    },
  });

  const createBlockMutation = useMutation({
    mutationFn: async (data: { type: string; content?: string; orderIndex: number }) => {
      const res = await fetch(`/api/productivity/pages/${pageId}/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create block");
      return res.json();
    },
    onSuccess: (newBlock) => {
      queryClient.invalidateQueries({ queryKey: ["/api/productivity/pages", pageId, "blocks"] });
      setFocusedBlockId(newBlock.id);
    },
  });

  const updateBlockMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<PageBlock>) => {
      const res = await fetch(`/api/productivity/blocks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update block");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/productivity/pages", pageId, "blocks"] });
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: async (blockId: number) => {
      const res = await fetch(`/api/productivity/blocks/${blockId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete block");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/productivity/pages", pageId, "blocks"] });
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/productivity/pages/${pageId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete page");
    },
    onSuccess: () => {
      toast({ title: "Página excluída" });
      navigate("/");
    },
  });

  const handleTitleBlur = () => {
    setEditingTitle(false);
    if (title !== page?.title) {
      updatePageMutation.mutate({ title });
    }
  };

  const toggleFavorite = () => {
    updatePageMutation.mutate({ isFavorite: page?.isFavorite ? 0 : 1 });
  };

  const addBlock = (type: string, afterIndex: number = blocks.length) => {
    createBlockMutation.mutate({
      type,
      content: "",
      orderIndex: afterIndex,
    });
  };

  const handleBlockChange = useCallback((blockId: number, content: string) => {
    updateBlockMutation.mutate({ id: blockId, content });
  }, [updateBlockMutation]);

  const handleBlockKeyDown = (e: React.KeyboardEvent, block: PageBlock, index: number) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      addBlock("text", index + 1);
    } else if (e.key === "Backspace" && !block.content) {
      e.preventDefault();
      if (blocks.length > 1) {
        deleteBlockMutation.mutate(block.id);
        const prevBlock = blocks[index - 1];
        if (prevBlock) {
          setFocusedBlockId(prevBlock.id);
        }
      }
    }
  };

  const renderBlock = (block: PageBlock, index: number) => {
    const commonProps = {
      className: "w-full bg-transparent border-none focus:outline-none focus:ring-0 resize-none",
      value: block.content || "",
      onChange: (e: any) => handleBlockChange(block.id, e.target.value),
      onKeyDown: (e: any) => handleBlockKeyDown(e, block, index),
      autoFocus: focusedBlockId === block.id,
      "data-testid": `block-${block.id}`,
    };

    switch (block.type) {
      case "heading1":
        return (
          <input
            {...commonProps}
            placeholder="Título 1"
            className="w-full bg-transparent border-none focus:outline-none text-3xl font-bold"
          />
        );
      case "heading2":
        return (
          <input
            {...commonProps}
            placeholder="Título 2"
            className="w-full bg-transparent border-none focus:outline-none text-2xl font-semibold"
          />
        );
      case "heading3":
        return (
          <input
            {...commonProps}
            placeholder="Título 3"
            className="w-full bg-transparent border-none focus:outline-none text-xl font-medium"
          />
        );
      case "bullet":
        return (
          <div className="flex items-start gap-2">
            <span className="mt-1.5">•</span>
            <input {...commonProps} placeholder="Item da lista" />
          </div>
        );
      case "numbered":
        return (
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-muted-foreground min-w-[1.5rem]">{index + 1}.</span>
            <input {...commonProps} placeholder="Item numerado" />
          </div>
        );
      case "todo":
        const properties = block.properties ? JSON.parse(block.properties) : {};
        return (
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={properties.checked || false}
              onChange={(e) => {
                updateBlockMutation.mutate({
                  id: block.id,
                  properties: JSON.stringify({ ...properties, checked: e.target.checked }),
                });
              }}
              className="mt-1"
              data-testid={`todo-checkbox-${block.id}`}
            />
            <input
              {...commonProps}
              placeholder="Tarefa"
              className={`w-full bg-transparent border-none focus:outline-none ${properties.checked ? "line-through text-muted-foreground" : ""}`}
            />
          </div>
        );
      case "quote":
        return (
          <div className="border-l-4 border-primary/30 pl-4 italic">
            <textarea {...commonProps} placeholder="Citação" rows={2} />
          </div>
        );
      case "code":
        return (
          <pre className="bg-muted rounded-md p-3 font-mono text-sm">
            <textarea {...commonProps} placeholder="// código" rows={3} className="w-full bg-transparent font-mono" />
          </pre>
        );
      case "divider":
        return <hr className="my-4 border-muted" />;
      default:
        return (
          <textarea
            {...commonProps}
            placeholder="Digite algo, ou pressione '/' para comandos..."
            rows={1}
            onInput={(e: any) => {
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
          />
        );
    }
  };

  if (pageLoading || blocksLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-pulse">Carregando...</div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <FileText className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Página não encontrada</h2>
        <Button onClick={() => navigate("/")}>Voltar ao Início</Button>
      </div>
    );
  }

  return (
    <BrowserFrame>
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
          <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")} data-testid="back-button">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">{page.icon || "📄"}</span>
              <span className="text-sm font-medium truncate max-w-[200px]">{page.title}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFavorite}
                data-testid="favorite-button"
              >
                <Star className={`h-4 w-4 ${page.isFavorite ? "fill-yellow-400 text-yellow-400" : ""}`} />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid="page-menu">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => updatePageMutation.mutate({ isArchived: 1 })}>
                    Arquivar página
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-destructive"
                    onClick={() => deletePageMutation.mutate()}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir página
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {page.coverImage && (
          <div className="h-48 rounded-lg overflow-hidden mb-6 bg-muted">
            <img src={page.coverImage} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-4xl cursor-pointer hover:bg-muted rounded p-1" data-testid="page-icon">
              {page.icon || "📄"}
            </span>
          </div>
          {editingTitle ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => e.key === "Enter" && handleTitleBlur()}
              className="text-4xl font-bold border-none focus-visible:ring-0 px-0 h-auto"
              autoFocus
              data-testid="page-title-input"
            />
          ) : (
            <h1
              className="text-4xl font-bold cursor-text hover:bg-muted/50 rounded px-1 py-0.5"
              onClick={() => setEditingTitle(true)}
              data-testid="page-title"
            >
              {page.title || "Sem título"}
            </h1>
          )}
        </div>

        <div className="space-y-1">
          {blocks.map((block, index) => (
            <div
              key={block.id}
              className="group relative flex items-start gap-2 py-1 px-1 -mx-1 rounded hover:bg-muted/50"
            >
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 pt-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6" data-testid={`add-block-${block.id}`}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {BLOCK_TYPES.map((bt) => (
                      <DropdownMenuItem key={bt.type} onClick={() => addBlock(bt.type, index + 1)}>
                        <bt.icon className="h-4 w-4 mr-2" />
                        {bt.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex-1 min-w-0">
                {renderBlock(block, index)}
              </div>
            </div>
          ))}

          {blocks.length === 0 && (
            <div
              className="text-muted-foreground py-2 px-1 cursor-text hover:bg-muted/50 rounded"
              onClick={() => addBlock("text")}
              data-testid="empty-page-prompt"
            >
              Clique aqui para começar a escrever...
            </div>
          )}

          <div className="pt-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground" data-testid="add-block-button">
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar bloco
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {BLOCK_TYPES.map((bt) => (
                  <DropdownMenuItem key={bt.type} onClick={() => addBlock(bt.type)}>
                    <bt.icon className="h-4 w-4 mr-2" />
                    {bt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      </div>
    </BrowserFrame>
  );
}
