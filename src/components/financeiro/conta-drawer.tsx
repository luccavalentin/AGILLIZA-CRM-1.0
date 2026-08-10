import { useQuery } from "@tanstack/react-query";
import { obterConta, type ContaTipo } from "@/lib/financeiro/financeiro.functions";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ContaStatusBadge } from "@/components/financeiro/status-badge";
import { formatBRL, formatData } from "@/lib/financeiro/format";
import { Paperclip } from "lucide-react";

const eventoLabel: Record<string, string> = {
  criada: "Conta criada",
  baixa_total: "Quitação total",
  baixa_parcial: "Baixa parcial",
  estornada: "Estorno",
  cancelada: "Cancelamento",
};

function eventoTone(evento: string): string {
  if (evento.startsWith("baixa")) return "text-success";
  if (evento === "estornada" || evento === "cancelada") return "text-destructive";
  if (evento === "criada") return "text-primary";
  return "text-muted-foreground";
}

/** Deriva "atrasada" a partir do vencimento, alinhado à listagem. */
function statusEfetivoUI(status: string, vencimento?: string | null): string {
  if ((status === "aberta" || status === "parcial") && vencimento) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (new Date(vencimento + "T00:00:00") < hoje) return "atrasada";
  }
  return status;
}

export function ContaDrawer({
  tipo,
  contaId,
  open,
  onOpenChange,
}: {
  tipo: ContaTipo;
  contaId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["fin-conta", tipo, contaId],
    queryFn: () => obterConta({ data: { tipo, id: contaId! } }),
    enabled: open && !!contaId,
  });

  const conta = data?.conta;
  const historico = data?.historico ?? [];
  const baixas = historico.filter((h: any) => h.evento?.startsWith("baixa"));
  const estornos = historico.filter(
    (h: any) => h.evento === "estornada" || h.evento === "cancelada",
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {conta?.numero ?? "Conta"}
            {conta && <ContaStatusBadge status={statusEfetivoUI(conta.status, conta.vencimento)} />}
          </SheetTitle>
        </SheetHeader>

        {isLoading && <p className="p-4 text-sm text-muted-foreground">Carregando…</p>}

        {conta && (
          <Tabs defaultValue="dados" className="mt-4">
            <TabsList className="w-full">
              <TabsTrigger value="dados" className="flex-1">
                Dados
              </TabsTrigger>
              <TabsTrigger value="anexos" className="flex-1">
                Anexos
              </TabsTrigger>
              <TabsTrigger value="baixas" className="flex-1">
                Baixas
              </TabsTrigger>
              <TabsTrigger value="estornos" className="flex-1">
                Estornos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-3 pt-4">
              <Linha label="Descrição" valor={conta.descricao} />
              <Linha
                label={tipo === "pagar" ? "Fornecedor" : "Pagador"}
                valor={conta.fornecedor ?? conta.pagador ?? "—"}
              />
              <Linha label="Categoria" valor={conta.categoria?.nome ?? "—"} />
              <Linha label="Centro de custo" valor={conta.centro?.nome ?? "—"} />
              <Linha label="Vencimento" valor={formatData(conta.vencimento)} />
              <Linha label="Valor" valor={formatBRL(Number(conta.valor))} />
              <Linha label="Pago" valor={formatBRL(Number(conta.valor_pago))} />

              <div className="border-t border-border pt-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Linha do tempo
                </p>
                <ul className="space-y-2">
                  {historico.map((h: any) => (
                    <li key={h.id} className="text-sm">
                      <span className={`font-medium ${eventoTone(h.evento)}`}>
                        {eventoLabel[h.evento] ?? h.evento}
                      </span>
                      {h.valor != null && (
                        <span className="tabular-nums text-muted-foreground">
                          {" "}
                          · {formatBRL(Number(h.valor))}
                        </span>
                      )}
                      <span className="text-muted-foreground"> · {formatData(h.created_at)}</span>
                      {h.descricao && (
                        <p className="text-xs text-muted-foreground">{h.descricao}</p>
                      )}
                    </li>
                  ))}
                  {historico.length === 0 && (
                    <li className="text-sm text-muted-foreground">Sem eventos.</li>
                  )}
                </ul>
              </div>
            </TabsContent>

            <TabsContent value="anexos" className="pt-4">
              {conta.comprovante_path ? (
                <div className="flex items-center gap-2 rounded-md border border-dashed border-border p-3 text-sm">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{conta.comprovante_path.split("/").pop()}</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum comprovante anexado.</p>
              )}
            </TabsContent>

            <TabsContent value="baixas" className="space-y-2 pt-4">
              {baixas.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma baixa registrada.</p>
              )}
              {baixas.map((h: any) => (
                <div key={h.id} className="flex justify-between text-sm">
                  <span className="text-success">{eventoLabel[h.evento]}</span>
                  <span className="tabular-nums">
                    {formatBRL(Number(h.valor ?? 0))} · {formatData(h.created_at)}
                  </span>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="estornos" className="space-y-2 pt-4">
              {estornos.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum estorno/cancelamento.</p>
              )}
              {estornos.map((h: any) => (
                <div key={h.id} className="text-sm">
                  <span className="text-destructive">{eventoLabel[h.evento]}</span> ·{" "}
                  {formatData(h.created_at)}
                  {h.descricao && <p className="text-xs text-muted-foreground">{h.descricao}</p>}
                </div>
              ))}
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Linha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{valor}</span>
    </div>
  );
}
