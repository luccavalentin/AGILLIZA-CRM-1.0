import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { buscarContasDoFiltro } from "@/lib/plataforma/filtro-base.functions";
import { salvarSimulacaoRapidaNaConta } from "@/lib/plataforma/simulacao-na-conta.functions";
import type { DadosRapidaNaConta } from "@/lib/plataforma/simulacao-na-conta.server";

/** Arredonda para 2 casas e troca valor não finito por 0 (o servidor recusa NaN). */
const dinheiro = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;

/**
 * Simulação rápida com destino num assinante (C29): a calculadora não grava nada no Agilliza,
 * então o resultado mostrado é guardado na carteira da conta, como simulação rápida calculada.
 */
export function GuardarRapidaNaConta({
  licenca,
  dados,
}: {
  licenca: string;
  dados: DadosRapidaNaConta;
}) {
  const salvarFn = useServerFn(salvarSimulacaoRapidaNaConta);
  const buscarFn = useServerFn(buscarContasDoFiltro);
  const conta = useQuery({
    queryKey: ["destino-simulacao-conta", licenca],
    queryFn: () => buscarFn({ data: { id: licenca, pagina: 1, porPagina: 5 } }),
    staleTime: 5 * 60_000,
  });
  const nome = conta.data?.contas?.[0]?.nome ?? "assinante";
  const [salvando, setSalvando] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);
  // Mudou a simulação ou a conta: dá para guardar de novo (é outra simulação).
  const assinatura = `${licenca}|${JSON.stringify(dados)}`;
  useEffect(() => setCodigo(null), [assinatura]);

  async function guardar() {
    setSalvando(true);
    try {
      const r = await salvarFn({
        data: {
          licenca,
          dados: {
            ...dados,
            valor_imovel: dinheiro(dados.valor_imovel),
            valor_financiamento: dinheiro(dados.valor_financiamento),
            renda: dados.renda ? dinheiro(dados.renda) : null,
            resultado: dados.resultado.slice(0, 20).map((b) => ({
              ...b,
              parcela: dinheiro(b.parcela),
              ultima_parcela: b.ultima_parcela != null ? dinheiro(b.ultima_parcela) : undefined,
              taxa_ano: b.taxa_ano != null ? dinheiro(b.taxa_ano) : undefined,
              cet_ano: b.cet_ano != null ? dinheiro(b.cet_ano) : undefined,
              renda_minima: b.renda_minima != null ? dinheiro(b.renda_minima) : undefined,
            })),
          },
        },
      });
      setCodigo(r.codigo);
      toast.success(`Simulação guardada na carteira de ${nome} (${r.codigo}).`);
    } catch (e) {
      toast.error(mensagemDeErro(e, `Não foi possível guardar na carteira de ${nome}.`));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-xl border border-primary/25 bg-primary/[0.04] p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="min-w-0 text-xs text-muted-foreground">
        {codigo ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <CheckCircle2 className="size-4 text-primary" /> Guardada na carteira de {nome} ({codigo}).
          </span>
        ) : (
          <>
            Destino: <strong className="text-foreground">{nome}</strong>. A rápida não fica na sua base;
            guarde para o assinante ver.
          </>
        )}
      </p>
      <Button
        type="button"
        onClick={guardar}
        disabled={salvando || !!codigo}
        className="h-11 shrink-0 gap-1.5 rounded-xl font-semibold shadow-sm sm:h-9"
      >
        {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        {codigo ? "Guardada" : `Guardar na carteira de ${nome}`}
      </Button>
    </div>
  );
}
