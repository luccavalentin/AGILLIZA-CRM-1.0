import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Paperclip, Download, Trash2 } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  obterDemanda, comentarDemanda, moverStatusDemanda, marcarDemandaLida,
  registrarAnexoDemanda, removerAnexoDemanda, urlAnexoDemanda,
  type DemandaStatus,
} from "@/lib/operacional/demandas.functions";
import { TransferirDialog } from "@/components/operacional/transferir-dialog";
import { SlaCountdown } from "@/components/operacional/sla-countdown";
import { ToneBadge } from "@/components/crm/tone-badge";
import { PRIORIDADE, statusDemanda } from "@/components/operacional/status";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operacional/demandas_/$id")({
  head: () => ({ meta: [{ title: "Demanda — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.demandas"),
  component: Pagina,
});

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const STATUS_OPCOES: DemandaStatus[] = ["aberta", "em_andamento", "aguardando", "concluida", "cancelada"];

function Pagina() {
  const { id } = useParams({ from: "/_authenticated/operacional/demandas_/$id" });
  const qc = useQueryClient();
  const [corpo, setCorpo] = useState("");
  const [visivelCliente, setVisivelCliente] = useState(false);
  const comentarFn = useServerFn(comentarDemanda);
  const moverFn = useServerFn(moverStatusDemanda);
  const lidaFn = useServerFn(marcarDemandaLida);
  const registrarAnexoFn = useServerFn(registrarAnexoDemanda);
  const removerAnexoFn = useServerFn(removerAnexoDemanda);
  const urlAnexoFn = useServerFn(urlAnexoDemanda);
  const fileRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviando(true);
    try {
      const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await supabase.storage.from("demanda-anexos").upload(path, file);
      if (error) throw error;
      await registrarAnexoFn({ data: { demanda_id: id, nome: file.name, storage_path: path, tamanho: file.size } });
      invalidar();
      toast.success("Anexo enviado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload.");
    } finally {
      setEnviando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function baixarAnexo(storage_path: string) {
    try {
      const { url } = await urlAnexoFn({ data: { storage_path } });
      window.open(url, "_blank", "noopener");
    } catch {
      toast.error("Falha ao gerar link do anexo.");
    }
  }

  const { data } = useQuery({ queryKey: ["demanda", id], queryFn: () => obterDemanda({ data: { id } }) });

  useEffect(() => {
    lidaFn({ data: { demanda_id: id } }).catch(() => {});
  }, [id, lidaFn]);

  useEffect(() => {
    const canal = supabase
      .channel(`demanda:${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "demanda_mensagens", filter: `demanda_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["demanda", id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [id, qc]);

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["demanda", id] });
    qc.invalidateQueries({ queryKey: ["demandas"] });
  }

  const d = data?.demanda;
  if (!d) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/operacional/demandas"><ArrowLeft className="mr-1 h-4 w-4" /> Demandas</Link>
        </Button>
        <div className="flex items-center gap-2">
          <TransferirDialog demandaId={id} onTransferida={invalidar} />
          <Select
            value={d.status}
            onValueChange={async (v) => { await moverFn({ data: { id, status: v as DemandaStatus } }); invalidar(); toast.success("Status atualizado."); }}
          >
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPCOES.map((s) => <SelectItem key={s} value={s}>{statusDemanda(s).label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">{d.numero}</span>
          <ToneBadge tone={statusDemanda(d.status).tone}>{statusDemanda(d.status).label}</ToneBadge>
          <span className={cn("inline-block h-1.5 w-8 rounded-full", PRIORIDADE[d.prioridade as "p1"].bar)} />
          <span className="text-xs text-muted-foreground">{PRIORIDADE[d.prioridade as "p1"].label}</span>
        </div>
        <h1 className="text-lg font-semibold text-foreground">{d.titulo}</h1>
        {d.descricao && <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{d.descricao}</p>}
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          <div><span className="text-muted-foreground">Responsável:</span> {data?.nome_responsavel ?? "—"}</div>
          <div><span className="text-muted-foreground">Cliente:</span> {d.clientes?.nome ?? "—"}</div>
          <div><span className="text-muted-foreground">Tipo:</span> {d.tipo}</div>
          <div><SlaCountdown inicio={d.sla_inicio} prazo={d.prazo_sla} concluida={d.status === "concluida"} concluidaEm={d.concluida_em} /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Mensagens */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Mensagens</h2>
          <div className="space-y-2">
            {(data?.mensagens ?? []).map((m: any) => (
              <div
                key={m.id}
                className={cn(
                  "rounded-md border-l-2 p-3 text-sm",
                  m.visivel_cliente
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-muted-foreground bg-muted text-foreground",
                )}
              >
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">{m.nome_autor ?? "—"}</span>
                  <ToneBadge tone={m.visivel_cliente ? "info" : "muted"}>{m.visivel_cliente ? "Cliente" : "Interno"}</ToneBadge>
                </div>
                <p className="whitespace-pre-wrap">{m.corpo}</p>
                <span className="mt-1 block text-[11px] text-muted-foreground">{fmtData(m.created_at)}</span>
              </div>
            ))}
            {(data?.mensagens ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Sem mensagens ainda.</p>
            )}
          </div>
          <Textarea value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={3} placeholder="Escreva uma mensagem…" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch id="vis" checked={visivelCliente} onCheckedChange={setVisivelCliente} />
              <Label htmlFor="vis" className="text-xs text-muted-foreground">Visível ao cliente</Label>
            </div>
            <Button
              size="sm"
              disabled={!corpo.trim()}
              onClick={async () => {
                await comentarFn({ data: { demanda_id: id, corpo, visivel_cliente: visivelCliente } });
                setCorpo(""); invalidar();
              }}
            >
              Enviar
            </Button>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Histórico</h2>
          <div className="space-y-3">
            {(data?.historico ?? []).map((h: any) => (
              <div key={h.id} className="text-sm">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{h.nome_ator ?? "Sistema"} · {h.acao}</span>
                  <span>{fmtData(h.created_at)}</span>
                </div>
                {h.acao === "transferida" && (
                  <p className="mt-0.5">
                    <span className="text-muted-foreground line-through">{h.nome_anterior ?? "—"}</span>
                    {" → "}
                    <span className="text-primary">{h.nome_novo ?? "—"}</span>
                  </p>
                )}
                {h.motivo && <div className="mt-1 rounded-md bg-muted p-3 text-foreground">{h.motivo}</div>}
                {h.detalhe && h.acao !== "transferida" && <p className="mt-0.5 text-muted-foreground">{h.detalhe}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Anexos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Anexos</h2>
          <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
          <Button variant="outline" size="sm" disabled={enviando} onClick={() => fileRef.current?.click()}>
            <Paperclip className="mr-1 h-3.5 w-3.5" /> {enviando ? "Enviando…" : "Anexar"}
          </Button>
        </div>
        <div className="space-y-2">
          {(data?.anexos ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum anexo.</p>
          ) : (
            (data?.anexos ?? []).map((a: any) => (
              <div key={a.id} className="flex items-center gap-2 rounded-md border border-border bg-card p-2 text-sm">
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-foreground">{a.nome}</span>
                <span className="text-xs text-muted-foreground">{a.nome_autor ?? "—"}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => baixarAnexo(a.storage_path)}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={async () => { await removerAnexoFn({ data: { id: a.id } }); invalidar(); }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
    </div>
  );
}
