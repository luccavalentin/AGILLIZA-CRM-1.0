/** Ganchos e controles reaproveitados pelas telas do financeiro da matriz. */
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { MoreHorizontal, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { consultar } from "@/lib/financeiro/cliente";
import type { Cadastros } from "@/lib/financeiro/tipos";
import { cn } from "@/lib/utils";
import { moeda } from "./base";

export function useCadastros() {
  return useQuery({
    queryKey: ["financeiro", "cadastros"],
    queryFn: () => consultar<Cadastros>("cadastros"),
    staleTime: 60_000,
  });
}

/** Valor com atraso (busca enquanto digita). */
export function useAtrasado<T>(valor: T, ms = 300): T {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return v;
}

export interface ItemMenuAcao {
  rotulo: string;
  icone: LucideIcon;
  onClick: () => void;
  oculto?: boolean;
  perigo?: boolean;
  separarAntes?: boolean;
}

export function MenuAcoes({ itens }: { itens: ItemMenuAcao[] }) {
  const visiveis = itens.filter((i) => !i.oculto);
  if (!visiveis.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Ações">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {visiveis.map((i, n) => (
          <div key={i.rotulo}>
            {i.separarAntes && n > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={i.onClick} className={cn("gap-2", i.perigo && "text-destructive focus:text-destructive")}>
              <i.icone className="h-4 w-4" /> {i.rotulo}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CampoBusca({ valor, onChange, placeholder }: { valor: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div data-tour="financeiro-busca" className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={valor} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 pl-8" />
    </div>
  );
}

export interface PropostaResumo {
  id: string;
  numero_proposta: string;
  nome_cliente: string | null;
  nome_banco: string | null;
  produto: string | null;
  valor_financiamento: number | null;
  valor_financiamento_aprovado: number | null;
  status: string;
}

/** Procura proposta pelo número ou cliente (com a permissão de proposta da pessoa). */
export function BuscaProposta({
  valor,
  onEscolher,
}: {
  valor: PropostaResumo | null;
  onEscolher: (p: PropostaResumo | null) => void;
}) {
  const [termo, setTermo] = useState("");
  const t = useAtrasado(termo.trim());
  const q = useQuery({
    queryKey: ["financeiro", "busca-proposta", t],
    enabled: t.length >= 2 && !valor,
    queryFn: async () => {
      const limpo = t.replace(/[%,()]/g, " ");
      const { data, error } = await supabase
        .from("propostas")
        .select("id, numero_proposta, nome_cliente, nome_banco, produto, valor_financiamento, valor_financiamento_aprovado, status")
        .or(`numero_proposta.ilike.%${limpo}%,nome_cliente.ilike.%${limpo}%`)
        .is("deleted_at", null)
        .limit(8);
      if (error) throw new Error("Não foi possível buscar propostas.");
      return (data ?? []) as unknown as PropostaResumo[];
    },
  });
  if (valor) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
        <span className="min-w-0 truncate">
          <b>{valor.numero_proposta}</b> · {valor.nome_cliente ?? "Cliente"} · {valor.nome_banco ?? ""}
        </span>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onEscolher(null)}>
          Trocar
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Número da proposta ou nome do cliente" />
      {q.data && q.data.length > 0 && (
        <ul className="max-h-48 overflow-y-auto rounded-xl border border-border/70 bg-card p-1 text-sm shadow-sm">
          {q.data.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-muted"
                onClick={() => {
                  onEscolher(p);
                  setTermo("");
                }}
              >
                <span className="min-w-0 truncate">
                  <b>{p.numero_proposta}</b> · {p.nome_cliente ?? "Cliente"}
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  {moeda(p.valor_financiamento_aprovado ?? p.valor_financiamento ?? 0)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {t.length >= 2 && q.data?.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma proposta encontrada.</p>}
    </div>
  );
}

export function SecaoCartao({
  titulo,
  descricao,
  acoes,
  children,
  tour,
}: {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
  children: ReactNode;
  /** Âncora do tour guiado (`data-tour`); não muda nada na tela. */
  tour?: string;
}) {
  return (
    <section data-tour={tour} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="inline-block h-4 w-1 rounded-full bg-primary" />
            {titulo}
          </h2>
          {descricao && <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>}
        </div>
        {acoes}
      </div>
      {children}
    </section>
  );
}
