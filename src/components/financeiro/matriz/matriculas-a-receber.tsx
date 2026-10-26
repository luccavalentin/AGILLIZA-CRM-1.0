/**
 * Matrículas pedidas por terceiros (frente a4): o que cada solicitante deve à Agilliza.
 * Só leitura no financeiro — o pagamento é registrado na tela de Matrículas, para a mesma
 * receita não ser contada duas vezes.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, FileSearch } from "lucide-react";
import { consultar } from "@/lib/financeiro/cliente";
import { cn } from "@/lib/utils";
import { Carregando, Chip, Erro, dataBR, moeda } from "./base";
import { SecaoCartao } from "./comuns";

interface Solicitante {
  solicitante_chave: string;
  solicitante_nome: string | null;
  solicitante_tipo: "usuario" | "assinante" | "externo";
  matriculas: number;
  matriculas_em_aberto: number;
  valor_total: number;
  valor_pago: number;
  valor_em_aberto: number;
  em_aberto_desde: string | null;
  ultimo_pagamento: string | null;
}
interface Resposta {
  disponivel: boolean;
  solicitantes: Solicitante[];
  totais: { em_aberto: number; pago: number; matriculas_em_aberto: number };
}
interface Item {
  id: string;
  numero_matricula?: string | null;
  cartorio?: string | null;
  cliente?: string | null;
  valor: number;
  reembolsado: boolean;
  concluida_em?: string | null;
  data_solicitacao?: string | null;
  data_pagto_reembolso?: string | null;
}

const TIPO: Record<string, string> = { usuario: "equipe/parceiro", assinante: "assinante", externo: "registro antigo" };

export function MatriculasAReceber() {
  const q = useQuery({ queryKey: ["financeiro", "matriculas-a-receber"], queryFn: () => consultar<Resposta>("matriculasAReceber") });
  const [aberto, setAberto] = useState<string | null>(null);
  if (q.data && !q.data.disponivel) return null;
  const lista = (q.data?.solicitantes ?? []).filter((s) => s.valor_total > 0);
  return (
    <SecaoCartao
      titulo="Matrículas pedidas por terceiros"
      descricao={`Em aberto ${moeda(q.data?.totais.em_aberto)} (${q.data?.totais.matriculas_em_aberto ?? 0} matrículas) · recebido ${moeda(q.data?.totais.pago)}. O pagamento é registrado em Matrículas.`}
      acoes={
        <Link to="/matriculas" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted">
          <FileSearch className="h-3.5 w-3.5" /> Abrir Matrículas
        </Link>
      }
    >
      {q.isLoading ? (
        <Carregando linhas={2} />
      ) : q.error ? (
        <Erro erro={q.error} onTentar={() => q.refetch()} />
      ) : lista.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma matrícula concluída a cobrar.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {lista.map((s) => (
            <li key={s.solicitante_chave} className="py-2">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 text-left text-sm"
                onClick={() => setAberto(aberto === s.solicitante_chave ? null : s.solicitante_chave)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{s.solicitante_nome ?? "Solicitante"}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {TIPO[s.solicitante_tipo] ?? s.solicitante_tipo} · {s.matriculas} matrícula(s)
                    {s.em_aberto_desde ? ` · em aberto desde ${dataBR(s.em_aberto_desde)}` : ""}
                    {s.ultimo_pagamento ? ` · último pagamento ${dataBR(s.ultimo_pagamento)}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className={cn("font-mono tabular-nums", s.valor_em_aberto > 0 ? "text-warning" : "text-success")}>
                    {s.valor_em_aberto > 0 ? moeda(s.valor_em_aberto) : "quitado"}
                  </span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", aberto === s.solicitante_chave && "rotate-180")} />
                </span>
              </button>
              {aberto === s.solicitante_chave && <Detalhe chave={s.solicitante_chave} />}
            </li>
          ))}
        </ul>
      )}
    </SecaoCartao>
  );
}

function Detalhe({ chave }: { chave: string }) {
  const q = useQuery({
    queryKey: ["financeiro", "matriculas-solicitante", chave],
    queryFn: () => consultar<Item[]>("matriculasDoSolicitante", { _chave: chave }),
  });
  if (q.isLoading) return <Carregando linhas={1} />;
  if (q.error) return <Erro erro={q.error} />;
  return (
    <ul className="mt-2 space-y-1 rounded-xl bg-muted/30 p-2 text-xs">
      {(q.data ?? []).map((i) => (
        <li key={i.id} className="flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 truncate">
            Matrícula {i.numero_matricula ?? "—"} {i.cartorio ? `· ${i.cartorio}` : ""} {i.cliente ? `· ${i.cliente}` : ""} ·{" "}
            {dataBR(i.concluida_em ?? i.data_solicitacao ?? null)}
          </span>
          <span className="flex items-center gap-2">
            <span className="font-mono tabular-nums">{moeda(i.valor)}</span>
            <Chip def={i.reembolsado ? { rotulo: `Pago ${dataBR(i.data_pagto_reembolso ?? null)}`, tom: "sucesso" } : { rotulo: "Em aberto", tom: "alerta" }} />
          </span>
        </li>
      ))}
    </ul>
  );
}
