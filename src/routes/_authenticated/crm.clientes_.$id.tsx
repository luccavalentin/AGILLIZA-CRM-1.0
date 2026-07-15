import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calculator,
  MessageCircle,
  Users,
  UserCog,
  ContactRound,
  Home,
  ClipboardCheck,
  FileText,
  Handshake,
  History,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PipelineTimeline } from "@/components/crm/pipeline-timeline";
import { ClienteForm } from "@/components/crm/cliente-form";
import { DocumentosTab } from "@/components/crm/documentos-tab";
import { InteracoesTab } from "@/components/crm/interacoes-tab";
import { VinculoTab } from "@/components/crm/vinculo-tab";
import { ChatClienteInstagram } from "@/components/crm/chat-cliente-instagram";
import { VendedoresTab } from "@/components/crm/vendedores-tab";
import { ImovelTab, IqTab } from "@/components/crm/imovel-iq-tab";
import { StatusBadge } from "@/components/crm/tone-badge";
import { SimulacaoStatusBadge } from "@/components/simulacao/status-badge";
import { PropostaStatusBadge } from "@/components/propostas/status-badge";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { corDoBanco } from "@/lib/bancos/cores";
import { Building2 } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  getCliente,
  getPipelineStages,
  getClientePipeline,
  getEndereco,
  listarHistorico,
  getClienteNegocios,
  definirEtapa,
} from "@/lib/crm/clientes.functions";
import { formatarDocumento, formatarCelular } from "@/lib/crm/documento";
import { usePipelineRealtime } from "@/hooks/use-pipeline-realtime";

