/**
 * Barra de filtros da Consulta simulações (C28, 26/10/2026: "melhore esse designer do filtro").
 *
 * Computador: uma linha só — busca, escopo (Todas | Minhas), responsável, período (atalhos +
 * datas) e "Excluídas" discreto; abaixo, chips do que está aplicado com "Limpar tudo".
 * Celular (375 px): busca + botão "Filtros (n)" que abre uma gaveta com o resto.
 * As regras (URL, período, contagem) ficam em `filtros-estado.ts`.
 */
import { useState } from "react";
import { CalendarRange, ChevronDown, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { UsuarioCombobox, type UsuarioOpcao } from "@/components/operacional/usuario-combobox";
import { cn } from "@/lib/utils";
import {
  contarFiltrosAtivos,
  hojeEmSaoPaulo,
  periodoDoPreset,
  presetDoPeriodo,
  ROTULO_PRESET,
  rotuloPeriodo,
  type Escopo,
  type FiltrosSimulacoes,
  type PresetPeriodo,
} from "./filtros-estado";

export interface PropsFiltrosLista {
  filtros: FiltrosSimulacoes;
  /** Texto da busca (com debounce na tela). */
  q: string;
  setQ: (v: string) => void;
  onMudar: (patch: Partial<FiltrosSimulacoes>) => void;
  colegas: UsuarioOpcao[] | undefined;
  verExcluidas: boolean;
  toggleExcluidas: () => void;
  onLimparTudo: () => void;
}

export function FiltrosLista(p: PropsFiltrosLista) {
  const [gaveta, setGaveta] = useState(false);
  const n = contarFiltrosAtivos({ ...p.filtros, q: p.q }, p.verExcluidas);
  return (
    <div className="space-y-2">
      <div data-tour="simulacoes-filtros" className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card p-1.5 shadow-sm">
        <BuscaSimulacoes q={p.q} setQ={p.setQ} />
        {/* Computador: tudo na mesma linha. */}
        <div className="hidden items-center gap-2 lg:flex">
          <SegmentadoEscopo valor={p.filtros.escopo} onValor={(escopo) => p.onMudar({ escopo })} />
          {p.filtros.escopo === "todas" && (
            <UsuarioCombobox
              value={p.filtros.resp}
              onValueChange={(resp) => p.onMudar({ resp })}
              usuarios={p.colegas ?? []}
              placeholder="Responsável"
              className="h-9 w-44 shrink-0 rounded-lg text-xs xl:w-52"
            />
          )}
          <PeriodoPopover de={p.filtros.de} ate={p.filtros.ate} onMudar={p.onMudar} />
          <AlternanciaExcluidas ativo={p.verExcluidas} onAlternar={p.toggleExcluidas} />
        </div>
        {/* Celular e telas médias: gaveta. */}
        <Button
          type="button"
          variant="outline"
          onClick={() => setGaveta(true)}
          className="h-10 shrink-0 gap-1.5 rounded-xl px-3 text-sm lg:hidden"
          aria-label={`Filtros${n ? ` (${n} aplicados)` : ""}`}
        >
          <SlidersHorizontal className="size-4" />
          Filtros
          {n > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground">
              {n}
            </span>
          )}
        </Button>
      </div>

      <ChipsAtivos {...p} />

      <Sheet open={gaveta} onOpenChange={setGaveta}>
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="text-left">
            <SheetTitle>Filtros</SheetTitle>
            <SheetDescription>Refine a lista de simulações.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Mostrar</Label>
              <SegmentadoEscopo
                valor={p.filtros.escopo}
                onValor={(escopo) => p.onMudar({ escopo })}
                cheio
              />
            </div>
            {p.filtros.escopo === "todas" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Responsável</Label>
                <UsuarioCombobox
                  value={p.filtros.resp}
                  onValueChange={(resp) => p.onMudar({ resp })}
                  usuarios={p.colegas ?? []}
                  placeholder="Todos os responsáveis"
                  className="h-11 w-full rounded-xl"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Período</Label>
              <EditorPeriodo de={p.filtros.de} ate={p.filtros.ate} onMudar={p.onMudar} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2.5">
              <Label htmlFor="ver-excluidas-gaveta" className="flex items-center gap-2 text-sm">
                <Trash2 className="size-4 text-muted-foreground" /> Ver excluídas
              </Label>
              <Switch
                id="ver-excluidas-gaveta"
                checked={p.verExcluidas}
                onCheckedChange={p.toggleExcluidas}
              />
            </div>
          </div>
          <SheetFooter className="mt-6 flex-row gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-11 flex-1"
              onClick={() => {
                p.onLimparTudo();
              }}
              disabled={n === 0}
            >
              Limpar tudo
            </Button>
            <Button type="button" className="h-11 flex-1" onClick={() => setGaveta(false)}>
              Ver resultados
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function BuscaSimulacoes({ q, setQ }: { q: string; setQ: (v: string) => void }) {
  return (
    <div className="relative min-w-0 flex-1">
      <label htmlFor="busca-simulacoes" className="sr-only">
        Buscar simulação
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id="busca-simulacoes"
        className="h-10 w-full rounded-xl border-transparent bg-muted/40 pl-9 pr-9 text-base shadow-none focus-visible:bg-background sm:text-sm lg:h-9"
        placeholder="Número, cliente ou documento"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {q && (
        <button
          type="button"
          onClick={() => setQ("")}
          className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Limpar busca"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function SegmentadoEscopo({
  valor,
  onValor,
  cheio = false,
}: {
  valor: Escopo;
  onValor: (v: Escopo) => void;
  cheio?: boolean;
}) {
  const item = (id: Escopo, rotulo: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={valor === id}
      onClick={() => valor !== id && onValor(id)}
      className={cn(
        "inline-flex h-8 items-center justify-center rounded-[9px] px-3 text-xs font-semibold transition-all",
        cheio ? "h-10 flex-1 text-sm" : "",
        valor === id
          ? "bg-background text-primary shadow-sm ring-1 ring-primary/15"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {rotulo}
    </button>
  );
  return (
    <div
      role="tablist"
      aria-label="Escopo"
      className={cn("flex gap-0.5 rounded-xl bg-muted/70 p-0.5", cheio ? "w-full" : "shrink-0")}
    >
      {item("todas", "Todas")}
      {item("minhas", "Minhas")}
    </div>
  );
}

function EditorPeriodo({
  de,
  ate,
  onMudar,
}: {
  de: string;
  ate: string;
  onMudar: (patch: Partial<FiltrosSimulacoes>) => void;
}) {
  const atual = de && ate ? presetDoPeriodo(de, ate) : null;
  const hoje = hojeEmSaoPaulo();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {(Object.keys(ROTULO_PRESET) as PresetPeriodo[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onMudar(periodoDoPreset(k))}
            className={cn(
              "h-9 rounded-lg border text-xs font-medium transition-colors",
              atual === k
                ? "border-primary/40 bg-primary/8 text-primary"
                : "border-border/70 text-muted-foreground hover:border-primary/30 hover:text-foreground",
            )}
          >
            {ROTULO_PRESET[k]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="periodo-de" className="text-[11px] text-muted-foreground">
            De
          </Label>
          <Input
            id="periodo-de"
            type="date"
            max={ate || hoje}
            value={de}
            onChange={(e) => onMudar({ de: e.target.value })}
            className="h-10 rounded-lg text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="periodo-ate" className="text-[11px] text-muted-foreground">
            Até
          </Label>
          <Input
            id="periodo-ate"
            type="date"
            min={de || undefined}
            max={hoje}
            value={ate}
            onChange={(e) => onMudar({ ate: e.target.value })}
            className="h-10 rounded-lg text-sm"
          />
        </div>
      </div>
      {(de || ate) && (
        <button
          type="button"
          onClick={() => onMudar({ de: "", ate: "" })}
          className="text-xs font-medium text-primary hover:underline"
        >
          Qualquer data
        </button>
      )}
    </div>
  );
}

function PeriodoPopover(props: {
  de: string;
  ate: string;
  onMudar: (patch: Partial<FiltrosSimulacoes>) => void;
}) {
  const rotulo = rotuloPeriodo(props.de, props.ate);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-9 shrink-0 gap-1.5 rounded-lg px-3 text-xs font-medium",
            rotulo ? "border-primary/30 bg-primary/5 text-primary" : "text-muted-foreground",
          )}
        >
          <CalendarRange className="size-4" />
          {rotulo ?? "Período"}
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <EditorPeriodo {...props} />
      </PopoverContent>
    </Popover>
  );
}

function AlternanciaExcluidas({ ativo, onAlternar }: { ativo: boolean; onAlternar: () => void }) {
  return (
    <label
      className={cn(
        "flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-xs font-medium transition-colors",
        ativo ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
      title="Ver simulações excluídas"
    >
      <Trash2 className="size-3.5" />
      Excluídas
      <Switch checked={ativo} onCheckedChange={onAlternar} className="scale-90" aria-label="Ver excluídas" />
    </label>
  );
}

function ChipsAtivos(p: PropsFiltrosLista) {
  const chips: { chave: string; rotulo: string; tirar: () => void }[] = [];
  if (p.q.trim()) chips.push({ chave: "q", rotulo: `“${p.q.trim()}”`, tirar: () => p.setQ("") });
  if (p.filtros.escopo === "minhas")
    chips.push({ chave: "escopo", rotulo: "Minhas", tirar: () => p.onMudar({ escopo: "todas" }) });
  if (p.filtros.escopo === "todas" && p.filtros.resp !== "todos") {
    const u = (p.colegas ?? []).find((c) => c.id === p.filtros.resp);
    chips.push({
      chave: "resp",
      rotulo: `Responsável: ${u?.nome ?? u?.email ?? "escolhido"}`,
      tirar: () => p.onMudar({ resp: "todos" }),
    });
  }
  const per = rotuloPeriodo(p.filtros.de, p.filtros.ate);
  if (per) chips.push({ chave: "periodo", rotulo: per, tirar: () => p.onMudar({ de: "", ate: "" }) });
  if (p.verExcluidas) chips.push({ chave: "excluidas", rotulo: "Excluídas", tirar: p.toggleExcluidas });
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-0.5">
      {chips.map((c) => (
        <span
          key={c.chave}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/20 bg-primary/5 py-0.5 pl-2.5 pr-1 text-xs font-medium text-primary"
        >
          <span className="truncate">{c.rotulo}</span>
          <button
            type="button"
            onClick={c.tirar}
            className="grid size-5 shrink-0 place-items-center rounded-full hover:bg-primary/10"
            aria-label={`Tirar filtro ${c.rotulo}`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          onClick={p.onLimparTudo}
          className="px-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Limpar tudo
        </button>
      )}
    </div>
  );
}
