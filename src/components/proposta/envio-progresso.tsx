import { CheckCircle2, Loader2, Send } from "lucide-react";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { corDoBanco } from "@/lib/bancos/cores";
import type { StatusEnvioBanco } from "@/hooks/use-enviar-proposta";

/** Nome legível de cada etapa, na ordem em que o hook as percorre. */
const ETAPAS = [
  "Criando proposta",
  "Sincronizando participantes",
  "Validando dados",
  "Preparando simulação",
  "Enviando ao banco",
  "Aguardando retorno",
] as const;

const TOTAL_ETAPAS = ETAPAS.length;

/**
 * Painel de acompanhamento do envio da proposta ao banco.
 *
 * O envio levava até dois minutos mostrando apenas um toast de texto, e o
 * operador — muitas vezes com o cliente ao telefone — não tinha como saber se
 * algo estava acontecendo. Aqui ele vê a etapa, o quanto já andou e há quanto
 * tempo espera, no mesmo espírito do progresso da simulação.
 *
 * Fica ancorado no canto e não bloqueia a tela: o envio continua mesmo se a
 * pessoa navegar para outro lugar.
 */
export function EnvioProgresso({
  status,
  nomeBanco,
}: {
  status: StatusEnvioBanco | null | undefined;
  nomeBanco?: string | null;
}) {
  if (!status || status.status !== "loading") return null;

  const etapaAtual = Math.min(Math.max(status.etapaNumero ?? 1, 1), TOTAL_ETAPAS);
  const pct = Math.round((etapaAtual / TOTAL_ETAPAS) * 100);
  const segundos = status.tempoDecorrido ?? 0;
  const cor = nomeBanco ? corDoBanco(nomeBanco) : "hsl(var(--primary))";

  return (
    <div
      role="status"
      aria-live="polite"
      // Centralizado, mas SEM travar a tela: o wrapper não recebe clique
      // (`pointer-events-none`) e só o card recebe. O envio segue em curso
      // mesmo que a pessoa navegue para outro lugar, então bloquear a
      // interface contradiria o que o próprio painel informa.
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="pointer-events-auto w-[min(26rem,100%)] animate-in fade-in zoom-in-95 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl duration-300">
        {/* Fio de luz correndo no topo: sinaliza atividade mesmo quando a
            etapa demora, sem prometer progresso que não houve. */}
        <div className="relative h-1 overflow-hidden bg-muted">
          <div
            className="animate-envio-luz absolute inset-y-0 w-[35%] rounded-full"
            style={{ background: `linear-gradient(90deg, transparent, ${cor}, transparent)` }}
          />
        </div>

        <div className="flex items-start gap-3 p-4">
          <div className="relative shrink-0">
            {nomeBanco ? (
              <BancoLogo nome={nomeBanco} size="xl" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <Send className="h-5 w-5 text-primary" />
              </div>
            )}
            {/* Halo pulsante na cor do banco. */}
            <span
              className="absolute -inset-1 -z-10 animate-ping rounded-xl opacity-20"
              style={{ backgroundColor: cor }}
              aria-hidden
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-semibold text-foreground">
                Enviando ao {nomeBanco ?? "banco"}
              </p>
              <span className="shrink-0 text-[11px] font-bold tabular-nums text-muted-foreground">
                {segundos}s
              </span>
            </div>

            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
              <span className="truncate">
                {status.mensagem ?? ETAPAS[etapaAtual - 1]}
              </span>
            </p>

            <div className="mt-2.5">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Etapa {etapaAtual} de {TOTAL_ETAPAS}
                </span>
                <span className="text-[10px] font-bold tabular-nums text-muted-foreground">
                  {pct}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${pct}%`, backgroundColor: cor }}
                />
              </div>
            </div>

            {/* Passados 20 s dizemos o que é verdade (a mediana é de ~23 s) e
                lembramos que dá para sair da tela sem perder o envio. */}
            {segundos > 20 && (
              <p className="mt-2 flex items-start gap-1 text-[11px] font-medium text-warning">
                <CheckCircle2 className="mt-px h-3 w-3 shrink-0" />
                <span>
                  A maioria responde em cerca de 20 segundos. O envio continua mesmo se você
                  sair desta tela.
                </span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
