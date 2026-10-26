/**
 * Gaveta "Percentuais da comissão" (Comissões dos assinantes): o padrão para todas as contas
 * e o percentual próprio de algumas. Só a tela: quem calcula e guarda é o banco
 * (`plataforma.definir_comissao_assinante`, regra da frente do financeiro).
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Percent, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, IconeGestao, Secao } from "@/components/plataforma/kit";
import { TIPO_CONTA } from "@/components/plataforma/receita/comum";
import { useValorAssentado } from "@/components/plataforma/paginacao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import {
  contasParaComissao,
  definirComissaoAssinante,
} from "@/lib/plataforma/comissoes-assinantes.functions";

export const pct = (n: number) => `${Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%`;
const numero = (v: string) => Number(v.replace(",", "."));
const valido = (v: string) => v.trim() !== "" && numero(v) >= 0 && numero(v) <= 10;

export function GavetaPercentuais({
  aberta,
  aoFechar,
  padrao,
  porConta,
}: {
  aberta: boolean;
  aoFechar: () => void;
  padrao: number;
  porConta: { tenant_id: string; conta: string; tipo: string; percentual: number }[];
}) {
  const qc = useQueryClient();
  const definirFn = useServerFn(definirComissaoAssinante);
  const contasFn = useServerFn(contasParaComissao);
  const [valorPadrao, setValorPadrao] = useState(String(padrao).replace(".", ","));
  const [busca, setBusca] = useState("");
  const termo = useValorAssentado(busca.trim());
  const [conta, setConta] = useState<{ id: string; nome: string } | null>(null);
  const [valorConta, setValorConta] = useState("");
  const contas = useQuery({
    queryKey: ["plataforma-comissoes-contas", termo],
    queryFn: () => contasFn({ data: { busca: termo } }),
    enabled: aberta && termo.length >= 2 && !conta,
  });

  const salvar = useMutation({
    mutationFn: (p: { tenantId: string | null; percentual: number | null }) => definirFn({ data: p }),
    onSuccess: () => {
      toast.success("Percentual salvo. Vale para os próximos registros; as comissões já criadas não mudam.");
      qc.invalidateQueries({ queryKey: ["plataforma-comissoes"] });
      setConta(null);
      setBusca("");
      setValorConta("");
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível salvar.")),
  });

  return (
    <Sheet open={aberta} onOpenChange={(v) => !v && aoFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <IconeGestao icone={<Percent />} />
            <div className="text-left">
              <SheetTitle>Percentuais da comissão</SheetTitle>
              <SheetDescription>
                Mudar vale para os próximos registros. As comissões já criadas guardam o percentual do dia.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-4">
          <Secao titulo="Padrão para todas as contas">
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="cm-padrao">Percentual</Label>
                <div className="relative w-32">
                  <Input
                    id="cm-padrao"
                    inputMode="decimal"
                    className="pr-8 text-right tabular-nums"
                    value={valorPadrao}
                    onChange={(e) => setValorPadrao(e.target.value)}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
              </div>
              <Button
                className="min-h-11 sm:min-h-10"
                disabled={salvar.isPending || !valido(valorPadrao)}
                onClick={() => salvar.mutate({ tenantId: null, percentual: numero(valorPadrao) })}
              >
                Salvar padrão
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">De 0 a 10% do valor financiado.</p>
          </Secao>

          <Secao
            titulo="Percentual próprio de uma conta"
            descricao={
              porConta.length
                ? `${porConta.length} conta(s) com percentual diferente do padrão`
                : "Todas as contas seguem o padrão"
            }
          >
            {porConta.length > 0 && (
              <ul className="mb-4 divide-y divide-border/60 rounded-[10px] border border-border/80">
                {porConta.map((c) => (
                  <li key={c.tenant_id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <Avatar nome={c.conta} tamanho="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-foreground">{c.conta}</span>
                      <span className="text-xs text-muted-foreground">{TIPO_CONTA[c.tipo] ?? c.tipo}</span>
                    </span>
                    <b className="font-semibold tabular-nums text-primary">{pct(c.percentual)}</b>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-11 text-muted-foreground hover:text-destructive sm:size-8"
                      aria-label={`Tirar o percentual próprio de ${c.conta}`}
                      disabled={salvar.isPending}
                      onClick={() => salvar.mutate({ tenantId: c.tenant_id, percentual: null })}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="space-y-2">
              <Label htmlFor="cm-conta">Conta</Label>
              <div className="relative">
                {conta ? (
                  <div className="flex min-h-10 items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/[0.04] px-3 text-sm">
                    <span className="truncate font-medium">{conta.nome}</span>
                    <button
                      type="button"
                      className="grid size-8 place-items-center rounded-md hover:bg-secondary"
                      aria-label="Trocar conta"
                      onClick={() => setConta(null)}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="cm-conta"
                      className="pl-9 text-base sm:text-sm"
                      placeholder="Buscar conta pelo nome (2 letras ou mais)"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                    />
                    {(contas.data?.length ?? 0) > 0 && (
                      <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
                        {contas.data!.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-muted sm:min-h-9"
                              onClick={() => setConta({ id: c.id, nome: c.nome })}
                            >
                              <span className="truncate">{c.nome}</span>
                              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                                {TIPO_CONTA[c.tipo] ?? c.tipo}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {termo.length >= 2 && contas.data?.length === 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">Nenhuma conta com este nome.</p>
                    )}
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="relative w-32">
                  <Input
                    aria-label="Percentual da conta"
                    inputMode="decimal"
                    placeholder="0,30"
                    className="pr-8 text-right tabular-nums"
                    value={valorConta}
                    onChange={(e) => setValorConta(e.target.value)}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
                <Button
                  className="min-h-11 sm:min-h-10"
                  disabled={!conta || salvar.isPending || !valido(valorConta)}
                  onClick={() => conta && salvar.mutate({ tenantId: conta.id, percentual: numero(valorConta) })}
                >
                  Definir percentual
                </Button>
              </div>
            </div>
          </Secao>
        </div>
      </SheetContent>
    </Sheet>
  );
}
