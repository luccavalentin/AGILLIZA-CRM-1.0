import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
// a8 (C70): aba isolada dos vinculados ao correspondente.
import { VinculadosAba } from "@/components/plataforma/vinculados/vinculados-aba";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  BadgeCheck,
  Building2,
  Coins,
  KeyRound,
  MoreHorizontal,
  Plus,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Avatar,
  BarraFiltros,
  CabecalhoGestao,
  CampoBusca,
  ChipsFiltro,
  EstadoErro,
  EstadoVazio,
  FaixaIndicadores,
  Indicador,
  ListaCarregando,
  PaginaGestao,
  Secao,
  Selo,
} from "@/components/plataforma/kit";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL, formatData } from "@/lib/financeiro/format";
import { RodapePaginas, useValorAssentado } from "@/components/plataforma/paginacao";
import { NovaLicenca } from "@/components/plataforma/licencas/nova-licenca";
import {
  GavetaLicenca,
  type AbaLicenca,
  type SecaoAcao,
} from "@/components/plataforma/licencas/gaveta-licenca";
import {
  ROTULO_CICLO,
  ROTULO_TIPO,
  SITUACAO_LICENCA,
  rotuloDe,
  situacaoLicenca,
} from "@/components/plataforma/licencas/rotulos";
import {
  POR_PAGINA_LICENCAS,
  listarLicencas,
  type Licenca,
  type SituacaoLicenca,
  type TipoLicenca,
} from "@/lib/plataforma/licencas.functions";

