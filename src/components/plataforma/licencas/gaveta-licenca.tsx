import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Activity,
  Building2,
  Calculator,
  Coins,
  FileText,
  Globe,
  Home,
  KeyRound,
  ShieldCheck,
  UserRoundPlus,
  Users,
} from "lucide-react";
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, Dado, EstadoErro, EstadoVazio, IconeGestao, Selo } from "@/components/plataforma/kit";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL, formatData } from "@/lib/financeiro/format";
import {
  alterarSituacaoLicenca,
  concederCreditosLicenca,
  concederTesteLicenca,
  detalheLicenca,
  mudarPlanoLicenca,
  type Licenca,
  type PlanoLicenca,
  type SituacaoLicenca,
} from "@/lib/plataforma/licencas.functions";
import { CarteiraLicenca } from "./carteira-licenca";
import { IndicacaoDaLicenca } from "./indicacao-licenca";
import { DescontoDaLicenca } from "./desconto-licenca";
import {
  ROTULO_ASSINATURA,
  ROTULO_CICLO,
  ROTULO_FATURA,
  ROTULO_PAPEL,
  ROTULO_TIPO,
  SITUACAO_LICENCA,
  rotuloDe,
  situacaoLicenca,
  ehCortesia,
} from "./rotulos";

export type AbaLicenca = "resumo" | "cobranca" | "pessoas" | "acoes";
/** Bloco das ações para onde a gaveta rola ao abrir por uma ação da lista. */
export type SecaoAcao = "situacao" | "teste" | "plano" | "desconto" | "creditos" | "carteira" | "indicacao";

const TOM_FATURA: Record<string, "sucesso" | "alerta" | "perigo" | "neutro"> = {
  paga: "sucesso",
  pendente: "alerta",
  vencida: "perigo",
};

