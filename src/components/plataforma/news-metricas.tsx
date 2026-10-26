import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as TooltipGrafico,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownUp,
  Clock,
  Eye,
  Heart,
  Link2,
  Mail,
  MessageCircle,
  MessageSquare,
  MousePointerClick,
  Percent,
  Share2,
  Smartphone,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Indicador3D } from "@/components/ui/indicador-3d";
import { Estado3D } from "@/components/ui/estado-3d";
import { cn } from "@/lib/utils";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { lerMetricasNews, type MetricasNews } from "@/lib/plataforma/news.functions";

const fmt = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString("pt-BR"));
const seg = (s: number | null | undefined) =>
  s == null
    ? "—"
    : s < 60
      ? `${s} s`
      : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
const isoDia = (d: Date) => d.toISOString().slice(0, 10);
const PERIODOS = [
  { dias: 7, rotulo: "7 dias" },
  { dias: 30, rotulo: "30 dias" },
  { dias: 90, rotulo: "90 dias" },
];
const PORTAL: Record<string, string> = {
  corretor: "Portal do corretor",
  imobiliaria: "Portal da imobiliária",
  agilliza: "Equipe do Agilliza",
  app: "Aplicativo",
};
const PERFIL: Record<string, string> = {
  dono: "Dono da conta",
  admin: "Administrador",
  gerente: "Gerente",
  corretor: "Corretor",
  assistente: "Assistente",
  financeiro: "Financeiro",
  equipe: "Equipe Agilliza",
  super_admin: "Plataforma",
};
type Coluna = "impressoes" | "alcance" | "ctr" | "compartilhamentos" | "tempo_medio_s" | "curtidas";

/**
 * Métricas da Agilliza News no padrão dos gerenciadores de anúncio (C60): impressões,
 * alcance, aberturas (leituras + cliques), CTR, compartilhamentos por canal, tempo de
 * leitura, curtidas e comentários; série diária, quebra por portal e por tipo de usuário e
 * ranking dos itens (clique numa linha → o mesmo painel só daquele item).
 */
