import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BarChart3,
  BadgeCheck,
  Check,
  CircleDollarSign,
  Eye,
  EyeOff,
  History,
  Inbox,
  MapPin,
  MessageSquareWarning,
  RefreshCw,
  Star,
  Store,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Avatar,
  CabecalhoGestao,
  ChipsFiltro,
  Dado,
  EstadoErro,
  EstadoVazio,
  FaixaIndicadores,
  Indicador,
  ListaCarregando,
  PaginaGestao,
  Secao,
  Selo,
} from "@/components/plataforma/kit";
import { MetricasMarketplace } from "@/components/plataforma/marketplace-metricas";
import {
  BotaoAprovar,
  CHAVE_MARKETPLACE,
  DialogoMotivo,
  NIVEL_PLANO,
  ROTULO_DECISAO,
  conferencia,
  statusEspecialista,
  textosDasRegioes,
} from "@/components/plataforma/marketplace/comum";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL, formatData } from "@/lib/financeiro/format";
import { cn } from "@/lib/utils";
import {
  lerDecisoesMarketplace,
  lerModeracaoMarketplace,
  moderarAvaliacao,
  type Anunciante,
  type AvaliacaoMarketplace,
  type ModeracaoAvaliacao,
  type PerfilEspecialista,
} from "@/lib/plataforma/marketplace.functions";

type Aba = "moderacao" | "avaliacoes" | "anunciantes" | "historico" | "metricas";
const ABAS: Aba[] = ["moderacao", "avaliacoes", "anunciantes", "historico", "metricas"];

export const Route = createFileRoute("/_authenticated/plataforma/marketplace")({
  head: () => ({ meta: [{ title: "Marketplace de especialistas — Gestão de sistemas — Agilliza" }] }),
  validateSearch: (s: Record<string, unknown>): { aba?: Aba } => ({
    aba: typeof s.aba === "string" && (ABAS as string[]).includes(s.aba) ? (s.aba as Aba) : undefined,
  }),
  beforeLoad: () => assertModuloPermitido("saas.marketplace"),
  component: Pagina,
});

type Grupo = "analise" | "aprovado" | "recusado" | "suspenso" | "rascunho" | "todos";

const taxa = (parte: number, todo: number) =>
  todo > 0 ? `${((Number(parte) / Number(todo)) * 100).toFixed(1).replace(".", ",")}%` : "—";

/**
 * Marketplace de especialistas (C61): a moderação ficou clara — cada pedido é um cartão
 * com tudo o que é preciso para decidir e dois botões, Aprovar e Não aprovar (motivo
 * obrigatório, enviado ao especialista). Quem já está no ar pode ser suspenso, com motivo.
 * Toda decisão vai para o Histórico.
 */
