import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

export function DigitalClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
  };

  return (
    <div 
      className="flex items-center gap-2 text-xs text-muted-foreground px-2 py-1 rounded bg-muted/50"
      data-testid="digital-clock"
    >
      <Clock className="w-3 h-3" />
      <span className="font-mono">{formatTime(time)}</span>
      <span className="text-muted-foreground/70">•</span>
      <span>{formatDate(time)}</span>
    </div>
  );
}
