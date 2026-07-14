import { Check } from "lucide-react";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { corDoBanco } from "@/lib/bancos/cores";
import { Erro } from "@/components/simulacao/completa/campo";
import { cn } from "@/lib/utils";
import type { SimulacaoCompletaCtx } from "@/lib/simulacao/use-simulacao-completa";

export function SecaoBancos({ ctx }: { ctx: SimulacaoCompletaCtx }) {
  const { f, erros, bancos, aceitaPrice, toggleBanco } = ctx;

  return (
    <section className="space-y-4">
      {bancos && bancos.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {f.bancos_ids.length} de {bancos.length} banco(s) selecionado(s)
        </p>
      )}

      {f.sistema_amortizacao === "P" && (
        <div className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">
          O sistema PRICE é oferecido por Bradesco e Santander. Apenas esses bancos podem ser
          selecionados enquanto esse sistema estiver escolhido.
        </div>
      )}

      {!bancos || bancos.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
          Nenhum banco habilitado — abra Configurações → Bancos para ativar.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {bancos.map((b) => {
            const bloqueado = f.sistema_amortizacao === "P" && !aceitaPrice(b);
            const selecionado = f.bancos_ids.includes(b.id);
            const cor = corDoBanco(b.nome_banco);
            return (
              <button
                key={b.id}
                type="button"
                disabled={bloqueado}
                aria-pressed={selecionado}
                onClick={() => toggleBanco(b.id)}
                style={selecionado ? { borderColor: cor } : undefined}
                className={cn(
                  "group relative flex items-center gap-3 overflow-hidden rounded-xl border bg-card p-3 text-left transition-all duration-200",
                  "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selecionado ? "border-2 shadow-sm" : "border-border",
                  bloqueado && "pointer-events-none opacity-45",
                )}
              >
                {/* Faixa lateral na cor institucional do banco quando selecionado */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-y-0 left-0 w-1 transition-opacity",
                    selecionado ? "opacity-100" : "opacity-0",
                  )}
                  style={{ backgroundColor: cor }}
                />

                <BancoLogo nome={b.nome_banco} size="xl" className="shrink-0" />

                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-semibold leading-tight text-foreground">
                    {b.nome_banco}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {selecionado ? "Selecionado" : "Toque para incluir"}
                  </span>
                </span>

                {/* Marcador de seleção */}
                <span
                  aria-hidden
                  className={cn(
                    "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-all",
                    selecionado
                      ? "border-transparent text-white"
                      : "border-border text-transparent group-hover:border-muted-foreground/50",
                  )}
                  style={selecionado ? { backgroundColor: cor } : undefined}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              </button>
            );
          })}
        </div>
      )}
      <Erro erros={erros} campo="bancos_ids" />
    </section>
  );
}
