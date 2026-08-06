import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { buscarColegasDm, iniciarDm } from "@/lib/chats/central.functions";
import { iniciais } from "./helpers";

export function NovaConversaDialog({
  onCriado,
}: {
  onCriado: (v: { id: string; nome: string | null }) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const buscarFn = useServerFn(buscarColegasDm);
  const iniciarFn = useServerFn(iniciarDm);
  const qc = useQueryClient();

  const { data: colegas, isLoading } = useQuery({
    queryKey: ["dm-colegas", termo],
    queryFn: () => buscarFn({ data: { termo } }),
    enabled: aberto,
  });

  const iniciar = useMutation({
    mutationFn: (other: { id: string; nome: string | null }) =>
      iniciarFn({ data: { other_id: other.id } }).then((r) => ({
        id: r.id,
        nome: other.nome,
      })),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["threads-central"] });
      setAberto(false);
      onCriado(r);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao iniciar conversa."),
  });

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" /> Nova mensagem
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Iniciar mensagem direta</DialogTitle>
          <DialogDescription>Escolha um colega para começar a conversa.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Buscar por nome…"
              className="pl-9"
            />
          </div>
          <ScrollArea className="h-64 rounded-md border">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : !colegas?.length ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Nenhum colega encontrado.
              </p>
            ) : (
              <ul className="divide-y">
                {colegas.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => iniciar.mutate({ id: c.id, nome: c.nome })}
                      disabled={iniciar.isPending}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                    >
                      <Avatar className="size-9 border border-border/60">
                        {c.foto_url && <AvatarImage src={c.foto_url} alt={c.nome ?? ""} />}
                        <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                          {iniciais(c.nome)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.nome ?? "Sem nome"}</p>
                        <p className="truncate text-xs text-muted-foreground">{c.email ?? ""}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function IniciarDmInline({
  onCriado,
}: {
  onCriado: (v: { id: string; nome: string | null }) => void;
}) {
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState(false);
  const buscarFn = useServerFn(buscarColegasDm);
  const iniciarFn = useServerFn(iniciarDm);
  const qc = useQueryClient();

  const { data: colegas, isLoading } = useQuery({
    queryKey: ["dm-colegas-inline", termo],
    queryFn: () => buscarFn({ data: { termo } }),
    enabled: aberto,
  });

  const iniciar = useMutation({
    mutationFn: (other: { id: string; nome: string | null }) =>
      iniciarFn({ data: { other_id: other.id } }).then((r) => ({
        id: r.id,
        nome: other.nome,
      })),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["threads-central"] });
      setTermo("");
      setAberto(false);
      onCriado(r);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao iniciar conversa."),
  });

  return (
    <div className="relative">
      <div className="relative">
        <Plus className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
        <Input
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          placeholder="Nova conversa: digite o nome do usuário…"
          className="border-primary/30 bg-primary/5 pl-9 placeholder:text-primary/70 focus-visible:border-primary"
        />
      </div>
      {aberto && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-auto rounded-md border bg-popover shadow-lg">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : !colegas?.length ? (
            <p className="px-4 py-5 text-center text-xs text-muted-foreground">
              {termo ? "Nenhum usuário encontrado." : "Comece a digitar o nome…"}
            </p>
          ) : (
            <ul className="divide-y">
              {colegas.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => iniciar.mutate({ id: c.id, nome: c.nome })}
                    disabled={iniciar.isPending}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/60"
                  >
                    <Avatar className="size-8 border border-border/60">
                      {c.foto_url && <AvatarImage src={c.foto_url} alt={c.nome ?? ""} />}
                      <AvatarFallback className="bg-primary/15 text-[10px] font-semibold text-primary">
                        {iniciais(c.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.nome ?? "Sem nome"}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.email ?? ""}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
