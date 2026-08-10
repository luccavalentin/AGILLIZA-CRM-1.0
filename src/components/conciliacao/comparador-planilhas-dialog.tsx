import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
  Layers,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SITUACAO_LABEL } from "@/lib/conciliacao/bancos";
import { cruzarComSistema } from "@/lib/conciliacao/conciliacao.functions";
import {
  aplicarSistema,
  chavesParaSistema,
  cruzarPlanilhas,
  etapaDoItem,
  ETAPAS_COMPARATIVO,
  ETAPA_COMPARATIVO_LABEL,
  ETAPA_COMPARATIVO_TONE,
  type EtapaComparativo,
  lerPlanilhaGenerica,
  RESULTADO_COMPARATIVO_LABEL,
  RESULTADO_COMPARATIVO_TONE,
  type ItemComparativo,
  type LadoPlanilha,
  type LinhaPlanilha,
  type ResultadoComparativo,
} from "@/lib/conciliacao/planilhas";
import { abaResumo } from "@/lib/conciliacao/xlsx-tipos";
import { baixarXlsx, gerarPdfComparativo, type ModoSaida } from "@/lib/conciliacao/exportar-lazy";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtValor = (v: number | null | undefined) => (v == null ? "—" : brl.format(Number(v)));

interface Lado {
  arquivos: { nome: string; linhas: number }[];
  linhas: LinhaPlanilha[];
}

const VAZIO: Lado = { arquivos: [], linhas: [] };

