import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  Hash, Plus, Settings, ChevronDown, Send, Smile, Paperclip,
  Volume2, Users, Bell, Pin, Search, Trash2, Pencil, MoreVertical,
  Circle, LogOut, UserPlus, Crown, Shield, User, ChevronRight
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Community {
  id: number;
  name: string;
  description?: string;
  iconEmoji?: string;
  iconColor?: string;
  role?: string;
}

interface Channel {
  id: number;
  name: string;
  type: "text" | "voice" | "announcement";
  description?: string;
}

interface Member {
  id: number;
  userId: string;
  username: string;
  role: string;
  status: "online" | "away" | "busy" | "offline";
  statusMessage?: string;
}

interface Message {
  id: number;
  channelId: number;
  userId: string;
  username?: string;
  content: string;
  createdAt: string;
  editedAt?: string;
  replyToId?: number;
}

interface CommunityDetails extends Community {
  channels: Channel[];
  members: Member[];
}

interface TypingUser {
  userId: string;
  username: string;
}

export default function Communities() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedCommunity, setSelectedCommunity] = useState<number | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Map<string, string>>(new Map());
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isCreateCommunityOpen, setIsCreateCommunityOpen] = useState(false);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [newCommunityName, setNewCommunityName] = useState("");
  const [newCommunityDescription, setNewCommunityDescription] = useState("");
  const [newCommunityEmoji, setNewCommunityEmoji] = useState("💼");
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<"text" | "voice">("text");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: communities = [] } = useQuery<Community[]>({
    queryKey: ["/api/communities"],
    queryFn: async () => {
      const res = await fetch("/api/communities", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch communities");
      return res.json();
    },
  });

  const { data: communityDetails } = useQuery<CommunityDetails>({
    queryKey: ["/api/communities", selectedCommunity],
    queryFn: async () => {
      const res = await fetch(`/api/communities/${selectedCommunity}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch community");
      return res.json();
    },
    enabled: !!selectedCommunity,
  });

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/communities/channels", selectedChannel, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/communities/${selectedCommunity}/channels/${selectedChannel}/messages`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!selectedChannel && !!selectedCommunity,
  });

  const createCommunityMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; iconEmoji?: string }) => {
      const res = await fetch("/api/communities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create community");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/communities"] });
      setSelectedCommunity(data.id);
      setIsCreateCommunityOpen(false);
      setNewCommunityName("");
      setNewCommunityDescription("");
      toast.success("Comunidade criada!");
    },
  });

  const createChannelMutation = useMutation({
    mutationFn: async (data: { name: string; type: string }) => {
      const res = await fetch(`/api/communities/${selectedCommunity}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create channel");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/communities", selectedCommunity] });
      setSelectedChannel(data.id);
      setIsCreateChannelOpen(false);
      setNewChannelName("");
      toast.success("Canal criado!");
    },
  });

  useEffect(() => {
    if (!user) return;

    const newSocket = io({
      path: "/community-socket",
      transports: ["websocket", "polling"],
    });

    newSocket.on("connect", () => {
      // User info comes from server session, just signal we're ready
      newSocket.emit("user:join");
    });

    newSocket.on("users:online", (users: { userId: string; username: string; status: string }[]) => {
      const userMap = new Map<string, string>();
      users.forEach((u) => userMap.set(u.userId, u.status));
      setOnlineUsers(userMap);
    });

    newSocket.on("user:status", (data: { userId: string; status: string }) => {
      setOnlineUsers((prev) => {
        const newMap = new Map(prev);
        if (data.status === "offline") {
          newMap.delete(data.userId);
        } else {
          newMap.set(data.userId, data.status);
        }
        return newMap;
      });
    });

    newSocket.on("message:new", (message: Message) => {
      queryClient.setQueryData<Message[]>(
        ["/api/communities/channels", message.channelId, "messages"],
        (old) => (old ? [...old, message] : [message])
      );
    });

    newSocket.on("message:edited", (data: { messageId: number; content: string; editedAt: string }) => {
      queryClient.setQueryData<Message[]>(
        ["/api/communities/channels", selectedChannel, "messages"],
        (old) =>
          old?.map((m) =>
            m.id === data.messageId ? { ...m, content: data.content, editedAt: data.editedAt } : m
          )
      );
    });

    newSocket.on("message:deleted", (data: { messageId: number }) => {
      queryClient.setQueryData<Message[]>(
        ["/api/communities/channels", selectedChannel, "messages"],
        (old) => old?.filter((m) => m.id !== data.messageId)
      );
    });

    newSocket.on("typing:update", (data: { channelId: number; userId: string; username: string; isTyping: boolean }) => {
      if (data.channelId !== selectedChannel) return;
      setTypingUsers((prev) => {
        if (data.isTyping) {
          if (!prev.find((u) => u.userId === data.userId)) {
            return [...prev, { userId: data.userId, username: data.username }];
          }
          return prev;
        } else {
          return prev.filter((u) => u.userId !== data.userId);
        }
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user, queryClient, selectedChannel]);

  useEffect(() => {
    if (socket && selectedCommunity && selectedChannel) {
      socket.emit("channel:join", { communityId: selectedCommunity, channelId: selectedChannel });
      return () => {
        socket.emit("channel:leave", { channelId: selectedChannel });
      };
    }
  }, [socket, selectedCommunity, selectedChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (communityDetails?.channels && communityDetails.channels.length > 0 && !selectedChannel) {
      const textChannel = communityDetails.channels.find((c) => c.type === "text");
      if (textChannel) {
        setSelectedChannel(textChannel.id);
      }
    }
  }, [communityDetails, selectedChannel]);

  const handleSendMessage = () => {
    if (!messageInput.trim() || !socket || !selectedChannel) return;
    socket.emit("message:send", { channelId: selectedChannel, content: messageInput.trim() });
    setMessageInput("");
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    socket.emit("typing:stop", { channelId: selectedChannel });
  };

  const handleTyping = () => {
    if (!socket || !selectedChannel) return;
    socket.emit("typing:start", { channelId: selectedChannel });
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing:stop", { channelId: selectedChannel });
    }, 2000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown className="w-3 h-3 text-yellow-500" />;
      case "admin":
        return <Shield className="w-3 h-3 text-blue-500" />;
      case "moderator":
        return <Shield className="w-3 h-3 text-green-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-500";
      case "away":
        return "bg-yellow-500";
      case "busy":
        return "bg-red-500";
      default:
        return "bg-gray-400";
    }
  };

  const selectedCommunityData = communities.find((c) => c.id === selectedCommunity);
  const selectedChannelData = communityDetails?.channels?.find((c) => c.id === selectedChannel);
  const canManage = communityDetails?.members?.find((m) => m.userId === user?.id)?.role;
  const isAdmin = canManage === "owner" || canManage === "admin" || canManage === "moderator";

  const onlineMembers = communityDetails?.members?.filter((m) => 
    onlineUsers.has(m.userId) || m.status === "online"
  ) || [];
  const offlineMembers = communityDetails?.members?.filter((m) => 
    !onlineUsers.has(m.userId) && m.status !== "online"
  ) || [];

  return (
    <BrowserFrame>
    <div className="flex h-full bg-[#313338]" data-testid="communities-page">
      {/* Server List Sidebar */}
      <div className="w-[72px] bg-[#1e1f22] flex flex-col items-center py-3 gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setSelectedCommunity(null)}
              className={cn(
                "w-12 h-12 rounded-[24px] bg-[#313338] hover:bg-[#5865f2] hover:rounded-[16px] transition-all flex items-center justify-center text-white",
                !selectedCommunity && "bg-[#5865f2] rounded-[16px]"
              )}
              data-testid="button-home"
            >
              <Users className="w-6 h-6" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Início</TooltipContent>
        </Tooltip>

        <div className="w-8 h-[2px] bg-[#35363c] rounded-full my-1" />

        {communities.map((community) => (
          <Tooltip key={community.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  setSelectedCommunity(community.id);
                  setSelectedChannel(null);
                }}
                className={cn(
                  "w-12 h-12 rounded-[24px] hover:rounded-[16px] transition-all flex items-center justify-center text-xl",
                  selectedCommunity === community.id
                    ? "rounded-[16px] bg-[#5865f2]"
                    : "bg-[#313338] hover:bg-[#5865f2]"
                )}
                style={{
                  backgroundColor: selectedCommunity === community.id ? "#5865f2" : community.iconColor || "#313338",
                }}
                data-testid={`button-community-${community.id}`}
              >
                {community.iconEmoji || community.name.charAt(0).toUpperCase()}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{community.name}</TooltipContent>
          </Tooltip>
        ))}

        <Tooltip>
          <TooltipTrigger asChild>
            <Dialog open={isCreateCommunityOpen} onOpenChange={setIsCreateCommunityOpen}>
              <DialogTrigger asChild>
                <button
                  className="w-12 h-12 rounded-[24px] bg-[#313338] hover:bg-[#23a559] hover:rounded-[16px] transition-all flex items-center justify-center text-[#23a559] hover:text-white"
                  data-testid="button-create-community"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </DialogTrigger>
              <DialogContent className="bg-[#313338] border-none text-white">
                <DialogHeader>
                  <DialogTitle>Criar Comunidade</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Emoji</Label>
                    <Input
                      value={newCommunityEmoji}
                      onChange={(e) => setNewCommunityEmoji(e.target.value)}
                      className="bg-[#1e1f22] border-none mt-1"
                      maxLength={2}
                      data-testid="input-community-emoji"
                    />
                  </div>
                  <div>
                    <Label>Nome da Comunidade</Label>
                    <Input
                      value={newCommunityName}
                      onChange={(e) => setNewCommunityName(e.target.value)}
                      placeholder="Ex: Equipe de Vendas"
                      className="bg-[#1e1f22] border-none mt-1"
                      data-testid="input-community-name"
                    />
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Textarea
                      value={newCommunityDescription}
                      onChange={(e) => setNewCommunityDescription(e.target.value)}
                      placeholder="Descreva sua comunidade..."
                      className="bg-[#1e1f22] border-none mt-1"
                      data-testid="input-community-description"
                    />
                  </div>
                  <Button
                    onClick={() =>
                      createCommunityMutation.mutate({
                        name: newCommunityName,
                        description: newCommunityDescription,
                        iconEmoji: newCommunityEmoji,
                      })
                    }
                    disabled={!newCommunityName.trim()}
                    className="w-full bg-[#5865f2] hover:bg-[#4752c4]"
                    data-testid="button-submit-community"
                  >
                    Criar Comunidade
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </TooltipTrigger>
          <TooltipContent side="right">Criar Comunidade</TooltipContent>
        </Tooltip>
      </div>

      {/* Channel List */}
      <div className="w-60 bg-[#2b2d31] flex flex-col">
        {selectedCommunity ? (
          <>
            <div className="h-12 px-4 flex items-center justify-between border-b border-[#1f2023] shadow-sm">
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 font-semibold text-white hover:text-gray-300">
                  {selectedCommunityData?.name}
                  <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-[#111214] border-none text-white">
                  {isAdmin && (
                    <>
                      <DropdownMenuItem className="hover:bg-[#5865f2] cursor-pointer">
                        <UserPlus className="w-4 h-4 mr-2" />
                        Convidar Pessoas
                      </DropdownMenuItem>
                      <DropdownMenuItem className="hover:bg-[#5865f2] cursor-pointer">
                        <Settings className="w-4 h-4 mr-2" />
                        Configurações
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-[#35363c]" />
                    </>
                  )}
                  <DropdownMenuItem className="hover:bg-[#da373c] text-[#da373c] cursor-pointer">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sair da Comunidade
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <ScrollArea className="flex-1 px-2">
              <div className="py-4">
                <div className="flex items-center justify-between px-2 mb-1">
                  <span className="text-xs font-semibold text-[#96989d] uppercase">Canais de Texto</span>
                  {isAdmin && (
                    <Dialog open={isCreateChannelOpen} onOpenChange={setIsCreateChannelOpen}>
                      <DialogTrigger asChild>
                        <button className="text-[#96989d] hover:text-white" data-testid="button-add-channel">
                          <Plus className="w-4 h-4" />
                        </button>
                      </DialogTrigger>
                      <DialogContent className="bg-[#313338] border-none text-white">
                        <DialogHeader>
                          <DialogTitle>Criar Canal</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Nome do Canal</Label>
                            <Input
                              value={newChannelName}
                              onChange={(e) => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                              placeholder="novo-canal"
                              className="bg-[#1e1f22] border-none mt-1"
                              data-testid="input-channel-name"
                            />
                          </div>
                          <Button
                            onClick={() => createChannelMutation.mutate({ name: newChannelName, type: newChannelType })}
                            disabled={!newChannelName.trim()}
                            className="w-full bg-[#5865f2] hover:bg-[#4752c4]"
                            data-testid="button-submit-channel"
                          >
                            Criar Canal
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>

                {communityDetails?.channels
                  ?.filter((c) => c.type === "text" || c.type === "announcement")
                  .map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => setSelectedChannel(channel.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded text-[#96989d] hover:text-[#dbdee1] hover:bg-[#35373c]",
                        selectedChannel === channel.id && "bg-[#404249] text-white"
                      )}
                      data-testid={`button-channel-${channel.id}`}
                    >
                      <Hash className="w-5 h-5 text-[#80848e]" />
                      <span className="text-sm">{channel.name}</span>
                    </button>
                  ))}

                {communityDetails?.channels?.some((c) => c.type === "voice") && (
                  <>
                    <div className="flex items-center justify-between px-2 mt-4 mb-1">
                      <span className="text-xs font-semibold text-[#96989d] uppercase">Canais de Voz</span>
                    </div>
                    {communityDetails?.channels
                      ?.filter((c) => c.type === "voice")
                      .map((channel) => (
                        <button
                          key={channel.id}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[#96989d] hover:text-[#dbdee1] hover:bg-[#35373c]"
                          data-testid={`button-voice-channel-${channel.id}`}
                        >
                          <Volume2 className="w-5 h-5 text-[#80848e]" />
                          <span className="text-sm">{channel.name}</span>
                        </button>
                      ))}
                  </>
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#96989d]">
            <div className="text-center px-4">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">Selecione ou crie uma comunidade</p>
            </div>
          </div>
        )}

        {/* User Panel */}
        <div className="h-[52px] bg-[#232428] flex items-center px-2 gap-2">
          <div className="relative">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-[#5865f2] text-white text-xs">
                {user?.username?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className={cn("absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#232428]", getStatusColor("online"))} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.username}</p>
            <p className="text-xs text-[#96989d]">Online</p>
          </div>
          <button className="p-1.5 text-[#b5bac1] hover:text-white hover:bg-[#35373c] rounded">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-[#313338]">
        {selectedChannel ? (
          <>
            <div className="h-12 px-4 flex items-center border-b border-[#1f2023] shadow-sm">
              <Hash className="w-6 h-6 text-[#80848e] mr-2" />
              <span className="font-semibold text-white">{selectedChannelData?.name}</span>
              {selectedChannelData?.description && (
                <>
                  <div className="w-px h-6 bg-[#3f4147] mx-4" />
                  <span className="text-sm text-[#96989d] truncate">{selectedChannelData.description}</span>
                </>
              )}
              <div className="ml-auto flex items-center gap-4">
                <button className="text-[#b5bac1] hover:text-white">
                  <Bell className="w-5 h-5" />
                </button>
                <button className="text-[#b5bac1] hover:text-white">
                  <Pin className="w-5 h-5" />
                </button>
                <button className="text-[#b5bac1] hover:text-white">
                  <Users className="w-5 h-5" />
                </button>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-[#96989d]" />
                  <input
                    type="text"
                    placeholder="Buscar"
                    className="w-36 bg-[#1e1f22] text-sm text-white pl-8 pr-2 py-1 rounded"
                  />
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 px-4">
              <div className="py-4 space-y-4">
                {messages.map((message, index) => {
                  const showHeader = index === 0 || messages[index - 1]?.userId !== message.userId;
                  return (
                    <div
                      key={message.id}
                      className={cn("group flex hover:bg-[#2e3035] rounded px-2 py-0.5", showHeader && "mt-4")}
                      data-testid={`message-${message.id}`}
                    >
                      {showHeader ? (
                        <Avatar className="w-10 h-10 mt-0.5 mr-4">
                          <AvatarFallback className="bg-[#5865f2] text-white">
                            {message.username?.charAt(0).toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-10 mr-4 flex items-center justify-center">
                          <span className="text-[10px] text-[#96989d] opacity-0 group-hover:opacity-100">
                            {new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        {showHeader && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white hover:underline cursor-pointer">
                              {message.username || "Usuário"}
                            </span>
                            <span className="text-xs text-[#96989d]">
                              {new Date(message.createdAt).toLocaleDateString("pt-BR")} às{" "}
                              {new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {message.editedAt && <span className="text-xs text-[#96989d]">(editado)</span>}
                          </div>
                        )}
                        <p className="text-[#dbdee1] break-words">{message.content}</p>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 flex items-start gap-1">
                        {message.userId === user?.id && (
                          <>
                            <button className="p-1 text-[#96989d] hover:text-white hover:bg-[#404249] rounded">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button className="p-1 text-[#96989d] hover:text-[#da373c] hover:bg-[#404249] rounded">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {typingUsers.length > 0 && (
              <div className="px-4 py-1 text-sm text-[#96989d]">
                <span className="font-medium">{typingUsers.map((u) => u.username).join(", ")}</span>
                {typingUsers.length === 1 ? " está digitando..." : " estão digitando..."}
              </div>
            )}

            <div className="px-4 pb-6">
              <div className="bg-[#383a40] rounded-lg flex items-center px-4">
                <button className="p-2 text-[#b5bac1] hover:text-white">
                  <Plus className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => {
                    setMessageInput(e.target.value);
                    handleTyping();
                  }}
                  onKeyPress={handleKeyPress}
                  placeholder={`Conversar em #${selectedChannelData?.name || "canal"}`}
                  className="flex-1 bg-transparent py-3 text-[#dbdee1] placeholder-[#6d6f78] focus:outline-none"
                  data-testid="input-message"
                />
                <button className="p-2 text-[#b5bac1] hover:text-white">
                  <Paperclip className="w-5 h-5" />
                </button>
                <button className="p-2 text-[#b5bac1] hover:text-white">
                  <Smile className="w-5 h-5" />
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className="p-2 text-[#5865f2] hover:text-[#4752c4] disabled:opacity-50"
                  data-testid="button-send-message"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#96989d]">
            <div className="text-center">
              <Hash className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Selecione um canal para começar</p>
            </div>
          </div>
        )}
      </div>

      {/* Members Sidebar */}
      {selectedCommunity && (
        <div className="w-60 bg-[#2b2d31]">
          <ScrollArea className="h-full">
            <div className="p-4">
              {onlineMembers.length > 0 && (
                <>
                  <div className="text-xs font-semibold text-[#96989d] uppercase mb-2">
                    Online — {onlineMembers.length}
                  </div>
                  {onlineMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[#35373c] cursor-pointer"
                      data-testid={`member-online-${member.userId}`}
                    >
                      <div className="relative">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-[#5865f2] text-white text-xs">
                            {member.username?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#2b2d31]", getStatusColor(onlineUsers.get(member.userId) || member.status))} />
                      </div>
                      <div className="flex items-center gap-1 text-sm text-[#96989d]">
                        {getRoleIcon(member.role)}
                        <span>{member.username}</span>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {offlineMembers.length > 0 && (
                <>
                  <div className="text-xs font-semibold text-[#96989d] uppercase mt-4 mb-2">
                    Offline — {offlineMembers.length}
                  </div>
                  {offlineMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[#35373c] cursor-pointer opacity-50"
                      data-testid={`member-offline-${member.userId}`}
                    >
                      <div className="relative">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-[#5865f2] text-white text-xs">
                            {member.username?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#2b2d31] bg-gray-500" />
                      </div>
                      <div className="flex items-center gap-1 text-sm text-[#96989d]">
                        {getRoleIcon(member.role)}
                        <span>{member.username}</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
    </BrowserFrame>
  );
}
