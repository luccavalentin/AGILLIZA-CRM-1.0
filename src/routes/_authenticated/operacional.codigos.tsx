import { useDeferredValue, useEffect, useRef, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  Copy,
  Filter,
  Inbox,
  Lock,
  LockOpen,
  Mail,
  Pause,
  Pencil,
  Play,
  Plus,
  PlugZap,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { CaixaDialog } from "@/components/operacional/codigos/caixa-dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissao } from "@/hooks/use-permissao";
import { playNotificationSound } from "@/lib/chat-sound";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { assertModuloPermitido } from "@/lib/route-guards";
import { cn } from "@/lib/utils";
import { destacarCodigo } from "@/lib/codigos/filtros";
import {
  listarCaixas,
  listarCodigos,
  pausarCaixa,
  removerCaixa,
  testarConexaoCaixa,
  type CaixaVigiada,
  type CodigoRecebido,
} from "@/lib/codigos/codigos.functions";

export const Route = createFileRoute("/_authenticated/operacional/codigos")({
  beforeLoad: () => assertModuloPermitido("operacional.codigos"),
  head: () => ({ meta: [{ title: "Servidor de e-mail · Operacional" }] }),
  component: Pagina,
});

/** Código mais velho que isso provavelmente já venceu no banco (só esmaece). */
const VENCE_MS = 10 * 60_000;

function useAgora(ms = 1000) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return agora;
}

function haQuanto(iso: string, agora: number): string {
  const s = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 1000));
  if (s < 60) return `há ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} dias`;
}

function hora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** "482917" → "482 917" para ler e ditar sem erro. */
function separar(codigo: string): string {
  if (codigo.length === 6) return `${codigo.slice(0, 3)} ${codigo.slice(3)}`;
  if (codigo.length === 8) return `${codigo.slice(0, 4)} ${codigo.slice(4)}`;
  return codigo;
}

function rotuloCaixa(c: { nome: string | null; email: string }) {
  return c.nome?.trim() || c.email;
}

