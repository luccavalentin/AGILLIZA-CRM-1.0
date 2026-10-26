import { Building2, HandCoins, UserRound } from "lucide-react";
import { formatBRL } from "@/lib/simulacao/format";
import type { MatriculaAReceber } from "@/lib/matriculas/matriculas.functions";

function data(iso: string | null) {
  if (!iso) return "—";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Extrato por solicitante: quanto cada um deve à Agilliza pelas matrículas puxadas. */
export function AReceber({ lista }: { lista: MatriculaAReceber[] }) {
  const comSaldo = lista.filter((l) => l.valor_em_aberto > 0);
  const quitados = lista.filter((l) => l.valor_em_aberto <= 0);
  return (
    <section className="rounded-2xl border bg-card">
      <div className="border-b p-4">
        <h2 className="text-sm font-semibold text-foreground">A receber por solicitante</h2>
        <p className="text-xs text-muted-foreground">
          Matrículas concluídas e ainda não pagas por quem pediu. Marque o pagamento na lista de pedidos.
        </p>
      </div>
      {lista.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <HandCoins className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium text-foreground">Nada a receber ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">Cada matrícula concluída entra aqui no nome de quem pediu.</p>
        </div>
      ) : (
        <ul className="divide-y">
          {[...comSaldo, ...quitados].map((l) => (
            <li key={l.solicitante_chave} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate font-medium text-foreground">
                  {l.solicitante_tipo === "assinante" ? (
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                  ) : (
                    <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate">{l.solicitante_nome}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {l.matriculas} matrícula(s) · pago {formatBRL(l.valor_pago)}
                  {l.em_aberto_desde && l.valor_em_aberto > 0 && ` · em aberto desde ${data(l.em_aberto_desde)}`}
                  {l.ultimo_pagamento && ` · último pagamento ${data(l.ultimo_pagamento)}`}
                </p>
              </div>
              <div className="text-right">
                <p
                  className={
                    l.valor_em_aberto > 0
                      ? "font-semibold tabular-nums text-destructive"
                      : "font-semibold tabular-nums text-emerald-700 dark:text-emerald-400"
                  }
                >
                  {l.valor_em_aberto > 0 ? formatBRL(l.valor_em_aberto) : "Quitado"}
                </p>
                {l.matriculas_em_aberto > 0 && (
                  <p className="text-[11px] text-muted-foreground">{l.matriculas_em_aberto} em aberto</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
