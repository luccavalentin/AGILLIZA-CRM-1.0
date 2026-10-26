import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CalendarRange,
  CircleDollarSign,
  Clock,
  FileSearch,
  Landmark,
  Minus,
  Receipt,
  RefreshCw,
  Wallet,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarraFiltros,
  CabecalhoGestao,
  ChipsFiltro,
  EstadoErro,
  EstadoVazio,
  FaixaIndicadores,
  IconeGestao,
  Indicador,
  ListaCarregando,
  PaginaGestao,
  Secao,
  Selo,
  type Tom,
} from "@/components/plataforma/kit";
import { RodapePaginas } from "@/components/plataforma/paginacao";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL, formatData, hojeISO } from "@/lib/financeiro/format";
import { cn } from "@/lib/utils";
import {
  lerConsultasPagas,
  registrarCustoConsulta,
  salvarProdutoConsulta,
  POR_PAGINA_PEDIDOS,
  type CustoFornecedor,
  type IndicadoresConsultas,
  type PedidoConsulta,
  type ProdutoConfigurado,
  type ProdutoConsulta,
  type SituacaoPedido,
} from "@/lib/plataforma/consultas.functions";

/** Marca oficial e nome de cada produto (as mesmas imagens do Agilliza Tech). */
const PRODUTO: Record<ProdutoConsulta, { rotulo: string; marca: string; alt: string }> = {
  "serasa-premium": { rotulo: "Serasa Premium", marca: "/biros/serasa.svg", alt: "Serasa Experian" },
  "spc-brasil": { rotulo: "SPC Brasil", marca: "/biros/spc.png", alt: "SPC Brasil" },
};
const ehProduto = (v: unknown): v is ProdutoConsulta => v === "serasa-premium" || v === "spc-brasil";
const rotuloProduto = (v: unknown) => (ehProduto(v) ? PRODUTO[v].rotulo : "Serasa Premium");

