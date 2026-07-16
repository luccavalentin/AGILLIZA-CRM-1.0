/**
 * Barra de filtros da lista de simulações. Extraída sem qualquer
 * alteração visual/comportamental.
 */
import { Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsuarioCombobox } from "@/components/operacional/usuario-combobox";

export function FiltrosLista({
  escopo,
  setEscopo,
  q,
  setQ,
  onBuscar,
  responsavel,
  setResponsavel,
  colegas,
  desde,
  setDesde,
  ate,
  setAte,
  onLimpar,
  verExcluidas,
  toggleExcluidas,
}: {
  escopo: "todas" | "minhas";
  setEscopo: (v: "todas" | "minhas") => void;
  q: string;
  setQ: (v: string) => void;
  onBuscar: () => void;
  responsavel: string;
  setResponsavel: (v: string) => void;
  colegas: any[] | undefined;
  desde: string;
  setDesde: (v: string) => void;
  ate: string;
  setAte: (v: string) => void;
  onLimpar: () => void;
  verExcluidas: boolean;
  toggleExcluidas: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
      <Tabs value={escopo} onValueChange={(v) => setEscopo(v as "todas" | "minhas")}>
        <TabsList className="h-9 w-full lg:w-auto">
          <TabsTrigger value="todas" className="flex-1 lg:flex-none">
            Gerais
          </TabsTrigger>
          <TabsTrigger value="minhas" className="flex-1 lg:flex-none">
            Minhas
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onBuscar();
          }}
        >
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 w-full pl-9 sm:w-60"
              placeholder="Número, cliente ou documento"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" className="h-9 shrink-0">
            Buscar
          </Button>
        </form>
        {escopo === "todas" && (
          <UsuarioCombobox
            value={responsavel}
            onValueChange={setResponsavel}
            usuarios={colegas ?? []}
            className="h-9 w-full sm:w-56"
          />
        )}
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="De"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="h-9 w-full sm:w-36"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            aria-label="Até"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
            className="h-9 w-full sm:w-36"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-9 shrink-0"
            onClick={onLimpar}
          >
            Limpar
          </Button>
          <Button
            variant={verExcluidas ? "default" : "outline"}
            size="sm"
            className="h-9 shrink-0"
            onClick={toggleExcluidas}
            title="Ver simulações excluídas"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {verExcluidas ? "Ver ativas" : "Excluídas"}
          </Button>
        </div>
      </div>
    </div>
  );
}