function Dropzone({
  titulo,
  descricao,
  lado,
  estado,
  onAdicionar,
  onLimpar,
}: {
  titulo: string;
  descricao: string;
  lado: LadoPlanilha;
  estado: Lado;
  onAdicionar: (files: FileList | null) => void;
  onLimpar: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium">{titulo}</div>
          <p className="text-xs text-muted-foreground">{descricao}</p>
        </div>
        {estado.arquivos.length > 0 && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onLimpar}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <button
        type="button"
        onClick={() => ref.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onAdicionar(e.dataTransfer.files);
        }}
        className="flex flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center transition hover:bg-muted/40"
      >
        <Upload className="h-4 w-4 opacity-60" />
        <span className="text-xs text-muted-foreground">
          Arraste várias planilhas ou clique para selecionar
        </span>
      </button>
      <input
        ref={ref}
        type="file"
        multiple
        accept=".xlsx,.xls,.csv,.txt,.tsv"
        className="hidden"
        onChange={(e) => {
          onAdicionar(e.target.files);
          e.target.value = "";
        }}
        data-lado={lado}
      />

      {estado.arquivos.length > 0 && (
        <ul className="space-y-1">
          {estado.arquivos.map((a) => (
            <li
              key={a.nome}
              className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-xs"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 opacity-60" />
                <span className="truncate">{a.nome}</span>
              </span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {a.linhas} linhas
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Comparativo entre múltiplas planilhas próprias × relatórios de bancos. */
export function ComparadorPlanilhasDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const cruzarSistema = useServerFn(cruzarComSistema);
  const [controle, setControle] = useState<Lado>(VAZIO);
  const [banco, setBanco] = useState<Lado>(VAZIO);
  const [itens, setItens] = useState<ItemComparativo[] | null>(null);
  const [aba, setAba] = useState<"todos" | ResultadoComparativo>("todos");
  const [busca, setBusca] = useState("");
  const [etapas, setEtapas] = useState<EtapaComparativo[]>([]);
  const [ocupado, setOcupado] = useState(false);

  async function adicionar(lado: LadoPlanilha, files: FileList | null) {
    if (!files?.length) return;
    setOcupado(true);
    try {
      const novos: { nome: string; linhas: number }[] = [];
      const linhas: LinhaPlanilha[] = [];
      for (const f of Array.from(files)) {
        const lidas = await lerPlanilhaGenerica(f, lado);
        if (!lidas.length) {
          toast.warning(`Nenhuma linha reconhecida em ${f.name}.`);
          continue;
        }
        novos.push({ nome: f.name, linhas: lidas.length });
        linhas.push(...lidas);
      }
      const set = lado === "controle" ? setControle : setBanco;
      set((prev) => ({
        arquivos: [...prev.arquivos.filter((a) => !novos.some((n) => n.nome === a.nome)), ...novos],
        linhas: [...prev.linhas.filter((l) => !novos.some((n) => n.nome === l.arquivo)), ...linhas],
      }));
      setItens(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ler as planilhas.");
    } finally {
      setOcupado(false);
    }
  }

  async function comparar(comSistema: boolean) {
    if (!controle.linhas.length && !banco.linhas.length) {
      toast.error("Envie pelo menos uma planilha de cada lado.");
      return;
    }
    setOcupado(true);
    try {
      let resultado = cruzarPlanilhas(controle.linhas, banco.linhas);
      if (comSistema) {
        const encontrados = await cruzarSistema({
          data: { chaves: chavesParaSistema(resultado) },
        });
        resultado = aplicarSistema(resultado, encontrados as never);
      }
      setItens(resultado);
      setAba("todos");
      setEtapas([]);
      toast.success(
        comSistema
          ? "Planilhas cruzadas entre si e contra o sistema."
          : "Planilhas cruzadas entre si.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao cruzar os dados.");
    } finally {
      setOcupado(false);
    }
  }

  const filtrados = useMemo(() => {
    if (!itens) return [];
    const b = busca.trim().toLowerCase();
    return itens.filter((i) => {
      if (aba !== "todos" && i.resultado !== aba) return false;
      if (etapas.length && !etapas.includes(etapaDoItem(i))) return false;
      if (!b) return true;
      return [i.numeroProposta, i.nome, i.cpf, i.sistema?.numero_proposta]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(b));
    });
  }, [itens, aba, busca, etapas]);

  const contagemEtapas = useMemo(() => {
    const base = new Map<EtapaComparativo, number>();
    for (const i of itens ?? []) {
      const e = etapaDoItem(i);
      base.set(e, (base.get(e) ?? 0) + 1);
    }
    return base;
  }, [itens]);

  const contagens = useMemo(() => {
    const base: Record<string, number> = {
      todos: itens?.length ?? 0,
      igual: 0,
      divergente: 0,
      so_controle: 0,
      so_banco: 0,
    };
    for (const i of itens ?? []) base[i.resultado] = (base[i.resultado] ?? 0) + 1;
    return base;
  }, [itens]);

  function exportar() {
    if (!itens?.length) return;
    const linhas = itens.map((i) => ({
      resultado: RESULTADO_COMPARATIVO_LABEL[i.resultado],
      etapa: ETAPA_COMPARATIVO_LABEL[etapaDoItem(i)],
      proposta: i.numeroProposta,
      cliente: i.nome,
      cpf: i.cpf,
      arquivoControle: i.controle?.arquivo,
      statusControle: i.controle?.status,
      valorControle: i.controle?.valor,
      arquivoBanco: i.banco?.arquivo,
      statusBanco: i.banco?.status,
      valorBanco: i.banco?.valor,
      sistemaProposta: i.sistema?.numero_proposta,
      sistemaStatus: i.sistema?.situacao
        ? (SITUACAO_LABEL[i.sistema.situacao] ?? i.sistema.situacao)
        : null,
      sistemaValor: i.sistema?.valor,
      divergencias: i.detalhes.join(" · "),
    }));
    const colunas = [
      { header: "Resultado", key: "resultado", width: 24 },
      { header: "Etapa", key: "etapa", width: 22 },
      { header: "Nº proposta", key: "proposta", width: 18 },
      { header: "Cliente", key: "cliente", width: 32 },
      { header: "CPF", key: "cpf", width: 16 },
      { header: "Arquivo (meu controle)", key: "arquivoControle", width: 28 },
      { header: "Status (meu controle)", key: "statusControle", width: 26 },
      { header: "Valor (meu controle)", key: "valorControle", tipo: "brl" as const, width: 18 },
      { header: "Arquivo (banco)", key: "arquivoBanco", width: 28 },
      { header: "Status (banco)", key: "statusBanco", width: 26 },
      { header: "Valor (banco)", key: "valorBanco", tipo: "brl" as const, width: 18 },
      { header: "Nº proposta (sistema)", key: "sistemaProposta", width: 20 },
      { header: "Status (sistema)", key: "sistemaStatus", width: 24 },
      { header: "Valor (sistema)", key: "sistemaValor", tipo: "brl" as const, width: 18 },
      { header: "Divergências", key: "divergencias", width: 52 },
    ];
    const porResultado = (r: ResultadoComparativo) =>
      linhas.filter((l) => l.resultado === RESULTADO_COMPARATIVO_LABEL[r]);

    // Uma aba por banco/relatório de origem, para leitura organizada.
    const bancosDetectados = Array.from(
      new Set(
        linhas
          .map((l) => (l.arquivoBanco ? String(l.arquivoBanco) : ""))
          .filter((v): v is string => !!v),
      ),
    ).slice(0, 12);

    void baixarXlsx(
      `agilliza-comparativo-planilhas-${new Date().toISOString().slice(0, 10)}`,
      [
        abaResumo("Comparativo de planilhas", [
          { rotulo: "Gerado em", valor: new Date().toLocaleString("pt-BR") },
          { rotulo: "Planilhas do meu controle", valor: controle.arquivos.length },
          { rotulo: "Planilhas de bancos", valor: banco.arquivos.length },
          { rotulo: "Registros comparados", valor: itens.length },
          { rotulo: "Coincidentes", valor: contagens.igual ?? 0 },
          { rotulo: "Divergentes", valor: contagens.divergente ?? 0 },
          { rotulo: "Só no meu controle", valor: contagens.so_controle ?? 0 },
          { rotulo: "Só no relatório do banco", valor: contagens.so_banco ?? 0 },
        ]),
        { nome: "Todos", colunas, linhas, subtitulo: `${linhas.length} registro(s)` },
        { nome: "Divergentes", colunas, linhas: porResultado("divergente") },
        { nome: "Só meu controle", colunas, linhas: porResultado("so_controle") },
        { nome: "Só banco", colunas, linhas: porResultado("so_banco") },
        { nome: "Coincidentes", colunas, linhas: porResultado("igual") },
        ...bancosDetectados.map((arquivo) => {
          const ls = linhas.filter((l) => l.arquivoBanco === arquivo);
          return {
            nome: arquivo.replace(/\.[a-z]+$/i, "").slice(0, 28),
            colunas,
            linhas: ls,
            subtitulo: `Origem: ${arquivo} · ${ls.length} registro(s)`,
          };
        }),
      ],
      "Comparativo de planilhas e dados",
    );
  }

  function exportarPdf(modo: ModoSaida) {
    if (!itens?.length) return;
    const alvo = filtrados.length ? filtrados : itens;
    void gerarPdfComparativo({
      titulo: "Comparativo de planilhas e dados",
      descricao:
        "Cruzamento entre as planilhas do meu controle, os relatórios dos bancos e o sistema",
      meta: [
        `${controle.arquivos.length} planilha(s) do meu controle`,
        `${banco.arquivos.length} relatório(s) de banco`,
        `Visão: ${aba === "todos" ? "Todos" : RESULTADO_COMPARATIVO_LABEL[aba]}`,
        `Etapas: ${etapas.length ? etapas.map((e) => ETAPA_COMPARATIVO_LABEL[e]).join(", ") : "Todas"}`,
        `${alvo.length} registros`,
      ],
      kpis: [
        { label: "Registros comparados", valor: String(contagens.todos ?? 0) },
        { label: "Coincidentes", valor: String(contagens.igual ?? 0) },
        { label: "Divergentes", valor: String(contagens.divergente ?? 0) },
        { label: "Só meu controle", valor: String(contagens.so_controle ?? 0) },
        { label: "Só banco", valor: String(contagens.so_banco ?? 0) },
      ],
      colunas: [
        { key: "resultado", label: "Resultado" },
        { key: "etapa", label: "Etapa" },
        { key: "proposta", label: "Nº proposta" },
        { key: "cliente", label: "Cliente" },
        { key: "cpf", label: "CPF" },
        { key: "status", label: "Status" },
        { key: "valorControle", label: "Valor (controle)", format: "brl", footer: "sum" },
        { key: "valorBanco", label: "Valor (banco)", format: "brl", footer: "sum" },
        { key: "statusSistema", label: "Status (sistema)" },
        { key: "divergencias", label: "Divergências" },
      ],
      linhas: alvo.map((i) => ({
        resultado: RESULTADO_COMPARATIVO_LABEL[i.resultado],
        etapa: ETAPA_COMPARATIVO_LABEL[etapaDoItem(i)],
        proposta: i.numeroProposta,
        cliente: i.nome,
        cpf: i.cpf,
        status:
          i.controle?.status === i.banco?.status
            ? (i.banco?.status ?? i.controle?.status ?? null)
            : [
                i.controle?.status ? `Controle: ${i.controle.status}` : "",
                i.banco?.status ? `Banco: ${i.banco.status}` : "",
              ]
                .filter(Boolean)
                .join(" / ") || null,
        valorControle: i.controle?.valor ?? null,
        valorBanco: i.banco?.valor ?? null,
        statusSistema: i.sistema?.situacao
          ? (SITUACAO_LABEL[i.sistema.situacao] ?? i.sistema.situacao)
          : null,
        divergencias: i.detalhes.join(" · ") || null,
      })),
      arquivo: `agilliza-comparativo-planilhas-${new Date().toISOString().slice(0, 10)}`,
      modo,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div className="min-w-[260px] flex-1">
              <DialogTitle>Comparativo de planilhas e dados</DialogTitle>
              <DialogDescription>
                Envie de um lado as suas planilhas de controle e do outro os relatórios dos bancos.
                O sistema cruza as planilhas entre si e, se quiser, também contra as propostas
                cadastradas.
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void comparar(true)}
              disabled={ocupado}
              className="shrink-0"
            >
              {ocupado ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Layers className="h-4 w-4" />
              )}
              Cruzar com o sistema
            </Button>
          </div>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-2">
          <Dropzone
            titulo="Meu controle"
            descricao="Suas planilhas internas (XLSX, XLS, CSV ou TXT tabulado)."
            lado="controle"
            estado={controle}
            onAdicionar={(f) => void adicionar("controle", f)}
            onLimpar={() => {
              setControle(VAZIO);
              setItens(null);
            }}
          />
          <Dropzone
            titulo="Relatórios dos bancos"
            descricao="Relatórios oficiais recebidos dos bancos."
            lado="banco"
            estado={banco}
            onAdicionar={(f) => void adicionar("banco", f)}
            onLimpar={() => {
              setBanco(VAZIO);
              setItens(null);
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            onClick={() => void comparar(false)}
            disabled={ocupado}
            className="min-w-[220px] shadow-sm"
          >
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" />}
            Cruzar planilhas
          </Button>
          <span className="text-xs text-muted-foreground">
            {controle.linhas.length} linhas no controle · {banco.linhas.length} linhas dos bancos
          </span>
        </div>

        {itens && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/20 p-2">
              <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Etapa
              </span>
              <button
                type="button"
                onClick={() => setEtapas([])}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${
                  etapas.length === 0
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted"
                }`}
              >
                Todas ({itens.length})
              </button>
              {ETAPAS_COMPARATIVO.filter((e) => (contagemEtapas.get(e) ?? 0) > 0).map((e) => {
                const ativo = etapas.includes(e);
                return (
                  <button
                    key={e}
                    type="button"
                    onClick={() =>
                      setEtapas((prev) =>
                        prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e],
                      )
                    }
                    className={`rounded-full border px-2.5 py-1 text-xs transition ${
                      ativo
                        ? "border-primary bg-primary text-primary-foreground"
                        : `${ETAPA_COMPARATIVO_TONE[e]} hover:brightness-105`
                    }`}
                  >
                    {ETAPA_COMPARATIVO_LABEL[e]} ({contagemEtapas.get(e) ?? 0})
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
                <TabsList>
                  <TabsTrigger value="todos">Todos ({contagens.todos})</TabsTrigger>
                  <TabsTrigger value="divergente">Divergentes ({contagens.divergente})</TabsTrigger>
                  <TabsTrigger value="so_controle">
                    Só meu controle ({contagens.so_controle})
                  </TabsTrigger>
                  <TabsTrigger value="so_banco">Só banco ({contagens.so_banco})</TabsTrigger>
                  <TabsTrigger value="igual">Coincidem ({contagens.igual})</TabsTrigger>
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
                <Button variant="outline" size="sm" onClick={exportar}>
                  <Download className="h-3.5 w-3.5" />
                  Planilha consolidada
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportarPdf("download")}>
                  <FileText className="h-3.5 w-3.5" />
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportarPdf("print")}>
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir
                </Button>
              </div>
            </div>

            <div className="max-h-[420px] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[170px]">Resultado</TableHead>
                    <TableHead className="w-[150px]">Etapa</TableHead>
                    <TableHead>Proposta</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor controle</TableHead>
                    <TableHead className="text-right">Valor banco</TableHead>
                    <TableHead>Sistema</TableHead>
                    <TableHead>Divergências</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        Nenhum registro nesta visão.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtrados.slice(0, 500).map((i, idx) => (
                      <TableRow
                        key={`${i.chave}-${idx}`}
                        className={idx % 2 ? "bg-muted/25" : undefined}
                      >
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={RESULTADO_COMPARATIVO_TONE[i.resultado]}
                          >
                            {RESULTADO_COMPARATIVO_LABEL[i.resultado]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={ETAPA_COMPARATIVO_TONE[etapaDoItem(i)]}
                          >
                            {ETAPA_COMPARATIVO_LABEL[etapaDoItem(i)]}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs tabular-nums">
                          {i.numeroProposta ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">
                          <div className="truncate">{i.nome ?? "—"}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {i.cpf ?? ""}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {i.controle?.status === i.banco?.status ? (
                            <div>{i.banco?.status ?? i.controle?.status ?? "—"}</div>
                          ) : (
                            <div className="space-y-1">
                              {i.controle?.status && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] uppercase text-muted-foreground">
                                    Controle
                                  </span>
                                  <span>{i.controle.status}</span>
                                </div>
                              )}
                              {i.banco?.status && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] uppercase text-muted-foreground">
                                    Banco
                                  </span>
                                  <span>{i.banco.status}</span>
                                </div>
                              )}
                              {!i.controle?.status && !i.banco?.status && "—"}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {fmtValor(i.controle?.valor ?? null)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {fmtValor(i.banco?.valor ?? null)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {i.sistema ? (
                            <>
                              <div>
                                {i.sistema.situacao
                                  ? (SITUACAO_LABEL[i.sistema.situacao] ?? i.sistema.situacao)
                                  : "—"}
                              </div>
                              <div className="font-mono text-muted-foreground">
                                {fmtValor(i.sistema.valor)}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">Não localizada</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[260px] text-[11px] text-muted-foreground">
                          {i.detalhes.length ? i.detalhes.join(" · ") : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {filtrados.length > 500 && (
              <p className="text-[11px] text-muted-foreground">
                Exibindo as 500 primeiras linhas — a planilha consolidada traz tudo.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
