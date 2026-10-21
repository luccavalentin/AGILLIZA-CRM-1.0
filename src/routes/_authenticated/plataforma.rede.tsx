import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BadgeCheck,
  ChevronRight,
  Loader2,
  Network,
  RefreshCw,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { AdminHero } from "@/components/admin/admin-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL, formatData } from "@/lib/financeiro/format";
import { RodapePaginas } from "@/components/plataforma/paginacao";
import {
  POR_PAGINA_PARTICIPANTES,
  lerModeracaoRede,
  mediarDisputa,
  verificarParticipante,
  type DisputaRede,
  type ParticipanteRede,
  type StatusDisputa,
  type StatusParticipante,
} from "@/lib/plataforma/rede.functions";

export const Route = createFileRoute("/_authenticated/plataforma/rede")({
  head: () => ({ meta: [{ title: "Rede de Corretores — Plataforma — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("saas.marketplace"),
  component: Pagina,
});

const CHAVE = ["plataforma-rede"];

type Tom = "default" | "secondary" | "destructive" | "outline";
const VERDE = "text-emerald-700";

const STATUS: Record<StatusParticipante, { rotulo: string; tom: Tom; verde?: boolean }> = {
  pendente: { rotulo: "Pendente", tom: "secondary" },
  verificado: { rotulo: "Verificado", tom: "outline", verde: true },
  recusado: { rotulo: "Recusado", tom: "destructive" },
  suspenso: { rotulo: "Suspenso", tom: "destructive" },
};
const DISPUTA: Record<StatusDisputa, string> = {
  aberta: "Aberta",
  em_mediacao: "Em mediação",
  resolvida: "Resolvida",
  improcedente: "Improcedente",
};
const TIPO_CONTA: Record<string, string> = {
  corretor: "Corretor",
  imobiliaria: "Imobiliária",
  parceiro: "Parceiro",
};

type Filtro = "todos" | "pendentes" | "verificados" | "fora";

const dataHora = (s: string | null | undefined) => {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR");
};

function SeloParticipante({ status }: { status: string }) {
  const s = STATUS[status as StatusParticipante] ?? { rotulo: status, tom: "outline" as Tom };
  return (
    <Badge variant={s.tom} className={s.verde ? VERDE : undefined}>
      {s.rotulo}
    </Badge>
  );
}

function SeloDisputa({ d }: { d: DisputaRede }) {
  return (
    <Badge
      variant={d.resolvida_em ? "outline" : "secondary"}
      className={d.resolvida_em ? VERDE : undefined}
    >
      {DISPUTA[d.status as StatusDisputa] ?? d.status}
    </Badge>
  );
}

function Pagina() {
  const lerFn = useServerFn(lerModeracaoRede);
  const [filtro, setFiltroBruto] = useState<Filtro>("todos");
  const [pagina, setPagina] = useState(1);
  const setFiltro = (f: Filtro) => {
    setFiltroBruto(f);
    setPagina(1);
  };
  // Grupo e página rodam no banco; os totais de cada grupo também vêm de lá.
  const q = useQuery({
    queryKey: [...CHAVE, filtro, pagina],
    queryFn: () => lerFn({ data: { grupo: filtro, pagina } }),
    staleTime: 30_000,
    placeholderData: (anterior) => anterior,
  });
  const [participante, setParticipante] = useState<ParticipanteRede | null>(null);
  const [disputa, setDisputa] = useState<DisputaRede | null>(null);

  const participantes = q.data?.participantes ?? [];
  const disputas = q.data?.disputas ?? [];
  const contagem = q.data?.contagem ?? { todos: 0, pendentes: 0, verificados: 0, fora: 0 };
  const abertas = disputas.filter((d) => !d.resolvida_em);
  const emJogo = abertas.reduce((a, d) => a + Number(d.valor_negocio ?? 0), 0);
  const lista = participantes;
  const conta = (g: Filtro) => contagem[g];

  const irPara = (ancora: string) =>
    requestAnimationFrame(() =>
      document.getElementById(ancora)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  const verPendentes = () => {
    setFiltro("pendentes");
    irPara("rede-participantes");
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AdminHero
        secao="Plataforma"
        icon={<Network className="h-5 w-5" />}
        titulo="Rede de Corretores"
        descricao="Conferir o CRECI de quem quer entrar e decidir as disputas de parceria. É a conferência que dá valor à rede."
        acoes={
          <>
            {contagem.pendentes > 0 && (
              <Button size="sm" onClick={verPendentes}>
                <BadgeCheck className="mr-2 size-4" /> Conferir os CRECIs pendentes
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
              <RefreshCw className={`mr-2 size-4 ${q.isFetching ? "animate-spin" : ""}`} />{" "}
              Atualizar
            </Button>
          </>
        }
      />

      {q.isError && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {mensagemDeErro(q.error, "Não foi possível ler a Rede de Corretores.")}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Resumo
          rotulo="CRECI a conferir"
          valor={String(contagem.pendentes)}
          detalhe="pedidos de entrada"
          alerta={contagem.pendentes > 0}
          carregando={q.isLoading}
          onClick={verPendentes}
        />
        <Resumo
          rotulo="Verificados"
          valor={String(contagem.verificados)}
          detalhe="com selo na Rede"
          carregando={q.isLoading}
          onClick={() => {
            setFiltro("verificados");
            irPara("rede-participantes");
          }}
        />
        <Resumo
          rotulo="Disputas abertas"
          valor={String(abertas.length)}
          detalhe="esperando decisão"
          alerta={abertas.length > 0}
          carregando={q.isLoading}
          onClick={() => irPara("rede-disputas")}
        />
        <Resumo
          rotulo="Valor em disputa"
          valor={formatBRL(emJogo)}
          detalhe="negócios com parceria contestada"
          carregando={q.isLoading}
          onClick={() => irPara("rede-disputas")}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section
          id="rede-participantes"
          className="min-w-0 scroll-mt-20 rounded-lg border border-border bg-card"
        >
          <div className="space-y-2 border-b border-border p-4">
            <div>
              <h2 className="text-sm font-semibold">Participantes</h2>
              <p className="text-xs text-muted-foreground">
                Confira o número no site do CRECI da UF antes de verificar. É essa conferência que o
                corretor do outro lado está confiando.
              </p>
            </div>
            <div
              className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
              role="group"
              aria-label="Recorte dos participantes"
            >
              {(
                [
                  { id: "todos", rotulo: "Todos", total: conta("todos") },
                  { id: "pendentes", rotulo: "Pendentes", total: conta("pendentes") },
                  { id: "verificados", rotulo: "Verificados", total: conta("verificados") },
                  { id: "fora", rotulo: "Recusados e suspensos", total: conta("fora") },
                ] as { id: Filtro; rotulo: string; total: number }[]
              ).map((o) => (
                <Button
                  key={o.id}
                  type="button"
                  size="sm"
                  variant={filtro === o.id ? "default" : "outline"}
                  aria-pressed={filtro === o.id}
                  className="shrink-0 rounded-full"
                  onClick={() => setFiltro(o.id)}
                >
                  {o.rotulo}
                  <span className="ml-1 tabular-nums opacity-70">{o.total}</span>
                </Button>
              ))}
            </div>
          </div>
          {q.isLoading ? (
            <div className="p-4">
              <Skeleton className="h-16" />
            </div>
          ) : lista.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              {contagem.todos
                ? "Ninguém neste recorte. Os outros participantes continuam em “Todos”."
                : "Ninguém pediu para entrar na Rede. Quando um corretor ou imobiliária pedir entrada, o CRECI aparece aqui para conferência."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {lista.map((x) => (
                <li key={x.tenant_id}>
                  <button
                    type="button"
                    onClick={() => setParticipante(x)}
                    className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="break-words font-medium">
                          {x.conta ?? "Conta sem nome"}
                        </span>
                        <SeloParticipante status={x.status} />
                        {x.como_empresa && <Badge variant="outline">pessoa jurídica</Badge>}
                      </span>
                      <span className="block break-words text-xs text-muted-foreground">
                        {x.creci
                          ? `CRECI ${x.creci}${x.creci_uf ? `/${x.creci_uf}` : ""}`
                          : "sem CRECI informado"}
                        {x.regioes?.length ? ` · ${x.regioes.join(", ")}` : ""}
                      </span>
                      <span className="block text-xs tabular-nums text-muted-foreground">
                        {x.negocios_fechados} negócio(s) · pedido em {formatData(x.criado_em)}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <RodapePaginas
            pagina={pagina}
            porPagina={POR_PAGINA_PARTICIPANTES}
            quantidade={lista.length}
            total={conta(filtro)}
            carregando={q.isFetching}
            onPagina={setPagina}
          />
        </section>

        <div id="rede-disputas" className="min-w-0 scroll-mt-20 space-y-4">
          <section className="rounded-lg border border-border bg-card">
            <div className="border-b border-border p-4">
              <h2 className="text-sm font-semibold">Disputas de parceria</h2>
              <p className="text-xs text-muted-foreground">
                Quem levou o cliente, qual percentual foi combinado. A decisão escrita aqui é lida
                pelas duas partes.
              </p>
            </div>
            {q.isLoading ? (
              <div className="p-4">
                <Skeleton className="h-16" />
              </div>
            ) : disputas.length === 0 ? (
              <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                <Scale className="size-4" aria-hidden /> Nenhuma parceria foi contestada até agora.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {disputas.map((x) => (
                  <li key={x.id}>
                    <button
                      type="button"
                      onClick={() => setDisputa(x)}
                      className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/40"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="break-words font-medium">
                            Aberta por {x.aberta_por ?? "—"}
                          </span>
                          <SeloDisputa d={x} />
                        </span>
                        <span className="line-clamp-2 block break-words text-xs text-muted-foreground">
                          {x.motivo}
                        </span>
                        <span className="block text-xs tabular-nums text-muted-foreground">
                          {x.valor_negocio != null
                            ? formatBRL(Number(x.valor_negocio))
                            : "valor não informado"}
                          {x.percentual != null ? ` · ${Number(x.percentual)}%` : ""} ·{" "}
                          {formatData(x.criado_em)}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {q.data?.diasProtecao != null && (
            <section className="flex gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <p className="min-w-0 text-muted-foreground">
                <span className="font-medium text-foreground">Proteção de cliente na Rede.</span>{" "}
                Quem apresenta o cliente pela Rede fica protegido por {q.data.diasProtecao} dias
                (parâmetro{" "}
                <span className="break-all font-mono text-xs">rede.dias_protecao_cliente</span> das
                configurações globais). É a régua usada nas decisões.
              </p>
            </section>
          )}
        </div>
      </div>

      <DetalheParticipante p={participante} onFechar={() => setParticipante(null)} />
      <DetalheDisputa d={disputa} onFechar={() => setDisputa(null)} />
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
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/40 ${alerta ? "border-amber-400/70" : "border-border"}`}
    >
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      {carregando ? (
        <Skeleton className="mt-1 h-7 w-16" />
      ) : (
        <p className="truncate text-xl font-semibold tabular-nums">{valor}</p>
      )}
      <p className="truncate text-[11px] text-muted-foreground">{detalhe}</p>
    </button>
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

function DetalheParticipante({
  p,
  onFechar,
}: {
  p: ParticipanteRede | null;
  onFechar: () => void;
}) {
  const podeVerificar = usePermissao("saas.marketplace", "edit");
  return (
    <Sheet open={!!p} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {p && (
          <>
            <SheetHeader>
              <SheetTitle className="break-words pr-6">{p.conta ?? "Conta sem nome"}</SheetTitle>
              <SheetDescription>
                {TIPO_CONTA[p.conta_tipo ?? ""] ?? "Conta"} · pediu entrada em{" "}
                {formatData(p.criado_em)}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-1.5">
                <SeloParticipante status={p.status} />
                <Badge variant="outline">
                  {p.como_empresa ? "pessoa jurídica" : "pessoa física"}
                </Badge>
              </div>

              <section className="rounded-lg border border-border p-3">
                <h3 className="mb-2 text-sm font-semibold">Registro</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                  <Dado rotulo="CRECI" valor={p.creci} />
                  <Dado rotulo="UF" valor={p.creci_uf} />
                  <Dado
                    rotulo="Atua como"
                    valor={p.como_empresa ? "Pessoa jurídica" : "Pessoa física"}
                  />
                  <Dado rotulo="Regiões" valor={p.regioes?.join(", ")} />
                  <Dado
                    rotulo="Reputação"
                    valor={p.reputacao != null ? Number(p.reputacao).toFixed(1) : null}
                  />
                  <Dado rotulo="Negócios fechados" valor={String(p.negocios_fechados)} />
                </dl>
                {p.creci ? (
                  p.creci_uf && (
                    <p className="mt-3 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                      Confira em{" "}
                      <span className="font-mono">creci{p.creci_uf.toLowerCase()}.gov.br</span> (ou
                      no portal do Cofeci) antes de verificar.
                    </p>
                  )
                ) : (
                  <p className="mt-3 rounded-md border border-amber-400/70 bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    Este pedido veio sem CRECI. Verificar aqui significa que você checou a pessoa
                    por outro caminho (CNPJ, contrato social, indicação) — e é isso que os outros
                    corretores vão ler como selo.
                  </p>
                )}
                {p.verificado_em && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Verificado por {p.verificador ?? "—"} em {dataHora(p.verificado_em)}.
                  </p>
                )}
              </section>

              {podeVerificar ? (
                <DecisaoParticipante key={p.tenant_id} p={p} onFeito={onFechar} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Você pode ver a Rede, mas não verificar participantes.
                </p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DecisaoParticipante({ p, onFeito }: { p: ParticipanteRede; onFeito: () => void }) {
  const qc = useQueryClient();
  const verificarFn = useServerFn(verificarParticipante);
  const [status, setStatus] = useState<StatusParticipante>(
    p.status === "pendente" ? "verificado" : (p.status as StatusParticipante),
  );
  const [motivo, setMotivo] = useState(p.motivo ?? "");
  const exigeMotivo = status === "recusado" || status === "suspenso";
  const motivoOk = !exigeMotivo || motivo.trim().length >= 10;

  const aplicar = useMutation({
    mutationFn: () => verificarFn({ data: { tenantId: p.tenant_id, status, motivo } }),
    onSuccess: () => {
      toast.success(
        status === "verificado"
          ? "CRECI conferido: participante verificado."
          : `Participante ${STATUS[status].rotulo.toLowerCase()}.`,
      );
      qc.invalidateQueries({ queryKey: CHAVE });
      onFeito();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível alterar o participante.")),
  });

  return (
    <section className="space-y-3 rounded-lg border border-border p-3">
      <div>
        <h3 className="text-sm font-semibold">Decisão</h3>
        <p className="text-xs text-muted-foreground">
          O selo aparece para todos os participantes da Rede.
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="rede-situacao">Situação</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusParticipante)}>
          <SelectTrigger id="rede-situacao" aria-label="Situação do participante">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS) as StatusParticipante[]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS[s].rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="rede-motivo">Motivo{exigeMotivo ? " (obrigatório)" : ""}</Label>
        <Textarea
          id="rede-motivo"
          rows={3}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Obrigatório ao recusar ou suspender (mínimo 10 caracteres)."
        />
      </div>
      <Button disabled={aplicar.isPending || !motivoOk} onClick={() => aplicar.mutate()}>
        {aplicar.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
        Aplicar
      </Button>
    </section>
  );
}

/* ───────── Linha do tempo da disputa ─────────
   `historico` é o retrato da parceria no momento em que a disputa foi aberta (`to_jsonb` da
   linha de `rede.parcerias`). A mediação precisa ler o que aconteceu, em ordem — não o JSON. */

type Evento = {
  quando: string;
  titulo: string;
  detalhe?: string | null;
  tom?: "perigo" | "sucesso";
};

const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const numero = (v: unknown) =>
  v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v);

function linhaDoTempo(d: DisputaRede): Evento[] {
  const eventos: Evento[] = [];
  const h = d.historico as unknown;

  if (Array.isArray(h)) {
    // Histórico em lista de eventos (formato livre): aproveita data e descrição de cada um.
    for (const e of h) {
      if (!e || typeof e !== "object") continue;
      const o = e as Record<string, unknown>;
      const quando = texto(o.em) ?? texto(o.quando) ?? texto(o.data) ?? texto(o.criado_em);
      const titulo = texto(o.evento) ?? texto(o.descricao) ?? texto(o.texto) ?? texto(o.status);
      if (quando && titulo) eventos.push({ quando, titulo });
    }
  } else if (h && typeof h === "object") {
    const pa = h as Record<string, unknown>;
    const cliente = texto((pa.cliente_dados_minimos as Record<string, unknown> | null)?.nome);
    const pct = numero(pa.percentual_acordado);
    const valor = numero(pa.valor_negocio);
    const criado = texto(pa.criado_em);
    if (criado) {
      eventos.push({
        quando: criado,
        titulo: `${d.solicitante ?? "O corretor"} pediu parceria${d.dono ? ` a ${d.dono}` : ""}${cliente ? ` para o cliente ${cliente}` : ""}`,
        detalhe: texto(pa.mensagem),
      });
    }
    const aceite = texto(pa.aceite_em);
    if (aceite) {
      eventos.push({
        quando: aceite,
        titulo: `${d.dono ?? "O dono do imóvel"} aceitou a parceria${pct != null ? ` com ${pct}%` : ""}`,
        tom: "sucesso",
      });
    } else if (pa.status === "recusada" && texto(pa.respondida_em)) {
      eventos.push({
        quando: texto(pa.respondida_em)!,
        titulo: `${d.dono ?? "O dono do imóvel"} recusou o pedido`,
        detalhe: texto(pa.recusa_motivo),
        tom: "perigo",
      });
    }
    const fechada = texto(pa.fechada_em);
    if (fechada) {
      eventos.push({
        quando: fechada,
        titulo: `Negócio fechado${valor != null ? ` em ${formatBRL(valor)}` : ""}`,
        tom: "sucesso",
      });
    }
  }

  eventos.push({
    quando: d.criado_em,
    titulo: `${d.aberta_por ?? "Uma das partes"} abriu a disputa`,
    tom: "perigo",
  });
  if (d.resolvida_em) {
    eventos.push({
      quando: d.resolvida_em,
      titulo: "Decisão publicada às duas partes",
      tom: "sucesso",
    });
  }
  return eventos
    .filter((e) => !Number.isNaN(new Date(e.quando).getTime()))
    .sort((a, b) => new Date(a.quando).getTime() - new Date(b.quando).getTime());
}

function DetalheDisputa({ d, onFechar }: { d: DisputaRede | null; onFechar: () => void }) {
  const podeMediar = usePermissao("saas.marketplace", "edit");
  const eventos = d ? linhaDoTempo(d) : [];
  return (
    <Sheet open={!!d} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {d && (
          <>
            <SheetHeader>
              <SheetTitle>Disputa de parceria</SheetTitle>
              <SheetDescription>
                aberta por {d.aberta_por ?? "—"} em {formatData(d.criado_em)}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex flex-wrap gap-1.5">
                  <SeloDisputa d={d} />
                  <Badge variant="outline">
                    {d.mediador ? `mediada por ${d.mediador}` : "sem mediador"}
                  </Badge>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs text-muted-foreground">Valor do negócio</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {d.valor_negocio != null ? formatBRL(Number(d.valor_negocio)) : "—"}
                  </p>
                  {d.percentual != null && (
                    <p className="text-xs text-muted-foreground">
                      percentual combinado {Number(d.percentual)}%
                    </p>
                  )}
                </div>
              </div>

              <section className="rounded-lg border border-border p-3">
                <h3 className="mb-2 text-sm font-semibold">O que foi alegado</h3>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                  {d.motivo}
                </p>
                {(d.dono || d.solicitante) && (
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <Dado rotulo="Dono do imóvel" valor={d.dono} />
                    <Dado rotulo="Quem trouxe o cliente" valor={d.solicitante} />
                  </dl>
                )}
              </section>

              <section className="rounded-lg border border-border p-3">
                <h3 className="text-sm font-semibold">Histórico da parceria</h3>
                <p className="mb-3 text-xs text-muted-foreground">
                  O que a Rede registrou, em ordem.
                </p>
                <ol className="space-y-3 border-l border-border pl-4">
                  {eventos.map((e, i) => (
                    <li key={`${e.quando}-${i}`} className="relative">
                      <span
                        className={`absolute -left-[21px] top-1.5 size-2.5 rounded-full ${
                          e.tom === "perigo"
                            ? "bg-destructive"
                            : e.tom === "sucesso"
                              ? "bg-emerald-600"
                              : "bg-muted-foreground"
                        }`}
                        aria-hidden
                      />
                      <p className="break-words text-sm font-medium">{e.titulo}</p>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {dataHora(e.quando)}
                      </p>
                      {e.detalhe && (
                        <p className="mt-1 break-words text-sm italic text-muted-foreground">
                          “{e.detalhe}”
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              </section>

              {d.resolucao && d.resolvida_em && (
                <section className="rounded-lg border border-emerald-600/40 bg-emerald-50 p-3 dark:bg-emerald-950/30">
                  <h3 className="mb-1 text-sm font-semibold">
                    Decisão publicada em {formatData(d.resolvida_em)}
                  </h3>
                  <p className="whitespace-pre-wrap break-words text-sm">{d.resolucao}</p>
                </section>
              )}

              {podeMediar ? (
                <DecisaoDisputa key={d.id} d={d} onFeito={onFechar} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Você pode ver as disputas, mas não mediar.
                </p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DecisaoDisputa({ d, onFeito }: { d: DisputaRede; onFeito: () => void }) {
  const qc = useQueryClient();
  const mediarFn = useServerFn(mediarDisputa);
  const [status, setStatus] = useState<StatusDisputa>(
    d.status === "aberta" ? "em_mediacao" : (d.status as StatusDisputa),
  );
  const [resolucao, setResolucao] = useState(d.resolucao ?? "");
  const encerra = status === "resolvida" || status === "improcedente";
  const resolucaoOk = !encerra || resolucao.trim().length >= 20;

  const registrar = useMutation({
    mutationFn: () => mediarFn({ data: { id: d.id, status, resolucao } }),
    onSuccess: () => {
      toast.success("Disputa atualizada.");
      qc.invalidateQueries({ queryKey: CHAVE });
      onFeito();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível mediar a disputa.")),
  });

  return (
    <section className="space-y-3 rounded-lg border border-border p-3">
      <div>
        <h3 className="text-sm font-semibold">Decisão</h3>
        <p className="text-xs text-muted-foreground">As duas partes leem este texto.</p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="rede-disputa-situacao">Situação</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusDisputa)}>
          <SelectTrigger id="rede-disputa-situacao" aria-label="Situação da disputa">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(DISPUTA) as StatusDisputa[]).map((s) => (
              <SelectItem key={s} value={s}>
                {DISPUTA[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="rede-resolucao">Decisão escrita{encerra ? " (obrigatória)" : ""}</Label>
        <Textarea
          id="rede-resolucao"
          rows={5}
          value={resolucao}
          onChange={(e) => setResolucao(e.target.value)}
          placeholder="O que ficou decidido, com base em quê (mínimo 20 caracteres para encerrar). As duas partes leem este texto."
        />
      </div>
      <Button disabled={registrar.isPending || !resolucaoOk} onClick={() => registrar.mutate()}>
        {registrar.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
        Registrar decisão
      </Button>
    </section>
  );
}
