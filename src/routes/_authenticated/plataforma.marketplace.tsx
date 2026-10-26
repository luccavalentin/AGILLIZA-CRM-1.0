import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BarChart3,
  ChevronRight,
  Eye,
  EyeOff,
  Inbox,
  Loader2,
  RefreshCw,
  Star,
  Store,
} from "lucide-react";
import { AdminHero } from "@/components/admin/admin-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MetricasMarketplace } from "@/components/plataforma/marketplace-metricas";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL, formatData } from "@/lib/financeiro/format";
import {
  lerModeracaoMarketplace,
  moderarAvaliacao,
  moderarEspecialista,
  type Anunciante,
  type AvaliacaoMarketplace,
  type ModeracaoAvaliacao,
  type PerfilEspecialista,
  type StatusEspecialista,
} from "@/lib/plataforma/marketplace.functions";

export const Route = createFileRoute("/_authenticated/plataforma/marketplace")({
  head: () => ({ meta: [{ title: "Marketplace — Plataforma — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("saas.marketplace"),
  component: Pagina,
});

const CHAVE = ["plataforma-marketplace"];

type Tom = "default" | "secondary" | "destructive" | "outline";
const VERDE = "text-emerald-700";

const STATUS: Record<StatusEspecialista, { rotulo: string; tom: Tom; verde?: boolean }> = {
  rascunho: { rotulo: "Rascunho", tom: "outline" },
  em_analise: { rotulo: "Em análise", tom: "secondary" },
  aprovado: { rotulo: "Aprovado", tom: "outline", verde: true },
  recusado: { rotulo: "Recusado", tom: "destructive" },
  suspenso: { rotulo: "Suspenso", tom: "destructive" },
};
const MODERACAO: Record<ModeracaoAvaliacao, { rotulo: string; tom: Tom; verde?: boolean }> = {
  publicada: { rotulo: "Publicada", tom: "outline", verde: true },
  em_revisao: { rotulo: "Em revisão", tom: "secondary" },
  removida: { rotulo: "Removida", tom: "destructive" },
};
const NIVEL: Record<string, string> = {
  destaque: "Destaque",
  desempenho: "Por contato",
  basico: "Básico",
};

type GrupoPerfil = "todos" | "analise" | "vitrine" | "fora";
type GrupoAvaliacao = "todas" | ModeracaoAvaliacao;

/** Esperando (em análise), no ar (aprovado) e fora (recusado, suspenso, rascunho). */
const grupoPerfil = (p: PerfilEspecialista): Exclude<GrupoPerfil, "todos"> =>
  p.status === "em_analise" ? "analise" : p.status === "aprovado" ? "vitrine" : "fora";

function SeloStatus({ status }: { status: string }) {
  const s = STATUS[status as StatusEspecialista] ?? { rotulo: status, tom: "outline" as Tom };
  return (
    <Badge variant={s.tom} className={s.verde ? VERDE : undefined}>
      {s.rotulo}
    </Badge>
  );
}

/** `regioes` vem como `[{ uf, cidades[] }]` (jsonb) ou, em perfis antigos, texto. */
function textosDasRegioes(regioes: PerfilEspecialista["regioes"]): string[] {
  if (!Array.isArray(regioes)) return [];
  return regioes.flatMap((r) => {
    if (typeof r === "string") return [r];
    if (r && typeof r === "object" && !Array.isArray(r)) {
      const uf = typeof r.uf === "string" ? r.uf : "";
      const cidades = Array.isArray(r.cidades)
        ? r.cidades.filter((c) => typeof c === "string")
        : [];
      const texto = [cidades.join(", "), uf].filter(Boolean).join(" - ");
      return texto ? [texto] : [];
    }
    return [];
  });
}

/** Taxa com o denominador honesto: sem base, não há taxa — há travessão. */
const taxa = (parte: number, todo: number) =>
  todo > 0 ? `${((Number(parte) / Number(todo)) * 100).toFixed(1).replace(".", ",")}%` : "—";

function Pagina() {
  const lerFn = useServerFn(lerModeracaoMarketplace);
  const q = useQuery({ queryKey: CHAVE, queryFn: () => lerFn(), staleTime: 30_000 });
  const [aba, setAba] = useState<"moderacao" | "metricas">("moderacao");
  const [anunciante, setAnunciante] = useState<string | null>(null);
  const [filtroPerfis, setFiltroPerfis] = useState<GrupoPerfil>("todos");
  const [filtroAval, setFiltroAval] = useState<GrupoAvaliacao>("todas");

  const perfis = q.data?.perfis ?? [];
  const avaliacoes = q.data?.avaliacoes ?? [];
  const carteira = q.data?.carteira ?? [];
  const emAnalise = perfis.filter((p) => p.status === "em_analise");
  const aprovados = perfis.filter((p) => p.status === "aprovado");
  const emRevisao = avaliacoes.filter((a) => a.moderacao === "em_revisao");
  const receita = carteira.reduce((s, a) => s + Number(a.mensalidade ?? 0), 0);

  const verMetricas = (id: string | null) => {
    setAnunciante(id);
    setAba("metricas");
  };
  const irPara = (ancora: string) =>
    requestAnimationFrame(() =>
      document.getElementById(ancora)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AdminHero
        secao="Gestão de sistemas"
        icon={<Store className="h-5 w-5" />}
        titulo="Marketplace de especialistas"
        descricao="Quem pediu para entrar na vitrine, o registro profissional de cada um, as avaliações contestadas e o que cada anunciante entrega."
        acoes={
          <>
            {emAnalise.length > 0 && aba === "moderacao" && (
              <Button
                size="sm"
                onClick={() => {
                  setFiltroPerfis("analise");
                  irPara("mkt-perfis");
                }}
              >
                <Inbox className="mr-2 size-4" /> Conferir {emAnalise.length}{" "}
                {emAnalise.length === 1 ? "pedido" : "pedidos"}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
              <RefreshCw className={`mr-2 size-4 ${q.isFetching ? "animate-spin" : ""}`} />{" "}
              Atualizar
            </Button>
          </>
        }
      />

      <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
        <TabsList>
          <TabsTrigger value="moderacao">Moderação</TabsTrigger>
          <TabsTrigger value="metricas">Métricas</TabsTrigger>
        </TabsList>

        <TabsContent value="moderacao" className="space-y-6">
          {q.isError && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {mensagemDeErro(q.error, "Não foi possível ler o marketplace.")}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Resumo
              rotulo="Esperando análise"
              valor={String(emAnalise.length)}
              detalhe="registro a conferir"
              alerta={emAnalise.length > 0}
              carregando={q.isLoading}
              onClick={() => {
                setFiltroPerfis("analise");
                irPara("mkt-perfis");
              }}
            />
            <Resumo
              rotulo="Na vitrine"
              valor={String(aprovados.length)}
              detalhe={`${aprovados.filter((p) => p.publicado && !p.oculto_inadimplencia).length} no ar agora`}
              carregando={q.isLoading}
              onClick={() => {
                setFiltroPerfis("vitrine");
                irPara("mkt-perfis");
              }}
            />
            <Resumo
              rotulo="Avaliações em revisão"
              valor={String(emRevisao.length)}
              detalhe="contestadas pelo anunciante"
              alerta={emRevisao.length > 0}
              carregando={q.isLoading}
              onClick={() => {
                setFiltroAval("em_revisao");
                irPara("mkt-avaliacoes");
              }}
            />
            <Resumo
              rotulo="Receita do marketplace"
              valor={formatBRL(receita)}
              detalhe="por mês, assinaturas ativas"
              carregando={q.isLoading}
            />
          </div>

          <Carteira
            linhas={carteira}
            dias={q.data?.dias ?? 30}
            carregando={q.isLoading}
            onMetricas={verMetricas}
          />

          <div className="grid gap-6 xl:grid-cols-2">
            <Perfis
              perfis={perfis}
              filtro={filtroPerfis}
              onFiltro={setFiltroPerfis}
              carregando={q.isLoading}
              onMetricas={verMetricas}
            />
            <Avaliacoes
              avaliacoes={avaliacoes}
              filtro={filtroAval}
              onFiltro={setFiltroAval}
              carregando={q.isLoading}
            />
          </div>
        </TabsContent>

        <TabsContent value="metricas">
          <MetricasMarketplace anunciante={anunciante} onAnunciante={setAnunciante} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Resumo({
  rotulo,
  valor,
  detalhe,
  alerta,
  carregando,
  onClick,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  alerta?: boolean;
  carregando: boolean;
  onClick?: () => void;
}) {
  const corpo = (
    <>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      {carregando ? (
        <Skeleton className="mt-1 h-7 w-16" />
      ) : (
        <p className="truncate text-xl font-semibold tabular-nums">{valor}</p>
      )}
      <p className="truncate text-[11px] text-muted-foreground">{detalhe}</p>
    </>
  );
  const classe = `min-w-0 rounded-lg border bg-card p-3 text-left ${alerta ? "border-amber-400/70" : "border-border"}`;
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={`${classe} transition-colors hover:bg-muted/40`}
    >
      {corpo}
    </button>
  ) : (
    <div className={classe}>{corpo}</div>
  );
}

function Carteira({
  linhas,
  dias,
  carregando,
  onMetricas,
}: {
  linhas: Anunciante[];
  dias: number;
  carregando: boolean;
  onMetricas: (id: string | null) => void;
}) {
  const total = (k: "impressoes" | "conversoes" | "mensalidade") =>
    linhas.reduce((s, a) => s + Number(a[k] ?? 0), 0);
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border p-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Carteira de anunciantes</h2>
          <p className="text-xs text-muted-foreground">
            O que cada um entrega e o que paga, nos últimos {dias} dias.
            {linhas.length > 0 &&
              ` No total: ${total("impressoes").toLocaleString("pt-BR")} aparições, ${total("conversoes").toLocaleString("pt-BR")} contatos, ${formatBRL(total("mensalidade"))} por mês.`}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => onMetricas(null)}>
          <BarChart3 className="mr-2 size-4" /> Métricas por período
        </Button>
      </div>
      {carregando ? (
        <div className="p-4">
          <Skeleton className="h-16" />
        </div>
      ) : linhas.length === 0 ? (
        <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Store className="size-4" aria-hidden /> Nenhum anunciante ainda. Quando um parceiro
          montar o anúncio e for aprovado, ele aparece aqui com o que entrega e o que paga.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Anunciante</TableHead>
                <TableHead>Na vitrine</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Apareceu</TableHead>
                <TableHead className="hidden text-right md:table-cell">Clicaram</TableHead>
                <TableHead className="text-right">Contatos</TableHead>
                <TableHead className="hidden text-right md:table-cell">Paga</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="min-w-[9rem]">
                    <p className="font-medium">{a.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.conta ?? "—"}
                      {a.categorias?.length ? ` · ${a.categorias.length} categoria(s)` : ""}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {a.status !== "aprovado" ? (
                        <SeloStatus status={a.status} />
                      ) : a.oculto_inadimplencia ? (
                        <Badge variant="destructive">fora por pagamento</Badge>
                      ) : a.publicado ? (
                        <Badge variant="outline" className={VERDE}>
                          no ar
                        </Badge>
                      ) : (
                        <Badge variant="secondary">desligado por ele</Badge>
                      )}
                      <Badge variant="outline">
                        {NIVEL[a.plano_codigo ?? ""] ?? a.plano_codigo ?? "—"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-right sm:table-cell">
                    <span className="block tabular-nums">
                      {Number(a.impressoes).toLocaleString("pt-BR")}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {Number(a.pessoas).toLocaleString("pt-BR")} pessoas
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-right md:table-cell">
                    <span className="block tabular-nums">
                      {Number(a.cliques).toLocaleString("pt-BR")}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {taxa(a.cliques, a.impressoes)} de quem viu
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`block font-semibold tabular-nums ${a.conversoes > 0 ? VERDE : ""}`}
                    >
                      {Number(a.conversoes).toLocaleString("pt-BR")}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {taxa(a.conversoes, a.cliques)} de quem clicou
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">
                    {a.mensalidade != null && Number(a.mensalidade) > 0
                      ? formatBRL(Number(a.mensalidade))
                      : "—"}
                    {a.assinatura_status && a.assinatura_status !== "ativa" && (
                      <span className="ml-1 text-[11px] text-destructive">
                        {a.assinatura_status}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Métricas de ${a.nome}`}
                      onClick={() => onMetricas(a.id)}
                    >
                      <BarChart3 className="size-4" />
                      <span className="hidden lg:inline">Métricas</span>
                    </Button>
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

function Filtro<T extends string>({
  rotulo,
  valor,
  opcoes,
  onValor,
}: {
  rotulo: string;
  valor: T;
  opcoes: { id: T; rotulo: string; total?: number }[];
  onValor: (v: T) => void;
}) {
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <Button
          key={o.id}
          type="button"
          size="sm"
          variant={valor === o.id ? "default" : "outline"}
          aria-pressed={valor === o.id}
          className="shrink-0 rounded-full"
          onClick={() => onValor(o.id)}
        >
          {o.rotulo}
          {o.total != null && <span className="ml-1 tabular-nums opacity-70">{o.total}</span>}
        </Button>
      ))}
    </div>
  );
}

function Perfis({
  perfis,
  filtro,
  onFiltro,
  carregando,
  onMetricas,
}: {
  perfis: PerfilEspecialista[];
  filtro: GrupoPerfil;
  onFiltro: (f: GrupoPerfil) => void;
  carregando: boolean;
  onMetricas: (id: string) => void;
}) {
  const [aberto, setAberto] = useState<PerfilEspecialista | null>(null);
  const conta = (g: Exclude<GrupoPerfil, "todos">) =>
    perfis.filter((p) => grupoPerfil(p) === g).length;
  const visiveis = filtro === "todos" ? perfis : perfis.filter((p) => grupoPerfil(p) === filtro);

  return (
    <section
      id="mkt-perfis"
      className="min-w-0 scroll-mt-20 rounded-lg border border-border bg-card"
    >
      <div className="space-y-2 border-b border-border p-4">
        <div>
          <h2 className="text-sm font-semibold">Perfis</h2>
          <p className="text-xs text-muted-foreground">
            Aprovar é dizer ao mercado que o registro profissional foi conferido. Fica gravado quem
            aprovou e quando.
          </p>
        </div>
        <Filtro
          rotulo="Recorte dos perfis"
          valor={filtro}
          onValor={onFiltro}
          opcoes={[
            { id: "todos", rotulo: "Todos", total: perfis.length },
            { id: "analise", rotulo: "Em análise", total: conta("analise") },
            { id: "vitrine", rotulo: "Na vitrine", total: conta("vitrine") },
            { id: "fora", rotulo: "Fora", total: conta("fora") },
          ]}
        />
      </div>
      {carregando ? (
        <div className="p-4">
          <Skeleton className="h-16" />
        </div>
      ) : visiveis.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">
          {perfis.length
            ? "Nenhum perfil neste recorte. Os outros continuam na lista inteira."
            : "Nenhum especialista cadastrado. Quando um parceiro montar o perfil e enviar para análise, ele aparece aqui com o registro para conferência."}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {visiveis.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setAberto(p)}
                className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="break-words font-medium">{p.nome}</span>
                    <SeloStatus status={p.status} />
                    {p.oculto_inadimplencia && (
                      <Badge variant="destructive">oculto por inadimplência</Badge>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {p.registro_tipo
                      ? `${p.registro_tipo} ${p.registro_numero ?? ""}${p.registro_uf ? `/${p.registro_uf}` : ""}`
                      : "sem registro informado"}
                    {p.conta ? ` · ${p.conta}` : ""}
                  </span>
                  <span className="block text-xs tabular-nums text-muted-foreground">
                    {p.total_avaliacoes > 0 && (
                      <>
                        <Star className="mr-0.5 inline size-3 text-amber-500" aria-hidden />
                        {Number(p.nota_media ?? 0).toFixed(1)} ({p.total_avaliacoes}) ·{" "}
                      </>
                    )}
                    desde {formatData(p.criado_em)}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <DetalhePerfil
        perfil={aberto}
        onFechar={() => setAberto(null)}
        onMetricas={(id) => {
          setAberto(null);
          onMetricas(id);
        }}
      />
    </section>
  );
}

function DetalhePerfil({
  perfil: p,
  onFechar,
  onMetricas,
}: {
  perfil: PerfilEspecialista | null;
  onFechar: () => void;
  onMetricas: (id: string) => void;
}) {
  const podeModerar = usePermissao("saas.marketplace", "edit");
  return (
    <Sheet open={!!p} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {p && (
          <>
            <SheetHeader>
              <SheetTitle className="break-words pr-6">{p.nome}</SheetTitle>
              <SheetDescription>
                {p.conta ?? "Conta sem nome"} · pediu entrada em {formatData(p.criado_em)}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <SeloStatus status={p.status} />
                {p.oculto_inadimplencia && (
                  <Badge variant="destructive">oculto por inadimplência</Badge>
                )}
                <Button size="sm" variant="outline" onClick={() => onMetricas(p.id)}>
                  <BarChart3 className="mr-2 size-4" /> Métricas
                </Button>
              </div>

              <section className="rounded-lg border border-border p-3">
                <h3 className="mb-2 text-sm font-semibold">Registro profissional</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <Dado rotulo="Tipo" valor={p.registro_tipo} />
                  <Dado rotulo="Número" valor={p.registro_numero} />
                  <Dado rotulo="UF" valor={p.registro_uf} />
                  <Dado
                    rotulo="Validade"
                    valor={p.registro_validade ? formatData(p.registro_validade) : null}
                  />
                  <Dado rotulo="Plano" valor={NIVEL[p.plano_codigo ?? ""] ?? p.plano_codigo} />
                  <Dado
                    rotulo="Perfil público"
                    valor={p.publicado ? `/${p.slug}` : "não publicado"}
                  />
                </dl>
                {p.aprovado_em && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Aprovado por {p.aprovador ?? "—"} em{" "}
                    {new Date(p.aprovado_em).toLocaleString("pt-BR")}.
                  </p>
                )}
              </section>

              <section className="rounded-lg border border-border p-3">
                <h3 className="mb-2 text-sm font-semibold">Como aparece na grade</h3>
                <div className="overflow-hidden rounded-md border border-border">
                  {p.capa_url ? (
                    <img
                      src={p.capa_url}
                      alt={`Capa do anúncio de ${p.nome}`}
                      className="aspect-[16/7] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[16/7] w-full items-center justify-center bg-muted text-xs text-muted-foreground">
                      sem capa
                    </div>
                  )}
                  <div className="flex items-center gap-3 p-3">
                    {p.foto_url ? (
                      <img
                        src={p.foto_url}
                        alt={`Foto de ${p.nome}`}
                        className="size-12 shrink-0 rounded-full border border-border object-cover"
                      />
                    ) : (
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                        {p.nome.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.nome}</p>
                      <p className="text-sm text-muted-foreground">{p.chamada ?? "sem chamada"}</p>
                    </div>
                  </div>
                </div>
                {(!p.foto_url || !p.capa_url) && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Confira se o anúncio precisa de{" "}
                    {!p.foto_url && !p.capa_url ? "foto e capa" : !p.foto_url ? "foto" : "capa"}{" "}
                    antes de aprovar.
                  </p>
                )}
              </section>

              <section className="rounded-lg border border-border p-3">
                <h3 className="mb-2 text-sm font-semibold">Apresentação</h3>
                {p.apresentacao ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {p.apresentacao}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem apresentação escrita.</p>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(p.categorias ?? []).map((c) => (
                    <Badge key={`c-${c}`}>{c}</Badge>
                  ))}
                  {(p.especialidades ?? []).map((e) => (
                    <Badge key={`e-${e}`} variant="secondary">
                      {e}
                    </Badge>
                  ))}
                  {textosDasRegioes(p.regioes).map((r) => (
                    <Badge key={`r-${r}`} variant="outline">
                      {r}
                    </Badge>
                  ))}
                </div>
              </section>

              {podeModerar ? (
                <DecisaoPerfil key={p.id} perfil={p} onFeito={onFechar} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Você pode ver o marketplace, mas não moderar perfis.
                </p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="break-words">{valor || "—"}</dd>
    </div>
  );
}

function DecisaoPerfil({
  perfil: p,
  onFeito,
}: {
  perfil: PerfilEspecialista;
  onFeito: () => void;
}) {
  const qc = useQueryClient();
  const moderarFn = useServerFn(moderarEspecialista);
  const [status, setStatus] = useState<StatusEspecialista>(
    p.status === "em_analise" ? "aprovado" : (p.status as StatusEspecialista),
  );
  const [motivo, setMotivo] = useState(p.motivo_status ?? "");
  const exigeMotivo = status === "recusado" || status === "suspenso";
  const motivoOk = !exigeMotivo || motivo.trim().length >= 10;

  const aplicar = useMutation({
    mutationFn: () => moderarFn({ data: { id: p.id, status, motivo } }),
    onSuccess: (r) => {
      toast.success(`${r.nome}: situação alterada para ${STATUS[status].rotulo.toLowerCase()}.`);
      qc.invalidateQueries({ queryKey: CHAVE });
      qc.invalidateQueries({ queryKey: ["plataforma-marketplace-metricas"] });
      onFeito();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível moderar o perfil.")),
  });

  return (
    <section className="space-y-3 rounded-lg border border-border p-3">
      <h3 className="text-sm font-semibold">Decisão</h3>
      <div className="space-y-1">
        <Label htmlFor="mkt-situacao">Situação</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusEspecialista)}>
          <SelectTrigger id="mkt-situacao" aria-label="Situação do perfil">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS) as StatusEspecialista[]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS[s].rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="mkt-motivo">Motivo{exigeMotivo ? " (obrigatório)" : ""}</Label>
        <Textarea
          id="mkt-motivo"
          rows={3}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Obrigatório ao recusar ou suspender (mínimo 10 caracteres). Este texto vai para o parceiro."
        />
      </div>
      <Button disabled={aplicar.isPending || !motivoOk} onClick={() => aplicar.mutate()}>
        {aplicar.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
        Aplicar decisão
      </Button>
    </section>
  );
}

function Avaliacoes({
  avaliacoes,
  filtro,
  onFiltro,
  carregando,
}: {
  avaliacoes: AvaliacaoMarketplace[];
  filtro: GrupoAvaliacao;
  onFiltro: (f: GrupoAvaliacao) => void;
  carregando: boolean;
}) {
  const podeModerar = usePermissao("saas.marketplace", "edit");
  const visiveis =
    filtro === "todas" ? avaliacoes : avaliacoes.filter((a) => a.moderacao === filtro);
  return (
    <section
      id="mkt-avaliacoes"
      className="min-w-0 scroll-mt-20 rounded-lg border border-border bg-card"
    >
      <div className="space-y-2 border-b border-border p-4">
        <div>
          <h2 className="text-sm font-semibold">Avaliações</h2>
          <p className="text-xs text-muted-foreground">
            Remover tira da vitrine sem apagar o registro — a nota do especialista é recalculada.
          </p>
        </div>
        <Filtro
          rotulo="Recorte das avaliações"
          valor={filtro}
          onValor={onFiltro}
          opcoes={[
            { id: "todas", rotulo: "Todas", total: avaliacoes.length },
            {
              id: "em_revisao",
              rotulo: "Em revisão",
              total: avaliacoes.filter((a) => a.moderacao === "em_revisao").length,
            },
            { id: "publicada", rotulo: "Publicadas" },
            { id: "removida", rotulo: "Removidas" },
          ]}
        />
      </div>
      {carregando ? (
        <div className="p-4">
          <Skeleton className="h-16" />
        </div>
      ) : visiveis.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">
          {avaliacoes.length
            ? "Nenhuma avaliação neste recorte. As outras continuam na lista inteira."
            : "Nenhum corretor avaliou um especialista até agora."}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {visiveis.map((a) => (
            <LinhaAvaliacao key={a.id} a={a} podeModerar={podeModerar} />
          ))}
        </ul>
      )}
    </section>
  );
}

function LinhaAvaliacao({ a, podeModerar }: { a: AvaliacaoMarketplace; podeModerar: boolean }) {
  const qc = useQueryClient();
  const moderarFn = useServerFn(moderarAvaliacao);
  const mudar = useMutation({
    mutationFn: (moderacao: ModeracaoAvaliacao) => moderarFn({ data: { id: a.id, moderacao } }),
    onSuccess: (_r, moderacao) => {
      toast.success(
        moderacao === "removida" ? "Avaliação removida da vitrine." : "Avaliação publicada.",
      );
      qc.invalidateQueries({ queryKey: CHAVE });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível moderar a avaliação.")),
  });
  const mod = MODERACAO[a.moderacao as ModeracaoAvaliacao] ?? {
    rotulo: a.moderacao,
    tom: "secondary" as Tom,
  };

  return (
    <li className="space-y-1.5 p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-0.5 font-semibold tabular-nums">
          <Star className="size-3.5 text-amber-500" aria-hidden /> {a.nota}
        </span>
        <span className="break-words font-medium">{a.especialista ?? "—"}</span>
        <Badge variant={mod.tom} className={mod.verde ? VERDE : undefined}>
          {mod.rotulo}
        </Badge>
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatData(a.criado_em)}
        </span>
      </div>
      {a.comentario && (
        <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
          {a.comentario}
        </p>
      )}
      {a.resposta && (
        <p className="whitespace-pre-wrap break-words border-l-2 border-border pl-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Resposta:</span> {a.resposta}
        </p>
      )}
      {podeModerar && (
        <div className="flex flex-wrap gap-2 pt-1">
          {a.moderacao !== "publicada" && (
            <Button
              size="sm"
              variant="outline"
              disabled={mudar.isPending}
              onClick={() => mudar.mutate("publicada")}
            >
              {mudar.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Eye className="mr-2 size-4" />
              )}
              Publicar
            </Button>
          )}
          {a.moderacao !== "removida" && (
            <Button
              size="sm"
              variant="ghost"
              disabled={mudar.isPending}
              onClick={() => mudar.mutate("removida")}
            >
              <EyeOff className="mr-2 size-4" /> Remover da vitrine
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