export function MetricasNews() {
  const fn = useServerFn(lerMetricasNews);
  const hoje = new Date();
  const [dias, setDias] = useState<number | null>(30);
  const [inicio, setInicio] = useState(isoDia(new Date(hoje.getTime() - 29 * 86_400_000)));
  const [fim, setFim] = useState(isoDia(hoje));
  const [ordem, setOrdem] = useState<Coluna>("impressoes");
  const [item, setItem] = useState<MetricasNews["ranking"][number] | null>(null);

  const periodo = useMemo(() => {
    if (dias)
      return {
        inicio: isoDia(new Date(Date.now() - (dias - 1) * 86_400_000)),
        fim: isoDia(new Date()),
      };
    return { inicio, fim };
  }, [dias, inicio, fim]);

  const q = useQuery({
    queryKey: ["news-metricas", periodo],
    queryFn: () => fn({ data: periodo }),
  });
  const qItem = useQuery({
    queryKey: ["news-metricas-item", periodo, item?.item_id],
    queryFn: () => fn({ data: { ...periodo, item_tipo: item!.item_tipo, item_id: item!.item_id } }),
    enabled: !!item,
  });
  const m = q.data;
  const ranking = useMemo(
    () => [...(m?.ranking ?? [])].sort((a, b) => Number(b[ordem] ?? 0) - Number(a[ordem] ?? 0)),
    [m, ordem],
  );

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          {PERIODOS.map((p) => (
            <Button
              key={p.dias}
              size="sm"
              variant={dias === p.dias ? "default" : "outline"}
              onClick={() => setDias(p.dias)}
            >
              {p.rotulo}
            </Button>
          ))}
          <Button
            size="sm"
            variant={dias === null ? "default" : "outline"}
            onClick={() => setDias(null)}
          >
            Período
          </Button>
        </div>
        {dias === null && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              className="h-9 w-[150px]"
              value={inicio}
              max={fim}
              onChange={(e) => setInicio(e.target.value)}
              aria-label="Início"
            />
            <span className="text-muted-foreground">a</span>
            <Input
              type="date"
              className="h-9 w-[150px]"
              value={fim}
              min={inicio}
              onChange={(e) => setFim(e.target.value)}
              aria-label="Fim"
            />
          </div>
        )}
      </div>

      {q.isError ? (
        <Estado3D
          tipo="erro"
          descricao={mensagemDeErro(q.error, "Não foi possível carregar as métricas.")}
          acao={<Button onClick={() => q.refetch()}>Tentar de novo</Button>}
        />
      ) : (
        <PainelMetricas m={m} carregando={q.isLoading} />
      )}

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Ranking dos itens</h3>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowDownUp className="size-3.5" /> Ordenar por
            <select
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
              value={ordem}
              onChange={(e) => setOrdem(e.target.value as Coluna)}
              aria-label="Ordenar ranking"
            >
              <option value="impressoes">Impressões</option>
              <option value="alcance">Alcance</option>
              <option value="ctr">CTR</option>
              <option value="compartilhamentos">Compartilhamentos</option>
              <option value="tempo_medio_s">Tempo de leitura</option>
              <option value="curtidas">Curtidas</option>
            </select>
          </div>
        </div>
        {q.isLoading ? (
          <Skeleton className="h-40" />
        ) : !ranking.length ? (
          <Estado3D
            compacto
            icone={Eye}
            titulo="Sem visualizações no período"
            descricao="As métricas aparecem quando os assinantes e a equipe abrem a News."
          />
        ) : (
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">Item</th>
                  <th className="px-2 text-right font-semibold">Impressões</th>
                  <th className="px-2 text-right font-semibold">Alcance</th>
                  <th className="px-2 text-right font-semibold">Aberturas</th>
                  <th className="px-2 text-right font-semibold">CTR</th>
                  <th className="px-2 text-right font-semibold">Compart.</th>
                  <th className="px-2 text-right font-semibold">Tempo</th>
                  <th className="px-2 text-right font-semibold">Curtidas</th>
                  <th className="pl-2 text-right font-semibold">Coment.</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r) => (
                  <tr
                    key={`${r.item_tipo}-${r.item_id}`}
                    className="cursor-pointer border-b border-border/60 transition-colors hover:bg-primary/[0.03]"
                    onClick={() => setItem(r)}
                  >
                    <td className="max-w-[320px] py-2 pr-3">
                      <p className="truncate font-medium">{r.titulo ?? "Sem título"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {r.item_tipo === "post" ? "Matéria da Agilliza" : "Link de portal"}
                      </p>
                    </td>
                    <td className="px-2 text-right tabular-nums">{fmt(r.impressoes)}</td>
                    <td className="px-2 text-right tabular-nums">{fmt(r.alcance)}</td>
                    <td className="px-2 text-right tabular-nums">{fmt(r.leituras + r.cliques)}</td>
                    <td className="px-2 text-right tabular-nums">{fmt(r.ctr)}%</td>
                    <td className="px-2 text-right tabular-nums">{fmt(r.compartilhamentos)}</td>
                    <td className="px-2 text-right tabular-nums">{seg(r.tempo_medio_s)}</td>
                    <td className="px-2 text-right tabular-nums">{fmt(r.curtidas)}</td>
                    <td className="pl-2 text-right tabular-nums">{fmt(r.comentarios)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Sheet open={!!item} onOpenChange={(o) => !o && setItem(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle className="pr-6 leading-snug">{item?.titulo ?? "Item"}</SheetTitle>
            <SheetDescription>
              Desempenho de {periodo.inicio.split("-").reverse().join("/")} a{" "}
              {periodo.fim.split("-").reverse().join("/")}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <PainelMetricas m={qItem.data} carregando={qItem.isLoading} compacto />
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}

function PainelMetricas({
  m,
  carregando,
  compacto,
}: {
  m?: MetricasNews;
  carregando: boolean;
  compacto?: boolean;
}) {
  const t = m?.totais;
  const canais = m?.compartilhamentos_por_canal ?? {};
  const totalCanais = Object.values(canais).reduce((a, b) => a + Number(b ?? 0), 0);
  const grade = compacto ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 gap-3 lg:grid-cols-4";
  return (
    <div className="space-y-5">
      <div className={grade}>
        <Indicador3D
          icone={Eye}
          rotulo="Impressões"
          natureza="quantidade"
          valor={fmt(t?.impressoes)}
          detalhe="cartão visto no feed"
          carregando={carregando}
        />
        <Indicador3D
          icone={Users}
          tom="info"
          rotulo="Alcance"
          natureza="pessoas únicas"
          valor={fmt(t?.alcance)}
          detalhe={`${fmt(t?.leitores)} abriram`}
          carregando={carregando}
        />
        <Indicador3D
          icone={MousePointerClick}
          tom="violeta"
          rotulo="Aberturas"
          natureza="quantidade"
          valor={fmt(t?.aberturas)}
          detalhe={`${fmt(t?.leituras)} leituras · ${fmt(t?.cliques)} cliques`}
          carregando={carregando}
        />
        <Indicador3D
          icone={Percent}
          tom="sucesso"
          rotulo="CTR"
          natureza="aberturas ÷ impressões"
          valor={t ? `${fmt(t.ctr)}%` : "—"}
          carregando={carregando}
          destaque
        />
        <Indicador3D
          icone={Share2}
          tom="ciano"
          rotulo="Compartilhamentos"
          natureza="quantidade"
          valor={fmt(t?.compartilhamentos)}
          carregando={carregando}
        />
        <Indicador3D
          icone={Clock}
          tom="neutro"
          rotulo="Tempo de leitura"
          natureza="média por leitura"
          valor={seg(t?.tempo_medio_s)}
          carregando={carregando}
        />
        <Indicador3D
          icone={Heart}
          tom="alerta"
          rotulo="Curtidas"
          natureza="no período"
          valor={fmt(t?.curtidas)}
          carregando={carregando}
        />
        <Indicador3D
          icone={MessageSquare}
          tom="marca"
          rotulo="Comentários"
          natureza="no período"
          valor={fmt(t?.comentarios)}
          carregando={carregando}
        />
      </div>

      <div className={cn("grid gap-4", !compacto && "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]")}>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold">Dia a dia</h3>
          {carregando ? (
            <Skeleton className="h-56" />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={m?.serie ?? []} margin={{ left: -18, right: 8, top: 6 }}>
                  <defs>
                    <linearGradient id="gImp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#000F9F" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#000F9F" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gAbr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="dia"
                    tickFormatter={(d: string) => d.slice(8, 10) + "/" + d.slice(5, 7)}
                    tick={{ fontSize: 11 }}
                    minTickGap={18}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <TooltipGrafico
                    labelFormatter={(d) => String(d).split("-").reverse().join("/")}
                    formatter={(v, n) => [
                      fmt(Number(v)),
                      n === "impressoes"
                        ? "Impressões"
                        : n === "aberturas"
                          ? "Aberturas"
                          : n === "alcance"
                            ? "Alcance"
                            : "Compartilhamentos",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="impressoes"
                    stroke="#000F9F"
                    strokeWidth={2}
                    fill="url(#gImp)"
                  />
                  <Area
                    type="monotone"
                    dataKey="aberturas"
                    stroke="#0EA5E9"
                    strokeWidth={2}
                    fill="url(#gAbr)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold">Compartilhamentos por canal</h3>
          {(
            [
              ["whatsapp", "WhatsApp", MessageCircle],
              ["link", "Link copiado", Link2],
              ["email", "E-mail", Mail],
              ["nativo", "Compartilhar do aparelho", Smartphone],
            ] as const
          ).map(([k, rotulo, Icone]) => {
            const n = Number(canais[k] ?? 0);
            const pct = totalCanais ? Math.round((n / totalCanais) * 100) : 0;
            return (
              <div key={k} className="mb-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <Icone className="size-3.5 text-primary" /> {rotulo}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {fmt(n)} · {pct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={cn("grid gap-4", !compacto && "md:grid-cols-2")}>
        <Quebra
          titulo="Por portal"
          linhas={(m?.por_portal ?? []).map((p) => ({ nome: PORTAL[p.portal] ?? p.portal, ...p }))}
          carregando={carregando}
        />
        <Quebra
          titulo="Por tipo de usuário"
          linhas={(m?.por_perfil ?? []).map((p) => ({ nome: PERFIL[p.perfil] ?? p.perfil, ...p }))}
          carregando={carregando}
        />
      </div>
    </div>
  );
}

function Quebra({
  titulo,
  linhas,
  carregando,
}: {
  titulo: string;
  linhas: Array<{ nome: string; impressoes: number; aberturas: number; alcance: number }>;
  carregando: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold">{titulo}</h3>
      {carregando ? (
        <Skeleton className="h-24" />
      ) : !linhas.length ? (
        <p className="text-sm text-muted-foreground">Sem dados no período.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="pb-1 font-semibold">&nbsp;</th>
              <th className="pb-1 text-right font-semibold">Impr.</th>
              <th className="pb-1 text-right font-semibold">Abert.</th>
              <th className="pb-1 text-right font-semibold">Alcance</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.nome} className="border-t border-border/60">
                <td className="py-1.5">
                  <Badge variant="outline" className="font-normal">
                    {l.nome}
                  </Badge>
                </td>
                <td className="text-right tabular-nums">{fmt(l.impressoes)}</td>
                <td className="text-right tabular-nums">{fmt(l.aberturas)}</td>
                <td className="text-right tabular-nums">{fmt(l.alcance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
