import { Link } from "@tanstack/react-router";
import { Building2, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { corDoBanco } from "@/lib/bancos/cores";
import { SimulacaoStatusBadge } from "@/components/simulacao/status-badge";
import { PropostaStatusBadge } from "@/components/propostas/status-badge";
import { fmtValor } from "./utils";

export function NegociosTab({
  negocios,
  onAbrirSimulacao,
}: {
  negocios: any;
  onAbrirSimulacao: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileText className="size-4 text-primary" /> Simulações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {(negocios?.simulacoes.length ?? 0) === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhuma simulação para este cliente.
            </p>
          ) : (
            negocios!.simulacoes.map((s: any) => {
              const primeiro = s.bancos?.[0] ?? null;
              const cor = primeiro ? corDoBanco(primeiro) : "hsl(var(--primary))";
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onAbrirSimulacao(s.id)}
                  className="group relative flex w-full flex-wrap items-center justify-between gap-3 overflow-hidden rounded-xl border border-border bg-card p-3.5 pl-4 text-left text-sm shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  style={{ ["--banco-cor" as string]: cor }}
                >
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-1"
                    style={{ backgroundColor: cor }}
                  />
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="grid size-10 shrink-0 place-items-center rounded-lg"
                      style={{
                        backgroundColor: primeiro ? `${cor}14` : "hsl(var(--primary) / 0.10)",
                      }}
                    >
                      {primeiro ? (
                        <BancoLogo nome={primeiro} size="lg" />
                      ) : (
                        <FileText className="size-5 text-primary" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="font-semibold"
                          style={{ color: primeiro ? cor : undefined }}
                        >
                          {primeiro
                            ? s.bancos.length > 1
                              ? `${primeiro} +${s.bancos.length - 1}`
                              : primeiro
                            : s.produto === "home_equity"
                              ? "Home Equity"
                              : "Financiamento"}
                        </span>
                        <SimulacaoStatusBadge status={s.status ?? "—"} />
                      </div>
                      <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                        {s.numero_simulacao ?? "—"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold tabular-nums text-foreground">
                      {fmtValor(s.valor_financiamento)}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Valor do financiamento
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Building2 className="size-4 text-primary" /> Propostas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {(negocios?.propostas.length ?? 0) === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhuma proposta para este cliente.
            </p>
          ) : (
            negocios!.propostas.map((p: any) => {
              const cor = corDoBanco(p.nome_banco);
              return (
                <Link
                  key={p.id}
                  to="/operacional/propostas/$id"
                  params={{ id: p.id }}
                  className="group relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-xl border border-border bg-card p-3.5 pl-4 text-sm shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  style={{ ["--banco-cor" as string]: cor }}
                >
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-1"
                    style={{ backgroundColor: cor }}
                  />
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="grid size-10 shrink-0 place-items-center rounded-lg"
                      style={{ backgroundColor: `${cor}14` }}
                    >
                      <BancoLogo nome={p.nome_banco} size="lg" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold" style={{ color: cor }}>
                          {p.nome_banco ?? "—"}
                        </span>
                        <PropostaStatusBadge status={p.status ?? "—"} banco={p.nome_banco} />
                      </div>
                      <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                        {p.numero_proposta ?? "—"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold tabular-nums text-foreground">
                      {fmtValor(p.valor_financiamento)}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Valor do financiamento
                    </span>
                  </div>
                </Link>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
