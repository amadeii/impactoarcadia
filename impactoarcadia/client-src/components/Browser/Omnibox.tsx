import { 
  ArrowLeft, 
  ArrowRight, 
  RotateCw, 
  Star, 
  Lock, 
  MoreVertical,
  Puzzle,
  LogOut,
  User,
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface OmniboxProps {
  url: string;
  onNavigate: (url: string) => void;
  isLoading?: boolean;
}

export function Omnibox({ url, onNavigate, isLoading }: OmniboxProps) {
  const { user, logoutMutation } = useAuth();

  return (
    <div className="flex items-center gap-2 w-full h-10 px-2 bg-background border-b border-border shadow-xs z-20">
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
          <RotateCw className={`w-4 h-4 text-muted-foreground ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex-1 flex items-center bg-muted/50 hover:bg-muted/80 focus-within:bg-white focus-within:shadow-sm focus-within:ring-2 ring-primary/20 transition-all rounded-full px-3 h-8 mx-2 border border-transparent focus-within:border-primary/30">
        <Lock className="w-3.5 h-3.5 text-green-600 mr-2 shrink-0" />
        <input 
          className="flex-1 bg-transparent border-none outline-none text-sm h-full w-full"
          value={url}
          readOnly
        />
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-slate-200">
            <Star className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <div className="flex gap-1 items-center">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
          <Puzzle className="w-4 h-4 text-muted-foreground" />
        </Button>
        <div className="w-[1px] h-4 bg-border mx-1" />
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
          <MoreVertical className="w-4 h-4 text-muted-foreground" />
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full ml-1" data-testid="button-user-menu">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                {user?.name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || "U"}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name || user?.username}</p>
                <p className="text-xs leading-none text-muted-foreground">@{user?.username}</p>
                {(user?.role === "admin" || user?.role === "master") && (
                  <p className="text-xs leading-none text-primary flex items-center gap-1 mt-1">
                    <Shield className="w-3 h-3" />
                    {user?.role === "master" ? "Administrador Master" : "Administrador"}
                  </p>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              <span>Meu Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={() => logoutMutation.mutate()}
              data-testid="button-logout"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
