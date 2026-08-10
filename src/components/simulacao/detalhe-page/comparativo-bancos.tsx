import { Fragment } from "react";
import { Pencil, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { corDoBanco } from "@/lib/bancos/cores";
import { ToneBadge } from "@/components/crm/tone-badge";
import { BancoStatusBadge } from "@/components/simulacao/status-badge";
import { DetalheBancoDialog } from "@/components/simulacao/detalhe-banco-dialog";
import { formatBRL, formatPercent, formatTaxa } from "@/lib/simulacao/format";
import { rendaMinimaPelosBancos } from "@/lib/simulacao/renda";
import { ErroBancoDetalhe } from "@/components/simulacao/erro-banco-detalhe";
import {
  AmortizacaoTag,
  MobileStat,
  ResumoCelula,
} from "@/components/simulacao/detalhe-page/ui";
import { totalFinanciadoBanco } from "@/lib/simulacao/origem-dados";

/**
 * Só exibimos o que a IF realmente devolveu; sem retorno, "—"
 * (nunca o valor SOLICITADO — ver src/lib/simulacao/origem-dados.ts).
 */
const totalBancoTexto = (b: any) => {
  const v = totalFinanciadoBanco(b);
  return v == null ? "—" : formatBRL(v);
};



type Props = {
  s: any;
  bancos: any[];
  reenviandoBanco: string | null;
  criandoBanco: string | null;
  onEditar: () => void;
  onReenviarBanco: (bancoId: string) => void;
  onCriar: (simulacaoBancoId: string, bancoId?: string) => void;
};

export function ComparativoBancos({
  s,
  bancos,
  reenviandoBanco,
  criandoBanco,
  onEditar,
  onReenviarBanco,
  onCriar,
}: Props) {
  if (bancos.length === 0) {
    return (
      <div className="rounded-lg border border-border py-8 text-center text-sm text-muted-foreground">
        Nenhum banco selecionado.
      </div>
    );
  }

  const rendaInformada =
    (Number(s.renda_total) || 0) + (s.compoe_renda ? Number(s.renda_conjuge) || 0 : 0);
  const bancosSac = bancos.filter((b: any) => (b._sistema ?? "SAC") === "SAC");
  const bancosPrice = bancos.filter((b: any) => b._sistema === "PRICE");
  const isMista = bancosSac.length > 0 && bancosPrice.length > 0;
  const rendaBancos = rendaMinimaPelosBancos(bancos, rendaInformada || null);
  const rendaSac = isMista ? rendaMinimaPelosBancos(bancosSac, rendaInformada || null) : null;
  const rendaPrice = isMista ? rendaMinimaPelosBancos(bancosPrice, rendaInformada || null) : null;
  const bancosComTaxa = bancos
    .filter((b: any) => b.status_banco === "simulada" && b.valor_parcela != null)
    .sort((a: any, b: any) => (a.valor_parcela ?? 0) - (b.valor_parcela ?? 0));
  const melhorSacId = bancosSac
    .filter((b: any) => b.status_banco === "simulada" && b.valor_parcela != null)
    .sort((a: any, b: any) => (a.valor_parcela ?? 0) - (b.valor_parcela ?? 0))[0]?.id;
  const melhorPriceId = bancosPrice
    .filter((b: any) => b.status_banco === "simulada" && b.valor_parcela != null)
    .sort((a: any, b: any) => (a.valor_parcela ?? 0) - (b.valor_parcela ?? 0))[0]?.id;
  const melhorId = isMista ? undefined : bancosComTaxa.length > 1 ? bancosComTaxa[0]?.id : undefined;
  const bancosExibicao: any[] = isMista ? [...bancosSac, ...bancosPrice] : bancos;
  const ehMelhor = (b: any) => {
    if (!isMista) return b.id === melhorId;
    return (b._sistema === "PRICE" ? melhorPriceId : melhorSacId) === b.id;
  };

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60 shadow-sm sm:grid-cols-3 lg:grid-cols-5">
        <ResumoCelula rotulo="Valor do imóvel" valor={formatBRL(s.valor_imovel)} />
        <ResumoCelula rotulo="Valor financiado" valor={formatBRL(s.valor_financiamento)} />
        {isMista ? (
          <>
            {rendaSac && (
              <ResumoCelula
                rotulo="Renda exigida — SAC"
                valor={formatBRL(rendaSac.rendaMinima)}
                destaque
              />
            )}
            {rendaPrice && (
              <ResumoCelula
                rotulo="Renda exigida — PRICE"
                valor={formatBRL(rendaPrice.rendaMinima)}
                destaque
              />
            )}
          </>
        ) : (
          rendaBancos && (
            <ResumoCelula
              rotulo="Renda exigida"
              valor={formatBRL(rendaBancos.rendaMinima)}
              destaque
            />
          )
        )}
        <ResumoCelula
          rotulo="Financiar despesas"
          valor={s.fg_financiar_despesas ? "Sim" : "Não"}
        />
        {s.fg_financiar_despesas && (
          <>
            <ResumoCelula
              rotulo="Despesas financiadas"
              valor={formatBRL(s.valor_despesas_financiadas)}
            />
            <ResumoCelula
              rotulo="Total financiado"
              destaque
              valor={formatBRL(
                (Number(s.valor_financiamento) || 0) +
                  (Number(s.valor_despesas_financiadas) || 0),
              )}
            />
          </>
        )}
      </div>

      {/* Mobile: cartões */}
      <div className="grid gap-3 lg:hidden">
        {bancosExibicao.map((b: any, idx: number) => {
          const primeiroDoGrupo =
            isMista && (idx === 0 || bancosExibicao[idx - 1]._sistema !== b._sistema);
          return (
            <div key={b.id}>
              {primeiroDoGrupo && (
                <div className="mb-2 flex items-center gap-2">
                  <AmortizacaoTag sistema={b._sistema} />
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-start gap-3">
                  <BancoLogo nome={b.nome_banco} size="lg" className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="truncate font-medium"
                        style={{ color: corDoBanco(b.nome_banco) }}
                      >
                        {b.nome_banco}
                      </span>
                      {ehMelhor(b) && <ToneBadge tone="success">Melhor taxa</ToneBadge>}
                    </div>
                    <div className="mt-1">
                      <BancoStatusBadge status={b.status_banco} />
                    </div>
                  </div>
                </div>

                {b.status_banco === "erro" && b.mensagem_banco && (
                  <div className="mt-2"><ErroBancoDetalhe mensagem={b.mensagem_banco} nomeBanco={b.nome_banco} /></div>
                )}

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <MobileStat rotulo="Parcela" valor={formatBRL(b.valor_parcela)} />
                  <MobileStat
                    rotulo="Taxa a.a."
                    valor={
                      b.taxa_juros_ano != null ? formatTaxa(b.taxa_juros_ano) : "—"
                    }
                  />
                  <MobileStat
                    rotulo="Prazo"
                    valor={b.prazo_pagamento_max != null ? `${b.prazo_pagamento_max}m` : s.prazo != null ? `${s.prazo}m` : "—"}
                  />
                  <MobileStat
                    rotulo="Total fin. (banco)"
                    valor={totalBancoTexto(b)}
                  />
                  <MobileStat rotulo="IOF (banco)" valor={b.valor_iof != null ? formatBRL(b.valor_iof) : "—"} />

                </dl>

                <div className="mt-3 flex items-center justify-end gap-2">
                  <DetalheBancoDialog banco={b} simulacao={s} />
                  {b.status_banco === "erro" ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onEditar}
                        title="Abrir simulação para alterar dados"
                      >
                        <Pencil className="mr-1 h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={reenviandoBanco !== null}
                        onClick={() => onReenviarBanco(b.banco_id)}
                      >
                        <RefreshCw className="mr-1 h-4 w-4" />
                        {reenviandoBanco === b.banco_id ? "Reenviando…" : "Reenviar"}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-gradient-to-b from-primary to-primary/90 shadow-sm transition-all duration-200 hover:-translate-y-px hover:shadow-md hover:brightness-105 active:translate-y-0 active:scale-[0.98]"
                        disabled={b.status_banco !== "simulada" || criandoBanco !== null}
                        onClick={() => onCriar(b.id, b.banco_id)}
                    >
                        {criandoBanco === b.id ? "Enviando…" : "Enviar Aprovação"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden overflow-x-auto rounded-xl border border-border/60 shadow-sm lg:block">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 bg-muted/50 hover:bg-muted/50">
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Banco
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Situação
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Parcela
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Taxa a.a.
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Prazo
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Total fin. (banco)
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                IOF (banco)
              </TableHead>

              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bancosExibicao.map((b: any, idx: number) => {
              const primeiroDoGrupo =
                isMista &&
                (idx === 0 || bancosExibicao[idx - 1]._sistema !== b._sistema);
              const melhor = ehMelhor(b);
              return (
                <Fragment key={b.id}>
                  {primeiroDoGrupo && (
                    <TableRow className="border-border/60 bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={7} className="py-2">
                        <div className="flex items-center gap-2">
                          <AmortizacaoTag sistema={b._sistema} />
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {b._sistema === "SAC"
                              ? "Amortização constante · parcelas decrescentes"
                              : "Parcelas fixas · juros compostos"}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow
                    className={cn(
                      "border-border/50 transition-colors odd:bg-card even:bg-muted/20 hover:bg-primary/5",
                      melhor &&
                        "bg-success/5 even:bg-success/5 hover:bg-success/10 [box-shadow:inset_3px_0_0_var(--success)]",
                    )}
                  >
                    <TableCell className="py-3 text-sm font-semibold">
                      <div className="flex items-center gap-2.5">
                        <BancoLogo nome={b.nome_banco} size="lg" />
                        <span style={{ color: corDoBanco(b.nome_banco) }}>
                          {b.nome_banco}
                        </span>
                        {b.id === melhorId && (
                          <ToneBadge tone="success">Melhor taxa</ToneBadge>
                        )}
                      </div>
                      {b.status_banco === "erro" && b.mensagem_banco && (
                        <div className="mt-1"><ErroBancoDetalhe mensagem={b.mensagem_banco} nomeBanco={b.nome_banco} linhas={1} /></div>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      <BancoStatusBadge status={b.status_banco} />
                    </TableCell>
                    <TableCell className="py-3 text-right text-sm font-semibold tabular-nums whitespace-nowrap">
                      {formatBRL(b.valor_parcela)}
                    </TableCell>
                    <TableCell className="py-3 text-right text-sm tabular-nums whitespace-nowrap">
                      {b.taxa_juros_ano != null ? formatTaxa(b.taxa_juros_ano) : "—"}
                    </TableCell>
                    <TableCell className="py-3 text-right text-sm tabular-nums whitespace-nowrap">
                      {b.prazo_pagamento_max ?? s.prazo ?? "—"}{b.prazo_pagamento_max || s.prazo ? "m" : ""}
                    </TableCell>
                    <TableCell className="py-3 text-right text-sm font-medium tabular-nums whitespace-nowrap">
                      {totalBancoTexto(b)}
                    </TableCell>

                    <TableCell className="py-3 text-right text-sm tabular-nums whitespace-nowrap text-muted-foreground">
                      {b.valor_iof != null ? formatBRL(b.valor_iof) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <DetalheBancoDialog banco={b} simulacao={s} />
                        {b.status_banco === "erro" ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={onEditar}
                              title="Abrir simulação para alterar dados"
                            >
                              <Pencil className="mr-1 h-4 w-4" />
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={reenviandoBanco !== null}
                              onClick={() => onReenviarBanco(b.banco_id)}
                            >
                              <RefreshCw className="mr-1 h-4 w-4" />
                              {reenviandoBanco === b.banco_id ? "Reenviando…" : "Reenviar"}
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-gradient-to-b from-primary to-primary/90 shadow-sm transition-all duration-200 hover:-translate-y-px hover:shadow-md hover:brightness-105 active:translate-y-0 active:scale-[0.98]"
                            disabled={b.status_banco !== "simulada" || criandoBanco !== null}
                            onClick={() => onCriar(b.id, b.banco_id)}
                          >
                            {criandoBanco === b.id ? "Enviando…" : "Enviar Aprovação"}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
        <strong className="font-medium text-foreground">Importante:</strong> Isto é apenas
        uma simulação. A efetivação do resultado apresentado está condicionada à análise de
        sua proposta de financiamento. A taxa de juros apresentada na simulação é apenas
        para referência.
      </p>
    </>
  );
}
