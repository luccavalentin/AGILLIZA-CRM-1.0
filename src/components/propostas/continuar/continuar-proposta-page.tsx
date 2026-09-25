import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Landmark,
  Loader2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
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
import { mensagemBancoLegivel } from "@/lib/bancos/mensagem-banco";
import { AbaEnviarBanco, type AcoesEnvioBanco } from "@/components/proposta/aba-enviar-banco";
import { statusProposta } from "@/components/propostas/status";
import { obterProposta } from "@/lib/propostas/propostas.functions";
import {
  avancarEtapaContinuar,
  salvarConferenciaProposta,
  sincronizarPropostaComCrm,
  type ResultadoConferencia,
} from "@/lib/propostas/continuar.functions";
import { bancoAprovado, podeContinuarProposta } from "@/lib/propostas/state-machine";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL, maskCpfCnpj } from "@/lib/simulacao/format";
import { cn } from "@/lib/utils";
import { EtapaConferencia, type EnvioConferencia } from "./etapa-conferencia";
import { EtapasKanban, type DestinoManual } from "./etapas-kanban";

export type EtapaContinuar = "dados" | "documentos" | "etapas";
type Etapa = EtapaContinuar;

const PASSOS: { id: Etapa; titulo: string }[] = [
  { id: "dados", titulo: "Conferência de dados" },
  { id: "documentos", titulo: "Documentos" },
  { id: "etapas", titulo: "Próximas etapas" },
];

const BLOCO_LABEL: Record<string, string> = {
  valores: "Valores",
  participantes: "Participantes e conta",
  imovel: "Imóvel",
};

function etapaInicial(status: string): Etapa {
  if (status === "aguardando_documentos") return "documentos";
  if (status === "engenharia_vistoria" || status === "analise_juridica") return "etapas";
  return "dados";
}

/**
 * Tela do "Continuar proposta" (rota `/operacional/propostas/$id/continuar`).
 * A etapa fica na URL (`?etapa=`) para o F5 e o link voltarem ao mesmo passo.
 */
