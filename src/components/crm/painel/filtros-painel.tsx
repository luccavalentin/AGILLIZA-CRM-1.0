import { useState } from "react";
import { Users, Search, X, Filter, Check, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface Props {
  totalClientes: number;
  totalEtapas: number;
  periodo: string;
  respFiltro: string;
  analistaFiltro: string;
  corretorFiltro: string;
  imobFiltro: string;
  busca: string;
  desde: string;
  ate: string;
  responsaveis: string[];
  analistas: string[];
  corretores: string[];
  imobiliarias: string[];
  onPeriodo: (v: string) => void;
  onResp: (v: string) => void;
  onAnalista: (v: string) => void;
  onCorretor: (v: string) => void;
  onImob: (v: string) => void;
  onBusca: (v: string) => void;
  onDesde: (v: string) => void;
  onAte: (v: string) => void;
  onLimpar: () => void;
}

/** Barra de filtros do painel da esteira. */
export function FiltrosPainel(p: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm sm:rounded-2xl sm:p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
        <div className="flex min-w-0 items-center gap-3 md:border-r md:border-border md:pr-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary sm:size-11">
            <Users className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-2xl font-bold leading-none tabular-nums text-foreground">
              {p.totalClientes}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              de {p.totalEtapas} etapas
            </p>
          </div>
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          <SelectCampo label="Período" value={p.periodo} onChange={p.onPeriodo}>
            <option value="todos">Todos</option>
            <option value="mes">Este mês</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="ano">Este ano</option>
            <option value="custom">Personalizado</option>
          </SelectCampo>

          <ComboFiltro
            label="Responsável"
            value={p.respFiltro}
            onChange={p.onResp}
            opcoes={p.responsaveis}
            placeholder="Buscar responsável..."
          />
          <ComboFiltro
            label="Analista"
            value={p.analistaFiltro}
            onChange={p.onAnalista}
            opcoes={p.analistas}
            placeholder="Buscar analista..."
          />
          <ComboFiltro
            label="Corretor"
            value={p.corretorFiltro}
            onChange={p.onCorretor}
            opcoes={p.corretores}
            placeholder="Buscar corretor..."
          />
          <ComboFiltro
            label="Imobiliária"
            value={p.imobFiltro}
            onChange={p.onImob}
            opcoes={p.imobiliarias}
            placeholder="Buscar imobiliária..."
          />

          <div className="relative min-w-0 space-y-1 sm:col-span-2 md:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">Buscar</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={p.busca}
                onChange={(e) => p.onBusca(e.target.value)}
                placeholder="Cliente ou nº..."
                className="h-10 w-full rounded-xl pl-9 pr-9 shadow-sm"
              />
              {p.busca && (
                <button
                  type="button"
                  onClick={() => p.onBusca("")}
                  className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Limpar busca"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="min-w-0 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">De</label>
            <Input
              type="date"
              value={p.desde}
              onChange={(e) => p.onDesde(e.target.value)}
              className="h-10 w-full rounded-xl shadow-sm"
            />
          </div>
          <div className="min-w-0 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Até</label>
            <Input
              type="date"
              value={p.ate}
              onChange={(e) => p.onAte(e.target.value)}
              className="h-10 w-full rounded-xl shadow-sm"
            />
          </div>
        </div>

        <Button
          variant="ghost"
          className="h-10 shrink-0 justify-center gap-2 text-primary hover:bg-primary/5 hover:text-primary md:self-end"
          onClick={p.onLimpar}
        >
          Limpar filtros
          <Filter className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function SelectCampo({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
      </select>
    </div>
  );
}

/** Combobox com pesquisa. Mostra todas as opções cadastradas mesmo sem cards. */
function ComboFiltro({
  label,
  value,
  onChange,
  opcoes,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  opcoes: string[];
  placeholder: string;
}) {
  const [aberto, setAberto] = useState(false);
  const rotulo = value === "todos" ? "Todos" : value;
  return (
    <div className="min-w-0 space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={aberto}
            className={cn(
              "flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background px-3 text-left text-sm shadow-sm outline-none transition-colors",
              "hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring",
              value === "todos" && "text-muted-foreground",
            )}
          >
            <span className="truncate">{rotulo}</span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command
            filter={(itemValue, search) =>
              itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
            }
          >
            <CommandInput placeholder={placeholder} className="h-9" />
            <CommandList>
              <CommandEmpty>Nenhum resultado.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="todos"
                  onSelect={() => {
                    onChange("todos");
                    setAberto(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      value === "todos" ? "opacity-100" : "opacity-0",
                    )}
                  />
                  Todos
                </CommandItem>
                {opcoes.map((o) => (
                  <CommandItem
                    key={o}
                    value={o}
                    onSelect={() => {
                      onChange(o);
                      setAberto(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        value === o ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{o}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