/** Detalhe da licença numa gaveta com abas: resumo, cobrança, pessoas e ações. */
export function GavetaLicenca({
  licenca,
  planos,
  carteiras,
  abaInicial = "resumo",
  secaoInicial,
  onFechar,
}: {
  licenca: Licenca | null;
  planos: PlanoLicenca[];
  carteiras: { id: string; nome: string }[];
  abaInicial?: AbaLicenca;
  secaoInicial?: SecaoAcao;
  onFechar: () => void;
}) {
  const detalheFn = useServerFn(detalheLicenca);
  const podeAlterar = usePermissao("saas.licencas", "edit");
  const [aba, setAba] = useState<AbaLicenca>(abaInicial);
  useEffect(() => setAba(abaInicial), [abaInicial, licenca?.id]);
  useEffect(() => {
    if (!licenca || !secaoInicial || aba !== "acoes") return;
    const t = setTimeout(
      () => document.getElementById(`acao-${secaoInicial}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
      120,
    );
    return () => clearTimeout(t);
  }, [licenca, secaoInicial, aba]);

  const q = useQuery({
    queryKey: ["plataforma-licenca", licenca?.id],
    queryFn: () => detalheFn({ data: { id: licenca!.id } }),
    enabled: !!licenca,
  });
  const d = q.data?.detalhe;
  const s = licenca ? situacaoLicenca(licenca.status) : null;

  return (
    <Sheet open={!!licenca} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-2xl">
        {licenca && s && (
          <>
            <SheetHeader className="space-y-3 border-b border-border px-5 py-4 text-left">
              <div className="flex items-start gap-3 pr-8">
                <IconeGestao icone={<Building2 />} tamanho="lg" />
                <div className="min-w-0">
                  <SheetTitle className="truncate">{licenca.nome}</SheetTitle>
                  <SheetDescription className="truncate">
                    {ROTULO_TIPO[licenca.tipo]} · {licenca.email_contato ?? licenca.slug}
                  </SheetDescription>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Selo tom={s.tom} ponto={licenca.status === "ativo"}>
                  {s.rotulo}
                </Selo>
                <Selo tom="marca">{licenca.plano ?? "Sem plano"}</Selo>
                {licenca.carteira_grupo_nome && <Selo>Carteira {licenca.carteira_grupo_nome}</Selo>}
                {licenca.trial_ate && <Selo tom="info">Teste até {formatData(licenca.trial_ate)}</Selo>}
                {ehCortesia(licenca) && licenca.acesso_ate && (
                  <Selo tom="info">Cortesia até {formatData(licenca.acesso_ate)}</Selo>
                )}
                {licenca.indicado_por_nome && <Selo>Indicada por {licenca.indicado_por_nome}</Selo>}
              </div>
              {licenca.status_motivo && (
                <p className="text-xs text-muted-foreground">Motivo da situação: {licenca.status_motivo}</p>
              )}
            </SheetHeader>

            <Tabs value={aba} onValueChange={(v) => setAba(v as AbaLicenca)} className="flex min-h-0 flex-1 flex-col">
              <div className="border-b border-border px-5 pt-3">
                <TabsList className="h-auto w-full justify-start overflow-x-auto">
                  <TabsTrigger value="resumo" className="min-h-11 sm:min-h-9">
                    Resumo
                  </TabsTrigger>
                  <TabsTrigger value="cobranca" className="min-h-11 sm:min-h-9">
                    Cobrança
                  </TabsTrigger>
                  <TabsTrigger value="pessoas" className="min-h-11 sm:min-h-9">
                    Pessoas
                  </TabsTrigger>
                  {podeAlterar && (
                    <TabsTrigger value="acoes" className="min-h-11 sm:min-h-9">
                      Ações
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {q.isError && (
                  <EstadoErro mensagem={mensagemDeErro(q.error, "Não foi possível abrir a conta.")} onTentar={() => q.refetch()} />
                )}

                <TabsContent value="resumo" className="mt-0 space-y-4">
                  {q.isLoading && <Skeleton className="h-48 rounded-xl" />}
                  {d && (
                    <>
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                        <Uso rotulo="Clientes" valor={d.uso.clientes} icone={<Users />} />
                        <Uso rotulo="Imóveis" valor={d.uso.imoveis} icone={<Home />} />
                        <Uso rotulo="Simulações" valor={d.uso.simulacoes} icone={<Calculator />} />
                        <Uso rotulo="Propostas" valor={d.uso.propostas} icone={<FileText />} />
                        <Uso rotulo="Locações" valor={d.uso.contratos_locacao} icone={<KeyRound />} />
                        <Uso rotulo="Sites no ar" valor={d.uso.sites_publicados} icone={<Globe />} />
                      </div>
                      <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border p-4">
                        <Dado rotulo="Última atividade">
                          {d.uso.ultima_atividade ? formatData(d.uso.ultima_atividade) : "Nenhuma"}
                        </Dado>
                        <Dado rotulo="Sessões ativas">{d.sessoes_ativas}</Dado>
                        <Dado rotulo="Conta desde">{formatData(licenca.criado_em)}</Dado>
                        <Dado rotulo="Saúde da conta">
                          {licenca.score != null ? `${licenca.score} pontos${licenca.faixa ? ` · ${licenca.faixa}` : ""}` : "Sem cálculo"}
                        </Dado>
                        <Dado rotulo="Documento">{licenca.documento_mascarado ?? "—"}</Dado>
                        <Dado rotulo="CRECI">
                          {licenca.creci ? `${licenca.creci}${licenca.creci_uf ? `/${licenca.creci_uf}` : ""}` : "—"}
                        </Dado>
                      </dl>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="cobranca" className="mt-0 space-y-4">
                  {q.isLoading && <Skeleton className="h-40 rounded-xl" />}
                  {d && (
                    <>
                      <section className="rounded-xl border border-border p-4">
                        <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Assinatura</h3>
                        {d.assinatura ? (
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="text-lg font-medium tabular-nums">
                              {formatBRL(Number(d.assinatura.valor))}
                              <span className="text-sm font-normal text-muted-foreground">
                                /{rotuloDe(ROTULO_CICLO, d.assinatura.ciclo)}
                              </span>
                            </p>
                            <Selo tom={d.assinatura.status === "inadimplente" ? "perigo" : d.assinatura.status === "ativa" ? "sucesso" : "neutro"}>
                              {rotuloDe(ROTULO_ASSINATURA, d.assinatura.status)}
                            </Selo>
                            <p className="w-full text-xs text-muted-foreground">
                              {d.assinatura.plano ?? licenca.plano ?? "—"}
                              {d.assinatura.proxima_cobranca_em
                                ? ` · próxima cobrança em ${formatData(d.assinatura.proxima_cobranca_em)}`
                                : ""}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Sem assinatura{licenca.trial_ate ? ` — teste até ${formatData(licenca.trial_ate)}` : ""}.
                          </p>
                        )}
                      </section>
                      <section className="rounded-xl border border-border">
                        <h3 className="border-b border-border px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Faturas recentes
                        </h3>
                        {d.faturas.length === 0 ? (
                          <EstadoVazio titulo="Nenhuma fatura" className="py-8" />
                        ) : (
                          <ul className="divide-y divide-border/70">
                            {d.faturas.slice(0, 12).map((f) => (
                              <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                                <div className="min-w-0">
                                  <p className="truncate text-sm">{f.descricao}</p>
                                  <p className="text-xs text-muted-foreground">
                                    vence {formatData(f.vencimento)}
                                    {f.pago_em ? ` · paga em ${formatData(f.pago_em)}` : ""}
                                  </p>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                  <span className="text-sm font-medium tabular-nums">{formatBRL(Number(f.valor))}</span>
                                  <Selo tom={TOM_FATURA[f.status] ?? "neutro"}>{rotuloDe(ROTULO_FATURA, f.status)}</Selo>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>
                      <section className="rounded-xl border border-border p-4">
                        <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Créditos</h3>
                        <div className="grid grid-cols-3 gap-2">
                          <Dado rotulo="Saldo">{Number(d.creditos.saldo ?? 0)}</Dado>
                          <Dado rotulo="Comprados">{Number(d.creditos.comprados ?? 0)}</Dado>
                          <Dado rotulo="Consumidos">{Number(d.creditos.consumidos ?? 0)}</Dado>
                        </div>
                      </section>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="pessoas" className="mt-0">
                  {q.isLoading && <Skeleton className="h-32 rounded-xl" />}
                  {q.data && q.data.pessoas.length === 0 && <EstadoVazio icone={<Users />} titulo="Nenhuma pessoa nesta conta" />}
                  <ul className="divide-y divide-border/70 rounded-xl border border-border">
                    {(q.data?.pessoas ?? []).map((p) => (
                      <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                        <Avatar nome={p.nome} tamanho="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{p.nome}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {p.email_mascarado ?? "—"} · {rotuloDe(ROTULO_PAPEL, p.papel)}
                            {p.equipe ? ` · ${p.equipe}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-1">
                          <Selo tom={p.ativo ? "sucesso" : "neutro"}>{p.ativo ? "Ativo" : "Desligado"}</Selo>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="size-3.5" /> E-mails mascarados: a lista não expõe dado pessoal.
                  </p>
                </TabsContent>

                {podeAlterar && (
                  <TabsContent value="acoes" className="mt-0">
                    <AcoesLicenca licenca={licenca} planos={planos} carteiras={carteiras} />
                  </TabsContent>
                )}
              </div>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Uso({ rotulo, valor, icone }: { rotulo: string; valor: number; icone: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-secondary/30 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground [&_svg]:size-3.5">
        {icone}
        {rotulo}
      </p>
      <p className="mt-0.5 text-lg font-medium tabular-nums tracking-tight">{Number(valor ?? 0)}</p>
    </div>
  );
}

function BlocoAcao({
  id,
  titulo,
  descricao,
  icone,
  children,
}: {
  id: SecaoAcao;
  titulo: string;
  descricao?: string;
  icone: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={`acao-${id}`} className="scroll-mt-4 rounded-xl border border-border p-4">
      <header className="mb-3 flex items-start gap-2.5">
        <IconeGestao icone={icone} tamanho="sm" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{titulo}</h3>
          {descricao && <p className="text-xs text-muted-foreground">{descricao}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function AcoesLicenca({
  licenca,
  planos,
  carteiras,
}: {
  licenca: Licenca;
  planos: PlanoLicenca[];
  carteiras: { id: string; nome: string }[];
}) {
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
    mutationFn: () => situacaoFn({ data: { id: licenca.id, status: novaSituacao, motivo: motivoSituacao } }),
    onSuccess: () => {
      toast.success(`Situação alterada para "${SITUACAO_LICENCA[novaSituacao].rotulo}".`);
      setMotivoSituacao("");
      recarregar();
    },
    onError: erro,
  });
  const teste = useMutation({
    mutationFn: () => testeFn({ data: { id: licenca.id, dias: Number(dias), motivo: motivoTeste } }),
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
  const diasN = Number(dias);

  return (
    <div className="space-y-3">
      <BlocoAcao id="situacao" titulo="Situação da conta" descricao="O motivo fica registrado na auditoria." icone={<Activity />}>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Nova situação">
            {(Object.keys(SITUACAO_LICENCA) as SituacaoLicenca[]).map((st) => (
              <button
                key={st}
                type="button"
                role="radio"
                aria-checked={novaSituacao === st}
                onClick={() => setNovaSituacao(st)}
                className={
                  "min-h-11 rounded-full border px-3 text-sm transition-colors sm:min-h-8 " +
                  (novaSituacao === st
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-secondary/60")
                }
              >
                {SITUACAO_LICENCA[st].rotulo}
                {st === licenca.status ? " (atual)" : ""}
              </button>
            ))}
          </div>
          <Textarea
            aria-label="Motivo da mudança de situação"
            rows={2}
            placeholder="Motivo (pelo menos 5 letras)"
            value={motivoSituacao}
            onChange={(e) => setMotivoSituacao(e.target.value)}
          />
          <Button
            size="sm"
            className="min-h-11 sm:min-h-9"
            variant={novaSituacao === "suspenso" || novaSituacao === "cancelado" ? "destructive" : "default"}
            onClick={() => situacao.mutate()}
            disabled={situacao.isPending || novaSituacao === licenca.status || motivoSituacao.trim().length < 5}
          >
            Alterar para {SITUACAO_LICENCA[novaSituacao].rotulo.toLowerCase()}
          </Button>
        </div>
      </BlocoAcao>

      <BlocoAcao
        id="teste"
        titulo="Teste grátis"
        descricao="Os dias somam ao prazo atual (ou contam de hoje, se já venceu). 0 encerra o teste."
        icone={<KeyRound />}
      >
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
            className="min-h-11 sm:min-h-9"
            onClick={() => teste.mutate()}
            disabled={teste.isPending || dias === "" || diasN < 0 || diasN > 365 || motivoTeste.trim().length < 5}
          >
            {diasN === 0 ? "Encerrar teste" : "Aplicar teste"}
          </Button>
        </div>
      </BlocoAcao>

      <BlocoAcao id="plano" titulo="Plano" descricao="Troca os recursos liberados. Preço e cobrança seguem na assinatura." icone={<FileText />}>
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
            className="min-h-11 sm:min-h-9"
            onClick={() => plano.mutate()}
            disabled={plano.isPending || !planoId || planoId === licenca.plano_id}
          >
            Trocar plano
          </Button>
        </div>
      </BlocoAcao>

      <BlocoAcao id="desconto" titulo="Desconto" icone={<Coins />}>
        <DescontoDaLicenca licenca={licenca} />
      </BlocoAcao>

      <BlocoAcao id="creditos" titulo="Créditos" descricao="Cortesia ou estorno, de 1 a 10.000." icone={<Coins />}>
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
          <Select value={motivoCredito} onValueChange={(v) => setMotivoCredito(v as typeof motivoCredito)}>
            <SelectTrigger aria-label="Motivo dos créditos" className="sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bonus_plano">Cortesia</SelectItem>
              <SelectItem value="estorno">Estorno</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="min-h-11 sm:min-h-9"
            onClick={() => credito.mutate()}
            disabled={credito.isPending || !(Number(creditos) >= 1 && Number(creditos) <= 10000)}
          >
            Lançar créditos
          </Button>
        </div>
      </BlocoAcao>

      <BlocoAcao
        id="indicacao"
        titulo="Indicação"
        descricao="Quem indicou a conta. A cortesia vence e passa a cobrar normalmente."
        icone={<UserRoundPlus />}
      >
        <IndicacaoDaLicenca licenca={licenca} />
      </BlocoAcao>

      <BlocoAcao id="carteira" titulo="Carteira e acesso" icone={<Users />}>
        <CarteiraLicenca licenca={licenca} carteiras={carteiras} />
      </BlocoAcao>
    </div>
  );
}

