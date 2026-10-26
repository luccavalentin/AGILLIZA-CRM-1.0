import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calculator, Trophy } from "lucide-react";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL } from "@/lib/financeiro/format";
import { clienteSimulacoes, type SimulacaoCliente } from "@/lib/portal/cliente-portal.functions";
import { rotuloIdSimulacao } from "@/lib/portal/jornada";
import { CabecalhoPagina } from "@/components/cliente/cabecalho-pagina";
import { Carregando, ErroCarregar, Vazio } from "@/components/cliente/portal/partes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cliente/simulacoes")({
  head: () => ({ meta: [{ title: "Minhas simulações — Meu Financiamento" }] }),
  component: Simulacoes,
});

function pct(v: number | null) {
  return v ? `${Number(v).toFixed(2).replace(".", ",")}% a.a.` : "—";
}

/** Minhas simulações (C15): cada simulação com o ID e a cotação dos bancos, da menor parcela para a maior. */
function Simulacoes() {
  const q = useQuery({ queryKey: ["cliente", "simulacoes"], queryFn: () => clienteSimulacoes() });

  return (
    <div className="space-y-4 sm:space-y-5">
      <CabecalhoPagina
        icon={Calculator}
        titulo="Minhas simulações"
        subtitulo="As cotações dos bancos para o seu financiamento, da menor parcela para a maior."
      />
      {q.isError && !q.data ? (
        <ErroCarregar
          mensagem={mensagemDeErro(q.error, "Não foi possível carregar suas simulações.")}
          aoTentar={() => q.refetch()}
          ocupado={q.isFetching}
        />
      ) : !q.data ? (
        <Carregando linhas={1} />
      ) : q.data.length === 0 ? (
        <Vazio
          icone={Calculator}
          titulo="Nenhuma simulação ainda"
          texto="Assim que a equipe simular o seu financiamento nos bancos, as cotações aparecem aqui."
        />
      ) : (
        <div data-tour="cliente-simulacoes-lista" className="space-y-4">
          {q.data.map((s) => (
            <CartaoSimulacao key={s.id} s={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function CartaoSimulacao({ s }: { s: SimulacaoCliente }) {
  const id = rotuloIdSimulacao(s.id_externo);
  return (
    <article className="rounded-2xl border border-border/70 bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">
            Simulação de {new Date(s.criada_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
          </p>
          <p className="text-xs text-muted-foreground">
            {id ? <span className="font-medium tabular-nums text-foreground">{id}</span> : null}
            {id && s.numero ? " · " : ""}
            {s.numero ? `nº ${s.numero}` : ""}
          </p>
        </div>
      </header>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Dado rotulo="Imóvel" valor={s.valor_imovel ? formatBRL(s.valor_imovel) : "—"} />
        <Dado rotulo="Entrada" valor={s.valor_entrada ? formatBRL(s.valor_entrada) : "—"} />
        <Dado rotulo="Financiado" valor={s.valor_financiamento ? formatBRL(s.valor_financiamento) : "—"} />
        <Dado rotulo="Prazo" valor={s.prazo ? `${s.prazo} meses` : "—"} />
      </dl>
      {s.bancos.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Os bancos ainda não responderam esta simulação.</p>
      ) : (
        <ul data-tour="cliente-simulacoes-bancos" className="mt-4 space-y-2">
          {s.bancos.map((b, i) => (
            <li
              key={`${b.banco}-${i}`}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3",
                i === 0 ? "border-primary/30 bg-primary/[0.04]" : "border-border",
              )}
            >
              <BancoLogo nome={b.banco} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{b.banco ?? "Banco"}</p>
                {i === 0 && s.bancos.length > 1 && (
                  <span className="mb-0.5 inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    <Trophy className="size-3" /> menor parcela
                  </span>
                )}
                <p className="truncate text-xs text-muted-foreground">
                  {pct(b.taxa_ano)}
                  {b.cet_ano ? ` · CET ${pct(b.cet_ano)}` : ""}
                  {b.sistema ? ` · ${b.sistema}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-base font-bold tabular-nums text-foreground">{b.parcela ? formatBRL(b.parcela) : "—"}</p>
                <p className="text-[11px] text-muted-foreground">1ª parcela</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/50 px-2.5 py-2">
      <dt className="truncate text-[11px] text-muted-foreground">{rotulo}</dt>
      <dd className="truncate font-semibold tabular-nums text-foreground">{valor}</dd>
    </div>
  );
}
