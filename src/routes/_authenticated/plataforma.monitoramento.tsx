import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Inbox,
  RefreshCw,
  Server,
  Webhook,
} from "lucide-react";
import { AdminHero } from "@/components/admin/admin-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { RodapePaginas } from "@/components/plataforma/paginacao";
import {
  POR_PAGINA_INCIDENTES,
  agirIncidente,
  lerMonitoramento,
  type Incidente,
  type RotinaPlataforma,
} from "@/lib/plataforma/monitoramento.functions";

export const Route = createFileRoute("/_authenticated/plataforma/monitoramento")({
  head: () => ({ meta: [{ title: "Monitoramento — Plataforma — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("saas.monitoramento"),
  component: Pagina,
});

/** Nome de exibição dos provedores (o banco grava o código em minúsculas). */
const PROVEDOR: Record<string, string> = {
  asaas: "Asaas",
  homefin: "Integração bancária",
  sendpulse: "SendPulse",
  openai: "OpenAI",
  gemini: "Gemini",
  serpro: "Serpro",
  bigdatacorp: "BigDataCorp",
  viacep: "ViaCEP",
};
const nomeProvedor = (p: string) =>
  PROVEDOR[p] ?? (p ? p.charAt(0).toUpperCase() + p.slice(1).replace(/_/g, " ") : "—");

const SEVERIDADE: Record<
  Incidente["severidade"],
  { rotulo: string; tom: "default" | "secondary" | "destructive" | "outline" }
> = {
  critica: { rotulo: "Crítica", tom: "destructive" },
  alta: { rotulo: "Alta", tom: "destructive" },
  aviso: { rotulo: "Aviso", tom: "secondary" },
  info: { rotulo: "Informação", tom: "outline" },
};
const STATUS_INC: Record<Incidente["status"], string> = {
  aberto: "Aberto",
  reconhecido: "Em tratamento",
  resolvido: "Resolvido",
};

/** "há 3 min" a partir de um instante ISO (relógio do navegador). */
function ha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (Number.isNaN(min)) return "—";
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.round(min / 60)} h`;
  return `há ${Math.round(min / 1440)} dia(s)`;
}

function Pagina() {
  const lerFn = useServerFn(lerMonitoramento);
  const [status, setStatus] = useState<"todos" | Incidente["status"]>("aberto");
  const [pagina, setPagina] = useState(1);
  const q = useQuery({
    queryKey: ["plataforma-monitoramento", status, pagina],
    queryFn: () => lerFn({ data: { status: status === "todos" ? null : status, pagina } }),
    refetchInterval: 30_000,
    placeholderData: (anterior) => anterior,
  });
  const p = q.data?.painel;
  const lista = q.data?.lista;
  const rotinas = p?.jobs ?? [];
  const rotinasComErro = rotinas.filter((r) => r.ultimo_status === "erro");
  const banco = p?.banco;
  const worker = p?.coletas?.worker;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <AdminHero
        secao="Plataforma"
        icon={<Activity className="h-5 w-5" />}
        titulo="Monitoramento e incidentes"
        descricao="Saúde do banco de dados, do processador de tarefas, das rotinas automáticas e das integrações. Atualiza a cada 30 segundos."
        acoes={
          <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={`mr-2 size-4 ${q.isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        }
      />

      {q.isError && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {mensagemDeErro(q.error, "Não foi possível ler o monitoramento.")}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Cartao
          titulo="Banco de dados"
          icone={<Database className="size-4" />}
          alerta={(banco?.uso_pct ?? 0) >= 80 || (banco?.aguardando_bloqueio ?? 0) > 0}
          carregando={q.isLoading}
          linhas={[
            [
              "Conexões",
              banco
                ? `${banco.conexoes ?? "—"} de ${banco.max_conexoes ?? "—"} (${banco.uso_pct ?? "—"}%)`
                : "—",
            ],
            ["Cache", banco?.cache_hit_pct != null ? `${banco.cache_hit_pct}%` : "—"],
            ["Esperando bloqueio", String(banco?.aguardando_bloqueio ?? "—")],
            [
              "Transação mais longa",
              banco?.transacao_mais_longa_s != null ? `${banco.transacao_mais_longa_s} s` : "—",
            ],
          ]}
        />
        <Cartao
          titulo="Processador de tarefas"
          icone={<Server className="size-4" />}
          alerta={
            !worker?.coletado_em ||
            Date.now() - new Date(worker.coletado_em).getTime() > 10 * 60_000
          }
          carregando={q.isLoading}
          linhas={[
            ["Último sinal", ha(worker?.coletado_em)],
            ["Memória", worker?.dados?.memoria_mb != null ? `${worker.dados.memoria_mb} MB` : "—"],
            ["Faixas", String(worker?.dados?.faixas?.length ?? "—")],
            ["Fila pendente", String(p?.fila?.pendentes ?? "—")],
          ]}
        />
        <Cartao
          titulo="Integrações"
          icone={<Webhook className="size-4" />}
          alerta={
            (p?.webhooks_24h?.com_erro ?? 0) > 0 ||
            (p?.propostas_erro_envio_1h ?? 0) > 0 ||
            (p?.fila?.mortas_24h ?? 0) > 0
          }
          carregando={q.isLoading}
          linhas={[
            [
              "Webhooks 24 h",
              `${p?.webhooks_24h?.recebidos ?? 0} recebidos · ${p?.webhooks_24h?.com_erro ?? 0} com erro`,
            ],
            ["Propostas com erro de envio (1 h)", String(p?.propostas_erro_envio_1h ?? 0)],
            ["Mensagens descartadas (24 h)", String(p?.fila?.mortas_24h ?? 0)],
            ["Consultas pagas a conferir", String(p?.consultas_pagas?.reconciliar ?? 0)],
          ]}
        />
        <Cartao
          titulo="Incidentes"
          icone={<AlertTriangle className="size-4" />}
          alerta={(lista?.abertos ?? 0) > 0 || rotinasComErro.length > 0}
          carregando={q.isLoading}
          linhas={[
            ["Abertos", String(lista?.abertos ?? 0)],
            ["Críticos", String(lista?.criticos ?? 0)],
            ["Rotinas com erro", String(rotinasComErro.length)],
            ["Atualizado", ha(p?.gerado_em)],
          ]}
        />
      </div>

      {(p?.provedores_1h?.length ?? 0) > 0 && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">Provedores na última hora</h2>
          <ul className="divide-y divide-border text-sm">
            {p!.provedores_1h!.map((x) => (
              <li key={x.provedor} className="flex flex-wrap justify-between gap-2 py-1.5">
                <span className="font-medium">{nomeProvedor(x.provedor)}</span>
                <span className="tabular-nums text-muted-foreground">
                  {x.chamadas} chamadas · {x.falhas_fornecedor} falha(s) · {x.recusas} recusa(s) ·
                  p95 {x.p95_ms ?? "—"} ms
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Incidentes
        lista={lista?.incidentes ?? []}
        status={status}
        onStatus={(s) => {
          setStatus(s);
          setPagina(1);
        }}
        carregando={q.isLoading}
        rodape={
          <RodapePaginas
            pagina={pagina}
            porPagina={POR_PAGINA_INCIDENTES}
            quantidade={lista?.incidentes.length ?? 0}
            total={lista?.total}
            carregando={q.isFetching}
            onPagina={setPagina}
          />
        }
      />

      <Rotinas rotinas={rotinas} carregando={q.isLoading} />
    </div>
  );
}

function Cartao({
  titulo,
  icone,
  linhas,
  alerta,
  carregando,
}: {
  titulo: string;
  icone: React.ReactNode;
  linhas: [string, string][];
  alerta: boolean;
  carregando: boolean;
}) {
  return (
    <section
      className={`rounded-lg border bg-card p-4 ${alerta ? "border-amber-400/70" : "border-border"}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {icone} {titulo}
        </h2>
        {carregando ? null : alerta ? (
          <Badge variant="secondary" className="bg-amber-100 text-amber-900">
            Atenção
          </Badge>
        ) : (
          <Badge variant="outline" className="text-emerald-700">
            <CheckCircle2 className="mr-1 size-3" /> Normal
          </Badge>
        )}
      </div>
      {carregando ? (
        <Skeleton className="h-20" />
      ) : (
        <dl className="space-y-1 text-sm">
          {linhas.map(([r, v]) => (
            <div key={r} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{r}</dt>
              <dd className="text-right tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function Incidentes({
  lista,
  status,
  onStatus,
  carregando,
  rodape,
}: {
  lista: Incidente[];
  status: "todos" | Incidente["status"];
  onStatus: (s: "todos" | Incidente["status"]) => void;
  carregando: boolean;
  rodape?: React.ReactNode;
}) {
  const podeTratar = usePermissao("saas.monitoramento", "edit");
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
        <h2 className="text-sm font-semibold">Incidentes</h2>
        <Select value={status} onValueChange={(v) => onStatus(v as typeof status)}>
          <SelectTrigger className="w-44" aria-label="Situação dos incidentes">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="aberto">Abertos</SelectItem>
            <SelectItem value="reconhecido">Em tratamento</SelectItem>
            <SelectItem value="resolvido">Resolvidos</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {carregando ? (
        <div className="p-4">
          <Skeleton className="h-16" />
        </div>
      ) : lista.length === 0 ? (
        <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Inbox className="size-4" /> Nenhum incidente nesta situação.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {lista.map((i) => (
            <LinhaIncidente key={i.id} incidente={i} podeTratar={podeTratar} />
          ))}
        </ul>
      )}
      {rodape}
    </section>
  );
}

function LinhaIncidente({
  incidente: i,
  podeTratar,
}: {
  incidente: Incidente;
  podeTratar: boolean;
}) {
  const qc = useQueryClient();
  const agirFn = useServerFn(agirIncidente);
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);
  const agir = useMutation({
    mutationFn: (acao: "reconhecer" | "resolver" | "reabrir") =>
      agirFn({ data: { id: i.id, acao, texto: texto.trim() || null } }),
    onSuccess: () => {
      toast.success("Incidente atualizado.");
      setTexto("");
      setAberto(false);
      qc.invalidateQueries({ queryKey: ["plataforma-monitoramento"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível atualizar o incidente.")),
  });

  return (
    <li className="space-y-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{i.titulo}</p>
          <p className="text-xs text-muted-foreground">
            {i.origem} · {i.categoria}
            {i.conta ? ` · conta ${i.conta}` : ""} · {i.ocorrencias} ocorrência(s) · última{" "}
            {ha(i.ultima_em)}
            {i.responsavel ? ` · com ${i.responsavel}` : ""}
          </p>
          {i.resolucao && <p className="mt-1 text-xs">Resolução: {i.resolucao}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant={SEVERIDADE[i.severidade]?.tom ?? "secondary"}>
            {SEVERIDADE[i.severidade]?.rotulo ?? i.severidade}
          </Badge>
          <Badge variant="outline">{STATUS_INC[i.status]}</Badge>
          {podeTratar && (
            <Button size="sm" variant="ghost" onClick={() => setAberto((v) => !v)}>
              Tratar
            </Button>
          )}
        </div>
      </div>
      {aberto && podeTratar && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <Textarea
            aria-label="Anotação do tratamento"
            rows={2}
            placeholder="O que foi verificado ou feito (obrigatório para resolver)"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {i.status === "aberto" && (
              <Button
                size="sm"
                variant="outline"
                disabled={agir.isPending}
                onClick={() => agir.mutate("reconhecer")}
              >
                Assumir
              </Button>
            )}
            {i.status !== "resolvido" && (
              <Button
                size="sm"
                disabled={agir.isPending || texto.trim().length < 5}
                onClick={() => agir.mutate("resolver")}
              >
                Resolver
              </Button>
            )}
            {i.status === "resolvido" && (
              <Button
                size="sm"
                variant="outline"
                disabled={agir.isPending}
                onClick={() => agir.mutate("reabrir")}
              >
                Reabrir
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function Rotinas({ rotinas, carregando }: { rotinas: RotinaPlataforma[]; carregando: boolean }) {
  const ordenadas = [...rotinas].sort(
    (a, b) => Number(b.ultimo_status === "erro") - Number(a.ultimo_status === "erro"),
  );
  return (
    <section className="rounded-lg border border-border bg-card">
      <h2 className="border-b border-border p-4 text-sm font-semibold">
        Rotinas automáticas ({rotinas.length})
      </h2>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rotina</TableHead>
              <TableHead>Última execução</TableHead>
              <TableHead>Resultado</TableHead>
              <TableHead className="hidden md:table-cell">Erro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {carregando && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Skeleton className="h-10" />
                </TableCell>
              </TableRow>
            )}
            {ordenadas.map((r) => (
              <TableRow key={r.nome}>
                <TableCell className="font-mono text-xs">{r.nome}</TableCell>
                <TableCell className="text-xs">
                  {r.ultimo_fim ? ha(r.ultimo_fim) : "ainda não rodou"}
                </TableCell>
                <TableCell>
                  {r.ultimo_status === "erro" ? (
                    <Badge variant="destructive">Erro</Badge>
                  ) : r.ultimo_status === "sucesso" ? (
                    <Badge variant="outline" className="text-emerald-700">
                      OK
                    </Badge>
                  ) : (
                    <Badge variant="secondary">{r.ativo ? "Aguardando" : "Desligada"}</Badge>
                  )}
                </TableCell>
                <TableCell className="hidden max-w-[28rem] truncate text-xs text-muted-foreground md:table-cell">
                  {r.ultimo_erro ?? ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
