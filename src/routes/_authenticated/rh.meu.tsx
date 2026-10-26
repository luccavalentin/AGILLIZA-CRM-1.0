import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Download, Eye, FileText, Palmtree, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstadoLista } from "@/components/rh/estado-lista";
import { obterMeuRh } from "@/lib/rh/meu-rh.functions";
import { abrirArquivoRh, baixarArquivoRh } from "@/lib/rh/arquivos";
import { CONTRATO_LABEL, STATUS_FUNCIONARIO_LABEL } from "@/lib/rh/rotulos";
import { formatBRL, formatData } from "@/lib/financeiro/format";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const FERIAS_LABEL: Record<string, string> = {
  planejada: "Planejada",
  aprovada: "Aprovada",
  em_curso: "Em curso",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

// Área do colaborador: qualquer usuário logado. Só enxerga a própria ficha (rh_meu_resumo).
export const Route = createFileRoute("/_authenticated/rh/meu")({
  head: () => ({ meta: [{ title: "Meu RH — Agilliza" }] }),
  component: Pagina,
});

function Pagina() {
  const fn = useServerFn(obterMeuRh);
  const q = useQuery({ queryKey: ["rh-meu"], queryFn: () => fn() });
  const d = q.data;

  if (q.isLoading || q.isError) {
    return (
      <div className="mx-auto w-full max-w-[1100px] p-3 sm:p-4 md:p-6">
        <EstadoLista q={q} vazio="" erro="Não foi possível carregar o seu RH." />
      </div>
    );
  }

  if (!d?.funcionario) {
    return (
      <div className="mx-auto w-full max-w-[1100px] p-3 sm:p-4 md:p-6">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
              <UserRound className="h-7 w-7" />
            </span>
            <p className="text-base font-semibold text-foreground">Seu usuário ainda não tem ficha de RH</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Quando o RH ligar a sua ficha de colaborador ao seu acesso, seus holerites, férias e dados
              aparecem aqui.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const f = d.funcionario;
  const saldo = d.saldo;
  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-4 p-3 sm:p-4 md:p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary">
          {f.nome.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-foreground md:text-[22px]">Meu RH</h1>
          <p className="truncate text-sm text-muted-foreground">
            {f.nome} · {f.cargo ?? "Sem cargo"}
            {f.departamento ? ` · ${f.departamento}` : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Situação" valor={STATUS_FUNCIONARIO_LABEL[f.status as keyof typeof STATUS_FUNCIONARIO_LABEL] ?? f.status} />
        <Indicador rotulo="Admissão" valor={formatData(f.data_admissao)} />
        <Indicador rotulo="Férias disponíveis" valor={saldo ? `${saldo.saldo_total} dia(s)` : "—"} destaque={!!saldo && saldo.saldo_total > 0} />
        <Indicador rotulo="Holerites" valor={String(d.holerites.length)} />
      </div>

      {saldo && saldo.alerta !== "ok" && (
        <div
          className={`rounded-xl border px-3 py-2 text-sm ${
            saldo.alerta === "vencida" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300"
          }`}
        >
          {saldo.alerta === "vencida"
            ? "Você tem férias com prazo de concessão vencido. Combine as datas com o RH."
            : `Suas férias vencem em ${saldo.proximo_vencimento ? formatData(saldo.proximo_vencimento) : "breve"}. Combine as datas com o RH.`}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" /> Meus holerites
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {d.holerites.length === 0 ? (
              <p className="px-4 pb-6 text-sm text-muted-foreground">
                Os holerites aparecem aqui quando a folha do mês é fechada e publicada.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {d.holerites.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {MESES[h.mes - 1]} de {h.ano}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {h.valor_liquido != null ? `Líquido ${formatBRL(h.valor_liquido)}` : "Recibo de pagamento"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="icon" variant="ghost" aria-label="Ver holerite" onClick={() => abrirArquivoRh(h.arquivo_path)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label="Baixar holerite" onClick={() => baixarArquivoRh(h.arquivo_path, h.arquivo_nome)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Palmtree className="h-4 w-4 text-primary" /> Minhas férias
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {saldo?.periodos.length ? (
                <ul className="space-y-2 text-sm">
                  {saldo.periodos.slice(-3).reverse().map((p) => (
                    <li key={p.indice} className="rounded-lg border border-border/60 px-3 py-2">
                      <p className="font-medium text-foreground">
                        Período {formatData(p.inicio)} a {formatData(p.fim)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.completo ? `${p.dias_direito} dias de direito` : `${p.meses_computados}/12 avos`} · {p.dias_gozados} gozados · saldo {p.saldo_dias}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Seu primeiro período de férias ainda está em formação.</p>
              )}
              {d.ferias.filter((x) => x.data_inicio).length > 0 && (
                <div className="pt-1">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Programadas</p>
                  <ul className="space-y-1 text-sm">
                    {d.ferias
                      .filter((x) => x.data_inicio)
                      .map((x) => (
                        <li key={x.id} className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatData(x.data_inicio!)} a {x.data_fim ? formatData(x.data_fim) : "—"}
                          </span>
                          <Badge variant="outline">{FERIAS_LABEL[x.status] ?? x.status}</Badge>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Meus dados</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <Linha rotulo="Matrícula" valor={f.numero} />
              <Linha rotulo="Contrato" valor={CONTRATO_LABEL[f.tipo_contrato as keyof typeof CONTRATO_LABEL] ?? f.tipo_contrato} />
              <Linha rotulo="Jornada" valor={f.jornada_descricao ?? "—"} />
              <Linha rotulo="E-mail corporativo" valor={f.email_corporativo ?? "—"} />
              <p className="pt-1 text-xs text-muted-foreground">Algo errado? Peça a correção ao RH.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Indicador({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${destaque ? "border-primary/30 bg-primary/5" : "border-border/60 bg-card"}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className={`mt-0.5 truncate text-base font-semibold ${destaque ? "text-primary" : "text-foreground"}`}>{valor}</p>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="min-w-0 truncate text-right font-medium text-foreground">{valor}</span>
    </div>
  );
}
