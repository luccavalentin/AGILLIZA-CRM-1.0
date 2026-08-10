import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ContaTipo } from "@/lib/financeiro/financeiro.functions";

const STATUS_OPCOES = ["aberta", "parcial", "paga", "atrasada", "cancelada", "estornada"];

export interface ContasFiltrosProps {
  tipo: ContaTipo;
  status: string;
  onStatus: (v: string) => void;
  categoriaId: string;
  onCategoriaId: (v: string) => void;
  categorias: Array<{ id: string; nome: string }>;
  de: string;
  onDe: (v: string) => void;
  ate: string;
  onAte: (v: string) => void;
  contraparte: string;
  onContraparte: (v: string) => void;
  onSubmitBusca: () => void;
  temFiltro: boolean;
  onLimpar: () => void;
}

/**
 * Barra de filtros das contas: status, categoria, período de vencimento e
 * busca por contraparte. Estado permanece na página; este componente é
 * apenas visual/controlado.
 */
export function ContasFiltros({
  tipo,
  status,
  onStatus,
  categoriaId,
  onCategoriaId,
  categorias,
  de,
  onDe,
  ate,
  onAte,
  contraparte,
  onContraparte,
  onSubmitBusca,
  temFiltro,
  onLimpar,
}: ContasFiltrosProps) {
  return (
    <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-primary/[0.03] p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        <SlidersHorizontal className="h-3.5 w-3.5 text-primary/70" />
        Filtros
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Status</span>
          <Select value={status || "all"} onValueChange={(v) => onStatus(v === "all" ? "" : v)}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {STATUS_OPCOES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Categoria</span>
          <Select
            value={categoriaId || "all"}
            onValueChange={(v) => onCategoriaId(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categorias.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Vencimento de</span>
          <Input
            type="date"
            className="w-36 sm:w-40"
            value={de}
            onChange={(e) => onDe(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            className="w-36 sm:w-40"
            value={ate}
            onChange={(e) => onAte(e.target.value)}
          />
        </div>
        <form
          className="flex flex-1 flex-col gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmitBusca();
          }}
        >
          <span className="text-xs text-muted-foreground">
            {tipo === "pagar" ? "Fornecedor" : "Pagador"}
          </span>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="w-full pl-9 sm:w-56"
                placeholder={tipo === "pagar" ? "Buscar fornecedor" : "Buscar pagador"}
                value={contraparte}
                onChange={(e) => onContraparte(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary">
              Filtrar
            </Button>
          </div>
        </form>
        {temFiltro && (
          <Button variant="ghost" onClick={onLimpar}>
            Limpar
          </Button>
        )}
      </div>
    </div>
  );
}
