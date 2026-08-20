import { Search, MessageSquarePlus, Trash2, PanelLeftClose, PanelLeftOpen, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConsultorSidebarProps {
  conversas: any[];
  conversaId: string | null;
  busca: string;
  setBusca: (v: string) => void;
  setConversaId: (id: string | null) => void;
  onNovaConversa: () => void;
  onExcluir: (id: string) => void;
  isOpen: boolean;
  toggle: () => void;
}

export function ConsultorSidebar({
  conversas,
  conversaId,
  busca,
  setBusca,
  setConversaId,
  onNovaConversa,
  onExcluir,
  isOpen,
  toggle,
}: ConsultorSidebarProps) {
  const conversasFiltradas = busca.trim() 
    ? conversas.filter(c => c.titulo.toLowerCase().includes(busca.toLowerCase()))
    : conversas;

  // Agrupamento temporal sutil
  const hoje = new Date();
  const formatarData = (date: string | Date | null | undefined) => {
    if (!date) return "";
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return "";
    if (d.toDateString() === hoje.toDateString()) return "Hoje";
    return format(d, "dd 'de' MMMM", { locale: ptBR });
  };

  if (!isOpen) {
    return (
      <div className="flex h-full w-14 flex-col items-center border-r border-border/40 bg-card/30 py-4 transition-all">
        <Button variant="ghost" size="icon" onClick={toggle} className="mb-4 text-muted-foreground">
          <PanelLeftOpen className="size-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onNovaConversa} className="text-primary">
          <MessageSquarePlus className="size-5" />
        </Button>
      </div>
    );
  }

  return (
    <aside className="flex h-full w-[280px] flex-col border-r border-border/40 bg-card/30 backdrop-blur-xl transition-all">
      <div className="flex items-center justify-between p-4">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
          Histórico
        </h3>
        <Button variant="ghost" size="icon" onClick={toggle} className="size-8 text-muted-foreground">
          <PanelLeftClose className="size-4" />
        </Button>
      </div>

      <div className="px-4 pb-4">
        <div className="relative group">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50 transition-colors group-focus-within:text-primary" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar conversa..."
            className="h-9 rounded-xl border-border/40 bg-background/50 pl-9 text-xs focus-visible:ring-1 focus-visible:ring-primary/30"
          />
        </div>
      </div>

      <div className="px-4 pb-2">
        <Button 
          onClick={onNovaConversa}
          variant="outline"
          className="w-full justify-start gap-2 rounded-xl border-primary/10 bg-primary/[0.03] text-xs font-semibold text-primary transition-all hover:bg-primary hover:text-white"
        >
          <MessageSquarePlus className="size-4" />
          Nova conversa
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3 custom-scrollbar">
        {conversasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground/60">
            <MessageSquarePlus className="mb-2 size-6 opacity-10" />
            <p className="text-[10px] font-medium opacity-50">
              {busca ? "Nada encontrado." : "Nenhuma conversa."}
            </p>
          </div>
        ) : (
          conversasFiltradas.map((c) => {
            const ativa = conversaId === c.id;
            return (
              <div
                key={c.id}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs transition-all border border-transparent cursor-pointer",
                  ativa
                    ? "bg-primary/[0.06] border-primary/20 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
                onClick={() => setConversaId(c.id)}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{c.titulo}</div>
                  <div className="mt-0.5 text-[9px] opacity-50 flex items-center gap-1">
                    <Calendar className="size-2" />
                    {formatarData(c.created_at || c.updated_at)}
                  </div>
                </div>
                
                <button
                  type="button"
                  aria-label="Excluir conversa"
                  className={cn(
                    "transition-opacity",
                    ativa ? "opacity-80 hover:opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onExcluir(c.id);
                  }}
                >
                  <Trash2
                    className={cn(
                      "size-3.5",
                      ativa ? "text-primary" : "text-muted-foreground/60 hover:text-destructive"
                    )}
                  />
                </button>
                
                {ativa && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 bg-primary rounded-r-full" />
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
