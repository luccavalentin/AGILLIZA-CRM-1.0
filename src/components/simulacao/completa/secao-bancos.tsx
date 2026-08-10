import { Check, Landmark } from "lucide-react";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { corDoBanco } from "@/lib/bancos/cores";
import { Erro } from "@/components/simulacao/completa/campo";
import { cn } from "@/lib/utils";
import type { SimulacaoCompletaCtx } from "@/lib/simulacao/use-simulacao-completa";

type Banco = NonNullable<SimulacaoCompletaCtx["bancos"]>[number];

export function SecaoBancos({ ctx }: { ctx: SimulacaoCompletaCtx }) {
  const { f, erros, bancos, aceitaPrice, aceitaBancoNaOperacao, restricaoEspecial, toggleBanco } =
    ctx;

  const modoAmbos = f.sistema_amortizacao === "B";

  function renderCards(lista: Banco[], selecionados: string[], filtroSistema: "S" | "P" | null) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {lista.map((b) => {
          const bloqueadoPrice = filtroSistema === "P" && !aceitaPrice(b);
          const bloqueadoOperacao = !aceitaBancoNaOperacao(b);
          const bloqueado = bloqueadoPrice || bloqueadoOperacao;
          const selecionado = selecionados.includes(b.id);
          const cor = corDoBanco(b.nome_banco);
          return (
            <button
              key={b.id}
              type="button"
              disabled={bloqueado}
              aria-pressed={selecionado}
              onClick={() =>
                modoAmbos && filtroSistema ? toggleBanco(b.id, filtroSistema) : toggleBanco(b.id)
              }
              style={selecionado ? { borderColor: cor } : undefined}
              className={cn(
                "group relative flex items-center gap-3 overflow-hidden rounded-xl border bg-card p-3 text-left transition-all duration-200",
                "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selecionado ? "border-2 shadow-sm" : "border-border",
                bloqueado && "pointer-events-none opacity-45",
              )}
            >
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
    );
  }

  if (!bancos || bancos.length === 0) {
    return (
      <section className="space-y-4">
        <div className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
          Nenhum banco habilitado — abra Configurações → Bancos para ativar.
        </div>
      </section>
    );
  }

  if (modoAmbos) {
    const bancosPrice = bancos.filter(aceitaPrice);
    return (
      <section className="space-y-6">
        {restricaoEspecial.ativo && (
          <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm font-medium text-primary shadow-sm ring-1 ring-primary/5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Landmark className="h-4 w-4" />
            </div>
            <span>
              {restricaoEspecial.motivo}: LTV máx. 70%, prazo máx. 240 meses
              {restricaoEspecial.apenasBradesco ? " — apenas Bradesco opera." : "."}
            </span>
          </div>
        )}

        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-foreground/80">
          Modo <span className="font-semibold">Ambos</span>: escolha os bancos para o sistema
          <span className="font-semibold"> SAC</span> e para o sistema
          <span className="font-semibold"> PRICE</span> de forma independente. Uma simulação será
          criada para cada grupo.
        </div>

        <div className="space-y-3">
          <header className="flex items-baseline justify-between gap-2 border-b border-border pb-2">
            <h3 className="text-sm font-semibold text-foreground">Bancos — SAC</h3>
            <span className="text-xs text-muted-foreground">
              {f.bancos_sac_ids.length} de {bancos.length} selecionado(s)
            </span>
          </header>
          {renderCards(bancos, f.bancos_sac_ids, "S")}
        </div>

        <div className="space-y-3">
          <header className="flex items-baseline justify-between gap-2 border-b border-border pb-2">
            <h3 className="text-sm font-semibold text-foreground">Bancos — PRICE</h3>
            <span className="text-xs text-muted-foreground">
              {f.bancos_price_ids.length} de {bancosPrice.length} selecionado(s) · apenas Bradesco e
              Santander operam PRICE
            </span>
          </header>
          {renderCards(bancosPrice, f.bancos_price_ids, "P")}
        </div>

        <Erro erros={erros} campo="bancos_ids" />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {f.bancos_ids.length} de {bancos.length} banco(s) selecionado(s)
      </p>

      {restricaoEspecial.ativo && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm font-medium text-primary shadow-sm ring-1 ring-primary/5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Landmark className="h-4 w-4" />
          </div>
          <span>
            {restricaoEspecial.motivo}: LTV máx. 70%, prazo máx. 240 meses
            {restricaoEspecial.apenasBradesco ? " — apenas Bradesco opera." : "."}
          </span>
        </div>
      )}

      {f.sistema_amortizacao === "P" && (
        <div className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">
          O sistema PRICE é oferecido por Bradesco e Santander. Apenas esses bancos podem ser
          selecionados enquanto esse sistema estiver escolhido.
        </div>
      )}

      {renderCards(bancos, f.bancos_ids, f.sistema_amortizacao === "P" ? "P" : null)}
      <Erro erros={erros} campo="bancos_ids" />
    </section>
  );
}
