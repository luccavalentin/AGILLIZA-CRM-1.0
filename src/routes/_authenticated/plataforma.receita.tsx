import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CircleDollarSign } from "lucide-react";
import { AdminHero } from "@/components/admin/admin-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
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
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AssinaturasPlataforma } from "@/components/plataforma/assinaturas";
import { CancelamentosRenovacao } from "@/components/plataforma/cancelamentos";
import { RodapePaginas, useValorAssentado } from "@/components/plataforma/paginacao";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL, formatData } from "@/lib/financeiro/format";
import {
  POR_PAGINA_FATURAS,
  baixarFaturaPlataforma,
  cancelarFaturaPlataforma,
  lerReceita,
  listarFaturasPlataforma,
  type FaturaPlataforma,
  type FiltroFatura,
} from "@/lib/plataforma/receita.functions";

export const Route = createFileRoute("/_authenticated/plataforma/receita")({
  head: () => ({ meta: [{ title: "Receita e cobrança — Plataforma — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("saas.receita"),
  component: Pagina,
});

const FILTROS: Record<FiltroFatura, string> = {
  abertas: "Em aberto",
  vencidas: "Vencidas",
  pagas: "Pagas",
  todas: "Todas",
};

function situacaoFatura(f: FaturaPlataforma): {
  rotulo: string;
  tom: "default" | "secondary" | "destructive" | "outline";
} {
  if (f.status === "paga") return { rotulo: "Paga", tom: "default" };
  if (f.status === "cancelada") return { rotulo: "Cancelada", tom: "outline" };
  if (f.status === "estornada") return { rotulo: "Estornada", tom: "outline" };
  if (f.vencida) return { rotulo: "Vencida", tom: "destructive" };
  return { rotulo: "Em aberto", tom: "secondary" };
}

function Pagina() {
  const lerFn = useServerFn(lerReceita);
  const q = useQuery({
    queryKey: ["plataforma-receita"],
    queryFn: () => lerFn(),
    staleTime: 30_000,
  });
  const [filtro, setFiltro] = useState<FiltroFatura>("abertas");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const termo = useValorAssentado(busca.trim());
  const listarFn = useServerFn(listarFaturasPlataforma);
  // Filtro, busca e página rodam no banco: a lista não para nas 300 primeiras.
  const qf = useQuery({
    queryKey: ["plataforma-receita", "faturas", filtro, termo, pagina],
    queryFn: () => listarFn({ data: { filtro, busca: termo || null, pagina } }),
    staleTime: 30_000,
    placeholderData: (anterior) => anterior,
  });
  const r = q.data?.resumo;
  const faturas = qf.data?.faturas ?? [];
  const meses = q.data?.meses ?? [];
  const maxMrr = Math.max(1, ...meses.map((m) => m.mrr_fim));

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AdminHero
        secao="Plataforma"
        icon={<CircleDollarSign className="h-5 w-5" />}
        titulo="Receita e cobrança"
        descricao="Assinaturas e faturas dos assinantes. Com a chave do Asaas salva em Chaves dos provedores, cada fatura é cobrada e baixada automaticamente. Sem a chave, a baixa é feita aqui."
      />

      {q.isError && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {mensagemDeErro(q.error, "Não foi possível carregar a receita.")}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {/* Assinaturas + licenças por pacote vigentes (valor ÷ meses do período, 0253). */}
        <Indicador
          rotulo="Receita recorrente mensal"
          valor={r ? formatBRL(r.mrr + (r.mrr_licencas ?? 0)) : null}
          detalhe={
            r
              ? `${formatBRL((r.mrr + (r.mrr_licencas ?? 0)) * 12)} por ano · licenças ${formatBRL(r.mrr_licencas ?? 0)}/mês`
              : undefined
          }
        />
        <Indicador
          rotulo="Contas pagantes"
          valor={r ? String(r.contas_pagantes + (r.contas_licenca ?? 0)) : null}
          detalhe={r ? `${r.contas_teste} em teste` : undefined}
        />
        <Indicador rotulo="Recebido no mês" valor={r ? formatBRL(r.recebido_mes) : null} />
        <Indicador rotulo="Em aberto" valor={r ? formatBRL(r.pendente_valor) : null} />
        <Indicador
          rotulo="Vencido"
          valor={r ? formatBRL(r.vencida_valor) : null}
          detalhe={r ? `${r.vencidas} ${r.vencidas === 1 ? "fatura" : "faturas"}` : undefined}
          alerta={(r?.vencidas ?? 0) > 0}
        />
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Receita recorrente — últimos 12 meses</h2>
        {q.isLoading ? (
          <Skeleton className="h-32" />
        ) : meses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ainda não há assinaturas pagas para formar a série.
          </p>
        ) : (
          <div
            className="flex h-36 items-end gap-1.5"
            role="img"
            aria-label="Evolução da receita recorrente mensal"
          >
            {meses.map((m, i) => (
              <div
                key={m.mes}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
              >
                {/* Trilho com altura própria: a % da barra precisa de um pai com
                    altura definida — sem ele, toda barra resolvia para 0 px. */}
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t bg-primary/80"
                    style={{ height: `${Math.max(2, (m.mrr_fim / maxMrr) * 100)}%` }}
                    title={`${m.mes.slice(0, 7)}: ${formatBRL(m.mrr_fim)} (novo ${formatBRL(m.novo)}, saída ${formatBRL(m.churn)})`}
                  />
                </div>
                {/* No celular cabe um rótulo a cada três meses. */}
                <span
                  className={`text-[10px] text-muted-foreground ${i % 3 === (meses.length - 1) % 3 ? "" : "hidden sm:inline"}`}
                >
                  {m.mes.slice(5, 7)}/{m.mes.slice(2, 4)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <AssinaturasPlataforma />

      <section className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
          <h2 className="text-sm font-semibold">Faturas dos assinantes</h2>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Input
              aria-label="Buscar fatura por conta ou descrição"
              placeholder="Conta ou descrição"
              className="sm:w-56"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
            />
            <Select
              value={filtro}
              onValueChange={(v) => {
                setFiltro(v as FiltroFatura);
                setPagina(1);
              }}
            >
              <SelectTrigger className="sm:w-40" aria-label="Filtrar faturas">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FILTROS) as FiltroFatura[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {FILTROS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Conta</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="w-[1%] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {qf.isLoading && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-10" />
                  </TableCell>
                </TableRow>
              )}
              {qf.isError && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-destructive">
                    {mensagemDeErro(qf.error, "Não foi possível carregar as faturas.")}
                  </TableCell>
                </TableRow>
              )}
              {!qf.isLoading && !qf.isError && faturas.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Nenhuma fatura neste filtro.
                  </TableCell>
                </TableRow>
              )}
              {faturas.map((f) => (
                <LinhaFatura key={f.id} fatura={f} />
              ))}
            </TableBody>
          </Table>
        </div>
        <RodapePaginas
          pagina={pagina}
          porPagina={POR_PAGINA_FATURAS}
          quantidade={faturas.length}
          total={qf.data?.total}
          carregando={qf.isFetching}
          onPagina={setPagina}
        />
      </section>

      {/* F2 (0273): quem cancelou a renovação e por quê. */}
      <CancelamentosRenovacao />
    </div>
  );
}

function Indicador({
  rotulo,
  valor,
  detalhe,
  alerta,
}: {
  rotulo: string;
  valor: string | null;
  detalhe?: string;
  alerta?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border bg-card p-4 ${alerta ? "border-destructive/50" : "border-border"}`}
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      {valor === null ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
      )}
      {detalhe && <p className="mt-0.5 text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  );
}

function LinhaFatura({ fatura: f }: { fatura: FaturaPlataforma }) {
  const qc = useQueryClient();
  const pode = usePermissao("saas.receita", "edit");
  const baixarFn = useServerFn(baixarFaturaPlataforma);
  const cancelarFn = useServerFn(cancelarFaturaPlataforma);
  const [forma, setForma] = useState<"pix" | "boleto" | "cartao">("pix");
  const emAberto = f.status === "pendente" || f.status === "vencida";
  const s = situacaoFatura(f);
  const baixar = useMutation({
    mutationFn: () => baixarFn({ data: { id: f.id, forma } }),
    onSuccess: () => {
      toast.success(
        "Pagamento confirmado. Créditos e acesso da conta são liberados automaticamente.",
      );
      qc.invalidateQueries({ queryKey: ["plataforma-receita"] });
      qc.invalidateQueries({ queryKey: ["plataforma-licencas"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível dar baixa.")),
  });

  return (
    <TableRow>
      <TableCell className="font-medium">{f.conta}</TableCell>
      <TableCell className="max-w-[18rem]">
        <span className="block truncate">{f.descricao}</span>
        {/* Fatura de licença: o período comprado (0253), mesmo com a descrição cortada. */}
        {f.periodo && (
          <span className="block text-xs text-muted-foreground">
            Licença {f.periodo}
          </span>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatBRL(f.valor)}</TableCell>
      <TableCell>
        {formatData(f.vencimento)}
        {f.pago_em ? (
          <span className="block text-xs text-muted-foreground">pago {formatData(f.pago_em)}</span>
        ) : null}
      </TableCell>
      <TableCell>
        <Badge variant={s.tom}>{s.rotulo}</Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap text-right">
        {pode && emAberto && (
          <div className="flex items-center justify-end gap-1.5">
            <Select value={forma} onValueChange={(v) => setForma(v as typeof forma)}>
              <SelectTrigger className="h-8 w-24" aria-label="Forma do pagamento recebido">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
              </SelectContent>
            </Select>
            {/* A baixa libera créditos e acesso da conta: pede confirmação. */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={baixar.isPending}>
                  Dar baixa
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar o recebimento?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {f.conta} — {f.descricao}, {formatBRL(f.valor)}, recebido por{" "}
                    {forma === "pix" ? "Pix" : forma === "boleto" ? "boleto" : "cartão"}. A fatura
                    fica paga e os créditos e o acesso da conta são liberados.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => baixar.mutate()}>Dar baixa</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <ConfirmDelete
              titulo="Cancelar esta fatura?"
              descricao={`${f.descricao} — ${formatBRL(f.valor)}. A fatura deixa de ser cobrada.`}
              confirmarLabel="Cancelar fatura"
              onConfirm={async () => {
                await cancelarFn({ data: { id: f.id } });
                toast.success("Fatura cancelada.");
                qc.invalidateQueries({ queryKey: ["plataforma-receita"] });
              }}
            />
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
