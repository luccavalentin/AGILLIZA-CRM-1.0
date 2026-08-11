import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Download, ExternalLink, FileText, Printer, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { MultiSelect } from "@/components/conciliacao/multi-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { abaResumo } from "@/lib/conciliacao/xlsx-tipos";
import { baixarXlsx, gerarPdfComparativo, type ModoSaida } from "@/lib/conciliacao/exportar-lazy";
import { listarItensConciliacao } from "@/lib/conciliacao/conciliacao.functions";
import { SITUACAO_LABEL } from "@/lib/conciliacao/bancos";
import {
  ETAPAS_COMPARATIVO,
  ETAPA_COMPARATIVO_LABEL,
  ETAPA_COMPARATIVO_TONE,
  classificarEtapa,
  type EtapaComparativo,
} from "@/lib/conciliacao/planilhas";
import {
  RESULTADO_LABEL,
  RESULTADO_TONE,
  type ConciliacaoItem,
  type ConciliacaoLote,
  type ResultadoConciliacao,
} from "@/lib/conciliacao/tipos";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function fmtValor(v: number | null) {
  return v == null ? "—" : brl.format(Number(v));
}

function fmtData(v: string | null) {
  if (!v) return "—";
  const [a, m, d] = v.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

const RESULTADOS: ResultadoConciliacao[] = [
  "conferido",
  "divergente",
  "ausente_no_sistema",
  "ausente_no_banco",
];

const COLUNAS = [
  { header: "Banco", key: "banco", width: 16 },
  { header: "Etapa (status)", key: "etapa", width: 22 },
  { header: "Resultado", key: "resultado", width: 20 },
  { header: "Nº proposta (banco)", key: "propostaBanco", width: 20 },
  { header: "Nº proposta (sistema)", key: "propostaSistema", width: 20 },
  { header: "Cliente", key: "cliente", width: 34 },
  { header: "CPF", key: "cpf", width: 16 },
  { header: "Status no banco", key: "statusBanco", width: 30 },
  { header: "Status no sistema", key: "statusSistema", width: 26 },
  { header: "Valor banco", key: "valorBanco", tipo: "brl" as const, width: 18 },
  { header: "Valor sistema", key: "valorSistema", tipo: "brl" as const, width: 18 },
  { header: "Diferença", key: "diferenca", tipo: "brl" as const, width: 18 },
  { header: "Data de envio", key: "dataEnvio", tipo: "data" as const, width: 14 },
  { header: "Data de emissão", key: "dataEmissao", tipo: "data" as const, width: 15 },
  { header: "Data de assinatura", key: "dataAssinatura", tipo: "data" as const, width: 16 },
  { header: "Produto", key: "produto", width: 24 },
  { header: "Divergência", key: "divergencia", width: 52 },
];

type Linha = ConciliacaoItem & { _banco: string; _periodo: string; _etapa: EtapaComparativo };

function paraExport(i: Linha) {
  return {
    banco: i._banco,
    etapa: ETAPA_COMPARATIVO_LABEL[i._etapa],
    resultado: RESULTADO_LABEL[i.resultado],
    propostaBanco: i.numero_proposta_banco,
    propostaSistema: i.numero_proposta_sistema,
    cliente: i.nome_cliente_banco,
    cpf: i.cpf_banco,
    statusBanco: i.status_banco,
    statusSistema: i.status_sistema ? (SITUACAO_LABEL[i.status_sistema] ?? i.status_sistema) : null,
    valorBanco: i.valor_financiamento_banco,
    valorSistema: i.valor_financiamento_sistema,
    diferenca:
      i.valor_financiamento_banco != null && i.valor_financiamento_sistema != null
        ? Number(i.valor_financiamento_banco) - Number(i.valor_financiamento_sistema)
        : null,
    dataEnvio: i.data_envio_banco,
    dataEmissao: i.data_emissao_banco,
    dataAssinatura: i.data_assinatura_banco,
    produto: i.produto_banco,
    divergencia: i.detalhe_divergencia,
  };
}

/**
 * Visão consolidada: cruza os itens de todos os lotes filtrados (vários bancos),
 * permite filtrar por etapa/status e resultado, e exporta uma planilha unificada.
 */
export function ComparativoConsolidado({
  lotes,
  resultados,
  onResultadosChange,
  periodoLabel,
}: {
  lotes: ConciliacaoLote[];
  resultados: ResultadoConciliacao[];
  onResultadosChange: (v: ResultadoConciliacao[]) => void;
  periodoLabel: string;
}) {
  const listar = useServerFn(listarItensConciliacao);
  const [busca, setBusca] = useState("");
  const [etapas, setEtapas] = useState<EtapaComparativo[]>([]);

  const queries = useQueries({
    queries: lotes.map((l) => ({
      queryKey: ["conciliacao-itens", l.id],
      queryFn: () => listar({ data: { loteId: l.id } }),
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);

  const todos = useMemo<Linha[]>(() => {
    const out: Linha[] = [];
    queries.forEach((q, idx) => {
      const lote = lotes[idx];
      if (!lote || !q.data) return;
      for (const i of q.data as ConciliacaoItem[]) {
        out.push({
          ...i,
          _banco: lote.banco_nome,
          _periodo: lote.periodo_referencia.slice(0, 7),
          _etapa:
            classificarEtapa(i.status_banco) ?? classificarEtapa(i.status_sistema) ?? "outros",
        });
      }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lotes, queries.map((q) => q.dataUpdatedAt).join("|")]);

  const filtrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return todos.filter((i) => {
      if (resultados.length && !resultados.includes(i.resultado)) return false;
      if (etapas.length && !etapas.includes(i._etapa)) return false;
      if (!b) return true;
      return [
        i.numero_proposta_banco,
        i.numero_proposta_sistema,
        i.nome_cliente_banco,
        i.cpf_banco,
        i.status_banco,
        i._banco,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(b));
    });
  }, [todos, resultados, etapas, busca]);

  const contagemEtapa = useMemo(() => {
    const m = new Map<EtapaComparativo, number>();
    for (const i of todos) m.set(i._etapa, (m.get(i._etapa) ?? 0) + 1);
    return m;
  }, [todos]);

  async function exportar() {
    const linhas = filtrados.map(paraExport);
    const bancos = [...new Set(filtrados.map((i) => i._banco))].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
    const abas = [
      abaResumo("Comparativo consolidado", [
        { rotulo: "Mês de referência", valor: periodoLabel },
        { rotulo: "Bancos", valor: bancos.join(", ") || "—" },
        { rotulo: "Lotes considerados", valor: lotes.length },
        {
          rotulo: "Resultados filtrados",
          valor: resultados.length ? resultados.map((r) => RESULTADO_LABEL[r]).join(", ") : "Todos",
        },
        {
          rotulo: "Etapas filtradas",
          valor: etapas.length ? etapas.map((e) => ETAPA_COMPARATIVO_LABEL[e]).join(", ") : "Todas",
        },
        { rotulo: "Registros exportados", valor: linhas.length },
        { rotulo: "Gerado em", valor: new Date().toLocaleString("pt-BR") },
      ]),
      {
        nome: "Consolidado",
        colunas: COLUNAS,
        linhas,
        subtitulo: `${periodoLabel} · ${linhas.length} registro(s)`,
      },
      ...bancos.map((nome) => {
        const l = filtrados.filter((i) => i._banco === nome).map(paraExport);
        return {
          nome: nome.slice(0, 28),
          colunas: COLUNAS,
          linhas: l,
          subtitulo: `${nome} · ${periodoLabel} · ${l.length} registro(s)`,
        };
      }),
      ...ETAPAS_COMPARATIVO.filter((e) => filtrados.some((i) => i._etapa === e)).map((e) => {
        const l = filtrados.filter((i) => i._etapa === e).map(paraExport);
        return {
          nome: ETAPA_COMPARATIVO_LABEL[e].slice(0, 28),
          colunas: COLUNAS,
          linhas: l,
          subtitulo: `${ETAPA_COMPARATIVO_LABEL[e]} · ${periodoLabel} · ${l.length} registro(s)`,
        };
      }),
    ];
    await baixarXlsx(
      `agilliza-comparativo-consolidado-${periodoLabel.replace("/", "-")}`,
      abas,
      "Comparativo de dados — consolidado",
    );
  }

  function exportarPdf(modo: ModoSaida) {
    void gerarPdfComparativo({
      titulo: "Comparativo de dados — consolidado",
      descricao: `Relatórios dos bancos cruzados com as propostas do sistema · ${periodoLabel}`,
      meta: [
        `Bancos: ${[...new Set(filtrados.map((i) => i._banco))].join(", ") || "—"}`,
        `Etapas: ${etapas.length ? etapas.map((e) => ETAPA_COMPARATIVO_LABEL[e]).join(", ") : "Todas"}`,
        `${filtrados.length} registros`,
      ],
      kpis: RESULTADOS.map((r) => ({
        label: RESULTADO_LABEL[r],
        valor: String(todos.filter((i) => i.resultado === r).length),
      })),
      colunas: [
        { key: "banco", label: "Banco" },
        { key: "etapa", label: "Etapa" },
        { key: "resultado", label: "Resultado" },
        { key: "propostaBanco", label: "Nº banco" },
        { key: "cliente", label: "Cliente" },
        { key: "statusBanco", label: "Status no banco" },
        { key: "valorBanco", label: "Valor banco", format: "brl", footer: "sum" },
        { key: "valorSistema", label: "Valor sistema", format: "brl", footer: "sum" },
      ],
      linhas: filtrados.map(paraExport),
      arquivo: `agilliza-comparativo-consolidado-${periodoLabel.replace("/", "-")}`,
      modo,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Resultado
            </label>
            <MultiSelect
              className="w-56"
              placeholder="Todos os resultados"
              valores={resultados}
              onChange={(v) => onResultadosChange(v as ResultadoConciliacao[])}
              opcoes={RESULTADOS.map((r) => ({
                value: r,
                label: `${RESULTADO_LABEL[r]} (${todos.filter((i) => i.resultado === r).length})`,
              }))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Etapa / status
            </label>
            <MultiSelect
              className="w-60"
              placeholder="Todas as etapas"
              valores={etapas}
              onChange={(v) => setEtapas(v as EtapaComparativo[])}
              opcoes={ETAPAS_COMPARATIVO.map((e) => ({
                value: e,
                label: `${ETAPA_COMPARATIVO_LABEL[e]} (${contagemEtapa.get(e) ?? 0})`,
              }))}
            />
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-60" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar proposta, cliente, banco…"
              className="h-9 w-60 pl-8"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void exportar()}
            disabled={!filtrados.length}
          >
            <Download className="h-3.5 w-3.5" />
            Planilha unificada
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportarPdf("download")}
            disabled={!filtrados.length}
          >
            <FileText className="h-3.5 w-3.5" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportarPdf("print")}
            disabled={!filtrados.length}
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ETAPAS_COMPARATIVO.filter((e) => (contagemEtapa.get(e) ?? 0) > 0).map((e) => {
          const ativo = etapas.includes(e);
          return (
            <button
              key={e}
              type="button"
              onClick={() => setEtapas(ativo ? etapas.filter((x) => x !== e) : [...etapas, e])}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                ativo
                  ? ETAPA_COMPARATIVO_TONE[e]
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {ETAPA_COMPARATIVO_LABEL[e]} ({contagemEtapa.get(e)})
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[130px]">Banco</TableHead>
              <TableHead className="w-[150px]">Etapa</TableHead>
              <TableHead className="w-[140px]">Resultado</TableHead>
              <TableHead>Proposta</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Status banco</TableHead>
              <TableHead>Status sistema</TableHead>
              <TableHead className="text-right">Valor banco</TableHead>
              <TableHead className="text-right">Valor sistema</TableHead>
              <TableHead>Datas</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : filtrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum registro nesta combinação de filtros.
                </TableCell>
              </TableRow>
            ) : (
              filtrados.slice(0, 1000).map((i, idx) => (
                <TableRow key={i.id} className={idx % 2 ? "bg-muted/25" : undefined}>
                  <TableCell>
                    <span className="flex items-center gap-2 text-xs">
                      <BancoLogo nome={i._banco} size="sm" />
                      <span className="truncate">{i._banco}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={ETAPA_COMPARATIVO_TONE[i._etapa]}>
                      {ETAPA_COMPARATIVO_LABEL[i._etapa]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={RESULTADO_TONE[i.resultado]}>
                      {RESULTADO_LABEL[i.resultado]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums">
                    <div>{i.numero_proposta_banco ?? "—"}</div>
                    {i.numero_proposta_sistema && (
                      <div className="text-muted-foreground">sist. {i.numero_proposta_sistema}</div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-sm">
                    <div className="truncate">{i.nome_cliente_banco ?? "—"}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {i.cpf_banco ?? ""}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{i.status_banco ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {i.status_sistema
                      ? (SITUACAO_LABEL[i.status_sistema] ?? i.status_sistema)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {fmtValor(i.valor_financiamento_banco)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {fmtValor(i.valor_financiamento_sistema)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-[11px] text-muted-foreground">
                    <div>Envio {fmtData(i.data_envio_banco)}</div>
                    <div>Emissão {fmtData(i.data_emissao_banco)}</div>
                  </TableCell>
                  <TableCell>
                    {i.proposta_id && (
                      <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                        <Link
                          to="/operacional/propostas/$id"
                          params={{ id: i.proposta_id }}
                          title="Abrir proposta"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {filtrados.length > 1000 && (
        <p className="text-[11px] text-muted-foreground">
          Exibindo os primeiros 1.000 de {filtrados.length} registros — use os filtros ou baixe a
          planilha unificada para ver tudo.
        </p>
      )}
    </div>
  );
}
