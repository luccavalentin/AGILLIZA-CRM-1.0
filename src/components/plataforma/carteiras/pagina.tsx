import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Banknote,
  Building2,
  Calculator,
  FileCheck2,
  FileSignature,
  FileText,
  FolderTree,
  Pencil,
  Plus,
  Stamp,
  UserMinus,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Avatar,
  CabecalhoGestao,
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
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL, formatData } from "@/lib/financeiro/format";
import { cn } from "@/lib/utils";
import {
  arquivarCarteira,
  detalheCarteira,
  listarCarteiras,
  PERIODOS_CARTEIRA,
  removerContaCarteira,
  type Carteira,
  type ContaDaCarteira,
} from "@/lib/plataforma/carteiras.functions";
import { AdicionarContas } from "./adicionar-contas";
import { CHAVE_CARTEIRAS, FormCarteira } from "./form-carteira";
import { ROTULO_TIPO, situacaoLicenca } from "./comum";

type Vista = "ativas" | "arquivadas";
type Periodo = (typeof PERIODOS_CARTEIRA)[number];

const ROTULO_PERIODO: Record<Periodo, string> = { 30: "30 dias", 90: "90 dias", 365: "12 meses" };

/**
 * Carteiras de contas (C50): lista de carteiras à esquerda, produção e contas da escolhida
 * à direita. No celular, uma coisa por vez (a lista, ou a carteira com "Voltar").
 */
export function PaginaCarteiras({
  selecionada,
  onSelecionar,
}: {
  selecionada: string | undefined;
  onSelecionar: (id: string | undefined) => void;
}) {
  const listarFn = useServerFn(listarCarteiras);
  const podeEditar = usePermissao("saas.licencas", "edit");
  const [vista, setVista] = useState<Vista>("ativas");
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Carteira | null>(null);

  const q = useQuery({
    queryKey: [...CHAVE_CARTEIRAS, "lista", vista],
    queryFn: () => listarFn({ data: { arquivadas: vista === "arquivadas" } }),
    staleTime: 20_000,
  });
  const todas = q.data?.carteiras ?? [];
  const carteiras = vista === "arquivadas" ? todas.filter((c) => c.arquivada_em) : todas;
  const ativas = todas.filter((c) => !c.arquivada_em);
  const atual = todas.find((c) => c.id === selecionada) ?? null;

  const totalContas = ativas.reduce((s, c) => s + Number(c.contas), 0);
  const totalMrr = ativas.reduce((s, c) => s + Number(c.mrr), 0);

  return (
    <PaginaGestao>
      <CabecalhoGestao
        titulo="Carteiras"
        icone={<FolderTree />}
        descricao="Agrupe as contas do Agilliza Tech em carteiras, com uma pessoa responsável, e acompanhe a produção de cada uma."
        acoes={
          podeEditar && (
            <Button
              className="min-h-11 w-full sm:min-h-9 sm:w-auto"
              onClick={() => {
                setEditando(null);
                setFormAberto(true);
              }}
            >
              <Plus className="mr-1.5 size-4" /> Nova carteira
            </Button>
          )
        }
      />

      <FaixaIndicadores>
        <Indicador rotulo="Carteiras ativas" valor={ativas.length} icone={<FolderTree />} carregando={q.isLoading} />
        <Indicador rotulo="Contas em carteira" valor={totalContas} icone={<Building2 />} carregando={q.isLoading} />
        <Indicador
          rotulo="Contas sem carteira"
          valor={q.data?.semCarteira ?? 0}
          icone={<Users />}
          tom={(q.data?.semCarteira ?? 0) > 0 ? "alerta" : "sucesso"}
          detalhe="Ninguém responde por elas"
          carregando={q.isLoading}
        />
        <Indicador
          rotulo="Receita mensal das carteiras"
          valor={formatBRL(totalMrr)}
          icone={<Wallet />}
          carregando={q.isLoading}
        />
      </FaixaIndicadores>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        {/* Lista de carteiras */}
        <div data-tour="plataforma-carteiras-lista" className={cn("min-w-0 space-y-3", atual && "hidden lg:block")}>
          <ChipsFiltro<Vista>
            rotulo="Carteiras"
            valor={vista}
            onChange={(v) => {
              setVista(v);
              onSelecionar(undefined);
            }}
            opcoes={[
              { valor: "ativas", rotulo: "Ativas", contagem: vista === "ativas" ? ativas.length : null },
              { valor: "arquivadas", rotulo: "Arquivadas" },
            ]}
          />
          <Secao semRespiro>
            {q.isLoading && <ListaCarregando linhas={4} />}
            {q.isError && (
              <EstadoErro mensagem={mensagemDeErro(q.error, "Não foi possível carregar as carteiras.")} onTentar={() => q.refetch()} />
            )}
            {!q.isLoading && !q.isError && carteiras.length === 0 && (
              <EstadoVazio
                icone={<FolderTree />}
                titulo={vista === "ativas" ? "Nenhuma carteira ainda" : "Nenhuma carteira arquivada"}
                descricao={
                  vista === "ativas"
                    ? "Crie a primeira carteira, escolha quem responde por ela e adicione as contas."
                    : undefined
                }
                acao={
                  vista === "ativas" && podeEditar ? (
                    <Button className="min-h-11 sm:min-h-9" onClick={() => setFormAberto(true)}>
                      <Plus className="mr-1.5 size-4" /> Nova carteira
                    </Button>
                  ) : undefined
                }
              />
            )}
            <ul className="divide-y divide-border/70">
              {carteiras.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelecionar(c.id)}
                    aria-current={c.id === selecionada ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-primary/[0.03]",
                      c.id === selecionada && "bg-primary/[0.05] shadow-[inset_2px_0_0_var(--primary)]",
                    )}
                  >
                    <Avatar nome={c.responsavel.nome} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start gap-2">
                        <span className="line-clamp-2 break-words text-sm font-medium leading-snug text-foreground">
                          {c.nome}
                        </span>
                        {c.arquivada_em && <Selo>Arquivada</Selo>}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {c.responsavel.nome} · {c.contas} {Number(c.contas) === 1 ? "conta" : "contas"}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-medium tabular-nums">{formatBRL(Number(c.mrr))}</span>
                      <span className="block text-[11px] text-muted-foreground">por mês</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Secao>
        </div>

        {/* Carteira escolhida */}
        <div data-tour="plataforma-carteiras-detalhe" className={cn("min-w-0", !atual && "hidden lg:block")}>
          {atual ? (
            <DetalheDaCarteira
              key={atual.id}
              carteira={atual}
              podeEditar={podeEditar}
              onVoltar={() => onSelecionar(undefined)}
              onEditar={() => {
                setEditando(atual);
                setFormAberto(true);
              }}
            />
          ) : (
            <Secao>
              <EstadoVazio
                icone={<FolderTree />}
                titulo="Escolha uma carteira"
                descricao="A produção, as contas e as ações da carteira aparecem aqui."
              />
            </Secao>
          )}
        </div>
      </div>

      <FormCarteira
        aberto={formAberto}
        carteira={editando}
        aoFechar={() => setFormAberto(false)}
        aoCriar={(id) => {
          setVista("ativas");
          onSelecionar(id);
        }}
      />
    </PaginaGestao>
  );
}

