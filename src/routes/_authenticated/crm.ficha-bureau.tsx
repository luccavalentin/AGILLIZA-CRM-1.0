import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, BarChart3, CheckCircle2, FileSearch, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Indicador3D } from "@/components/ui/indicador-3d";
import {
  acompanharConsultaFicha,
  clienteParaFichaBureau,
  consultarFichaBureau,
  listarConsultasBureau,
  obterConfigBureau,
  resumoConsultasBureau,
} from "@/lib/bureau/bureau.functions";
import type { FichaBureau } from "@/lib/bureau/tipos";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { NovaConsulta, type PedidoConsulta } from "@/components/crm/ficha-bureau/nova-consulta";
import { Andamento, CartaoBureau } from "@/components/crm/ficha-bureau/painel-lateral";
import { HistoricoConsultas } from "@/components/crm/ficha-bureau/historico-consultas";
import { RelatorioConsulta } from "@/components/crm/ficha-bureau/relatorio-consulta";
import { Ladrilho, ResultadoFicha } from "@/components/crm/ficha-bureau/resultado-ficha";
import { disponibilidade, type Tom } from "@/components/crm/ficha-bureau/logica";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/_authenticated/crm/ficha-bureau")({
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  head: () => ({ meta: [{ title: "Consulta Ficha — Agilliza" }] }),
  // `?cliente=<id>`: abre com o cliente escolhido e o histórico só dele (como nos assinantes).
  validateSearch: (s: Record<string, unknown>): { cliente?: string } =>
    typeof s.cliente === "string" && UUID.test(s.cliente) ? { cliente: s.cliente } : {},
  component: Pagina,
});

type Fase =
  | { tipo: "preenchendo" }
  | { tipo: "consultando"; registroId?: string; desde?: number; nome?: string | null; clienteId?: string | null }
  | { tipo: "pronto"; ficha: FichaBureau; nome: string | null; clienteId: string | null }
  | { tipo: "falhou"; mensagem: string };

/**
 * Consulta Ficha (C16, 26/10/2026): o mesmo fluxo e desenho da Consulta Ficha dos assinantes
 * no Agilliza Tech — formulário em três passos à esquerda, cartão da marca e resultado à
 * direita, números do mês e histórico com relatório completo. A consulta usa o contrato de
 * bureau do correspondente (Administração › Integrações), sem créditos.
 */
