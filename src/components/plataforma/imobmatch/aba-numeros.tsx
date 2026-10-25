/**
 * Aba "Números do ImobMatch": o retrato do portal — anúncios no ar, novos por dia, AMEI,
 * pedidos de contato, conversas e compradores — com a série diária de um número por vez
 * (horário de Brasília). Tudo de `plataforma.imobmatch_numeros` (0283).
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { lerNumerosImobMatch, type NumerosImobMatch } from "@/lib/plataforma/imobmatch.functions";
import { cn } from "@/lib/utils";
import { CHAVE_IMOBMATCH } from "./aba-revisao";
import { inteiro, Resumo } from "./comum";

type Serie = keyof Omit<NumerosImobMatch["serie"][number], "dia">;
const SERIES: { id: Serie; rotulo: string; detalhe: string }[] = [
  { id: "novos_anuncios", rotulo: "Novos anúncios", detalhe: "foram ao ar no dia" },
  { id: "amei", rotulo: "AMEI", detalhe: "corações dados no dia" },
  { id: "pedidos", rotulo: "Pedidos de contato", detalhe: "conversa ou visita" },
  { id: "conversas", rotulo: "Conversas", detalhe: "abertas no chat" },
  { id: "compradores", rotulo: "Compradores novos", detalhe: "cadastros no portal" },
];
const PERIODOS = [7, 30, 90] as const;

const EIXO = "var(--muted-foreground)";
const GRADE = "color-mix(in oklab, var(--border) 70%, transparent)";
const DICA = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  padding: "8px 12px",
};
const diaCurto = (d: string) => d.slice(0, 10).split("-").reverse().slice(0, 2).join("/");

export function AbaNumeros() {
  const lerFn = useServerFn(lerNumerosImobMatch);
  const [dias, setDias] = useState<(typeof PERIODOS)[number]>(30);
  const [serie, setSerie] = useState<Serie>("novos_anuncios");
  const q = useQuery({
    queryKey: [...CHAVE_IMOBMATCH, "numeros", dias],
    queryFn: () => lerFn({ data: { dias } }),
    staleTime: 60_000,
    placeholderData: (a) => a,
  });
  const n = q.data;
  const carregando = q.isLoading;
  const atual = SERIES.find((s) => s.id === serie)!;

  if (q.isError)
    return (
      <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
        {mensagemDeErro(q.error, "Não foi possível ler os números do ImobMatch.")}
      </p>
    );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Resumo
          rotulo="Anúncios no ar"
          valor={inteiro(n?.totais.no_ar)}
          detalhe={`${inteiro(n?.totais.anunciantes_com_anuncio)} anunciante(s) com anúncio`}
          carregando={carregando}
        />
        <Resumo
          rotulo="Compradores"
          valor={inteiro(n?.totais.compradores)}
          detalhe="com e-mail confirmado"
          carregando={carregando}
        />
        <Resumo
          rotulo="AMEI"
          valor={inteiro(n?.totais.amei)}
          detalhe={`${inteiro(n?.periodo.amei)} nos últimos ${dias} dias`}
          carregando={carregando}
        />
        <Resumo
          rotulo="Pedidos de contato"
          valor={inteiro(n?.totais.pedidos)}
          detalhe={`${inteiro(n?.totais.conversas)} conversa(s) no chat`}
          carregando={carregando}
        />
      </div>

      <section className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{atual.rotulo} por dia</h3>
            <p className="text-xs text-muted-foreground">
              {inteiro(n?.periodo[serie])} nos últimos {dias} dias · {atual.detalhe}
            </p>
          </div>
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
        </div>
        <div
          className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1"
          role="group"
          aria-label="Número do gráfico"
        >
          {SERIES.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={serie === s.id}
              onClick={() => setSerie(s.id)}
              className={cn(
                "min-h-9 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
                serie === s.id
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s.rotulo}
            </button>
          ))}
        </div>
        <div className="mt-3 h-64 w-full">
          {carregando ? (
            <Skeleton className="size-full rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={n?.serie ?? []} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRADE} />
                <XAxis
                  dataKey="dia"
                  tickFormatter={diaCurto}
                  tick={{ fill: EIXO, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={16}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: EIXO, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip
                  contentStyle={DICA}
                  cursor={{ fill: "color-mix(in oklab, var(--muted) 60%, transparent)" }}
                  labelFormatter={(d) => diaCurto(String(d))}
                  formatter={(v) => [inteiro(Number(v)), atual.rotulo]}
                />
                <Bar
                  dataKey={serie}
                  fill="var(--chart-1)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-4">
          <h3 className="text-sm font-semibold">Onde estão os anúncios</h3>
          <p className="text-xs text-muted-foreground">As 10 cidades com mais anúncios no ar.</p>
          {carregando ? (
            <Skeleton className="mt-3 h-40" />
          ) : (n?.cidades.length ?? 0) === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nenhum anúncio no ar ainda.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {n!.cidades.map((c) => {
                const max = n!.cidades[0]?.anuncios || 1;
                return (
                  <li key={`${c.cidade}-${c.uf}`} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <MapPin className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate">
                          {c.cidade}
                          {c.uf ? `/${c.uf}` : ""}
                        </span>
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {inteiro(c.anuncios)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(4, (c.anuncios / max) * 100)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
        <section className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-4">
          <h3 className="text-sm font-semibold">Saúde da vitrine</h3>
          <p className="text-xs text-muted-foreground">O que a equipe tem a decidir agora.</p>
          <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
            {(
              [
                ["Em revisão", n?.totais.em_revisao],
                ["Moderados", n?.totais.moderados],
                ["Denúncias abertas", n?.totais.denuncias_abertas],
              ] as const
            ).map(([r, v]) => (
              <div key={r} className="min-w-0 rounded-lg bg-muted/40 p-3">
                <dt className="truncate text-[11px] text-muted-foreground">{r}</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {carregando ? "—" : inteiro(v)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Atualizado em{" "}
            {n
              ? new Date(n.gerado_em).toLocaleString("pt-BR", {
                  timeStyle: "short",
                  dateStyle: "short",
                })
              : "—"}
            .
          </p>
        </section>
      </div>
    </div>
  );
}
