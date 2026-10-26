/** Demonstrativo individual de comissões (a própria pessoa ou quem administra). */
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Clock, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExportarFinanceiro } from "@/components/financeiro/exportar-financeiro";
import { consultar } from "@/lib/financeiro/cliente";
import type { Demonstrativo, Papel } from "@/lib/financeiro/tipos";
import { Carregando, Chip, Erro, Metrica, Metricas, SITUACAO_PARTICIPANTE, Vazio, dataBR, moeda, pct } from "./base";

export const PAPEIS: Record<Papel, string> = { originou: "Originou", atendeu: "Atendeu", participou: "Participou" };

export function DemonstrativoDialogo({ pessoa, onFechar }: { pessoa: { id: string; nome: string } | null; onFechar: () => void }) {
  const q = useQuery({
    queryKey: ["financeiro", "demonstrativo", pessoa?.id],
    enabled: !!pessoa,
    queryFn: () => consultar<Demonstrativo>("demonstrativo", { _pessoa: pessoa!.id }),
  });
  const d = q.data;
  return (
    <Dialog open={!!pessoa} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Demonstrativo · {pessoa?.nome}</DialogTitle>
          <DialogDescription>Cada comissão com a base, o percentual gravado e os pagamentos.</DialogDescription>
        </DialogHeader>
        {q.isLoading ? (
          <Carregando linhas={3} />
        ) : q.error ? (
          <Erro erro={q.error} />
        ) : d ? (
          <DemonstrativoConteudo d={d} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function DemonstrativoConteudo({ d }: { d: Demonstrativo }) {
  return (
    <div className="space-y-4">
      <Metricas colunas={3}>
        <Metrica rotulo="Previsto" valor={moeda(d.totais.previsto)} tom="info" icone={Clock} />
        <Metrica rotulo="A pagar" valor={moeda(d.totais.a_pagar)} tom="alerta" icone={Wallet} />
        <Metrica rotulo="Pago" valor={moeda(d.totais.pago)} tom="sucesso" icone={BadgeCheck} />
      </Metricas>
      <div data-tour="financeiro-demonstrativo-exportar" className="flex justify-end">
        <ExportarFinanceiro
          titulo={`Demonstrativo de comissões — ${d.pessoa.nome ?? ""}`}
          descricao="Comissões, bases, percentuais gravados e pagamentos"
          columns={[
            { key: "proposta", label: "Proposta" },
            { key: "banco", label: "Banco" },
            { key: "papel", label: "Papel" },
            { key: "base", label: "Base", format: "brl", align: "right" },
            { key: "percentual", label: "%", format: "pct", align: "right" },
            { key: "valor", label: "Valor", format: "brl", align: "right", footer: "sum" },
            { key: "pago", label: "Pago", format: "brl", align: "right", footer: "sum" },
            { key: "situacao", label: "Situação" },
          ]}
          rows={d.itens.map((i) => ({
            proposta: i.proposta ?? "",
            banco: i.banco ?? "",
            papel: i.papel ? PAPEIS[i.papel] : "",
            base: i.base,
            percentual: i.percentual,
            valor: i.valor,
            pago: i.pago,
            situacao: SITUACAO_PARTICIPANTE[i.situacao]?.rotulo ?? i.situacao,
          }))}
          size="sm"
          variant="outline"
        />
      </div>
      {d.itens.length === 0 ? (
        <Vazio titulo="Sem comissões no período" />
      ) : (
        <ul data-tour="financeiro-demonstrativo-lista" className="space-y-2">
          {d.itens.map((i) => (
            <li key={i.id} className="rounded-xl border border-border/70 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {i.proposta ?? "Avulsa"} · {i.banco ?? ""} {i.papel ? `· ${PAPEIS[i.papel]}` : ""}
                </span>
                <Chip def={SITUACAO_PARTICIPANTE[i.situacao]} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {pct(i.percentual, 4)} de {moeda(i.base)} = <b className="text-foreground">{moeda(i.valor)}</b> · pago {moeda(i.pago)} · vence{" "}
                {dataBR(i.vencimento)}
              </p>
              {i.pagamentos.length > 0 && (
                <p className="mt-1 text-[11px] text-success">
                  {i.pagamentos.map((p) => `${dataBR(p.data)}: ${moeda(p.valor)}${p.forma ? ` (${p.forma})` : ""}`).join(" · ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
