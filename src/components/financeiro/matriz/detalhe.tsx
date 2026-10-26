/**
 * Gaveta de detalhe de qualquer lançamento: dados, pagamentos (com estorno), anexos e a
 * trilha de auditoria (quem, quando, antes/depois, motivo).
 */
import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, History, Link2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { consultar, executarOuFalhar, invalidarFinanceiro } from "@/lib/financeiro/cliente";
import type { DetalheLancamento, EventoTrilha, Natureza } from "@/lib/financeiro/tipos";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { abrirAnexo } from "./anexos";
import { Carregando, Erro, dataBR, moeda } from "./base";
import { DialogoMotivo } from "./dialogos";

const ACOES: Record<string, string> = {
  insert: "Criado",
  update: "Alterado",
  delete: "Excluído",
  previsao_gerada: "Previsão gerada pelo gatilho",
  lancamento_manual: "Lançado à mão",
  valor_informado: "Valor informado pelo banco",
  previsao_corrigida: "Previsão corrigida",
  contestada: "Contestado",
  contestacao_resolvida: "Contestação resolvida",
  cancelada: "Cancelado",
  encerrada_com_diferenca: "Encerrado com diferença",
  recebimento_registrado: "Recebimento registrado",
  pagamento_registrado: "Pagamento registrado",
  estornada: "Estorno",
  aprovada_para_pagamento: "Aprovado para pagamento",
  ajustada: "Ajustado",
  base_confirmada: "Base confirmada (banco pagou)",
  criada: "Criado",
  editada: "Editado",
  rascunho_conferido: "Rascunho do boleto conferido",
  conciliada: "Conciliado com o extrato",
  conciliacao_desfeita: "Conciliação desfeita",
  anexo_enviado: "Arquivo anexado",
  migracao: "Migrado do financeiro antigo",
};

const CAMPOS: Record<string, string> = {
  valor_bruto: "Previsto",
  valor_informado: "Informado",
  valor_recebido: "Recebido",
  valor_comissao: "Valor",
  valor_pago: "Pago",
  valor: "Valor",
  situacao: "Situação",
  status: "Status",
  vencimento: "Vencimento",
  descricao: "Descrição",
  estornada_em: "Estornado em",
  rascunho: "Rascunho",
};

function textoCampo(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") return v.toLocaleString("pt-BR");
  if (typeof v === "boolean") return v ? "sim" : "não";
  return String(v).slice(0, 80);
}

function Trilha({ eventos }: { eventos: EventoTrilha[] }) {
  if (!eventos.length) return <p className="text-xs text-muted-foreground">Sem registros.</p>;
  return (
    <ol className="relative space-y-3 border-l border-border pl-4">
      {eventos.map((e, i) => {
        const chaves = Object.keys(e.depois ?? {}).filter((k) => CAMPOS[k]);
        return (
          <li key={i} className="relative">
            <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
            <p className="text-xs font-semibold text-foreground">{ACOES[e.acao] ?? e.acao}</p>
            <p className="text-[11px] text-muted-foreground">
              {new Date(e.quando).toLocaleString("pt-BR")} · {e.quem ?? "Sistema"}
            </p>
            {e.motivo && <p className="mt-0.5 text-[11px] italic text-foreground">“{e.motivo}”</p>}
            {chaves.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                {chaves.slice(0, 5).map((k) => (
                  <li key={k}>
                    {CAMPOS[k]}: <s>{textoCampo(e.antes?.[k])}</s> → <b className="text-foreground">{textoCampo(e.depois?.[k])}</b>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function GavetaLancamento({
  natureza,
  id,
  titulo,
  onFechar,
  acoes,
  resumo,
  podeEstornar,
}: {
  natureza: Exclude<Natureza, "repasse_assinante" | "matricula">;
  id: string | null;
  titulo: string;
  onFechar: () => void;
  acoes?: ReactNode;
  resumo?: ReactNode;
  podeEstornar?: boolean;
}) {
  const qc = useQueryClient();
  const [estornar, setEstornar] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["financeiro", "detalhe", natureza, id],
    queryFn: () => consultar<DetalheLancamento>("detalhe", { _natureza: natureza, _id: id }),
    enabled: !!id,
  });
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{titulo}</SheetTitle>
          <SheetDescription>{q.data?.descricao ?? "Detalhe do lançamento"}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-5">
          {resumo}
          {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
          {q.isLoading ? (
            <Carregando linhas={3} />
          ) : q.error ? (
            <Erro erro={q.error} onTentar={() => q.refetch()} />
          ) : q.data ? (
            <>
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recebimentos e pagamentos</h3>
                {q.data.baixas.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nada registrado ainda.</p>
                ) : (
                  <ul className="space-y-2">
                    {q.data.baixas.map((b) => (
                      <li
                        key={b.id}
                        className={`rounded-xl border p-3 text-sm ${b.estornada_em ? "border-dashed border-border opacity-60" : "border-border/70 bg-card"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-semibold tabular-nums">{moeda(b.valor)}</span>
                          <span className="text-xs text-muted-foreground">{dataBR(b.data)}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {[b.forma, b.conta, b.documento, b.origem === "conciliacao" ? "pela conciliação" : b.origem === "migracao" ? "migrado" : null]
                            .filter(Boolean)
                            .join(" · ")}
                          {b.registrado_por ? ` · por ${b.registrado_por}` : ""}
                        </p>
                        {b.estornada_em && <p className="mt-1 text-[11px] text-destructive">Estornado: {b.estorno_motivo}</p>}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {b.anexo && (
                            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => abrirAnexo(b.anexo!.caminho).catch((e) => toast.error(e.message))}>
                              <FileText className="h-3.5 w-3.5" /> Comprovante
                            </Button>
                          )}
                          {b.conciliada && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                              <Link2 className="h-3 w-3" /> Conciliado
                            </span>
                          )}
                          {podeEstornar && !b.estornada_em && !b.conciliada && (
                            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-destructive" onClick={() => setEstornar(b.id)}>
                              <Undo2 className="h-3.5 w-3.5" /> Estornar
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {q.data.anexos.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documentos</h3>
                  <ul className="space-y-1.5">
                    {q.data.anexos.map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-left text-xs hover:border-primary/40"
                          onClick={() => abrirAnexo(a.caminho).catch((e) => toast.error(e.message))}
                        >
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="min-w-0 flex-1 truncate">{a.nome}</span>
                          <span className="text-muted-foreground">{dataBR(a.enviado_em)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {q.data.trilha && (
                <section>
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <History className="h-3.5 w-3.5" /> Trilha
                  </h3>
                  <Trilha eventos={q.data.trilha} />
                </section>
              )}
            </>
          ) : null}
        </div>
        <DialogoMotivo
          aberto={!!estornar}
          titulo="Estornar este registro"
          descricao="O valor volta a ficar em aberto. O registro original continua na trilha."
          confirmar="Estornar"
          perigo
          onFechar={() => setEstornar(null)}
          onConfirmar={async (motivo) => {
            try {
              await executarOuFalhar("estornar", { _id: estornar, _motivo: motivo });
              toast.success("Estornado.");
              await invalidarFinanceiro(qc);
            } catch (e) {
              throw new Error(mensagemDeErro(e, "Não foi possível estornar."));
            }
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
