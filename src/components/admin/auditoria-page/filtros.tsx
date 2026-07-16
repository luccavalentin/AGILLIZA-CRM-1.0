import { Check, ChevronDown, ChevronsUpDown, Download, Filter, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { AuditoriaLinha } from "@/lib/admin/auditoria.functions";
import { exportarCsv, rotuloEntidade, TODOS, type Filtros } from "./helpers";

type OpcoesData = {
  atores?: { id: string; nome: string }[];
  acoes?: { valor: string; rotulo: string }[];
  entidades?: string[];
};

/**
 * Combobox pesquisável para os filtros da Auditoria. Aceita pares
 * {valor, rotulo} e permite limpar a seleção com o ícone X.
 */
function ComboFiltro({
  valor,
  onChange,
  opcoes,
  placeholder,
  vazio = "Nenhum resultado.",
}: {
  valor: string;
  onChange: (v: string) => void;
  opcoes: { valor: string; rotulo: string }[];
  placeholder: string;
  vazio?: string;
}) {
  const [open, setOpen] = useState(false);
  const rotuloAtual = opcoes.find((o) => o.valor === valor)?.rotulo ?? "";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between font-normal pr-9",
              !valor && "text-muted-foreground",
            )}
          >
            <span className="truncate">{rotuloAtual || placeholder}</span>
            {!valor && <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
          </Button>
        </PopoverTrigger>
        {valor && (
          <button
            type="button"
            aria-label="Limpar seleção"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 opacity-60 hover:opacity-100"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onChange("");
            }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar…" />
          <CommandList>
            <CommandEmpty>{vazio}</CommandEmpty>
            <CommandGroup>
              {opcoes.map((o) => (
                <CommandItem
                  key={o.valor}
                  value={`${o.rotulo} ${o.valor}`}
                  onSelect={() => {
                    onChange(o.valor);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      valor === o.valor ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {o.rotulo}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}


export function BarraFiltros({
  rascunho,
  setRascunho,
  aplicar,
  limpar,
  temFiltro,
  qtdFiltros,
  filtrosAbertos,
  setFiltrosAbertos,
  opcoes,
  registros,
}: {
  rascunho: Filtros;
  setRascunho: (updater: (s: Filtros) => Filtros) => void;
  aplicar: () => void;
  limpar: () => void;
  temFiltro: boolean;
  qtdFiltros: number;
  filtrosAbertos: boolean;
  setFiltrosAbertos: (v: boolean) => void;
  opcoes: OpcoesData | undefined;
  registros: AuditoriaLinha[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por ação, entidade ou IP…"
            value={rascunho.busca}
            onChange={(e) => setRascunho((s) => ({ ...s, busca: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && aplicar()}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={aplicar}>
            Buscar
          </Button>
          <Collapsible open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
            <CollapsibleTrigger asChild>
              <Button size="sm" variant="outline">
                <Filter className="mr-2 size-4" />
                Filtros
                {qtdFiltros > 0 && (
                  <Badge className="ml-2 h-5 min-w-5 justify-center px-1.5" variant="secondary">
                    {qtdFiltros}
                  </Badge>
                )}
                <ChevronDown
                  className={cn(
                    "ml-1 size-4 transition-transform",
                    filtrosAbertos && "rotate-180",
                  )}
                />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportarCsv(registros)}
            disabled={registros.length === 0}
          >
            <Download className="mr-2 size-4" />
            Exportar
          </Button>
        </div>
      </div>

      <Collapsible open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
        <CollapsibleContent>
          <div className="border-t border-border p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Data inicial</Label>
                <Input
                  type="date"
                  value={rascunho.dataInicio}
                  onChange={(e) => setRascunho((s) => ({ ...s, dataInicio: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data final</Label>
                <Input
                  type="date"
                  value={rascunho.dataFim}
                  onChange={(e) => setRascunho((s) => ({ ...s, dataFim: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Usuário</Label>
                <ComboFiltro
                  valor={rascunho.userId}
                  onChange={(v) => setRascunho((s) => ({ ...s, userId: v }))}
                  opcoes={(opcoes?.atores ?? []).map((a) => ({ valor: a.id, rotulo: a.nome }))}
                  placeholder="Todos os usuários"
                  vazio="Nenhum usuário encontrado."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo de operação</Label>
                <ComboFiltro
                  valor={rascunho.acao}
                  onChange={(v) => setRascunho((s) => ({ ...s, acao: v }))}
                  opcoes={opcoes?.acoes ?? []}
                  placeholder="Todas as operações"
                  vazio="Nenhuma operação encontrada."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tela / Entidade</Label>
                <ComboFiltro
                  valor={rascunho.entidade}
                  onChange={(v) => setRascunho((s) => ({ ...s, entidade: v }))}
                  opcoes={(opcoes?.entidades ?? []).map((e) => ({
                    valor: e,
                    rotulo: rotuloEntidade(e),
                  }))}
                  placeholder="Todas as telas"
                  vazio="Nenhuma tela encontrada."
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={aplicar}>
                <Filter className="mr-2 size-4" /> Aplicar filtros
              </Button>
              {temFiltro && (
                <Button size="sm" variant="ghost" onClick={limpar}>
                  <X className="mr-2 size-4" /> Limpar
                </Button>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