function Pagina() {
  const { cliente: clienteBusca } = Route.useSearch();
  const navigate = useNavigate({ from: "/crm/ficha-bureau" });
  const podeConfigurar = usePermissao("admin.integracoes", "edit");

  const configFn = useServerFn(obterConfigBureau);
  const historicoFn = useServerFn(listarConsultasBureau);
  const resumoFn = useServerFn(resumoConsultasBureau);
  const consultarFn = useServerFn(consultarFichaBureau);
  const acompanharFn = useServerFn(acompanharConsultaFicha);
  const clienteFn = useServerFn(clienteParaFichaBureau);

  const [fase, setFase] = useState<Fase>({ tipo: "preenchendo" });
  const [versao, setVersao] = useState(0);
  const [relatorio, setRelatorio] = useState<string | null>(null);

  const config = useQuery({ queryKey: ["bureau-config"], queryFn: () => configFn() });
  const historico = useQuery({
    queryKey: ["bureau-historico", clienteBusca ?? null],
    queryFn: () => historicoFn({ data: { cliente_id: clienteBusca ?? null } }),
  });
  const resumo = useQuery({ queryKey: ["bureau-resumo"], queryFn: () => resumoFn() });
  const clienteInicial = useQuery({
    queryKey: ["bureau-cliente-inicial", clienteBusca],
    queryFn: () => clienteFn({ data: { id: clienteBusca as string } }),
    enabled: Boolean(clienteBusca),
    staleTime: 5 * 60_000,
  });

  const disp = disponibilidade(config.data);

  // A consulta sai pela fila do worker do Agilliza Tech (APIFull): o pedido volta na hora e o
  // resultado chega em segundos; a tela acompanha o pedido até concluir (ou falhar).
  const consulta = useMutation({
    mutationFn: (p: PedidoConsulta) =>
      consultarFn({
        data: {
          documento: p.documento,
          finalidade: p.finalidade,
          base_legal: p.base,
          autorizou: p.autorizou,
          nome: p.nome,
          cliente_id: p.cliente_id,
        },
      }),
    onMutate: () => setFase({ tipo: "consultando" }),
    onSuccess: (r, p) =>
      setFase({
        tipo: "consultando",
        registroId: r.registroId,
        desde: Date.now(),
        nome: p.nome,
        clienteId: p.cliente_id,
      }),
    onError: (e) =>
      setFase({ tipo: "falhou", mensagem: mensagemDeErro(e, "Não foi possível consultar a ficha.") }),
    onSettled: () => {
      void historico.refetch();
    },
  });

  const emAndamento = fase.tipo === "consultando" && fase.registroId ? fase : null;
  const andamento = useQuery({
    queryKey: ["bureau-andamento", emAndamento?.registroId ?? null],
    queryFn: () => acompanharFn({ data: { id: emAndamento!.registroId! } }),
    enabled: Boolean(emAndamento),
    refetchInterval: 3_000,
    retry: 2,
  });
  useEffect(() => {
    if (!emAndamento) return;
    const r = andamento.data;
    if (r?.situacao === "concluida") {
      setFase({ tipo: "pronto", ficha: r.ficha, nome: emAndamento.nome ?? null, clienteId: emAndamento.clienteId ?? null });
      void historico.refetch();
      void resumo.refetch();
    } else if (r?.situacao === "falhou") {
      setFase({ tipo: "falhou", mensagem: r.mensagem });
      void historico.refetch();
    } else if (andamento.isError) {
      setFase({ tipo: "falhou", mensagem: mensagemDeErro(andamento.error, "Não foi possível acompanhar a consulta.") });
    } else if (emAndamento.desde && Date.now() - emAndamento.desde > 4 * 60_000) {
      setFase({
        tipo: "falhou",
        mensagem:
          "O fornecedor ainda não respondeu. A consulta continua na fila e o resultado aparece no histórico assim que chegar.",
      });
      void historico.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [andamento.data, andamento.isError, andamento.dataUpdatedAt]);

  function novaConsulta() {
    setFase({ tipo: "preenchendo" });
    setVersao((v) => v + 1);
    if (clienteBusca) void navigate({ search: {} });
  }

  const metricas: { icone: typeof FileSearch; tom: Tom | "info"; rotulo: string; valor: string; detalhe: string }[] = [
    {
      icone: FileSearch,
      tom: "info",
      rotulo: "Consultas no mês",
      valor: resumo.data ? resumo.data.mes.toLocaleString("pt-BR") : "—",
      detalhe: resumo.data
        ? `${resumo.data.total.toLocaleString("pt-BR")} concluídas no total`
        : resumo.isError
          ? "Não foi possível carregar"
          : "Carregando…",
    },
    {
      icone: BarChart3,
      tom: "sucesso",
      rotulo: "Score médio",
      valor: resumo.data?.scoreMedio != null ? String(resumo.data.scoreMedio) : "—",
      detalhe: "dos titulares consultados (0 a 1.000)",
    },
    {
      icone: disp.disponivel ? CheckCircle2 : AlertTriangle,
      tom: disp.disponivel ? "sucesso" : "alerta",
      rotulo: "Bureau",
      valor: config.isLoading ? "…" : disp.disponivel ? "Ativo" : "Indisponível",
      detalhe: disp.fornecedor ?? "Nenhum fornecedor contratado",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 p-3 sm:space-y-6 sm:p-6">
      <PageHeader
        secao="CRM"
        icone={<FileSearch className="size-5" />}
        titulo="Consulta Ficha"
        descricao="Score, restrições e protestos do titular no bureau de crédito, com registro LGPD de cada consulta."
      />

      {config.isError && (
        <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-destructive">
            {mensagemDeErro(config.error, "Não foi possível ler a configuração do bureau.")}
          </p>
          <button
            type="button"
            onClick={() => void config.refetch()}
            className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm font-medium"
          >
            Tentar de novo
          </button>
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] xl:gap-5">
        <NovaConsulta
          disp={disp}
          carregandoConfig={config.isLoading}
          podeConfigurar={podeConfigurar}
          clienteInicial={
            clienteInicial.data
              ? {
                  id: clienteInicial.data.id,
                  nome: clienteInicial.data.nome,
                  documento: clienteInicial.data.documento,
                  celular: clienteInicial.data.celular,
                }
              : null
          }
          ocupado={consulta.isPending || fase.tipo === "consultando"}
          erro={null}
          onConsultar={(p) => consulta.mutate(p)}
          versao={versao}
        />

        <div className="space-y-4 xl:sticky xl:top-20" data-tour="ficha-resultado">
          <CartaoBureau
            disp={disp}
            carregando={config.isLoading}
            consultasMes={resumo.data?.mes ?? null}
          />
          <div aria-live="polite" className="space-y-4">
            {fase.tipo === "consultando" && <Andamento />}
            {fase.tipo === "pronto" && (
              <ResultadoFicha
                ficha={fase.ficha}
                titulo={fase.nome}
                clienteId={fase.clienteId}
                fornecedor={disp.fornecedor}
                acoesExtras={
                  <button
                    type="button"
                    onClick={novaConsulta}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground transition hover:border-primary/40 hover:text-primary"
                  >
                    <RotateCcw className="size-4" aria-hidden /> Nova consulta
                  </button>
                }
              />
            )}
            {fase.tipo === "falhou" && (
              <section className="space-y-3 rounded-2xl border border-destructive/30 bg-card p-4 shadow-sm sm:p-5">
                <div className="flex items-start gap-3">
                  <Ladrilho icone={AlertTriangle} tom="perigo" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">A consulta não foi concluída</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{fase.mensagem}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  A tentativa ficou registrada no histórico (LGPD).
                </p>
                <button
                  type="button"
                  onClick={() => setFase({ tipo: "preenchendo" })}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground transition hover:border-primary/40 hover:text-primary"
                >
                  <RotateCcw className="size-4" aria-hidden /> Tentar de novo
                </button>
              </section>
            )}
            {fase.tipo === "preenchendo" && (
              <div className="hidden rounded-2xl border border-dashed border-border p-6 text-center xl:block">
                <p className="text-sm font-medium text-foreground">O resultado aparece aqui</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Medidor de score, apontamentos e o detalhe de cada restrição.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-3" data-tour="ficha-indicadores">
        {metricas.map((m, i) => (
          <Indicador3D
            key={m.rotulo}
            icone={m.icone}
            tom={m.tom === "info" ? "marca" : m.tom}
            rotulo={m.rotulo}
            valor={m.valor}
            detalhe={m.detalhe}
            className={i === 2 ? "col-span-2 xl:col-span-1" : undefined}
          />
        ))}
      </div>

      <HistoricoConsultas
        linhas={historico.data ?? []}
        carregando={historico.isLoading}
        erro={
          historico.isError
            ? mensagemDeErro(historico.error, "Não foi possível carregar o histórico.")
            : null
        }
        onTentar={() => void historico.refetch()}
        onAbrir={setRelatorio}
        filtradoPorCliente={Boolean(clienteBusca)}
        onVerTodas={() => void navigate({ search: {} })}
      />

      <RelatorioConsulta
        id={relatorio}
        fornecedor={disp.fornecedor}
        onFechar={() => setRelatorio(null)}
      />
    </div>
  );
}
