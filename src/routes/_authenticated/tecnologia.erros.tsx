import { useDeferredValue, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Activity,
  Bug,
  Layers,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  Monitor,
  RotateCcw,
  Search,
  Server,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  COR,
  EstadoErro,
  EstadoVazio,
  Esqueleto,
  Kpi,
  MiniBarras,
  Painel,
  SeloAoVivo,
  Segmentos,
  diaHora,
  fmtNum,
  ha,
  hora,
} from "@/components/tecnologia/base";
import { GraficoSerie, Legenda } from "@/components/tecnologia/grafico-serie";
import { MarcaNavegador, MarcaServico, MarcaSistemaOp } from "@/components/tecnologia/marcas";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { usePermissao } from "@/hooks/use-permissao";
import { cn } from "@/lib/utils";
import { lerErros, marcarErro, type ErroAgrupado } from "@/lib/tecnologia/tecnologia.functions";

export const Route = createFileRoute("/_authenticated/tecnologia/erros")({
  head: () => ({ meta: [{ title: "Erros — Gestão de Tecnologia — Agilliza" }] }),
  component: Erros,
});

type Sistema = "todos" | "corretor" | "agilliza";
type Origem = "todas" | "navegador" | "servidor";
type Situacao = "aberto" | "resolvido" | "todos";
type Ordem = "recentes" | "frequentes";

const PERFIL: Record<string, string> = {
  corretor: "corretor",
  imobiliaria: "imobiliária",
  parceiro: "parceiro",
  cliente: "cliente",
  plataforma: "plataforma",
  equipe: "equipe Agilliza",
  anonimo: "sem login",
};

