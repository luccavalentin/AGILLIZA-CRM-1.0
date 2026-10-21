import { useServerFn } from "@tanstack/react-start";
import { Rss, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatData } from "@/lib/financeiro/format";
import {
  alternarFonteNews,
  alternarIndicadorNews,
  type FonteNews,
  type IndicadorNews,
} from "@/lib/plataforma/news.functions";
import { ha, useAcaoNews } from "./news-comum";

/** Os feeds que o coletor lê. Desativar uma fonte para a coleta dela. */
export function FontesNews({
  fontes,
  carregando,
  pode,
}: {
  fontes: FonteNews[];
  carregando: boolean;
  pode: boolean;
}) {
  const fn = useServerFn(alternarFonteNews);
  const alternar = useAcaoNews(
    (f: FonteNews) => fn({ data: { id: f.id, ativa: !f.ativa } }),
    "Não foi possível alterar a fonte.",
  );

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          <Rss className="size-4" /> Fontes
        </h2>
        <p className="text-sm text-muted-foreground">Os feeds que o coletor lê.</p>
      </div>
      {carregando ? (
        <Skeleton className="h-32" />
      ) : !fontes.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nenhum feed cadastrado.</p>
      ) : (
        <ul className="divide-y divide-border">
          {fontes.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {f.nome}
                  {!f.ativa && <Badge variant="outline">Inativa</Badge>}
                  {f.erro && <Badge variant="destructive">Com erro</Badge>}
                </div>
                <p className="truncate font-mono text-xs text-muted-foreground">{f.url_rss}</p>
                {f.erro && (
                  <p className="break-words rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
                    {f.erro}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {f.ultima_coleta_em ? `coletada ${ha(f.ultima_coleta_em)}` : "nunca coletada"} ·{" "}
                  {f.noticias} matéria(s)
                </p>
              </div>
              {pode && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={alternar.isPending}
                  onClick={() => alternar.mutate(f)}
                  aria-label={`${f.ativa ? "Desativar" : "Ativar"} a fonte ${f.nome}`}
                >
                  {f.ativa ? "Desativar" : "Ativar"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Indicadores do Banco Central. O valor vem da coleta automática; aqui só se mostra/oculta. */
export function IndicadoresNews({
  indicadores,
  carregando,
  pode,
}: {
  indicadores: IndicadorNews[];
  carregando: boolean;
  pode: boolean;
}) {
  const fn = useServerFn(alternarIndicadorNews);
  const alternar = useAcaoNews(
    (i: IndicadorNews) => fn({ data: { codigo: i.codigo, ativo: !i.ativo } }),
    "Não foi possível alterar o indicador.",
  );

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          <TrendingUp className="size-4" /> Indicadores
        </h2>
        <p className="text-sm text-muted-foreground">
          Os valores vêm da API do Banco Central pela coleta automática — nunca se digitam à mão.
        </p>
      </div>
      {carregando ? (
        <Skeleton className="h-32" />
      ) : (
        <ul className="divide-y divide-border">
          {indicadores.map((i) => (
            <li key={i.codigo} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {i.nome}
                  {i.usado_reajuste && <Badge variant="secondary">Reajuste</Badge>}
                  {Number(i.pontos) === 0 && (
                    <Badge variant="outline" className="border-amber-400 text-amber-700">
                      Sem série
                    </Badge>
                  )}
                  {!i.ativo && <Badge variant="outline">Oculto</Badge>}
                </div>
                <p className="text-xs tabular-nums text-muted-foreground">
                  série SGS {i.serie_sgs} · {i.unidade} · {i.periodicidade} ·{" "}
                  {Number(i.pontos).toLocaleString("pt-BR")} ponto(s)
                  {i.ultima_data ? ` até ${formatData(i.ultima_data)}` : ""}
                </p>
              </div>
              {pode && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={alternar.isPending}
                  onClick={() => alternar.mutate(i)}
                  aria-label={`${i.ativo ? "Ocultar" : "Mostrar"} o indicador ${i.nome}`}
                >
                  {i.ativo ? "Ocultar" : "Mostrar"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