function Pagina() {
  const { aba = "moderacao" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const irPara = (a: Aba) => void navigate({ search: { aba: a }, replace: true });
  const lerFn = useServerFn(lerModeracaoMarketplace);
  const q = useQuery({ queryKey: CHAVE_MARKETPLACE, queryFn: () => lerFn(), staleTime: 30_000 });
  const [anunciante, setAnunciante] = useState<string | null>(null);

  const perfis = q.data?.perfis ?? [];
  const avaliacoes = q.data?.avaliacoes ?? [];
  const carteira = q.data?.carteira ?? [];
  const emAnalise = perfis.filter((p) => p.status === "em_analise").length;
  const noAr = perfis.filter((p) => p.status === "aprovado" && p.publicado && !p.oculto_inadimplencia).length;
  const emRevisao = avaliacoes.filter((a) => a.moderacao === "em_revisao").length;
  const receita = carteira.reduce((s, a) => s + Number(a.mensalidade ?? 0), 0);

  return (
    <PaginaGestao>
      <CabecalhoGestao
        titulo="Marketplace de especialistas"
        icone={<Store />}
        descricao="Aprove ou não aprove quem pediu para entrar na vitrine, cuide das avaliações e acompanhe o que cada anunciante entrega."
        acoes={
          <Button variant="outline" size="sm" className="min-h-11 sm:min-h-9" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={cn("mr-1.5 size-4", q.isFetching && "animate-spin")} /> Atualizar
          </Button>
        }
      />

      <FaixaIndicadores>
        <Indicador
          rotulo="Aguardando decisão"
          valor={emAnalise}
          icone={<Inbox />}
          tom={emAnalise > 0 ? "alerta" : "sucesso"}
          carregando={q.isLoading}
          onClick={() => irPara("moderacao")}
        />
        <Indicador rotulo="No ar agora" valor={noAr} icone={<BadgeCheck />} tom="sucesso" carregando={q.isLoading} />
        <Indicador
          rotulo="Avaliações em revisão"
          valor={emRevisao}
          icone={<MessageSquareWarning />}
          tom={emRevisao > 0 ? "alerta" : "neutro"}
          carregando={q.isLoading}
          onClick={() => irPara("avaliacoes")}
        />
        <Indicador
          rotulo="Receita mensal"
          valor={formatBRL(receita)}
          detalhe="Assinaturas ativas dos anunciantes"
          icone={<CircleDollarSign />}
          carregando={q.isLoading}
        />
      </FaixaIndicadores>

      {q.isError && <EstadoErro mensagem={mensagemDeErro(q.error, "Não foi possível ler o marketplace.")} onTentar={() => q.refetch()} />}

      <Tabs value={aba} onValueChange={(v) => irPara(v as Aba)}>
        <TabsList className="h-auto w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="moderacao" className="min-h-11 sm:min-h-9">
            Moderação{emAnalise > 0 ? ` (${emAnalise})` : ""}
          </TabsTrigger>
          <TabsTrigger value="avaliacoes" className="min-h-11 sm:min-h-9">
            Avaliações{emRevisao > 0 ? ` (${emRevisao})` : ""}
          </TabsTrigger>
          <TabsTrigger value="anunciantes" className="min-h-11 sm:min-h-9">
            Anunciantes
          </TabsTrigger>
          <TabsTrigger value="historico" className="min-h-11 sm:min-h-9">
            Histórico
          </TabsTrigger>
          <TabsTrigger value="metricas" className="min-h-11 sm:min-h-9">
            Métricas
          </TabsTrigger>
        </TabsList>
        <TabsContent value="moderacao" className="mt-4">
          <Moderacao perfis={perfis} carregando={q.isLoading} />
        </TabsContent>
        <TabsContent value="avaliacoes" className="mt-4">
          <Avaliacoes avaliacoes={avaliacoes} carregando={q.isLoading} />
        </TabsContent>
        <TabsContent value="anunciantes" className="mt-4">
          <Anunciantes
            linhas={carteira}
            dias={q.data?.dias ?? 30}
            carregando={q.isLoading}
            onMetricas={(id) => {
              setAnunciante(id);
              irPara("metricas");
            }}
          />
        </TabsContent>
        <TabsContent value="historico" className="mt-4">
          <Historico />
        </TabsContent>
        <TabsContent value="metricas" className="mt-4">
          <MetricasMarketplace anunciante={anunciante} onAnunciante={setAnunciante} />
        </TabsContent>
      </Tabs>
    </PaginaGestao>
  );
}

const grupoDe = (p: PerfilEspecialista): Exclude<Grupo, "todos"> =>
  p.status === "em_analise" ? "analise" : (p.status as Exclude<Grupo, "todos" | "analise">);

function Moderacao({ perfis, carregando }: { perfis: PerfilEspecialista[]; carregando: boolean }) {
  const podeModerar = usePermissao("saas.marketplace", "edit");
  const [grupo, setGrupo] = useState<Grupo>("analise");
  const [aberto, setAberto] = useState<PerfilEspecialista | null>(null);
  const [motivo, setMotivo] = useState<{ perfil: PerfilEspecialista; decisao: "nao_aprovar" | "suspender" } | null>(null);
  const conta = (g: Exclude<Grupo, "todos">) => perfis.filter((p) => grupoDe(p) === g).length;
  const visiveis = grupo === "todos" ? perfis : perfis.filter((p) => grupoDe(p) === grupo);
  const atual = aberto ? (perfis.find((p) => p.id === aberto.id) ?? aberto) : null;

  return (
    <div className="space-y-4">
      <ChipsFiltro<Grupo>
        rotulo="Situação dos anúncios"
        valor={grupo}
        onChange={setGrupo}
        opcoes={[
          { valor: "analise", rotulo: "Aguardando decisão", contagem: conta("analise"), tom: "perigo" },
          { valor: "aprovado", rotulo: "Aprovados", contagem: conta("aprovado") },
          { valor: "recusado", rotulo: "Não aprovados", contagem: conta("recusado") },
          { valor: "suspenso", rotulo: "Suspensos", contagem: conta("suspenso") },
          { valor: "rascunho", rotulo: "Rascunhos", contagem: conta("rascunho") },
          { valor: "todos", rotulo: "Todos", contagem: perfis.length },
        ]}
      />
      {!podeModerar && (
        <p className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
          Você pode ver o marketplace, mas não decidir sobre os anúncios.
        </p>
      )}
      {carregando && <ListaCarregando linhas={3} />}
      {!carregando && visiveis.length === 0 && (
        <Secao>
          <EstadoVazio
            icone={<Store />}
            titulo={grupo === "analise" ? "Nenhum pedido esperando decisão" : "Nenhum anúncio nesta situação"}
            descricao={
              grupo === "analise"
                ? "Quando um especialista enviar o anúncio para análise, ele aparece aqui com tudo para você decidir."
                : undefined
            }
          />
        </Secao>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visiveis.map((p) => (
          <CartaoEspecialista
            key={p.id}
            perfil={p}
            podeModerar={podeModerar}
            onAbrir={() => setAberto(p)}
            onMotivo={(decisao) => setMotivo({ perfil: p, decisao })}
          />
        ))}
      </div>

      <DetalheEspecialista
        perfil={atual}
        podeModerar={podeModerar}
        onFechar={() => setAberto(null)}
        onMotivo={(decisao) => atual && setMotivo({ perfil: atual, decisao })}
      />
      <DialogoMotivo
        perfil={motivo?.perfil ?? null}
        decisao={motivo?.decisao ?? "nao_aprovar"}
        aoFechar={() => setMotivo(null)}
      />
    </div>
  );
}

function CartaoEspecialista({
  perfil: p,
  podeModerar,
  onAbrir,
  onMotivo,
}: {
  perfil: PerfilEspecialista;
  podeModerar: boolean;
  onAbrir: () => void;
  onMotivo: (d: "nao_aprovar" | "suspender") => void;
}) {
  const s = statusEspecialista(p.status);
  const itens = conferencia(p);
  const pendentes = itens.filter((i) => !i.ok).length;
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-[14px] border border-border/80 bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)]">
      <button type="button" onClick={onAbrir} className="relative block text-left" aria-label={`Ver o anúncio de ${p.nome}`}>
        {p.capa_url ? (
          <img src={p.capa_url} alt="" className="h-28 w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-28 w-full items-center justify-center gap-1.5 bg-secondary text-xs text-muted-foreground">
            sem capa
          </div>
        )}
        <span className="absolute right-2 top-2">
          <Selo tom={s.tom} ponto={p.status === "aprovado"} className="bg-card/95">
            {s.rotulo}
          </Selo>
        </span>
      </button>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="relative z-10 -mt-9 flex items-end gap-3">
          {p.foto_url ? (
            <img src={p.foto_url} alt="" className="size-14 shrink-0 rounded-full border-2 border-card object-cover shadow-sm" />
          ) : (
            <span className="grid size-14 shrink-0 place-items-center rounded-full border-2 border-card bg-secondary text-lg font-medium text-muted-foreground shadow-sm">
              {p.nome.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="-mt-1 min-w-0">
          <h3 className="line-clamp-2 break-words text-[15px] font-semibold leading-snug">{p.nome}</h3>
          <p className="truncate text-xs text-muted-foreground">{p.conta ?? "Conta sem nome"}</p>
        </div>
        {p.chamada && <p className="line-clamp-2 text-sm text-muted-foreground">{p.chamada}</p>}
        <dl className="grid grid-cols-2 gap-2">
          <Dado rotulo="Registro">
            {p.registro_tipo ? `${p.registro_tipo} ${p.registro_numero ?? ""}${p.registro_uf ? `/${p.registro_uf}` : ""}` : "não informado"}
          </Dado>
          <Dado rotulo="Validade">{p.registro_validade ? formatData(p.registro_validade) : "—"}</Dado>
          <Dado rotulo="Plano">{NIVEL_PLANO[p.plano_codigo ?? ""] ?? p.plano_codigo ?? "—"}</Dado>
          <Dado rotulo="Pedido em">{formatData(p.criado_em)}</Dado>
        </dl>
        <div className="flex flex-wrap gap-1">
          {(p.categorias ?? []).slice(0, 3).map((c) => (
            <Selo key={c} tom="marca">
              {c.replace(/_/g, " ")}
            </Selo>
          ))}
          {textosDasRegioes(p.regioes)
            .slice(0, 2)
            .map((r) => (
              <Selo key={r}>
                <MapPin className="mr-0.5 inline size-3" />
                {r}
              </Selo>
            ))}
        </div>
        <ul className="grid gap-1 rounded-lg bg-secondary/40 p-2.5 text-xs">
          {itens.map((i) => (
            <li key={i.rotulo} className={cn("flex items-center gap-1.5", i.ok ? "text-foreground" : "text-destructive")}>
              {i.ok ? <Check className="size-3.5 text-success-texto" /> : <X className="size-3.5" />}
              {i.rotulo}
            </li>
          ))}
        </ul>
        {p.motivo_status && (p.status === "recusado" || p.status === "suspenso") && (
          <p className="rounded-lg border border-destructive/20 bg-destructive/[0.04] px-2.5 py-1.5 text-xs text-destructive">
            Motivo enviado: {p.motivo_status}
          </p>
        )}
        <div className="mt-auto space-y-2 pt-1">
          {podeModerar && (
            <div className="grid grid-cols-2 gap-2">
              {p.status !== "aprovado" && <BotaoAprovar perfil={p} className="min-h-11 w-full sm:min-h-9" />}
              {(p.status === "em_analise" || p.status === "rascunho") && (
                <Button
                  variant="outline"
                  className="min-h-11 w-full border-destructive/40 text-destructive hover:bg-destructive/5 sm:min-h-9"
                  onClick={() => onMotivo("nao_aprovar")}
                >
                  <X className="mr-1.5 size-4" /> Não aprovar
                </Button>
              )}
              {p.status === "aprovado" && (
                <Button variant="outline" className="col-span-2 min-h-11 w-full sm:min-h-9" onClick={() => onMotivo("suspender")}>
                  Suspender
                </Button>
              )}
            </div>
          )}
          <Button variant="ghost" size="sm" className="min-h-11 w-full text-muted-foreground sm:min-h-8" onClick={onAbrir}>
            Ver o anúncio completo{pendentes > 0 ? ` · ${pendentes} pendência(s)` : ""}
          </Button>
        </div>
      </div>
    </article>
  );
}

function DetalheEspecialista({
  perfil: p,
  podeModerar,
  onFechar,
  onMotivo,
}: {
  perfil: PerfilEspecialista | null;
  podeModerar: boolean;
  onFechar: () => void;
  onMotivo: (d: "nao_aprovar" | "suspender") => void;
}) {
  const historicoFn = useServerFn(lerDecisoesMarketplace);
  const h = useQuery({
    queryKey: [...CHAVE_MARKETPLACE, "historico", p?.id],
    queryFn: () => historicoFn({ data: { especialista: p!.id } }),
    enabled: !!p,
  });
  const s = p ? statusEspecialista(p.status) : null;
  return (
    <Sheet open={!!p} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        {p && s && (
          <>
            <SheetHeader className="border-b border-border px-5 py-4 text-left">
              <SheetTitle className="pr-8">{p.nome}</SheetTitle>
              <SheetDescription>
                {p.conta ?? "Conta sem nome"} · pediu entrada em {formatData(p.criado_em)}
              </SheetDescription>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Selo tom={s.tom}>{s.rotulo}</Selo>
                {p.oculto_inadimplencia && <Selo tom="perigo">Oculto por falta de pagamento</Selo>}
                {p.total_avaliacoes > 0 && (
                  <Selo tom="info">
                    <Star className="mr-0.5 inline size-3" /> {Number(p.nota_media ?? 0).toFixed(1)} ({p.total_avaliacoes})
                  </Selo>
                )}
              </div>
            </SheetHeader>
            <div className="space-y-4 px-5 py-4">
              <div className="overflow-hidden rounded-xl border border-border">
                {p.capa_url ? (
                  <img src={p.capa_url} alt={`Capa do anúncio de ${p.nome}`} className="aspect-[16/7] w-full object-cover" />
                ) : (
                  <div className="flex aspect-[16/7] items-center justify-center bg-secondary text-xs text-muted-foreground">sem capa</div>
                )}
                <div className="flex items-center gap-3 p-3">
                  <Avatar nome={p.nome} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.nome}</p>
                    <p className="text-sm text-muted-foreground">{p.chamada ?? "sem chamada"}</p>
                  </div>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border p-4">
                <Dado rotulo="Tipo de registro">{p.registro_tipo ?? "—"}</Dado>
                <Dado rotulo="Número">{p.registro_numero ?? "—"}</Dado>
                <Dado rotulo="UF">{p.registro_uf ?? "—"}</Dado>
                <Dado rotulo="Validade">{p.registro_validade ? formatData(p.registro_validade) : "—"}</Dado>
                <Dado rotulo="Plano">{NIVEL_PLANO[p.plano_codigo ?? ""] ?? p.plano_codigo ?? "—"}</Dado>
                <Dado rotulo="Perfil público">{p.publicado ? `/${p.slug}` : "não publicado"}</Dado>
              </dl>
              <section className="rounded-xl border border-border p-4">
                <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Apresentação</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {p.apresentacao || "Sem apresentação escrita."}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(p.categorias ?? []).map((c) => (
                    <Selo key={`c-${c}`} tom="marca">
                      {c.replace(/_/g, " ")}
                    </Selo>
                  ))}
                  {(p.especialidades ?? []).map((e) => (
                    <Selo key={`e-${e}`}>{e}</Selo>
                  ))}
                  {textosDasRegioes(p.regioes).map((r) => (
                    <Selo key={`r-${r}`}>{r}</Selo>
                  ))}
                </div>
              </section>
              <section className="rounded-xl border border-border">
                <h3 className="flex items-center gap-1.5 border-b border-border px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <History className="size-3.5" /> Decisões deste anúncio
                </h3>
                {h.isLoading && <ListaCarregando linhas={2} />}
                {h.data && h.data.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">Nenhuma decisão registrada ainda.</p>}
                <ul className="divide-y divide-border/70">
                  {(h.data ?? []).map((d) => (
                    <li key={d.id} className="px-4 py-2.5 text-sm">
                      <p>
                        <span className="font-medium">{ROTULO_DECISAO[d.decisao]}</span> por {d.moderador ?? "—"} ·{" "}
                        <span className="text-muted-foreground">{new Date(d.criado_em).toLocaleString("pt-BR")}</span>
                      </p>
                      {d.motivo && <p className="text-xs text-muted-foreground">Motivo: {d.motivo}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
            {podeModerar && (
              <footer className="sticky bottom-0 flex flex-col gap-2 border-t border-border bg-card px-5 py-3 sm:flex-row">
                {p.status !== "aprovado" && <BotaoAprovar perfil={p} className="min-h-11 flex-1 sm:min-h-9" onFeito={onFechar} />}
                {(p.status === "em_analise" || p.status === "rascunho") && (
                  <Button variant="outline" className="min-h-11 flex-1 border-destructive/40 text-destructive sm:min-h-9" onClick={() => onMotivo("nao_aprovar")}>
                    <X className="mr-1.5 size-4" /> Não aprovar
                  </Button>
                )}
                {p.status === "aprovado" && (
                  <Button variant="outline" className="min-h-11 flex-1 sm:min-h-9" onClick={() => onMotivo("suspender")}>
                    Suspender
                  </Button>
                )}
              </footer>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

type GrupoAvaliacao = "em_revisao" | "publicada" | "removida" | "todas";

function Avaliacoes({ avaliacoes, carregando }: { avaliacoes: AvaliacaoMarketplace[]; carregando: boolean }) {
  const podeModerar = usePermissao("saas.marketplace", "edit");
  const [filtro, setFiltro] = useState<GrupoAvaliacao>("em_revisao");
  const visiveis = filtro === "todas" ? avaliacoes : avaliacoes.filter((a) => a.moderacao === filtro);
  const conta = (m: ModeracaoAvaliacao) => avaliacoes.filter((a) => a.moderacao === m).length;
  return (
    <div className="space-y-4">
      <ChipsFiltro<GrupoAvaliacao>
        rotulo="Situação das avaliações"
        valor={filtro}
        onChange={setFiltro}
        opcoes={[
          { valor: "em_revisao", rotulo: "Em revisão", contagem: conta("em_revisao"), tom: "perigo" },
          { valor: "publicada", rotulo: "Publicadas", contagem: conta("publicada") },
          { valor: "removida", rotulo: "Removidas", contagem: conta("removida") },
          { valor: "todas", rotulo: "Todas", contagem: avaliacoes.length },
        ]}
      />
      <Secao semRespiro descricao="Remover tira da vitrine sem apagar o registro; a nota do especialista é recalculada." titulo="Avaliações dos corretores">
        {carregando && <ListaCarregando linhas={3} />}
        {!carregando && visiveis.length === 0 && <EstadoVazio icone={<Star />} titulo="Nenhuma avaliação neste recorte" />}
        <ul className="divide-y divide-border/60">
          {visiveis.map((a) => (
            <LinhaAvaliacao key={a.id} a={a} podeModerar={podeModerar} />
          ))}
        </ul>
      </Secao>
    </div>
  );
}

function LinhaAvaliacao({ a, podeModerar }: { a: AvaliacaoMarketplace; podeModerar: boolean }) {
  const qc = useQueryClient();
  const moderarFn = useServerFn(moderarAvaliacao);
  const mudar = useMutation({
    mutationFn: (moderacao: ModeracaoAvaliacao) => moderarFn({ data: { id: a.id, moderacao } }),
    onSuccess: (_r, moderacao) => {
      toast.success(moderacao === "removida" ? "Avaliação removida da vitrine." : "Avaliação publicada.");
      qc.invalidateQueries({ queryKey: CHAVE_MARKETPLACE });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível moderar a avaliação.")),
  });
  const tom = a.moderacao === "publicada" ? "sucesso" : a.moderacao === "removida" ? "neutro" : "alerta";
  const rotulo = a.moderacao === "publicada" ? "Publicada" : a.moderacao === "removida" ? "Removida" : "Em revisão";
  return (
    <li className="space-y-1.5 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-sm font-medium tabular-nums text-amber-700">
          <Star className="size-3.5" aria-hidden /> {a.nota}
        </span>
        <span className="min-w-0 truncate text-sm font-medium">{a.especialista ?? "—"}</span>
        <Selo tom={tom}>{rotulo}</Selo>
        <span className="text-xs tabular-nums text-muted-foreground">{formatData(a.criado_em)}</span>
      </div>
      {a.comentario && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{a.comentario}</p>}
      {a.resposta && (
        <p className="whitespace-pre-wrap break-words border-l-2 border-primary/30 pl-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Resposta do especialista:</span> {a.resposta}
        </p>
      )}
      {podeModerar && (
        <div className="flex flex-wrap gap-2 pt-1">
          {a.moderacao !== "publicada" && (
            <Button size="sm" variant="outline" className="min-h-11 sm:min-h-8" disabled={mudar.isPending} onClick={() => mudar.mutate("publicada")}>
              <Eye className="mr-1.5 size-4" /> Publicar
            </Button>
          )}
          {a.moderacao !== "removida" && (
            <Button size="sm" variant="ghost" className="min-h-11 sm:min-h-8" disabled={mudar.isPending} onClick={() => mudar.mutate("removida")}>
              <EyeOff className="mr-1.5 size-4" /> Remover da vitrine
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

function Anunciantes({
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
  return (
    <Secao
      titulo="Carteira de anunciantes"
      descricao={`O que cada um entrega e o que paga, nos últimos ${dias} dias.`}
      acoes={
        <Button size="sm" variant="outline" className="min-h-11 sm:min-h-8" onClick={() => onMetricas(null)}>
          <BarChart3 className="mr-1.5 size-4" /> Métricas por período
        </Button>
      }
      semRespiro
    >
      {carregando && <ListaCarregando linhas={3} />}
      {!carregando && linhas.length === 0 && (
        <EstadoVazio
          icone={<Store />}
          titulo="Nenhum anunciante ainda"
          descricao="Quando um especialista for aprovado, ele aparece aqui com o que entrega e o que paga."
        />
      )}
      <ul className="divide-y divide-border/60">
        {linhas.map((a) => {
          const noAr = a.status === "aprovado" && a.publicado && !a.oculto_inadimplencia;
          return (
            <li key={a.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto] sm:items-center">
              <div className="min-w-0">
                <p className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{a.nome}</span>
                  {noAr ? (
                    <Selo tom="sucesso" ponto>
                      no ar
                    </Selo>
                  ) : a.oculto_inadimplencia ? (
                    <Selo tom="perigo">fora por pagamento</Selo>
                  ) : (
                    <Selo>{statusEspecialista(a.status).rotulo}</Selo>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.conta ?? "—"} · {NIVEL_PLANO[a.plano_codigo ?? ""] ?? a.plano_codigo ?? "—"}
                  {a.mensalidade ? ` · ${formatBRL(Number(a.mensalidade))}/mês` : ""}
                </p>
              </div>
              <Metrica rotulo="Apareceu" valor={Number(a.impressoes)} sub={`${Number(a.pessoas).toLocaleString("pt-BR")} pessoas`} />
              <Metrica rotulo="Clicaram" valor={Number(a.cliques)} sub={`${taxa(a.cliques, a.impressoes)} de quem viu`} />
              <Metrica rotulo="Contatos" valor={Number(a.conversoes)} sub={`${taxa(a.conversoes, a.cliques)} de quem clicou`} destaque />
              <Button size="sm" variant="ghost" className="min-h-11 justify-self-start sm:min-h-8" onClick={() => onMetricas(a.id)}>
                <BarChart3 className="mr-1.5 size-4" /> Métricas
              </Button>
            </li>
          );
        })}
      </ul>
    </Secao>
  );
}

function Metrica({ rotulo, valor, sub, destaque }: { rotulo: string; valor: number; sub: string; destaque?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className={cn("text-sm font-medium tabular-nums", destaque && valor > 0 && "text-success-texto")}>
        {valor.toLocaleString("pt-BR")}
      </p>
      <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function Historico() {
  const historicoFn = useServerFn(lerDecisoesMarketplace);
  const q = useQuery({
    queryKey: [...CHAVE_MARKETPLACE, "historico", "todos"],
    queryFn: () => historicoFn({ data: {} }),
    staleTime: 30_000,
  });
  return (
    <Secao titulo="Histórico de decisões" descricao="Cada Aprovar, Não aprovar e Suspender, com quem decidiu e o motivo enviado." semRespiro>
      {q.isLoading && <ListaCarregando linhas={4} />}
      {q.isError && <EstadoErro mensagem={mensagemDeErro(q.error, "Não foi possível ler o histórico.")} onTentar={() => q.refetch()} />}
      {q.data && q.data.length === 0 && <EstadoVazio icone={<History />} titulo="Nenhuma decisão registrada ainda" />}
      <ul className="divide-y divide-border/60">
        {(q.data ?? []).map((d) => (
          <li key={d.id} className="flex items-start gap-3 px-4 py-3">
            <Avatar nome={d.moderador} tamanho="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-medium">{d.especialista}</span>{" "}
                <Selo tom={d.decisao === "aprovar" ? "sucesso" : d.decisao === "nao_aprovar" ? "perigo" : "alerta"}>
                  {ROTULO_DECISAO[d.decisao]}
                </Selo>
              </p>
              {d.motivo && <p className="mt-0.5 text-xs text-muted-foreground">Motivo: {d.motivo}</p>}
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {d.moderador ?? "—"} · {new Date(d.criado_em).toLocaleString("pt-BR")}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Secao>
  );
}