function Erros() {
  const [sistema, setSistema] = useState<Sistema>("todos");
  const [origem, setOrigem] = useState<Origem>("todas");
  const [situacao, setSituacao] = useState<Situacao>("aberto");
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  const [busca, setBusca] = useState("");
  const buscaAdiada = useDeferredValue(busca.trim());

  const lerFn = useServerFn(lerErros);
  const q = useQuery({
    queryKey: ["tecnologia", "erros", sistema, origem, situacao, ordem, buscaAdiada],
    queryFn: () =>
      lerFn({
        data: {
          sistema: sistema === "todos" ? null : sistema,
          origem: origem === "todas" ? null : origem,
          status: situacao,
          busca: buscaAdiada,
          ordem,
        },
      }),
    refetchInterval: 30_000,
    placeholderData: (a) => a,
  });
  const lista = q.data?.lista;
  const r = lista?.resumo;
  const podeEditar = usePermissao("saas.tecnologia", "edit") && Boolean(q.data?.podeResolver);

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Erros dos usuários</h2>
          <p className="text-xs text-muted-foreground">
            O que quebrou no navegador e no servidor, agrupado. Sem dados pessoais: e-mail, CPF,
            telefone e nomes são removidos antes de gravar.
          </p>
        </div>
        <SeloAoVivo
          atualizadoEm={q.dataUpdatedAt || null}
          atualizando={q.isFetching}
          falhou={q.isError}
          intervaloS={30}
          onAtualizar={() => q.refetch()}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          rotulo="Grupos em aberto"
          cor="vermelho"
          icone={<Bug className="size-4" />}
          carregando={q.isLoading}
          tom={(r?.abertos ?? 0) > 0 ? "atencao" : "ok"}
          valor={fmtNum(r?.abertos)}
        />
        <Kpi
          rotulo="Novos em 24 h"
          cor="amarelo"
          icone={<Sparkles />}
          carregando={q.isLoading}
          tom={(r?.novos_24h ?? 0) > 0 ? "atencao" : "ok"}
          valor={fmtNum(r?.novos_24h)}
        />
        <Kpi
          rotulo="Ocorrências em 24 h"
          cor="roxo"
          icone={<Activity />}
          carregando={q.isLoading}
          valor={fmtNum(r?.ocorrencias_24h)}
        />
        <Kpi
          rotulo="Por sistema (abertos)"
          cor="azul"
          icone={<Layers />}
          carregando={q.isLoading}
          valor={
            <span className="text-2xl">
              {fmtNum(r?.corretor)} · {fmtNum(r?.agilliza)}
            </span>
          }
          rodape="Corretor · Agilliza"
        />
      </div>

      <Painel titulo="Ocorrências por hora" descricao="Últimas 24 horas, por sistema.">
        {q.isLoading ? (
          <Esqueleto className="h-[160px]" />
        ) : (
          <>
            <GraficoSerie
              dados={lista?.serie_24h ?? []}
              chaveX="hora"
              rotuloX={hora}
              altura="h-[150px] sm:h-[170px]"
              series={[
                { chave: "corretor", rotulo: "Corretor", cor: COR.primaria, tipo: "barra" },
                { chave: "agilliza", rotulo: "Agilliza", cor: COR.alerta, tipo: "barra" },
              ]}
            />
            <Legenda
              series={[
                { rotulo: "Corretor", cor: COR.primaria },
                { rotulo: "Agilliza", cor: COR.alerta },
              ]}
            />
          </>
        )}
      </Painel>

      {/* Filtros: linha própria que rola no celular; a página nunca rola de lado. */}
      <div className="space-y-2">
        <label className="relative block">
          <span className="sr-only">Buscar</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar erro, rota ou navegador"
            className="h-11 pl-9"
            maxLength={80}
          />
        </label>
        <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <Segmentos
            rotulo="Sistema"
            valor={sistema}
            onChange={setSistema}
            className="shrink-0"
            opcoes={[
              { valor: "todos", rotulo: "Todos" },
              { valor: "corretor", rotulo: "Corretor" },
              { valor: "agilliza", rotulo: "Agilliza" },
            ]}
          />
          <Segmentos
            rotulo="Origem"
            valor={origem}
            onChange={setOrigem}
            className="shrink-0"
            opcoes={[
              { valor: "todas", rotulo: "Navegador e servidor" },
              { valor: "navegador", rotulo: "Navegador" },
              { valor: "servidor", rotulo: "Servidor" },
            ]}
          />
          <Segmentos
            rotulo="Situação"
            valor={situacao}
            onChange={setSituacao}
            className="shrink-0"
            opcoes={[
              { valor: "aberto", rotulo: "Abertos" },
              { valor: "resolvido", rotulo: "Resolvidos" },
              { valor: "todos", rotulo: "Todos" },
            ]}
          />
          <Segmentos
            rotulo="Ordem"
            valor={ordem}
            onChange={setOrdem}
            className="shrink-0"
            opcoes={[
              { valor: "recentes", rotulo: "Mais recentes" },
              { valor: "frequentes", rotulo: "Mais frequentes" },
            ]}
          />
        </div>
      </div>

      {q.isError && (
        <EstadoErro
          erro={q.error}
          alternativa="Não foi possível ler os erros."
          onTentar={() => q.refetch()}
        />
      )}

      {q.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Esqueleto key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : !lista?.itens.length ? (
        <Painel>
          <EstadoVazio
            icone={<CheckCircle2 className="size-5 text-success" />}
            titulo={
              buscaAdiada || sistema !== "todos" || origem !== "todas"
                ? "Nenhum erro com esses filtros"
                : "Nenhum erro em aberto"
            }
            texto="Quando alguém vir uma falha no Agilliza ou no Corretor, ela aparece aqui em segundos."
          />
        </Painel>
      ) : (
        <ul className="space-y-3">
          {lista.itens.map((e) => (
            <CartaoErro key={e.id} erro={e} podeEditar={podeEditar} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CartaoErro({ erro: e, podeEditar }: { erro: ErroAgrupado; podeEditar: boolean }) {
  const [aberto, setAberto] = useState(false);
  const qc = useQueryClient();
  const marcarFn = useServerFn(marcarErro);
  const m = useMutation({
    mutationFn: (status: "aberto" | "resolvido") => marcarFn({ data: { id: e.id, status } }),
    onSuccess: (_d, status) => {
      toast.success(status === "resolvido" ? "Erro marcado como resolvido." : "Erro reaberto.");
      void qc.invalidateQueries({ queryKey: ["tecnologia", "erros"] });
    },
    onError: (err) => toast.error(mensagemDeErro(err, "Não foi possível atualizar o erro.")),
  });
  const novo = Date.now() - new Date(e.primeira_em).getTime() < 24 * 3_600_000;

  return (
    <li
      className={cn(
        "min-w-0 rounded-xl border bg-card",
        e.status === "resolvido" ? "border-border opacity-75" : "border-border",
      )}
    >
      <div className="flex gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 font-medium text-foreground">
              <MarcaServico servico={e.sistema} className="size-3.5" />
              {e.sistema === "corretor" ? "Corretor" : "Agilliza"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-muted-foreground">
              {e.origem === "servidor" ? (
                <Server className="size-3" />
              ) : (
                <Monitor className="size-3" />
              )}
              {e.origem}
            </span>
            {e.tipo && (
              <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-muted-foreground">
                {e.tipo}
              </span>
            )}
            {novo && e.status === "aberto" && (
              <span className="rounded-full border border-[color:var(--realce)]/40 px-2 py-0.5 font-medium text-[color:var(--realce)]">
                novo
              </span>
            )}
            {e.status === "resolvido" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-success/40 px-2 py-0.5 text-success-texto">
                <CheckCircle2 className="size-3" /> resolvido
              </span>
            )}
          </div>
          <p className="mt-2 line-clamp-3 break-words font-mono text-[13px] leading-snug text-foreground">
            {e.mensagem}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {e.rota && <span className="max-w-full truncate font-mono">{e.rota}</span>}
            {e.navegador && (
              <span className="inline-flex items-center gap-1">
                <MarcaNavegador nome={e.navegador} /> {e.navegador}
              </span>
            )}
            {e.sistema_op && (
              <span className="inline-flex items-center gap-1">
                <MarcaSistemaOp nome={e.sistema_op} /> {e.sistema_op}
              </span>
            )}
            {e.perfil && <span>{PERFIL[e.perfil] ?? e.perfil}</span>}
            {e.conta && <span className="truncate">{e.conta}</span>}
          </p>
        </div>
        <div className="flex w-20 shrink-0 flex-col items-end text-right sm:w-28">
          <p className="text-2xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
            {fmtNum(e.ocorrencias)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {fmtNum(e.ocorrencias_24h)} em 24 h
          </p>
          <MiniBarras
            valores={e.tendencia}
            cor={e.sistema === "corretor" ? COR.primaria : COR.alerta}
            className="mt-2"
            rotulo="Ocorrências por hora nas últimas 24 h"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-1.5">
        <p className="text-[11px] text-muted-foreground">
          Primeira vez {diaHora(e.primeira_em)} · última {ha(e.ultima_em)}
          {e.versao && (
            <>
              {" "}
              · versão <span className="font-mono">{e.versao}</span>
            </>
          )}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Detalhes{" "}
            <ChevronDown className={cn("size-3.5 transition-transform", aberto && "rotate-180")} />
          </button>
          {podeEditar && (
            <button
              type="button"
              disabled={m.isPending}
              onClick={() => m.mutate(e.status === "resolvido" ? "aberto" : "resolvido")}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:border-primary/40 disabled:opacity-60"
            >
              {e.status === "resolvido" ? (
                <>
                  <RotateCcw className="size-3.5" /> Reabrir
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" /> Resolver
                </>
              )}
            </button>
          )}
        </div>
      </div>
      {aberto && (
        <div className="border-t border-border px-4 py-3">
          <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div className="min-w-0 sm:col-span-2">
              <dt className="text-muted-foreground">Onde quebrou (1ª linha da pilha)</dt>
              <dd className="mt-0.5 break-all font-mono text-foreground">
                {e.pilha ?? "sem pilha (erro sem rastreio)"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Mensagem completa</dt>
              <dd className="mt-0.5 break-words font-mono text-foreground">{e.mensagem}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Situação</dt>
              <dd className="mt-0.5 text-foreground">
                {e.status === "resolvido" && e.resolvido_em
                  ? `Resolvido ${ha(e.resolvido_em)} — reabre sozinho se voltar`
                  : "Em aberto"}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </li>
  );
}
