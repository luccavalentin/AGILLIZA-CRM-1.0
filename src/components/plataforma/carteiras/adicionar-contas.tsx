import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useValorAssentado } from "@/components/plataforma/paginacao";
import { CampoBusca, ChipsFiltro, EstadoErro, EstadoVazio, ListaCarregando, Selo } from "@/components/plataforma/kit";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { cn } from "@/lib/utils";
import { listarLicencas, type Licenca } from "@/lib/plataforma/licencas.functions";
import { adicionarContasCarteira, type Carteira } from "@/lib/plataforma/carteiras.functions";
import { CHAVE_CARTEIRAS } from "./form-carteira";
import { ROTULO_TIPO } from "./comum";

type Recorte = "sem" | "todas";

/**
 * Escolher contas para a carteira: busca nas licenças, marca várias e confirma.
 * Conta que está em outra carteira mostra de onde sai (uma conta fica numa carteira por vez).
 */
export function AdicionarContas({
  carteira,
  aberto,
  aoFechar,
}: {
  carteira: Carteira;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const qc = useQueryClient();
  const listarFn = useServerFn(listarLicencas);
  const adicionarFn = useServerFn(adicionarContasCarteira);
  const [busca, setBusca] = useState("");
  const [recorte, setRecorte] = useState<Recorte>("sem");
  const [marcadas, setMarcadas] = useState<Map<string, Licenca>>(new Map());
  const termo = useValorAssentado(busca.trim());

  useEffect(() => {
    if (!aberto) {
      setBusca("");
      setMarcadas(new Map());
      setRecorte("sem");
    }
  }, [aberto]);

  const q = useQuery({
    queryKey: ["plataforma-licencas", "para-carteira", termo, recorte],
    queryFn: () =>
      listarFn({ data: { busca: termo || null, carteira: recorte === "sem" ? "sem" : null, pagina: 1 } }),
    enabled: aberto,
    staleTime: 15_000,
    placeholderData: (a) => a,
  });
  const licencas = (q.data?.licencas ?? []).filter((l) => l.status !== "cancelado");

  const alternar = (l: Licenca) =>
    setMarcadas((m) => {
      const n = new Map(m);
      if (n.has(l.id)) n.delete(l.id);
      else n.set(l.id, l);
      return n;
    });

  const salvar = useMutation({
    mutationFn: () => adicionarFn({ data: { id: carteira.id, contas: [...marcadas.keys()] } }),
    onSuccess: (r) => {
      toast.success(
        r.adicionadas === 0
          ? "As contas escolhidas já estavam nesta carteira."
          : `${r.adicionadas} conta(s) na carteira ${carteira.nome}.`,
      );
      qc.invalidateQueries({ queryKey: CHAVE_CARTEIRAS });
      qc.invalidateQueries({ queryKey: ["plataforma-licencas"] });
      aoFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível adicionar as contas.")),
  });

  const saem = [...marcadas.values()].filter(
    (l) => l.carteira_grupo_id && l.carteira_grupo_id !== carteira.id,
  );

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar contas à carteira {carteira.nome}</DialogTitle>
          <DialogDescription>
            As contas escolhidas passam a ser atendidas por {carteira.responsavel.nome}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <CampoBusca
            valor={busca}
            onChange={setBusca}
            rotulo="Buscar conta"
            placeholder="Nome, endereço do site ou e-mail"
            className="sm:flex-1 md:w-auto lg:w-auto"
          />
          <ChipsFiltro<Recorte>
            rotulo="Quais contas"
            valor={recorte}
            onChange={setRecorte}
            opcoes={[
              { valor: "sem", rotulo: "Sem carteira" },
              { valor: "todas", rotulo: "Todas" },
            ]}
          />
        </div>

        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          {q.isLoading && <ListaCarregando linhas={4} />}
          {q.isError && (
            <EstadoErro mensagem={mensagemDeErro(q.error, "Não foi possível buscar as contas.")} onTentar={() => q.refetch()} />
          )}
          {!q.isLoading && !q.isError && licencas.length === 0 && (
            <EstadoVazio
              titulo={termo ? "Nenhuma conta com esta busca" : "Nenhuma conta sem carteira"}
              descricao={recorte === "sem" ? "Veja também as contas que já estão em outra carteira." : undefined}
            />
          )}
          <ul className="space-y-1.5 py-1">
            {licencas.map((l) => {
              const marcada = marcadas.has(l.id);
              const aqui = l.carteira_grupo_id === carteira.id;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    disabled={aqui}
                    onClick={() => alternar(l)}
                    aria-pressed={marcada}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                      marcada ? "border-primary/50 bg-primary/[0.05]" : "border-border hover:bg-secondary/60",
                      aqui && "cursor-default opacity-60",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-md border",
                        marcada ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
                      )}
                      aria-hidden
                    >
                      {marcada && <Check className="size-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{l.nome}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {ROTULO_TIPO[l.tipo]} · {l.plano ?? "sem plano"} · {l.email_contato ?? l.slug}
                      </span>
                    </span>
                    {aqui ? (
                      <Selo tom="marca">Já nesta carteira</Selo>
                    ) : l.carteira_grupo_nome ? (
                      <Selo tom="alerta" className="hidden sm:inline-flex">
                        Em {l.carteira_grupo_nome}
                      </Selo>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {saem.length > 0 && (
          <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
            {saem.length} conta(s) saem da carteira em que estão hoje (
            {[...new Set(saem.map((l) => l.carteira_grupo_nome))].join(", ")}).
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" className="min-h-11 sm:min-h-9" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button
            className="min-h-11 sm:min-h-9"
            disabled={marcadas.size === 0 || salvar.isPending}
            onClick={() => salvar.mutate()}
          >
            {salvar.isPending
              ? "Adicionando…"
              : marcadas.size === 0
                ? "Escolha as contas"
                : `Adicionar ${marcadas.size} conta(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
