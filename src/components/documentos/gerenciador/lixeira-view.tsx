import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Folder, RotateCcw, Trash2 } from "lucide-react";
import {
  excluirDefinitivo,
  listarLixeira,
  restaurarDaLixeira,
  type ItemLixeira,
} from "@/lib/documentos/arquivos.functions";
import { formatarBytes } from "@/lib/documentos/arquivos-regras";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { estiloArquivo } from "./arquivo-utils";

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Lixeira: o que foi mandado para lá, com restaurar e excluir para sempre. */
export function LixeiraView({ onRestaurado }: { onRestaurado: (pasta: string | null) => void }) {
  const qc = useQueryClient();
  const fnListar = useServerFn(listarLixeira);
  const fnRestaurar = useServerFn(restaurarDaLixeira);
  const fnExcluir = useServerFn(excluirDefinitivo);
  const [excluindo, setExcluindo] = useState<ItemLixeira | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const itens = useQuery({ queryKey: ["arquivos", "lixeira"], queryFn: () => fnListar() });

  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ["arquivos"] });
    qc.invalidateQueries({ queryKey: ["arquivos-armazenamento"] });
  };

  async function restaurar(i: ItemLixeira) {
    setOcupado(i.id);
    try {
      const r = await fnRestaurar({ data: { id: i.id } });
      toast.success(`“${i.nome}” foi restaurado.`, {
        action: { label: "Abrir pasta", onClick: () => onRestaurado(r.pasta) },
      });
      atualizar();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível restaurar."));
    } finally {
      setOcupado(null);
    }
  }

  async function excluir() {
    const i = excluindo;
    if (!i) return;
    setExcluindo(null);
    setOcupado(i.id);
    try {
      await fnExcluir({ data: { id: i.id } });
      toast.success(`“${i.nome}” foi excluído para sempre.`);
      atualizar();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível excluir."));
    } finally {
      setOcupado(null);
    }
  }

  if (itens.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  if (itens.isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
        {mensagemDeErro(itens.error, "Não foi possível abrir a lixeira.")}
        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={() => itens.refetch()}>
            Tentar de novo
          </Button>
        </div>
      </div>
    );
  }
  const lista = itens.data ?? [];
  if (lista.length === 0) {
    return (
      <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-border/70 p-8 text-center">
        <span className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Trash2 className="h-6 w-6" />
        </span>
        <p className="font-semibold">A lixeira está vazia</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          O que você mandar para a lixeira fica aqui até ser restaurado ou excluído para sempre.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="mb-2 text-xs text-muted-foreground">
        Itens na lixeira ainda ocupam espaço. Excluir para sempre não tem volta.
      </p>
      <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-card">
        {lista.map((i) => {
          const est = i.tipo === "arquivo" ? estiloArquivo(i.content_type, i.nome) : null;
          const Icone = est?.Icon ?? Folder;
          return (
            <li key={i.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 sm:flex-nowrap">
              <span
                className={
                  i.tipo === "pasta"
                    ? "flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                    : `flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${est!.classe}`
                }
              >
                <Icone className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{i.nome}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  de {i.origem} · {formatarBytes(i.tamanho)} · {dataHora(i.excluido_em)}
                  {i.excluido_por_nome ? ` · por ${i.excluido_por_nome}` : ""}
                </span>
              </span>
              <span className="ml-auto flex shrink-0 gap-1.5">
                <Button size="sm" variant="outline" disabled={ocupado === i.id} onClick={() => restaurar(i)}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restaurar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={ocupado === i.id}
                  onClick={() => setExcluindo(i)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir
                </Button>
              </span>
            </li>
          );
        })}
      </ul>

      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{excluindo?.nome}” para sempre?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluindo?.tipo === "pasta"
                ? "A pasta, tudo o que está dentro e todas as versões serão apagados. Não tem volta."
                : "O arquivo e todas as versões serão apagados. Não tem volta."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={excluir}
            >
              Excluir para sempre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
