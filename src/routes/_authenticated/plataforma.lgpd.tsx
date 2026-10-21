import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  Ban,
  Check,
  CircleCheck,
  EyeOff,
  FileSearch,
  FileText,
  Flame,
  Loader2,
  Package,
  Pencil,
  RefreshCw,
  Share2,
  ShieldCheck,
  Trash2,
  type LucideIcon,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatData } from "@/lib/financeiro/format";
import { RodapePaginas } from "@/components/plataforma/paginacao";
import {
  POR_PAGINA_PEDIDOS_LGPD,
  STATUS_PEDIDO,
  atenderPedidoTitular,
  destruirChavesConta,
  lerLgpd,
  type ContaLgpd,
  type PedidoTitular,
  type StatusPedido,
} from "@/lib/plataforma/lgpd.functions";

export const Route = createFileRoute("/_authenticated/plataforma/lgpd")({
  head: () => ({ meta: [{ title: "LGPD — Plataforma — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("saas.lgpd"),
  component: Pagina,
});

const CHAVE = ["plataforma-lgpd"];

const TIPO: Record<string, string> = {
  confirmacao: "Confirmação de tratamento",
  acesso_copia: "Acesso / cópia dos dados",
  correcao: "Correção",
  anonimizacao: "Anonimização",
  portabilidade: "Portabilidade",
  exclusao: "Exclusão",
  revogacao_consentimento: "Revogação de consentimento",
  informacao_compartilhamento: "Com quem foi compartilhado",
};
const ICONE_TIPO: Record<string, LucideIcon> = {
  confirmacao: CircleCheck,
  acesso_copia: FileSearch,
  correcao: Pencil,
  anonimizacao: EyeOff,
  portabilidade: Package,
  exclusao: Trash2,
  revogacao_consentimento: Ban,
  informacao_compartilhamento: Share2,
};
const STATUS: Record<StatusPedido, string> = {
  aberta: "Aberta",
  em_atendimento: "Em atendimento",
  aguardando_titular: "Aguardando o titular",
  concluida: "Concluída",
  negada: "Negada",
};
const DOCUMENTO: Record<string, string> = {
  termos_uso: "Termos de uso",
  politica_privacidade: "Política de privacidade",
  politica_cookies: "Política de cookies",
  contrato_assinatura: "Contrato de assinatura",
  termos_cliente: "Termos do cliente",
  termos_parceiro: "Termos do parceiro",
  termos_marketplace: "Termos do marketplace",
};
/** Documentos que precisam estar vigentes antes de abrir as vendas. */
const DOCUMENTOS_ESSENCIAIS = ["termos_uso", "politica_privacidade", "contrato_assinatura"];
const PERFIL: Record<string, string> = {
  todos: "todos os perfis",
  corretor: "corretor",
  imobiliaria: "imobiliária",
  parceiro: "parceiro",
  cliente: "cliente",
};
const CONSENTIMENTO: Record<string, string> = {
  lgpd_tratamento: "Tratamento de dados (LGPD)",
  scr_bacen: "Consulta ao SCR do Banco Central",
  marketing: "Comunicação de marketing",
  cookies_analiticos: "Cookies de análise",
  cookies_marketing: "Cookies de marketing",
  compartilhamento_banco: "Envio da proposta aos bancos",
};

type Recorte = "todos" | "abertos" | "atrasados";
const DIA = 86_400_000;

function dataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** O relógio do pedido: dias que faltam, dias de atraso ou "respondido". */
function prazo(p: PedidoTitular): {
  texto: string;
  tom: "ok" | "normal" | "alerta" | "perigo";
  rodape: string;
} {
  if (p.concluida_em)
    return { texto: "respondido", tom: "ok", rodape: `em ${formatData(p.concluida_em)}` };
  if (!p.prazo_em)
    return { texto: "sem prazo", tom: "normal", rodape: `recebido ${formatData(p.criado_em)}` };
  // `prazo_em` é data civil: o fim do dia em Brasília.
  const fim = new Date(`${p.prazo_em}T23:59:59-03:00`).getTime();
  const dias = Math.ceil((fim - Date.now()) / DIA) - 1;
  if (p.atrasada || dias < 0) {
    return {
      texto: `${Math.max(1, -dias)} dia(s) de atraso`,
      tom: "perigo",
      rodape: `prazo ${formatData(p.prazo_em)}`,
    };
  }
  return {
    texto: dias === 0 ? "vence hoje" : `${dias} dia(s) restante(s)`,
    tom: dias <= 3 ? "alerta" : "normal",
    rodape: `prazo ${formatData(p.prazo_em)}`,
  };
}

const COR_TOM = {
  ok: "text-emerald-700 dark:text-emerald-400",
  normal: "text-foreground",
  alerta: "text-amber-700 dark:text-amber-400",
  perigo: "text-destructive",
} as const;

function Prazo({ p }: { p: PedidoTitular }) {
  const r = prazo(p);
  return (
    <span className="flex shrink-0 flex-col text-right text-xs">
      <b className={`tabular-nums ${COR_TOM[r.tom]}`}>{r.texto}</b>
      <small className="tabular-nums text-muted-foreground">{r.rodape}</small>
    </span>
  );
}

function Pagina() {
  const lerFn = useServerFn(lerLgpd);
  const podeEditar = usePermissao("saas.lgpd", "edit");
  const [recorte, setRecorteBruto] = useState<Recorte>("todos");
  const [pagina, setPagina] = useState(1);
  const setRecorte = (r: Recorte) => {
    setRecorteBruto(r);
    setPagina(1);
  };
  const q = useQuery({
    queryKey: [...CHAVE, recorte, pagina],
    queryFn: () => lerFn({ data: { recorte, pagina } }),
    placeholderData: (anterior) => anterior,
  });
  const [aberto, setAberto] = useState<PedidoTitular | null>(null);
  const [destruir, setDestruir] = useState(false);

  const pedidos = q.data?.pedidos ?? [];
  const termos = q.data?.termos ?? [];
  // Documentos sem nenhuma versão vigente entre os que precisam existir antes de
  // vender (o cliente aceita no cadastro). Dar vigência é decisão do dono e do
  // jurídico: a tela só mostra o que falta.
  const essenciaisSemVigencia = DOCUMENTOS_ESSENCIAIS.filter(
    (d) => !termos.some((t) => t.documento === d && t.vigente_desde),
  );
  // Versões com o mesmo hash de outra do mesmo documento/perfil: o texto é igual.
  const duplicadaDe = new Map<string, string>();
  {
    const primeira = new Map<string, string>();
    for (const t of termos) {
      const chave = `${t.documento}|${t.perfil}|${t.hash}`;
      const anterior = primeira.get(chave);
      if (anterior) duplicadaDe.set(t.id, anterior);
      else primeira.set(chave, t.versao);
    }
  }
  const consentimentos = q.data?.consentimentos ?? [];
  const contas = q.data?.contas ?? [];
  // Contagens do banco (todos os pedidos); a lista já vem filtrada pelo recorte e paginada.
  const resumo = q.data?.resumo ?? { total: 0, abertos: 0, atrasados: 0 };
  const lista = pedidos;
  const maiorConsentimento = Math.max(1, ...consentimentos.map((c) => c.total));
  // Atender exige o módulo em "editar" no Agilliza E a permissão lgpd.atender no banco.
  const podeAtender = podeEditar && !!q.data?.pode.atender;
  const podeExcluir = podeEditar && !!q.data?.pode.excluir;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AdminHero
        secao="Plataforma"
        icon={<ShieldCheck className="h-5 w-5" />}
        titulo="LGPD"
        descricao="Pedidos de titulares das contas de assinantes, termos vigentes e consentimentos registrados. O prazo legal de resposta é de 15 dias."
        acoes={
          <>
            {resumo.atrasados > 0 && (
              <Button size="sm" variant="destructive" onClick={() => setRecorte("atrasados")}>
                <AlertTriangle className="mr-2 size-4" /> Atender os atrasados
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
              <RefreshCw className={`mr-2 size-4 ${q.isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </>
        }
      />

      {q.isError && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {mensagemDeErro(q.error, "Não foi possível carregar a LGPD da plataforma.")}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metrica
          rotulo="Pedidos em aberto"
          valor={resumo.abertos}
          detalhe="art. 18 da LGPD"
          carregando={q.isLoading}
          onClick={() => setRecorte("abertos")}
          ativo={recorte === "abertos"}
        />
        <Metrica
          rotulo="Fora do prazo"
          valor={resumo.atrasados}
          detalhe="além dos 15 dias"
          perigo={resumo.atrasados > 0}
          carregando={q.isLoading}
          onClick={() => setRecorte("atrasados")}
          ativo={recorte === "atrasados"}
        />
        <Metrica
          rotulo="Termos vigentes"
          valor={termos.filter((t) => t.vigente_desde).length}
          detalhe={`${termos.length} versão(ões) no total`}
          carregando={q.isLoading}
        />
        <Metrica
          rotulo="Consentimentos vigentes"
          valor={consentimentos.reduce((a, c) => a + c.vigentes, 0)}
          detalhe="registro imutável"
          carregando={q.isLoading}
        />
      </div>

      <section className="rounded-lg border border-border bg-card">
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border p-4">
          <div className="min-w-0">
            <h2 className="font-semibold">
              {recorte === "abertos"
                ? "Pedidos em aberto"
                : recorte === "atrasados"
                  ? "Pedidos fora do prazo"
                  : "Pedidos de titulares"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Art. 18 da LGPD. O prazo de resposta é de 15 dias a contar do pedido.
            </p>
          </div>
          {recorte !== "todos" && (
            <Button variant="ghost" size="sm" onClick={() => setRecorte("todos")}>
              Ver todos
            </Button>
          )}
        </header>
        {q.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : !lista.length ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {recorte !== "todos"
              ? "Nenhum pedido neste grupo. Os outros continuam na lista inteira."
              : "Nenhum pedido recebido. Quando um titular pedir acesso, correção, portabilidade ou exclusão — pelo portal do cliente ou por e-mail — o pedido entra aqui com prazo."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {lista.map((p) => {
              const Ic = ICONE_TIPO[p.tipo] ?? ShieldCheck;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setAberto(p)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                  >
                    <span
                      className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg ${
                        p.concluida_em
                          ? "bg-muted text-muted-foreground"
                          : p.atrasada
                            ? "bg-destructive/10 text-destructive"
                            : "bg-primary/10 text-primary"
                      }`}
                    >
                      <Ic className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        {TIPO[p.tipo] ?? p.tipo}
                        <BadgeStatus p={p} />
                      </span>
                      <span className="block break-words text-xs text-muted-foreground">
                        {p.titular_nome ?? "titular sem nome"}
                        {p.conta ? ` · ${p.conta}` : ""} · recebido {formatData(p.criado_em)}
                      </span>
                    </span>
                    <Prazo p={p} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <RodapePaginas
          pagina={pagina}
          porPagina={POR_PAGINA_PEDIDOS_LGPD}
          quantidade={lista.length}
          total={
            recorte === "abertos"
              ? resumo.abertos
              : recorte === "atrasados"
                ? resumo.atrasados
                : resumo.total
          }
          carregando={q.isFetching}
          onPagina={setPagina}
        />
      </section>

      {!q.isLoading && essenciaisSemVigencia.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-400/60 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-1">
            <p>
              <b>Falta dar vigência antes de abrir as vendas.</b>{" "}
              {termos.length > 0 && termos.every((t) => !t.vigente_desde)
                ? `Nenhum termo está vigente: as ${termos.length} versões cadastradas são rascunhos. `
                : ""}
              Sem versão vigente não há texto para o cliente aceitar no cadastro — e nada a provar
              depois.
            </p>
            <ul className="list-disc pl-5">
              {essenciaisSemVigencia.map((d) => (
                <li key={d}>{DOCUMENTO[d] ?? d}: nenhuma versão vigente</li>
              ))}
            </ul>
            <p className="text-xs">
              Publicar (dar vigência) é decisão do dono e do jurídico: revise o texto final de cada
              documento antes. Rascunhos repetidos aparecem marcados como “mesmo texto” na lista.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <section className="min-w-0 rounded-lg border border-border bg-card">
          <header className="border-b border-border p-4">
            <h2 className="font-semibold">Termos e políticas</h2>
            <p className="text-sm text-muted-foreground">
              Cada versão guarda o hash do texto: dá para provar o que a pessoa aceitou.
            </p>
          </header>
          {q.isLoading ? (
            <Skeleton className="m-4 h-20" />
          ) : !termos.length ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma versão de termo ou política foi cadastrada.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {termos.map((t) => (
                <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                  <FileText
                    className={`mt-0.5 size-5 shrink-0 ${t.vigente_desde ? "text-primary" : "text-muted-foreground"}`}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {DOCUMENTO[t.documento] ?? t.documento}
                      <span className="text-xs font-normal text-muted-foreground">
                        · {PERFIL[t.perfil] ?? t.perfil}
                      </span>
                      <Badge variant="outline">v{t.versao}</Badge>
                      {t.vigente_desde ? (
                        <Badge>vigente</Badge>
                      ) : (
                        <Badge variant="secondary">rascunho</Badge>
                      )}
                      {duplicadaDe.has(t.id) && (
                        <Badge
                          variant="outline"
                          className="border-amber-500 text-amber-800 dark:text-amber-200"
                        >
                          mesmo texto da v{duplicadaDe.get(t.id)}
                        </Badge>
                      )}
                    </span>
                    <span className="block break-words text-xs text-muted-foreground">
                      {t.vigente_desde ? `desde ${formatData(t.vigente_desde)}` : "sem vigência"} ·{" "}
                      <span className="font-mono">{t.hash}</span> ·{" "}
                      <span className="tabular-nums">
                        {t.aceites.toLocaleString("pt-BR")} aceite(s)
                      </span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="min-w-0 space-y-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <Check className="size-4" /> Consentimentos
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Registro imutável de quem consentiu com o quê. Vigentes sobre registrados.
            </p>
            {q.isLoading ? (
              <Skeleton className="h-16" />
            ) : !consentimentos.length ? (
              <p className="text-sm text-muted-foreground">Nenhum consentimento registrado.</p>
            ) : (
              <ul className="space-y-2">
                {consentimentos.map((c) => (
                  <li key={c.tipo} className="text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">{CONSENTIMENTO[c.tipo] ?? c.tipo}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        <b className="text-foreground">{c.vigentes.toLocaleString("pt-BR")}</b> /{" "}
                        {c.total.toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary/70"
                        style={{ width: `${(c.vigentes / maiorConsentimento) * 100}%` }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {podeEditar && !q.isLoading && (
            <section className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
              <h2 className="flex items-center gap-2 font-semibold text-destructive">
                <Flame className="size-4" /> Exclusão definitiva
              </h2>
              <p className="text-sm">
                O último recurso: destrói a chave de criptografia de uma conta inteira. Todo o dado
                cifrado daquela conta fica ilegível — inclusive nos backups, que guardam o texto
                cifrado. <b>Não há como desfazer.</b> Use apenas com decisão formal registrada.
              </p>
              {podeExcluir ? (
                <Button variant="destructive" onClick={() => setDestruir(true)}>
                  <Flame className="mr-2 size-4" /> Destruir chaves de uma conta
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Reservada aos administradores do Agilliza. Seu acesso não pode fazer a exclusão
                  definitiva.
                </p>
              )}
            </section>
          )}
        </div>
      </div>

      <Sheet open={!!aberto} onOpenChange={(v) => !v && setAberto(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {aberto && (
            <>
              <SheetHeader>
                <SheetTitle>{TIPO[aberto.tipo] ?? aberto.tipo}</SheetTitle>
                <SheetDescription>
                  {aberto.titular_nome ?? "titular"} · {aberto.conta ?? "sem conta"}
                </SheetDescription>
              </SheetHeader>
              <Atendimento
                key={aberto.id}
                p={aberto}
                podeAtender={podeAtender}
                podeExcluir={podeExcluir}
                onFeito={() => setAberto(null)}
              />
            </>
          )}
        </SheetContent>
      </Sheet>

      {podeExcluir && (
        <DialogDestruir aberto={destruir} onFechar={() => setDestruir(false)} contas={contas} />
      )}
    </div>
  );
}

function BadgeStatus({ p }: { p: PedidoTitular }) {
  const rotulo = STATUS[p.status as StatusPedido] ?? p.status;
  if (p.concluida_em) return <Badge variant="secondary">{rotulo}</Badge>;
  if (p.atrasada) return <Badge variant="destructive">{rotulo}</Badge>;
  return <Badge variant="outline">{rotulo}</Badge>;
}

function Metrica({
  rotulo,
  valor,
  detalhe,
  carregando,
  perigo,
  onClick,
  ativo,
}: {
  rotulo: string;
  valor: number;
  detalhe?: string;
  carregando: boolean;
  perigo?: boolean;
  onClick?: () => void;
  ativo?: boolean;
}) {
  const conteudo: ReactNode = (
    <>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      {carregando ? (
        <Skeleton className="mt-2 h-7 w-12" />
      ) : (
        <p className={`mt-1 text-2xl font-bold tabular-nums ${perigo ? "text-destructive" : ""}`}>
          {valor.toLocaleString("pt-BR")}
        </p>
      )}
      {detalhe && <p className="truncate text-xs text-muted-foreground">{detalhe}</p>}
    </>
  );
  const classe = `min-w-0 rounded-lg border bg-card p-3 text-left md:p-4 ${
    ativo ? "border-primary ring-1 ring-primary/30" : "border-border"
  }`;
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`${classe} transition-colors hover:bg-muted/40`}
    >
      {conteudo}
    </button>
  ) : (
    <div className={classe}>{conteudo}</div>
  );
}

function Atendimento({
  p,
  podeAtender,
  podeExcluir,
  onFeito,
}: {
  p: PedidoTitular;
  podeAtender: boolean;
  podeExcluir: boolean;
  onFeito: () => void;
}) {
  const qc = useQueryClient();
  const atenderFn = useServerFn(atenderPedidoTitular);
  const [status, setStatus] = useState<StatusPedido>(
    (STATUS_PEDIDO as readonly string[]).includes(p.status)
      ? (p.status as StatusPedido)
      : "em_atendimento",
  );
  const [resposta, setResposta] = useState(p.resposta ?? "");
  const encerra = status === "concluida" || status === "negada";

  const salvar = useMutation({
    mutationFn: () => atenderFn({ data: { id: p.id, status, resposta } }),
    onSuccess: () => {
      toast.success("Pedido atualizado.");
      qc.invalidateQueries({ queryKey: CHAVE });
      onFeito();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível atualizar o pedido.")),
  });

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <BadgeStatus p={p} />
          {p.titular_nome && <Badge variant="outline">{p.titular_nome}</Badge>}
        </div>
        <Prazo p={p} />
      </div>

      <section className="rounded-lg border border-border p-3">
        <h3 className="mb-2 text-sm font-semibold">Pedido</h3>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <Par rotulo="Titular">{p.titular_nome ?? "—"}</Par>
          <Par rotulo="E-mail informado">
            <span className="break-all">{p.titular_email ?? "—"}</span>
          </Par>
          <Par rotulo="Conta">{p.conta ?? "—"}</Par>
          <Par rotulo="Recebido em">{dataHora(p.criado_em)}</Par>
          <Par rotulo="Prazo">
            <span className={p.atrasada ? "font-medium text-destructive" : ""}>
              {p.prazo_em ? formatData(p.prazo_em) : "—"}
            </span>
          </Par>
          <Par rotulo="Atendido por">{p.atendente ?? "—"}</Par>
        </dl>
        {p.descricao && (
          <p className="mt-3 whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            {p.descricao}
          </p>
        )}
        {p.resposta && p.concluida_em && (
          <div className="mt-3 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
            <p className="mb-1 font-medium">Resposta enviada</p>
            <p className="whitespace-pre-wrap">{p.resposta}</p>
          </div>
        )}
        {p.tipo === "exclusao" && (
          <p className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
            Exclusão de um titular é atendida na conta dele.
            {podeExcluir
              ? " A destruição de chaves vale para a conta inteira e fica em “Exclusão definitiva”, no fim desta tela."
              : " A destruição de chaves vale para a conta inteira e é reservada aos administradores do Agilliza."}
          </p>
        )}
      </section>

      {podeAtender ? (
        <form
          className="space-y-3 rounded-lg border border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            salvar.mutate();
          }}
        >
          <div>
            <h3 className="text-sm font-semibold">Responder</h3>
            <p className="text-xs text-muted-foreground">
              O texto vai ao titular e fica no registro de auditoria.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="lgpd-status">Situação</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusPedido)}>
              <SelectTrigger id="lgpd-status" aria-label="Situação do pedido">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_PEDIDO.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="lgpd-resposta">
              Resposta ao titular
              {encerra && <span className="text-destructive"> *</span>}
            </Label>
            <Textarea
              id="lgpd-resposta"
              rows={5}
              maxLength={5000}
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              placeholder="O que foi feito, com base em qual artigo, e o que o titular recebe."
            />
            <p className="text-xs text-muted-foreground">
              Concluir ou negar exige uma resposta escrita (mínimo 10 caracteres).
            </p>
          </div>
          <Button type="submit" disabled={salvar.isPending}>
            {salvar.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Salvar atendimento
          </Button>
        </form>
      ) : (
        <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          Seu acesso vê os pedidos, mas não pode atendê-los.
        </p>
      )}
    </div>
  );
}

function DialogDestruir({
  aberto,
  onFechar,
  contas,
}: {
  aberto: boolean;
  onFechar: () => void;
  contas: ContaLgpd[];
}) {
  const qc = useQueryClient();
  const destruirFn = useServerFn(destruirChavesConta);
  const [tenant, setTenant] = useState("");
  const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [recusa, setRecusa] = useState<string | null>(null);
  const conta = contas.find((c) => c.id === tenant);
  const nomeConfere =
    !!conta && confirmacao.trim().toLowerCase() === conta.nome.trim().toLowerCase();
  const pronto = !!conta && motivo.trim().length >= 20 && nomeConfere;

  const limpar = () => {
    setTenant("");
    setMotivo("");
    setConfirmacao("");
    setRecusa(null);
  };

  const executar = useMutation({
    mutationFn: () =>
      destruirFn({ data: { tenantId: tenant, motivo, confirmacaoNome: confirmacao } }),
    onSuccess: () => {
      toast.success("Chaves destruídas. O dado cifrado desta conta é irrecuperável.");
      qc.invalidateQueries({ queryKey: CHAVE });
      limpar();
      onFechar();
    },
    onError: (e) => {
      // A recusa do banco fica na tela, não só num aviso que some.
      const msg = mensagemDeErro(e, "Não foi possível destruir as chaves.");
      setRecusa(msg);
      toast.error(msg);
    },
  });

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        if (!v && !executar.isPending) {
          limpar();
          onFechar();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Flame className="size-5" /> Destruir as chaves de uma conta
          </DialogTitle>
          <DialogDescription>
            Torna irrecuperável todo o dado cifrado dessa conta, inclusive nos backups. Não há
            desfazer.
          </DialogDescription>
        </DialogHeader>

        <form
          id="form-destruir"
          className="space-y-3"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            if (pronto) executar.mutate();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="lgpd-conta">Conta</Label>
            <Select
              value={tenant}
              onValueChange={(v) => {
                setTenant(v);
                setConfirmacao("");
                setRecusa(null);
              }}
            >
              <SelectTrigger id="lgpd-conta" aria-label="Conta">
                <SelectValue placeholder="Escolha a conta" />
              </SelectTrigger>
              <SelectContent>
                {contas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="lgpd-motivo">
              Embasamento <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="lgpd-motivo"
              rows={3}
              maxLength={2000}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Pedido formal do titular nº …, decisão registrada em …, base legal …"
            />
            <p className="text-xs text-muted-foreground">
              Mínimo 20 caracteres. Fica gravado no registro de auditoria.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="lgpd-confirmacao">
              Para confirmar, digite o nome da conta
              {conta ? (
                <>
                  : <b className="break-words">{conta.nome}</b>
                </>
              ) : null}
            </Label>
            <Input
              id="lgpd-confirmacao"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              disabled={!conta}
              autoComplete="off"
              aria-invalid={!!confirmacao && !nomeConfere}
            />
            {!!confirmacao && !nomeConfere && (
              <p className="text-xs text-destructive">O nome digitado ainda não confere.</p>
            )}
          </div>
          {recusa && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {recusa}
            </p>
          )}
        </form>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={executar.isPending}
            onClick={() => {
              limpar();
              onFechar();
            }}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-destruir"
            variant="destructive"
            disabled={!pronto || executar.isPending}
          >
            {executar.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Flame className="mr-2 size-4" />
            )}
            Destruir definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Par({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd>{children}</dd>
    </div>
  );
}