export const Route = createFileRoute("/_authenticated/plataforma/consultas")({
  head: () => ({ meta: [{ title: "Consultas pagas — Gestão de sistemas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("saas.consultas"),
  component: Pagina,
});

type Situacao = SituacaoPedido;

const FIN: Record<string, { rotulo: string; tom: Tom }> = {
  aguardando_pagamento: { rotulo: "Aguardando pagamento", tom: "alerta" },
  pago: { rotulo: "Pago", tom: "sucesso" },
  cancelado: { rotulo: "Cancelado", tom: "neutro" },
  estornado: { rotulo: "Estornado", tom: "neutro" },
  contestado: { rotulo: "Contestado", tom: "perigo" },
};
const CONS: Record<string, { rotulo: string; tom: Tom }> = {
  aguardando_pagamento: { rotulo: "—", tom: "neutro" },
  na_fila: { rotulo: "Na fila", tom: "info" },
  executando: { rotulo: "Executando", tom: "info" },
  concluida: { rotulo: "Concluída", tom: "sucesso" },
  falhou: { rotulo: "Falhou", tom: "perigo" },
  reconciliar: { rotulo: "Reconciliar", tom: "perigo" },
  nao_executada: { rotulo: "Não executada", tom: "neutro" },
};
const FALHA: Record<string, string> = {
  interna: "interna",
  fornecedor: "do fornecedor",
  saldo: "sem saldo na APIFull",
  rejeicao: "recusada pelo fornecedor",
  ambigua: "sem resposta conclusiva",
};

/** Filtros mais usados em chips; as demais situações ficam em "Outras". */
const PRINCIPAIS: { valor: "todas" | Situacao; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "aguardando_pagamento", rotulo: "Aguardando pagamento" },
  { valor: "pago", rotulo: "Pagas" },
  { valor: "concluida", rotulo: "Entregues" },
  { valor: "falhou", rotulo: "Falharam" },
  { valor: "reconciliar", rotulo: "Reconciliar" },
  { valor: "estornado", rotulo: "Estornadas" },
];
const OUTRAS: { valor: Situacao; rotulo: string }[] = [
  { valor: "na_fila", rotulo: "Consulta na fila" },
  { valor: "executando", rotulo: "Consulta executando" },
  { valor: "nao_executada", rotulo: "Consulta não executada" },
  { valor: "cancelado", rotulo: "Pagamento cancelado" },
  { valor: "contestado", rotulo: "Pagamento contestado" },
];

const QK = "plataforma-consultas";

/** Data e hora curtas (dd/mm/aaaa hh:mm) no fuso do navegador. */
function dataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Dia (AAAA-MM-DD) n dias antes de hoje, no fuso de São Paulo. */
function diasAtras(hoje: string, n: number): string {
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

type Atalho = "mes" | "30" | "90" | "livre";

function Pagina() {
  const lerFn = useServerFn(lerConsultasPagas);
  const hoje = hojeISO();
  const [de, setDe] = useState(`${hoje.slice(0, 8)}01`);
  const [ate, setAte] = useState(hoje);
  const [atalho, setAtalho] = useState<Atalho>("mes");
  const [situacao, setSituacao] = useState<Situacao | null>(null);
  const [produto, setProduto] = useState<ProdutoConsulta | null>(null);
  const [pagina, setPagina] = useState(1);
  const periodoValido = Boolean(de && ate && de <= ate);

  const q = useQuery({
    queryKey: [QK, de, ate, situacao, produto, pagina],
    queryFn: () => lerFn({ data: { de, ate, situacao, produto, pagina } }),
    enabled: periodoValido,
    placeholderData: (anterior) => anterior,
  });
  const d = q.data;
  const i = d?.indicadores;
  const carregando = q.isLoading && !d;

  const filtrar = (s: Situacao | null) => {
    setSituacao(s);
    setPagina(1);
  };
  const escolherAtalho = (a: Atalho) => {
    setAtalho(a);
    setPagina(1);
    if (a === "mes") {
      setDe(`${hoje.slice(0, 8)}01`);
      setAte(hoje);
    } else if (a === "30" || a === "90") {
      setDe(diasAtras(hoje, Number(a) - 1));
      setAte(hoje);
    }
  };
  const margemPct =
    i && i.receita_bruta > 0 ? Math.round((i.margem_contribuicao / i.receita_bruta) * 100) : null;

  return (
    <PaginaGestao>
      <CabecalhoGestao
        icone={<FileSearch />}
        titulo="Consultas pagas"
        descricao="Serasa Premium e SPC Brasil vendidas às licenças com créditos pré-pagos: preço e custo de cada uma, receita, taxas do Asaas e o que ainda falta entregar."
        acoes={
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 sm:min-h-8"
            onClick={() => q.refetch()}
            disabled={q.isFetching || !periodoValido}
          >
            <RefreshCw className={cn("mr-2 size-4", q.isFetching && "animate-spin")} /> Atualizar
          </Button>
        }
      />

      <BarraFiltros>
        <div className="flex min-w-0 items-center gap-2">
          <CalendarRange className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <ChipsFiltro
            rotulo="Período"
            valor={atalho}
            onChange={escolherAtalho}
            opcoes={[
              { valor: "mes", rotulo: "Este mês" },
              { valor: "30", rotulo: "30 dias" },
              { valor: "90", rotulo: "90 dias" },
              { valor: "livre", rotulo: "Escolher datas" },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-end gap-2 md:ml-auto">
          <div className="space-y-1">
            <Label htmlFor="consultas-de" className="text-xs text-muted-foreground">
              De
            </Label>
            <Input
              id="consultas-de"
              type="date"
              className="h-10 w-[9.5rem] text-base sm:text-sm"
              value={de}
              max={ate || undefined}
              onChange={(e) => {
                setDe(e.target.value);
                setAtalho("livre");
                setPagina(1);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="consultas-ate" className="text-xs text-muted-foreground">
              Até
            </Label>
            <Input
              id="consultas-ate"
              type="date"
              className="h-10 w-[9.5rem] text-base sm:text-sm"
              value={ate}
              min={de || undefined}
              onChange={(e) => {
                setAte(e.target.value);
                setAtalho("livre");
                setPagina(1);
              }}
            />
          </div>
        </div>
        <ChipsFiltro
          rotulo="Produto"
          className="w-full"
          valor={produto ?? "todos"}
          onChange={(v) => {
            setProduto(v === "todos" ? null : v);
            setPagina(1);
          }}
          opcoes={[
            { valor: "todos" as const, rotulo: "Serasa e SPC" },
            { valor: "serasa-premium" as const, rotulo: "Serasa Premium" },
            { valor: "spc-brasil" as const, rotulo: "SPC Brasil" },
          ]}
        />
        {!periodoValido && (
          <p className="w-full text-sm text-destructive" role="alert">
            Escolha um período válido (a data inicial vem antes da final).
          </p>
        )}
      </BarraFiltros>

      {q.isError && (
        <Secao>
          <EstadoErro
            mensagem={mensagemDeErro(q.error, "Não foi possível carregar as consultas pagas.")}
            onTentar={() => q.refetch()}
          />
        </Secao>
      )}

      {(i?.pagas_sem_entrega ?? 0) > 0 && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-[14px] border border-warning/50 bg-warning/10 p-3 text-sm text-warning-foreground"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            <b>{i!.pagas_sem_entrega}</b> consulta(s) paga(s) ainda sem entrega no período. Confira
            os pedidos abaixo e os incidentes em Monitoramento.
          </p>
        </div>
      )}

      {/* Do bruto à margem: a conta da venda, passo a passo */}
      <Secao
        titulo="Resultado do período"
        descricao="Receita dos pedidos pagos e não estornados, menos o custo do fornecedor e as taxas do pagamento."
        icone={<CircleDollarSign />}
      >
        <div data-tour="plataforma-consultas-resultado" className="grid grid-cols-1 items-stretch gap-2 sm:grid-cols-2 xl:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
          <PassoConta
            rotulo="Receita bruta"
            valor={i ? formatBRL(i.receita_bruta) : "—"}
            detalhe={i ? `${i.pagos} venda(s) paga(s)` : undefined}
            icone={<Receipt />}
            carregando={carregando}
          />
          <Operador simbolo={<Minus />} />
          <PassoConta
            rotulo="Custo APIFull"
            valor={i ? formatBRL(i.custo_fornecedor) : "—"}
            detalhe={i ? `${i.concluidas} consulta(s) entregue(s)` : undefined}
            icone={<Landmark />}
            tom="neutro"
            carregando={carregando}
          />
          <Operador simbolo={<Minus />} />
          <PassoConta
            rotulo="Taxas do pagamento"
            valor={i ? formatBRL(i.taxas_pagamento) : "—"}
            detalhe={
              i
                ? i.taxas_desconhecidas
                  ? `${i.taxas_desconhecidas} sem taxa informada pelo Asaas`
                  : "informadas pelo Asaas"
                : undefined
            }
            icone={<Wallet />}
            tom="neutro"
            carregando={carregando}
          />
          <Operador simbolo={<ArrowRight />} />
          <PassoConta
            rotulo="Margem de contribuição"
            valor={i ? formatBRL(i.margem_contribuicao) : "—"}
            detalhe={margemPct != null ? `${margemPct}% da receita` : "antes de impostos e despesas fixas"}
            icone={<CircleDollarSign />}
            tom="sucesso"
            destaque
            carregando={carregando}
          />
        </div>
      </Secao>

      <FaixaIndicadores>
        <Indicador
          rotulo="Pedidos no período"
          valor={i ? i.pedidos : "—"}
          detalhe={i ? `${i.canceladas} não pago(s) e cancelado(s)` : undefined}
          icone={<FileSearch />}
          carregando={carregando}
        />
        <Indicador
          rotulo="Falhas"
          valor={i ? i.falhas : "—"}
          detalhe="Toque para ver os pedidos"
          icone={<AlertTriangle />}
          tom={i?.falhas ? "perigo" : "neutro"}
          onClick={() => filtrar(situacao === "falhou" ? null : "falhou")}
          ativo={situacao === "falhou"}
          carregando={carregando}
        />
        <Indicador
          rotulo="Em reconciliação"
          valor={i ? i.reconciliar : "—"}
          detalhe="Toque para ver os pedidos"
          icone={<Clock />}
          tom={i?.reconciliar ? "alerta" : "neutro"}
          onClick={() => filtrar(situacao === "reconciliar" ? null : "reconciliar")}
          ativo={situacao === "reconciliar"}
          carregando={carregando}
        />
        <Indicador
          rotulo="Estornos"
          valor={i ? formatBRL(i.estornos) : "—"}
          detalhe={i ? `${i.estornadas} pedido(s)` : undefined}
          icone={<XCircle />}
          tom="neutro"
          carregando={carregando}
        />
      </FaixaIndicadores>

      <div data-tour="plataforma-consultas-preco" className="space-y-3">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <Wallet className="size-4 shrink-0" aria-hidden />
          <span>
            Preço do crédito:{" "}
            <b className="font-medium tabular-nums text-foreground">
              {d?.precoCredito != null ? formatBRL(d.precoCredito) : "—"}
            </b>
            , o mesmo para os dois produtos (a carteira das licenças é uma só). Cada produto
            define quantos créditos uma consulta custa.
          </span>
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {(["serasa-premium", "spc-brasil"] as const).map((id) => (
            <CartaoProduto
              key={id}
              id={id}
              configurado={d?.produtos?.find((p) => p.produto === id) ?? null}
              precoCredito={d?.precoCredito ?? null}
              custos={d?.custos ? d.custos.filter((c) => c.produto === id) : null}
              periodo={i?.por_produto?.[id] ?? null}
              filtrado={produto != null && produto !== id}
              podeVerCustos={Boolean(d?.podeVerCustos)}
              podeEditarNoBanco={Boolean(d?.podeEditarProdutos)}
              carregando={carregando}
            />
          ))}
        </div>
      </div>

      <Pedidos
        pedidos={d?.pedidos ?? []}
        total={d?.total ?? 0}
        pagina={pagina}
        onPagina={setPagina}
        situacao={situacao}
        onSituacao={filtrar}
        carregando={carregando}
        atualizando={q.isFetching}
      />

      <p className="text-xs leading-relaxed text-muted-foreground">
        Receita conta pedidos pagos e não estornados; o custo vem da tabela vigente no momento do
        pedido; a taxa é a diferença entre o valor e o líquido informado pelo Asaas. Margem de
        contribuição não é lucro líquido: não desconta impostos, infraestrutura nem atendimento.
      </p>
    </PaginaGestao>
  );
}

function PassoConta({
  rotulo,
  valor,
  detalhe,
  icone,
  tom = "marca",
  destaque,
  carregando,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  icone: ReactNode;
  tom?: Tom;
  destaque?: boolean;
  carregando: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border p-3.5",
        destaque ? "border-success/30 bg-success/[0.06]" : "border-border/80 bg-background",
      )}
    >
      <div className="flex items-center gap-2">
        <IconeGestao icone={icone} tom={tom} tamanho="sm" />
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {rotulo}
        </p>
      </div>
      {carregando ? (
        <Skeleton className="mt-2 h-7 w-28" />
      ) : (
        <p
          className={cn(
            "mt-2 break-words text-[clamp(1.15rem,1rem+0.6vw,1.45rem)] font-medium tracking-tight tabular-nums",
            destaque ? "text-success-texto" : "text-foreground",
          )}
        >
          {valor}
        </p>
      )}
      {detalhe && <p className="mt-0.5 text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  );
}

function Operador({ simbolo }: { simbolo: ReactNode }) {
  return (
    <span
      aria-hidden
      className="hidden place-items-center text-muted-foreground xl:grid [&_svg]:size-4"
    >
      {simbolo}
    </span>
  );
}

type ContaProduto = NonNullable<IndicadoresConsultas["por_produto"]>[ProdutoConsulta];

/**
 * Um produto (Serasa Premium ou SPC Brasil): ligado/desligado, preço em créditos por consulta,
 * custo do fornecedor com vigência e a conta do período. A regra mora no banco
 * (`plataforma.configurar_produto_consulta`): créditos de 1 a 100 e acima do custo vigente.
 */
function CartaoProduto({
  id,
  configurado,
  precoCredito,
  custos,
  periodo,
  filtrado,
  podeVerCustos,
  podeEditarNoBanco,
  carregando,
}: {
  id: ProdutoConsulta;
  configurado: ProdutoConfigurado | null;
  precoCredito: number | null;
  custos: CustoFornecedor[] | null;
  periodo: ContaProduto | null;
  /** O filtro de produto está em outro: a conta do período não vale para este. */
  filtrado: boolean;
  podeVerCustos: boolean;
  podeEditarNoBanco: boolean;
  carregando: boolean;
}) {
  const info = PRODUTO[id];
  const podeEditar = usePermissao("saas.consultas", "edit") && podeEditarNoBanco;
  const qc = useQueryClient();
  const salvarFn = useServerFn(salvarProdutoConsulta);
  const [creditos, setCreditos] = useState("");
  const [ligado, setLigado] = useState(false);
  useEffect(() => {
    setCreditos(configurado ? String(configurado.creditos) : "");
    setLigado(Boolean(configurado?.ativo));
  }, [configurado]);

  const n = Number(creditos);
  const creditosValidos = Number.isInteger(n) && n >= 1 && n <= 100;
  const custoVigente = custos?.[0]?.custo ?? null;
  const precoAtual =
    configurado && precoCredito != null ? configurado.creditos * precoCredito : null;
  const margem = precoAtual != null && custoVigente != null ? precoAtual - custoVigente : null;
  const mudou =
    configurado != null && (n !== configurado.creditos || ligado !== configurado.ativo);

  const salvar = useMutation({
    mutationFn: () => salvarFn({ data: { produto: id, creditos: n, ativo: ligado } }),
    onSuccess: () => {
      toast.success(`${info.rotulo} salvo. Vale para as próximas consultas.`);
      qc.invalidateQueries({ queryKey: [QK] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível salvar o produto.")),
  });

  const situacao: { rotulo: string; tom: Tom } = !configurado
    ? { rotulo: "Não configurado", tom: "neutro" }
    : !configurado.ativo
      ? { rotulo: "Desligado", tom: "neutro" }
      : configurado.vendavel
        ? { rotulo: "Ligado", tom: "sucesso" }
        : { rotulo: "Ligado · sem custo", tom: "alerta" };

  return (
    <Secao
      titulo={
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-14 shrink-0 place-items-center rounded-lg bg-white ring-1 ring-inset ring-border">
            <img src={info.marca} alt={info.alt} className="max-h-6 max-w-12 object-contain" />
          </span>
          <span className="truncate">{info.rotulo}</span>
        </span>
      }
      descricao="Pela APIFull, com o mesmo token. Quem já consultou mantém o que pagou."
      acoes={
        !carregando && (
          <Selo tom={situacao.tom} ponto={situacao.tom === "sucesso"}>
            {situacao.rotulo}
          </Selo>
        )
      }
    >
      {carregando ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="space-y-4">
          <dl className="grid grid-cols-3 gap-2">
            <ValorProduto rotulo="Preço">
              {configurado ? (
                <>
                  {configurado.creditos} crédito{configurado.creditos === 1 ? "" : "s"}
                  {precoAtual != null && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {formatBRL(precoAtual)}
                    </span>
                  )}
                </>
              ) : (
                "—"
              )}
            </ValorProduto>
            <ValorProduto rotulo="Custo">
              {!podeVerCustos ? "Restrito" : custoVigente != null ? formatBRL(custoVigente) : "—"}
              <span className="block text-xs font-normal text-muted-foreground">APIFull</span>
            </ValorProduto>
            <ValorProduto rotulo="Margem" destaque={podeVerCustos && margem != null && margem > 0}>
              {podeVerCustos && margem != null ? formatBRL(margem) : "—"}
              <span className="block text-xs font-normal text-muted-foreground">antes da taxa</span>
            </ValorProduto>
          </dl>

          {configurado?.ativo && !configurado.vendavel && (
            <p className="flex items-start gap-2 rounded-lg bg-warning/10 p-2.5 text-xs text-warning-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Ligado, mas sem custo do fornecedor cadastrado: as licenças veem “indisponível” até
              o custo ser registrado abaixo.
            </p>
          )}

          <p className="text-xs tabular-nums text-muted-foreground">
            {filtrado
              ? "Período: o filtro está no outro produto."
              : periodo
                ? `Período: ${periodo.pedidos} pedido(s) · ${periodo.concluidas} entregue(s) · receita ${formatBRL(periodo.receita_bruta)} · margem ${formatBRL(periodo.margem_contribuicao)}`
                : "Período: nenhum pedido."}
          </p>

          {podeEditar && configurado && (
            <form
              className="flex flex-wrap items-end gap-x-4 gap-y-3 border-t border-border/70 pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (creditosValidos) salvar.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor={`consulta-creditos-${id}`}>Créditos por consulta</Label>
                <Input
                  id={`consulta-creditos-${id}`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  step={1}
                  className="h-10 w-28 text-base tabular-nums sm:text-sm"
                  value={creditos}
                  onChange={(e) => setCreditos(e.target.value)}
                  aria-invalid={!creditosValidos}
                />
              </div>
              <label
                htmlFor={`consulta-ativa-${id}`}
                className="flex min-h-10 items-center gap-2 text-sm"
              >
                <Switch
                  id={`consulta-ativa-${id}`}
                  checked={ligado}
                  onCheckedChange={setLigado}
                  aria-label={`${info.rotulo} ligado para as licenças`}
                />
                Ligado para as licenças
              </label>
              <Button
                type="submit"
                size="sm"
                className="min-h-11 sm:min-h-9"
                disabled={salvar.isPending || !creditosValidos || !mudou}
              >
                {salvar.isPending ? "Salvando…" : "Salvar"}
              </Button>
              {!creditosValidos && (
                <p className="w-full text-xs text-destructive" role="alert">
                  Use de 1 a 100 créditos por consulta.
                </p>
              )}
            </form>
          )}

          <ListaCustos id={id} custos={custos} podeVerCustos={podeVerCustos} />
        </div>
      )}
    </Secao>
  );
}

function ValorProduto({
  rotulo,
  children,
  destaque,
}: {
  rotulo: string;
  children: ReactNode;
  destaque?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border p-2.5",
        destaque ? "border-success/30 bg-success/[0.06]" : "border-border/80 bg-background",
      )}
    >
      <dt className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium tabular-nums text-foreground sm:text-base">
        {children}
      </dd>
    </div>
  );
}

/** Custos do fornecedor de um produto: só a plataforma vê; cada mudança tem vigência própria. */
function ListaCustos({
  id,
  custos,
  podeVerCustos,
}: {
  id: ProdutoConsulta;
  custos: CustoFornecedor[] | null;
  podeVerCustos: boolean;
}) {
  const podeEditar = usePermissao("saas.consultas", "edit");
  const qc = useQueryClient();
  const registrarFn = useServerFn(registrarCustoConsulta);
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");
  const registrar = useMutation({
    mutationFn: () => registrarFn({ data: { produto: id, custo: valor, observacao: obs } }),
    onSuccess: () => {
      toast.success("Custo registrado com vigência a partir de agora.");
      setValor("");
      setObs("");
      qc.invalidateQueries({ queryKey: [QK] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível registrar o custo.")),
  });

  if (!podeVerCustos || !custos) {
    return (
      <p className="flex items-center gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
        <Landmark className="size-3.5" aria-hidden /> Custo do fornecedor restrito ao seu perfil.
      </p>
    );
  }
  return (
    <div className="space-y-3 border-t border-border/70 pt-4">
      <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-foreground">
        <Landmark className="size-4 text-muted-foreground" aria-hidden /> Custo da APIFull
        <span className="text-xs font-normal text-muted-foreground">só a plataforma vê</span>
      </p>
      {custos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum custo registrado.</p>
      ) : (
        <ol className="space-y-2">
          {custos.map((c, idx) => (
            <li
              key={c.vigente_desde}
              className={cn(
                "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-lg px-3 py-2 text-sm",
                idx === 0 ? "bg-primary/[0.05] ring-1 ring-inset ring-primary/15" : "bg-secondary/50",
              )}
            >
              <span className="font-medium tabular-nums text-foreground">
                {formatBRL(c.custo)}
                {idx === 0 && (
                  <Selo tom="marca" className="ml-2 align-middle">
                    Vigente
                  </Selo>
                )}
              </span>
              <span className="text-xs text-muted-foreground">desde {dataHora(c.vigente_desde)}</span>
              {c.observacao && (
                <span className="w-full text-xs text-muted-foreground">{c.observacao}</span>
              )}
            </li>
          ))}
        </ol>
      )}
      {podeEditar && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            registrar.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor={`consulta-custo-${id}`}>Novo custo (R$)</Label>
              <Input
                id={`consulta-custo-${id}`}
                inputMode="decimal"
                className="h-10 text-base tabular-nums sm:text-sm"
                placeholder="6,72"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`consulta-custo-origem-${id}`}>Origem do valor</Label>
              <Input
                id={`consulta-custo-origem-${id}`}
                maxLength={300}
                className="h-10 text-base sm:text-sm"
                placeholder="Ex.: tabela da APIFull de novembro"
                value={obs}
                onChange={(e) => setObs(e.target.value)}
              />
            </div>
          </div>
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            className="min-h-11 sm:min-h-9"
            disabled={registrar.isPending || !valor.trim()}
          >
            {registrar.isPending ? "Registrando…" : "Registrar custo"}
          </Button>
        </form>
      )}
    </div>
  );
}

/** Produto do pedido, com os créditos quando foi pago com a carteira. */
function SeloProduto({ p }: { p: PedidoConsulta }) {
  return (
    <div className="min-w-0">
      <Selo tom={p.produto === "spc-brasil" ? "info" : "marca"}>{rotuloProduto(p.produto)}</Selo>
      {p.pago_com === "credito" && p.creditos != null && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {p.creditos} crédito{p.creditos === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}

function SeloPagamento({ p }: { p: PedidoConsulta }) {
  const f = FIN[p.situacao_financeira] ?? { rotulo: p.situacao_financeira, tom: "neutro" as Tom };
  return (
    <div className="min-w-0">
      <Selo tom={f.tom}>{f.rotulo}</Selo>
      {p.pago_em && (
        <p className="mt-1 text-[11px] text-muted-foreground">pago em {formatData(p.pago_em)}</p>
      )}
    </div>
  );
}

function SeloConsulta({ p }: { p: PedidoConsulta }) {
  const c = CONS[p.situacao_consulta] ?? { rotulo: p.situacao_consulta, tom: "neutro" as Tom };
  return (
    <div className="min-w-0">
      <Selo tom={c.tom} ponto={p.situacao_consulta === "executando"}>
        {c.rotulo}
      </Selo>
      {p.tipo_falha && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Falha {FALHA[p.tipo_falha] ?? p.tipo_falha} · {p.execucoes} execução(ões)
        </p>
      )}
      {p.ultimo_erro && (
        <p className="mt-0.5 line-clamp-2 break-all text-[11px] text-destructive" title={p.ultimo_erro}>
          {p.ultimo_erro}
        </p>
      )}
    </div>
  );
}

function Pedidos({
  pedidos,
  total,
  pagina,
  onPagina,
  situacao,
  onSituacao,
  carregando,
  atualizando,
}: {
  pedidos: PedidoConsulta[];
  total: number;
  pagina: number;
  onPagina: (p: number) => void;
  situacao: Situacao | null;
  onSituacao: (s: Situacao | null) => void;
  carregando: boolean;
  atualizando: boolean;
}) {
  const outraEscolhida = OUTRAS.some((o) => o.valor === situacao);
  return (
    <Secao
      titulo={
        <>
          Pedidos {total ? <span className="font-normal text-muted-foreground">({total})</span> : null}
        </>
      }
      descricao="Cada compra de consulta feita por uma licença, do pagamento à entrega."
      semRespiro
    >
      <div data-tour="plataforma-consultas-pedidos" className="flex flex-col gap-2 border-b border-border/70 px-4 py-3 md:flex-row md:items-center">
        <ChipsFiltro
          rotulo="Situação dos pedidos"
          className="min-w-0 flex-1"
          valor={outraEscolhida ? "todas" : (situacao ?? "todas")}
          onChange={(v) => onSituacao(v === "todas" ? null : v)}
          opcoes={PRINCIPAIS.map((o) => ({ valor: o.valor, rotulo: o.rotulo }))}
        />
        <Select
          value={outraEscolhida ? (situacao as string) : "nenhuma"}
          onValueChange={(v) => onSituacao(v === "nenhuma" ? null : (v as Situacao))}
        >
          <SelectTrigger
            className={cn("h-10 w-full md:w-56", outraEscolhida && "border-primary text-primary")}
            aria-label="Outras situações"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nenhuma">Outras situações</SelectItem>
            {OUTRAS.map((o) => (
              <SelectItem key={o.valor} value={o.valor}>
                {o.rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {carregando ? (
        <ListaCarregando linhas={4} />
      ) : pedidos.length === 0 ? (
        <EstadoVazio
          icone={<FileSearch />}
          titulo={situacao ? "Nenhum pedido nesta situação" : "Nenhum pedido no período"}
          descricao="Quando uma licença comprar uma consulta, ela aparece aqui."
        />
      ) : (
        <>
          {/* Computador: tabela */}
          <div className="hidden lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Pedido</th>
                  <th className="px-3 py-2.5 font-medium">Licença</th>
                  <th className="px-3 py-2.5 font-medium">Produto</th>
                  <th className="px-3 py-2.5 text-right font-medium">Preço</th>
                  <th className="px-3 py-2.5 text-right font-medium">Custo</th>
                  <th className="px-3 py-2.5 text-right font-medium">Taxa</th>
                  <th className="px-3 py-2.5 font-medium">Pagamento</th>
                  <th className="px-4 py-2.5 font-medium">Consulta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {pedidos.map((p) => (
                  <tr key={p.id} className="align-top hover:bg-primary/[0.02]">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs tabular-nums text-muted-foreground">
                      {dataHora(p.criado_em)}
                    </td>
                    <td className="max-w-[16rem] px-3 py-3">
                      <p className="truncate font-medium text-foreground">{p.conta}</p>
                      <p className="font-mono text-xs tabular-nums text-muted-foreground">
                        {p.documento_mascarado ?? "—"}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <SeloProduto p={p} />
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatBRL(p.preco)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {p.custo_fornecedor != null ? formatBRL(p.custo_fornecedor) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {p.taxa_pagamento != null ? formatBRL(p.taxa_pagamento) : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <SeloPagamento p={p} />
                    </td>
                    <td className="max-w-[16rem] px-4 py-3">
                      <SeloConsulta p={p} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Celular e tablet: cartões */}
          <ul className="divide-y divide-border/60 lg:hidden">
            {pedidos.map((p) => (
              <li key={p.id} className="space-y-2 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{p.conta}</p>
                    <p className="font-mono text-xs tabular-nums text-muted-foreground">
                      {dataHora(p.criado_em)} · {p.documento_mascarado ?? "—"}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium tabular-nums">{formatBRL(p.preco)}</p>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  <SeloProduto p={p} />
                  <SeloPagamento p={p} />
                  <SeloConsulta p={p} />
                </div>
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  Custo {p.custo_fornecedor != null ? formatBRL(p.custo_fornecedor) : "—"} · Taxa{" "}
                  {p.taxa_pagamento != null ? formatBRL(p.taxa_pagamento) : "—"}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      <RodapePaginas
        pagina={pagina}
        porPagina={POR_PAGINA_PEDIDOS}
        quantidade={pedidos.length}
        total={total}
        carregando={atualizando}
        onPagina={onPagina}
      />
    </Secao>
  );
}
