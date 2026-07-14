import { X, SlidersHorizontal } from "lucide-react";
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
import { MultiSelect, MultiSelectChips, type MultiOption } from "@/components/reports/multi-select";
import { BancoLogo } from "@/components/bancos/banco-logo";
import {
  PERIODO_LABEL,
  ESCOPO_LABEL,
  type ReportFiltros,
  type Periodo,
  type Escopo,
} from "@/lib/relatorios/shared";

const PRODUTO_LABEL: Record<string, string> = {
  financiamento_imobiliario: "Financiamento imobiliário",
  home_equity: "Home equity",
};
const rotularProduto = (p: string) =>
  PRODUTO_LABEL[p] ?? p.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

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
  // Escopo "Equipe" foi removido do produto — mantém apenas Minha e Geral.
  const opts: Escopo[] = [
    "minha",
    ...(podeGeral ? (["geral"] as Escopo[]) : []),
  ];
  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-0.5 shadow-[var(--shadow-card)]">
      {opts.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${escopo === o ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          {ESCOPO_LABEL[o]}
        </button>
      ))}
    </div>
  );
}

/** Barra de filtros de relatório: período + intervalo + multi-seleções combináveis + chips ativos. */
export function ReportFiltersBar({
  filtros,
  onChange,
  bancos,
  produtos,
  statuses,
  analistas,
  comerciais,
  corretores,
  imobiliarias,
}: {
  filtros: ReportFiltros;
  onChange: (f: ReportFiltros) => void;
  bancos?: string[];
  produtos?: string[];
  statuses?: { value: string; label: string }[];
  analistas?: MultiOption[];
  comerciais?: MultiOption[];
  corretores?: MultiOption[];
  imobiliarias?: MultiOption[];
}) {
  const set = (patch: Partial<ReportFiltros>) => onChange({ ...filtros, ...patch });
  const bancoOpts: MultiOption[] = (bancos ?? []).map((b) => ({ value: b, label: b }));

  const chips: { key: keyof ReportFiltros; label: string }[] = [];
  if (filtros.produto) chips.push({ key: "produto", label: `Produto: ${filtros.produto}` });
  if (filtros.status)
    chips.push({
      key: "status",
      label: `Status: ${statuses?.find((s) => s.value === filtros.status)?.label ?? filtros.status}`,
    });
  if (filtros.valorMin != null)
    chips.push({ key: "valorMin", label: `Mín: ${filtros.valorMin.toLocaleString("pt-BR")}` });
  if (filtros.valorMax != null)
    chips.push({ key: "valorMax", label: `Máx: ${filtros.valorMax.toLocaleString("pt-BR")}` });
  if (filtros.busca) chips.push({ key: "busca", label: `Busca: ${filtros.busca}` });

  const temAlgum =
    chips.length > 0 ||
    (filtros.bancos?.length ?? 0) > 0 ||
    (filtros.analistas?.length ?? 0) > 0 ||
    (filtros.comerciais?.length ?? 0) > 0 ||
    (filtros.corretores?.length ?? 0) > 0 ||
    (filtros.imobiliarias?.length ?? 0) > 0;

  return (
    <div className="space-y-2.5 rounded-xl border border-border bg-card p-3.5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
        Filtros de pesquisa
      </div>
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
        <div className="flex flex-wrap items-center gap-1">
          <Input
            type="date"
            aria-label="Data inicial"
            value={filtros.de ?? ""}
            onChange={(e) => set({ periodo: "custom", de: e.target.value || undefined })}
            className="h-9 w-[calc(50%-1.25rem)] min-w-[140px] sm:w-40"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            aria-label="Data final"
            value={filtros.ate ?? ""}
            onChange={(e) => set({ periodo: "custom", ate: e.target.value || undefined })}
            className="h-9 w-[calc(50%-1.25rem)] min-w-[140px] sm:w-40"
          />
        </div>

        {!!bancoOpts.length && (
          <MultiSelect
            options={bancoOpts}
            selected={filtros.bancos ?? []}
            onChange={(v) => set({ bancos: v })}
            placeholder="Bancos"
            className="w-44"
          />
        )}
        {!!analistas?.length && (
          <MultiSelect
            options={analistas}
            selected={filtros.analistas ?? []}
            onChange={(v) => set({ analistas: v })}
            placeholder="Analista"
            className="w-44"
          />
        )}
        {!!comerciais?.length && (
          <MultiSelect
            options={comerciais}
            selected={filtros.comerciais ?? []}
            onChange={(v) => set({ comerciais: v })}
            placeholder="Comercial Agilliza"
            className="w-52"
          />
        )}
        {!!corretores?.length && (
          <MultiSelect
            options={corretores}
            selected={filtros.corretores ?? []}
            onChange={(v) => set({ corretores: v })}
            placeholder="Corretor"
            className="w-44"
          />
        )}
        {!!imobiliarias?.length && (
          <MultiSelect
            options={imobiliarias}
            selected={filtros.imobiliarias ?? []}
            onChange={(v) => set({ imobiliarias: v })}
            placeholder="Imobiliária"
            className="w-48"
          />
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

        <Input
          value={filtros.busca ?? ""}
          onChange={(e) => set({ busca: e.target.value || undefined })}
          placeholder="Buscar…"
          className="h-9 w-48"
        />

        <Input
          value={filtros.valorMin ?? ""}
          onChange={(e) => {
            const valor = e.target.value.replace(/\D/g, "");
            set({ valorMin: valor ? Number(valor) : undefined });
          }}
          inputMode="numeric"
          placeholder="Valor mín."
          className="h-9 w-32"
        />
        <Input
          value={filtros.valorMax ?? ""}
          onChange={(e) => {
            const valor = e.target.value.replace(/\D/g, "");
            set({ valorMax: valor ? Number(valor) : undefined });
          }}
          inputMode="numeric"
          placeholder="Valor máx."
          className="h-9 w-32"
        />

        {temAlgum && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ periodo: filtros.periodo, escopo: filtros.escopo })}
          >
            Limpar
          </Button>
        )}
      </div>

      {temAlgum && (
        <div className="flex flex-wrap gap-1.5">
          <MultiSelectChips
            prefix="Banco"
            options={bancoOpts}
            selected={filtros.bancos ?? []}
            onChange={(v) => set({ bancos: v })}
          />
          <MultiSelectChips
            prefix="Analista"
            options={analistas ?? []}
            selected={filtros.analistas ?? []}
            onChange={(v) => set({ analistas: v })}
          />
          <MultiSelectChips
            prefix="Comercial"
            options={comerciais ?? []}
            selected={filtros.comerciais ?? []}
            onChange={(v) => set({ comerciais: v })}
          />
          <MultiSelectChips
            prefix="Corretor"
            options={corretores ?? []}
            selected={filtros.corretores ?? []}
            onChange={(v) => set({ corretores: v })}
          />
          <MultiSelectChips
            prefix="Imobiliária"
            options={imobiliarias ?? []}
            selected={filtros.imobiliarias ?? []}
            onChange={(v) => set({ imobiliarias: v })}
          />
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
