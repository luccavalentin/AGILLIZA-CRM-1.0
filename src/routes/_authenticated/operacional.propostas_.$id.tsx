import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Send, Ban, Loader2, Plus, Trash2, Download, Upload, RefreshCw } from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  obterProposta,
  selecionarBancoProposta,
  enviarPropostaHomeFin,
  sincronizarProposta,
  cancelarProposta,
  moverStatusProposta,
  adicionarFollowup,
  adicionarEnvolvido,
  removerEnvolvido,
  registrarDocumento,
  removerDocumento,
  urlDocumento,
  salvarIq,
} from "@/lib/propostas/propostas.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { PipelineStepper } from "@/components/propostas/pipeline-stepper";
import { PropostaStatusBadge } from "@/components/propostas/status-badge";
import { ToneBadge } from "@/components/crm/tone-badge";
import { TRANSICOES, STATUS_EDITAVEIS, type PropostaStatus } from "@/lib/propostas/state-machine";
import { statusProposta } from "@/components/propostas/status";
import { formatBRL } from "@/lib/simulacao/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operacional/propostas_/$id")({
  head: () => ({ meta: [{ title: "Proposta — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.propostas"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Não foi possível carregar a proposta.</div>
  ),
});

const TABS = ["RESUMO", "COMPRADORES", "VENDEDORES", "IQ", "IMÓVEL", "DOCUMENTOS", "ATIVIDADES", "FUP"] as const;
type Tab = (typeof TABS)[number];

function Pagina() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("RESUMO");

  const { data, isLoading } = useQuery({
    queryKey: ["proposta", id],
    queryFn: () => obterProposta({ data: { id } }),
  });

  // realtime na proposta
  useEffect(() => {
    const channel = supabase
      .channel(`proposta-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "propostas", filter: `id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["proposta", id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  if (isLoading || !data) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }

  const p = data.proposta as any;
  const status = p.status as PropostaStatus;
  const diasDesde = Math.max(0, Math.round((Date.now() - new Date(p.created_at).getTime()) / 86400000));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/operacional/propostas"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar</Link>
        </Button>
        <AcoesTopo proposta={p} propostaId={id} bancos={data.bancos} />
      </div>

      {/* Header linha 1 */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Oportunidade {p.codigo_oportunidade_homefin || p.numero_proposta}
            </h1>
            <p className="text-sm text-muted-foreground">
              {p.produto ?? "Operação"} · Ativa há {diasDesde} dia(s)
            </p>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <Kpi label="Banco escolhido" valor={p.nome_banco ?? "—"} />
            <Kpi label="R$ Financiado" valor={formatBRL(p.valor_financiamento)} />
            <Kpi label="Situação" valor={<PropostaStatusBadge status={status} />} />
          </div>
        </div>
        <div className="mt-6">
          <PipelineStepper status={status} detalheStatus={p.detalhe_status_atual} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "RESUMO" && <TabResumo proposta={p} bancos={data.bancos} propostaId={id} />}
      {tab === "COMPRADORES" && <TabEnvolvidos tipo="CO" propostaId={id} envolvidos={data.envolvidos} />}
      {tab === "VENDEDORES" && <TabEnvolvidos tipo="VD" propostaId={id} envolvidos={data.envolvidos} />}
      {tab === "IQ" && <TabIq proposta={p} propostaId={id} />}
      {tab === "IMÓVEL" && <TabImovel proposta={p} propostaId={id} />}
      {tab === "DOCUMENTOS" && <TabDocumentos propostaId={id} documentos={data.documentos} />}
      {tab === "ATIVIDADES" && <TabAtividades historico={data.historico} />}
      {tab === "FUP" && <TabFup propostaId={id} followups={data.followups} />}
    </div>
  );
}

function Kpi({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground">{valor}</p>
    </div>
  );
}

/* ===== Ações do topo ===== */
function AcoesTopo({ proposta, propostaId, bancos }: { proposta: any; propostaId: string; bancos: any[] }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const enviarFn = useServerFn(enviarPropostaHomeFin);
  const cancelarFn = useServerFn(cancelarProposta);
  const moverFn = useServerFn(moverStatusProposta);
  const sincronizarFn = useServerFn(sincronizarProposta);
  const status = proposta.status as PropostaStatus;
  const proximos = TRANSICOES[status].filter((s) => s !== "cancelada");

  async function enviar() {
    setBusy(true);
    try {
      const r = await enviarFn({ data: { proposta_id: propostaId } });
      toast.success(`Proposta enviada (${r.status}).`);
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar.");
    } finally {
      setBusy(false);
    }
  }

  async function sincronizar() {
    setBusy(true);
    try {
      const r = await sincronizarFn({ data: { proposta_id: propostaId } });
      toast.success(
        r.atualizado
          ? `Situação atualizada${r.etapa ? `: ${r.etapa}` : ""}.`
          : "Nenhuma novidade do banco.",
      );
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao consultar o banco.");
    } finally {
      setBusy(false);
    }
  }

  async function mover(novo: string) {
    setBusy(true);
    try {
      await moverFn({ data: { proposta_id: propostaId, novo_status: novo } });
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transição inválida.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelar() {
    if (motivo.trim().length < 5) {
      toast.error("Informe um motivo com pelo menos 5 caracteres.");
      return;
    }
    setBusy(true);
    try {
      await cancelarFn({ data: { proposta_id: propostaId, motivo } });
      toast.success("Proposta cancelada.");
      setCancelOpen(false);
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao cancelar.");
    } finally {
      setBusy(false);
    }
  }

  // Bancos selecionados que ainda não foram ao banco (para envio adicional).
  const bancosPendentes = (bancos ?? []).filter(
    (b: any) => b.selecionado && b.status_banco !== "enviada",
  );
  const jaEnviou = Boolean(proposta.enviada_em);
  const podeEnviarNovos =
    jaEnviou &&
    bancosPendentes.length > 0 &&
    !["cancelada", "registrado", "credito_recusado", "contrato_emitido"].includes(status);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(status === "rascunho" || status === "erro_envio") && (
        <Button size="sm" onClick={enviar} disabled={busy}>
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
          {proposta.enviada_em ? "Reenviar" : "Enviar ao banco"}
        </Button>
      )}
      {podeEnviarNovos && (
        <Button size="sm" onClick={enviar} disabled={busy}>
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
          Enviar a {bancosPendentes.length > 1 ? `${bancosPendentes.length} novos bancos` : "novo banco"}
        </Button>
      )}
      {proposta.homefin_id_oportunidade && status !== "cancelada" && (
        <Button size="sm" variant="outline" onClick={sincronizar} disabled={busy}>
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
          Atualizar status
        </Button>
      )}
      {proximos.map((s) => (
        <Button key={s} size="sm" variant="secondary" onClick={() => mover(s)} disabled={busy}>
          → {statusProposta(s).label}
        </Button>
      ))}
      {status !== "cancelada" && status !== "registrado" && (
        <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="destructive"><Ban className="mr-1 h-4 w-4" /> Cancelar</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cancelar proposta</DialogTitle></DialogHeader>
            <Label>Motivo do cancelamento</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setCancelOpen(false)}>Voltar</Button>
              <Button variant="destructive" onClick={cancelar} disabled={busy}>Confirmar cancelamento</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* ===== RESUMO ===== */
function TabResumo({ proposta, bancos, propostaId }: { proposta: any; bancos: any[]; propostaId: string }) {
  const qc = useQueryClient();
  const selecionarFn = useServerFn(selecionarBancoProposta);
  const enviarFn = useServerFn(enviarPropostaHomeFin);
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const status = proposta.status as PropostaStatus;
  const podeEnviarBanco =
    Boolean(proposta.homefin_id_oportunidade) &&
    !["cancelada", "registrado", "credito_recusado", "contrato_emitido"].includes(status);
  const campos: [string, string][] = [
    ["Operação", proposta.produto ?? "—"],
    ["Regional", proposta.regional_nome ?? "—"],
    ["Parceiro", proposta.parceiro_nome ?? "—"],
    ["Consultor", proposta.consultor_nome ?? "—"],
    ["Analista", proposta.analista_nome ?? "—"],
    ["Nº da proposta", proposta.numero_proposta],
  ];

  async function selecionar(pbId: string) {
    try {
      await selecionarFn({ data: { proposta_id: propostaId, proposta_banco_id: pbId } });
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao selecionar banco.");
    }
  }

  async function enviarBanco(pbId: string) {
    setEnviandoId(pbId);
    try {
      const r = await enviarFn({ data: { proposta_id: propostaId, banco_id: pbId } });
      const res = r.bancos[0];
      if (res?.status === "erro") {
        toast.error(res.mensagem ?? "Falha ao enviar ao banco.");
      } else {
        toast.success("Banco enviado.");
      }
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar ao banco.");
    } finally {
      setEnviandoId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-lg border border-border bg-card p-5 sm:grid-cols-2 md:grid-cols-3">
        {campos.map(([label, valor]) => (
          <div key={label}>
            <Label className="text-xs text-muted-foreground">{label}</Label>
            <div className="mt-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
              {valor}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border">
        <div className="border-b border-border px-4 py-2 text-sm font-medium text-muted-foreground">
          Bancos / Simulações vinculadas — selecione um ou mais bancos para enviar a proposta
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Banco</TableHead>
              <TableHead className="text-right">R$ Financiamento</TableHead>
              <TableHead className="text-right">Parcela</TableHead>
              <TableHead className="text-right">Prazo</TableHead>
              <TableHead className="text-right">Taxa/ano</TableHead>
              <TableHead>Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bancos.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum banco vinculado.
                </TableCell>
              </TableRow>
            )}
            {bancos.map((b) => (
              <TableRow key={b.id} className={cn(b.selecionado && "bg-accent/40")}>
                <TableCell>
                  <Checkbox
                    checked={b.selecionado}
                    disabled={b.status_banco === "enviada"}
                    onCheckedChange={() => selecionar(b.id)}
                    aria-label={`Selecionar ${b.nome_banco}`}
                  />
                </TableCell>
                <TableCell className="font-medium">{b.nome_banco}</TableCell>
                <TableCell className="text-right tabular-nums">{formatBRL(b.valor_financiamento_max)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatBRL(b.valor_parcela)}</TableCell>
                <TableCell className="text-right tabular-nums">{b.prazo_pagamento_max ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {b.taxa_juros_ano != null ? `${b.taxa_juros_ano}%` : "—"}
                </TableCell>
                <TableCell>
                  <ToneBadge tone={b.status_banco === "erro" ? "danger" : b.status_banco === "enviada" ? "success" : "info"}>
                    {b.status_banco}
                  </ToneBadge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ===== Compradores / Vendedores ===== */
function TabEnvolvidos({ tipo, propostaId, envolvidos }: { tipo: "CO" | "VD"; propostaId: string; envolvidos: any[] }) {
  const qc = useQueryClient();
  const addFn = useServerFn(adicionarEnvolvido);
  const delFn = useServerFn(removerEnvolvido);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", cpf_cnpj: "", email: "", celular: "", tipo_pessoa: "F" });
  const lista = envolvidos.filter((e) => e.tipo_qualificacao === tipo);

  async function adicionar() {
    if (!form.nome.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    try {
      await addFn({ data: { proposta_id: propostaId, dados: { ...form, tipo_qualificacao: tipo } } });
      setOpen(false);
      setForm({ nome: "", cpf_cnpj: "", email: "", celular: "", tipo_pessoa: "F" });
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao adicionar.");
    }
  }

  async function remover(id: string) {
    await delFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
  }

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-sm font-medium text-muted-foreground">
          {tipo === "CO" ? "Compradores" : "Vendedores"}
        </span>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Incluir pessoa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Incluir {tipo === "CO" ? "comprador" : "vendedor"}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div><Label>CPF/CNPJ</Label><Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>E-mail</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Celular</Label><Input value={form.celular} onChange={(e) => setForm({ ...form, celular: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={adicionar}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>CPF/CNPJ</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Celular</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lista.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                Nenhum {tipo === "CO" ? "comprador" : "vendedor"} cadastrado
              </TableCell>
            </TableRow>
          )}
          {lista.map((e) => (
            <TableRow key={e.id}>
              <TableCell>{e.cpf_cnpj ?? "—"}</TableCell>
              <TableCell className="font-medium">{e.nome}</TableCell>
              <TableCell>{e.email ?? "—"}</TableCell>
              <TableCell>{e.celular ?? "—"}</TableCell>
              <TableCell className="text-right">
                <Button size="icon" variant="ghost" onClick={() => remover(e.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ===== IQ ===== */
function TabIq({ proposta, propostaId }: { proposta: any; propostaId: string }) {
  const qc = useQueryClient();
  const salvarFn = useServerFn(salvarIq);
  const [nome, setNome] = useState(proposta.iq_nome ?? "");
  const [comentario, setComentario] = useState(proposta.iq_comentario ?? "");

  async function salvar() {
    try {
      await salvarFn({ data: { proposta_id: propostaId, iq_nome: nome, iq_comentario: comentario } });
      toast.success("Dados do interveniente salvos.");
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Dados do interveniente quitante</p>
      <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
      <div>
        <Label>Comentário sobre o processo</Label>
        <Textarea value={comentario} maxLength={2000} rows={5} onChange={(e) => setComentario(e.target.value)} />
        <p className="mt-1 text-right text-xs text-muted-foreground">{comentario.length}/2000</p>
      </div>
      <div className="flex justify-end"><Button onClick={salvar}>Salvar</Button></div>
    </div>
  );
}

/* ===== Imóvel ===== */
function TabImovel({ proposta, propostaId }: { proposta: any; propostaId: string }) {
  const editavel = STATUS_EDITAVEIS.includes(proposta.status);
  const campos: [string, string][] = [
    ["Tipo do imóvel", proposta.tipo_imovel ?? "—"],
    ["Uso do imóvel", proposta.uso_imovel ?? "—"],
    ["CEP", proposta.cep_imovel ?? "—"],
    ["Endereço", proposta.endereco_imovel ?? "—"],
    ["Bairro", proposta.bairro_imovel ?? "—"],
    ["Cidade", proposta.cidade_imovel ?? "—"],
    ["UF", proposta.uf ?? "—"],
  ];
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Dados do imóvel</p>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {campos.map(([l, v]) => (
          <div key={l}>
            <Label className="text-xs text-muted-foreground">{l}</Label>
            <div className="mt-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{v}</div>
          </div>
        ))}
      </div>
      {!editavel && <p className="mt-4 text-xs text-muted-foreground">Dados congelados no status atual.</p>}
    </div>
  );
}

/* ===== Documentos ===== */
const TIPOS_DOC = ["RG", "CPF", "COMP_RENDA", "IR", "EXT_BANC", "MATRICULA", "IPTU", "CERT_NASC", "CERT_CAS"];

function TabDocumentos({ propostaId, documentos }: { propostaId: string; documentos: any[] }) {
  const qc = useQueryClient();
  const registrarFn = useServerFn(registrarDocumento);
  const removerFn = useServerFn(removerDocumento);
  const urlFn = useServerFn(urlDocumento);
  const inputRef = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState("RG");
  const [parte, setParte] = useState("comprador1");
  const [uploading, setUploading] = useState(false);

  async function onFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo acima de 10 MB. Escolha um arquivo menor.");
      return;
    }
    setUploading(true);
    try {
      const path = `${propostaId}/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("documentos-proposta").upload(path, file);
      if (error) throw new Error(error.message);
      await registrarFn({
        data: {
          proposta_id: propostaId,
          nome_documento: file.name,
          tipo_documento: tipo,
          parte,
          storage_path: path,
          mime_type: file.type,
          tamanho_bytes: file.size,
        },
      });
      toast.success("Documento anexado.");
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload.");
    } finally {
      setUploading(false);
    }
  }

  async function baixar(storage_path: string) {
    try {
      const { url } = await urlFn({ data: { storage_path } });
      window.open(url, "_blank");
    } catch {
      toast.error("Não foi possível gerar o link.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <div>
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{TIPOS_DOC.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Participante</Label>
          <Select value={parte} onValueChange={setParte}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="comprador1">Comprador 1</SelectItem>
              <SelectItem value="comprador2">Comprador 2</SelectItem>
              <SelectItem value="vendedor">Vendedor</SelectItem>
              <SelectItem value="imovel">Imóvel</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
          Adicionar documento
        </Button>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Participante</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documentos.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum documento anexado.
                </TableCell>
              </TableRow>
            )}
            {documentos.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{d.parte ?? "—"}</TableCell>
                <TableCell>{d.tipo_documento ?? "—"}</TableCell>
                <TableCell className="font-medium">{d.nome_documento}</TableCell>
                <TableCell>
                  <ToneBadge tone={d.status === "aprovado" ? "success" : d.status === "reprovado" ? "danger" : "info"}>
                    {d.status}
                  </ToneBadge>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => baixar(d.storage_path)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={async () => { await removerFn({ data: { id: d.id } }); qc.invalidateQueries({ queryKey: ["proposta", propostaId] }); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ===== Atividades (histórico) ===== */
function TabAtividades({ historico }: { historico: any[] }) {
  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Evento</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Data</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {historico.length === 0 && (
            <TableRow><TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">Sem atividades.</TableCell></TableRow>
          )}
          {historico.map((h) => (
            <TableRow key={h.id}>
              <TableCell className="font-medium">{h.tipo_evento}</TableCell>
              <TableCell className="text-muted-foreground">{h.descricao ?? (h.status_novo ? statusProposta(h.status_novo).label : "—")}</TableCell>
              <TableCell className="text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ===== FUP ===== */
function TabFup({ propostaId, followups }: { propostaId: string; followups: any[] }) {
  const qc = useQueryClient();
  const addFn = useServerFn(adicionarFollowup);
  const [tipo, setTipo] = useState<"interno" | "externo">("interno");
  const [titulo, setTitulo] = useState("");
  const [comentario, setComentario] = useState("");
  const [busy, setBusy] = useState(false);

  async function incluir() {
    if (comentario.trim().length === 0) {
      toast.error("Escreva um comentário.");
      return;
    }
    setBusy(true);
    try {
      await addFn({ data: { proposta_id: propostaId, tipo, titulo: titulo || undefined, comentario } });
      setTitulo("");
      setComentario("");
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao incluir.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Incluir comentário</p>
        <div>
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="interno">Interno</SelectItem>
              <SelectItem value="externo">Externo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Título</Label><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
        <div>
          <Label>Comentário</Label>
          <Textarea value={comentario} maxLength={4000} rows={4} onChange={(e) => setComentario(e.target.value)} />
          <p className="mt-1 text-right text-xs text-muted-foreground">{comentario.length}/4000</p>
        </div>
        <div className="flex justify-end"><Button onClick={incluir} disabled={busy}>Incluir comentário</Button></div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Histórico de comentários</p>
        <div className="space-y-3">
          {followups.length === 0 && <p className="text-sm text-muted-foreground">Nenhum comentário.</p>}
          {followups.map((f) => (
            <div key={f.id} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <ToneBadge tone={f.tipo === "externo" ? "info" : "muted"}>{f.tipo}</ToneBadge>
                <span className="text-xs text-muted-foreground">{new Date(f.created_at).toLocaleString("pt-BR")}</span>
              </div>
              {f.titulo && <p className="mt-2 font-medium text-foreground">{f.titulo}</p>}
              <p className="text-sm text-muted-foreground">{f.comentario}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
