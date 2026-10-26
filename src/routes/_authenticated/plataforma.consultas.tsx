import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock,
  FileSearch,
  Inbox,
  Landmark,
  Receipt,
  RefreshCw,
  Tag,
  Wallet,
  XCircle,
} from "lucide-react";
import { AdminHero } from "@/components/admin/admin-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL, formatData, hojeISO } from "@/lib/financeiro/format";
import {
  lerConsultasPagas,
  registrarCustoConsulta,
  salvarPrecoConsulta,
  POR_PAGINA_PEDIDOS,
  type CustoFornecedor,
  type PedidoConsulta,
  type SituacaoPedido,
} from "@/lib/plataforma/consultas.functions";

export const Route = createFileRoute("/_authenticated/plataforma/consultas")({
  head: () => ({ meta: [{ title: "Consultas pagas — Plataforma — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("saas.consultas"),
  component: Pagina,
});

type Situacao = SituacaoPedido;

const FIN: Record<string, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  pago: "Pago",
  cancelado: "Cancelado",
  estornado: "Estornado",
  contestado: "Contestado",
};
const CONS: Record<string, string> = {
  aguardando_pagamento: "—",
  na_fila: "Na fila",
  executando: "Executando",
  concluida: "Concluída",
  falhou: "Falhou",
  reconciliar: "Reconciliar",
  nao_executada: "Não executada",
};
const FALHA: Record<string, string> = {
  interna: "interna",
  fornecedor: "do fornecedor",
  saldo: "sem saldo na APIFull",
  rejeicao: "recusada pelo fornecedor",
  ambigua: "sem resposta conclusiva",
};

const QK = "plataforma-consultas";
const TODAS = "todas";

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

function Pagina() {
  const lerFn = useServerFn(lerConsultasPagas);
  const hoje = hojeISO();
  const [de, setDe] = useState(`${hoje.slice(0, 8)}01`);
  const [ate, setAte] = useState(hoje);
  const [situacao, setSituacao] = useState<Situacao | null>(null);
  const [pagina, setPagina] = useState(1);
  const periodoValido = Boolean(de && ate && de <= ate);

  const q = useQuery({
    queryKey: [QK, de, ate, situacao, pagina],
    queryFn: () => lerFn({ data: { de, ate, situacao, pagina } }),
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

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AdminHero
        secao="Gestão de sistemas"
        icon={<FileSearch className="h-5 w-5" />}
        titulo="Consultas pagas"
        descricao="Serasa Premium vendida por unidade às licenças: receita, custo da APIFull, taxas do Asaas e o que ainda falta entregar."
        acoes={
          <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={`mr-2 size-4 ${q.isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        }
      />

      {q.isError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {mensagemDeErro(q.error, "Não foi possível carregar as consultas pagas.")}
        </p>
      )}

      {(i?.pagas_sem_entrega ?? 0) > 0 && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            {i!.pagas_sem_entrega} consulta(s) paga(s) ainda sem entrega no período. Veja a coluna
            “Consulta” abaixo e os incidentes em Monitoramento.
          </p>
        </div>
      )}

      <section
        aria-label="Período"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4"
      >
        <div className="space-y-1">
          <Label htmlFor="consultas-de">Pedidos de</Label>
          <Input
            id="consultas-de"
            type="date"
            className="w-40"
            value={de}
            max={ate || undefined}
            onChange={(e) => {
              setDe(e.target.value);
              setPagina(1);
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="consultas-ate">até</Label>
          <Input
            id="consultas-ate"
            type="date"
            className="w-40"
            value={ate}
            min={de || undefined}
            onChange={(e) => {
              setAte(e.target.value);
              setPagina(1);
            }}
          />
        </div>
        {!periodoValido && (
          <p className="pb-2 text-sm text-destructive">Escolha um período válido.</p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
        <Metrica
          icone={<Receipt className="size-4" />}
          rotulo="Receita bruta"
          valor={i ? formatBRL(i.receita_bruta) : "—"}
          detalhe={i ? `${i.pagos} venda(s) paga(s)` : undefined}
          carregando={carregando}
        />
        <Metrica
          icone={<Landmark className="size-4" />}
          rotulo="Custo APIFull"
          valor={i ? formatBRL(i.custo_fornecedor) : "—"}
          detalhe={i ? `${i.concluidas} consulta(s) entregue(s)` : undefined}
          carregando={carregando}
        />
        <Metrica
          icone={<Wallet className="size-4" />}
          rotulo="Taxas do pagamento"
          valor={i ? formatBRL(i.taxas_pagamento) : "—"}
          detalhe={
            i
              ? i.taxas_desconhecidas
                ? `${i.taxas_desconhecidas} sem taxa informada pelo Asaas`
                : "informadas pelo Asaas"
              : undefined
          }
          carregando={carregando}
        />
        <Metrica
          icone={<CircleDollarSign className="size-4" />}
          rotulo="Margem de contribuição"
          valor={i ? formatBRL(i.margem_contribuicao) : "—"}
          detalhe="antes de impostos e despesas fixas"
          tom="sucesso"
          carregando={carregando}
        />
        <Metrica
          icone={<FileSearch className="size-4" />}
          rotulo="Pedidos no período"
          valor={i ? String(i.pedidos) : "—"}
          detalhe={i ? `${i.canceladas} não pago(s) e cancelado(s)` : undefined}
          carregando={carregando}
        />
        <Metrica
          icone={<AlertTriangle className="size-4" />}
          rotulo="Falhas"
          valor={i ? String(i.falhas) : "—"}
          detalhe="ver pedidos que falharam"
          tom={i?.falhas ? "perigo" : undefined}
          onClick={() => filtrar("falhou")}
          carregando={carregando}
        />
        <Metrica
          icone={<Clock className="size-4" />}
          rotulo="Em reconciliação"
          valor={i ? String(i.reconciliar) : "—"}
          detalhe="ver pedidos a reconciliar"
          tom={i?.reconciliar ? "alerta" : undefined}
          onClick={() => filtrar("reconciliar")}
          carregando={carregando}
        />
        <Metrica
          icone={<XCircle className="size-4" />}
          rotulo="Estornos"
          valor={i ? formatBRL(i.estornos) : "—"}
          detalhe={i ? `${i.estornadas} pedido(s)` : undefined}
          carregando={carregando}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <CartaoPreco
          preco={d?.oferta?.preco ?? null}
          ativo={Boolean(d?.oferta?.ativo)}
          podeEditarNoBanco={Boolean(d?.podeEditarPreco)}
          carregando={carregando}
        />
        <CartaoCusto
          custos={d?.custos ?? null}
          podeVerCustos={Boolean(d?.podeVerCustos)}
          carregando={carregando}
        />
      </div>

      <Pedidos
        pedidos={d?.pedidos ?? []}
        total={d?.total ?? 0}
        pagina={pagina}
        onPagina={setPagina}
        situacao={situacao}
        onSituacao={filtrar}
        carregando={carregando}
      />

      <p className="text-xs text-muted-foreground">
        Receita conta pedidos pagos e não estornados; o custo vem da tabela vigente no momento do
        pedido; a taxa é a diferença entre o valor e o líquido informado pelo Asaas. Margem de
        contribuição não é lucro líquido: não desconta impostos, infraestrutura nem atendimento.
      </p>
    </div>
  );
}

function Metrica({
  icone,
  rotulo,
  valor,
  detalhe,
  tom,
  onClick,
  carregando,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: string;
  detalhe?: string;
  tom?: "sucesso" | "alerta" | "perigo";
  onClick?: () => void;
  carregando: boolean;
}) {
  const cor =
    tom === "perigo"
      ? "border-destructive/50"
      : tom === "alerta"
        ? "border-amber-400/70"
        : tom === "sucesso"
          ? "border-emerald-400/60"
          : "border-border";
  const corpo = (
    <>
      <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icone} {rotulo}
      </span>
      {carregando ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <span className="mt-1 block text-xl font-semibold tabular-nums">{valor}</span>
      )}
      {detalhe && <span className="mt-0.5 block text-xs text-muted-foreground">{detalhe}</span>}
    </>
  );
  const classe = `min-w-0 rounded-lg border bg-card p-4 text-left ${cor}`;
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={`${classe} transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
      aria-label={`${rotulo}: ${valor}. Filtrar pedidos`}
    >
      {corpo}
    </button>
  ) : (
    <section className={classe}>{corpo}</section>
  );
}

function CartaoPreco({
  preco,
  ativo,
  podeEditarNoBanco,
  carregando,
}: {
  preco: number | null;
  ativo: boolean;
  podeEditarNoBanco: boolean;
  carregando: boolean;
}) {
  const podeEditar = usePermissao("saas.consultas", "edit") && podeEditarNoBanco;
  const qc = useQueryClient();
  const salvarFn = useServerFn(salvarPrecoConsulta);
  const [valor, setValor] = useState("");
  const [ligado, setLigado] = useState(ativo);
  useEffect(() => {
    setValor(preco != null ? preco.toFixed(2).replace(".", ",") : "");
    setLigado(ativo);
  }, [preco, ativo]);

  const salvar = useMutation({
    mutationFn: () => salvarFn({ data: { preco: valor, ativo: ligado } }),
    onSuccess: () => {
      toast.success("Preço salvo. Vale para os próximos pedidos.");
      qc.invalidateQueries({ queryKey: [QK] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível salvar o preço.")),
  });

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Tag className="size-4" /> Preço de venda
        </h2>
        <p className="text-xs text-muted-foreground">
          Vale para pedidos novos; quem já pediu mantém o preço gravado no pedido.
        </p>
      </div>
      {carregando ? (
        <Skeleton className="h-24" />
      ) : podeEditar ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            salvar.mutate();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="consulta-preco">Preço de venda (R$)</Label>
            <Input
              id="consulta-preco"
              inputMode="decimal"
              className="max-w-40 tabular-nums"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="consulta-ativa"
              checked={ligado}
              onCheckedChange={setLigado}
              aria-label="Venda ligada para as licenças"
            />
            <Label htmlFor="consulta-ativa">Venda ligada para as licenças</Label>
          </div>
          <Button type="submit" size="sm" disabled={salvar.isPending || !valor.trim()}>
            {salvar.isPending ? "Salvando…" : "Salvar preço"}
          </Button>
        </form>
      ) : (
        <div className="space-y-1">
          <p className="text-lg font-semibold tabular-nums">
            {preco != null ? formatBRL(preco) : "—"}
          </p>
          <Badge variant={ativo ? "outline" : "secondary"}>
            {ativo ? "Venda ligada" : "Venda desligada"}
          </Badge>
        </div>
      )}
    </section>
  );
}

function CartaoCusto({
  custos,
  podeVerCustos,
  carregando,
}: {
  custos: CustoFornecedor[] | null;
  podeVerCustos: boolean;
  carregando: boolean;
}) {
  const podeEditar = usePermissao("saas.consultas", "edit");
  const qc = useQueryClient();
  const registrarFn = useServerFn(registrarCustoConsulta);
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");
  const registrar = useMutation({
    mutationFn: () => registrarFn({ data: { custo: valor, observacao: obs } }),
    onSuccess: () => {
      toast.success("Custo registrado com vigência a partir de agora.");
      setValor("");
      setObs("");
      qc.invalidateQueries({ queryKey: [QK] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível registrar o custo.")),
  });

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Landmark className="size-4" /> Custo da APIFull
        </h2>
        <p className="text-xs text-muted-foreground">
          Fica só na plataforma: licença nenhuma vê este valor. Cada mudança tem vigência própria.
        </p>
      </div>
      {carregando ? (
        <Skeleton className="h-24" />
      ) : !podeVerCustos || !custos ? (
        <p className="text-sm text-muted-foreground">Seu perfil não vê custos de fornecedor.</p>
      ) : (
        <div className="space-y-4">
          {custos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum custo registrado.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {custos.map((c) => (
                <li key={c.vigente_desde} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="font-semibold tabular-nums">{formatBRL(c.custo)}</span>
                  <span className="text-xs text-muted-foreground">
                    desde {dataHora(c.vigente_desde)}
                  </span>
                  {c.observacao && (
                    <span className="w-full text-xs text-muted-foreground">{c.observacao}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {podeEditar && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                registrar.mutate();
              }}
            >
              <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                <div className="space-y-1">
                  <Label htmlFor="consulta-custo">Novo custo (R$)</Label>
                  <Input
                    id="consulta-custo"
                    inputMode="decimal"
                    className="tabular-nums"
                    placeholder="6,72"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="consulta-custo-origem">Origem do valor</Label>
                  <Input
                    id="consulta-custo-origem"
                    maxLength={300}
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
                disabled={registrar.isPending || !valor.trim()}
              >
                {registrar.isPending ? "Registrando…" : "Registrar custo"}
              </Button>
            </form>
          )}
        </div>
      )}
    </section>
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
}: {
  pedidos: PedidoConsulta[];
  total: number;
  pagina: number;
  onPagina: (p: number) => void;
  situacao: Situacao | null;
  onSituacao: (s: Situacao | null) => void;
  carregando: boolean;
}) {
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA_PEDIDOS));
  return (
    <section aria-label="Pedidos de consulta" className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
        <h2 className="text-sm font-semibold">
          Pedidos {total ? <span className="text-muted-foreground">({total})</span> : null}
        </h2>
        <Select
          value={situacao ?? TODAS}
          onValueChange={(v) => onSituacao(v === TODAS ? null : (v as Situacao))}
        >
          <SelectTrigger className="w-full sm:w-64" aria-label="Situação dos pedidos">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas as situações</SelectItem>
            <SelectGroup>
              <SelectLabel>Pagamento</SelectLabel>
              {Object.entries(FIN).map(([v, t]) => (
                <SelectItem key={`f-${v}`} value={v}>
                  Pagamento: {t}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Consulta</SelectLabel>
              {Object.entries(CONS)
                .filter(([v]) => v !== "aguardando_pagamento")
                .map(([v, t]) => (
                  <SelectItem key={`c-${v}`} value={v}>
                    Consulta: {t}
                  </SelectItem>
                ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {carregando ? (
        <div className="p-4">
          <Skeleton className="h-24" />
        </div>
      ) : pedidos.length === 0 ? (
        <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Inbox className="size-4" /> Nenhum pedido. Quando uma licença comprar uma consulta, ela
          aparece aqui.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Licença</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Taxa</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Consulta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedidos.map((p) => (
                <TableRow key={p.id} className="align-top">
                  <TableCell className="whitespace-nowrap text-xs tabular-nums">
                    {dataHora(p.criado_em)}
                  </TableCell>
                  <TableCell className="max-w-[14rem] truncate">{p.conta}</TableCell>
                  <TableCell className="tabular-nums">{p.documento_mascarado ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(p.preco)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.custo_fornecedor != null ? formatBRL(p.custo_fornecedor) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.taxa_pagamento != null ? formatBRL(p.taxa_pagamento) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={p.situacao_financeira === "pago" ? "outline" : "secondary"}
                      className={
                        p.situacao_financeira === "pago"
                          ? "text-emerald-700"
                          : p.situacao_financeira === "aguardando_pagamento"
                            ? "bg-amber-100 text-amber-900"
                            : undefined
                      }
                    >
                      {FIN[p.situacao_financeira] ?? p.situacao_financeira}
                    </Badge>
                    {p.pago_em && (
                      <small className="mt-1 block text-xs text-muted-foreground">
                        pago em {formatData(p.pago_em)}
                      </small>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        ["falhou", "reconciliar"].includes(p.situacao_consulta)
                          ? "destructive"
                          : "outline"
                      }
                      className={
                        p.situacao_consulta === "concluida" ? "text-emerald-700" : undefined
                      }
                    >
                      {CONS[p.situacao_consulta] ?? p.situacao_consulta}
                    </Badge>
                    {p.tipo_falha && (
                      <small className="mt-1 block text-xs text-muted-foreground">
                        Falha {FALHA[p.tipo_falha] ?? p.tipo_falha} · {p.execucoes} execução(ões)
                      </small>
                    )}
                    {p.ultimo_erro && (
                      <small
                        className="mt-1 block max-w-[16rem] truncate text-xs text-destructive"
                        title={p.ultimo_erro}
                      >
                        {p.ultimo_erro}
                      </small>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {total > POR_PAGINA_PEDIDOS && (
        <nav
          aria-label="Páginas dos pedidos"
          className="flex items-center justify-between gap-2 border-t border-border p-3 text-sm"
        >
          <Button
            variant="outline"
            size="sm"
            disabled={pagina <= 1}
            onClick={() => onPagina(pagina - 1)}
            aria-label="Página anterior"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="tabular-nums text-muted-foreground">
            Página {pagina} de {paginas}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagina >= paginas}
            onClick={() => onPagina(pagina + 1)}
            aria-label="Próxima página"
          >
            <ChevronRight className="size-4" />
          </Button>
        </nav>
      )}
    </section>
  );
}
