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
    <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-card p-1.5 xl:flex-row xl:items-center xl:justify-between">
      <Tabs value={escopo} onValueChange={(v) => setEscopo(v as "todas" | "minhas")}>
        <TabsList className="h-8 w-full sm:w-auto">
          <TabsTrigger value="todas" className="flex-1 sm:flex-none">
            Gerais
          </TabsTrigger>
          <TabsTrigger value="minhas" className="flex-1 sm:flex-none">
            Minhas
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 w-full pl-9 xl:w-56 2xl:w-64 text-xs"
              placeholder="Número, cliente ou documento"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                onBuscar(); // Busca reativa enquanto digita
              }}
            />
          </div>
        </div>
        {escopo === "todas" && (
          <UsuarioCombobox
            value={responsavel}
            onValueChange={setResponsavel}
            usuarios={colegas ?? []}
            className="h-8 w-full sm:w-44 xl:w-48 shrink-0 text-xs"
          />
        )}
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Input
            type="date"
            aria-label="De"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="h-8 w-[44%] shrink-0 sm:w-28 xl:w-30 text-xs"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            aria-label="Até"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
            className="h-8 w-[44%] shrink-0 sm:w-28 xl:w-30 text-xs"
          />
          <Button variant="ghost" size="sm" className="h-8 shrink-0 text-xs" onClick={onLimpar}>
            Limpar
          </Button>
          <Button
            variant={verExcluidas ? "default" : "outline"}
            size="sm"
            className="h-8 shrink-0 text-xs"
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
