/**
 * Partes comuns da Central e do Kanban de demandas: alternador de visão, abas de escopo,
 * indicadores, filtros e o diálogo de motivo.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlarmClock,
  CheckCheck,
  Hourglass,
  Inbox,
  Kanban,
  List,
  Search,
  Settings2,
  TriangleAlert,
  UserRoundX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { OpStat } from "@/components/operacional/ui";
import type { DemandaCentral, TipoDemanda } from "@/lib/operacional/demandas-central.functions";
import { ROTULO_ORIGEM, type DemandaEscopo, type DemandaOrigem } from "@/lib/operacional/demandas-regras";

export function VisoesDemandas({ atual }: { atual: "lista" | "kanban" }) {
  const item = (ativo: boolean) =>
    cn(
      "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold transition",
      ativo ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
    );
  return (
    <div className="inline-flex h-10 items-center rounded-xl border border-border/70 bg-muted/40 p-1">
      <Link to="/operacional/demandas" className={item(atual === "lista")}>
        <List className="size-4" /> Central
      </Link>
      <Link to="/operacional/demandas/kanban" className={item(atual === "kanban")}>
        <Kanban className="size-4" /> Kanban
      </Link>
    </div>
  );
}

export const ESCOPOS: { id: DemandaEscopo; rotulo: string; chave: keyof DemandaCentral["contadores"] }[] = [
  { id: "minhas", rotulo: "Minhas", chave: "minhas" },
  { id: "sem_responsavel", rotulo: "Sem responsável", chave: "sem_responsavel" },
  { id: "equipe", rotulo: "Equipe", chave: "equipe" },
  { id: "criadas", rotulo: "Que pedi", chave: "criadas" },
];

export function AbasEscopo({
  atual,
  onTrocar,
  contadores,
  config,
}: {
  atual: DemandaEscopo | "config";
  onTrocar: (a: DemandaEscopo | "config") => void;
  contadores?: DemandaCentral["contadores"];
  config?: boolean;
}) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div role="tablist" className="inline-flex min-w-max items-center gap-1 rounded-xl border border-border/70 bg-card p-1">
        {ESCOPOS.map((e) => {
          const n = contadores?.[e.chave] ?? 0;
          const ativo = atual === e.id;
          return (
            <button
              key={e.id}
              role="tab"
              aria-selected={ativo}
              type="button"
              onClick={() => onTrocar(e.id)}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[12.5px] font-semibold transition",
                ativo ? "bg-primary text-primary-foreground shadow-[0_8px_18px_-12px_rgba(0,15,159,0.9)]" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {e.rotulo}
              <span
                className={cn(
                  "min-w-5 rounded-full px-1.5 text-center text-[10.5px] tabular-nums",
                  ativo ? "bg-white/20" : e.id === "sem_responsavel" && n > 0 ? "bg-warning/15 text-warning" : "bg-muted",
                )}
              >
                {n}
              </span>
            </button>
          );
        })}
        {config && (
          <button
            role="tab"
            aria-selected={atual === "config"}
            type="button"
            onClick={() => onTrocar("config")}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold transition",
              atual === "config" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Settings2 className="size-4" /> Filas e prazos
          </button>
        )}
      </div>
    </div>
  );
}

export function IndicadoresDemandas({
  c,
  onSla,
  slaAtual,
}: {
  c?: DemandaCentral;
  onSla?: (s: "atrasadas" | "vencendo" | null) => void;
  slaAtual?: string | null;
}) {
  const k = c?.contadores;
  const clicavel = (s: "atrasadas" | "vencendo") =>
    onSla
      ? {
          role: "button" as const,
          tabIndex: 0,
          onClick: () => onSla(slaAtual === s ? null : s),
          onKeyDown: (e: React.KeyboardEvent) => e.key === "Enter" && onSla(slaAtual === s ? null : s),
          className: cn("cursor-pointer rounded-2xl transition", slaAtual === s && "ring-2 ring-primary/40"),
        }
      : {};
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 xl:grid-cols-6">
      <OpStat
        label="Minhas abertas"
        value={k?.minhas ?? 0}
        icon={<Inbox className="size-4" />}
        hint={c ? (c.meu_limite ? `limite ${c.meu_limite}` : c.estou_ausente ? "você está ausente" : "sem limite") : undefined}
      />
      <OpStat label="Sem responsável" value={k?.sem_responsavel ?? 0} icon={<UserRoundX className="size-4" />} accent="var(--warning)" />
      <div {...clicavel("atrasadas")}>
        <OpStat
          label="Atrasadas"
          value={k?.atrasadas ?? 0}
          icon={<TriangleAlert className="size-4" />}
          accent="var(--destructive)"
          alerta={(k?.atrasadas ?? 0) > 0}
        />
      </div>
      <div {...clicavel("vencendo")}>
        <OpStat label="Vencem em 4h" value={k?.vencendo ?? 0} icon={<AlarmClock className="size-4" />} accent="var(--warning)" />
      </div>
      <OpStat label="Aguardando solicitante" value={k?.aguardando ?? 0} icon={<Hourglass className="size-4" />} />
      <OpStat label="Concluídas hoje" value={k?.concluidas_hoje ?? 0} icon={<CheckCheck className="size-4" />} accent="var(--success)" />
    </div>
  );
}

export interface FiltrosDemanda {
  termo: string;
  tipo: string;
  origem: string;
  prioridade: string;
}

export const FILTROS_VAZIOS: FiltrosDemanda = { termo: "", tipo: "todos", origem: "todas", prioridade: "todas" };

export function FaixaFiltros({
  f,
  onF,
  tipos,
}: {
  f: FiltrosDemanda;
  onF: (f: FiltrosDemanda) => void;
  tipos: TipoDemanda[];
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={f.termo}
          onChange={(e) => onF({ ...f, termo: e.target.value })}
          placeholder="Buscar por número, título, cliente, conta ou proposta"
          className="h-10 rounded-xl pl-9"
        />
      </div>
      <div className="grid grid-cols-3 gap-2 sm:contents">
        <Select value={f.tipo} onValueChange={(v) => onF({ ...f, tipo: v })}>
          <SelectTrigger className="h-10 rounded-xl sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {tipos.map((t) => (
              <SelectItem key={t.codigo} value={t.codigo}>
                {t.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={f.origem} onValueChange={(v) => onF({ ...f, origem: v })}>
          <SelectTrigger className="h-10 rounded-xl sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Toda origem</SelectItem>
            {(Object.keys(ROTULO_ORIGEM) as DemandaOrigem[]).map((o) => (
              <SelectItem key={o} value={o}>
                {ROTULO_ORIGEM[o]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={f.prioridade} onValueChange={(v) => onF({ ...f, prioridade: v })}>
          <SelectTrigger className="h-10 rounded-xl sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Toda prioridade</SelectItem>
            <SelectItem value="p1">Urgente</SelectItem>
            <SelectItem value="p2">Normal</SelectItem>
            <SelectItem value="p3">Baixa</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/** Pede um motivo (cancelar, devolver). */
export function MotivoDialog({
  aberto,
  titulo,
  descricao,
  rotulo,
  minimo = 3,
  onConfirmar,
  onFechar,
}: {
  aberto: boolean;
  titulo: string;
  descricao: string;
  rotulo: string;
  minimo?: number;
  onConfirmar: (motivo: string) => Promise<void> | void;
  onFechar: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        if (!v) {
          setMotivo("");
          onFechar();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <Textarea rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo" autoFocus />
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onFechar} disabled={enviando}>
            Voltar
          </Button>
          <Button
            disabled={enviando || motivo.trim().length < minimo}
            onClick={async () => {
              setEnviando(true);
              try {
                await onConfirmar(motivo.trim());
                setMotivo("");
              } finally {
                setEnviando(false);
              }
            }}
            className="font-semibold"
          >
            {rotulo}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
