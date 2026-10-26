import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BadgeCheck,
  CircleDollarSign,
  HandCoins,
  ListChecks,
  Percent,
  RotateCcw,
  Stamp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Avatar,
  BarraFiltros,
  CabecalhoGestao,
  CampoBusca,
  ChipsFiltro,
  EstadoErro,
  EstadoVazio,
  FaixaIndicadores,
  Indicador,
  ListaCarregando,
  PaginaGestao,
  Selo,
  type Tom,
} from "@/components/plataforma/kit";
import { GavetaPercentuais, pct } from "@/components/plataforma/comissoes/percentuais";
import { Dinheiro, TIPO_CONTA } from "@/components/plataforma/receita/comum";
import { useValorAssentado } from "@/components/plataforma/paginacao";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL, formatData } from "@/lib/financeiro/format";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  atualizarComissaoAssinante,
  listarComissoesAssinantes,
  type ComissaoAssinante,
  type StatusComissaoAssinante,
} from "@/lib/plataforma/comissoes-assinantes.functions";

export const Route = createFileRoute("/_authenticated/plataforma/comissoes")({
  head: () => ({ meta: [{ title: "Comissões dos assinantes — Gestão de sistemas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("saas.comissoes"),
  component: Pagina,
});

const STATUS: Record<StatusComissaoAssinante, { rotulo: string; tom: Tom }> = {
  a_pagar: { rotulo: "A pagar", tom: "alerta" },
  paga: { rotulo: "Paga", tom: "sucesso" },
  cancelada: { rotulo: "Cancelada", tom: "neutro" },
};
type FiltroStatus = StatusComissaoAssinante | "todas";

/**
 * Comissão dos assinantes (C52, 26/10/2026 — só o desenho; a regra é do financeiro): quem
 * envia a proposta recebe um percentual do valor financiado, liberado só quando o contrato
 * é registrado em cartório.
 */
function Pagina() {
  const listarFn = useServerFn(listarComissoesAssinantes);
  const podeEditar = usePermissao("saas.comissoes", "edit");
  const [status, setStatus] = useState<FiltroStatus>("a_pagar");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [busca, setBusca] = useState("");
  const termo = useValorAssentado(busca.trim());
  const [cancelando, setCancelando] = useState<ComissaoAssinante | null>(null);
  const [percentuais, setPercentuais] = useState(false);

  const q = useQuery({
    queryKey: ["plataforma-comissoes", status, de, ate, termo],
    queryFn: () =>
      listarFn({
        data: {
          status: status === "todas" ? null : status,
          de: de || null,
          ate: ate || null,
          busca: termo || null,
        },
      }),
    placeholderData: (a) => a,
  });
  const itens = q.data?.itens ?? [];
  const config = q.data?.config;
  const filtrando = !!(de || ate || termo);

  return (
    <PaginaGestao>
      <CabecalhoGestao
        icone={<HandCoins />}
        titulo="Comissões dos assinantes"
        descricao="Quem envia a proposta recebe um percentual do valor financiado, liberado quando o contrato é registrado em cartório."
        acoes={
          podeEditar && config ? (
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 sm:min-h-9"
              onClick={() => setPercentuais(true)}
            >
              <Percent className="mr-1.5 size-4" /> Percentuais
            </Button>
          ) : undefined
        }
      />

      <FaixaIndicadores>
        <Indicador
          rotulo="A pagar"
          icone={<CircleDollarSign />}
          tom="alerta"
          carregando={q.isLoading}
          valor={<Dinheiro valor={Number(q.data?.totais.a_pagar ?? 0)} />}
          onClick={() => setStatus("a_pagar")}
          ativo={status === "a_pagar"}
        />
        <Indicador
          rotulo="Pagas"
          icone={<BadgeCheck />}
          tom="sucesso"
          carregando={q.isLoading}
          valor={<Dinheiro valor={Number(q.data?.totais.pagas ?? 0)} />}
          onClick={() => setStatus("paga")}
          ativo={status === "paga"}
        />
        <Indicador
          rotulo="Comissões no filtro"
          icone={<ListChecks />}
          carregando={q.isLoading}
          valor={(q.data?.totais.quantidade ?? itens.length).toLocaleString("pt-BR")}
          detalhe={filtrando ? "com os filtros abaixo" : "na situação escolhida"}
        />
        <Indicador
          rotulo="Percentual padrão"
          icone={<Percent />}
          carregando={q.isLoading}
          valor={config ? pct(config.padrao) : "—"}
          detalhe={
            config?.por_conta.length
              ? `${config.por_conta.length} conta(s) com percentual próprio`
              : "do valor financiado"
          }
          onClick={podeEditar && config ? () => setPercentuais(true) : undefined}
        />
      </FaixaIndicadores>

      <div data-tour="plataforma-comissoes-regra" className="flex items-start gap-2.5 rounded-[10px] border border-primary/15 bg-primary/[0.03] px-4 py-3 text-sm text-muted-foreground">
        <Stamp className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          A comissão <b className="font-medium text-foreground">nasce no dia do registro em cartório</b>.
          Antes disso ela não existe: não aparece aqui nem soma em relatório.
        </p>
      </div>

      <BarraFiltros>
        <ChipsFiltro<FiltroStatus>
          rotulo="Situação da comissão"
          valor={status}
          onChange={setStatus}
          opcoes={[
            { valor: "a_pagar", rotulo: "A pagar" },
            { valor: "paga", rotulo: "Pagas" },
            { valor: "cancelada", rotulo: "Canceladas" },
            { valor: "todas", rotulo: "Todas" },
          ]}
        />
        <div data-tour="plataforma-comissoes-periodo" className="flex flex-wrap items-center gap-2 md:ml-auto">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="cm-de" className="whitespace-nowrap text-xs text-muted-foreground">
              Registro de
            </Label>
            <Input id="cm-de" type="date" className="h-10 w-[9.5rem]" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="cm-ate" className="text-xs text-muted-foreground">
              até
            </Label>
            <Input id="cm-ate" type="date" className="h-10 w-[9.5rem]" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
          {(de || ate) && (
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 sm:min-h-8"
              onClick={() => {
                setDe("");
                setAte("");
              }}
            >
              Limpar datas
            </Button>
          )}
        </div>
        <CampoBusca
          rotulo="Buscar conta ou proposta"
          placeholder="Conta ou proposta"
          valor={busca}
          onChange={setBusca}
          className="md:w-64 lg:w-72"
        />
      </BarraFiltros>

      <div data-tour="plataforma-comissoes-lista" className="overflow-hidden rounded-[14px] border border-border/80 bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)]">
        {q.isLoading ? (
          <ListaCarregando />
        ) : q.isError ? (
          <EstadoErro
            mensagem={mensagemDeErro(q.error, "Não foi possível carregar as comissões.")}
            onTentar={() => q.refetch()}
          />
        ) : itens.length === 0 ? (
          <EstadoVazio
            icone={<HandCoins />}
            titulo={filtrando ? "Nenhuma comissão com estes filtros" : "Nenhuma comissão nesta situação"}
            descricao="A comissão nasce no dia em que o contrato é registrado em cartório."
          />
        ) : (
          <>
            <table className="hidden w-full text-sm xl:table">
              <thead>
                <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Conta</th>
                  <th className="px-3 py-2.5 font-medium">Proposta</th>
                  <th className="px-3 py-2.5 font-medium">Registro</th>
                  <th className="px-3 py-2.5 text-right font-medium">Cálculo</th>
                  <th className="px-3 py-2.5 text-right font-medium">Comissão</th>
                  <th className="px-3 py-2.5 font-medium">Situação</th>
                  <th className="w-[1%] px-4 py-2.5">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {itens.map((c) => (
                  <tr key={c.id} className="align-top hover:bg-primary/[0.02]">
                    <td className="max-w-[15rem] px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar nome={c.conta} tamanho="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{c.conta}</p>
                          <p className="text-xs text-muted-foreground">{TIPO_CONTA[c.tipo] ?? c.tipo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[14rem] px-3 py-3">
                      <p className="truncate tabular-nums">{c.proposta}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[c.numero_agilliza ? `Agilliza ${c.numero_agilliza}` : null, c.cliente]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {formatData(c.registrado_em)}
                      {c.paga_em && (
                        <p className="text-xs text-muted-foreground">paga {formatData(c.paga_em)}</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-xs text-muted-foreground">
                      {pct(c.percentual)} de
                      <span className="block text-sm text-foreground">{formatBRL(Number(c.base))}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-base font-semibold">
                      <Dinheiro valor={Number(c.valor)} />
                    </td>
                    <td className="px-3 py-3">
                      <Selo tom={STATUS[c.status].tom}>{STATUS[c.status].rotulo}</Selo>
                      {c.observacao && (
                        <p className="mt-1 max-w-[12rem] truncate text-xs text-muted-foreground" title={c.observacao}>
                          {c.observacao}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <AcoesComissao c={c} podeEditar={podeEditar} onCancelar={() => setCancelando(c)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-border/60 xl:hidden">
              {itens.map((c) => (
                <li key={c.id} className="space-y-2 p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{c.conta}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {TIPO_CONTA[c.tipo] ?? c.tipo} · proposta {c.proposta}
                        {c.cliente ? ` · ${c.cliente}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-base font-semibold">
                      <Dinheiro valor={Number(c.valor)} />
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Registrada em {formatData(c.registrado_em)} · {pct(c.percentual)} de{" "}
                    {formatBRL(Number(c.base))}
                    {c.paga_em ? ` · paga em ${formatData(c.paga_em)}` : ""}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Selo tom={STATUS[c.status].tom}>{STATUS[c.status].rotulo}</Selo>
                    <AcoesComissao c={c} podeEditar={podeEditar} onCancelar={() => setCancelando(c)} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {cancelando && <CancelarComissao comissao={cancelando} aoFechar={() => setCancelando(null)} />}
      {podeEditar && config && (
        <GavetaPercentuais
          aberta={percentuais}
          aoFechar={() => setPercentuais(false)}
          padrao={config.padrao}
          porConta={config.por_conta}
        />
      )}
    </PaginaGestao>
  );
}

function AcoesComissao({
  c,
  podeEditar,
  onCancelar,
}: {
  c: ComissaoAssinante;
  podeEditar: boolean;
  onCancelar: () => void;
}) {
  const qc = useQueryClient();
  const atualizarFn = useServerFn(atualizarComissaoAssinante);
  const mudar = useMutation({
    mutationFn: (s: StatusComissaoAssinante) => atualizarFn({ data: { id: c.id, status: s } }),
    onSuccess: (_r, s) => {
      toast.success(s === "paga" ? "Baixa registrada." : "Comissão voltou para a pagar.");
      qc.invalidateQueries({ queryKey: ["plataforma-comissoes"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível atualizar.")),
  });
  if (!podeEditar || c.status === "cancelada") return null;
  return (
    <div className="flex items-center justify-end gap-1">
      {c.status === "a_pagar" ? (
        <Button
          size="sm"
          className="min-h-11 sm:min-h-8"
          disabled={mudar.isPending}
          onClick={() => mudar.mutate("paga")}
        >
          <BadgeCheck className="mr-1.5 size-4" /> Dar baixa
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="min-h-11 sm:min-h-8"
          disabled={mudar.isPending}
          onClick={() => mudar.mutate("a_pagar")}
        >
          <RotateCcw className="mr-1.5 size-4" /> Voltar para a pagar
        </Button>
      )}
      <Button
        size="icon"
        variant="ghost"
        className="size-11 text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:size-8"
        aria-label={`Cancelar a comissão de ${c.conta}`}
        onClick={onCancelar}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}

function CancelarComissao({
  comissao,
  aoFechar,
}: {
  comissao: ComissaoAssinante;
  aoFechar: () => void;
}) {
  const qc = useQueryClient();
  const atualizarFn = useServerFn(atualizarComissaoAssinante);
  const [motivo, setMotivo] = useState("");
  const cancelar = useMutation({
    mutationFn: () =>
      atualizarFn({ data: { id: comissao.id, status: "cancelada", observacao: motivo } }),
    onSuccess: () => {
      toast.success("Comissão cancelada.");
      qc.invalidateQueries({ queryKey: ["plataforma-comissoes"] });
      aoFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível cancelar.")),
  });
  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar comissão</DialogTitle>
          <DialogDescription>
            {comissao.conta} · {formatBRL(Number(comissao.valor))}. O motivo fica registrado.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={3}
          aria-label="Motivo do cancelamento"
          placeholder="Motivo do cancelamento (mínimo 5 letras)"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" className="w-full sm:w-auto" onClick={aoFechar}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            className="w-full sm:w-auto"
            disabled={motivo.trim().length < 5 || cancelar.isPending}
            onClick={() => cancelar.mutate()}
          >
            Cancelar comissão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
