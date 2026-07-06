import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PERIODO_LABEL,
  ESCOPO_LABEL,
  type ReportFiltros,
  type Periodo,
  type Escopo,
} from "@/lib/relatorios/shared";

const PERIODOS: Periodo[] = ["hoje", "7d", "15d", "30d", "mes", "mes_anterior", "ano", "custom"];

/** Seletor de escopo Minha · Equipe · Geral. */
export function VisionSelector({
  escopo,
  onChange,
  podeEquipe,
  podeGeral,
}: {
  escopo: Escopo;
  onChange: (e: Escopo) => void;
  podeEquipe: boolean;
  podeGeral: boolean;
}) {
  const opts: Escopo[] = [
    "minha",
    ...(podeEquipe ? (["equipe"] as Escopo[]) : []),
    ...(podeGeral ? (["geral"] as Escopo[]) : []),
  ];
  return (
    <div className="inline-flex rounded-md border border-border bg-card p-0.5">
      {opts.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${escopo === o ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {ESCOPO_LABEL[o]}
        </button>
      ))}
    </div>
  );
}

/** Barra de filtros de relatório com período obrigatório + filtros extras + chips ativos. */
export function ReportFiltersBar({
  filtros,
  onChange,
  bancos,
  produtos,
  statuses,
  responsaveis,
}: {
  filtros: ReportFiltros;
  onChange: (f: ReportFiltros) => void;
  bancos?: string[];
  produtos?: string[];
  statuses?: { value: string; label: string }[];
  responsaveis?: { value: string; label: string }[];
}) {
  const set = (patch: Partial<ReportFiltros>) => onChange({ ...filtros, ...patch });
  const statusLabel = (v: string) => statuses?.find((s) => s.value === v)?.label ?? v;
  const respLabel = (v: string) => responsaveis?.find((r) => r.value === v)?.label ?? v;

  const chips: { key: keyof ReportFiltros; label: string }[] = [];
  if (filtros.banco) chips.push({ key: "banco", label: `Banco: ${filtros.banco}` });
  if (filtros.produto) chips.push({ key: "produto", label: `Produto: ${filtros.produto}` });
  if (filtros.status)
    chips.push({ key: "status", label: `Status: ${statusLabel(filtros.status)}` });
  if (filtros.responsavel)
    chips.push({ key: "responsavel", label: `Responsável: ${respLabel(filtros.responsavel)}` });
  if (filtros.valorMin != null)
    chips.push({ key: "valorMin", label: `Mín: ${filtros.valorMin.toLocaleString("pt-BR")}` });
  if (filtros.valorMax != null)
    chips.push({ key: "valorMax", label: `Máx: ${filtros.valorMax.toLocaleString("pt-BR")}` });
  if (filtros.busca) chips.push({ key: "busca", label: `Busca: ${filtros.busca}` });

  const temExtra =
    (bancos?.length || produtos?.length || statuses?.length || responsaveis?.length) ?? 0;

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filtros.periodo} onValueChange={(v) => set({ periodo: v as Periodo })}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODOS.map((p) => (
              <SelectItem key={p} value={p}>
                {PERIODO_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Intervalo de datas sempre disponível; ao editar, o período vira personalizado. */}
        <div className="flex items-center gap-1">
          <Input
            type="date"
            aria-label="Data inicial"
            value={filtros.de ?? ""}
            onChange={(e) => set({ periodo: "custom", de: e.target.value || undefined })}
            className="h-9 w-40"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            aria-label="Data final"
            value={filtros.ate ?? ""}
            onChange={(e) => set({ periodo: "custom", ate: e.target.value || undefined })}
            className="h-9 w-40"
          />
        </div>

        {!!bancos?.length && (
          <Select
            value={filtros.banco ?? "__all"}
            onValueChange={(v) => set({ banco: v === "__all" ? undefined : v })}
          >
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder="Banco" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os bancos</SelectItem>
              {bancos.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {!!produtos?.length && (
          <Select
            value={filtros.produto ?? "__all"}
            onValueChange={(v) => set({ produto: v === "__all" ? undefined : v })}
          >
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder="Produto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os produtos</SelectItem>
              {produtos.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {!!statuses?.length && (
          <Select
            value={filtros.status ?? "__all"}
            onValueChange={(v) => set({ status: v === "__all" ? undefined : v })}
          >
            <SelectTrigger className="h-9 w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os status</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {!!responsaveis?.length && (
          <Select
            value={filtros.responsavel ?? "__all"}
            onValueChange={(v) => set({ responsavel: v === "__all" ? undefined : v })}
          >
            <SelectTrigger className="h-9 w-52">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os responsáveis</SelectItem>
              {responsaveis.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Input
          value={filtros.busca ?? ""}
          onChange={(e) => set({ busca: e.target.value || undefined })}
          placeholder="Buscar…"
          className="h-9 w-48"
        />

        {(chips.length > 0 || temExtra) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ periodo: filtros.periodo, escopo: filtros.escopo })}
          >
            Limpar
          </Button>
        )}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <Badge key={c.key} variant="secondary" className="gap-1">
              {c.label}
              <button
                type="button"
                onClick={() => set({ [c.key]: undefined } as Partial<ReportFiltros>)}
                aria-label="Remover filtro"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
