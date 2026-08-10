import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, RefreshCw, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { rotuloGatilho } from "@/lib/financeiro/comissoes-gatilhos";
import {
  BASES_CALCULO,
  TIPOS_VINCULO_COMISSAO,
  excluirRegraComissaoUsuario,
  listarRegrasComissaoUsuario,
  resumoRegrasComissaoUsuario,
  type RegraComissaoUsuario,
  type TipoVinculoComissao,
} from "@/lib/financeiro/comissoes-usuario.functions";
import { RegraComissaoUsuarioForm } from "./regra-form";
import { RecalcularComissoesButton } from "./recalcular-button";
import { ExportarFinanceiro } from "@/components/financeiro/exportar-financeiro";

const rotulo = (arr: readonly { valor: string; rotulo: string }[], v: string) =>
  arr.find((i) => i.valor === v)?.rotulo ?? v;

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function RegrasAbas({
  onVerLancamentos,
}: {
  onVerLancamentos?: (usuarioId: string) => void;
} = {}) {
  const [tipo, setTipo] = useState<TipoVinculoComissao>("corretor");
  const [dialog, setDialog] = useState<{ aberto: boolean; regra: RegraComissaoUsuario | null }>({
    aberto: false,
    regra: null,
  });
  const [excluir, setExcluir] = useState<RegraComissaoUsuario | null>(null);
  const qc = useQueryClient();

  const { data: regras, isLoading } = useQuery({
    queryKey: ["fin-com-usr-regras", tipo],
    queryFn: () => listarRegrasComissaoUsuario({ data: { tipo_vinculo: tipo } }),
  });

  const { data: resumos } = useQuery({
    queryKey: ["fin-com-usr-resumo"],
    queryFn: () => resumoRegrasComissaoUsuario({ data: {} } as never),
  });
  const resumoDe = (regraId: string) =>
    (resumos ?? []).find((r) => r.regra_id === regraId) ?? {
      regra_id: regraId,
      qtd: 0,
      a_pagar: 0,
      paga: 0,
      cancelada: 0,
      total: 0,
    };

  const del = useMutation({
    mutationFn: (id: string) => excluirRegraComissaoUsuario({ data: { id } }),
    onSuccess: () => {
      toast.success("Regra excluída.");
      qc.invalidateQueries({ queryKey: ["fin-com-usr-regras"] });
      setExcluir(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao excluir."),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Regras de comissão por usuário</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure percentuais por corretor, imobiliária, analista e demais vínculos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportarFinanceiro
            titulo="Regras de comissão por usuário"
            descricao="Percentuais e bases de cálculo configurados por vínculo."
            meta={[`Vínculo: ${rotulo(TIPOS_VINCULO_COMISSAO, tipo)}`]}
            columns={[
              { key: "usuario", label: "Usuário" },
              { key: "vinculo", label: "Vínculo" },
              { key: "banco", label: "Banco" },
              { key: "gatilho", label: "Gatilho" },
              { key: "base", label: "Base de cálculo" },
              {
                key: "percentual",
                label: "Percentual",
                align: "right" as const,
                format: "pct" as const,
              },
              {
                key: "a_pagar",
                label: "A pagar",
                align: "right" as const,
                format: "brl" as const,
                footer: "sum" as const,
              },
              {
                key: "pago",
                label: "Pago",
                align: "right" as const,
                format: "brl" as const,
                footer: "sum" as const,
              },
              { key: "ativo", label: "Situação" },
            ]}
            rows={(regras ?? []).map((r: any) => {
              const res = resumoDe(r.id);
              return {
                usuario: r.usuario_nome ?? "—",
                vinculo: rotulo(TIPOS_VINCULO_COMISSAO, r.tipo_vinculo),
                banco: r.banco_nome ?? "Todos",
                gatilho: rotuloGatilho(r.gatilho),
                base: rotulo(BASES_CALCULO, r.base_calculo),
                percentual: Number(r.percentual) || 0,
                a_pagar: Number(res.a_pagar) || 0,
                pago: Number(res.paga) || 0,
                ativo: r.ativo ? "Ativa" : "Inativa",
              };
            })}
          />
          <RecalcularComissoesButton />
          <Button onClick={() => setDialog({ aberto: true, regra: null })} size="sm">
            <Plus className="mr-2 size-4" />
            Nova regra
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={tipo} onValueChange={(v) => setTipo(v as TipoVinculoComissao)}>
          <TabsList className="flex w-full flex-wrap gap-1 bg-muted/40 p-1">
            {TIPOS_VINCULO_COMISSAO.map((t) => (
              <TabsTrigger key={t.valor} value={t.valor} className="flex-1 min-w-[120px]">
                {t.rotulo}
              </TabsTrigger>
            ))}
          </TabsList>

          {TIPOS_VINCULO_COMISSAO.map((t) => (
            <TabsContent key={t.valor} value={t.valor} className="mt-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" /> Carregando…
                </div>
              ) : !regras?.length ? (
                <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                  Nenhuma regra cadastrada para {t.rotulo.toLowerCase()}.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Gatilho</TableHead>
                        <TableHead>Base</TableHead>
                        <TableHead className="text-right">%</TableHead>
                        <TableHead>Banco</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">A pagar</TableHead>
                        <TableHead className="text-right">Pago</TableHead>
                        <TableHead className="text-center">Ativo</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {regras.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="font-medium">{r.usuario_nome ?? "—"}</div>
                            <div className="text-xs text-muted-foreground">{r.usuario_email}</div>
                          </TableCell>
                          <TableCell>{rotuloGatilho(r.gatilho)}</TableCell>
                          <TableCell>{rotulo(BASES_CALCULO, r.base_calculo)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {r.percentual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%
                          </TableCell>
                          <TableCell>
                            {r.banco_nome ? (
                              <span className="flex items-center gap-2">
                                <BancoLogo nome={r.banco_nome} size="xs" />
                                {r.banco_nome}
                              </span>
                            ) : (
                              "Todos"
                            )}
                          </TableCell>
                          <TableCell>{r.produto ?? "Todos"}</TableCell>

                          <TableCell className="text-right">
                            <div className="font-medium text-amber-600">
                              {brl(resumoDe(r.id).a_pagar)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {resumoDe(r.id).qtd} lanç.
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium text-emerald-600">
                            {brl(resumoDe(r.id).paga)}
                          </TableCell>
                          <TableCell className="text-center">
                            {r.ativo ? (
                              <Badge variant="secondary">Ativa</Badge>
                            ) : (
                              <Badge variant="outline">Inativa</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {onVerLancamentos ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Ver lançamentos deste usuário"
                                onClick={() => onVerLancamentos(r.usuario_id)}
                              >
                                <Receipt className="size-4" />
                              </Button>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDialog({ aberto: true, regra: r })}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setExcluir(r)}>
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>

      <RegraComissaoUsuarioForm
        aberto={dialog.aberto}
        onFechar={() => setDialog({ aberto: false, regra: null })}
        tipoInicial={tipo}
        regra={dialog.regra}
      />

      <AlertDialog open={!!excluir} onOpenChange={(o) => (!o ? setExcluir(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir regra?</AlertDialogTitle>
            <AlertDialogDescription>
              A regra deixará de valer para novos contratos. Lançamentos já gerados não serão
              alterados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => excluir && del.mutate(excluir.id)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