function Pagina() {
  const listarFn = useServerFn(listarCodigos);
  const caixasFn = useServerFn(listarCaixas);
  const podeEditar = usePermissao("operacional.codigos", "edit");
  const agora = useAgora();
  const [dialogo, setDialogo] = useState<{ aberto: boolean; caixa: CaixaVigiada | null }>({
    aberto: false,
    caixa: null,
  });
  const [caixaId, setCaixaId] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<"24h" | "7d">("24h");
  const [soCodigos, setSoCodigos] = useState(false);
  const [busca, setBusca] = useState("");
  const buscaAdiada = useDeferredValue(busca.trim());

  const filtro = { caixaId, periodo, soCodigos, busca: buscaAdiada || null };
  const codigos = useQuery({
    queryKey: ["codigos-recebidos", filtro],
    queryFn: () => listarFn({ data: filtro }),
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
    placeholderData: (anterior) => anterior,
  });
  const caixas = useQuery({
    queryKey: ["codigos-caixas"],
    queryFn: () => caixasFn(),
    refetchInterval: 15_000,
  });

  // Mensagem nova enquanto a tela está aberta: som e aviso (o primeiro carregamento não toca).
  const vistos = useRef<Set<string> | null>(null);
  const [novos, setNovos] = useState<Set<string>>(new Set());
  useEffect(() => {
    const lista = codigos.data;
    if (!lista) return;
    if (vistos.current === null) {
      vistos.current = new Set(lista.map((c) => c.id));
      return;
    }
    const chegaram = lista.filter((c) => !vistos.current!.has(c.id));
    if (chegaram.length === 0) return;
    chegaram.forEach((c) => vistos.current!.add(c.id));
    // Trocar filtro traz mensagens antigas para a lista: só avisa as das últimas 2 horas.
    const recentes = chegaram.filter((c) => Date.now() - new Date(c.recebido_em).getTime() < 2 * 3_600_000);
    if (recentes.length === 0) return;
    setNovos((s) => new Set([...s, ...recentes.map((c) => c.id)]));
    playNotificationSound();
    const c = recentes[0]!;
    toast.message(c.codigo ? `Novo código${c.banco ? ` do ${c.banco}` : ""}` : "Nova mensagem capturada", {
      description: c.codigo ? separar(c.codigo) : (c.assunto ?? undefined),
    });
  }, [codigos.data]);

  const lista = codigos.data ?? [];
  const listaCaixas = caixas.data ?? [];
  const semCaixa = caixas.data && caixas.data.length === 0;
  const filtrando = Boolean(caixaId || soCodigos || buscaAdiada || periodo === "7d");

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Inbox className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-foreground">Servidor de e-mail</h1>
            <p className="text-sm text-muted-foreground">
              As caixas que o Agilliza vigia e o que chegou nelas: códigos dos bancos na hora e as
              mensagens que passam no filtro de cada caixa.
            </p>
          </div>
        </div>
        {podeEditar && (
          <Button size="sm" onClick={() => setDialogo({ aberto: true, caixa: null })}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nova caixa
          </Button>
        )}
      </div>

      {caixas.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      ) : caixas.isError ? (
        <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          Não foi possível carregar as caixas agora. A tela tenta de novo sozinha.
        </p>
      ) : semCaixa ? (
        <div className="rounded-2xl border border-dashed bg-card px-5 py-10 text-center">
          <Mail className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium text-foreground">Nenhuma caixa vigiada ainda</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {podeEditar
              ? "Cadastre o e-mail que recebe os códigos dos bancos. O Agilliza só lê: não envia nada."
              : "Peça a um administrador para cadastrar o e-mail que recebe os códigos dos bancos."}
          </p>
          {podeEditar && (
            <Button className="mt-4" onClick={() => setDialogo({ aberto: true, caixa: null })}>
              Cadastrar caixa
            </Button>
          )}
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {listaCaixas.map((c) => (
            <CartaoCaixa
              key={c.id}
              caixa={c}
              agora={agora}
              podeEditar={podeEditar}
              aoEditar={() => setDialogo({ aberto: true, caixa: c })}
            />
          ))}
        </ul>
      )}

      {!semCaixa && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-base font-semibold text-foreground">Mensagens capturadas</h2>
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar assunto, remetente…"
                className="h-9 pl-8"
                maxLength={80}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {listaCaixas.length > 1 && (
              <>
                <Chip ativo={caixaId === null} onClick={() => setCaixaId(null)}>
                  Todas as caixas
                </Chip>
                {listaCaixas.map((c) => (
                  <Chip key={c.id} ativo={caixaId === c.id} onClick={() => setCaixaId(c.id)}>
                    {rotuloCaixa(c)}
                  </Chip>
                ))}
                <span className="mx-1 hidden w-px self-stretch bg-border sm:block" aria-hidden />
              </>
            )}
            <Chip ativo={periodo === "24h"} onClick={() => setPeriodo("24h")}>
              24 horas
            </Chip>
            <Chip ativo={periodo === "7d"} onClick={() => setPeriodo("7d")}>
              7 dias
            </Chip>
            <Chip ativo={soCodigos} onClick={() => setSoCodigos((v) => !v)}>
              Só com código
            </Chip>
          </div>

          {codigos.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-32 rounded-2xl" />
              ))}
            </div>
          ) : codigos.isError ? (
            <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              Não foi possível carregar as mensagens agora. A tela tenta de novo sozinha.
            </p>
          ) : lista.length === 0 ? (
            <div className="rounded-2xl border bg-card px-5 py-10 text-center">
              <Filter className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-medium text-foreground">
                {filtrando ? "Nada com esses filtros" : "Nenhuma mensagem nas últimas 24 horas"}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                {filtrando
                  ? "Troque a caixa, o período ou a busca."
                  : "Peça o código no portal do banco: ele aparece aqui em poucos segundos, com som."}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {lista.map((c) => (
                <CartaoCodigo
                  key={c.id}
                  codigo={c}
                  agora={agora}
                  novo={novos.has(c.id)}
                  multiplasCaixas={listaCaixas.length > 1}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      <CaixaDialog
        aberto={dialogo.aberto}
        caixa={dialogo.caixa}
        aoFechar={() => setDialogo({ aberto: false, caixa: null })}
      />
    </div>
  );
}

function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "max-w-[220px] truncate rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        ativo
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function CartaoCaixa({
  caixa,
  agora,
  podeEditar,
  aoEditar,
}: {
  caixa: CaixaVigiada;
  agora: number;
  podeEditar: boolean;
  aoEditar: () => void;
}) {
  const qc = useQueryClient();
  const pausarFn = useServerFn(pausarCaixa);
  const testarFn = useServerFn(testarConexaoCaixa);
  const removerFn = useServerFn(removerCaixa);
  const [ocupado, setOcupado] = useState<null | "pausar" | "testar" | "remover">(null);
  const [confirmar, setConfirmar] = useState(false);

  const espera = caixa.espera_ate && new Date(caixa.espera_ate).getTime() > agora;
  const tom = !caixa.ativo
    ? "cinza"
    : caixa.status === "conectado"
      ? "verde"
      : espera || caixa.status === "erro"
        ? "ambar"
        : "azul";
  const texto = !caixa.ativo
    ? "Pausada"
    : caixa.status === "conectado"
      ? "Lendo agora"
      : espera
        ? `Em espera até ${new Date(caixa.espera_ate!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
        : caixa.status === "erro"
          ? "Reconectando"
          : "Conectando…";
  const contem = caixa.filtros.filter((f) => f.ativo && f.operador === "contem").length;
  const naoContem = caixa.filtros.filter((f) => f.ativo && f.operador === "nao_contem").length;

  async function acao(tipo: "pausar" | "testar" | "remover") {
    setOcupado(tipo);
    try {
      if (tipo === "pausar") {
        await pausarFn({ data: { id: caixa.id, ativo: !caixa.ativo } });
        toast.success(caixa.ativo ? "Leitura pausada." : "Leitura retomada. Conecta em até 30 segundos.");
      } else if (tipo === "testar") {
        const r = await testarFn({ data: { id: caixa.id } });
        if (r.ok) toast.success(r.mensagem);
        else toast.error(r.mensagem);
      } else {
        await removerFn({ data: { id: caixa.id } });
        toast.success("Caixa removida.");
      }
      await qc.invalidateQueries({ queryKey: ["codigos-caixas"] });
      if (tipo === "remover") await qc.invalidateQueries({ queryKey: ["codigos-recebidos"] });
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível concluir agora."));
    } finally {
      setOcupado(null);
      setConfirmar(false);
    }
  }

  return (
    <li className="flex flex-col rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
            tom === "verde" && "bg-emerald-500 shadow-[0_0_0_3px_rgb(16_185_129/0.18)]",
            tom === "ambar" && "bg-amber-500",
            tom === "azul" && "animate-pulse bg-primary",
            tom === "cinza" && "bg-muted-foreground/50",
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate font-semibold text-foreground">{rotuloCaixa(caixa)}</p>
            <span className="shrink-0 text-xs text-muted-foreground">{texto}</span>
          </div>
          {caixa.nome && <p className="truncate text-xs text-muted-foreground">{caixa.email}</p>}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              {caixa.imap_ssl ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3 text-amber-600" />}
              {caixa.imap_host}:{caixa.imap_port}
            </span>
            <span>· pasta {caixa.pasta}</span>
          </p>
          <p className="mt-1.5 text-xs text-foreground/80">
            {caixa.usar_palavras_padrao ? "Códigos" : "Sem palavras padrão"}
            {contem > 0 && ` · ${contem} regra(s) "contém"`}
            {naoContem > 0 && ` · ${naoContem} "não contém"`}
          </p>
          {caixa.erro && caixa.status !== "conectado" && caixa.ativo && (
            <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">{caixa.erro}</p>
          )}
          {caixa.teste_em && caixa.teste_msg && (
            <p
              className={cn(
                "mt-1.5 text-xs",
                caixa.teste_ok ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400",
              )}
            >
              Último teste ({haQuanto(caixa.teste_em, agora)}): {caixa.teste_msg}
            </p>
          )}
        </div>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" aria-hidden />
        {caixa.pessoas.length
          ? `Liberada para ${caixa.pessoas.length} pessoa(s), além de quem cadastrou e da administração`
          : "Só quem cadastrou e a administração veem"}
      </p>
      {podeEditar && caixa.pode_gerir && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
          <Button size="sm" variant="outline" onClick={aoEditar}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Editar
          </Button>
          <Button size="sm" variant="outline" disabled={!!ocupado} onClick={() => void acao("pausar")}>
            {caixa.ativo ? <Pause className="mr-1.5 h-3.5 w-3.5" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
            {caixa.ativo ? "Pausar" : "Retomar"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!!ocupado || !caixa.tem_senha}
            onClick={() => void acao("testar")}
          >
            <PlugZap className="mr-1.5 h-3.5 w-3.5" />
            {ocupado === "testar" ? "Testando…" : "Testar"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-destructive hover:text-destructive"
            disabled={!!ocupado}
            onClick={() => setConfirmar(true)}
            aria-label="Remover caixa"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {rotuloCaixa(caixa)}?</AlertDialogTitle>
            <AlertDialogDescription>
              O Agilliza para de ler esta caixa e apaga as mensagens capturadas e as regras dela. Os
              e-mails na caixa continuam lá.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void acao("remover")}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

function CartaoCodigo({
  codigo: c,
  agora,
  novo,
  multiplasCaixas,
}: {
  codigo: CodigoRecebido;
  agora: number;
  novo: boolean;
  multiplasCaixas: boolean;
}) {
  const [copiado, setCopiado] = useState(false);
  const vencido = Boolean(c.codigo) && agora - new Date(c.recebido_em).getTime() > VENCE_MS;
  const titulo = c.banco ?? c.remetente_nome ?? c.remetente_email ?? "Remetente desconhecido";

  async function copiar() {
    if (!c.codigo) return;
    try {
      await navigator.clipboard.writeText(c.codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Não consegui copiar. Selecione o código e copie manualmente.");
    }
  }

  return (
    <li
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-sm transition-[opacity,box-shadow] sm:p-5",
        novo && !vencido && "border-primary/40 shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]",
        vencido && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <BancoLogo nome={c.banco ?? c.remetente_nome} size="lg" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <p className="truncate font-semibold text-foreground">{titulo}</p>
            <p className="shrink-0 text-xs text-muted-foreground" title={hora(c.recebido_em)}>
              {hora(c.recebido_em)} · {haQuanto(c.recebido_em, agora)}
            </p>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            De: {c.remetente_nome ? `${c.remetente_nome} ` : ""}
            {c.remetente_email ? `<${c.remetente_email}>` : ""}
            {multiplasCaixas && c.caixa_email ? ` · para ${c.caixa_nome || c.caixa_email}` : ""}
          </p>
          {c.assunto && <p className="mt-1.5 text-sm font-medium text-foreground">{c.assunto}</p>}
          {c.trecho && (
            <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {destacarCodigo(c.trecho, c.codigo).map((p, i) =>
                p.codigo ? (
                  <mark key={i} className="rounded bg-primary/15 px-0.5 font-semibold text-primary">
                    {p.texto}
                  </mark>
                ) : (
                  <span key={i}>{p.texto}</span>
                ),
              )}
            </p>
          )}
          {c.motivo && (
            <p className="mt-1.5 inline-flex max-w-full items-center gap-1 truncate rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              <Filter className="h-3 w-3 shrink-0" />
              {c.motivo}
            </p>
          )}
        </div>
      </div>

      {c.codigo && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <span className="font-mono text-2xl font-semibold tracking-[0.18em] text-foreground tabular-nums">
            {separar(c.codigo)}
          </span>
          <div className="flex items-center gap-2">
            {vencido && <span className="text-xs text-muted-foreground">provavelmente vencido</span>}
            <Button size="sm" onClick={() => void copiar()} className="min-w-[104px]">
              {copiado ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
              {copiado ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
