/**
 * Relatórios personalizados (C47): construtor simples sobre o mesmo cubo do relatório gerencial —
 * escolha as métricas, a dimensão e o filtro global; salve com um nome (só seu) e abra depois com
 * um clique, já com o filtro de quando salvou. Exporta em CSV, Excel e PDF.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Bookmark, Check, Columns3, Save, SlidersHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { Estado3D } from "@/components/ui/estado-3d";
import { ReportChartView } from "@/components/reports/report-chart";
import { ExportarFinanceiro } from "@/components/financeiro/exportar-financeiro";
import {
  excluirRelatorio,
  listarRelatoriosSalvos,
  salvarRelatorio,
  type RelatorioSalvo,
} from "@/lib/relatorios/ecossistema.functions";
import {
  agrupar,
  combinarBlocos,
  DIMENSOES,
  METRICAS,
  ordenarPor,
  rotuloMes,
  valorMetrica,
  type Dimensao,
  type Metrica,
} from "@/lib/relatorios/ecossistema";
import type { ReportColumn, ReportRow } from "@/lib/relatorios/shared";
import {
  Avisos,
  BarraFiltros,
  CarregandoOuErro,
  Cartao,
  Contexto,
  formatarMetrica,
  NavegacaoRelatorios,
  searchDoFiltro,
  Tabela,
  useFiltrosRelatorio,
  useRelatorioEcossistema,
} from "./base";

const METRICAS_PADRAO: Metrica[] = ["propostas", "contratos", "valor_contratado", "conversao"];

export function RelatoriosPersonalizados() {
  const uso = useFiltrosRelatorio();
  const { filtros, intervalo } = uso;
  const router = useRouter();
  const qc = useQueryClient();
  const [metricas, setMetricas] = useState<Metrica[]>(METRICAS_PADRAO);
  const [dimensao, setDimensao] = useState<Dimensao>("conta");
  const [nome, setNome] = useState("");
  const [abertoId, setAbertoId] = useState<string | null>(null);

  const q = useRelatorioEcossistema(filtros);
  const listarFn = useServerFn(listarRelatoriosSalvos);
  const salvos = useQuery({ queryKey: ["relatorios-eco-salvos"], queryFn: () => listarFn() });
  const salvarFn = useServerFn(salvarRelatorio);
  const excluirFn = useServerFn(excluirRelatorio);

  const salvar = useMutation({
    mutationFn: () =>
      salvarFn({
        data: { id: abertoId ?? undefined, nome, metricas, dimensao, filtros: searchDoFiltro(filtros) },
      }),
    onSuccess: (r) => {
      setAbertoId(r.id);
      toast.success("Relatório salvo.");
      void qc.invalidateQueries({ queryKey: ["relatorios-eco-salvos"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const excluir = useMutation({
    mutationFn: (id: string) => excluirFn({ data: { id } }),
    onSuccess: (_r, id) => {
      if (id === abertoId) setAbertoId(null);
      toast.success("Relatório excluído.");
      void qc.invalidateQueries({ queryKey: ["relatorios-eco-salvos"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const abrir = (r: RelatorioSalvo) => {
    setAbertoId(r.id);
    setNome(r.nome);
    setMetricas(r.metricas.filter((m): m is Metrica => METRICAS.some((x) => x.id === m)));
    setDimensao((DIMENSOES.some((d) => d.id === r.dimensao) ? r.dimensao : "conta") as Dimensao);
    void router.navigate({ to: "/relatorios/personalizados", search: r.filtros as never, replace: true });
  };
  const novo = () => {
    setAbertoId(null);
    setNome("");
    setMetricas(METRICAS_PADRAO);
    setDimensao("conta");
  };

  const linhas = useMemo(() => {
    if (!q.data) return [];
    const fatos = combinarBlocos(q.data.agilliza, q.data.tech).fatos;
    const grupos = agrupar(fatos, dimensao);
    if (dimensao === "mes") return grupos.sort((a, b) => a.chave.localeCompare(b.chave));
    return ordenarPor(grupos, metricas[0] ?? "propostas");
  }, [q.data, dimensao, metricas]);

  const alternar = (m: Metrica) =>
    setMetricas((atual) => (atual.includes(m) ? atual.filter((x) => x !== m) : atual.length >= 8 ? atual : [...atual, m]));

  const rotuloDim = DIMENSOES.find((d) => d.id === dimensao)!.rotulo;
  const formatoExport = (m: Metrica): ReportColumn["format"] => {
    const f = METRICAS.find((x) => x.id === m)!.formato;
    return f === "brl" ? "brl" : f === "pct" ? "pct" : f === "int" ? "int" : "text";
  };
  const colunas: ReportColumn[] = [
    { key: "dim", label: rotuloDim },
    ...metricas.map((m) => ({
      key: m,
      label: METRICAS.find((x) => x.id === m)!.rotulo,
      align: "right" as const,
      format: formatoExport(m),
      footer: METRICAS.find((x) => x.id === m)!.formato === "brl" || METRICAS.find((x) => x.id === m)!.formato === "int" ? ("sum" as const) : ("none" as const),
    })),
  ];
  const linhasExport: ReportRow[] = linhas.map((l) => ({
    dim: dimensao === "mes" ? rotuloMes(l.chave) : l.rotulo,
    ...Object.fromEntries(metricas.map((m) => [m, valorMetrica(l.totais, m) ?? 0])),
  }));
  const principal = metricas[0];

  return (
    <div className="pg-painel mx-auto w-full max-w-[1400px] space-y-5 px-3 py-5 sm:px-6">
      <PageHeader
        secao="Relatórios gerenciais"
        titulo="Relatórios personalizados"
        descricao="Monte o seu relatório: escolha as métricas, como agrupar e o filtro. Salve para abrir de novo com um clique."
        icone={<SlidersHorizontal />}
        tom="neutro"
        acoes={
          <ExportarFinanceiro
            titulo={nome || "Relatório personalizado"}
            descricao={`${metricas.length} métrica(s) por ${rotuloDim.toLowerCase()}.`}
            meta={[uso.rotulo, `${intervalo.de} a ${intervalo.ate}`]}
            columns={colunas}
            rows={linhasExport}
          />
        }
      />
      <NavegacaoRelatorios />

      <div className="pg-grade-2">
        <Cartao className="pg-col-8" titulo="Monte o relatório" subtitulo="Até 8 métricas; a primeira ordena e vai para o gráfico" icone={Columns3}>
          <div className="space-y-4">
            <div data-tour="relatorios-personalizados-metricas" className="flex flex-wrap gap-2" role="group" aria-label="Métricas">
              {METRICAS.map((m) => {
                const ativo = metricas.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => alternar(m.id)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors",
                      ativo
                        ? "border-primary/30 bg-primary/5 text-primary"
                        : "border-[var(--pg-borda-forte,#e4e7ec)] text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {ativo && <Check className="size-3.5" aria-hidden />}
                    {m.rotulo}
                  </button>
                );
              })}
            </div>
            <div data-tour="relatorios-personalizados-salvar" className="grid gap-3 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)_auto] sm:items-end">
              <label className="pg-filtro">
                <span className="pg-filtro-rotulo">Agrupar por</span>
                <Select value={dimensao} onValueChange={(v) => setDimensao(v as Dimensao)}>
                  <SelectTrigger className="h-9 rounded-[10px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIMENSOES.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="pg-filtro">
                <span className="pg-filtro-rotulo">Nome para salvar</span>
                <Input value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Contratos por assinante no mês" className="h-9" />
              </label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  className="h-9 gap-1.5"
                  disabled={salvar.isPending || nome.trim().length < 2 || metricas.length === 0}
                  onClick={() => salvar.mutate()}
                >
                  <Save className="size-4" aria-hidden />
                  {abertoId ? "Atualizar" : "Salvar"}
                </Button>
                {abertoId && (
                  <Button type="button" variant="outline" className="h-9" onClick={novo}>
                    Novo
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Cartao>
        <Cartao className="pg-col-4" titulo="Meus relatórios" subtitulo="Salvos por você" icone={Bookmark} tom="alerta">
          {salvos.isLoading ? (
            <Estado3D compacto tipo="carregando" titulo="Carregando" />
          ) : (salvos.data ?? []).length === 0 ? (
            <Estado3D compacto icone={Bookmark} titulo="Nenhum relatório salvo" descricao="Monte ao lado e salve com um nome." />
          ) : (
            <ul className="space-y-1">
              {(salvos.data ?? []).map((r) => (
                <li key={r.id} className={cn("flex items-center gap-2 rounded-xl px-2 py-1.5", r.id === abertoId && "bg-primary/5")}>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => abrir(r)}>
                    <span className="block truncate text-[13px] font-medium text-foreground">{r.nome}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {r.metricas.length} métrica(s) · por {(DIMENSOES.find((d) => d.id === r.dimensao)?.rotulo ?? r.dimensao).toLowerCase()}
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-red-600"
                    aria-label={`Excluir ${r.nome}`}
                    onClick={() => excluir.mutate(r.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>

      <BarraFiltros uso={uso} />
      <Contexto uso={uso} />
      <Avisos avisos={q.data?.avisos ?? []} />
      <CarregandoOuErro carregando={q.isLoading} erro={q.error} tentar={() => void q.refetch()} />

      {q.data && metricas.length === 0 && (
        <Estado3D icone={Columns3} titulo="Escolha ao menos uma métrica" descricao="Toque nas métricas acima para montar o relatório." />
      )}
      {q.data && metricas.length > 0 && (
        <div data-tour="relatorios-personalizados-resultado" className="pg-grade-2">
          {principal && (
            <Cartao className="pg-col-4 lg:order-2" titulo={METRICAS.find((m) => m.id === principal)!.rotulo} subtitulo={`Por ${rotuloDim.toLowerCase()}`} icone={BarChart3}>
              <div className="h-72">
                <ReportChartView
                  chart={{
                    titulo: "Personalizado",
                    tipo: dimensao === "mes" ? "line" : "barh",
                    moeda: METRICAS.find((m) => m.id === principal)!.formato === "brl",
                    dados: linhas.slice(0, 12).map((l) => ({
                      label: dimensao === "mes" ? rotuloMes(l.chave) : l.rotulo,
                      valor: valorMetrica(l.totais, principal) ?? 0,
                    })),
                  }}
                />
              </div>
            </Cartao>
          )}
          <Cartao className="pg-col-8 lg:order-1" titulo={nome || "Resultado"} subtitulo={`${linhas.length} linha(s)`} icone={Columns3}>
            <Tabela
              linhas={linhas}
              chave={(l, i) => l.chave || `sem-${i}`}
              vazio="Sem dados no recorte"
              colunas={[
                {
                  chave: "dim",
                  rotulo: rotuloDim,
                  valor: (l) => (
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">{dimensao === "mes" ? rotuloMes(l.chave) : l.rotulo}</span>
                      {l.detalhe && dimensao !== "mes" && <span className="block truncate text-[11px] text-muted-foreground">{l.detalhe}</span>}
                    </span>
                  ),
                },
                ...metricas.map((m) => ({
                  chave: m,
                  rotulo: METRICAS.find((x) => x.id === m)!.rotulo,
                  alinhar: "direita" as const,
                  valor: (l: (typeof linhas)[number]) => formatarMetrica(l.totais, m),
                })),
              ]}
            />
          </Cartao>
        </div>
      )}
    </div>
  );
}
