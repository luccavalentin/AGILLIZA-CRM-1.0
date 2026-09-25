import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, Check, Circle, Landmark, Loader2, RefreshCw, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BancoLogo } from "@/components/bancos/banco-logo";
import type { EtapaBanco } from "@/components/propostas/funil-banco-timeline";
import { sincronizarProposta } from "@/lib/propostas/propostas.functions";
import { statusDaEtapa } from "@/lib/propostas/etapa-banco";
import {
  fonteDoAndamento,
  nomeEtapaFormularios,
  temEtapaFormularios,
} from "@/lib/bancos/etapas-banco";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL } from "@/lib/simulacao/format";
import { cn } from "@/lib/utils";

type ColunaPosAprovacao = { status: readonly string[]; titulo: string };

/** Colunas do pós-aprovação, na ordem da máquina de estados. */
const COLUNAS_KANBAN: readonly ColunaPosAprovacao[] = [
  { status: ["credito_aprovado", "credito_condicionado"], titulo: "Crédito aprovado" },
  { status: ["aguardando_documentos"], titulo: "Documentos" },
  { status: ["engenharia_vistoria"], titulo: "Engenharia / vistoria" },
  { status: ["analise_juridica"], titulo: "Análise jurídica" },
  { status: ["contrato_emitido"], titulo: "Contrato emitido" },
];

/**
 * As colunas deste banco: Itaú e Santander têm a etapa de formulários entre o
 * crédito e os documentos, com o nome do portal de cada um.
 */
function colunasDoBanco(nomeBanco: unknown, status: string): ColunaPosAprovacao[] {
  if (!temEtapaFormularios(nomeBanco) && status !== "formularios") return [...COLUNAS_KANBAN];
  return [
    COLUNAS_KANBAN[0],
    { status: ["formularios"], titulo: nomeEtapaFormularios(nomeBanco) },
    ...COLUNAS_KANBAN.slice(1),
  ];
}

export type DestinoManual = "engenharia_vistoria" | "analise_juridica" | "contrato_emitido";

function dataHora(v: string | null | undefined) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
}

/**
 * Mini kanban das etapas depois da aprovação.
 *
 * Duas fontes na mesma tela:
 *  - o cartão da proposta, na coluna do `propostas.status`;
 *  - as etapas do funil do banco (`propostas.etapas_banco`), gravadas pelo sync
 *    com a HomeFin (`GET /oportunidade/{id}`), cada uma na coluna em que o
 *    nome dela cai (`statusDaEtapa`). O sync também move o status sozinho
 *    quando o banco avança — nunca para trás.
 */
