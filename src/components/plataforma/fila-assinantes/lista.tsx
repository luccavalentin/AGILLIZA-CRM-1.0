import { useState } from "react";
import { ChevronRight, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { formatBRL, formatData } from "@/lib/financeiro/format";
import type { PropostaAssinante } from "@/lib/plataforma/fila.functions";
import { MiniEsteiraAssinante } from "@/components/plataforma/propostas-grupo/esteira";
import { rotuloIdH } from "@/components/plataforma/propostas-grupo/filtros";
import { AcoesLinha, DesignarDialog, DevolverDialog, SeloSituacao } from "./acoes";
import { DetalhePropostaSheet } from "./detalhe";

const valor = (p: PropostaAssinante) => formatBRL(Number(p.valor_financiamento) || 0);
const tipoConta = (p: PropostaAssinante) =>
  p.conta_tipo === "imobiliaria" ? "Imobiliária" : "Corretor";

/**
 * Identificação da proposta (C33): o que aparece é o "ID H." (oportunidade na integração); o
 * código da conta fica discreto, porque é por ele que o assinante fala da proposta. O número
 * interno do Agilliza (PRO-…) não aparece mais — no lugar, o selo "No Agilliza".
 */
function Identificacao({ p, compacto }: { p: PropostaAssinante; compacto?: boolean }) {
  return (
    <span className="min-w-0">
      <span className="block font-semibold tabular-nums text-foreground">{rotuloIdH(p.id_h)}</span>
      <span className="block truncate text-xs text-muted-foreground">
        Cód. na conta {p.codigo}
        {compacto ? ` · ${formatData(p.criado_em)}` : ""}
        {p.no_agilliza ? (
          <span className="ml-1.5 inline-flex items-center rounded-md bg-primary/8 px-1.5 py-px text-[10px] font-semibold text-primary ring-1 ring-inset ring-primary/15">
            No Agilliza
          </span>
        ) : null}
      </span>
    </span>
  );
}

/**
 * Propostas dos assinantes com as ações da fila: tabela no computador, cartões no
 * celular. Clicar abre o painel com tudo o que o assinante mandou.
 */
export function PropostasAssinantesInterativas({
  propostas,
  carregando,
  erro,
  vazio,
  mostrarConta = true,
}: {
  propostas: PropostaAssinante[];
  carregando: boolean;
  erro?: string | null;
  vazio: string;
  mostrarConta?: boolean;
}) {
  const [aberta, setAberta] = useState<PropostaAssinante | null>(null);
  const [designando, setDesignando] = useState<PropostaAssinante | null>(null);
  const [devolvendo, setDevolvendo] = useState<PropostaAssinante | null>(null);
  // O painel acompanha a lista recarregada (ex.: depois de assumir ou designar).
  const atual = aberta ? (propostas.find((p) => p.id === aberta.id) ?? aberta) : null;

  const estado = carregando ? (
    <Skeleton className="h-10 w-full" />
  ) : erro ? (
    <p className="text-sm text-destructive">{erro}</p>
  ) : propostas.length === 0 ? (
    <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
      <Inbox className="size-6" />
      {vazio}
    </div>
  ) : null;

  return (
    <>
      {/* Celular: cartões */}
      <div className="space-y-3 md:hidden">
        {estado && <div className="rounded-2xl border border-border/60 bg-card p-4">{estado}</div>}
        {!estado &&
          propostas.map((p) => (
            <article key={p.id} className="rounded-2xl border border-border/60 bg-card shadow-sm">
              <button
                type="button"
                onClick={() => setAberta(p)}
                className="flex w-full items-start gap-3 p-4 text-left"
                aria-label={`Ver os dados da proposta ${rotuloIdH(p.id_h)} (${p.codigo})`}
              >
                <BancoLogo nome={p.banco} size="md" className="mt-0.5" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold">{p.cliente}</p>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </div>
                  <Identificacao p={p} compacto />
                  {mostrarConta && (
                    <p className="truncate text-xs text-muted-foreground">
                      {p.conta} · {tipoConta(p)}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-sm font-semibold tabular-nums">{valor(p)}</span>
                    <SeloSituacao status={p.status} atrasada={p.atrasada} banco={p.banco} />
                  </div>
                  <MiniEsteiraAssinante status={p.status} className="pt-1" />
                </div>
              </button>
              <div className="border-t border-border/60 p-3">
                <AcoesLinha
                  cheio
                  proposta={p}
                  onAbrir={() => setAberta(p)}
                  onDesignar={() => setDesignando(p)}
                />
              </div>
            </article>
          ))}
      </div>

      {/* Computador: tabela */}
      <div className="hidden overflow-x-auto rounded-2xl border border-border/60 bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proposta</TableHead>
              {mostrarConta && <TableHead>Conta</TableHead>}
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden lg:table-cell">Banco</TableHead>
              <TableHead className="text-right">Financiamento</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="hidden 2xl:table-cell">Etapa</TableHead>
              <TableHead className="hidden xl:table-cell">Analista</TableHead>
              <TableHead className="w-[1%] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {estado && (
              <TableRow>
                <TableCell colSpan={9} className="text-center">
                  {estado}
                </TableCell>
              </TableRow>
            )}
            {!estado &&
              propostas.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => setAberta(p)}
                  title="Ver os dados da proposta"
                >
                  <TableCell>
                    <Identificacao p={p} />
                    <p className="text-xs text-muted-foreground">
                      {formatData(p.criado_em)}
                      {p.usuario_origem ? ` · por ${p.usuario_origem}` : ""}
                    </p>
                  </TableCell>
                  {mostrarConta && (
                    <TableCell>
                      {p.conta}
                      <span className="block text-xs text-muted-foreground">{tipoConta(p)}</span>
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{p.cliente}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="inline-flex items-center gap-2">
                      <BancoLogo nome={p.banco} size="sm" />
                      {p.banco ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{valor(p)}</TableCell>
                  <TableCell>
                    <SeloSituacao status={p.status} atrasada={p.atrasada} banco={p.banco} />
                  </TableCell>
                  <TableCell className="hidden 2xl:table-cell">
                    <MiniEsteiraAssinante status={p.status} />
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    {p.analista ?? <span className="text-muted-foreground">Sem analista</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <AcoesLinha
                      className="justify-end"
                      proposta={p}
                      onAbrir={() => setAberta(p)}
                      onDesignar={() => setDesignando(p)}
                    />
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <DetalhePropostaSheet
        proposta={atual}
        onFechar={() => setAberta(null)}
        onDesignar={(p) => setDesignando(p)}
        onDevolver={(p) => setDevolvendo(p)}
      />
      <DesignarDialog proposta={designando} onFechar={() => setDesignando(null)} />
      <DevolverDialog proposta={devolvendo} onFechar={() => setDevolvendo(null)} />
    </>
  );
}
