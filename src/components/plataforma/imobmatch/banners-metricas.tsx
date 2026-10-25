/**
 * Aba "Métricas" dos banners: impressões (≥ 50% na tela por 1 s), alcance, cliques, CTR,
 * conversões, receita do período e o que está a receber — por espaço e por patrocinador.
 * Tudo de `plataforma.patrocinio_metricas` (0278); robôs já vêm fora.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL, hojeISO } from "@/lib/financeiro/format";
import { lerMetricasBanners } from "@/lib/plataforma/patrocinados.functions";
import { CHAVE_BANNERS } from "./banners-comum";
import { inteiro, Resumo } from "./comum";

const PERIODOS = [7, 30, 90] as const;

function intervalo(dias: number) {
  const [a, m, d] = hojeISO().split("-").map(Number);
  const ate = new Date(Date.UTC(a, m - 1, d));
  const de = new Date(ate.getTime() - (dias - 1) * 86_400_000);
  return { de: de.toISOString().slice(0, 10), ate: ate.toISOString().slice(0, 10) };
}
const taxa = (parte: number, todo: number) =>
  Number(todo) > 0
    ? `${((Number(parte) / Number(todo)) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`
    : "—";

export function AbaMetricasBanners() {
  const lerFn = useServerFn(lerMetricasBanners);
  const [dias, setDias] = useState<(typeof PERIODOS)[number]>(30);
  const { de, ate } = intervalo(dias);
  const q = useQuery({
    queryKey: [...CHAVE_BANNERS, "metricas", de, ate],
    queryFn: () => lerFn({ data: { de, ate } }),
    staleTime: 60_000,
    placeholderData: (a) => a,
  });
  const m = q.data;
  const c = q.isLoading;

  if (q.isError)
    return (
      <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
        {mensagemDeErro(q.error, "Não foi possível ler as métricas dos banners.")}
      </p>
    );

  return (
    <div className="space-y-5">
      <div className="flex gap-1.5" role="group" aria-label="Período">
        {PERIODOS.map((p) => (
          <Button
            key={p}
            type="button"
            size="sm"
            variant={dias === p ? "default" : "outline"}
            aria-pressed={dias === p}
            className="rounded-full"
            onClick={() => setDias(p)}
          >
            {p} dias
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Resumo
          rotulo="Impressões"
          valor={inteiro(m?.totais.impressoes)}
          detalhe={`${inteiro(m?.totais.alcance)} pessoa(s) alcançada(s)`}
          carregando={c}
        />
        <Resumo
          rotulo="Cliques"
          valor={inteiro(m?.totais.cliques)}
          detalhe={`CTR ${m?.totais.ctr != null ? `${Number(m.totais.ctr).toLocaleString("pt-BR")}%` : "—"}`}
          carregando={c}
        />
        <Resumo
          rotulo="Receita no período"
          valor={formatBRL(Number(m?.receita.valor ?? 0))}
          detalhe={`${inteiro(m?.receita.compras)} compra(s) paga(s) · ${formatBRL(Number(m?.a_receber ?? 0))} a receber`}
          carregando={c}
        />
        <Resumo
          rotulo="Conversões"
          valor={inteiro(m?.totais.conversoes)}
          detalhe={`${inteiro(m?.fila)} criativo(s) na fila · ${inteiro(m?.patrocinadores)} patrocinador(es) ativo(s)`}
          alerta={(m?.fila ?? 0) > 0}
          carregando={c}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="min-w-0 rounded-xl border border-border bg-card">
          <h3 className="border-b border-border p-3 text-sm font-semibold sm:p-4">Por espaço</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium sm:px-4">Espaço</th>
                  <th className="px-3 py-2 text-right font-medium">No ar</th>
                  <th className="px-3 py-2 text-right font-medium">Impressões</th>
                  <th className="px-3 py-2 text-right font-medium">CTR</th>
                  <th className="px-3 py-2 text-right font-medium sm:px-4">Receita</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(m?.por_espaco ?? []).map((e) => (
                  <tr key={e.espaco}>
                    <td className="px-3 py-2 sm:px-4">{e.nome}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{inteiro(e.no_ar)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{inteiro(e.impressoes)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {taxa(e.cliques, e.impressoes)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums sm:px-4">
                      {formatBRL(Number(e.receita))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="min-w-0 rounded-xl border border-border bg-card">
          <h3 className="border-b border-border p-3 text-sm font-semibold sm:p-4">
            Patrocinadores com mais impressões
          </h3>
          {(m?.por_patrocinador ?? []).filter((p) => p.impressoes > 0).length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma impressão no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-medium sm:px-4">Patrocinador</th>
                    <th className="px-3 py-2 text-right font-medium">Impressões</th>
                    <th className="px-3 py-2 text-right font-medium">Cliques</th>
                    <th className="px-3 py-2 text-right font-medium sm:px-4">Conversões</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {m!.por_patrocinador
                    .filter((p) => p.impressoes > 0)
                    .map((p) => (
                      <tr key={p.conta}>
                        <td className="px-3 py-2 sm:px-4">{p.nome}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {inteiro(p.impressoes)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {inteiro(p.cliques)}{" "}
                          <span className="text-muted-foreground">
                            ({taxa(p.cliques, p.impressoes)})
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums sm:px-4">
                          {inteiro(p.conversoes)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      {m && (
        <p className="text-[11px] text-muted-foreground">
          De {m.de.split("-").reverse().join("/")} a {m.ate.split("-").reverse().join("/")} ·{" "}
          {inteiro(m.totais.robos)} acesso(s) de robô descartado(s).
        </p>
      )}
    </div>
  );
}
