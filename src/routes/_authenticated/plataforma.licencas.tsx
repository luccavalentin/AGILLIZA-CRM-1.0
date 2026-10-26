import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BadgeCheck,
  Building2,
  Coins,
  KeyRound,
  Plus,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";
import { AdminHero } from "@/components/admin/admin-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL, formatData } from "@/lib/financeiro/format";
import { RodapePaginas, useValorAssentado } from "@/components/plataforma/paginacao";
import { CarteiraLicenca } from "@/components/plataforma/licencas/carteira-licenca";
import { NovaLicenca } from "@/components/plataforma/licencas/nova-licenca";
import { DescontoDaLicenca } from "@/components/plataforma/licencas/desconto-licenca";
import {
  POR_PAGINA_LICENCAS,
  alterarSituacaoLicenca,
  concederCreditosLicenca,
  concederTesteLicenca,
  detalheLicenca,
  listarLicencas,
  mudarPlanoLicenca,
  type Licenca,
  type PlanoLicenca,
  type SituacaoLicenca,
  type TipoLicenca,
} from "@/lib/plataforma/licencas.functions";

export const Route = createFileRoute("/_authenticated/plataforma/licencas")({
  head: () => ({ meta: [{ title: "Licenças e assinantes — Plataforma — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("saas.licencas"),
  component: Pagina,
});

const TIPO: Record<TipoLicenca, string> = {
  corretor: "Corretor",
  imobiliaria: "Imobiliária",
  parceiro: "Parceiro",
};

/**
 * Cor por significado (antes "Ativa" usava o azul chapado de ação): ativa =
 * verde, em teste = informação, somente leitura = atenção, suspensa = perigo.
 */
const SITUACAO: Record<
  SituacaoLicenca,
  {
    rotulo: string;
    tom: "default" | "secondary" | "destructive" | "outline";
    classe?: string;
  }
> = {
  trial: {
    rotulo: "Em teste",
    tom: "outline",
    classe: "border-primary/20 bg-primary/10 text-primary",
  },
  ativo: {
    rotulo: "Ativa",
    tom: "outline",
    classe: "border-success/20 bg-success/10 text-success-texto",
  },
  somente_leitura: {
    rotulo: "Somente leitura",
    tom: "outline",
    classe: "border-warning/40 bg-warning/15 text-warning-foreground",
  },
  suspenso: { rotulo: "Suspensa", tom: "destructive" },
  cancelado: { rotulo: "Cancelada", tom: "outline" },
};

/** Rótulos do que o banco devolve em código (assinatura, fatura, ciclo e papel na conta). */
const ASSINATURA: Record<string, string> = {
  trial: "em teste",
  ativa: "ativa",
  inadimplente: "inadimplente",
  cancelada: "cancelada",
  encerrada: "encerrada",
};
const FATURA: Record<string, string> = {
  pendente: "em aberto",
  vencida: "vencida",
  paga: "paga",
  cancelada: "cancelada",
  estornada: "estornada",
};
const CICLO: Record<string, string> = { mensal: "mês", trimestral: "trimestre", anual: "ano" };
const PAPEL: Record<string, string> = {
  dono: "Dono",
  admin: "Administrador",
  gerente: "Gerente",
  corretor: "Corretor",
  assistente: "Assistente",
  financeiro: "Financeiro",
  parceiro_dono: "Dono (parceiro)",
  parceiro_membro: "Membro (parceiro)",
};
const rotulo = (mapa: Record<string, string>, v: string | null | undefined) =>
  v ? (mapa[v] ?? v.replace(/_/g, " ")) : "—";

function Pagina() {
  const listarFn = useServerFn(listarLicencas);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<"todos" | TipoLicenca>("todos");
  const [situacao, setSituacao] = useState<"todas" | SituacaoLicenca>("todas");
  const [pagina, setPagina] = useState(1);
  const [aberta, setAberta] = useState<Licenca | null>(null);
  const [nova, setNova] = useState(false);
  const podeCriar = usePermissao("saas.licencas", "edit");
  const termo = useValorAssentado(busca.trim());

  const q = useQuery({
    queryKey: ["plataforma-licencas", tipo, situacao, termo, pagina],
    queryFn: () =>
      listarFn({
        data: {
          tipo: tipo === "todos" ? null : tipo,
          status: situacao === "todas" ? null : situacao,
          busca: termo || null,
          pagina,
        },
      }),
    staleTime: 30_000,
    placeholderData: (anterior) => anterior,
  });
  const licencas = q.data?.licencas ?? [];
  // Os números vêm do banco, somados sobre o filtro inteiro (não só a página).
  const kpi = q.data?.resumo ?? { total: 0, ativas: 0, teste: 0, travadas: 0, mrr: 0, usuarios: 0 };
  // A gaveta mostra a versão mais recente da conta (depois de mudar situação, plano ou teste).
  const abertaAtual = aberta ? (licencas.find((l) => l.id === aberta.id) ?? aberta) : null;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AdminHero
        secao="Gestão de sistemas"
        icon={<KeyRound className="h-5 w-5" />}
        titulo="Licenças e assinantes"
        descricao="Contas de corretores, imobiliárias e parceiros: situação, plano, teste, créditos e uso."
      />
      {podeCriar && (
        <div className="flex justify-end">
          <Button className="w-full sm:w-auto" onClick={() => setNova(true)}>
            <Plus className="mr-1.5 size-4" /> Nova licença
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Indicador rotulo="Licenças" valor={kpi.total} icone={<Building2 className="size-4" />} />
        <Indicador rotulo="Ativas" valor={kpi.ativas} icone={<BadgeCheck className="size-4" />} />
        <Indicador rotulo="Em teste" valor={kpi.teste} icone={<KeyRound className="size-4" />} />
        {/* Rótulo curto (cabe numa linha, alinhado aos vizinhos); o detalhe explica a soma. */}
        <Indicador
          rotulo="Bloqueadas"
          valor={kpi.travadas}
          icone={<ShieldAlert className="size-4" />}
          detalhe="Suspensas + somente leitura"
        />
        <Indicador
          rotulo="Receita mensal (assinaturas)"
          valor={formatBRL(kpi.mrr)}
          icone={<Coins className="size-4" />}
          detalhe={`${kpi.usuarios} ${kpi.usuarios === 1 ? "usuário" : "usuários"} nas contas`}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 md:flex-row md:items-end">
        <div className="relative flex-1">
          <Label htmlFor="lic-busca" className="sr-only">
            Buscar licença
          </Label>
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="lic-busca"
            className="pl-9"
            placeholder="Buscar por nome, endereço do site ou e-mail"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(1);
            }}
          />
        </div>
        <Select
          value={tipo}
          onValueChange={(v) => {
            setTipo(v as typeof tipo);
            setPagina(1);
          }}
        >
          <SelectTrigger className="md:w-44" aria-label="Tipo de conta">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="corretor">Corretores</SelectItem>
            <SelectItem value="imobiliaria">Imobiliárias</SelectItem>
            <SelectItem value="parceiro">Parceiros</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={situacao}
          onValueChange={(v) => {
            setSituacao(v as typeof situacao);
            setPagina(1);
          }}
        >
          <SelectTrigger className="md:w-48" aria-label="Situação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as situações</SelectItem>
            {(Object.keys(SITUACAO) as SituacaoLicenca[]).map((s) => (
              <SelectItem key={s} value={s}>
                {SITUACAO[s].rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Conta</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="hidden md:table-cell">Teste até</TableHead>
              <TableHead className="hidden md:table-cell text-right">Usuários</TableHead>
              <TableHead className="hidden lg:table-cell text-right">Assinatura</TableHead>
              <TableHead className="hidden lg:table-cell">Desde</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-8" />
                  </TableCell>
                </TableRow>
              ))}
            {q.isError && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-destructive">
                  {mensagemDeErro(q.error, "Não foi possível carregar as licenças.")}
                </TableCell>
              </TableRow>
            )}
            {!q.isLoading && !q.isError && licencas.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhuma licença com estes filtros.
                </TableCell>
              </TableRow>
            )}
            {licencas.map((l) => (
              <TableRow
                key={l.id}
                className="cursor-pointer"
                onClick={() => setAberta(l)}
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setAberta(l)}
              >
                <TableCell>
                  <p className="font-medium text-foreground">{l.nome}</p>
                  <p className="max-w-[16rem] truncate text-xs text-muted-foreground sm:max-w-none">
                    {TIPO[l.tipo]} · {l.email_contato ?? l.slug}
                  </p>
                  {l.carteira_nome && (
                    <p className="text-xs text-muted-foreground">Carteira: {l.carteira_nome}</p>
                  )}
                </TableCell>
                <TableCell>{l.plano ?? "—"}</TableCell>
                <TableCell>
                  <Badge
                    variant={SITUACAO[l.status]?.tom ?? "secondary"}
                    className={SITUACAO[l.status]?.classe}
                  >
                    {SITUACAO[l.status]?.rotulo ?? l.status}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {l.trial_ate ? formatData(l.trial_ate) : "—"}
                </TableCell>
                <TableCell className="hidden md:table-cell text-right tabular-nums">
                  {l.usuarios}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-right tabular-nums">
                  {l.assinatura_valor
                    ? `${formatBRL(l.assinatura_valor)}/${rotulo(CICLO, l.ciclo ?? "mensal")}`
                    : "—"}
                </TableCell>
                <TableCell className="hidden lg:table-cell">{formatData(l.criado_em)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <RodapePaginas
          pagina={pagina}
          porPagina={POR_PAGINA_LICENCAS}
          quantidade={licencas.length}
          total={q.data?.resumo.total}
          carregando={q.isFetching}
          onPagina={setPagina}
        />
      </div>

      <GavetaLicenca
        licenca={abertaAtual}
        planos={q.data?.planos ?? []}
        onFechar={() => setAberta(null)}
      />
      {podeCriar && (
        <NovaLicenca aberta={nova} aoFechar={() => setNova(false)} planos={q.data?.planos ?? []} />
      )}
    </div>
  );
}

function Indicador({
  rotulo,
  valor,
  icone,
  detalhe,
}: {
  rotulo: string;
  valor: string | number;
  icone: React.ReactNode;
  detalhe?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between text-muted-foreground">
        <p className="truncate text-xs uppercase tracking-wide">{rotulo}</p>
        {icone}
      </div>
      <p className="mt-1 break-words text-xl font-semibold tabular-nums text-foreground 2xl:text-2xl">
        {valor}
      </p>
      {detalhe && <p className="mt-0.5 text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  );
}

function GavetaLicenca({
  licenca,
  planos,
  onFechar,
}: {
  licenca: Licenca | null;
  planos: PlanoLicenca[];
  onFechar: () => void;
}) {
  const detalheFn = useServerFn(detalheLicenca);
  const podeAlterar = usePermissao("saas.licencas", "edit");
  const q = useQuery({
    queryKey: ["plataforma-licenca", licenca?.id],
    queryFn: () => detalheFn({ data: { id: licenca!.id } }),
    enabled: !!licenca,
  });
  const d = q.data?.detalhe;

  return (
    <Sheet open={!!licenca} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {licenca && (
          <>
            <SheetHeader>
              <SheetTitle>{licenca.nome}</SheetTitle>
              <SheetDescription>
                {TIPO[licenca.tipo]} · {SITUACAO[licenca.status]?.rotulo} · plano{" "}
                {licenca.plano ?? "sem plano"}
                {licenca.status_motivo ? ` · ${licenca.status_motivo}` : ""}
              </SheetDescription>
            </SheetHeader>

            <Tabs defaultValue="resumo" className="mt-4">
              <TabsList className="h-auto w-full">
                <TabsTrigger value="resumo" className="min-h-11 flex-1">
                  Resumo
                </TabsTrigger>
                <TabsTrigger value="pessoas" className="min-h-11 flex-1">
                  Pessoas
                </TabsTrigger>
                {podeAlterar && (
                  <TabsTrigger value="acoes" className="min-h-11 flex-1">
                    Ações
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="resumo" className="space-y-4">
                {q.isLoading && <Skeleton className="h-40" />}
                {q.isError && (
                  <p className="text-sm text-destructive">
                    {mensagemDeErro(q.error, "Não foi possível abrir a conta.")}
                  </p>
                )}
                {d && (
                  <>
                    <Bloco titulo="Uso">
                      <Numeros
                        itens={[
                          ["Clientes", d.uso.clientes],
                          ["Imóveis", d.uso.imoveis],
                          ["Simulações", d.uso.simulacoes],
                          ["Propostas", d.uso.propostas],
                          ["Locações", d.uso.contratos_locacao],
                          ["Sites no ar", d.uso.sites_publicados],
                        ]}
                      />
                      <p className="mt-2 text-xs text-muted-foreground">
                        Última atividade:{" "}
                        {d.uso.ultima_atividade ? formatData(d.uso.ultima_atividade) : "nenhuma"} ·{" "}
                        {d.sessoes_ativas} sessão(ões) ativa(s)
                      </p>
                    </Bloco>
                    <Bloco titulo="Créditos">
                      <Numeros
                        itens={[
                          ["Saldo", d.creditos.saldo],
                          ["Comprados", d.creditos.comprados],
                          ["Consumidos", d.creditos.consumidos],
                        ]}
                      />
                    </Bloco>
                    <Bloco titulo="Assinatura">
                      {d.assinatura ? (
                        <p className="text-sm">
                          {d.assinatura.plano ?? licenca.plano ?? "—"} ·{" "}
                          {formatBRL(Number(d.assinatura.valor))}/
                          {rotulo(CICLO, d.assinatura.ciclo)} ·{" "}
                          {rotulo(ASSINATURA, d.assinatura.status)}
                          {d.assinatura.proxima_cobranca_em
                            ? ` · próxima cobrança ${formatData(d.assinatura.proxima_cobranca_em)}`
                            : ""}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Sem assinatura
                          {licenca.trial_ate ? ` — teste até ${formatData(licenca.trial_ate)}` : ""}
                          .
                        </p>
                      )}
                    </Bloco>
                    <Bloco titulo="Faturas">
                      {d.faturas.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhuma fatura.</p>
                      ) : (
                        <ul className="divide-y divide-border text-sm">
                          {d.faturas.slice(0, 8).map((f) => (
                            <li
                              key={f.id}
                              className="flex flex-col gap-0.5 py-1.5 sm:flex-row sm:justify-between sm:gap-3"
                            >
                              <span className="truncate">{f.descricao}</span>
                              <span className="tabular-nums text-muted-foreground sm:shrink-0 sm:text-foreground">
                                {formatBRL(Number(f.valor))} · {formatData(f.vencimento)} ·{" "}
                                {rotulo(FATURA, f.status)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Bloco>
                  </>
                )}
              </TabsContent>

              <TabsContent value="pessoas">
                {q.isLoading && <Skeleton className="h-32" />}
                <ul className="divide-y divide-border">
                  {(q.data?.pessoas ?? []).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.email_mascarado ?? "—"} · {rotulo(PAPEL, p.papel)}
                          {p.equipe ? ` · ${p.equipe}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {p.mfa_ativo && <Badge variant="outline">2 fatores</Badge>}
                        <Badge variant={p.ativo ? "secondary" : "outline"}>
                          {p.ativo ? "Ativo" : "Desligado"}
                        </Badge>
                      </div>
                    </li>
                  ))}
                  {q.data && q.data.pessoas.length === 0 && (
                    <li className="py-6 text-center text-sm text-muted-foreground">
                      Nenhuma pessoa nesta conta.
                    </li>
                  )}
                </ul>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="size-3.5" /> E-mails mascarados: a lista não expõe dado pessoal.
                </p>
              </TabsContent>

              {podeAlterar && (
                <TabsContent value="acoes">
                  <AcoesLicenca licenca={licenca} planos={planos} />
                </TabsContent>
              )}
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border p-3">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function Numeros({ itens }: { itens: [string, number][] }) {
  return (
    <dl className="grid grid-cols-3 gap-2">
      {itens.map(([r, v]) => (
        <div key={r}>
          <dt className="text-xs text-muted-foreground">{r}</dt>
          <dd className="text-lg font-semibold tabular-nums">{Number(v ?? 0)}</dd>
        </div>
      ))}
    </dl>
  );
}

function AcoesLicenca({ licenca, planos }: { licenca: Licenca; planos: PlanoLicenca[] }) {
  const qc = useQueryClient();
  const situacaoFn = useServerFn(alterarSituacaoLicenca);
  const testeFn = useServerFn(concederTesteLicenca);
  const planoFn = useServerFn(mudarPlanoLicenca);
  const creditosFn = useServerFn(concederCreditosLicenca);

  const [novaSituacao, setNovaSituacao] = useState<SituacaoLicenca>(licenca.status);
  const [motivoSituacao, setMotivoSituacao] = useState("");
  const [dias, setDias] = useState("14");
  const [motivoTeste, setMotivoTeste] = useState("");
  const [planoId, setPlanoId] = useState(licenca.plano_id ?? "");
  const [creditos, setCreditos] = useState("");
  const [motivoCredito, setMotivoCredito] = useState<"bonus_plano" | "estorno">("bonus_plano");

  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ["plataforma-licencas"] });
    qc.invalidateQueries({ queryKey: ["plataforma-licenca", licenca.id] });
  };
  const erro = (e: unknown) => toast.error(mensagemDeErro(e, "Não foi possível concluir."));

  const situacao = useMutation({
    mutationFn: () =>
      situacaoFn({ data: { id: licenca.id, status: novaSituacao, motivo: motivoSituacao } }),
    onSuccess: () => {
      toast.success(`Situação alterada para "${SITUACAO[novaSituacao].rotulo}".`);
      setMotivoSituacao("");
      recarregar();
    },
    onError: erro,
  });
  const teste = useMutation({
    mutationFn: () =>
      testeFn({ data: { id: licenca.id, dias: Number(dias), motivo: motivoTeste } }),
    onSuccess: (r) => {
      toast.success(
        Number(dias) === 0
          ? "Teste encerrado. A conta ficou em somente leitura."
          : `Teste liberado até ${r.ate ? formatData(r.ate) : "—"}.`,
      );
      setMotivoTeste("");
      recarregar();
    },
    onError: erro,
  });
  const plano = useMutation({
    mutationFn: () => planoFn({ data: { id: licenca.id, planoId } }),
    onSuccess: (r) => {
      toast.success(`Plano alterado para ${r.plano}.`);
      recarregar();
    },
    onError: erro,
  });
  const credito = useMutation({
    mutationFn: () =>
      creditosFn({ data: { id: licenca.id, quantidade: Number(creditos), motivo: motivoCredito } }),
    onSuccess: (r) => {
      toast.success(`Créditos lançados. Saldo agora: ${r.saldo ?? "—"}.`);
      setCreditos("");
      recarregar();
    },
    onError: erro,
  });

  const planosDoTipo = planos.filter((p) => p.publico === licenca.tipo || p.publico === "todos");

  return (
    <div className="space-y-4">
      <Bloco titulo="Carteira e acesso">
        <CarteiraLicenca licenca={licenca} />
      </Bloco>

      <Bloco titulo="Situação da conta">
        <div className="space-y-2">
          <Select value={novaSituacao} onValueChange={(v) => setNovaSituacao(v as SituacaoLicenca)}>
            <SelectTrigger aria-label="Nova situação">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SITUACAO) as SituacaoLicenca[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {SITUACAO[s].rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            aria-label="Motivo da mudança de situação"
            rows={2}
            placeholder="Motivo (fica registrado na auditoria)"
            value={motivoSituacao}
            onChange={(e) => setMotivoSituacao(e.target.value)}
          />
          <Button
            size="sm"
            onClick={() => situacao.mutate()}
            disabled={
              situacao.isPending ||
              novaSituacao === licenca.status ||
              motivoSituacao.trim().length < 5
            }
          >
            Alterar situação
          </Button>
        </div>
      </Bloco>

      <Bloco titulo="Teste grátis">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="lic-dias" className="shrink-0 text-sm">
              Dias a mais
            </Label>
            <Input
              id="lic-dias"
              type="number"
              min={0}
              max={365}
              className="w-24"
              value={dias}
              onChange={(e) => setDias(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              Somam ao prazo atual (ou contam de hoje, se já venceu). 0 encerra o teste.
            </span>
          </div>
          <Textarea
            aria-label="Motivo do teste"
            rows={2}
            placeholder="Motivo (ex.: combinado com o cliente na reunião de hoje)"
            value={motivoTeste}
            onChange={(e) => setMotivoTeste(e.target.value)}
          />
          <Button
            size="sm"
            onClick={() => teste.mutate()}
            disabled={
              teste.isPending ||
              dias === "" ||
              Number(dias) < 0 ||
              Number(dias) > 365 ||
              motivoTeste.trim().length < 5
            }
          >
            Aplicar teste
          </Button>
        </div>
      </Bloco>

      <Bloco titulo="Plano">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={planoId} onValueChange={setPlanoId}>
            <SelectTrigger aria-label="Plano" className="flex-1">
              <SelectValue placeholder="Escolha o plano" />
            </SelectTrigger>
            <SelectContent>
              {planosDoTipo.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome} · {formatBRL(p.preco_mensal)}/mês
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => plano.mutate()}
            disabled={plano.isPending || !planoId || planoId === licenca.plano_id}
          >
            Trocar plano
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Troca os recursos liberados. Preço e cobrança seguem na assinatura.
        </p>
      </Bloco>

      <Bloco titulo="Desconto">
        <DescontoDaLicenca licenca={licenca} />
      </Bloco>

      <Bloco titulo="Créditos">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            aria-label="Quantidade de créditos"
            type="number"
            min={1}
            max={10000}
            placeholder="Quantidade"
            className="sm:w-32"
            value={creditos}
            onChange={(e) => setCreditos(e.target.value)}
          />
          <Select
            value={motivoCredito}
            onValueChange={(v) => setMotivoCredito(v as typeof motivoCredito)}
          >
            <SelectTrigger aria-label="Motivo dos créditos" className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bonus_plano">Cortesia</SelectItem>
              <SelectItem value="estorno">Estorno</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => credito.mutate()}
            disabled={credito.isPending || !(Number(creditos) >= 1 && Number(creditos) <= 10000)}
          >
            Lançar
          </Button>
        </div>
      </Bloco>
    </div>
  );
}