export function EtapasKanban({
  proposta,
  banco,
  onAvancar,
}: {
  proposta: any;
  banco: any | null;
  onAvancar: (para: { status: DestinoManual; titulo: string }) => void;
}) {
  const qc = useQueryClient();
  const sincronizar = useServerFn(sincronizarProposta);
  const [sincronizando, setSincronizando] = useState(false);

  const status = String(proposta.status ?? "");
  const nomeBanco = banco?.nome_banco ?? proposta.nome_banco;
  const colunas = colunasDoBanco(nomeBanco, status);
  const indiceAtual = colunas.findIndex((c) => c.status.includes(status));
  // O operador só move daqui a partir de Documentos; até lá quem move é o
  // banco (crédito, formulários) ou a conferência de dados.
  const indiceDocumentos = colunas.findIndex((c) => c.status.includes("aguardando_documentos"));
  const proxima = indiceAtual >= indiceDocumentos ? colunas[indiceAtual + 1] : undefined;
  const pelaHomefin = fonteDoAndamento(nomeBanco) === "homefin";

  const etapasBanco: EtapaBanco[] = Array.isArray(proposta.etapas_banco)
    ? [...proposta.etapas_banco].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    : [];
  const colunaDaEtapa = (e: EtapaBanco) => {
    const s = statusDaEtapa(e.nome);
    return s ? colunas.findIndex((c) => c.status.includes(s)) : -1;
  };
  // Etapas de crédito (simulação, análise) ficam antes do kanban: não entram nas colunas.
  const semColuna = etapasBanco.filter((e) => colunaDaEtapa(e) < 0);

  async function sincronizarAgora() {
    setSincronizando(true);
    try {
      const r: any = await sincronizar({ data: { proposta_id: proposta.id } });
      await qc.invalidateQueries({ queryKey: ["proposta", proposta.id] });
      qc.invalidateQueries({ queryKey: ["propostas"] });
      toast.success(
        r?.atualizado
          ? `Retorno do banco recebido${r?.etapa ? `: ${r.etapa}` : ""}.`
          : "Consultado no banco: sem novidades.",
      );
    } catch (e) {
      toast.error(mensagemDeErro(e, "Falha ao consultar o banco."));
    } finally {
      setSincronizando(false);
    }
  }

  const ultima = dataHora(proposta.ultima_sincronizacao_em);

  return (
    <div className="space-y-3 pb-4">
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            {pelaHomefin
              ? "As etapas voltam do banco pela HomeFin e movem a proposta sozinhas."
              : `As etapas são lidas no portal do ${nomeBanco ?? "banco"} e movem a proposta sozinhas.`}
            <br />
            {ultima ? `Última consulta ao banco: ${ultima}.` : "Ainda não consultado no banco."}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={sincronizando || !proposta.homefin_id_oportunidade}
          onClick={sincronizarAgora}
        >
          {sincronizando ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Consultar banco agora
        </Button>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
        <div
          className="grid gap-2"
          style={{
            // 180 px por coluna: 5 colunas (Bradesco) ou 6 (Itaú, Santander).
            gridTemplateColumns: `repeat(${colunas.length}, minmax(0, 1fr))`,
            minWidth: `${colunas.length * 180}px`,
          }}
        >
          {colunas.map((col, i) => {
            const atual = i === indiceAtual;
            const feita = indiceAtual > i;
            const etapasDaColuna = etapasBanco.filter((e) => colunaDaEtapa(e) === i);
            return (
              <section
                key={col.titulo}
                className={cn(
                  "flex min-h-[220px] flex-col rounded-xl border p-2",
                  atual
                    ? "border-primary/50 bg-primary/5"
                    : feita
                      ? "border-border bg-muted/30"
                      : "border-dashed border-border bg-card",
                )}
              >
                <header className="mb-2 flex items-center gap-1.5 px-1">
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                      feita || atual
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {feita ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  <h4
                    className={cn(
                      "truncate text-xs font-semibold",
                      atual ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {col.titulo}
                  </h4>
                </header>

                <div className="flex flex-1 flex-col gap-2">
                  {atual && (
                    <article className="rounded-lg border border-border bg-card p-2.5 shadow-sm">
                      <div className="flex items-center gap-2">
                        <BancoLogo nome={banco?.nome_banco} size="sm" />
                        <span className="truncate text-xs font-semibold text-foreground">
                          {proposta.numero_proposta}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {proposta.nome_cliente}
                      </p>
                      <p className="text-xs font-medium tabular-nums text-foreground">
                        {formatBRL(
                          proposta.valor_financiamento_aprovado ?? proposta.valor_financiamento,
                        )}
                      </p>
                      {proposta.detalhe_status_atual && (
                        <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                          {proposta.detalhe_status_atual}
                        </p>
                      )}
                      {dataHora(proposta.status_atualizado_em) && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          desde {dataHora(proposta.status_atualizado_em)}
                        </p>
                      )}
                      {proxima && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="mt-2 h-7 w-full gap-1 text-[11px]"
                          onClick={() =>
                            onAvancar({
                              status: proxima.status[0] as DestinoManual,
                              titulo: proxima.titulo,
                            })
                          }
                        >
                          Mover para {proxima.titulo} <ArrowRight className="h-3 w-3" />
                        </Button>
                      )}
                      {indiceAtual >= 0 && indiceAtual < indiceDocumentos && (
                        <p className="mt-2 text-[10px] text-muted-foreground">
                          {colunas[indiceAtual + 1]?.status.includes("formularios")
                            ? `O banco abre ${colunas[indiceAtual + 1].titulo} depois do crédito.`
                            : col.status.includes("formularios")
                              ? "O banco libera Documentos quando os formulários forem concluídos."
                              : "Grave a conferência de dados para ir a Documentos."}
                        </p>
                      )}
                    </article>
                  )}

                  {etapasDaColuna.map((e) => (
                    <EtapaBancoCartao key={`${e.id}-${e.nome}`} etapa={e} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {semColuna.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Outras etapas no banco
          </p>
          <div className="flex flex-wrap gap-2">
            {semColuna.map((e) => (
              <EtapaBancoCartao key={`${e.id}-${e.nome}`} etapa={e} compacta />
            ))}
          </div>
        </div>
      )}

      {etapasBanco.length === 0 && (
        <p className="text-xs text-muted-foreground">
          O banco ainda não devolveu o funil de etapas desta proposta. As colunas se preenchem
          quando a HomeFin retornar.
        </p>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <UserRound className="h-3 w-3" /> "Mover para" registra o avanço manual no histórico. O
        retorno do banco nunca volta a proposta para uma etapa anterior.
      </p>
    </div>
  );
}

function EtapaBancoCartao({ etapa, compacta }: { etapa: EtapaBanco; compacta?: boolean }) {
  const quando = dataHora(etapa.atualizada_em);
  return (
    <div
      className={cn(
        "flex items-start gap-1.5 rounded-lg border px-2 py-1.5 text-[11px]",
        etapa.concluida
          ? "border-emerald-500/30 bg-emerald-500/5"
          : etapa.ativa
            ? "border-amber-500/40 bg-amber-500/10"
            : "border-border bg-card",
        compacta && "py-1",
      )}
      title="Etapa informada pelo banco"
    >
      {etapa.concluida ? (
        <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Circle
          className={cn(
            "mt-0.5 h-3 w-3 shrink-0",
            etapa.ativa ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
          )}
        />
      )}
      <span className="min-w-0">
        <span className="block font-medium text-foreground">{etapa.nome}</span>
        <span className="text-muted-foreground">
          banco · {etapa.concluida ? "concluída" : etapa.ativa ? "em andamento" : "pendente"}
          {quando && ` · ${quando}`}
        </span>
      </span>
    </div>
  );
}
