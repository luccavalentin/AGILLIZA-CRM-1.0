import { ChevronDown, Download, Filter, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AuditoriaLinha } from "@/lib/admin/auditoria.functions";
import { exportarCsv, TODOS, type Filtros } from "./helpers";

type OpcoesData = {
  atores?: { id: string; nome: string }[];
  acoes?: { valor: string; rotulo: string }[];
  entidades?: string[];
};

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
                <Select
                  value={rascunho.userId || TODOS}
                  onValueChange={(v) =>
                    setRascunho((s) => ({ ...s, userId: v === TODOS ? "" : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODOS}>Todos os usuários</SelectItem>
                    {(opcoes?.atores ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo de operação</Label>
                <Select
                  value={rascunho.acao || TODOS}
                  onValueChange={(v) =>
                    setRascunho((s) => ({ ...s, acao: v === TODOS ? "" : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODOS}>Todas as operações</SelectItem>
                    {(opcoes?.acoes ?? []).map((a) => (
                      <SelectItem key={a.valor} value={a.valor}>
                        {a.rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Entidade</Label>
                <Select
                  value={rascunho.entidade || TODOS}
                  onValueChange={(v) =>
                    setRascunho((s) => ({ ...s, entidade: v === TODOS ? "" : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODOS}>Todas as entidades</SelectItem>
                    {(opcoes?.entidades ?? []).map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
