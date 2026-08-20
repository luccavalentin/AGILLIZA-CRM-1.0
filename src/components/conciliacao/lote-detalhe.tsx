import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Download, ExternalLink, FileText, Printer, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  RESULTADO_LABEL,
  RESULTADO_TONE,
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

export type FiltroLote = "todos" | ResultadoConciliacao;

/** Detalhamento de um lote: abas por resultado, busca e export XLSX. */
export function LoteDetalhe({
  lote,
  filtro,
  onFiltroChange,
}: {
  lote: ConciliacaoLote;
  filtro?: FiltroLote;
  onFiltroChange?: (v: FiltroLote) => void;
}) {
  const listar = useServerFn(listarItensConciliacao);
  const [abaLocal, setAbaLocal] = useState<FiltroLote>("divergente");
  const aba = filtro ?? abaLocal;
  const setAba = (v: FiltroLote) => (onFiltroChange ? onFiltroChange(v) : setAbaLocal(v));
  const [busca, setBusca] = useState("");

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["conciliacao-itens", lote.id],
    queryFn: () => listar({ data: { loteId: lote.id } }),
  });

  const filtrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return itens.filter((i) => {
      if (aba !== "todos" && i.resultado !== aba) return false;
      if (!b) return true;
      return [
        i.numero_proposta_banco,
        i.numero_proposta_sistema,
        i.nome_cliente_banco,
        i.cpf_banco,
        i.status_banco,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(b));
    });
  }, [itens, aba, busca]);

  function exportar() {
    const linhas = itens.map((i) => ({
      resultado: RESULTADO_LABEL[i.resultado],
      propostaBanco: i.numero_proposta_banco,
      propostaSistema: i.numero_proposta_sistema,
      cliente: i.nome_cliente_banco,
      cpf: i.cpf_banco,
      statusBanco: i.status_banco,
      statusSistema: i.status_sistema
        ? (SITUACAO_LABEL[i.status_sistema] ?? i.status_sistema)
        : null,
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
    }));
    const colunas = [
      { header: "Resultado", key: "resultado", width: 22 },
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
    const por = (r: ResultadoConciliacao) =>
      linhas.filter((l) => l.resultado === RESULTADO_LABEL[r]);
    const periodo = lote.periodo_referencia.slice(0, 7);
    const subtitulo = (nome: string, qtd: number) =>
      `${lote.banco_nome} · ${periodo} · ${nome} · ${qtd} registro(s)`;

    void baixarXlsx(
      `agilliza-comparativo-${lote.banco_nome.toLowerCase()}-${periodo}`,
      [
        abaResumo("Comparativo de dados", [
          { rotulo: "Banco", valor: lote.banco_nome },
          { rotulo: "Mês de referência", valor: periodo },
          { rotulo: "Arquivo importado", valor: lote.nome_arquivo },
          { rotulo: "Processado em", valor: new Date(lote.enviado_em).toLocaleString("pt-BR") },
          { rotulo: "Linhas comparadas", valor: lote.total_linhas },
          { rotulo: "Conferidas", valor: lote.total_conferidas },
          { rotulo: "Divergentes", valor: lote.total_divergentes },
          { rotulo: "Ausentes no sistema", valor: lote.total_ausentes_sistema },
          { rotulo: "Ausentes no banco", valor: lote.total_ausentes_banco },
        ]),
        { nome: "Todos", colunas, linhas, subtitulo: subtitulo("Todos", linhas.length) },
        {
          nome: "Divergentes",
          colunas,
          linhas: por("divergente"),
          subtitulo: subtitulo("Divergentes", por("divergente").length),
        },
        {
          nome: "Ausentes no sistema",
          colunas,
          linhas: por("ausente_no_sistema"),
          subtitulo: subtitulo("Ausentes no sistema", por("ausente_no_sistema").length),
        },
        {
          nome: "Ausentes no banco",
          colunas,
          linhas: por("ausente_no_banco"),
          subtitulo: subtitulo("Ausentes no banco", por("ausente_no_banco").length),
        },
        {
          nome: "Conferidas",
          colunas,
          linhas: por("conferido"),
          subtitulo: subtitulo("Conferidas", por("conferido").length),
        },
      ],
      `Comparativo de dados — ${lote.banco_nome}`,
    );
  }

  function exportarPdf(modo: ModoSaida) {
    const alvo = filtrados.length ? filtrados : itens;
    void gerarPdfComparativo({
      titulo: `Comparativo de dados — ${lote.banco_nome}`,
      descricao: `Relatório do banco cruzado com as propostas do sistema · ${lote.periodo_referencia.slice(0, 7)}`,
      meta: [
        `Arquivo: ${lote.nome_arquivo}`,
        `Processado em ${new Date(lote.enviado_em).toLocaleString("pt-BR")}`,
        `Visão: ${aba === "todos" ? "Todos" : RESULTADO_LABEL[aba]}`,
        `${alvo.length} registros`,
      ],
      kpis: [
        { label: "Linhas comparadas", valor: String(lote.total_linhas) },
        { label: "Conferidas", valor: String(lote.total_conferidas) },
        { label: "Divergentes", valor: String(lote.total_divergentes) },
        { label: "Ausentes no sistema", valor: String(lote.total_ausentes_sistema) },
        { label: "Ausentes no banco", valor: String(lote.total_ausentes_banco) },
      ],
      colunas: [
        { key: "resultado", label: "Resultado" },
        { key: "propostaBanco", label: "Nº banco" },
        { key: "propostaSistema", label: "Nº sistema" },
        { key: "cliente", label: "Cliente" },
        { key: "cpf", label: "CPF" },
        { key: "statusBanco", label: "Status no banco" },
        { key: "statusSistema", label: "Status no sistema" },
        { key: "valorBanco", label: "Valor banco", format: "brl", footer: "sum" },
        { key: "valorSistema", label: "Valor sistema", format: "brl", footer: "sum" },
        { key: "divergencia", label: "Divergência" },
      ],
      linhas: alvo.map((i) => ({
        resultado: RESULTADO_LABEL[i.resultado],
        propostaBanco: i.numero_proposta_banco,
        propostaSistema: i.numero_proposta_sistema,
        cliente: i.nome_cliente_banco,
        cpf: i.cpf_banco,
        statusBanco: i.status_banco,
        statusSistema: i.status_sistema
          ? (SITUACAO_LABEL[i.status_sistema] ?? i.status_sistema)
          : null,
        valorBanco: i.valor_financiamento_banco,
        valorSistema: i.valor_financiamento_sistema,
        divergencia: i.detalhe_divergencia,
      })),
      arquivo: `agilliza-comparativo-${lote.banco_nome.toLowerCase()}-${lote.periodo_referencia.slice(0, 7)}`,
      modo,
    });
  }

  const contagens: Record<string, number> = {
    todos: lote.total_linhas,
    conferido: lote.total_conferidas,
    divergente: lote.total_divergentes,
    ausente_no_sistema: lote.total_ausentes_sistema,
    ausente_no_banco: lote.total_ausentes_banco,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
          <TabsList>
            <TabsTrigger value="todos">Todos ({contagens.todos})</TabsTrigger>
            <TabsTrigger value="divergente">Divergentes ({contagens.divergente})</TabsTrigger>
            <TabsTrigger value="ausente_no_sistema">
              Ausentes no sistema ({contagens.ausente_no_sistema})
            </TabsTrigger>
            <TabsTrigger value="ausente_no_banco">
              Ausentes no banco ({contagens.ausente_no_banco})
            </TabsTrigger>
            <TabsTrigger value="conferido">Conferidas ({contagens.conferido})</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-60" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar proposta, cliente..."
              className="h-9 w-56 pl-8"
            />
          </div>
          <Button variant="outline" size="sm" onClick={exportar} disabled={!itens.length}>
            <Download className="h-3.5 w-3.5" />
            Planilha consolidada
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportarPdf("download")}
            disabled={!itens.length}
          >
            <FileText className="h-3.5 w-3.5" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportarPdf("print")}
            disabled={!itens.length}
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">Resultado</TableHead>
              <TableHead>Proposta</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Status banco</TableHead>
              <TableHead>Status sistema</TableHead>
              <TableHead className="text-right">Valor banco</TableHead>
              <TableHead className="text-right">Valor sistema</TableHead>
              <TableHead>Datas</TableHead>
              <TableHead>Divergência</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : filtrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum registro nesta visão.
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((i, idx) => (
                <TableRow key={i.id} className={idx % 2 ? "bg-muted/25" : undefined}>
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
                    {i.data_assinatura_banco && (
                      <div>Assin. {fmtData(i.data_assinatura_banco)}</div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[280px] text-xs text-muted-foreground">
                    {i.detalhe_divergencia ?? "—"}
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
    </div>
  );
}
