import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SEM_IMOB, titulo } from "./helpers";

type Opcao = { id: string; nome: string };

export function SheetFiltrosAvancados({
  open,
  onOpenChange,
  filtroComercial,
  filtroImob,
  filtroCorr,
  filtroAnalista,
  comerciais,
  imobiliarias,
  corretores,
  analistas,
  filtrando,
  onLimpar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  filtroComercial: string;
  filtroImob: string;
  filtroCorr: string;
  filtroAnalista: string;
  comerciais: Opcao[];
  imobiliarias: Opcao[];
  corretores: Opcao[];
  analistas: Opcao[];
  filtrando: boolean;
  onLimpar: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Filtros avançados</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Filtros ativos
            </p>
            <div className="flex flex-wrap gap-1.5">
              {filtroComercial !== "todos" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  Comercial:{" "}
                  {titulo(comerciais.find((cm) => cm.id === filtroComercial)?.nome ?? "")}
                </span>
              )}
              {filtroImob !== "todas" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  Imobiliária:{" "}
                  {filtroImob === "comercial"
                    ? SEM_IMOB
                    : titulo(imobiliarias.find((i) => i.id === filtroImob)?.nome ?? "")}
                </span>
              )}
              {filtroCorr !== "todos" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  Corretor: {titulo(corretores.find((c) => c.id === filtroCorr)?.nome ?? "")}
                </span>
              )}
              {filtroAnalista !== "todos" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  Analista: {titulo(analistas.find((a) => a.id === filtroAnalista)?.nome ?? "")}
                </span>
              )}
              {!filtrando && (
                <span className="text-xs text-muted-foreground">Nenhum filtro ativo.</span>
              )}
            </div>
          </div>
          {filtrando && (
            <Button variant="outline" onClick={onLimpar} className="w-full gap-2">
              <X className="h-4 w-4" /> Limpar todos os filtros
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