export function ContinuarPropostaPage({
  propostaId,
  etapaUrl,
  onEtapaChange,
}: {
  propostaId: string;
  etapaUrl?: Etapa;
  onEtapaChange: (etapa: Etapa) => void;
}) {
  const qc = useQueryClient();
  const obter = useServerFn(obterProposta);
  const salvar = useServerFn(salvarConferenciaProposta);
  const avancar = useServerFn(avancarEtapaContinuar);
  const sincronizarComCrm = useServerFn(sincronizarPropostaComCrm);

  // O que mudou no CRM depois da proposta (participantes, vendedores, imóvel)
  // entra aqui antes da conferência.
  useEffect(() => {
    let ativo = true;
    sincronizarComCrm({ data: { proposta_id: propostaId } })
      .then((r) => {
        const mudou =
          r.participantes +
            r.vendedoresIncluidos +
            r.vendedoresAtualizados +
            r.vendedoresRemovidos >
            0 || r.imovel.length > 0;
        if (ativo && mudou) {
          qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
        }
      })
      .catch(() => {
        /* a tela segue com o que a proposta já tem */
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propostaId]);

  // Sem refetch no foco: recarregar no meio da conferência apagaria o que foi digitado.
  const { data, isLoading, error } = useQuery({
    queryKey: ["proposta", propostaId],
    queryFn: () => obter({ data: { id: propostaId } }),
    refetchOnWindowFocus: false,
  });

  const [etapa, setEtapaLocal] = useState<Etapa>(etapaUrl ?? "dados");
  const setEtapa = (e: Etapa) => {
    setEtapaLocal(e);
    onEtapaChange(e);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const [iniciou, setIniciou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [falhaHomefin, setFalhaHomefin] = useState<ResultadoConferencia["errosHomefin"] | null>(
    null,
  );
  const [ultimoEnvio, setUltimoEnvio] = useState<EnvioConferencia | null>(null);
  const [avancarPara, setAvancarPara] = useState<{ status: DestinoManual; titulo: string } | null>(
    null,
  );
  const [avancando, setAvancando] = useState(false);
  const [envioDocs, setEnvioDocs] = useState<AcoesEnvioBanco | null>(null);

  const p = data?.proposta as any;
  const bancos = (data?.bancos ?? []) as any[];
  const aprovados = bancos.filter(bancoAprovado);
  const banco = aprovados.find((b) => b.selecionado) ?? aprovados[0] ?? null;

  // Sem etapa na URL, abre na etapa em que a proposta está.
  useEffect(() => {
    if (p && !iniciou) {
      if (!etapaUrl) setEtapaLocal(etapaInicial(String(p.status)));
      setIniciou(true);
    }
  }, [p, iniciou, etapaUrl]);

  function recarregar() {
    qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    qc.invalidateQueries({ queryKey: ["propostas"] });
  }

  async function gravar(envio: EnvioConferencia, reenviar: ResultadoConferencia["blocos"] = []) {
    setSalvando(true);
    setFalhaHomefin(null);
    setUltimoEnvio(envio);
    try {
      const r = await salvar({
        data: { proposta_id: propostaId, ...envio, avancar: true, reenviar },
      });
      recarregar();
      if (r.errosHomefin.length > 0) {
        // O CRM ficou gravado; a HomeFin não. Não avança até resolver.
        setFalhaHomefin(r.errosHomefin);
        toast.error("Dados gravados no CRM, mas a HomeFin recusou a atualização.");
        return;
      }
      toast.success(
        r.alterou ? "Dados gravados no CRM e na HomeFin." : "Dados conferidos, nada foi alterado.",
      );
      const v = r.vendedores;
      if (v?.enviados.length) toast.success(`Vendedor na HomeFin: ${v.enviados.join(", ")}.`);
      for (const p of v?.pendentes ?? []) {
        toast.warning(`Vendedor ${p.nome} não foi à HomeFin. Falta: ${p.faltando.join(", ")}.`, {
          duration: 12_000,
        });
      }
      for (const e of v?.erros ?? []) {
        toast.error(`Vendedor ${e.nome}: ${e.mensagem}`, { duration: 12_000 });
      }
      setEtapa("documentos");
    } catch (e) {
      toast.error(mensagemDeErro(e, "Falha ao gravar os dados."));
    } finally {
      setSalvando(false);
    }
  }

  async function autosalvar(envio: EnvioConferencia): Promise<boolean> {
    try {
      const r = await salvar({
        data: { proposta_id: propostaId, ...envio, avancar: false, somente_crm: true },
      });
      if (r.alterou) qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
      return true;
    } catch {
      return false;
    }
  }

  async function confirmarAvanco() {
    if (!avancarPara) return;
    setAvancando(true);
    try {
      await avancar({
        data: { proposta_id: propostaId, para: avancarPara.status },
      });
      toast.success(`Proposta em "${avancarPara.titulo}".`);
      recarregar();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Falha ao avançar a etapa."));
    } finally {
      setAvancando(false);
      setAvancarPara(null);
    }
  }

  const elegivel = p
    ? podeContinuarProposta(p.status, bancos) || p.status === "contrato_emitido"
    : false;
  const condicionado =
    banco?.status_banco === "condicionado" || p?.status === "credito_condicionado";
  const status = p ? statusProposta(String(p.status), p.nome_banco) : null;

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground hover:text-foreground"
        >
          <Link to="/operacional/propostas">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para propostas
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/operacional/propostas/$id" params={{ id: propostaId }}>
            Abrir proposta completa
          </Link>
        </Button>
      </div>

      {/* Cabeçalho */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <BancoLogo nome={banco?.nome_banco} size="xl" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Continuar proposta {p?.numero_proposta ?? ""}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {p
                ? `${p.nome_cliente ?? "Cliente"} · ${p.cpf_cnpj ? maskCpfCnpj(p.cpf_cnpj) : "sem CPF"}`
                : "Carregando…"}
              {status && ` · ${status.label}`}
            </p>
          </div>
        </div>

        {banco && p && (
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-muted/40 px-3 py-2 text-xs sm:grid-cols-4">
            <Resumo
              termo="Valor aprovado"
              valor={formatBRL(
                p.valor_financiamento_aprovado ??
                  banco.valor_financiamento_max ??
                  p.valor_financiamento,
              )}
            />
            <Resumo
              termo="Parcela"
              valor={formatBRL(p.valor_parcela_aprovado ?? banco.valor_parcela)}
            />
            <Resumo
              termo="Taxa a.a."
              valor={
                (p.taxa_juros_ano_aprovado ?? banco.taxa_juros_ano) != null
                  ? `${Number(p.taxa_juros_ano_aprovado ?? banco.taxa_juros_ano).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`
                  : "—"
              }
            />
            <Resumo termo="Prazo" valor={`${p.prazo_aprovado ?? p.prazo ?? "—"} meses`} />
          </dl>
        )}

        {condicionado && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Aprovação condicionada</p>
              <p>
                {mensagemBancoLegivel(banco?.mensagem_banco, banco?.nome_banco) ||
                  "O banco aprovou com condições. Confira o retorno do banco na proposta."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Passos */}
      <ol className="flex gap-2">
        {PASSOS.map((passo, i) => {
          const ativo = passo.id === etapa;
          const feito = PASSOS.findIndex((x) => x.id === etapa) > i;
          return (
            <li key={passo.id} className="flex-1">
              <button
                type="button"
                onClick={() => setEtapa(passo.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-left text-sm transition-colors",
                  ativo
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    ativo || feito ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {feito ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className="truncate font-medium">
                  <span className="sm:hidden">{i === 0 ? "Dados" : passo.titulo}</span>
                  <span className="hidden sm:inline">{passo.titulo}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Corpo */}
      <div>
        {isLoading && (
          <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando proposta…
          </div>
        )}
        {error && (
          <p className="py-10 text-center text-sm text-destructive">
            {mensagemDeErro(error, "Não foi possível carregar a proposta.")}
          </p>
        )}
        {p && !elegivel && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Esta proposta não tem crédito aprovado. O "Continuar proposta" vale só para aprovação ou
            aprovação condicionada.
          </p>
        )}

        {p && elegivel && etapa === "dados" && (
          <>
            {falhaHomefin && (
              <div className="mb-4 space-y-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <p className="flex items-center gap-2 font-semibold text-destructive">
                  <XCircle className="h-4 w-4" /> Gravado no CRM, mas não na HomeFin
                </p>
                {falhaHomefin.map((f) => (
                  <p key={f.bloco} className="text-xs text-muted-foreground">
                    <strong className="text-foreground">{BLOCO_LABEL[f.bloco] ?? f.bloco}:</strong>{" "}
                    {f.mensagem}
                  </p>
                ))}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={salvando || !ultimoEnvio}
                    onClick={() =>
                      ultimoEnvio &&
                      gravar(
                        ultimoEnvio,
                        falhaHomefin.map((f) => f.bloco),
                      )
                    }
                  >
                    {salvando && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    Tentar novamente
                  </Button>
                </div>
              </div>
            )}
            <EtapaConferencia
              proposta={p}
              envolvidos={data?.envolvidos ?? []}
              banco={banco}
              salvando={salvando}
              onGravar={gravar}
              onAutosalvar={autosalvar}
            />
          </>
        )}

        {p && elegivel && etapa === "documentos" && (
          <div className="pb-4">
            <AbaEnviarBanco
              clienteId={p.cliente_id}
              propostaId={propostaId}
              envolvidos={data?.envolvidos ?? []}
              proposta={p}
              onCompletar={() => setEtapa("dados")}
              onAcoesEnvio={setEnvioDocs}
            />
          </div>
        )}

        {p && elegivel && etapa === "etapas" && (
          <EtapasKanban proposta={p} banco={banco} onAvancar={setAvancarPara} />
        )}
      </div>

      {/* Navegação entre etapas (a conferência tem o próprio "Gravar e avançar") */}
      {p && elegivel && etapa !== "dados" && (
        <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => setEtapa(etapa === "etapas" ? "documentos" : "dados")}
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          {etapa === "documentos" && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                className="gap-1.5 border-primary/40 text-primary hover:bg-primary/5"
                disabled={!envioDocs?.habilitado}
                onClick={() => envioDocs?.enviar()}
              >
                {envioDocs?.enviando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Landmark className="h-4 w-4" />
                )}
                {envioDocs?.enviando
                  ? "Enviando…"
                  : `Enviar documentos ao banco${envioDocs?.pendentes ? ` (${envioDocs.pendentes})` : ""}`}
              </Button>
              <Button className="gap-1.5" onClick={() => setEtapa("etapas")}>
                Próximas etapas <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      <AlertDialog
        open={!!avancarPara}
        onOpenChange={(o) => !o && !avancando && setAvancarPara(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Avançar para "{avancarPara?.titulo}"?</AlertDialogTitle>
            <AlertDialogDescription>
              A etapa não volta atrás depois de avançar. Confira se a etapa atual está concluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={avancando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={avancando} onClick={confirmarAvanco}>
              {avancando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Avançar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Resumo({ termo, valor }: { termo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{termo}</dt>
      <dd className="truncate font-semibold tabular-nums text-foreground">{valor}</dd>
    </div>
  );
}