function DetalheDaCarteira({
  carteira,
  podeEditar,
  onVoltar,
  onEditar,
}: {
  carteira: Carteira;
  podeEditar: boolean;
  onVoltar: () => void;
  onEditar: () => void;
}) {
  const qc = useQueryClient();
  const detalheFn = useServerFn(detalheCarteira);
  const arquivarFn = useServerFn(arquivarCarteira);
  const removerFn = useServerFn(removerContaCarteira);
  const [periodo, setPeriodo] = useState<Periodo>(30);
  const [adicionar, setAdicionar] = useState(false);
  const [remover, setRemover] = useState<ContaDaCarteira | null>(null);
  const arquivada = !!carteira.arquivada_em;

  const q = useQuery({
    queryKey: [...CHAVE_CARTEIRAS, "detalhe", carteira.id, periodo],
    queryFn: () => detalheFn({ data: { id: carteira.id, dias: periodo } }),
    staleTime: 20_000,
    placeholderData: (a) => a,
  });
  const d = q.data;
  const t = d?.totais;

  const recarregar = () => {
    qc.invalidateQueries({ queryKey: CHAVE_CARTEIRAS });
    qc.invalidateQueries({ queryKey: ["plataforma-licencas"] });
  };
  const arquivar = useMutation({
    mutationFn: () => arquivarFn({ data: { id: carteira.id, arquivar: !arquivada } }),
    onSuccess: () => {
      toast.success(arquivada ? "Carteira reativada." : "Carteira arquivada.");
      recarregar();
      onVoltar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível concluir.")),
  });
  const tirar = useMutation({
    mutationFn: (conta: ContaDaCarteira) => removerFn({ data: { id: carteira.id, conta: conta.id } }),
    onSuccess: (_r, conta) => {
      toast.success(`${conta.nome} saiu da carteira e ficou sem responsável.`);
      setRemover(null);
      recarregar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível tirar a conta.")),
  });

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2 min-h-11 lg:hidden" onClick={onVoltar}>
        <ArrowLeft className="mr-1.5 size-4" /> Carteiras
      </Button>

      <Secao
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            {carteira.nome}
            {arquivada && <Selo>Arquivada</Selo>}
          </span>
        }
        descricao={
          <>
            Responsável: <span className="font-medium text-foreground">{carteira.responsavel.nome}</span> · criada em{" "}
            {formatData(carteira.criada_em)}
          </>
        }
        acoes={
          podeEditar && (
            <>
              {!arquivada && (
                <Button variant="outline" size="sm" className="min-h-11 sm:min-h-8" onClick={onEditar}>
                  <Pencil className="mr-1.5 size-4" /> Editar
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="min-h-11 sm:min-h-8"
                disabled={arquivar.isPending || (!arquivada && Number(carteira.contas) > 0)}
                title={!arquivada && Number(carteira.contas) > 0 ? "Mova ou retire as contas antes de arquivar" : undefined}
                onClick={() => arquivar.mutate()}
              >
                {arquivada ? (
                  <>
                    <ArchiveRestore className="mr-1.5 size-4" /> Reativar
                  </>
                ) : (
                  <>
                    <Archive className="mr-1.5 size-4" /> Arquivar
                  </>
                )}
              </Button>
            </>
          )
        }
      >
        {carteira.descricao && <p className="mb-4 text-sm text-muted-foreground">{carteira.descricao}</p>}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Produção da carteira</p>
          <ChipsFiltro<`${Periodo}`>
            rotulo="Período"
            valor={`${periodo}`}
            onChange={(v) => setPeriodo(Number(v) as Periodo)}
            opcoes={PERIODOS_CARTEIRA.map((p) => ({ valor: `${p}` as `${Periodo}`, rotulo: ROTULO_PERIODO[p] }))}
          />
        </div>
        {q.isError ? (
          <EstadoErro mensagem={mensagemDeErro(q.error, "Não foi possível carregar a produção.")} onTentar={() => q.refetch()} />
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 2xl:grid-cols-6">
            <Numero rotulo="Simulações" valor={t?.simulacoes} icone={<Calculator />} carregando={q.isLoading} />
            <Numero rotulo="Propostas" valor={t?.propostas} icone={<FileText />} carregando={q.isLoading} />
            <Numero rotulo="Contratos emitidos" valor={t?.contratos} icone={<FileSignature />} carregando={q.isLoading} />
            <Numero rotulo="Registrados" valor={t?.registrados} icone={<Stamp />} carregando={q.isLoading} />
            <Numero
              rotulo="Valor dos contratos"
              valor={t ? formatBRL(Number(t.valor_contratos)) : undefined}
              icone={<Banknote />}
              carregando={q.isLoading}
            />
            <Numero
              rotulo="Receita mensal"
              valor={t ? formatBRL(Number(t.mrr)) : undefined}
              icone={<Wallet />}
              carregando={q.isLoading}
            />
          </div>
        )}
      </Secao>

      <Secao
        titulo="Contas da carteira"
        descricao={d ? `${d.contas.length} ${d.contas.length === 1 ? "conta" : "contas"}` : undefined}
        acoes={
          podeEditar &&
          !arquivada && (
            <Button size="sm" className="min-h-11 sm:min-h-8" onClick={() => setAdicionar(true)}>
              <Plus className="mr-1.5 size-4" /> Adicionar contas
            </Button>
          )
        }
        semRespiro
      >
        {q.isLoading && <ListaCarregando linhas={3} />}
        {d && d.contas.length === 0 && (
          <EstadoVazio
            icone={<Building2 />}
            titulo="Nenhuma conta nesta carteira"
            descricao={arquivada ? undefined : "Adicione as contas que esta carteira vai atender."}
          />
        )}
        {d && d.contas.length > 0 && (
          <>
            {/* Monitor: tabela densa */}
            <div className="hidden xl:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Conta</th>
                    <th className="px-2 py-2 font-medium">Situação</th>
                    <th className="px-2 py-2 text-right font-medium">Simul.</th>
                    <th className="px-2 py-2 text-right font-medium">Propostas</th>
                    <th className="px-2 py-2 text-right font-medium">Contratos</th>
                    <th className="px-2 py-2 text-right font-medium">Valor</th>
                    <th className="px-2 py-2 text-right font-medium">Mensal</th>
                    {podeEditar && !arquivada && <th className="w-12 px-2 py-2" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {d.contas.map((c) => {
                    const s = situacaoLicenca(c.status);
                    return (
                      <tr key={c.id} className="hover:bg-primary/[0.02]">
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-foreground">{c.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {ROTULO_TIPO[c.tipo]} · {c.plano ?? "sem plano"}
                            {c.vinculo_agilliza ? " · Sua base" : ""}
                          </p>
                        </td>
                        <td className="px-2 py-2.5">
                          <Selo tom={s.tom} ponto={c.status === "ativo"}>
                            {s.rotulo}
                          </Selo>
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{c.simulacoes}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{c.propostas}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{c.contratos}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{formatBRL(Number(c.valor_contratos))}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{formatBRL(Number(c.mrr))}</td>
                        {podeEditar && !arquivada && (
                          <td className="px-2 py-2.5 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={`Tirar ${c.nome} da carteira`}
                              onClick={() => setRemover(c)}
                            >
                              <UserMinus className="size-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Celular e telas médias: cartões */}
            <ul className="divide-y divide-border/60 xl:hidden">
              {d.contas.map((c) => {
                const s = situacaoLicenca(c.status);
                return (
                  <li key={c.id} className="space-y-2 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{c.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {ROTULO_TIPO[c.tipo]} · {c.plano ?? "sem plano"}
                        </p>
                      </div>
                      <Selo tom={s.tom} ponto={c.status === "ativo"}>
                        {s.rotulo}
                      </Selo>
                    </div>
                    <dl className="grid grid-cols-4 gap-2 text-center">
                      {(
                        [
                          ["Simul.", c.simulacoes],
                          ["Propostas", c.propostas],
                          ["Contratos", c.contratos],
                          ["Registr.", c.registrados],
                        ] as const
                      ).map(([r, v]) => (
                        <div key={r} className="rounded-lg bg-secondary/60 px-1 py-1.5">
                          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{r}</dt>
                          <dd className="text-sm font-medium tabular-nums">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {formatBRL(Number(c.mrr))}/mês · contratos {formatBRL(Number(c.valor_contratos))}
                      </span>
                      {podeEditar && !arquivada && (
                        <Button variant="ghost" size="sm" className="min-h-11 text-xs" onClick={() => setRemover(c)}>
                          <UserMinus className="mr-1 size-4" /> Tirar
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <p className="flex items-center gap-1.5 border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
          <FileCheck2 className="size-3.5" /> Só números da operação; para abrir uma conta, use{" "}
          <Link to="/plataforma/licencas" className="text-primary underline-offset-2 hover:underline">
            Licenças e assinaturas
          </Link>
          .
        </p>
      </Secao>

      {podeEditar && !arquivada && (
        <AdicionarContas carteira={carteira} aberto={adicionar} aoFechar={() => setAdicionar(false)} />
      )}

      <AlertDialog open={!!remover} onOpenChange={(v) => !v && setRemover(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tirar {remover?.nome} da carteira?</AlertDialogTitle>
            <AlertDialogDescription>
              A conta fica sem responsável: as propostas novas dela deixam de chegar para{" "}
              {carteira.responsavel.nome}. Dá para pôr em outra carteira depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11 sm:min-h-9">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 sm:min-h-9"
              disabled={tirar.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (remover) tirar.mutate(remover);
              }}
            >
              Tirar da carteira
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Numero({
  rotulo,
  valor,
  icone,
  carregando,
}: {
  rotulo: string;
  valor: string | number | undefined;
  icone: React.ReactNode;
  carregando?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border/70 bg-secondary/30 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground [&_svg]:size-3.5">
        {icone}
        <span className="truncate">{rotulo}</span>
      </p>
      {carregando ? (
        <span className="mt-1 block h-6 w-12 animate-pulse rounded bg-secondary" />
      ) : (
        <p className="mt-0.5 break-words text-lg font-medium leading-tight tabular-nums tracking-tight">{valor ?? 0}</p>
      )}
    </div>
  );
}
