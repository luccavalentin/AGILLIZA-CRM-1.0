import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  CalendarOff,
  Clock3,
  Gauge,
  Landmark,
  Layers,
  Pencil,
  Plus,
  Search,
  Shuffle,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import { Icone3D } from "@/components/ui/icone-3d";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { usePermissao } from "@/hooks/use-permissao";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OpAvatar } from "@/components/operacional/ui";
import {
  configDemandas,
  excluirFilaDemanda,
  redistribuirDemandas,
  salvarDisponibilidade,
  salvarFilaDemanda,
  salvarRecebeAssinantes,
  salvarTipoDemanda,
  type ConfigDemandas,
  type FilaDemanda,
  type PessoaDemanda,
  type TipoDemanda,
} from "@/lib/operacional/demandas-central.functions";
import { ROTULO_ORIGEM, type DemandaOrigem } from "@/lib/operacional/demandas-regras";
import { TipoIcone, VazioDemandas } from "./pecas";

function Secao({
  icone,
  titulo,
  descricao,
  acoes,
  children,
}: {
  icone: LucideIcon;
  titulo: string;
  descricao: string;
  acoes?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-[0_1px_0_color-mix(in_oklab,#fff_70%,transparent)_inset] md:p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Icone3D icone={icone} tamanho="md" className="shrink-0" />
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-foreground">{titulo}</h2>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">{descricao}</p>
          </div>
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </header>
      {children}
    </section>
  );
}

/** Carga da pessoa: barra até o limite (sem limite = barra relativa a 10). */
function BarraCarga({ carga, limite }: { carga: number; limite: number | null }) {
  const ref = limite ?? Math.max(10, carga);
  const f = Math.min(1, carga / ref);
  const cheio = limite !== null && carga >= limite;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", cheio ? "bg-warning" : "bg-primary/70")} style={{ width: `${f * 100}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-muted-foreground">
        {carga}
        {limite !== null ? `/${limite}` : ""}
      </span>
    </div>
  );
}

export function ConfigDemandasView() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["demandas-config"],
    queryFn: () => configDemandas(),
  });
  const recarregar = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["demandas-central"] });
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-48 animate-pulse rounded-2xl border border-border/60 bg-muted/40" />
        ))}
      </div>
    );
  }
  if (isError || !data) {
    return (
      <VazioDemandas
        erro
        titulo="Não foi possível carregar a configuração"
        texto={mensagemDeErro(error, "Tente de novo em instantes.")}
        acao={<Button onClick={() => refetch()}>Tentar de novo</Button>}
      />
    );
  }

  return (
    <div className="space-y-4">
      {!data.pode_gerir && (
        <p className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-[12.5px] text-muted-foreground">
          Você vê a configuração. Só quem gere as demandas muda filas, tipos e limites — sua própria ausência você marca
          em “Disponibilidade da equipe”.
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        <FilasSecao cfg={data} onMudou={recarregar} />
        <TiposSecao cfg={data} onMudou={recarregar} />
      </div>
      <DisponibilidadeSecao cfg={data} onMudou={recarregar} />
      <div className="grid gap-4 xl:grid-cols-2">
        <RecebimentoSecao cfg={data} onMudou={recarregar} />
        <AnalistaDaContaSecao />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------- Filas --- */

function FilasSecao({ cfg, onMudou }: { cfg: ConfigDemandas; onMudou: () => void }) {
  const [editando, setEditando] = useState<FilaDemanda | null | "nova">(null);
  const excluir = useServerFn(excluirFilaDemanda);
  const redistribuir = useServerFn(redistribuirDemandas);
  const nomeTipo = (c: string) => cfg.tipos.find((t) => t.codigo === c)?.nome ?? c;

  return (
    <Secao
      icone={Shuffle}
      titulo="Filas de distribuição justa"
      descricao="A primeira fila ativa que atende o tipo e a origem recebe a demanda. Menor carga recebe; no empate, quem recebeu há mais tempo."
      acoes={
        cfg.pode_gerir && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl"
              onClick={async () => {
                try {
                  const r = await redistribuir();
                  toast.success(r.distribuidas ? `${r.distribuidas} demanda(s) distribuída(s).` : "Nada para distribuir agora.");
                  onMudou();
                } catch (e) {
                  toast.error(mensagemDeErro(e, "Não foi possível distribuir."));
                }
              }}
            >
              Distribuir agora
            </Button>
            <Button size="sm" className="h-9 rounded-xl" onClick={() => setEditando("nova")}>
              <Plus className="mr-1 size-4" /> Nova fila
            </Button>
          </>
        )
      }
    >
      {cfg.filas.length === 0 ? (
        <VazioDemandas
          titulo="Nenhuma fila ainda"
          texto="Sem fila, demanda sem analista da conta fica sem responsável. Crie uma fila com os analistas (ou corretores e parceiros) que atendem."
          icone={Shuffle}
        />
      ) : (
        <ul className="space-y-3">
          {cfg.filas.map((f) => (
            <li key={f.id} className={cn("rounded-xl border border-border/70 p-3", !f.ativa && "opacity-60")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[13.5px] font-semibold">
                    {f.nome}
                    {!f.ativa && <span className="rounded-full bg-muted px-2 text-[10px] text-muted-foreground">pausada</span>}
                    {f.pendentes > 0 && (
                      <span className="rounded-full bg-warning/15 px-2 text-[10.5px] font-semibold text-warning">
                        {f.pendentes} sem responsável
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {f.tipos.length ? f.tipos.map(nomeTipo).join(", ") : "Todos os tipos"} ·{" "}
                    {f.origens.length ? f.origens.map((o) => ROTULO_ORIGEM[o]).join(", ") : "todas as origens"}
                  </p>
                </div>
                {cfg.pode_gerir && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditando(f)} aria-label="Editar fila">
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      aria-label="Excluir fila"
                      onClick={async () => {
                        if (!window.confirm(`Excluir a fila "${f.nome}"? As demandas dela vão para as outras filas.`)) return;
                        try {
                          await excluir({ data: { id: f.id } });
                          toast.success("Fila excluída.");
                          onMudou();
                        } catch (e) {
                          toast.error(mensagemDeErro(e, "Não foi possível excluir."));
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
              {f.membros.length === 0 ? (
                <p className="mt-2 text-[12px] text-warning">Sem participantes: ninguém recebe desta fila.</p>
              ) : (
                <ol className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                  {f.membros.map((m, i) => (
                    <li
                      key={m.user_id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-2 py-1.5"
                      title={m.disponivel ? "Disponível" : m.ausente ? "Ausente" : "No limite de carga"}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="w-4 text-right text-[10.5px] tabular-nums text-muted-foreground">{i + 1}</span>
                        <OpAvatar nome={m.nome} className="size-6 text-[9px]" />
                        <span className="truncate text-[12px]">{m.nome}</span>
                        {m.ausente && <CalendarOff className="size-3.5 shrink-0 text-warning" />}
                      </span>
                      <BarraCarga carga={m.carga} limite={m.limite} />
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ul>
      )}
      {editando && (
        <FilaDialog
          cfg={cfg}
          fila={editando === "nova" ? null : editando}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            onMudou();
          }}
        />
      )}
    </Secao>
  );
}

function FilaDialog({
  cfg,
  fila,
  onFechar,
  onSalvo,
}: {
  cfg: ConfigDemandas;
  fila: FilaDemanda | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [nome, setNome] = useState(fila?.nome ?? "");
  const [descricao, setDescricao] = useState(fila?.descricao ?? "");
  const [tipos, setTipos] = useState<string[]>(fila?.tipos ?? []);
  const [origens, setOrigens] = useState<DemandaOrigem[]>(fila?.origens ?? []);
  const [membros, setMembros] = useState<string[]>(fila?.membros.map((m) => m.user_id) ?? []);
  const [ativa, setAtiva] = useState(fila?.ativa ?? true);
  const [ordem, setOrdem] = useState(String(fila?.ordem ?? 100));
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);
  const salvar = useServerFn(salvarFilaDemanda);

  const pessoas = useMemo(
    () => cfg.pessoas.filter((p) => !busca.trim() || p.nome.toLowerCase().includes(busca.trim().toLowerCase())),
    [cfg.pessoas, busca],
  );
  const alterna = <T,>(lista: T[], v: T) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

  async function enviar() {
    setSalvando(true);
    try {
      await salvar({
        data: {
          id: fila?.id ?? null,
          nome: nome.trim(),
          descricao: descricao.trim() || null,
          tipos,
          origens,
          membros,
          ativa,
          ordem: Number.parseInt(ordem, 10) || 100,
        },
      });
      toast.success(fila ? "Fila atualizada." : "Fila criada.");
      onSalvo();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível salvar a fila."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{fila ? "Editar fila" : "Nova fila"}</DialogTitle>
          <DialogDescription>Quem participa recebe as demandas desta fila de forma justa.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_6rem]">
            <div>
              <Label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Nome</Label>
              <Input value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Propostas dos assinantes" />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Ordem</Label>
              <Input value={ordem} inputMode="numeric" onChange={(e) => setOrdem(e.target.value.replace(/\D/g, "").slice(0, 4))} />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Descrição (opcional)</Label>
            <Input value={descricao} maxLength={300} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              Tipos atendidos <span className="font-normal">(nenhum marcado = todos)</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {cfg.tipos.map((t) => (
                <button
                  key={t.codigo}
                  type="button"
                  onClick={() => setTipos(alterna(tipos, t.codigo))}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[12px] transition",
                    tipos.includes(t.codigo) ? "border-primary bg-primary text-primary-foreground" : "border-border/70 hover:border-primary/40",
                  )}
                >
                  {t.nome}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              Origens <span className="font-normal">(nenhuma marcada = todas)</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(ROTULO_ORIGEM) as DemandaOrigem[]).map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOrigens(alterna(origens, o))}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[12px] transition",
                    origens.includes(o) ? "border-primary bg-primary text-primary-foreground" : "border-border/70 hover:border-primary/40",
                  )}
                >
                  {o === "interno" ? "Interno" : o === "assinante" ? "Assinantes" : "Corretores e parceiros vinculados"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <Label className="text-xs font-semibold text-muted-foreground">Participantes ({membros.length})</Label>
              <div className="relative w-44">
                <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" className="h-8 pl-7 text-[12px]" />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-border/70 p-1">
              {pessoas.map((p) => (
                <label key={p.user_id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent">
                  <Checkbox checked={membros.includes(p.user_id)} onCheckedChange={() => setMembros(alterna(membros, p.user_id))} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px]">{p.nome}</span>
                  <span className="text-[10.5px] text-muted-foreground">
                    {p.acesso_tipo === "portal_parceiro" ? "Parceiro" : p.papeis.join(", ")}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-[12.5px]">
            <Switch checked={ativa} onCheckedChange={setAtiva} /> Fila ativa
          </label>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={salvando || nome.trim().length < 2} className="font-semibold">
            {salvando ? "Salvando…" : "Salvar fila"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------------------------------------------------------- Tipos --- */

function TiposSecao({ cfg, onMudou }: { cfg: ConfigDemandas; onMudou: () => void }) {
  const [novo, setNovo] = useState(false);
  return (
    <Secao
      icone={Clock3}
      titulo="Tipos e prazos"
      descricao="Prazo em horas úteis para prioridade normal. Urgente vale a metade; baixa, o dobro. Regra específica em Configurações › SLA continua valendo."
      acoes={
        cfg.pode_gerir && (
          <Button variant="outline" size="sm" className="h-9 rounded-xl" onClick={() => setNovo(true)}>
            <Plus className="mr-1 size-4" /> Tipo
          </Button>
        )
      }
    >
      <ul className="divide-y divide-border/60">
        {cfg.tipos.map((t) => (
          <LinhaTipo key={t.codigo} t={t} podeGerir={cfg.pode_gerir} onMudou={onMudou} />
        ))}
        {novo && (
          <LinhaTipo
            t={{ codigo: "", nome: "", sla_horas: 8, ativo: true, ordem: 100, padrao: false }}
            novo
            podeGerir
            onMudou={() => {
              setNovo(false);
              onMudou();
            }}
            onCancelar={() => setNovo(false)}
          />
        )}
      </ul>
    </Secao>
  );
}

function LinhaTipo({
  t,
  podeGerir,
  onMudou,
  novo,
  onCancelar,
}: {
  t: TipoDemanda;
  podeGerir: boolean;
  onMudou: () => void;
  novo?: boolean;
  onCancelar?: () => void;
}) {
  const [nome, setNome] = useState(t.nome);
  const [codigo, setCodigo] = useState(t.codigo);
  const [horas, setHoras] = useState(String(t.sla_horas).replace(".", ","));
  const [salvando, setSalvando] = useState(false);
  const salvar = useServerFn(salvarTipoDemanda);
  const mudou = novo || nome !== t.nome || horas !== String(t.sla_horas).replace(".", ",");

  async function gravar(ativo = t.ativo) {
    const h = Number.parseFloat(horas.replace(",", "."));
    if (!Number.isFinite(h)) {
      toast.error("Prazo inválido.");
      return;
    }
    setSalvando(true);
    try {
      await salvar({ data: { codigo: novo ? codigo : t.codigo, nome: nome.trim(), sla_horas: h, ativo, ordem: t.ordem } });
      toast.success("Tipo salvo.");
      onMudou();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível salvar o tipo."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-2 py-2">
      <TipoIcone tipo={t.codigo} tamanho="xs" />
      {novo ? (
        <Input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 40))}
          placeholder="codigo"
          className="h-8 w-28 text-[12px]"
        />
      ) : null}
      <Input
        value={nome}
        disabled={!podeGerir}
        maxLength={60}
        onChange={(e) => setNome(e.target.value)}
        className="h-8 min-w-0 flex-1 basis-32 text-[12.5px]"
        placeholder="Nome"
      />
      <div className="flex items-center gap-1">
        <Input
          value={horas}
          disabled={!podeGerir}
          inputMode="decimal"
          onChange={(e) => setHoras(e.target.value.replace(/[^\d,]/g, "").slice(0, 6))}
          className="h-8 w-16 text-right text-[12.5px] tabular-nums"
          aria-label="Prazo em horas úteis"
        />
        <span className="text-[11px] text-muted-foreground">h</span>
      </div>
      {!novo && (
        <Switch
          checked={t.ativo}
          disabled={!podeGerir || salvando}
          onCheckedChange={(v) => gravar(v)}
          aria-label={t.ativo ? "Desativar tipo" : "Ativar tipo"}
        />
      )}
      {podeGerir && mudou && (
        <Button size="sm" className="h-8 rounded-lg" disabled={salvando} onClick={() => gravar()}>
          Salvar
        </Button>
      )}
      {novo && (
        <Button size="sm" variant="ghost" className="h-8" onClick={onCancelar}>
          Cancelar
        </Button>
      )}
    </li>
  );
}

/* ---------------------------------------------------------------------- Disponibilidade --- */

function paraLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function deLocal(dia: string, fimDoDia = false): string | null {
  if (!dia) return null;
  const d = new Date(`${dia}T${fimDoDia ? "23:59:00" : "00:00:00"}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function DisponibilidadeSecao({ cfg, onMudou }: { cfg: ConfigDemandas; onMudou: () => void }) {
  const [busca, setBusca] = useState("");
  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const base = cfg.pode_gerir ? cfg.pessoas : cfg.pessoas.filter((p) => p.user_id === cfg.eu);
    return t ? base.filter((p) => p.nome.toLowerCase().includes(t)) : base;
  }, [cfg, busca]);
  return (
    <Secao
      icone={Gauge}
      titulo="Disponibilidade da equipe"
      descricao="Limite de carga aberta por pessoa e ausências (férias, indisponível). Quem está ausente ou no limite não recebe da fila."
      acoes={
        cfg.pode_gerir && (
          <div className="relative w-52">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pessoa" className="h-9 rounded-xl pl-8" />
          </div>
        )
      }
    >
      <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
        {lista.map((p) => (
          <LinhaPessoa key={p.user_id} p={p} podeLimite={cfg.pode_gerir} onMudou={onMudou} />
        ))}
      </div>
    </Secao>
  );
}

function LinhaPessoa({ p, podeLimite, onMudou }: { p: PessoaDemanda; podeLimite: boolean; onMudou: () => void }) {
  const [limite, setLimite] = useState(p.limite ? String(p.limite) : "");
  const [de, setDe] = useState(paraLocal(p.ausente_desde));
  const [ate, setAte] = useState(paraLocal(p.ausente_ate));
  const [motivo, setMotivo] = useState(p.ausencia_motivo ?? "");
  const [salvando, setSalvando] = useState(false);
  const salvar = useServerFn(salvarDisponibilidade);
  useEffect(() => {
    setLimite(p.limite ? String(p.limite) : "");
    setDe(paraLocal(p.ausente_desde));
    setAte(paraLocal(p.ausente_ate));
    setMotivo(p.ausencia_motivo ?? "");
  }, [p]);
  const mudou =
    limite !== (p.limite ? String(p.limite) : "") ||
    de !== paraLocal(p.ausente_desde) ||
    ate !== paraLocal(p.ausente_ate) ||
    motivo !== (p.ausencia_motivo ?? "");

  async function gravar() {
    setSalvando(true);
    try {
      await salvar({
        data: {
          user_id: p.user_id,
          limite: limite ? Number.parseInt(limite, 10) : null,
          ausente_desde: deLocal(de),
          ausente_ate: deLocal(ate, true),
          motivo: motivo.trim() || null,
        },
      });
      toast.success("Disponibilidade salva.");
      onMudou();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível salvar."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className={cn("rounded-xl border border-border/70 p-3", p.ausente && "border-warning/40 bg-warning/5")}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <OpAvatar nome={p.nome} />
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] font-semibold">{p.nome}</span>
            <span className="block text-[10.5px] text-muted-foreground">
              {p.ausente ? "Ausente agora" : "Disponível"}
              {p.ultima_atribuicao_em ? ` · recebeu ${new Date(p.ultima_atribuicao_em).toLocaleDateString("pt-BR")}` : ""}
            </span>
          </span>
        </span>
        <BarraCarga carga={p.carga} limite={p.limite} />
      </div>
      <div className="mt-2.5 grid grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1fr)] gap-1.5">
        <Input
          value={limite}
          disabled={!podeLimite}
          inputMode="numeric"
          placeholder="Limite"
          onChange={(e) => setLimite(e.target.value.replace(/\D/g, "").slice(0, 3))}
          className="h-8 text-[12px]"
          aria-label="Limite de carga"
        />
        <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-8 text-[12px]" aria-label="Ausente desde" />
        <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-8 text-[12px]" aria-label="Volta em" />
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <Input
          value={motivo}
          maxLength={200}
          placeholder="Motivo da ausência (opcional)"
          onChange={(e) => setMotivo(e.target.value)}
          className="h-8 text-[12px]"
        />
        {mudou && (
          <Button size="sm" className="h-8 rounded-lg" disabled={salvando} onClick={gravar}>
            Salvar
          </Button>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------- Recebimento --- */

function RecebimentoSecao({ cfg, onMudou }: { cfg: ConfigDemandas; onMudou: () => void }) {
  const salvar = useServerFn(salvarRecebeAssinantes);
  return (
    <Secao
      icone={Landmark}
      titulo="Demandas dos assinantes"
      descricao="Cada proposta nova de assinante (ou de corretor/parceiro vinculado) vira uma demanda “Proposta” — uma só por proposta — e acompanha a fila de propostas."
    >
      <label className="flex items-start gap-3 rounded-xl border border-border/70 p-3">
        <Switch
          checked={cfg.recebe_assinantes}
          disabled={!cfg.pode_gerir || (cfg.outro_recebe && !cfg.recebe_assinantes)}
          onCheckedChange={async (v) => {
            try {
              await salvar({ data: { recebe: v } });
              toast.success(v ? "Este correspondente recebe as demandas dos assinantes." : "Recebimento desligado.");
              onMudou();
            } catch (e) {
              toast.error(mensagemDeErro(e, "Não foi possível salvar."));
            }
          }}
        />
        <span className="text-[12.5px] leading-relaxed">
          <span className="block font-semibold">Receber as demandas das contas sem analista</span>
          <span className="text-muted-foreground">
            Conta com analista na carteira cai direto nele; as demais vêm para cá e entram na fila justa.
            {cfg.outro_recebe && !cfg.recebe_assinantes && " Outro correspondente já recebe."}
          </span>
        </span>
      </label>
    </Secao>
  );
}

/* ------------------------------------------------------------------- Analista da conta --- */

function AnalistaDaContaSecao() {
  const podeVer = usePermissao("saas.licencas", "view");
  return (
    <Secao
      icone={Users}
      titulo="Analista de cada conta"
      descricao="Quem responde por cada conta do Agilliza Tech vem das Carteiras (Gestão de sistemas): toda demanda e proposta da conta cai direto no responsável da carteira; se ele estiver ausente, vai para a fila justa."
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/25 p-3">
        <p className="max-w-md text-[12.5px] leading-relaxed text-muted-foreground">
          Conta sem carteira entra na fila do correspondente que recebe as demandas dos assinantes.
        </p>
        {podeVer ? (
          <Button asChild variant="outline" size="sm" className="h-9 rounded-xl">
            <Link to="/plataforma/carteiras">Abrir Carteiras</Link>
          </Button>
        ) : (
          <span className="text-[12px] text-muted-foreground">Quem gere as licenças define as carteiras.</span>
        )}
      </div>
    </Secao>
  );
}
