import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, KeyRound, Mail, Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { CaixaDialog } from "@/components/operacional/codigos/caixa-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissao } from "@/hooks/use-permissao";
import { playNotificationSound } from "@/lib/chat-sound";
import { assertModuloPermitido } from "@/lib/route-guards";
import { cn } from "@/lib/utils";
import {
  listarCaixas,
  listarCodigos,
  type CaixaVigiada,
  type CodigoRecebido,
} from "@/lib/codigos/codigos.functions";

export const Route = createFileRoute("/_authenticated/operacional/codigos")({
  beforeLoad: () => assertModuloPermitido("operacional.codigos"),
  head: () => ({ meta: [{ title: "Códigos de acesso · Operacional" }] }),
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
  return `há ${h} h`;
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
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

function Pagina() {
  const listarFn = useServerFn(listarCodigos);
  const caixasFn = useServerFn(listarCaixas);
  const podeEditar = usePermissao("operacional.codigos", "edit");
  const agora = useAgora();
  const [dialogo, setDialogo] = useState<{ aberto: boolean; caixa: CaixaVigiada | null }>({
    aberto: false,
    caixa: null,
  });

  const codigos = useQuery({
    queryKey: ["codigos-recebidos"],
    queryFn: () => listarFn(),
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
  });
  const caixas = useQuery({
    queryKey: ["codigos-caixas"],
    queryFn: () => caixasFn(),
    refetchInterval: 15_000,
  });

  // Código novo enquanto a tela está aberta: som e aviso (o primeiro carregamento não toca).
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
    setNovos((s) => new Set([...s, ...chegaram.map((c) => c.id)]));
    playNotificationSound();
    const c = chegaram[0]!;
    toast.message(`Novo código${c.banco ? ` do ${c.banco}` : ""}`, {
      description: c.codigo ? separar(c.codigo) : (c.assunto ?? undefined),
    });
  }, [codigos.data]);

  const lista = codigos.data ?? [];
  const semCaixa = caixas.data && caixas.data.length === 0;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-foreground">Códigos de acesso</h1>
            <p className="text-sm text-muted-foreground">
              Os códigos que os bancos mandam para a caixa da equipe, na hora, com o banco e o
              remetente. Atualiza sozinho.
            </p>
          </div>
        </div>
        {podeEditar && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogo({ aberto: true, caixa: null })}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {semCaixa ? "Cadastrar caixa" : "Nova caixa"}
          </Button>
        )}
      </div>

      {caixas.data?.map((c) => (
        <EstadoCaixa
          key={c.id}
          caixa={c}
          agora={agora}
          aoConfigurar={podeEditar ? () => setDialogo({ aberto: true, caixa: c }) : undefined}
        />
      ))}

      {semCaixa && (
        <div className="rounded-2xl border border-dashed bg-card px-5 py-10 text-center">
          <Mail className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium text-foreground">
            {podeEditar ? "Nenhuma caixa vigiada ainda" : "Nenhuma caixa liberada para você"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {podeEditar
              ? "Cadastre o e-mail que recebe os códigos dos bancos. O Agilliza só lê: não envia nada."
              : "Cada pessoa vê só as caixas liberadas para ela. Peça a quem gere as caixas para liberar a que você precisa acompanhar."}
          </p>
          {podeEditar && (
            <Button className="mt-4" onClick={() => setDialogo({ aberto: true, caixa: null })}>
              Cadastrar caixa
            </Button>
          )}
        </div>
      )}

      {codigos.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : codigos.isError ? (
        <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          Não foi possível carregar os códigos agora. A tela tenta de novo sozinha.
        </p>
      ) : lista.length === 0 && !semCaixa ? (
        <div className="rounded-2xl border bg-card px-5 py-10 text-center">
          <KeyRound className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium text-foreground">Nenhum código nas últimas 24 horas</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Peça o código no portal do banco: ele aparece aqui em poucos segundos, com som.
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
              multiplasCaixas={(caixas.data?.length ?? 0) > 1}
            />
          ))}
        </ul>
      )}

      <CaixaDialog
        aberto={dialogo.aberto}
        caixa={dialogo.caixa}
        aoFechar={() => setDialogo({ aberto: false, caixa: null })}
      />
    </div>
  );
}

function EstadoCaixa({
  caixa,
  agora,
  aoConfigurar,
}: {
  caixa: CaixaVigiada;
  agora: number;
  aoConfigurar?: () => void;
}) {
  const espera = caixa.espera_ate && new Date(caixa.espera_ate).getTime() > agora;
  const tom = !caixa.ativo
    ? "cinza"
    : caixa.status === "conectado"
      ? "verde"
      : espera || caixa.status === "erro"
        ? "ambar"
        : "azul";
  const texto = !caixa.ativo
    ? "Leitura desligada"
    : caixa.status === "conectado"
      ? "Lendo a caixa agora"
      : espera
        ? `Em espera até ${new Date(caixa.espera_ate!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
        : caixa.status === "erro"
          ? "Reconectando"
          : "Conectando…";
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-card px-4 py-2.5 text-sm">
      <span
        className={cn(
          "h-2.5 w-2.5 shrink-0 rounded-full",
          tom === "verde" && "bg-emerald-500 shadow-[0_0_0_3px_rgb(16_185_129/0.18)]",
          tom === "ambar" && "bg-amber-500",
          tom === "azul" && "animate-pulse bg-primary",
          tom === "cinza" && "bg-muted-foreground/50",
        )}
        aria-hidden
      />
      <span className="min-w-0 truncate font-medium text-foreground">{caixa.email}</span>
      <span className="text-muted-foreground">{texto}</span>
      {aoConfigurar && (
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-8 px-2 text-muted-foreground"
          onClick={aoConfigurar}
          aria-label={`Configurar a caixa ${caixa.email}`}
        >
          <Settings2 className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Configurar</span>
        </Button>
      )}
      {caixa.erro && caixa.status !== "conectado" && (
        <span className="w-full text-xs text-amber-700 dark:text-amber-400">{caixa.erro}</span>
      )}
    </div>
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
  const vencido = agora - new Date(c.recebido_em).getTime() > VENCE_MS;
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
            {multiplasCaixas && c.caixa_email ? ` · para ${c.caixa_email}` : ""}
          </p>
          {c.assunto && <p className="mt-1.5 text-sm font-medium text-foreground">{c.assunto}</p>}
          {c.trecho && (
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {c.trecho}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        {c.codigo ? (
          <span className="font-mono text-2xl font-semibold tracking-[0.18em] text-foreground tabular-nums">
            {separar(c.codigo)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            Não achei um número neste e-mail — confira o trecho acima.
          </span>
        )}
        <div className="flex items-center gap-2">
          {vencido && <span className="text-xs text-muted-foreground">provavelmente vencido</span>}
          {c.codigo && (
            <Button size="sm" onClick={() => void copiar()} className="min-w-[104px]">
              {copiado ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
              {copiado ? "Copiado" : "Copiar"}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
