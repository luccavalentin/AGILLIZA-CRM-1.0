import { Search, Filter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Escopo, Portal, StatusF } from "./tipos";

type EtapaOpt = { codigo: string; nome: string };
type ColegaOpt = { id: string; nome?: string | null; email?: string | null };

type Props = {
  q: string;
  setQ: (v: string) => void;
  onSubmit: () => void;
  etapa: string;
  setEtapa: (v: string) => void;
  responsavel: string;
  setResponsavel: (v: string) => void;
  portal: Portal;
  setPortal: (v: Portal) => void;
  statusF: StatusF;
  setStatusF: (v: StatusF) => void;
  escopo: Escopo;
  setEscopo: (v: Escopo) => void;
  etapas: EtapaOpt[] | undefined;
  colegas: ColegaOpt[] | undefined;
  onLimpar: () => void;
  setPagina: (v: number) => void;
};

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export function FiltrosClientes({
  q,
  setQ,
  onSubmit,
  etapa,
  setEtapa,
  responsavel,
  setResponsavel,
  portal,
  setPortal,
  statusF,
  setStatusF,
  escopo,
  setEscopo,
  etapas,
  colegas,
  onLimpar,
  setPagina,
}: Props) {
  return (
    <Card className="rounded-2xl border-border/60 p-3 shadow-sm sm:p-4">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 rounded-xl bg-muted/40 pl-9"
            placeholder="Buscar por nome, documento ou e-mail..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto_auto]">
          <FilterField label="Etapa">
            <Select
              value={etapa}
              onValueChange={(v) => {
                setEtapa(v);
                setPagina(1);
              }}
            >
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {(etapas ?? []).map((e) => (
                  <SelectItem key={e.codigo} value={e.codigo}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Responsável">
            <Select
              value={responsavel}
              onValueChange={(v) => {
                setResponsavel(v);
                setPagina(1);
              }}
            >
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(colegas ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome ?? c.email ?? "—"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Portal do cliente">
            <Select
              value={portal}
              onValueChange={(v) => {
                setPortal(v as Portal);
                setPagina(1);
              }}
            >
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">App ativo</SelectItem>
                <SelectItem value="inativo">App inativo</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Status">
            <Select
              value={statusF}
              onValueChange={(v) => {
                setStatusF(v as StatusF);
                setPagina(1);
              }}
            >
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>

          <div className="flex items-end">
            <Tabs
              value={escopo}
              onValueChange={(v) => {
                const val = v as Escopo;
                setEscopo(val);
                setPagina(1);
                if (typeof window !== "undefined")
                  localStorage.setItem("clientes:escopo", val);
              }}
            >
              <TabsList className="h-10 rounded-xl">
                <TabsTrigger value="minhas" className="rounded-lg">
                  <Filter className="mr-1 size-3.5" /> Minhas
                </TabsTrigger>
                <TabsTrigger value="geral" className="rounded-lg">
                  Gerais
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              onClick={onLimpar}
              className="h-10 w-full rounded-xl gap-2"
            >
              <RotateCcw className="size-4" /> Limpar
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
