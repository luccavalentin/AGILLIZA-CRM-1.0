import { Checkbox } from "@/components/ui/checkbox";
import { Erro } from "@/components/simulacao/completa/campo";
import type { SimulacaoCompletaCtx } from "@/lib/simulacao/use-simulacao-completa";

export function SecaoBancos({ ctx }: { ctx: SimulacaoCompletaCtx }) {
  const { f, erros, bancos, ehBradesco, toggleBanco } = ctx;

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold text-foreground">Bancos</h2>
      {f.sistema_amortizacao === "P" && (
        <div className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">
          O sistema PRICE é oferecido somente pelo Bradesco. Apenas o Bradesco pode ser
          selecionado enquanto esse sistema estiver escolhido.
        </div>
      )}
      {!bancos || bancos.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
          Nenhum banco habilitado — abra Configurações → Bancos para ativar.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {bancos.map((b) => {
            const bloqueado = f.sistema_amortizacao === "P" && !ehBradesco(b);
            return (
              <label
                key={b.id}
                className={`flex items-center gap-2 rounded-md border border-border bg-card p-3 text-sm ${
                  bloqueado ? "opacity-50" : ""
                }`}
              >
                <Checkbox
                  checked={f.bancos_ids.includes(b.id)}
                  disabled={bloqueado}
                  onCheckedChange={() => toggleBanco(b.id)}
                />
                {b.nome_banco}
              </label>
            );
          })}
        </div>
      )}
      <Erro erros={erros} campo="bancos_ids" />
    </section>
  );
}
