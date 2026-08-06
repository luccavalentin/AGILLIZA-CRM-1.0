import { RotateCcw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsuarioCombobox } from "@/components/operacional/usuario-combobox";
import type { Escopo } from "./helpers";

type Colega = { id: string; nome?: string | null; email?: string | null };

type Props = {
  escopo: Escopo;
  setEscopo: (v: Escopo) => void;
  q: string;
  setQ: (v: string) => void;
  responsavel: string;
  setResponsavel: (v: string) => void;
  colegas: Colega[] | undefined;
  dataInicio: string;
  setDataInicio: (v: string) => void;
  dataFim: string;
  setDataFim: (v: string) => void;
  onLimpar: () => void;
  verExcluidas: boolean;
  setVerExcluidas: (u: (v: boolean) => boolean) => void;
};

export function FiltrosPropostas({
  escopo,
  setEscopo,
  q,
  setQ,
  responsavel,
  setResponsavel,
  colegas,
  dataInicio,
  setDataInicio,
  dataFim,
  setDataFim,
  onLimpar,
  verExcluidas,
  setVerExcluidas,
}: Props) {
  return (
    <Card className="rounded-xl border-border/60 p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-end gap-3">
        <Tabs value={escopo} onValueChange={(v) => setEscopo(v as Escopo)}>
          <TabsList className="h-11 rounded-xl">
            <TabsTrigger value="todas" className="rounded-lg">
              Gerais
            </TabsTrigger>
            <TabsTrigger value="minhas" className="rounded-lg">
              Minhas
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 rounded-xl pl-9 shadow-sm"
            placeholder="Número, cliente ou documento"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {escopo === "todas" && (
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Usuário</Label>
            <UsuarioCombobox
              value={responsavel}
              onValueChange={setResponsavel}
              usuarios={colegas ?? []}
              className="h-11 w-56 rounded-xl"
            />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">De</Label>
          <Input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="h-11 w-[9.5rem] rounded-xl"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Até</Label>
          <Input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="h-11 w-[9.5rem] rounded-xl"
          />
        </div>
        <Button
          variant="ghost"
          className="group h-11 rounded-xl transition-colors hover:bg-primary/5 hover:text-primary"
          onClick={onLimpar}
        >
          <RotateCcw className="mr-1 h-4 w-4 transition-transform duration-300 group-hover:-rotate-180" />{" "}
          Limpar
        </Button>
        <Button
          variant={verExcluidas ? "default" : "outline"}
          className="h-11 rounded-xl"
          onClick={() => setVerExcluidas((v) => !v)}
          title="Ver propostas excluídas"
        >
          <Trash2 className="mr-1.5 h-4 w-4" />
          {verExcluidas ? "Ver ativas" : "Excluídas"}
        </Button>
      </div>
    </Card>
  );
}
