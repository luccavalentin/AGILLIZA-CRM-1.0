import { useEffect, useRef, useState } from "react";
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

/** Seletor de escopo Minha · Geral. */
export function VisionSelector({
  escopo,
  onChange,
  podeGeral,
}: {
  escopo: Escopo;
  onChange: (e: Escopo) => void;
  podeGeral: boolean;
}) {
  // Escopo "Equipe" foi removido do produto — mantém apenas Minha e Geral.
  const opts: Escopo[] = ["minha", ...(podeGeral ? (["geral"] as Escopo[]) : [])];
  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-0.5 shadow-[var(--shadow-card)]">
      {opts.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={escopo === o}
          onClick={() => onChange(o)}
          // flex-1 no celular: com o seletor esticado, "Minha · Geral" ficava
          // espremido à esquerda com um vão branco ao lado (QA 20/10).
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors sm:flex-none ${escopo === o ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          {ESCOPO_LABEL[o]}
        </button>
      ))}
    </div>
  );
}

/** Espera depois da última tecla antes de consultar o relatório de novo. */
const ESPERA_DIGITACAO_MS = 400;

type Rascunho = { busca?: string; valorMin?: number; valorMax?: number };

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

  // Busca e valores: cada tecla disparava o relatório inteiro no servidor. O
  // texto fica num rascunho e só vale depois de uma pausa na digitação (ou Enter).
  const [rascunho, setRascunho] = useState<Rascunho>({
    busca: filtros.busca,
    valorMin: filtros.valorMin,
    valorMax: filtros.valorMax,
  });
  const atual = useRef({ filtros, onChange });
  atual.current = { filtros, onChange };
  // Limpar, remover chip ou trocar de relatório: o rascunho acompanha.
  useEffect(() => {
    setRascunho({ busca: filtros.busca, valorMin: filtros.valorMin, valorMax: filtros.valorMax });
  }, [filtros.busca, filtros.valorMin, filtros.valorMax]);
  const pendente =
    (rascunho.busca ?? "") !== (filtros.busca ?? "") ||
    rascunho.valorMin !== filtros.valorMin ||
    rascunho.valorMax !== filtros.valorMax;
  function aplicarRascunho() {
    const { filtros: f, onChange: mudar } = atual.current;
    mudar({ ...f, busca: rascunho.busca, valorMin: rascunho.valorMin, valorMax: rascunho.valorMax });
  }
  useEffect(() => {
    if (!pendente) return;
    const t = setTimeout(aplicarRascunho, ESPERA_DIGITACAO_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rascunho, pendente]);
  const aoTeclar = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && pendente) aplicarRascunho();
  };
  const bancoOpts: MultiOption[] = (bancos ?? []).map((b) => ({
    value: b,
    label: b,
    icon: <BancoLogo nome={b} size="sm" className="rounded-sm" />,
  }));
  const produtoOpts: MultiOption[] = (produtos ?? []).map((p) => ({
    value: p,
    label: rotularProduto(p),
  }));

  const chips: { key: keyof ReportFiltros; label: string }[] = [];
  if (filtros.produto)
    chips.push({ key: "produto", label: `Produto: ${rotularProduto(filtros.produto)}` });
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

  // Fim antes do início: avisa e não aplica (antes rodava e devolvia vazio sem explicar).
  const periodoInvertido =
    filtros.periodo === "custom" && !!filtros.de && !!filtros.ate && filtros.de > filtros.ate;

  const temAlgum =
    chips.length > 0 ||
    (filtros.bancos?.length ?? 0) > 0 ||
    (filtros.analistas?.length ?? 0) > 0 ||
    (filtros.comerciais?.length ?? 0) > 0 ||
    (filtros.corretores?.length ?? 0) > 0 ||
    (filtros.imobiliarias?.length ?? 0) > 0;

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-card p-3 shadow-[var(--shadow-card)] sm:p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate">Filtros</span>
        </div>
        {temAlgum && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 text-xs"
            onClick={() => onChange({ periodo: filtros.periodo, escopo: filtros.escopo })}
          >
            Limpar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        <Select value={filtros.periodo} onValueChange={(v) => set({ periodo: v as Periodo })}>
          <SelectTrigger className="h-9 w-full">
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

        {/* Intervalo de datas — ocupa duas colunas para não espremer os inputs */}
        <div className="flex items-center gap-1.5 sm:col-span-2 md:col-span-1 xl:col-span-2">
          <Input
            type="date"
            aria-label="Data inicial"
            value={filtros.de ?? ""}
            onChange={(e) => set({ periodo: "custom", de: e.target.value || undefined })}
            className="h-9 min-w-0 flex-1"
          />
          <span className="shrink-0 text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            aria-label="Data final"
            value={filtros.ate ?? ""}
            onChange={(e) => set({ periodo: "custom", ate: e.target.value || undefined })}
            className="h-9 min-w-0 flex-1"
          />
        </div>

        {!!bancoOpts.length && (
          <MultiSelect
            options={bancoOpts}
            selected={filtros.bancos ?? []}
            onChange={(v) => set({ bancos: v })}
            placeholder="Bancos"
            className="w-full"
          />
        )}
        {!!analistas?.length && (
          <MultiSelect
            options={analistas}
            selected={filtros.analistas ?? []}
            onChange={(v) => set({ analistas: v })}
            placeholder="Analista"
            className="w-full"
          />
        )}
        {!!comerciais?.length && (
          <MultiSelect
            options={comerciais}
            selected={filtros.comerciais ?? []}
            onChange={(v) => set({ comerciais: v })}
            placeholder="Comercial Agilliza"
            className="w-full"
          />
        )}
        {!!corretores?.length && (
          <MultiSelect
            options={corretores}
            selected={filtros.corretores ?? []}
            onChange={(v) => set({ corretores: v })}
            placeholder="Corretor"
            className="w-full"
          />
        )}
        {!!imobiliarias?.length && (
          <MultiSelect
            options={imobiliarias}
            selected={filtros.imobiliarias ?? []}
            onChange={(v) => set({ imobiliarias: v })}
            placeholder="Imobiliária"
            className="w-full"
          />
        )}

        {!!produtoOpts.length && (
          <Select
            value={filtros.produto ?? "__all"}
            onValueChange={(v) => set({ produto: v === "__all" ? undefined : v })}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Produto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os produtos</SelectItem>
              {produtoOpts.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
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
            <SelectTrigger className="h-9 w-full">
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
          value={rascunho.busca ?? ""}
          onChange={(e) => setRascunho((r) => ({ ...r, busca: e.target.value || undefined }))}
          onKeyDown={aoTeclar}
          placeholder="Buscar…"
          className="h-9 w-full"
        />

        <div className="flex items-center gap-1.5 sm:col-span-2 md:col-span-1 xl:col-span-2">
          <Input
            value={rascunho.valorMin ?? ""}
            onChange={(e) => {
              const valor = e.target.value.replace(/\D/g, "");
              setRascunho((r) => ({ ...r, valorMin: valor ? Number(valor) : undefined }));
            }}
            onKeyDown={aoTeclar}
            inputMode="numeric"
            placeholder="Valor mín."
            className="h-9 min-w-0 flex-1"
          />
          <Input
            value={rascunho.valorMax ?? ""}
            onChange={(e) => {
              const valor = e.target.value.replace(/\D/g, "");
              setRascunho((r) => ({ ...r, valorMax: valor ? Number(valor) : undefined }));
            }}
            onKeyDown={aoTeclar}
            inputMode="numeric"
            placeholder="Valor máx."
            className="h-9 min-w-0 flex-1"
          />
        </div>
      </div>

      {/* "Aplicar filtros" reenviava os mesmos filtros e não fazia nada: os
          filtros já valem ao escolher, e o texto após a pausa na digitação. */}
      {periodoInvertido && (
        <p role="alert" className="text-xs text-destructive">
          A data final é anterior à inicial. Corrija o período para aplicar.
        </p>
      )}

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
