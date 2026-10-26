import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabelaSimulacoes } from "@/components/simulacao/lista-page/tabela-simulacoes";
import { CartoesSimulacoes } from "@/components/simulacao/lista-page/cartoes-simulacoes";
import type { HandlersLinha } from "@/components/simulacao/lista-page/tipos";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { espelharSimulacaoDaConta } from "@/lib/plataforma/conta-nativa.functions";
import { listarSimulacoesDoGrupo } from "@/lib/plataforma/filtro-base.functions";
import type { Grupo } from "@/lib/plataforma/filtro-base";
import { destinoDaLinha, type LinhaDeConta } from "./espelho-linha";

/**
 * Handlers da tela de Simulações para linhas do Agilliza Tech: cada ação abre a simulação no
 * Agilliza (espelho idempotente, pela conta da PRÓPRIA linha) e chama o handler nativo com o id
 * de lá. Excluir é do assinante. Serve à visão de uma conta e às listas de grupo.
 */
export function useHandlersDeConta({
  itens,
  handlers,
  contaDaTela = null,
  chaveLista,
}: {
  itens: LinhaDeConta[];
  handlers: HandlersLinha;
  contaDaTela?: string | null;
  /** Chave da lista para revalidar depois do espelho (o vínculo passa a aparecer). */
  chaveLista: readonly unknown[];
}): HandlersLinha {
  const qc = useQueryClient();
  const espelharFn = useServerFn(espelharSimulacaoDaConta);
  const chave = JSON.stringify(chaveLista);
  return useMemo(() => {
    async function noAgilliza(id: string): Promise<string | null> {
      const linha = itens.find((s) => s.id === id);
      const destino = destinoDaLinha(linha, contaDaTela);
      if (destino.tipo === "direto") return destino.id;
      if (destino.tipo === "nenhum") {
        toast.error("Não foi possível identificar a conta desta simulação.");
        return null;
      }
      const aviso = toast.loading(
        `Abrindo a simulação${linha?._conta ? ` de ${linha._conta}` : " do assinante"} no Agilliza…`,
      );
      try {
        const r = await espelharFn({
          data: { licenca: destino.licenca, simulacaoId: destino.simulacaoId },
        });
        qc.invalidateQueries({ queryKey: JSON.parse(chave) });
        toast.dismiss(aviso);
        if (r.pendencias_imovel?.length) {
          toast.info(
            `Para enviar ao banco, falta no cadastro do imóvel: ${r.pendencias_imovel.join(", ")}.`,
            { duration: 8_000 },
          );
        }
        return r.simulacao_id;
      } catch (e) {
        toast.dismiss(aviso);
        toast.error(mensagemDeErro(e, "Não foi possível abrir esta simulação no Agilliza."));
        return null;
      }
    }
    const com =
      <A extends unknown[]>(fn: (id: string, ...a: A) => unknown) =>
      async (id: string, ...a: A) => {
        const alvo = await noAgilliza(id);
        if (alvo) await fn(alvo, ...a);
      };
    return {
      onVer: (id) => void com(handlers.onVer)(id),
      onEditar: com(handlers.onEditar),
      onBaixarComparativo: com(handlers.onBaixarComparativo),
      onBaixarDetalhada: com(handlers.onBaixarDetalhada),
      onDuplicar: (id) => void com(handlers.onDuplicar)(id),
      onEnviarProposta: com(handlers.onEnviarProposta),
      onEncaminhar: com(handlers.onEncaminhar),
      onDestravar: com(handlers.onDestravar),
      onExcluir: async (id) => {
        const linha = itens.find((s) => s.id === id);
        toast.info(
          `Esta simulação é da conta ${linha?._conta ?? "do assinante"}: só o assinante pode excluí-la.`,
        );
      },
      onRestaurar: () => undefined,
      podeExcluir: false,
    };
  }, [itens, handlers, contaDaTela, espelharFn, qc, chave]);
}

/**
 * Simulações de um grupo do Agilliza Tech ("Sua base": contas vinculadas; ou todos os assinantes)
 * com os MESMOS cartões, tabela e ações da base própria, paginadas no servidor. Em "Sua base" com
 * tudo junto, o que já foi levado ao Agilliza aparece só pela cópia de lá (`semNoAgilliza`).
 */
export function SimulacoesDoGrupo({
  grupo,
  licenca = null,
  termo = "",
  semNoAgilliza = false,
  handlers,
  secao = false,
}: {
  grupo: Grupo;
  licenca?: string | null;
  termo?: string;
  semNoAgilliza?: boolean;
  handlers: HandlersLinha;
  /** Mostrada abaixo da base do Agilliza, com título próprio (some se vazia). */
  secao?: boolean;
}) {
  const listarFn = useServerFn(listarSimulacoesDoGrupo);
  const [pagina, setPagina] = useState(1);
  useEffect(() => setPagina(1), [grupo, licenca, termo, semNoAgilliza]);

  const chave = ["simulacoes-do-grupo", grupo, licenca, termo, semNoAgilliza] as const;
  const consulta = useQuery({
    queryKey: [...chave, pagina],
    queryFn: () =>
      listarFn({
        data: { grupo, licenca, termo: termo.trim() || null, semNoAgilliza, pagina },
      }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const itens = useMemo(() => consulta.data?.itens ?? [], [consulta.data]);
  const total = consulta.data?.total ?? 0;
  const porPagina = consulta.data?.porPagina ?? 20;
  const handlersGrupo = useHandlersDeConta({ itens, handlers, chaveLista: chave });

  if (secao && !consulta.isLoading && !consulta.isError && total === 0) return null;

  return (
    <section className="space-y-2" aria-label={secao ? "Simulações de corretores vinculados" : undefined}>
      {secao && (
        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/8 text-primary ring-1 ring-inset ring-primary/12">
              <Network className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-foreground">
                Simulações de corretores vinculados
              </h2>
              <p className="truncate text-xs text-muted-foreground">
                Contas do Agilliza Tech que fazem parte da sua base.
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums text-muted-foreground">
            {consulta.data ? total : "—"}
          </span>
        </div>
      )}

      {consulta.isError && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {mensagemDeErro(consulta.error, "Não foi possível carregar as simulações.")}
          <Button size="sm" variant="outline" className="h-9" onClick={() => consulta.refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      <TabelaSimulacoes
        itens={itens}
        isLoading={consulta.isLoading}
        escopo="todas"
        verExcluidas={false}
        handlers={handlersGrupo}
      />
      <CartoesSimulacoes
        itens={itens}
        isLoading={consulta.isLoading}
        escopo="todas"
        verExcluidas={false}
        handlers={handlersGrupo}
      />

      {total > porPagina && (
        <div className="flex items-center justify-center gap-2 py-4">
          <Button
            variant="outline"
            className="h-11 md:h-8"
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            disabled={pagina === 1 || consulta.isFetching}
          >
            Anterior
          </Button>
          <span className="text-xs font-semibold text-foreground">
            Página {pagina} de {Math.ceil(total / porPagina)}
          </span>
          <Button
            variant="outline"
            className="h-11 md:h-8"
            onClick={() => setPagina((p) => p + 1)}
            disabled={pagina >= Math.ceil(total / porPagina) || consulta.isFetching}
          >
            Próxima
          </Button>
        </div>
      )}
    </section>
  );
}
