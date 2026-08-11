import { Home, Landmark, UserRound } from "lucide-react";
import { formatBRL } from "@/lib/simulacao/format";
import { Campo, GrupoDados, estadoCivilLabel } from "@/components/simulacao/detalhe-page/ui";

export function DadosEnviados({ s }: { s: any }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      <GrupoDados titulo="Imóvel e financiamento" icone={<Home className="h-4 w-4" />}>
        <Campo termo="Valor do imóvel" desc={formatBRL(s.valor_imovel)} />
        <Campo termo="Entrada" desc={formatBRL(s.valor_entrada)} />
        <Campo termo="Valor financiado" desc={formatBRL(s.valor_financiamento)} />
        <Campo termo="Financiar despesas" desc={s.fg_financiar_despesas ? "Sim" : "Não"} />
        {s.fg_financiar_despesas && (
          <>
            <Campo termo="Despesas financiadas" desc={formatBRL(s.valor_despesas_financiadas)} />
            <Campo
              termo="Total financiado"
              destaque
              desc={formatBRL(
                (Number(s.valor_financiamento) || 0) + (Number(s.valor_despesas_financiadas) || 0),
              )}
            />
          </>
        )}
      </GrupoDados>

      <GrupoDados titulo="Condições" icone={<Landmark className="h-4 w-4" />}>
        <Campo termo="Prazo" desc={s.prazo ? `${s.prazo} meses` : "—"} />
        <Campo termo="Sistema" desc={s.sistema_amortizacao === "P" ? "PRICE" : "SAC"} />
        <Campo termo="Utiliza FGTS" desc={s.utiliza_fgts === "S" ? "Sim" : "Não"} />
      </GrupoDados>

      <GrupoDados titulo="Perfil do cliente" icone={<UserRound className="h-4 w-4" />} ultimo>
        <Campo termo="Estado civil" desc={estadoCivilLabel(s.estado_civil)} />
        <Campo termo="UF" desc={s.uf ?? "—"} />
      </GrupoDados>
    </section>
  );
}
