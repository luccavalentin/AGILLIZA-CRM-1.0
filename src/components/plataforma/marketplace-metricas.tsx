/**
 * Aba "Métricas" do marketplace (antiga `/gestao/especialistas/metricas`).
 *
 * O mesmo painel que o anunciante vê no Corretor, sobre a carteira inteira, uma profissão
 * ou um anunciante só — com a mesma régua:
 *   · impressão — o anúncio ficou visível na grade;
 *   · clique — qualquer botão de contato, inclusive o WhatsApp;
 *   · conversão — o clique no WhatsApp;
 *   · CTR — cliques ÷ impressões; taxa de conversão — conversões ÷ cliques.
 * Taxa sem base não é zero, é travessão.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Inbox, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { hojeISO } from "@/lib/financeiro/format";
import {
  lerMetricasMarketplace,
  type CorteMetricas,
  type LinhaAnunciante,
  type LinhaCanal,
  type PontoSerie,
} from "@/lib/plataforma/marketplace.functions";

type Predefinido = "7d" | "30d" | "90d" | "mes" | "mes_passado" | "ano" | "12m";

const PREDEFINIDOS: { id: Predefinido; rotulo: string }[] = [
  { id: "7d", rotulo: "7 dias" },
  { id: "30d", rotulo: "30 dias" },
  { id: "90d", rotulo: "90 dias" },
  { id: "mes", rotulo: "Este mês" },
  { id: "mes_passado", rotulo: "Mês passado" },
  { id: "ano", rotulo: "Este ano" },
  { id: "12m", rotulo: "12 meses" },
];

const CORTES: { id: CorteMetricas; rotulo: string }[] = [
  { id: "dia", rotulo: "Dia" },
  { id: "semana", rotulo: "Semana" },
  { id: "mes", rotulo: "Mês" },
  { id: "ano", rotulo: "Ano" },
];

const CANAL: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  site: "Site",
  telefone: "Telefone",
  email: "E-mail",
  nao_informado: "Sem canal registrado",
};
/** Ordem fixa dos canais: a posição segue o canal, não o ranking. */
const ORDEM_CANAIS = ["whatsapp", "instagram", "facebook", "site"];

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const TODAS = "__todas__";

// Mesmas cores dos outros gráficos do Agilliza (tokens do tema, em HEX).
const EIXO = "var(--muted-foreground)";
const GRADE = "color-mix(in oklab, var(--border) 70%, transparent)";
const DICA = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  padding: "8px 12px",
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const diasEntre = (de: string, ate: string) =>
  Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);