export const Route = createFileRoute("/_authenticated/crm/clientes_/$id")({
  head: () => ({ meta: [{ title: "Cliente — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-destructive">Erro ao carregar o cliente.</div>
  ),
  notFoundComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Cliente não encontrado.</div>
  ),
});

function Pagina() {
  usePipelineRealtime();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getCli = useServerFn(getCliente);
  const getStages = useServerFn(getPipelineStages);
  const getPipe = useServerFn(getClientePipeline);
  const getEnd = useServerFn(getEndereco);
  const getHist = useServerFn(listarHistorico);
  const getNeg = useServerFn(getClienteNegocios);
  const setEtapa = useServerFn(definirEtapa);
  const [movendoEtapa, setMovendoEtapa] = useState(false);
  const [aba, setAba] = useState("resumo");

  async function moverParaEtapa(codigo: string) {
    setMovendoEtapa(true);
    try {
      await setEtapa({ data: { cliente_id: id, codigo_destino: codigo } });
      await qc.invalidateQueries({ queryKey: ["cliente-pipeline", id] });
      await qc.invalidateQueries({ queryKey: ["cliente-hist", id] });
      toast.success("Etapa atualizada.");
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível mover a etapa.");
    } finally {
      setMovendoEtapa(false);
    }
  }

  const { data: det, isLoading } = useQuery({
    queryKey: ["cliente", id],
    queryFn: () => getCli({ data: { id } }),
  });
  const { data: stages } = useQuery({ queryKey: ["pipeline-stages"], queryFn: () => getStages() });
  const { data: pipe } = useQuery({
    queryKey: ["cliente-pipeline", id],
    queryFn: () => getPipe({ data: { cliente_id: id } }),
  });
  const { data: endereco } = useQuery({
    queryKey: ["cliente-end", id],
    queryFn: () => getEnd({ data: { cliente_id: id } }),
  });
  const { data: historico } = useQuery({
    queryKey: ["cliente-hist", id],
    queryFn: () => getHist({ data: { cliente_id: id } }),
  });
  const { data: negocios } = useQuery({
    queryKey: ["cliente-negocios", id],
    queryFn: () => getNeg({ data: { cliente_id: id } }),
  });

  if (isLoading || !det) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const c = det.cliente;
  const docExib = det.podePii ? formatarDocumento(c.documento) : c.documento;

  const iniciais = (c.nome ?? "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase() ?? "")
    .join("");
  const celularExib = det.podePii ? formatarCelular((c as any).telefone_celular) : null;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="h-9 w-9 shrink-0">
          <Link to="/crm/clientes">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <span className="text-sm text-muted-foreground">Voltar aos clientes</span>
      </div>

      {/* Cabeçalho do cliente */}
      <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-primary/[0.06] via-card to-card p-5 sm:p-6">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary ring-1 ring-inset ring-primary/15">
              {iniciais}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
                  {c.nome}
                </h1>
                <StatusBadge status={c.portal_acesso_ativo ? "ativo" : "inativo"} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span className="font-mono text-xs">{c.numero_cliente}</span>
                <span className="text-border">·</span>
                <span className="font-mono text-xs">{docExib}</span>
                {celularExib && (
                  <>
                    <span className="text-border">·</span>
                    <span className="text-xs">{celularExib}</span>
                  </>
                )}
                {c.uf_interesse && (
                  <>
                    <span className="text-border">·</span>
                    <span className="text-xs">{c.uf_interesse}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="default"
            className="shrink-0"
            onClick={() => {
              const ec = c.estado_civil ?? "";
              const casado = ec === "casado" || ec === "uniao_estavel";
              sessionStorage.setItem(
                "simulacao_wizard",
                JSON.stringify({
                  cliente_id: c.id,
                  nome_cliente: c.nome ?? "",
                  cpf_cnpj: c.documento ?? "",
                  data_nascimento: c.data_nascimento ?? "",
                  renda_total: Number(c.renda_total_declarada) || 0,
                  uf: c.uf_interesse ?? "",
                  possui_conjuge: casado,
                  compoe_renda: casado && Number((c as any).conjuge_renda) > 0,
                  nome_conjuge: (c as any).conjuge_nome ?? "",
                  cpf_conjuge: (c as any).conjuge_cpf ?? "",
                  renda_conjuge: Number((c as any).conjuge_renda) || 0,
                  data_nascimento_conjuge: (c as any).conjuge_data_nascimento ?? "",
                  email_conjuge: (c as any).conjuge_email ?? "",
                  celular_conjuge: (c as any).conjuge_celular ?? "",
                }),
              );
              navigate({ to: "/operacional/simulacoes/completa" });
            }}
          >
            <Calculator className="size-4" /> Nova simulação
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Esteira</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {stages && pipe ? (
            <>
              <PipelineTimeline
                stages={stages}
                atualOrdem={pipe.ordem}
                onSelecionar={moverParaEtapa}
                disabled={movendoEtapa}
              />
              <p className="text-xs text-muted-foreground">
                Clique em qualquer etapa para mover o cliente na esteira.
              </p>
            </>
          ) : (
            <Skeleton className="h-8 w-full" />
          )}
        </CardContent>
      </Card>



      <Tabs value={aba} onValueChange={setAba}>
        {(() => {
          const secoes = [
            { v: "resumo", label: "Resumo", Icon: LayoutDashboard },
            { v: "vinculo", label: "Vínculo de atendimento", Icon: UserCog },
            { v: "dados", label: "Dados do comprador", Icon: ContactRound },
            { v: "vendedores", label: "Vendedores", Icon: Users },
            { v: "imovel", label: "Imóvel", Icon: Home },
            { v: "iq", label: "IQ", Icon: ClipboardCheck },
            { v: "documentos", label: "Documentos", Icon: FileText },
            { v: "negocios", label: "Negócios", Icon: Handshake },
            { v: "mensagens", label: "App cliente", Icon: MessageCircle },
            { v: "interacoes", label: "Registro de interações", Icon: History },
            { v: "historico", label: "Histórico", Icon: History },
          ] as const;
          const atual = secoes.find((s) => s.v === aba) ?? secoes[0];
          return (
            <>
              {/* Mobile: seletor explícito de seção */}
              <div className="sm:hidden">
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Seção do cliente
                </p>
                <Select value={aba} onValueChange={setAba}>
                  <SelectTrigger className="w-full">
                    <span className="flex items-center gap-2">
                      <atual.Icon className="size-4 text-primary" />
                      <SelectValue />
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {secoes.map((s) => (
                      <SelectItem key={s.v} value={s.v}>
                        <span className="flex items-center gap-2">
                          <s.Icon className="size-4" /> {s.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Desktop: abas roláveis com dica visual de que há mais */}
              <div className="relative hidden sm:block">
                <TabsList className="flex w-full flex-nowrap justify-start gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {secoes.map((s) => (
                    <TabsTrigger
                      key={s.v}
                      value={s.v}
                      className="shrink-0 gap-1.5 whitespace-nowrap rounded-lg transition-colors hover:bg-primary/10 hover:text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/25"
                    >
                      <s.Icon className="size-4" />
                      {s.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {/* Degradê à direita indicando que a lista continua */}
                <div className="pointer-events-none absolute inset-y-1 right-0 w-10 rounded-r-xl bg-gradient-to-l from-muted/90 to-transparent" />
              </div>
              <p className="mt-1.5 hidden text-[11px] text-muted-foreground sm:block">
                Deslize para ver mais seções · clique em uma aba para abrir.
              </p>
            </>
          );
        })()}

        <TabsContent value="vendedores" className="mt-4">
          <VendedoresTab clienteId={id} />
        </TabsContent>

        <TabsContent value="imovel" className="mt-4">
          <ImovelTab clienteId={id} cliente={c} />
        </TabsContent>

        <TabsContent value="iq" className="mt-4">
          <IqTab clienteId={id} cliente={c} />
        </TabsContent>


        <TabsContent value="resumo" className="mt-4 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Dados pessoais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Linha rotulo="CPF" valor={docExib} />
              <Linha
                rotulo="RG"
                valor={
                  (c as any).numero_documento
                    ? `${(c as any).numero_documento}${(c as any).orgao_expedidor ? " · " + (c as any).orgao_expedidor : ""}${(c as any).uf_expedicao ? "/" + (c as any).uf_expedicao : ""}`
                    : "—"
                }
              />
              <Linha
                rotulo="RG - data de emissão"
                valor={
                  (c as any).data_expedicao ? formatarDataCivil((c as any).data_expedicao) : "—"
                }
              />
              <Linha rotulo="E-mail" valor={c.email ?? "—"} />
              <Linha
                rotulo="Celular"
                valor={c.telefone_celular ? formatarCelular(c.telefone_celular) : "—"}
              />
              <Linha rotulo="Nascimento" valor={formatarDataCivil(c.data_nascimento)} />
              <Linha
                rotulo="Renda declarada"
                valor={
                  c.renda_total_declarada != null
                    ? `R$ ${Number(c.renda_total_declarada).toLocaleString("pt-BR", {  minimumFractionDigits: 2 })}`
                    : "—"
                }
              />
              <Linha rotulo="UF de interesse" valor={c.uf_interesse ?? "—"} />
              <Linha
                rotulo="Conta bancária"
                valor={
                  (c as any).agencia || (c as any).conta_corrente
                    ? `${(c as any).banco_conta ? (c as any).banco_conta + " · " : ""}Ag. ${(c as any).agencia ?? "—"} · CC ${(c as any).conta_corrente ?? "—"}${(c as any).digito_conta ? "-" + (c as any).digito_conta : ""}`
                    : "—"
                }
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Atendimento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Linha rotulo="Responsável" valor={det.responsavel_nome ?? "—"} />
              <Linha
                rotulo="Etapa atual"
                valor={pipe ? (stages?.find((s: any) => s.codigo === pipe.codigo)?.nome ?? "—") : "—"}
              />
              <Linha rotulo="Origem" valor={c.origem} />
              <Linha
                rotulo="Cadastrado em"
                valor={new Date(c.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="negocios" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="size-4 text-primary" /> Simulações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {(negocios?.simulacoes.length ?? 0) === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Nenhuma simulação para este cliente.
                </p>
              ) : (
                negocios!.simulacoes.map((s) => (
                  <Link
                    key={s.id}
                    to="/operacional/simulacoes/$id"
                    params={{ id: s.id }}
                    className="group relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-xl border border-border bg-card p-3.5 pl-4 text-sm shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                  >
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 w-1 bg-primary/70"
                    />
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <FileText className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {s.produto === "home_equity" ? "Home Equity" : "Financiamento"}
                          </span>
                          <SimulacaoStatusBadge status={s.status ?? "—"} />
                        </div>
                        <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                          {s.numero_simulacao ?? "—"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold tabular-nums text-foreground">
                        {fmtValor(s.valor_financiamento)}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        Valor do financiamento
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Building2 className="size-4 text-primary" /> Propostas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {(negocios?.propostas.length ?? 0) === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Nenhuma proposta para este cliente.
                </p>
              ) : (
                negocios!.propostas.map((p) => {
                  const cor = corDoBanco(p.nome_banco);
                  return (
                    <Link
                      key={p.id}
                      to="/operacional/propostas/$id"
                      params={{ id: p.id }}
                      className="group relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-xl border border-border bg-card p-3.5 pl-4 text-sm shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                      style={{ ["--banco-cor" as string]: cor }}
                    >
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-0 w-1"
                        style={{ backgroundColor: cor }}
                      />
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="grid size-10 shrink-0 place-items-center rounded-lg"
                          style={{ backgroundColor: `${cor}14` }}
                        >
                          <BancoLogo nome={p.nome_banco} size="lg" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className="font-semibold"
                              style={{ color: cor }}
                            >
                              {p.nome_banco ?? "—"}
                            </span>
                            <PropostaStatusBadge
                              status={p.status ?? "—"}
                              banco={p.nome_banco}
                            />
                          </div>
                          <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                            {p.numero_proposta ?? "—"}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-bold tabular-nums text-foreground">
                          {fmtValor(p.valor_financiamento)}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          Valor do financiamento
                        </span>
                      </div>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dados" className="mt-4">
          <ClienteForm
            portalAtivo={c.portal_acesso_ativo}
            enderecoInicial={endereco as any}
            inicial={{
              id: c.id,
              tipo_pessoa: c.tipo_pessoa,
              nome: c.nome,
              documento: c.documento,
              documento_secundario: c.documento_secundario ?? "",
              data_nascimento: c.data_nascimento ?? "",
              estado_civil: c.estado_civil ?? "solteiro",
              regime_casamento: c.regime_casamento ?? "",
              mae: c.mae ?? "",
              pai: (c as any).pai ?? "",
              sexo: (c as any).sexo ?? "",
              nacionalidade: (c as any).nacionalidade ?? "",
              naturalidade: (c as any).naturalidade ?? "",
              tipo_documento_identidade: (c as any).tipo_documento_identidade ?? "",
              numero_documento: (c as any).numero_documento ?? "",
              orgao_expedidor: (c as any).orgao_expedidor ?? "",
              uf_expedicao: (c as any).uf_expedicao ?? "",
              data_expedicao: (c as any).data_expedicao ?? "",
              profissao: (c as any).profissao ?? "",
              empresa: (c as any).empresa ?? "",
              banco_conta: (c as any).banco_conta ?? "",
              agencia: (c as any).agencia ?? "",
              conta_corrente: (c as any).conta_corrente ?? "",
              digito_conta: (c as any).digito_conta ?? "",
              email: c.email ?? "",
              telefone_celular: c.telefone_celular ?? "",
              renda_total_declarada:
                c.renda_total_declarada != null ? String(c.renda_total_declarada) : "",
              uf_interesse: c.uf_interesse ?? "",
              utiliza_fgts: (c as any).utiliza_fgts ?? false,
              fg_autorizacao_dados: (c as any).fg_autorizacao_dados ?? false,
              origem: c.origem,
              conjuge_nome: (c as any).conjuge_nome ?? "",
              conjuge_cpf: (c as any).conjuge_cpf ?? "",
              conjuge_data_nascimento: (c as any).conjuge_data_nascimento ?? "",
              conjuge_nome_mae: (c as any).conjuge_nome_mae ?? "",
              conjuge_sexo: (c as any).conjuge_sexo ?? "",
              conjuge_nacionalidade: (c as any).conjuge_nacionalidade ?? "",
              conjuge_tipo_documento_identidade: (c as any).conjuge_tipo_documento_identidade ?? "",
              conjuge_numero_documento: (c as any).conjuge_numero_documento ?? "",
              conjuge_orgao_expedidor: (c as any).conjuge_orgao_expedidor ?? "",
              conjuge_uf_expedicao: (c as any).conjuge_uf_expedicao ?? "",
              conjuge_data_expedicao: (c as any).conjuge_data_expedicao ?? "",
              conjuge_profissao: (c as any).conjuge_profissao ?? "",
              conjuge_empresa: (c as any).conjuge_empresa ?? "",
              conjuge_renda: (c as any).conjuge_renda != null ? String((c as any).conjuge_renda) : "",
              conjuge_email: (c as any).conjuge_email ?? "",
              conjuge_celular: (c as any).conjuge_celular ?? "",
              conjuge_banco_conta: (c as any).conjuge_banco_conta ?? "",
              conjuge_agencia: (c as any).conjuge_agencia ?? "",
              conjuge_conta_corrente: (c as any).conjuge_conta_corrente ?? "",
              conjuge_digito_conta: (c as any).conjuge_digito_conta ?? "",
            }}
          />
        </TabsContent>

        <TabsContent value="documentos" className="mt-4">
          <DocumentosTab clienteId={id} />
        </TabsContent>

        <TabsContent value="vinculo" className="mt-4">
          <VinculoTab clienteId={id} responsavelNome={det.responsavel_nome} />
        </TabsContent>

        <TabsContent value="mensagens" className="mt-4">
          <div className="h-[68dvh] max-h-[680px] min-h-[420px]">
            <ChatClienteInstagram
              clienteId={id}
              info={{
                nome: c.nome,
                documento: docExib,
                email: c.email,
                celular: c.telefone_celular ? formatarCelular(c.telefone_celular) : null,
                contexto: (() => {
                  const nSim = negocios?.simulacoes.length ?? 0;
                  const nProp = negocios?.propostas.length ?? 0;
                  const partes: string[] = [];
                  if (nProp > 0) partes.push(`${nProp} proposta${nProp > 1 ? "s" : ""}`);
                  if (nSim > 0) partes.push(`${nSim} simulação${nSim > 1 ? "ões" : ""}`);
                  return partes.join(" · ") || null;
                })(),
              }}
            />
          </div>
        </TabsContent>



        <TabsContent value="interacoes" className="mt-4">
          <InteracoesTab clienteId={id} />
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          {(historico?.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem eventos.</p>
          ) : (
            <div className="space-y-2">
              {historico!.map((h: any) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm"
                >
                  <span className="text-foreground">{h.descricao}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(h.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function fmtValor(v: number | null): string {
  if (v == null) return "—";
  return `R$ ${Number(v).toLocaleString("pt-BR", {  minimumFractionDigits: 2 })}`;
}

function formatarDataCivil(data: string | null): string {
  if (!data) return "—";
  const [ano, mes, dia] = data.split("-");
  if (!ano || !mes || !dia) return data;
  return `${dia}/${mes}/${ano}`;
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-1 last:border-0">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="text-right font-medium text-foreground">{valor}</span>
    </div>
  );
}
