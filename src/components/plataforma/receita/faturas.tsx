/**
 * Faturas dos assinantes: filtro em chips (com a contagem de cada um), busca e a lista —
 * tabela no computador, cartões no celular. Dar baixa (libera créditos e acesso) e
 * cancelar continuam pedindo confirmação.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ban, CheckCircle2, ReceiptText } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import {
  BarraFiltros,
  CampoBusca,
  ChipsFiltro,
  EstadoErro,
  EstadoVazio,
  ListaCarregando,
  Selo,
  type Tom,
} from "@/components/plataforma/kit";
import { RodapePaginas, useValorAssentado } from "@/components/plataforma/paginacao";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL, formatData } from "@/lib/financeiro/format";
import {
  POR_PAGINA_FATURAS,
  baixarFaturaPlataforma,
  cancelarFaturaPlataforma,
  listarFaturasPlataforma,
  type FaturaPlataforma,
  type FiltroFatura,
  type ResumoReceita,
} from "@/lib/plataforma/receita.functions";
import { Dinheiro } from "./comum";

const FORMA: Record<string, string> = { pix: "Pix", boleto: "Boleto", cartao: "Cartão" };

export function situacaoFatura(f: FaturaPlataforma): { rotulo: string; tom: Tom } {
  if (f.status === "paga") return { rotulo: "Paga", tom: "sucesso" };
  if (f.status === "cancelada") return { rotulo: "Cancelada", tom: "neutro" };
  if (f.status === "estornada") return { rotulo: "Estornada", tom: "neutro" };
  if (f.vencida) return { rotulo: "Vencida", tom: "perigo" };
  return { rotulo: "Em aberto", tom: "alerta" };
}

export function FaturasReceita({
  filtro,
  onFiltro,
  resumo,
}: {
  filtro: FiltroFatura;
  onFiltro: (f: FiltroFatura) => void;
  resumo: ResumoReceita | null | undefined;
}) {
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const termo = useValorAssentado(busca.trim());
  const listarFn = useServerFn(listarFaturasPlataforma);
  // Filtro, busca e página rodam no banco: a lista não para nas primeiras.
  const qf = useQuery({
    queryKey: ["plataforma-receita", "faturas", filtro, termo, pagina],
    queryFn: () => listarFn({ data: { filtro, busca: termo || null, pagina } }),
    staleTime: 30_000,
    placeholderData: (anterior) => anterior,
  });
  const faturas = qf.data?.faturas ?? [];

  return (
    <div className="space-y-3">
      <BarraFiltros className="md:justify-between">
        <ChipsFiltro<FiltroFatura>
          rotulo="Situação das faturas"
          valor={filtro}
          onChange={(v) => {
            onFiltro(v);
            setPagina(1);
          }}
          opcoes={[
            { valor: "abertas", rotulo: "Em aberto", contagem: resumo?.qtd_abertas },
            { valor: "vencidas", rotulo: "Vencidas", contagem: resumo?.vencidas, tom: "perigo" },
            { valor: "pagas", rotulo: "Pagas", contagem: resumo?.qtd_pagas },
            { valor: "todas", rotulo: "Todas", contagem: resumo?.qtd_faturas },
          ]}
        />
        <CampoBusca
          rotulo="Buscar fatura por conta ou descrição"
          placeholder="Conta ou descrição"
          valor={busca}
          onChange={(v) => {
            setBusca(v);
            setPagina(1);
          }}
        />
      </BarraFiltros>

      <div className="overflow-hidden rounded-[14px] border border-border/80 bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)]">
        {qf.isLoading ? (
          <ListaCarregando />
        ) : qf.isError ? (
          <EstadoErro
            mensagem={mensagemDeErro(qf.error, "Não foi possível carregar as faturas.")}
            onTentar={() => qf.refetch()}
          />
        ) : faturas.length === 0 ? (
          <EstadoVazio
            icone={<ReceiptText />}
            titulo={termo ? "Nenhuma fatura com esta busca" : "Nada neste filtro"}
            descricao={
              filtro === "vencidas"
                ? "Nenhuma fatura vencida. A cobrança está em dia."
                : "Troque o filtro acima para ver as outras faturas."
            }
          />
        ) : (
          <>
            {/* Computador: tabela densa. */}
            <table className="hidden w-full text-sm xl:table">
              <thead>
                <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Conta</th>
                  <th className="px-3 py-2.5 font-medium">Descrição</th>
                  <th className="px-3 py-2.5 text-right font-medium">Valor</th>
                  <th className="px-3 py-2.5 font-medium">Vencimento</th>
                  <th className="px-3 py-2.5 font-medium">Situação</th>
                  <th className="w-[1%] px-4 py-2.5 text-right font-medium">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {faturas.map((f) => {
                  const s = situacaoFatura(f);
                  return (
                    <tr key={f.id} className="hover:bg-primary/[0.02]">
                      <td className="max-w-[14rem] px-4 py-2.5">
                        <p className="truncate font-medium text-foreground">{f.conta}</p>
                      </td>
                      <td className="max-w-[18rem] px-3 py-2.5">
                        <p className="truncate">{f.descricao}</p>
                        {f.periodo && (
                          <p className="text-xs text-muted-foreground">Licença {f.periodo}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium">
                        <Dinheiro valor={f.valor} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {formatData(f.vencimento)}
                        {f.pago_em && (
                          <p className="text-xs text-muted-foreground">
                            pago {formatData(f.pago_em)}
                            {f.forma ? ` · ${FORMA[f.forma] ?? f.forma}` : ""}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <Selo tom={s.tom} ponto={s.tom === "perigo"}>
                          {s.rotulo}
                        </Selo>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">
                        <AcoesFatura fatura={f} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Celular: cartões (sem rolagem lateral). */}
            <ul className="divide-y divide-border/60 xl:hidden">
              {faturas.map((f) => {
                const s = situacaoFatura(f);
                return (
                  <li key={f.id} className="space-y-2 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{f.conta}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {f.descricao}
                          {f.periodo ? ` · licença ${f.periodo}` : ""}
                        </p>
                      </div>
                      <p className="shrink-0 font-semibold">
                        <Dinheiro valor={f.valor} />
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Selo tom={s.tom} ponto={s.tom === "perigo"}>
                          {s.rotulo}
                        </Selo>
                        vence {formatData(f.vencimento)}
                      </div>
                      <AcoesFatura fatura={f} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <RodapePaginas
          pagina={pagina}
          porPagina={POR_PAGINA_FATURAS}
          quantidade={faturas.length}
          total={qf.data?.total}
          carregando={qf.isFetching}
          onPagina={setPagina}
        />
      </div>
    </div>
  );
}

function AcoesFatura({ fatura: f }: { fatura: FaturaPlataforma }) {
  const qc = useQueryClient();
  const pode = usePermissao("saas.receita", "edit");
  const baixarFn = useServerFn(baixarFaturaPlataforma);
  const cancelarFn = useServerFn(cancelarFaturaPlataforma);
  const [forma, setForma] = useState<"pix" | "boleto" | "cartao">("pix");
  const emAberto = f.status === "pendente" || f.status === "vencida";
  const baixar = useMutation({
    mutationFn: () => baixarFn({ data: { id: f.id, forma } }),
    onSuccess: () => {
      toast.success("Pagamento confirmado. Créditos e acesso da conta são liberados automaticamente.");
      qc.invalidateQueries({ queryKey: ["plataforma-receita"] });
      qc.invalidateQueries({ queryKey: ["plataforma-licencas"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível dar baixa.")),
  });
  if (!pode || !emAberto) return null;

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Select value={forma} onValueChange={(v) => setForma(v as typeof forma)}>
        <SelectTrigger className="h-11 w-[6.5rem] sm:h-8" aria-label="Forma do pagamento recebido">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pix">Pix</SelectItem>
          <SelectItem value="boleto">Boleto</SelectItem>
          <SelectItem value="cartao">Cartão</SelectItem>
        </SelectContent>
      </Select>
      {/* A baixa libera créditos e acesso da conta: pede confirmação. */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" className="min-h-11 sm:min-h-8" disabled={baixar.isPending}>
            <CheckCircle2 className="mr-1.5 size-4" /> Dar baixa
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar o recebimento?</AlertDialogTitle>
            <AlertDialogDescription>
              {f.conta} — {f.descricao}, {formatBRL(f.valor)}, recebido por{" "}
              {forma === "pix" ? "Pix" : forma === "boleto" ? "boleto" : "cartão"}. A fatura fica paga
              e os créditos e o acesso da conta são liberados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => baixar.mutate()}>Dar baixa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ConfirmDelete
        titulo="Cancelar esta fatura?"
        descricao={`${f.descricao} — ${formatBRL(f.valor)}. A fatura deixa de ser cobrada.`}
        confirmarLabel="Cancelar fatura"
        trigger={
          <Button
            size="icon"
            variant="ghost"
            className="size-11 text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:size-8"
            aria-label={`Cancelar a fatura de ${f.conta}`}
          >
            <Ban className="size-4" />
          </Button>
        }
        onConfirm={async () => {
          await cancelarFn({ data: { id: f.id } });
          toast.success("Fatura cancelada.");
          qc.invalidateQueries({ queryKey: ["plataforma-receita"] });
        }}
      />
    </div>
  );
}