/** Hoje no fuso de Brasília, como data UTC (para somar dias sem horário de verão). */
function hoje(): Date {
  const [a, m, d] = hojeISO().split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

function intervaloDe(p: Predefinido): { de: string; ate: string } {
  const h = hoje();
  const menos = (n: number) => iso(new Date(h.getTime() - n * 86_400_000));
  const a = h.getUTCFullYear();
  const m = h.getUTCMonth();
  switch (p) {
    case "7d":
      return { de: menos(6), ate: iso(h) };
    case "30d":
      return { de: menos(29), ate: iso(h) };
    case "90d":
      return { de: menos(89), ate: iso(h) };
    case "mes":
      return { de: iso(new Date(Date.UTC(a, m, 1))), ate: iso(h) };
    case "mes_passado":
      return { de: iso(new Date(Date.UTC(a, m - 1, 1))), ate: iso(new Date(Date.UTC(a, m, 0))) };
    case "ano":
      return { de: iso(new Date(Date.UTC(a, 0, 1))), ate: iso(h) };
    case "12m":
      return { de: iso(new Date(Date.UTC(a, m - 11, 1))), ate: iso(h) };
  }
}

/** O corte que faz sentido para o tamanho do período (trinta pontos é o que a linha aguenta). */
function corteNatural(de: string, ate: string): CorteMetricas {
  const n = diasEntre(de, ate);
  if (n <= 62) return "dia";
  if (n <= 200) return "semana";
  if (n <= 3 * 366) return "mes";
  return "ano";
}

function rotuloDoPeriodo(periodo: string, corte: CorteMetricas): string {
  const [a, m, d] = periodo.slice(0, 10).split("-");
  if (corte === "ano") return a;
  if (corte === "mes") return `${MESES[Number(m) - 1]}/${a.slice(2)}`;
  if (corte === "semana") return `sem. ${d}/${m}`;
  return `${d}/${m}`;
}

const dataBr = (s: string) => s.split("-").reverse().join("/");
const inteiro = (n: number) => Number(n || 0).toLocaleString("pt-BR");

/** Taxa em %, ou null quando não há base para dividir. */
const taxa = (parte: number, todo: number) =>
  Number(todo) > 0 ? (Number(parte) / Number(todo)) * 100 : null;
const taxaTexto = (parte: number, todo: number) => {
  const t = taxa(parte, todo);
  return t === null
    ? "—"
    : `${t.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
};

type Filtro = {
  de: string;
  ate: string;
  corte: CorteMetricas;
  predefinido: Predefinido | null;
};

function filtroDe(p: Predefinido): Filtro {
  const { de, ate } = intervaloDe(p);
  return { de, ate, corte: corteNatural(de, ate), predefinido: p };
}

export function MetricasMarketplace({
  anunciante,
  onAnunciante,
}: {
  /** Anunciante escolhido (vem também da aba de moderação). */
  anunciante: string | null;
  onAnunciante: (id: string | null) => void;
}) {
  const lerFn = useServerFn(lerMetricasMarketplace);
  const [filtro, setFiltro] = useState<Filtro>(() => filtroDe("30d"));
  const [profissao, setProfissao] = useState<string | null>(null);
  const [deLivre, setDeLivre] = useState(filtro.de);
  const [ateLivre, setAteLivre] = useState(filtro.ate);

  // O período mudou por um atalho: as caixas acompanham.
  useEffect(() => {
    setDeLivre(filtro.de);
    setAteLivre(filtro.ate);
  }, [filtro.de, filtro.ate]);

  const q = useQuery({
    queryKey: [
      "plataforma-marketplace-metricas",
      filtro.de,
      filtro.ate,
      filtro.corte,
      profissao,
      anunciante,
    ],
    queryFn: () =>
      lerFn({
        data: {
          de: filtro.de,
          ate: filtro.ate,
          corte: filtro.corte,
          profissao,
          anunciante,
        },
      }),
    staleTime: 60_000,
    placeholderData: (anterior) => anterior,
  });

  const d = q.data;
  const nomes = useMemo(
    () => new Map((d?.categorias ?? []).map((c) => [c.id, c.nome])),
    [d?.categorias],
  );
  const escolhido = d?.escolhido ?? null;
  const recorte = escolhido
    ? escolhido.nome
    : d?.categoria
      ? `Profissão: ${nomes.get(d.categoria) ?? d.categoria}`
      : "Marketplace inteiro";
  const livreValido = Boolean(deLivre && ateLivre && deLivre <= ateLivre);

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible"
          role="group"
          aria-label="Período"
        >
          {PREDEFINIDOS.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={filtro.predefinido === p.id ? "default" : "outline"}
              aria-pressed={filtro.predefinido === p.id}
              className="shrink-0 rounded-full"
              onClick={() => setFiltro(filtroDe(p.id))}
            >
              {p.rotulo}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-2.5">
          <div className="space-y-1">
            <Label htmlFor="mkt-de">De</Label>
            <Input
              id="mkt-de"
              type="date"
              value={deLivre}
              max={ateLivre || undefined}
              onChange={(e) => setDeLivre(e.target.value)}
              className="w-[10.5rem]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mkt-ate">Até</Label>
            <Input
              id="mkt-ate"
              type="date"
              value={ateLivre}
              min={deLivre || undefined}
              onChange={(e) => setAteLivre(e.target.value)}
              className="w-[10.5rem]"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!livreValido || (deLivre === filtro.de && ateLivre === filtro.ate)}
            onClick={() =>
              setFiltro({
                de: deLivre,
                ate: ateLivre,
                corte: corteNatural(deLivre, ateLivre),
                predefinido: null,
              })
            }
          >
            Aplicar período
          </Button>
          <div className="space-y-1">
            <Label htmlFor="mkt-corte">Agrupar por</Label>
            <Select
              value={filtro.corte}
              onValueChange={(v) => setFiltro((f) => ({ ...f, corte: v as CorteMetricas }))}
            >
              <SelectTrigger id="mkt-corte" className="w-32" aria-label="Agrupar por">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CORTES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {q.isFetching && (
            <Loader2
              className="size-4 animate-spin text-muted-foreground"
              aria-label="Atualizando"
            />
          )}
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="min-w-0 space-y-1">
            <Label htmlFor="mkt-profissao">Profissão</Label>
            <Select
              value={profissao ?? TODAS}
              onValueChange={(v) => setProfissao(v === TODAS ? null : v)}
            >
              <SelectTrigger id="mkt-profissao" aria-label="Profissão">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>Todas as profissões</SelectItem>
                {(d?.categorias ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1">
            <Label htmlFor="mkt-anunciante">Anunciante</Label>
            <Select
              value={escolhido?.especialista_id ?? TODAS}
              onValueChange={(v) => onAnunciante(v === TODAS ? null : v)}
            >
              <SelectTrigger id="mkt-anunciante" aria-label="Anunciante">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>Todos os anunciantes</SelectItem>
                {(d?.anunciantes ?? []).map((a) => (
                  <SelectItem key={a.especialista_id} value={a.especialista_id}>
                    {a.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{recorte}</span> · de{" "}
          <span className="tabular-nums">{dataBr(filtro.de)}</span> a{" "}
          <span className="tabular-nums">{dataBr(filtro.ate)}</span>. O dia de hoje entra com o que
          já aconteceu até agora. Os mesmos números que o anunciante vê no painel dele.
        </p>
      </section>

      {q.isError && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {mensagemDeErro(q.error, "Não foi possível ler as métricas do marketplace.")}
        </p>
      )}

      {q.isLoading ? (
        <Skeleton className="h-64" />
      ) : d ? (
        <Painel
          serie={d.serie}
          canais={d.canais}
          corte={filtro.corte}
          vazio={
            escolhido
              ? escolhido.no_ar
                ? "Este anunciante não apareceu para ninguém no período. É candidato a uma conversa sobre chamada, foto e preço."
                : "Este anúncio está fora do ar no momento — não aparece na grade, então não soma impressão."
              : "Nenhum anúncio apareceu na grade neste período e recorte. Amplie as datas ou tire o filtro de profissão."
          }
        />
      ) : null}

      {d && !escolhido && (
        <PorAnunciante linhas={d.anunciantes} nomes={nomes} onEscolher={(id) => onAnunciante(id)} />
      )}
    </div>
  );
}

function Indicador({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="text-xl font-semibold tabular-nums">{valor}</p>
      <p className="truncate text-[11px] text-muted-foreground">{detalhe}</p>
    </div>
  );
}

function Painel({
  serie,
  canais,
  corte,
  vazio,
}: {
  serie: PontoSerie[];
  canais: LinhaCanal[];
  corte: CorteMetricas;
  vazio: string;
}) {
  const soma = (k: "impressoes" | "visualizacoes" | "cliques" | "conversoes") =>
    serie.reduce((a, p) => a + Number(p[k] || 0), 0);
  const impressoes = soma("impressoes");
  const cliques = soma("cliques");
  const conversoes = soma("conversoes");
  const temDado = impressoes + cliques + conversoes + soma("visualizacoes") > 0;
  const mostrarPessoas = serie.some((p) => p.pessoas !== null);

  const dados = serie.map((p) => ({
    rotulo: rotuloDoPeriodo(p.periodo, corte),
    impressoes: Number(p.impressoes),
    cliques: Number(p.cliques),
    conversoes: Number(p.conversoes),
    ctr: Number((taxa(p.cliques, p.impressoes) ?? 0).toFixed(1)),
    conv: Number((taxa(p.conversoes, p.cliques) ?? 0).toFixed(1)),
  }));

  // Canais na ordem fixa; o que vier além (telefone, sem canal) vai no fim.
  const canaisOrdenados = [
    ...ORDEM_CANAIS.map(
      (c) => canais.find((x) => x.canal === c) ?? { canal: c, cliques: 0, conversoes: 0 },
    ),
    ...canais.filter((x) => !ORDEM_CANAIS.includes(x.canal)),
  ];
  const dadosCanais = canaisOrdenados.map((c) => ({
    rotulo: CANAL[c.canal] ?? c.canal,
    cliques: Number(c.cliques),
    conversoes: Number(c.conversoes),
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        <Indicador
          rotulo="Impressões"
          valor={inteiro(impressoes)}
          detalhe="vezes na grade do marketplace"
        />
        <Indicador
          rotulo="Cliques"
          valor={inteiro(cliques)}
          detalhe="em qualquer botão de contato"
        />
        <Indicador
          rotulo="Conversões"
          valor={inteiro(conversoes)}
          detalhe="conversas abertas no WhatsApp"
        />
        <Indicador
          rotulo="CTR"
          valor={taxaTexto(cliques, impressoes)}
          detalhe="cliques ÷ impressões"
        />
        <Indicador
          rotulo="Taxa de conversão"
          valor={taxaTexto(conversoes, cliques)}
          detalhe="conversões ÷ cliques"
        />
      </div>

      {!temDado ? (
        <section className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
          <BarChart3 className="size-6 text-muted-foreground" aria-hidden />
          <p className="font-medium">Nenhum evento neste recorte</p>
          <p className="max-w-md text-sm text-muted-foreground">{vazio}</p>
        </section>
      ) : (
        <>
          <section className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Impressões, cliques e conversões</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Os três no mesmo eixo, para ver se andam juntos. Os valores exatos estão na tabela
              abaixo.
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dados} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke={GRADE} vertical={false} />
                  <XAxis
                    dataKey="rotulo"
                    tick={{ fontSize: 11, fill: EIXO }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: EIXO }}
                    width={44}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip contentStyle={DICA} formatter={(v: number) => inteiro(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="impressoes"
                    name="Impressões"
                    stroke="var(--chart-1)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="cliques"
                    name="Cliques"
                    stroke="var(--chart-2)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="conversoes"
                    name="Conversões"
                    stroke="var(--chart-3)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="min-w-0 rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-semibold">CTR e taxa de conversão</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Período sem impressão (ou sem clique) fica em zero no desenho; a tabela mostra
                travessão.
              </p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dados} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke={GRADE} vertical={false} />
                    <XAxis
                      dataKey="rotulo"
                      tick={{ fontSize: 11, fill: EIXO }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: EIXO }}
                      width={44}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={DICA}
                      formatter={(v: number) => `${Number(v).toLocaleString("pt-BR")}%`}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="ctr"
                      name="CTR"
                      stroke="var(--chart-4)"
                      strokeWidth={2.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="conv"
                      name="Taxa de conversão"
                      stroke="var(--chart-5)"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="min-w-0 rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-semibold">Por canal</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Em qual botão do anúncio as pessoas clicaram. Só o WhatsApp converte.
              </p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosCanais} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke={GRADE} vertical={false} />
                    <XAxis
                      dataKey="rotulo"
                      tick={{ fontSize: 11, fill: EIXO }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: EIXO }}
                      width={44}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip contentStyle={DICA} formatter={(v: number) => inteiro(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="cliques"
                      name="Cliques"
                      fill="var(--chart-2)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={36}
                    />
                    <Bar
                      dataKey="conversoes"
                      name="Conversões"
                      fill="var(--chart-3)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={36}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <section className="rounded-lg border border-border bg-card">
            <div className="border-b border-border p-4">
              <h3 className="text-sm font-semibold">Os números exatos</h3>
              <p className="text-xs text-muted-foreground">
                Período a período, com as taxas já calculadas.
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Impressões</TableHead>
                    <TableHead className="text-right">Cliques</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                    <TableHead className="text-right">Conversões</TableHead>
                    <TableHead className="text-right">Conv. ÷ cliques</TableHead>
                    {mostrarPessoas && <TableHead className="text-right">Pessoas</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...serie].reverse().map((p) => (
                    <TableRow key={p.periodo}>
                      <TableCell className="tabular-nums">
                        {rotuloDoPeriodo(p.periodo, corte)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {inteiro(p.impressoes)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {inteiro(p.cliques)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {taxaTexto(p.cliques, p.impressoes)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {inteiro(p.conversoes)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {taxaTexto(p.conversoes, p.cliques)}
                      </TableCell>
                      {mostrarPessoas && (
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {inteiro(p.pessoas ?? 0)}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card">
            <h3 className="border-b border-border p-4 text-sm font-semibold">
              Por canal, em números
            </h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Canal</TableHead>
                    <TableHead className="text-right">Cliques</TableHead>
                    <TableHead className="text-right">% dos cliques</TableHead>
                    <TableHead className="text-right">Conversões</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {canaisOrdenados.map((c) => (
                    <TableRow key={c.canal}>
                      <TableCell>{CANAL[c.canal] ?? c.canal}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {inteiro(c.cliques)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {taxaTexto(c.cliques, cliques)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {inteiro(c.conversoes)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {canais.some((c) => c.canal === "nao_informado") && (
              <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                “Sem canal registrado” são cliques de antes de o sistema guardar qual botão foi
                usado. Atribuí-los a um canal seria inventar.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function PorAnunciante({
  linhas,
  nomes,
  onEscolher,
}: {
  linhas: LinhaAnunciante[];
  nomes: Map<string, string>;
  onEscolher: (id: string) => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="border-b border-border p-4">
        <h3 className="text-sm font-semibold">Por anunciante</h3>
        <p className="text-xs text-muted-foreground">
          Quem entregou o quê no período. Toque numa linha para abrir o painel de um anunciante só —
          é o mesmo que ele vê.
        </p>
      </div>
      {linhas.length === 0 ? (
        <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Inbox className="size-4" aria-hidden /> Nenhum anúncio cadastrado neste recorte. Tire o
          filtro de profissão para ver a carteira inteira.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Anunciante</TableHead>
                <TableHead className="hidden md:table-cell">Situação</TableHead>
                <TableHead className="text-right">Impressões</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Cliques</TableHead>
                <TableHead className="text-right">Conversões</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((a) => (
                <TableRow
                  key={a.especialista_id}
                  className="cursor-pointer"
                  tabIndex={0}
                  aria-label={`Abrir as métricas de ${a.nome}`}
                  onClick={() => onEscolher(a.especialista_id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onEscolher(a.especialista_id);
                    }
                  }}
                >
                  <TableCell className="min-w-0">
                    <p className="font-medium">{a.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {[a.conta, ...(a.categorias ?? []).map((c) => nomes.get(c) ?? c)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {a.no_ar ? (
                      <Badge variant="outline" className="text-emerald-700">
                        no ar
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        {a.status === "em_analise" ? "em análise" : "fora do ar"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{inteiro(a.impressoes)}</TableCell>
                  <TableCell className="hidden text-right sm:table-cell">
                    <span className="block tabular-nums">{inteiro(a.cliques)}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      CTR {taxaTexto(a.cliques, a.impressoes)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`block font-semibold tabular-nums ${a.conversoes > 0 ? "text-emerald-700" : ""}`}
                    >
                      {inteiro(a.conversoes)}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {taxaTexto(a.conversoes, a.cliques)} dos cliques
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
