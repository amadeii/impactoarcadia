import { BrowserFrame } from "@/components/Browser/BrowserFrame";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  MessageCircle, 
  Send, 
  Plus, 
  Search,
  Users,
  Check,
  CheckCheck,
  Loader2,
  Phone,
  Video,
  MoreVertical,
  Smile,
  Paperclip,
  Volume2,
  VolumeX,
  Bell
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";

interface ThreadParticipant {
  id: string;
  username: string;
  name: string | null;
}

interface ChatMessage {
  id: number;
  threadId: number;
  senderId: string | null;
  body: string;
  messageType: string | null;
  status: string | null;
  sentAt: string;
  senderName: string | null;
  senderUsername: string | null;
}

interface ChatThread {
  id: number;
  type: string;
  name: string | null;
  participants: ThreadParticipant[];
  lastMessage?: ChatMessage;
  unreadCount: number;
  latestMessageAt: string | null;
}

interface User {
  id: string;
  username: string;
  name: string | null;
}

async function fetchThreads(): Promise<ChatThread[]> {
  const response = await fetch("/api/chat/threads", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch threads");
  return response.json();
}

async function fetchThread(id: number): Promise<{ messages: ChatMessage[]; participants: ThreadParticipant[] }> {
  const response = await fetch(`/api/chat/threads/${id}`, { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch thread");
  return response.json();
}

async function fetchUsers(): Promise<User[]> {
  const response = await fetch("/api/chat/users", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch users");
  return response.json();
}

async function createDirectThread(userId: string): Promise<ChatThread> {
  const response = await fetch("/api/chat/threads/direct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to create thread");
  return response.json();
}

export default function Chat() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedThread, setSelectedThread] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Map<number, Set<string>>>(new Map());
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    const stored = localStorage.getItem("chat-muted");
    return stored === "true";
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQsQKZfZ0KQPCQQ4odPQnAoDBD+k0syXCQQFQqfQyJMIBAZFqc7EkQcDBkiqzMCPBgMHSKnKvI0FAwdJqci5iwQDB0mpxrWJAwMHS6jEsYcCAwdMp8KuhQIDB0ynwKqDAQMHTabAp4EBAwdNpr6kfwEDB06mvqJ9AQMHTqW+oHsCAwdPpb2eegIDB0+lvJx4AgMHT6S8mnYCAwdQpLuYdQIDB1Cku5ZzAgMHUKS7lHEBAwdRo7uScAEDB1GjupBvAQMHUqO6jm0BAwdSoruMawEDB1Kiuopp");
  }, []);

  const playNotificationSound = () => {
    if (!isMuted && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  };

  const toggleMute = () => {
    setIsMuted(prev => {
      const newVal = !prev;
      localStorage.setItem("chat-muted", String(newVal));
      return newVal;
    });
  };

  const { data: threads = [], isLoading: loadingThreads } = useQuery({
    queryKey: ["chat-threads"],
    queryFn: fetchThreads,
  });

  const { data: threadData } = useQuery({
    queryKey: ["chat-thread", selectedThread],
    queryFn: () => selectedThread ? fetchThread(selectedThread) : null,
    enabled: !!selectedThread,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["chat-users"],
    queryFn: fetchUsers,
  });

  useEffect(() => {
    if (threadData?.messages) {
      setMessages(threadData.messages);
    }
  }, [threadData]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!user) return;

    const newSocket = io({
      path: "/socket.io",
    });

    newSocket.on("connect", () => {
      newSocket.emit("user:join", { id: user.id, username: user.username });
    });

    newSocket.on("users:online", (users: { userId: string }[]) => {
      setOnlineUsers(new Set(users.map(u => u.userId)));
    });

    newSocket.on("user:online", ({ userId }: { userId: string }) => {
      setOnlineUsers(prev => new Set([...prev, userId]));
    });

    newSocket.on("user:offline", ({ userId }: { userId: string }) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    });

    newSocket.on("message:new", (message: ChatMessage) => {
      if (message.threadId === selectedThread) {
        setMessages(prev => [...prev, message]);
      }
      queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
      
      if (message.senderId !== user?.id) {
        playNotificationSound();
        toast(
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white font-medium">
              {message.senderName?.[0]?.toUpperCase() || message.senderUsername?.[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <div className="font-medium text-sm">{message.senderName || message.senderUsername}</div>
              <div className="text-xs text-muted-foreground truncate max-w-[200px]">{message.body}</div>
            </div>
          </div>,
          {
            duration: 4000,
            position: "top-right",
          }
        );
      }
    });

    newSocket.on("typing:update", ({ threadId, userId, isTyping }: { threadId: number; userId: string; isTyping: boolean }) => {
      setTypingUsers(prev => {
        const newMap = new Map(prev);
        const threadTyping = newMap.get(threadId) || new Set();
        if (isTyping) {
          threadTyping.add(userId);
        } else {
          threadTyping.delete(userId);
        }
        newMap.set(threadId, threadTyping);
        return newMap;
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user, selectedThread, queryClient]);

  useEffect(() => {
    if (socket && selectedThread) {
      socket.emit("thread:join", selectedThread);
      socket.emit("thread:read", selectedThread);
    }
  }, [socket, selectedThread]);

  const handleSendMessage = () => {
    if (!input.trim() || !selectedThread || !socket) return;

    socket.emit("message:send", {
      threadId: selectedThread,
      body: input,
    });

    setInput("");
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    socket.emit("typing:stop", { threadId: selectedThread });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);

    if (socket && selectedThread) {
      socket.emit("typing:start", { threadId: selectedThread });
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("typing:stop", { threadId: selectedThread });
      }, 2000);
    }
  };

  const handleStartChat = async (targetUserId: string) => {
    try {
      const thread = await createDirectThread(targetUserId);
      queryClient.invalidateQueries({ queryKey: ["chat-threads"] });
      setSelectedThread(thread.id);
      setShowNewChatDialog(false);
    } catch (error) {
      console.error("Error starting chat:", error);
    }
  };

  const getThreadDisplayName = (thread: ChatThread) => {
    if (thread.type === "group" && thread.name) {
      return thread.name;
    }
    const otherParticipant = thread.participants.find(p => p.id !== user?.id);
    return otherParticipant?.name || otherParticipant?.username || "Conversa";
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const selectedThreadData = threads.find(t => t.id === selectedThread);

  return (
    <BrowserFrame>
      <div className="h-full w-full flex bg-[#111b21]">
        <div className="w-[400px] bg-[#111b21] flex flex-col border-r border-[#222d34]">
          <div className="p-4 bg-[#202c33] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-[#00a884] text-white">
                  {getInitials(user?.name || user?.username)}
                </AvatarFallback>
              </Avatar>
              <span className="text-white font-medium">Chat Interno</span>
            </div>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-[#aebac1] hover:bg-[#2a3942]" 
                onClick={toggleMute}
                data-testid="button-mute-toggle"
                title={isMuted ? "Ativar som" : "Silenciar notificações"}
              >
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </Button>
              <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-[#aebac1] hover:bg-[#2a3942]" data-testid="button-new-chat">
                    <Plus className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
              <DialogContent className="bg-[#222e35] border-[#222d34] text-white">
                <DialogHeader>
                  <DialogTitle>Nova Conversa</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 mt-4">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#2a3942] cursor-pointer"
                      onClick={() => handleStartChat(u.id)}
                      data-testid={`user-${u.id}`}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-[#00a884] text-white">
                          {getInitials(u.name || u.username)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{u.name || u.username}</div>
                        <div className="text-sm text-[#8696a0]">@{u.username}</div>
                      </div>
                      {onlineUsers.has(u.id) && (
                        <div className="ml-auto w-2 h-2 rounded-full bg-[#00a884]" />
                      )}
                    </div>
                  ))}
                </div>
              </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="p-2 bg-[#111b21]">
            <div className="flex items-center bg-[#202c33] rounded-lg px-4 py-2">
              <Search className="h-4 w-4 text-[#8696a0]" />
              <Input
                placeholder="Pesquisar ou começar nova conversa"
                className="border-0 bg-transparent text-white placeholder:text-[#8696a0] focus-visible:ring-0"
                data-testid="input-search"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            {loadingThreads ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[#00a884]" />
              </div>
            ) : threads.length === 0 ? (
              <div className="text-center py-12 text-[#8696a0]">
                <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>Nenhuma conversa ainda</p>
                <p className="text-sm mt-2">Clique em + para iniciar uma conversa</p>
              </div>
            ) : (
              <div>
                {threads.map((thread) => {
                  const displayName = getThreadDisplayName(thread);
                  const otherParticipant = thread.participants.find(p => p.id !== user?.id);
                  const isOnline = otherParticipant && onlineUsers.has(otherParticipant.id);
                  
                  return (
                    <div
                      key={thread.id}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#202c33] ${
                        selectedThread === thread.id ? "bg-[#2a3942]" : ""
                      }`}
                      onClick={() => setSelectedThread(thread.id)}
                      data-testid={`thread-${thread.id}`}
                    >
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-[#6b7c85] text-white">
                            {thread.type === "group" ? (
                              <Users className="h-6 w-6" />
                            ) : (
                              getInitials(displayName)
                            )}
                          </AvatarFallback>
                        </Avatar>
                        {isOnline && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#00a884] border-2 border-[#111b21]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-medium truncate">{displayName}</span>
                          {thread.lastMessage && (
                            <span className="text-xs text-[#8696a0]">
                              {formatTime(thread.lastMessage.sentAt)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-[#8696a0] truncate">
                          {thread.lastMessage && (
                            <>
                              {thread.lastMessage.senderId === user?.id && (
                                <CheckCheck className="h-4 w-4 text-[#53bdeb]" />
                              )}
                              <span className="truncate">{thread.lastMessage.body}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {thread.unreadCount > 0 && (
                        <div className="bg-[#00a884] text-white text-xs rounded-full h-5 min-w-[20px] flex items-center justify-center px-1">
                          {thread.unreadCount}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="flex-1 flex flex-col">
          {!selectedThread ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#222e35]">
              <div className="w-80 text-center">
                <MessageCircle className="h-24 w-24 mx-auto mb-6 text-[#8696a0] opacity-50" />
                <h2 className="text-3xl font-light text-[#e9edef] mb-2">Chat Interno Arcádia</h2>
                <p className="text-[#8696a0]">
                  Envie e receba mensagens com sua equipe em tempo real.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="h-16 bg-[#202c33] flex items-center justify-between px-4 border-b border-[#222d34]">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-[#6b7c85] text-white">
                      {selectedThreadData?.type === "group" ? (
                        <Users className="h-5 w-5" />
                      ) : (
                        getInitials(selectedThreadData ? getThreadDisplayName(selectedThreadData) : "")
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-white font-medium">
                      {selectedThreadData ? getThreadDisplayName(selectedThreadData) : ""}
                    </div>
                    <div className="text-xs text-[#8696a0]">
                      {typingUsers.get(selectedThread)?.size ? (
                        <span className="text-[#00a884]">digitando...</span>
                      ) : (
                        "online"
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="icon" className="text-[#aebac1] hover:bg-[#2a3942]">
                    <Video className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-[#aebac1] hover:bg-[#2a3942]">
                    <Phone className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-[#aebac1] hover:bg-[#2a3942]">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 bg-[#0b141a]" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"%3E%3Cpath d=\"M0 0h100v100H0z\" fill=\"%230b141a\"/%3E%3Cpath d=\"M10 10h10v10H10zm20 0h10v10H30zm20 0h10v10H50zm20 0h10v10H70zM0 20h10v10H0zm20 0h10v10H20zm20 0h10v10H40zm20 0h10v10H60zm20 0h10v10H80z\" fill=\"%23172823\" opacity=\"0.3\"/%3E%3C/svg%3E')" }}>
                <div className="p-4 space-y-2 min-h-full">
                  {messages.map((msg) => {
                    const isMe = msg.senderId === user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                        data-testid={`message-${msg.id}`}
                      >
                        <div
                          className={`max-w-[65%] rounded-lg px-3 py-2 ${
                            isMe
                              ? "bg-[#005c4b] text-white"
                              : "bg-[#202c33] text-white"
                          }`}
                        >
                          {!isMe && selectedThreadData?.type === "group" && (
                            <div className="text-xs text-[#00a884] mb-1">
                              {msg.senderName || msg.senderUsername}
                            </div>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-[10px] text-[#8696a0]">
                              {formatTime(msg.sentAt)}
                            </span>
                            {isMe && (
                              <CheckCheck className="h-3 w-3 text-[#53bdeb]" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <div className="h-16 bg-[#202c33] flex items-center gap-3 px-4">
                <Button variant="ghost" size="icon" className="text-[#8696a0] hover:bg-[#2a3942]">
                  <Smile className="h-6 w-6" />
                </Button>
                <Button variant="ghost" size="icon" className="text-[#8696a0] hover:bg-[#2a3942]">
                  <Paperclip className="h-6 w-6" />
                </Button>
                <Input
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                  placeholder="Digite uma mensagem"
                  className="flex-1 bg-[#2a3942] border-0 text-white placeholder:text-[#8696a0] focus-visible:ring-0 rounded-lg"
                  data-testid="input-message"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!input.trim()}
                  variant="ghost"
                  size="icon"
                  className="text-[#8696a0] hover:bg-[#2a3942]"
                  data-testid="button-send"
                >
                  <Send className="h-6 w-6" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </BrowserFrame>
  );
}
