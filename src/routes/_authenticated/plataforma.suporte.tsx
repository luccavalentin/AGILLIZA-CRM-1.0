import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ChevronRight,
  Filter,
  Headset,
  LifeBuoy,
  MessageSquare,
  RefreshCw,
  Search,
  Star,
  UserX,
} from "lucide-react";
import { AdminHero } from "@/components/admin/admin-hero";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { RodapePaginas, useValorAssentado } from "@/components/plataforma/paginacao";
import {
  POR_PAGINA_CHAMADOS,
  PRIORIDADES_CHAMADO,
  STATUS_CHAMADO,
  listarChamados,
  type Chamado,
  type PrioridadeChamado,
  type RecorteChamado,
  type StatusChamado,
} from "@/lib/plataforma/suporte.functions";
import {
  CATEGORIA_ROTULO,
  GavetaChamado,
  PRIORIDADE_ROTULO,
  STATUS_ROTULO,
  STATUS_TOM,
  relativo,
} from "@/components/plataforma/suporte-chamado";
import { BaseConhecimento } from "@/components/plataforma/suporte-base";

export const Route = createFileRoute("/_authenticated/plataforma/suporte")({
  head: () => ({ meta: [{ title: "Suporte — Plataforma — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("saas.suporte"),
  component: Pagina,
});

const RECORTE_ROTULO: Record<RecorteChamado, string> = {
  abertos: "os chamados em aberto",
  atrasados: "os chamados fora do SLA",
  "sem-responsavel": "os chamados sem responsável",
  avaliados: "os chamados avaliados",
};

function Pagina() {
  const listarFn = useServerFn(listarChamados);
  const podeAtender = usePermissao("saas.suporte", "edit");
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<"todos" | StatusChamado>("todos");
  const [prioridade, setPrioridade] = useState<"todas" | PrioridadeChamado>("todas");
  const [conta, setConta] = useState<string>("todas");
  const [recorte, setRecorte] = useState<RecorteChamado | null>(null);
  const [escolhido, setEscolhido] = useState<Chamado | null>(null);
  const termo = useValorAssentado(busca.trim());
  // A página vale para o filtro em que foi escolhida: mudou o filtro, volta para a primeira.
  const chaveFiltro = JSON.stringify([status, prioridade, conta, recorte, termo]);
  const [paginaDe, setPaginaDe] = useState({ chave: chaveFiltro, pagina: 1 });
  const pagina = paginaDe.chave === chaveFiltro ? paginaDe.pagina : 1;

  const q = useQuery({
    queryKey: ["plataforma-suporte", "fila", status, prioridade, conta, recorte, termo, pagina],
    queryFn: () =>
      listarFn({
        data: {
          status: status === "todos" ? null : status,
          prioridade: prioridade === "todas" ? null : prioridade,
          conta: conta === "todas" ? null : conta,
          recorte,
          busca: termo || null,
          pagina,
        },
      }),
    refetchInterval: 60_000,
    placeholderData: (anterior) => anterior,
  });
  const chamados = q.data?.chamados ?? [];
  const resumo = q.data?.resumo;
  const contas = q.data?.contas ?? [];
  const porStatus = (s: StatusChamado) =>
    resumo?.por_status.find((x) => x.status === s)?.total ?? 0;

  // O chamado mostrado é sempre o da lista mais recente (situação e responsável mudam
  // depois de responder); o guardado só vale se ele sair da lista por causa de um filtro.
  const aberto = escolhido ? (chamados.find((c) => c.id === escolhido.id) ?? escolhido) : null;
  const abertos = chamados.filter((c) => !c.resolvido_em);
  const maisUrgente = abertos.find((c) => c.atrasado) ?? abertos[0] ?? null;

  const filtrando =
    status !== "todos" || prioridade !== "todas" || conta !== "todas" || !!recorte || !!busca;
  const limpar = () => {
    setStatus("todos");
    setPrioridade("todas");
    setConta("todas");
    setRecorte(null);
    setBusca("");
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AdminHero
        secao="Gestão de sistemas"
        icon={<LifeBuoy className="h-5 w-5" />}
        titulo="Suporte"
        descricao="Os chamados das contas (corretores, imobiliárias e parceiros), com o prazo que o plano de cada uma promete."
        acoes={
          <div className="flex flex-wrap gap-2">
            {maisUrgente && (
              <Button size="sm" onClick={() => setEscolhido(maisUrgente)}>
                <Headset className="mr-2 size-4" /> Atender o mais urgente
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
              <RefreshCw className={`mr-2 size-4 ${q.isFetching ? "animate-spin" : ""}`} />{" "}
              Atualizar
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="chamados">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="chamados" className="flex-1 sm:flex-none">
            Chamados
          </TabsTrigger>
          <TabsTrigger value="base" className="flex-1 sm:flex-none">
            Base de conhecimento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chamados" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Indicador
              rotulo="Em aberto"
              valor={resumo?.abertos}
              detalhe="esperando quem atende"
              icone={<LifeBuoy className="size-4" />}
              ativo={recorte === "abertos"}
              onClick={() => setRecorte(recorte === "abertos" ? null : "abertos")}
            />
            <Indicador
              rotulo="Fora do SLA"
              valor={resumo?.atrasados}
              detalhe="prazo do plano vencido"
              icone={<AlertTriangle className="size-4" />}
              alerta={(resumo?.atrasados ?? 0) > 0}
              ativo={recorte === "atrasados"}
              onClick={() => setRecorte(recorte === "atrasados" ? null : "atrasados")}
            />
            <Indicador
              rotulo="Sem responsável"
              valor={resumo?.sem_responsavel}
              detalhe="ninguém assumiu"
              icone={<UserX className="size-4" />}
              ativo={recorte === "sem-responsavel"}
              onClick={() => setRecorte(recorte === "sem-responsavel" ? null : "sem-responsavel")}
            />
            <Indicador
              rotulo="Nota média"
              valor={resumo?.media != null ? resumo.media.toFixed(1) : resumo ? "—" : undefined}
              detalhe={`${resumo?.avaliacoes ?? 0} avaliação(ões)`}
              icone={<Star className="size-4" />}
              ativo={recorte === "avaliados"}
              onClick={() => setRecorte(recorte === "avaliados" ? null : "avaliados")}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Label htmlFor="sup-busca" className="sr-only">
                Buscar chamado
              </Label>
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="sup-busca"
                className="pl-9"
                placeholder="Buscar por assunto ou código"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger className="lg:w-52" aria-label="Situação do chamado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as situações ({resumo?.total ?? 0})</SelectItem>
                {STATUS_CHAMADO.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_ROTULO[s]} ({porStatus(s)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={prioridade} onValueChange={(v) => setPrioridade(v as typeof prioridade)}>
              <SelectTrigger className="lg:w-44" aria-label="Prioridade">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as prioridades</SelectItem>
                {PRIORIDADES_CHAMADO.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORIDADE_ROTULO[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={conta} onValueChange={setConta}>
              <SelectTrigger className="lg:w-56" aria-label="Conta">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as contas</SelectItem>
                {contas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtrando && (
            <p className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              <Filter className="size-4 shrink-0" />
              {recorte ? `Mostrando só ${RECORTE_ROTULO[recorte]}.` : "Filtros aplicados."}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={limpar}
              >
                Ver todos
              </button>
            </p>
          )}

          <section className="rounded-lg border border-border bg-card">
            <div className="border-b border-border p-4">
              <h2 className="text-sm font-semibold">Fila de atendimento</h2>
              <p className="text-xs text-muted-foreground">
                Fora do SLA e prazo mais curto primeiro. Tocar abre a conversa.
              </p>
            </div>
            {q.isLoading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : q.isError ? (
              <p className="p-4 text-sm text-destructive">
                {mensagemDeErro(q.error, "Não foi possível carregar os chamados.")}
              </p>
            ) : chamados.length === 0 ? (
              <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                <LifeBuoy className="size-4 shrink-0" />
                {filtrando
                  ? "Nenhum chamado com estes filtros."
                  : "Nenhuma conta abriu chamado ainda. Os chamados abertos pelo botão de ajuda do sistema aparecem aqui, com o prazo do plano de cada conta."}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {chamados.map((c) => (
                  <li key={c.id}>
                    <LinhaChamado c={c} onAbrir={() => setEscolhido(c)} />
                  </li>
                ))}
              </ul>
            )}
            <RodapePaginas
              pagina={pagina}
              porPagina={POR_PAGINA_CHAMADOS}
              quantidade={chamados.length}
              total={q.data?.totalFiltro}
              carregando={q.isFetching}
              onPagina={(p) => setPaginaDe({ chave: chaveFiltro, pagina: p })}
            />
          </section>
        </TabsContent>

        <TabsContent value="base" className="mt-4">
          <BaseConhecimento podeEditar={podeAtender} />
        </TabsContent>
      </Tabs>

      <GavetaChamado
        chamado={aberto}
        podeAtender={podeAtender}
        onFechar={() => setEscolhido(null)}
      />
    </div>
  );
}

function LinhaChamado({ c, onAbrir }: { c: Chamado; onAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
    >
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
          c.atrasado
            ? "bg-destructive/10 text-destructive"
            : c.resolvido_em
              ? "bg-emerald-500/10 text-emerald-700"
              : c.prioridade === "alta" || c.prioridade === "urgente"
                ? "bg-amber-500/15 text-amber-700"
                : "bg-primary/10 text-primary"
        }`}
        aria-hidden
      >
        <MessageSquare className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="break-words font-medium">{c.assunto}</span>
          <Badge variant={STATUS_TOM[c.status] ?? "secondary"}>
            {STATUS_ROTULO[c.status] ?? c.status}
          </Badge>
          {c.prioridade === "urgente" && <Badge variant="destructive">Urgente</Badge>}
          {c.prioridade === "alta" && <Badge variant="secondary">Alta</Badge>}
          {c.atrasado && <Badge variant="destructive">Fora do SLA</Badge>}
        </span>
        <span className="mt-0.5 block break-words text-xs text-muted-foreground">
          <span className="tabular-nums">{c.codigo}</span> · {c.conta ?? "sem conta"} ·{" "}
          {c.autor ?? "—"} · {CATEGORIA_ROTULO[c.categoria] ?? c.categoria}
          {c.responsavel ? ` · com ${c.responsavel}` : " · sem responsável"} · {c.mensagens}{" "}
          mensagem(ns)
        </span>
        <span
          className={`mt-0.5 block text-xs ${c.atrasado ? "font-medium text-destructive" : "text-muted-foreground"}`}
        >
          {c.resolvido_em
            ? `resolvido ${relativo(c.resolvido_em)}`
            : c.sla_ate
              ? `prazo ${relativo(c.sla_ate)}`
              : `recebido ${relativo(c.criado_em)}`}
          {c.avaliacao != null && ` · nota ${c.avaliacao} de 5`}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}

function Indicador({
  rotulo,
  valor,
  detalhe,
  icone,
  alerta,
  ativo,
  onClick,
}: {
  rotulo: string;
  valor: string | number | undefined;
  detalhe: string;
  icone: React.ReactNode;
  alerta?: boolean;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/40 ${
        ativo
          ? "border-primary ring-1 ring-primary"
          : alerta
            ? "border-destructive/50"
            : "border-border"
      }`}
    >
      <span className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs uppercase tracking-wide">{rotulo}</span>
        {icone}
      </span>
      {valor === undefined ? (
        <Skeleton className="mt-2 h-7 w-12" />
      ) : (
        <span
          className={`mt-1 block text-2xl font-semibold tabular-nums ${alerta ? "text-destructive" : "text-foreground"}`}
        >
          {valor}
        </span>
      )}
      <span className="mt-0.5 block text-xs text-muted-foreground">{detalhe}</span>
    </button>
  );
}
