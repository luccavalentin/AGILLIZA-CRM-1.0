import { Check, Loader2, ScanSearch, ShieldCheck } from "lucide-react";
import simbolo from "@/assets/brand/agilliza-symbol-oficial-light.png";
import "./ficha-bureau.css";
import type { Disponibilidade } from "./logica";

/**
 * Cartão da marca no lugar do "saldo de créditos" dos assinantes: no Agilliza a consulta sai
 * do contrato de bureau do correspondente, então o cartão mostra o fornecedor e o estado.
 */
export function CartaoBureau({
  disp,
  carregando,
  consultasMes,
}: {
  disp: Disponibilidade;
  carregando: boolean;
  consultasMes: number | null;
}) {
  return (
    <div className="fb-marca grid min-h-[150px] gap-3 rounded-2xl p-5 shadow-md">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.1em] opacity-80">
          Bureau de crédito
        </span>
        <img src={simbolo} alt="" className="h-7 w-auto opacity-90" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-2xl font-semibold tracking-tight">
          {carregando ? "…" : (disp.fornecedor ?? "Não contratado")}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-sm opacity-85">
          <span
            className={
              disp.disponivel
                ? "size-2 rounded-full bg-success"
                : "size-2 rounded-full bg-warning"
            }
            aria-hidden
          />
          {carregando ? "Conferindo…" : disp.disponivel ? "Pronto para consultar" : "Indisponível"}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-primary-foreground/15 pt-3 text-xs opacity-85">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="size-3.5" aria-hidden /> Registro LGPD em toda consulta
        </span>
        {consultasMes != null && (
          <span className="tabular-nums">
            {consultasMes.toLocaleString("pt-BR")} no mês
          </span>
        )}
      </div>
    </div>
  );
}

/** Andamento enquanto o fornecedor responde (como "Consultando…" dos assinantes). */
export function Andamento() {
  const passos = ["Consulta registrada no histórico", "Consultando o bureau", "Montando a ficha"];
  const atual = 1;
  return (
    <section
      className="space-y-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5"
      aria-label="Consulta em andamento"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <span className="fb-radar grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <ScanSearch className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <b className="block text-sm font-semibold text-foreground">Consultando…</b>
          <small className="block text-xs text-muted-foreground">
            Costuma levar alguns segundos.
          </small>
        </div>
      </div>
      <ol className="space-y-2">
        {passos.map((p, i) => (
          <li key={p} className="flex items-center gap-2.5 text-sm">
            <span
              className={
                i < atual
                  ? "grid size-6 place-items-center rounded-full bg-success/15 text-success-texto"
                  : i === atual
                    ? "grid size-6 place-items-center rounded-full bg-primary/10 text-primary"
                    : "grid size-6 place-items-center rounded-full bg-muted text-muted-foreground"
              }
              aria-hidden
            >
              {i < atual ? (
                <Check className="size-3.5" />
              ) : i === atual ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
            </span>
            <span className={i > atual ? "text-muted-foreground" : "text-foreground"}>{p}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
