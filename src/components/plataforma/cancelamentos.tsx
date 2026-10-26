/**
 * Cancelamentos de renovação da Receita: quem cancelou, por quê e até quando vale o que já
 * pagou (0273, F2). Os motivos viram barras de proporção para mostrar onde olhar primeiro.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarX2, UserX } from "lucide-react";
import {
  Avatar,
  BarraFiltros,
  ChipsFiltro,
  EstadoErro,
  EstadoVazio,
  ListaCarregando,
  Secao,
  Selo,
} from "@/components/plataforma/kit";
import { TIPO_CONTA } from "@/components/plataforma/receita/comum";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatData } from "@/lib/financeiro/format";
import {
  lerCancelamentos,
  type MotivoCancelamento,
} from "@/lib/plataforma/cancelamentos.functions";

const MOTIVO: Record<MotivoCancelamento, string> = {
  caro: "Achou caro",
  pouco_uso: "Usou pouco",
  faltou_funcao: "Faltou uma função",
  outro_sistema: "Foi para outro sistema",
  pausa: "Pausa temporária",
  outro: "Outro motivo",
};
const PERIODOS = ["30", "90", "365"] as const;
type Periodo = (typeof PERIODOS)[number];

export function CancelamentosRenovacao() {
  const lerFn = useServerFn(lerCancelamentos);
  const [periodo, setPeriodo] = useState<Periodo>("90");
  const dias = Number(periodo) as 30 | 90 | 365;
  const q = useQuery({
    queryKey: ["plataforma-cancelamentos", dias],
    queryFn: () => lerFn({ data: { dias } }),
    staleTime: 60_000,
    placeholderData: (a) => a,
  });
  const itens = q.data ?? [];
  const porMotivo = Object.entries(
    itens.reduce<Record<string, number>>((acc, c) => {
      acc[c.motivo] = (acc[c.motivo] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const reativados = itens.filter((c) => c.reativado_em).length;
  const maior = Math.max(1, ...porMotivo.map(([, n]) => n));

  return (
    <div className="space-y-3">
      <BarraFiltros className="md:justify-between">
        <p className="text-sm text-muted-foreground">
          Quem pediu para não renovar. O acesso vale até o fim do que já foi pago.
        </p>
        <ChipsFiltro<Periodo>
          rotulo="Período dos cancelamentos"
          valor={periodo}
          onChange={setPeriodo}
          opcoes={[
            { valor: "30", rotulo: "30 dias" },
            { valor: "90", rotulo: "90 dias" },
            { valor: "365", rotulo: "12 meses" },
          ]}
        />
      </BarraFiltros>

      {q.isLoading ? (
        <Secao>
          <ListaCarregando linhas={3} className="p-0" />
        </Secao>
      ) : q.isError ? (
        <Secao>
          <EstadoErro
            mensagem={mensagemDeErro(q.error, "Não foi possível ler os cancelamentos.")}
            onTentar={() => q.refetch()}
          />
        </Secao>
      ) : itens.length === 0 ? (
        <Secao>
          <EstadoVazio
            icone={<CalendarX2 />}
            titulo="Ninguém cancelou a renovação neste período"
            descricao="Boa notícia: a base está renovando."
          />
        </Secao>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          <Secao
            titulo="Por motivo"
            descricao={`${itens.length} cancelamento(s) · ${reativados} voltaram`}
            className="lg:col-span-1"
          >
            <ul className="space-y-3">
              {porMotivo.map(([m, n]) => (
                <li key={m} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">{MOTIVO[m as MotivoCancelamento] ?? m}</span>
                    <span className="tabular-nums text-muted-foreground">{n}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${(n / maior) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Secao>
          <Secao titulo="Contas" icone={<UserX />} semRespiro className="lg:col-span-2">
            <ul className="max-h-[460px] divide-y divide-border/60 overflow-y-auto">
              {itens.map((c) => (
                <li key={`${c.tenant_id}-${c.pedido_em}`} className="flex gap-3 p-3.5 text-sm sm:px-4">
                  <Avatar nome={c.conta} tamanho="sm" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="break-words font-medium text-foreground">{c.conta}</span>
                      <Selo>{TIPO_CONTA[c.tipo] ?? c.tipo}</Selo>
                      <Selo tom="alerta">{MOTIVO[c.motivo] ?? c.motivo}</Selo>
                      {c.reativado_em && (
                        <Selo tom="sucesso" ponto>
                          Voltou {c.reativado_como === "pagamento" ? "pagando" : "e reativou"}
                        </Selo>
                      )}
                    </div>
                    {c.detalhe && <p className="break-words text-muted-foreground">“{c.detalhe}”</p>}
                    <p className="text-xs text-muted-foreground">
                      {c.plano ?? "sem plano"} · pediu em {formatData(c.pedido_em)}
                      {c.vale_ate ? ` · vale até ${formatData(c.vale_ate)}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Secao>
        </div>
      )}
    </div>
  );
}
