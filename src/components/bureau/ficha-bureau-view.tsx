import {
  Building2,
  CalendarClock,
  Gauge,
  Mail,
  MapPin,
  Phone,
  Scale,
  TrendingDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToneBadge, type Tone } from "@/components/crm/tone-badge";
import { formatBRL } from "@/lib/simulacao/format";
import { cn } from "@/lib/utils";
import type { FichaBureau, SituacaoCadastral } from "@/lib/bureau/tipos";

const SITUACAO: Record<SituacaoCadastral, { rotulo: string; tom: Tone }> = {
  regular: { rotulo: "Regular", tom: "success" },
  pendente: { rotulo: "Pendente de regularização", tom: "warning" },
  suspensa: { rotulo: "Suspensa", tom: "warning" },
  cancelada: { rotulo: "Cancelada", tom: "danger" },
  desconhecida: { rotulo: "Não informada", tom: "muted" },
};

const FAIXA_SCORE: Record<string, { rotulo: string; tom: Tone }> = {
  muito_baixo: { rotulo: "Muito baixo", tom: "danger" },
  baixo: { rotulo: "Baixo", tom: "danger" },
  medio: { rotulo: "Médio", tom: "warning" },
  alto: { rotulo: "Alto", tom: "success" },
  muito_alto: { rotulo: "Muito alto", tom: "success" },
};

function formatarDocumento(d: string): string {
  const s = d.replace(/\D/g, "");
  if (s.length === 11) {
    return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  return s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

const ICONE_CONTATO = { telefone: Phone, email: Mail, endereco: MapPin } as const;

/**
 * Ficha do cliente no bureau, em bloco único.
 *
 * A ordem segue o que decide a operação: primeiro o veredito (score e
 * restrições em aberto), depois o detalhamento. Um operador que abre esta
 * tela quer saber em dois segundos se pode seguir com a proposta.
 */
export function FichaBureauView({ ficha }: { ficha: FichaBureau }) {
  const situacao = SITUACAO[ficha.situacaoCadastral] ?? SITUACAO.desconhecida;
  const temRestricao = ficha.totalRestricoes > 0;
  const faixa = ficha.score?.faixa ? FAIXA_SCORE[ficha.score.faixa] : null;
  const percentualScore = ficha.score
    ? Math.max(0, Math.min(100, (ficha.score.valor / (ficha.score.maximo || 1000)) * 100))
    : 0;

  return (
    <div className="space-y-4">
      {/* Veredito: identificação, score e restrições em aberto. */}
      <Card
        className={cn(
          "overflow-hidden",
          temRestricao ? "border-destructive/30" : "border-emerald-500/30",
        )}
      >
        <div
          className={cn(
            "border-b px-5 py-4",
            temRestricao
              ? "border-destructive/20 bg-destructive/5"
              : "border-emerald-500/20 bg-emerald-500/5",
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-foreground">
                {ficha.nome ?? "Nome não informado"}
              </p>
              <p className="mt-0.5 font-mono text-sm tabular-nums text-muted-foreground">
                {formatarDocumento(ficha.documento)}
                {ficha.nascimentoOuFundacao && (
                  <span className="ml-2">
                    · {ficha.tipoPessoa === "F" ? "nasc." : "fund."}{" "}
                    {formatarData(ficha.nascimentoOuFundacao)}
                  </span>
                )}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <ToneBadge tone={situacao.tom}>{situacao.rotulo}</ToneBadge>
              <ToneBadge tone={temRestricao ? "danger" : "success"}>
                {temRestricao
                  ? `${ficha.totalRestricoes} restrição${ficha.totalRestricoes > 1 ? "ões" : ""}`
                  : "Sem restrições"}
              </ToneBadge>
            </div>
          </div>
        </div>

        <CardContent className="grid gap-5 p-5 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <Gauge className="h-3.5 w-3.5" /> Score de crédito
            </p>
            {ficha.score ? (
              <>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="font-mono text-3xl font-semibold tabular-nums text-foreground">
                    {ficha.score.valor}
                  </span>
                  <span className="text-sm text-muted-foreground">de {ficha.score.maximo}</span>
                  {faixa && <ToneBadge tone={faixa.tom}>{faixa.rotulo}</ToneBadge>}
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      percentualScore < 40
                        ? "bg-destructive"
                        : percentualScore < 70
                          ? "bg-amber-500"
                          : "bg-emerald-600",
                    )}
                    style={{ width: `${percentualScore}%` }}
                  />
                </div>
                {ficha.score.probabilidadeInadimplencia != null && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Probabilidade de inadimplência em 12 meses:{" "}
                    <span className="font-medium text-foreground">
                      {ficha.score.probabilidadeInadimplencia.toFixed(2)}%
                    </span>
                    {ficha.score.modelo && ` · modelo ${ficha.score.modelo}`}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                O fornecedor não devolveu score para este documento.
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <TrendingDown className="h-3.5 w-3.5" /> Valor em aberto
              </p>
              <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-foreground">
                {formatBRL(ficha.valorTotalRestricoes)}
              </p>
            </div>
            {ficha.rendaPresumida != null && (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Renda presumida
                </p>
                <p className="mt-1 font-mono text-sm tabular-nums text-foreground">
                  {formatBRL(ficha.rendaPresumida)}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {ficha.restricoes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Scale className="h-4 w-4 text-destructive" />
              Restrições e protestos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Origem
                    </th>
                    <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Tipo
                    </th>
                    <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Credor
                    </th>
                    <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Data
                    </th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ficha.restricoes.map((r, i) => (
                    <tr key={`${r.origem}-${i}`}>
                      <td className="px-4 py-2.5 font-medium text-foreground">{r.origem}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {r.tipo}
                        {r.descricao && (
                          <span className="block text-xs text-muted-foreground/80">
                            {r.descricao}
                          </span>
                        )}
                        {r.local && (
                          <span className="block text-xs text-muted-foreground/80">{r.local}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.credor ?? "—"}</td>
                      <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                        {formatarData(r.data)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground">
                        {r.valor != null ? formatBRL(r.valor) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {ficha.participacoes.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Participações em empresas
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {ficha.participacoes.map((p) => (
                <div key={p.cnpj} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{p.razaoSocial}</p>
                    <p className="font-mono text-xs tabular-nums text-muted-foreground">
                      {formatarDocumento(p.cnpj)}
                      {p.situacao && ` · ${p.situacao}`}
                    </p>
                  </div>
                  {p.participacao != null && (
                    <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
                      {p.participacao.toFixed(1)}%
                    </span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {ficha.consultasAnteriores.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                Quem consultou este CPF antes
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {ficha.consultasAnteriores.map((c, i) => (
                <div
                  key={`${c.data}-${i}`}
                  className="flex items-center justify-between gap-3 px-5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">
                      {c.empresa ?? "Não informada"}
                    </p>
                    {c.segmento && <p className="text-xs text-muted-foreground">{c.segmento}</p>}
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatarData(c.data)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {ficha.contatos.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Contatos localizados</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {ficha.contatos.map((c, i) => {
              const Icone = ICONE_CONTATO[c.tipo] ?? Phone;
              return (
                <span
                  key={`${c.tipo}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-foreground"
                >
                  <Icone className="h-3.5 w-3.5 text-muted-foreground" />
                  {c.valor}
                </span>
              );
            })}
          </CardContent>
        </Card>
      )}

      <p className="text-[11px] text-muted-foreground">
        Consultado em{" "}
        {new Date(ficha.consultadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} ·
        fonte: {ficha.provedor}
      </p>
    </div>
  );
}