export const Route = createFileRoute("/_authenticated/plataforma/licencas")({
  head: () => ({ meta: [{ title: "Licenças e assinaturas — Gestão de sistemas — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("saas.licencas"),
  component: Pagina,
});

type FiltroSituacao = "todas" | SituacaoLicenca;
const TODOS = "todos";
const SEM_CARTEIRA = "sem";

interface Aberta {
  licenca: Licenca;
  aba: AbaLicenca;
  secao?: SecaoAcao;
}

/**
 * Licenças e assinaturas (C49): lista densa com busca, situação em chips, filtros por tipo,
 * plano e carteira, ações em linha e o detalhe numa gaveta com abas. A criação (cortesia,
 * teste ou pagamento, com desconto e carteira) é uma gaveta em quatro passos.
 */
function Pagina() {
  const listarFn = useServerFn(listarLicencas);
  const podeCriar = usePermissao("saas.licencas", "edit");
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<string>(TODOS);
  const [plano, setPlano] = useState<string>(TODOS);
  const [carteira, setCarteira] = useState<string>(TODOS);
  const [situacao, setSituacao] = useState<FiltroSituacao>("todas");
  const [pagina, setPagina] = useState(1);
  const [aberta, setAberta] = useState<Aberta | null>(null);
  const [nova, setNova] = useState(false);
  // a8 (C70): "Assinantes" (licenças pagas) | "Vinculados ao correspondente" (Sua base).
  const [aba, setAba] = useState<"assinantes" | "vinculados">("assinantes");
  const termo = useValorAssentado(busca.trim());

  const q = useQuery({
    queryKey: ["plataforma-licencas", tipo, situacao, termo, plano, carteira, pagina],
    queryFn: () =>
      listarFn({
        data: {
          tipo: tipo === TODOS ? null : (tipo as TipoLicenca),
          status: situacao === "todas" ? null : situacao,
          busca: termo || null,
          plano: plano === TODOS ? null : plano,
          carteira: carteira === TODOS ? null : carteira,
          pagina,
        },
      }),
    staleTime: 30_000,
    placeholderData: (anterior) => anterior,
  });
  const licencas = q.data?.licencas ?? [];
  const planos = q.data?.planos ?? [];
  const carteiras = q.data?.carteiras ?? [];
  const kpi = q.data?.resumo ?? { total: 0, ativas: 0, teste: 0, travadas: 0, mrr: 0, usuarios: 0 };
  // A gaveta mostra a versão mais recente da conta (depois de mudar situação, plano ou carteira).
  const abertaAtual = aberta
    ? (licencas.find((l) => l.id === aberta.licenca.id) ?? aberta.licenca)
    : null;

  const mudar =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPagina(1);
    };
  const filtrosAtivos =
    (tipo !== TODOS ? 1 : 0) +
    (plano !== TODOS ? 1 : 0) +
    (carteira !== TODOS ? 1 : 0) +
    (termo ? 1 : 0);
  const abrir = (licenca: Licenca, aba: AbaLicenca = "resumo", secao?: SecaoAcao) =>
    setAberta({ licenca, aba, secao });

  if (aba === "vinculados") {
    return (
      <PaginaGestao>
        <CabecalhoGestao
          titulo="Licenças e assinaturas"
          icone={<KeyRound />}
          descricao="Contas de corretores, imobiliárias e parceiros do Agilliza Tech: situação, plano, teste, créditos, carteira e uso."
        />
        <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
          <TabsList className="h-auto w-full sm:w-auto">
            <TabsTrigger value="assinantes" className="min-h-10 flex-1 sm:flex-none">
              Assinantes
            </TabsTrigger>
            <TabsTrigger value="vinculados" className="min-h-10 flex-1 sm:flex-none">
              Vinculados ao correspondente
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <VinculadosAba planos={planos} />
      </PaginaGestao>
    );
  }

  return (
    <PaginaGestao>
      <CabecalhoGestao
        titulo="Licenças e assinaturas"
        icone={<KeyRound />}
        descricao="Contas de corretores, imobiliárias e parceiros do Agilliza Tech: situação, plano, teste, créditos, carteira e uso."
        acoes={
          podeCriar && (
            <Button className="min-h-11 w-full sm:min-h-9 sm:w-auto" onClick={() => setNova(true)}>
              <Plus className="mr-1.5 size-4" /> Nova licença
            </Button>
          )
        }
      />
      <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
        <TabsList className="h-auto w-full sm:w-auto">
          <TabsTrigger value="assinantes" className="min-h-10 flex-1 sm:flex-none">
            Assinantes
          </TabsTrigger>
          <TabsTrigger value="vinculados" className="min-h-10 flex-1 sm:flex-none">
            Vinculados ao correspondente
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <FaixaIndicadores colunas={5}>
        <Indicador
          rotulo="Licenças no filtro"
          valor={kpi.total}
          icone={<Building2 />}
          carregando={q.isLoading}
          detalhe={`${kpi.usuarios} ${kpi.usuarios === 1 ? "usuário" : "usuários"}`}
        />
        <Indicador
          rotulo="Ativas"
          valor={kpi.ativas}
          icone={<BadgeCheck />}
          tom="sucesso"
          carregando={q.isLoading}
          onClick={() => mudar(setSituacao)(situacao === "ativo" ? "todas" : "ativo")}
          ativo={situacao === "ativo"}
        />
        <Indicador
          rotulo="Em teste"
          valor={kpi.teste}
          icone={<KeyRound />}
          carregando={q.isLoading}
          onClick={() => mudar(setSituacao)(situacao === "trial" ? "todas" : "trial")}
          ativo={situacao === "trial"}
        />
        <Indicador
          rotulo="Bloqueadas"
          valor={kpi.travadas}
          icone={<ShieldAlert />}
          tom={kpi.travadas > 0 ? "alerta" : "neutro"}
          detalhe="Suspensas + somente leitura"
          carregando={q.isLoading}
        />
        <Indicador
          rotulo="Receita mensal"
          valor={formatBRL(kpi.mrr)}
          icone={<Coins />}
          detalhe="Assinaturas ativas e inadimplentes"
          carregando={q.isLoading}
        />
      </FaixaIndicadores>

      <BarraFiltros>
        <CampoBusca
          valor={busca}
          onChange={mudar(setBusca)}
          rotulo="Buscar licença"
          placeholder="Nome, endereço do site ou e-mail"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Select value={tipo} onValueChange={mudar(setTipo)}>
            <SelectTrigger className="h-10 sm:w-40" aria-label="Tipo de conta">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os tipos</SelectItem>
              {(Object.keys(ROTULO_TIPO) as TipoLicenca[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {ROTULO_TIPO[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={plano} onValueChange={mudar(setPlano)}>
            <SelectTrigger className="h-10 sm:w-44" aria-label="Plano">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os planos</SelectItem>
              {planos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={carteira} onValueChange={mudar(setCarteira)}>
            <SelectTrigger className="col-span-2 h-10 sm:col-span-1 sm:w-48" aria-label="Carteira">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas as carteiras</SelectItem>
              <SelectItem value={SEM_CARTEIRA}>Sem carteira</SelectItem>
              {carteiras.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {filtrosAtivos > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11 self-start sm:min-h-8 md:ml-auto"
            onClick={() => {
              setBusca("");
              setTipo(TODOS);
              setPlano(TODOS);
              setCarteira(TODOS);
              setPagina(1);
            }}
          >
            Limpar filtros ({filtrosAtivos})
          </Button>
        )}
      </BarraFiltros>

      <ChipsFiltro<FiltroSituacao>
        rotulo="Situação"
        valor={situacao}
        onChange={mudar(setSituacao)}
        opcoes={[
          { valor: "todas", rotulo: "Todas" },
          ...(Object.keys(SITUACAO_LICENCA) as SituacaoLicenca[]).map((s) => ({
            valor: s,
            rotulo: SITUACAO_LICENCA[s].rotulo,
          })),
        ]}
      />

      <Secao semRespiro>
        {q.isLoading && <ListaCarregando linhas={6} />}
        {q.isError && (
          <EstadoErro
            mensagem={mensagemDeErro(q.error, "Não foi possível carregar as licenças.")}
            onTentar={() => q.refetch()}
          />
        )}
        {!q.isLoading && !q.isError && licencas.length === 0 && (
          <EstadoVazio
            icone={<Building2 />}
            titulo="Nenhuma licença com estes filtros"
            descricao="Mude a busca ou os filtros para ver outras contas."
          />
        )}

        {licencas.length > 0 && (
          <>
            {/* Monitor largo: tabela densa */}
            <div className="hidden xl:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Conta</th>
                    <th className="px-2 py-2.5 font-medium">Plano</th>
                    <th className="px-2 py-2.5 font-medium">Situação</th>
                    <th className="px-2 py-2.5 font-medium">Carteira</th>
                    <th className="px-2 py-2.5 text-right font-medium">Usuários</th>
                    <th className="px-2 py-2.5 text-right font-medium">Assinatura</th>
                    <th className="px-2 py-2.5 font-medium">Desde</th>
                    <th className="w-12 px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {licencas.map((l) => {
                    const s = situacaoLicenca(l.status);
                    return (
                      <tr
                        key={l.id}
                        className="cursor-pointer transition-colors hover:bg-primary/[0.025]"
                        onClick={() => abrir(l)}
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && abrir(l)}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <Avatar nome={l.nome} />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">{l.nome}</p>
                              <p className="max-w-[22rem] truncate text-xs text-muted-foreground">
                                {ROTULO_TIPO[l.tipo]} · {l.email_contato ?? l.slug}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2.5">
                          {l.plano ?? <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-2 py-2.5">
                          <Selo tom={s.tom} ponto={l.status === "ativo"}>
                            {s.rotulo}
                          </Selo>
                          {l.status === "trial" && l.trial_ate && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              até {formatData(l.trial_ate)}
                            </p>
                          )}
                        </td>
                        <td className="px-2 py-2.5">
                          {l.carteira_grupo_nome ? (
                            <span className="text-sm">{l.carteira_grupo_nome}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem carteira</span>
                          )}
                          {l.carteira_nome && (
                            <p className="truncate text-[11px] text-muted-foreground">
                              {l.carteira_nome}
                            </p>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{l.usuarios}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums">
                          {l.assinatura_valor
                            ? `${formatBRL(l.assinatura_valor)}/${rotuloDe(ROTULO_CICLO, l.ciclo ?? "mensal")}`
                            : "—"}
                        </td>
                        <td className="px-2 py-2.5 text-muted-foreground">
                          {formatData(l.criado_em)}
                        </td>
                        <td className="px-2 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <AcoesEmLinha licenca={l} podeEditar={podeCriar} onAbrir={abrir} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Celular e telas médias: cartões */}
            <ul className="divide-y divide-border/60 xl:hidden">
              {licencas.map((l) => {
                const s = situacaoLicenca(l.status);
                return (
                  <li key={l.id} className="flex items-start gap-3 px-4 py-3">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                      onClick={() => abrir(l)}
                    >
                      <Avatar nome={l.nome} />
                      <span className="min-w-0 flex-1 space-y-1">
                        <span className="block truncate text-sm font-medium">{l.nome}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {ROTULO_TIPO[l.tipo]} · {l.plano ?? "sem plano"}
                          {l.carteira_grupo_nome ? ` · ${l.carteira_grupo_nome}` : ""}
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Selo tom={s.tom} ponto={l.status === "ativo"}>
                            {s.rotulo}
                          </Selo>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            <Users className="mr-0.5 inline size-3" /> {l.usuarios}
                            {l.assinatura_valor
                              ? ` · ${formatBRL(l.assinatura_valor)}/${rotuloDe(ROTULO_CICLO, l.ciclo ?? "mensal")}`
                              : ""}
                          </span>
                        </span>
                      </span>
                    </button>
                    <AcoesEmLinha licenca={l} podeEditar={podeCriar} onAbrir={abrir} />
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <RodapePaginas
          pagina={pagina}
          porPagina={POR_PAGINA_LICENCAS}
          quantidade={licencas.length}
          total={q.data?.resumo.total}
          carregando={q.isFetching}
          onPagina={setPagina}
        />
      </Secao>

      <GavetaLicenca
        licenca={abertaAtual}
        planos={planos}
        carteiras={carteiras}
        abaInicial={aberta?.aba}
        secaoInicial={aberta?.secao}
        onFechar={() => setAberta(null)}
      />
      {podeCriar && (
        <NovaLicenca
          aberta={nova}
          aoFechar={() => setNova(false)}
          planos={planos}
          carteiras={carteiras}
        />
      )}
    </PaginaGestao>
  );
}

/** Menu de ações da linha: abre a gaveta já na aba (e no bloco) da ação escolhida. */
function AcoesEmLinha({
  licenca,
  podeEditar,
  onAbrir,
}: {
  licenca: Licenca;
  podeEditar: boolean;
  onAbrir: (l: Licenca, aba?: AbaLicenca, secao?: SecaoAcao) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 sm:size-8"
          aria-label={`Ações de ${licenca.nome}`}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="truncate">{licenca.nome}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onAbrir(licenca, "resumo")}>
          <Activity className="mr-2 size-4" /> Ver uso e detalhes
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAbrir(licenca, "cobranca")}>
          <Coins className="mr-2 size-4" /> Cobrança e faturas
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAbrir(licenca, "pessoas")}>
          <Users className="mr-2 size-4" /> Pessoas da conta
        </DropdownMenuItem>
        {podeEditar && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onAbrir(licenca, "acoes", "situacao")}>
              Mudar situação
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAbrir(licenca, "acoes", "teste")}>
              Teste grátis
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAbrir(licenca, "acoes", "plano")}>
              Trocar plano
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAbrir(licenca, "acoes", "desconto")}>
              Desconto
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAbrir(licenca, "acoes", "creditos")}>
              Lançar créditos
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAbrir(licenca, "acoes", "carteira")}>
              Carteira e acesso
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
