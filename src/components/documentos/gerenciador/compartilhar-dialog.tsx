import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Lock, Trash2, Unlock, UserRound, Users } from "lucide-react";
import {
  lerAcesso,
  listarAlvosCompartilhar,
  salvarAcesso,
  type AcessoItem,
  type ArquivoNo,
} from "@/lib/documentos/arquivos.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { mensagemDeErro } from "@/lib/erros/mensagem";

type Nivel = AcessoItem["nivel"];
const ROTULO: Record<Nivel, string> = { ver: "Pode ver", editar: "Pode editar", gerir: "Pode gerir" };

/**
 * Compartilhar e permissões de um item. "Acesso restrito" liga a lista: só quem criou, o
 * dono/admin e quem está na lista (pessoa ou equipe = nível de acesso) entra. Desligado,
 * vale a permissão normal de Arquivos para toda a equipe.
 */
export function CompartilharDialog({ no, onClose }: { no: ArquivoNo | null; onClose: () => void }) {
  const qc = useQueryClient();
  const fnLer = useServerFn(lerAcesso);
  const fnAlvos = useServerFn(listarAlvosCompartilhar);
  const fnSalvar = useServerFn(salvarAcesso);
  const [restrita, setRestrita] = useState(false);
  const [lista, setLista] = useState<AcessoItem[]>([]);
  const [salvando, setSalvando] = useState(false);

  const atual = useQuery({
    queryKey: ["arquivos-acesso", no?.id],
    queryFn: () => fnLer({ data: { id: no!.id } }),
    enabled: !!no,
  });
  const alvos = useQuery({
    queryKey: ["arquivos-alvos"],
    queryFn: () => fnAlvos(),
    enabled: !!no,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (atual.data) {
      setRestrita(atual.data.restrita);
      setLista(atual.data.acessos);
    }
  }, [atual.data]);

  const disponiveis = useMemo(() => {
    const usados = new Set(lista.map((a) => a.user_id ?? a.nivel_acesso_id));
    return {
      pessoas: (alvos.data?.pessoas ?? []).filter((p) => !usados.has(p.id)),
      equipes: (alvos.data?.equipes ?? []).filter((e) => !usados.has(e.id)),
    };
  }, [alvos.data, lista]);

  function adicionar(valor: string) {
    const [tipo, id] = valor.split(":");
    const nome =
      tipo === "p"
        ? alvos.data?.pessoas.find((p) => p.id === id)?.nome
        : alvos.data?.equipes.find((e) => e.id === id)?.nome;
    setLista((l) => [
      ...l,
      {
        user_id: tipo === "p" ? id : null,
        nivel_acesso_id: tipo === "e" ? id : null,
        nivel: "ver",
        nome: nome ?? null,
      },
    ]);
  }

  async function salvar() {
    if (!no) return;
    setSalvando(true);
    try {
      await fnSalvar({
        data: {
          id: no.id,
          restrita,
          acessos: lista.map((a) => ({
            user_id: a.user_id,
            nivel_acesso_id: a.nivel_acesso_id,
            nivel: a.nivel,
          })),
        },
      });
      toast.success(restrita ? "Acesso restrito salvo." : "Acesso salvo.");
      qc.invalidateQueries({ queryKey: ["arquivos"] });
      qc.invalidateQueries({ queryKey: ["arquivos-acesso", no.id] });
      onClose();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível salvar o acesso."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={!!no} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="break-words">Compartilhar “{no?.nome}”</DialogTitle>
          <DialogDescription>
            Defina quem vê e quem mexe {no?.tipo === "pasta" ? "nesta pasta e no que está dentro dela" : "neste arquivo"}.
          </DialogDescription>
        </DialogHeader>

        {atual.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : atual.isError ? (
          <p className="text-sm text-destructive">{mensagemDeErro(atual.error, "Não foi possível ler o acesso.")}</p>
        ) : (
          <div className="space-y-4">
            <label className="flex items-start gap-3 rounded-lg border border-border/70 p-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                {restrita ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Acesso restrito</span>
                <span className="block text-xs text-muted-foreground">
                  {restrita
                    ? "Só quem criou, o dono/administrador e a lista abaixo."
                    : "Toda a equipe com permissão de Arquivos. A lista abaixo só vale com o acesso restrito ligado."}
                </span>
              </span>
              <Switch checked={restrita} onCheckedChange={setRestrita} aria-label="Acesso restrito" />
            </label>

            <div className="space-y-2">
              <Select value="" onValueChange={adicionar}>
                <SelectTrigger className="w-full sm:w-72" aria-label="Adicionar pessoa ou equipe">
                  <SelectValue placeholder="Adicionar pessoa ou equipe…" />
                </SelectTrigger>
                <SelectContent>
                  {disponiveis.equipes.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Equipes (nível de acesso)</SelectLabel>
                      {disponiveis.equipes.map((e) => (
                        <SelectItem key={e.id} value={`e:${e.id}`}>
                          {e.nome}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {disponiveis.pessoas.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Pessoas</SelectLabel>
                      {disponiveis.pessoas.map((p) => (
                        <SelectItem key={p.id} value={`p:${p.id}`}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {disponiveis.equipes.length + disponiveis.pessoas.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">Ninguém para adicionar.</div>
                  )}
                </SelectContent>
              </Select>

              {lista.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
                  Ninguém na lista ainda.
                </p>
              ) : (
                <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
                  {lista.map((a, i) => (
                    <li key={a.user_id ?? a.nivel_acesso_id} className="flex items-center gap-2 px-3 py-2">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        {a.user_id ? <UserRound className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {a.nome ?? "—"}
                        {!a.user_id && <span className="text-xs text-muted-foreground"> · equipe</span>}
                      </span>
                      <Select
                        value={a.nivel}
                        onValueChange={(v) =>
                          setLista((l) => l.map((x, j) => (j === i ? { ...x, nivel: v as Nivel } : x)))
                        }
                      >
                        <SelectTrigger className="h-8 w-[8.5rem] text-xs" aria-label="Nível">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(ROTULO) as Nivel[]).map((n) => (
                            <SelectItem key={n} value={n}>
                              {ROTULO[n]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        aria-label={`Tirar ${a.nome ?? ""}`}
                        onClick={() => setLista((l) => l.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] text-muted-foreground">
                Ver: abre e baixa. Editar: envia, renomeia e move. Gerir: também compartilha e manda para a lixeira.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando || atual.isLoading || atual.isError}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
