import * as React from "react";
import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { corDoBanco } from "@/lib/bancos/cores";
import { numeroBancoParaExibir } from "@/lib/propostas/numero-banco-display";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Send,
  Ban,
  Loader2,
  Plus,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Building2,
  Info,
  AlertCircle,
  Clock,
  Check,
  LayoutDashboard,
  Users,
  Store,
  ClipboardList,
  Home,
  FolderOpen,
  Activity,
  MessageSquare,
  ChevronDown,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { assertModuloPermitido } from "@/lib/route-guards";
import { propostaQueryOptions } from "@/lib/propostas/queries";

import {
  obterProposta,
  selecionarBancoProposta,
  sincronizarProposta,
  cancelarProposta,
  moverStatusProposta,
  adicionarFollowup,
  adicionarEnvolvido,
  obterConjugeCliente,
  atualizarEnvolvido,
  removerEnvolvido,
  registrarDocumento,
  removerDocumento,
  urlDocumento,
  salvarIq,
  definirSituacaoBanco,
  SITUACOES_BANCO,
  excluirPropostaDefinitivamente,
  restaurarProposta,
} from "@/lib/propostas/propostas.functions";
import { 
  faltantesEnvolvido, 
  descreverParticipante 
} from "@/lib/propostas/campos-obrigatorios";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { VisualizadorArquivo } from "@/components/comum/visualizador-arquivo";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PipelineStepper } from "@/components/propostas/pipeline-stepper";
import { FunilBancoTimeline } from "@/components/propostas/funil-banco-timeline";
import { PropostaStatusBadge } from "@/components/propostas/status-badge";
import { statusBancoConfig, bancoJaEnviado } from "@/components/proposta/status-bancos-proposta";
import { BradescoRetornoTimer, isBradesco } from "@/components/proposta/bradesco-timer";
import { ToneBadge } from "@/components/crm/tone-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  baixarPropostaSimplificadaPDF,
  baixarPropostaDetalhadaPDF,
  baixarPropostaConsolidadoPDF,
} from "@/lib/propostas/pdf-lazy";
import { TRANSICOES, STATUS_EDITAVEIS, type PropostaStatus } from "@/lib/propostas/state-machine";
import { statusProposta } from "@/components/propostas/status";
import { formatBRL } from "@/lib/simulacao/format";
import { cn } from "@/lib/utils";
import {
  ParticipanteDialog,
  envolvidoParaForm,
  type ParticipanteForm,
} from "@/components/proposta/participante-form";
import { ClienteSecao } from "@/components/proposta/cliente-secoes";
import { AbaEnviarBanco } from "@/components/proposta/aba-enviar-banco";
import { TabIq } from "@/components/proposta/tabs/tab-iq";
import { TabImovel } from "@/components/proposta/tabs/tab-imovel";
import { TabDocumentos } from "@/components/proposta/tabs/tab-documentos";
import { TabAtividades } from "@/components/proposta/tabs/tab-atividades";
import { TabFup } from "@/components/proposta/tabs/tab-fup";
import { TabEnvolvidos } from "@/components/proposta/tabs/tab-envolvidos";
import { TabResumo } from "@/components/proposta/tabs/tab-resumo";
import { AcoesTopo } from "@/components/proposta/acoes-topo";
import { DetalhamentoBancoDialog } from "@/components/proposta/dialogs/detalhamento-banco-dialog";
import { EnvioResultadoDialog } from "@/components/proposta/dialogs/envio-resultado-dialog";
import {
  SITUACAO_BANCO_LABEL,
  SITUACAO_BANCO_TONE,
  type SituacaoBanco,
} from "@/components/proposta/situacao-banco-labels";
import { useEnviarProposta } from "@/hooks/use-enviar-proposta";

const RestaurarBotao = ({ id }: { id: string }) => {
  const router = useRouter();
  const qc = useQueryClient();
  const restaurarFn = useServerFn(restaurarProposta);
  const [loading, setLoading] = React.useState(false);

  const handleRestaurar = async () => {
    try {
      setLoading(true);
      await restaurarFn({ data: { id } });
      toast.success("Proposta restaurada com sucesso!");
      qc.invalidateQueries({ queryKey: ["proposta", id] });
      router.invalidate();
    } catch (error: any) {
      toast.error(error.message || "Erro ao restaurar proposta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="default" onClick={handleRestaurar} disabled={loading}>
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
      Restaurar Proposta
    </Button>
  );
};

const ExcluirDefinitivoBotao = ({ id }: { id: string }) => {
  const router = useRouter();
  const excluirDefinitivoFn = useServerFn(excluirPropostaDefinitivamente);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const handleExcluir = async () => {
    try {
      setLoading(true);
      await excluirDefinitivoFn({ data: { id } });
      toast.success("Proposta excluída definitivamente!");
      router.navigate({ to: "/operacional/propostas", replace: true });
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir definitivamente");
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" disabled={loading}>
          <Trash2 className="mr-2 h-4 w-4" />
          Excluir Definitivamente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir permanentemente?</DialogTitle>
          <DialogDescription>
            Esta ação não pode ser desfeita. A proposta e todos os seus registros relacionados (bancos, documentos, histórico) serão apagados para sempre.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleExcluir} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Exclusão Definitiva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


export const Route = createFileRoute("/_authenticated/operacional/propostas_/$id")({
  head: () => ({ meta: [{ title: "Proposta — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.propostas"),
  validateSearch: (search: Record<string, unknown>): { complementar?: 1; abrir_cadastro?: string } =>
    ({ 
      complementar: search.complementar === 1 || search.complementar === "1" ? 1 : undefined,
      abrir_cadastro: typeof search.abrir_cadastro === 'string' ? search.abrir_cadastro : undefined
    }),
  component: Pagina,
  errorComponent: ({ error, reset }: { error: any; reset: () => void }) => {
    const router = useRouter();
    const e = error as any;
    // O ID da proposta pode vir do router ou do próprio erro se injetado no throw
    const { id } = Route.useParams();
    
    // Identificação de erro de permissão
    const isPermissionError = e?.message?.includes("permissão") || e?.status === 403;
    
    // Identificação de falha de rede/conectividade
    const isNetworkError = e?.message?.includes("fetch") || e?.message?.includes("Network Error") || e?.name === "TypeError";

    // Proposta Excluída
    const prop = e?.proposta || e?.data?.proposta;
    const isDeleted = prop?.deleted_at;

    if (isPermissionError) {
      return (
        <div className="p-8 max-w-2xl mx-auto space-y-6 text-center">
          <div className="flex flex-col items-center gap-4 text-destructive">
            <div className="p-4 bg-destructive/10 rounded-full">
              <Ban className="h-12 w-12" />
            </div>
            <h1 className="text-2xl font-bold">Acesso Negado</h1>
          </div>
          <p className="text-muted-foreground">Você não tem permissão para acessar o módulo de propostas ou este registro específico.</p>
          <Button variant="outline" onClick={() => router.navigate({ to: "/operacional/propostas" })} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para a lista
          </Button>
        </div>
      );
    }


    if (isDeleted) {
      return (
        <div className="p-8 max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-3 text-destructive">
            <Trash2 className="h-8 w-8" />
            <h1 className="text-2xl font-bold">Esta proposta foi excluída</h1>
          </div>
          
          <div className="bg-muted p-6 rounded-lg space-y-4 text-sm border shadow-sm">
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <span className="font-semibold text-muted-foreground text-right">Data:</span>
              <span>{formatarDataHora(prop.deleted_at)}</span>
              
              <span className="font-semibold text-muted-foreground text-right">Usuário:</span>
              <span>{prop.nome_excluidor || prop.deleted_by || "Não identificado"}</span>
              
              {prop.deleted_motivo && (
                <>
                  <span className="font-semibold text-muted-foreground text-right">Motivo:</span>
                  <span className="italic">"{prop.deleted_motivo}"</span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-4">
            <Button variant="outline" onClick={() => router.navigate({ to: "/operacional/propostas" })}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para a lista
            </Button>
            
            <RestaurarBotao id={id} />
            <ExcluirDefinitivoBotao id={id} />
          </div>
        </div>
      );
    }







    if (e?.message === "Proposta não encontrada.") {
      return (
        <div className="p-8 max-w-2xl mx-auto space-y-6 text-center">
          <div className="flex flex-col items-center gap-4 text-muted-foreground">
            <div className="p-4 bg-muted rounded-full">
              <FileText className="h-12 w-12" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Proposta não encontrada</h1>
          </div>
          <p className="text-muted-foreground">A proposta solicitada não foi encontrada. Ela pode ter sido removida permanentemente.</p>
          <Button variant="outline" onClick={() => router.navigate({ to: "/operacional/propostas" })} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para a lista
          </Button>
        </div>
      );
    }

    const title = isNetworkError ? "Falha de conexão" : "Erro ao carregar proposta";
    const msg = isNetworkError ? "Não foi possível conectar ao servidor. Verifique sua internet." : (e?.message || "Ocorreu um erro inesperado ao tentar abrir esta proposta.");

    return (
      <div className="p-8 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3 text-destructive">
          <AlertCircle className="h-8 w-8" />
          <h1 className="text-xl font-semibold">{title}</h1>
        </div>
        
        <p className="text-muted-foreground">{msg}</p>

        <Accordion type="single" collapsible className="w-full border rounded-lg bg-muted/30">
          <AccordionItem value="details" className="border-none">
            <AccordionTrigger className="px-4 py-2 hover:no-underline text-xs text-muted-foreground">
              Detalhes técnicos
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <pre className="text-[10px] overflow-auto max-h-[300px] p-3 bg-black/5 rounded font-mono">
                {JSON.stringify({
                  name: e?.name,
                  message: e?.message,
                  stack: e?.stack,
                  cause: e?.cause,
                  data: e?.data
                }, null, 2)}
              </pre>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex gap-3">
          <Button onClick={() => reset()} size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
          <Button variant="ghost" size="sm" onClick={() => router.navigate({ to: "/operacional/propostas" })}>
            Voltar
          </Button>
        </div>
      </div>
    );
  },
});

const TABS = [
  "RESUMO",
  "COMPRADORES",
  "VENDEDORES",
  "IQ",
  "IMÓVEL",
  "DOCUMENTOS",
  "ENVIAR_BANCO",
  "ATIVIDADES",
  "FUP",
] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Partial<Record<Tab, string>> = {
  ENVIAR_BANCO: "Enviar ao banco",
  FUP: "Follow-up",
};

const TAB_ICONS: Record<Tab, React.ComponentType<{ className?: string }>> = {
  RESUMO: LayoutDashboard,
  COMPRADORES: Users,
  VENDEDORES: Store,
  IQ: ClipboardList,
  IMÓVEL: Home,
  DOCUMENTOS: FolderOpen,
  ENVIAR_BANCO: Upload,
  ATIVIDADES: Activity,
  FUP: MessageSquare,
};

/** Formata data/hora em pt-BR (ex.: "12/07/2026 14:30"). */
function formatarDataHora(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T"));
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo",  
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}



function Pagina() {
  const { id } = Route.useParams();
  const { complementar } = Route.useSearch();
  const router = useRouter();
  const qc = useQueryClient();
  const { enviar: handleEnviarHook } = useEnviarProposta();

  const { data, isLoading, isError, error, refetch } = useQuery({
    ...propostaQueryOptions(id),
    refetchInterval: (q: any) => {
      const st = q.state.data?.proposta?.status as string | undefined;
      if (!st) return 30_000;
      const terminais = ["contrato_emitido", "cancelada", "credito_recusado"];
      return terminais.includes(st) ? false : 15_000;
    },
    refetchOnWindowFocus: true,
  });

  // Se a query falhou, lança o erro para o errorComponent capturar
  if (isError) {
    throw error;
  }

  if (isLoading) {
    return (
      <div className="flex h-[400px] w-full flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Carregando proposta...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 max-w-2xl mx-auto space-y-6 text-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <div className="p-4 bg-muted rounded-full">
            <FileText className="h-12 w-12" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Proposta não encontrada</h1>
        </div>
        <p className="text-muted-foreground">Não foi possível localizar os dados desta proposta.</p>
        <Button variant="outline" onClick={() => router.navigate({ to: "/operacional/propostas" })} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para a lista
        </Button>
      </div>
    );
  }

  const bancos = data?.bancos ?? [];
  const envolvidos = data?.envolvidos ?? [];
  const p = data?.proposta as any;

  const [tab, setTab] = React.useState<Tab>("RESUMO");
  const [enviandoAuto, setEnviandoAuto] = React.useState(false);
  const [destacarObrigatorios, setDestacarObrigatorios] = React.useState(false);
  const [participanteModal, setParticipanteModal] = React.useState<any>(null);
  const { abrir_cadastro } = Route.useSearch();
  const [indiceParticipante, setIndiceParticipante] = React.useState(0);

  React.useEffect(() => {
    if (abrir_cadastro && envolvidos.length > 0) {
      const env = envolvidos.find((e: any) => e.id === abrir_cadastro);
      if (env) {
        setParticipanteModal(env);
        const idx = envolvidos.findIndex((e: any) => e.id === abrir_cadastro);
        setIndiceParticipante(idx + 1);
        
        // Limpa a query string para não reabrir ao atualizar
        router.navigate({
            to: "/operacional/propostas/$id",
            params: { id },
            search: (prev: any) => {
                const { abrir_cadastro: _, ...rest } = prev;
                return rest;
            },
            replace: true
        });
      }
    }
  }, [abrir_cadastro, envolvidos, id, router]);

  const onCadastroIncompleto = React.useCallback((envolvidoPendente: any) => {
    setTab("COMPRADORES");
    setDestacarObrigatorios(true);
    if (envolvidoPendente && envolvidoPendente.id) {
      setParticipanteModal(envolvidoPendente);
      const idx = envolvidos.findIndex((e: any) => e.id === envolvidoPendente.id);
      setIndiceParticipante(idx + 1);
    } else {
      // Se não passou envolvido, procura o primeiro com faltantes
      const pendente = envolvidos.find((e: any) => faltantesEnvolvido(e).length > 0);
      if (pendente) {
        setParticipanteModal(pendente);
        const idx = envolvidos.findIndex((e: any) => e.id === pendente.id);
        setIndiceParticipante(idx + 1);
      }
    }
  }, [envolvidos]);

  const onCadastroIncompletoSemArgs = React.useCallback(() => {
    onCadastroIncompleto(null);
  }, [onCadastroIncompleto]);

  const handleEnviarAposCadastro = React.useCallback(async () => {
    // Reenviar para todos os bancos pendentes após fechar o modal de cadastro
    const bancosPendentes = (bancos ?? []).filter((b: any) => b.selecionado && !bancoJaEnviado(b));
    if (bancosPendentes.length > 0) {
      await handleEnviarHook({
        propostaId: id,
        bancoId: "todos",
        envolvidos,
        onCadastroIncompleto: onCadastroIncompletoSemArgs
      });
    }
  }, [bancos, envolvidos, id, handleEnviarHook, onCadastroIncompleto]);

  const pendentes = React.useMemo(() => {
    return (envolvidos ?? []).map((env, index) => ({
      env,
      faltantes: faltantesEnvolvido(env || {}),
      index: index + 1
    })).filter((item: any) => item.faltantes && item.faltantes.length > 0);
  }, [envolvidos]);

  const totalPendentes = (envolvidos ?? []).length;
  const proximoPendente = pendentes[0];

  const inicialParticipante = React.useMemo(
    () => (participanteModal ? envolvidoParaForm(participanteModal) : undefined),
    [participanteModal?.id]
  );
  const conjugeInicialParticipante = React.useMemo(() => {
    if (!participanteModal?.id) return undefined;
    const conjuge = envolvidos.find(
      (env: any) =>
        env.conjuge_de === participanteModal.id ||
        (participanteModal.conjuge_id && env.id === participanteModal.conjuge_id),
    );
    return conjuge ? envolvidoParaForm(conjuge) : undefined;
  }, [participanteModal?.id, participanteModal?.conjuge_id]);

  const abrirCadastroPendente = () => {
    if (!proximoPendente) return;
    setParticipanteModal(proximoPendente.env);
    setIndiceParticipante(proximoPendente.index);
  };

  // Polling automático silencioso da API do banco (Itaú, Santander, Bradesco…).
  // Enquanto a proposta estiver em análise ativa, dispara sincronização a cada 60s
  // para trazer o retorno do banco sem depender do clique manual em "Sincronizar".
  const sincronizarAutoFn = useServerFn(sincronizarProposta);
  const propostaStatus = data?.proposta?.status as string | undefined;
  // Só faz sentido consultar o banco quando a proposta já foi efetivamente
  // enviada (existe protocolo/numero do banco em alguma linha). Sem isso o
  // polling gerava autenticação e chamadas contínuas sem nada para ler.
  const temProtocoloBanco = (data?.bancos ?? []).some(
    (b: any) => !!(b.numero_proposta_banco || b.homefin_id_proposta || b.codigo_oportunidade_homefin),
  );
  React.useEffect(() => {
    const terminais = ["contrato_emitido", "cancelada", "credito_recusado", "rascunho"];
    if (!propostaStatus || terminais.includes(propostaStatus)) return;
    if (!temProtocoloBanco) return;
    let cancelado = false;
    let falhasSeguidas = 0;
    let avisouFalha = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Intervalo base de 5 minutos, com backoff progressivo (até 20 min) para
    // não manter a integração sob consulta contínua.
    const BASE = 5 * 60_000;
    let intervalo = BASE;
    const agendar = () => {
      if (cancelado) return;
      timer = setTimeout(tick, intervalo);
    };
    const tick = async () => {
      if (cancelado) return;
      try {
        const r = await sincronizarAutoFn({ data: { proposta_id: id } });
        falhasSeguidas = 0;
        intervalo = BASE;
        if (!cancelado && r?.atualizado) {
          qc.invalidateQueries({ queryKey: ["proposta", id] });
        }
      } catch {
        falhasSeguidas++;
        intervalo = Math.min(intervalo * 2, 20 * 60_000);
        // Após 3 falhas seguidas, para de tentar e avisa uma única vez.
        if (falhasSeguidas >= 3) {
          if (!avisouFalha) {
            avisouFalha = true;
            toast.warning(
              "Sincronização automática indisponível. Use o botão 'Sincronizar' para tentar manualmente.",
              { duration: 8_000 },
            );
          }
          return;
        }
      }
      agendar();
    };
    // Espera 60s antes do primeiro poll: bancos levam alguns segundos para
    // propagar a inclusão da proposta.
    timer = setTimeout(tick, 60_000);
    return () => {
      cancelado = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, propostaStatus, temProtocoloBanco, sincronizarAutoFn, qc]);


  // Envia a proposta ao banco de forma automática (usado tanto após salvar o
  // cadastro complementar quanto quando o cadastro já veio pronto do CRM).
  const enviouAutoRef = useRef(false);
  async function enviarAposComplementar() {
    if (enviouAutoRef.current) return;
    enviouAutoRef.current = true;
    setEnviandoAuto(true);
    try {
      // Passa pelo gate único: ressincroniza CRM → proposta, valida os campos
      // obrigatórios e, se faltar algo, abre o cadastro em vez de enviar.
      const r = await handleEnviarHook({
        propostaId: id,
        bancoId: "todos", // Na tela de detalhe, envia todos os selecionados
        envolvidos,
        onCadastroIncompleto,
      });
      if (!r) {
        // Bloqueado por cadastro incompleto — libera nova tentativa.
        enviouAutoRef.current = false;
        return;
      }
      const numero =
        r?.bancos?.find((x: any) => x?.numero_proposta_banco)?.numero_proposta_banco ?? null;
      if (numero) toast.success(`Nº do banco: ${numero}`);
      setTab("RESUMO");
    } catch {
      // Mensagem já exibida pelo gate; permite nova tentativa.
      enviouAutoRef.current = false;
    } finally {
      setEnviandoAuto(false);
    }
  }

  // Ao chegar de "Criar proposta", tenta o envio direto. A integração bancária
  // passa a ser a fonte de verdade para validar campos faltantes.
  React.useEffect(() => {
    if (complementar !== 1) return;
    if (enviouAutoRef.current) return;
    router.navigate({
      to: "/operacional/propostas/$id",
      params: { id },
      search: {},
      replace: true,
    });
    void enviarAposComplementar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complementar]);




  // realtime na proposta, nos bancos e no histórico — qualquer mudança dispara
  // uma reconsulta da proposta para refletir o retorno do banco em tempo real.
  React.useEffect(() => {
    const invalidar = () => qc.invalidateQueries({ queryKey: ["proposta", id] });
    const channel = supabase
      .channel(`proposta-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "propostas", filter: `id=eq.${id}` },
        invalidar,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "proposta_bancos", filter: `proposta_id=eq.${id}` },
        invalidar,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "proposta_historico", filter: `proposta_id=eq.${id}` },
        invalidar,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  if (isLoading || !data) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }

  const status = p.status as PropostaStatus;
  const diasDesde = Math.max(
    0,
    Math.round((Date.now() - new Date(p.created_at).getTime()) / 86400000),
  );
  const bancosEnviados = (data.bancos ?? []).filter(
    (b: any) => b.selecionado || b.status_banco === "enviada",
  );
  const multiBanco = bancosEnviados.length > 1;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 p-4 md:p-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground">
        <Link to="/operacional/propostas">
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para propostas
        </Link>
      </Button>

      {(data.bancos ?? []).some(
        (b: any) =>
          isBradesco(b.nome_banco) &&
          bancoJaEnviado(b) &&
          ["enviada", "em_analise", "", null, undefined].includes(b.status_banco),
      ) && <BradescoRetornoTimer enviadoEm={p.enviada_em} />}

      {/* Header */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {p.produto ?? "Operação"}
            </span>
            <h1 className="mt-2 truncate text-2xl font-semibold text-foreground">
              {(() => { const nb = numeroBancoParaExibir(p.numero_proposta_banco); return nb ? `Proposta banco ${nb}` : `Proposta ${p.numero_proposta}`; })()}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {numeroBancoParaExibir(p.numero_proposta_banco) && <span className="mr-2">Interno {p.numero_proposta} ·</span>}
              {status === "cancelada"
                ? "Proposta cancelada"
                : `Ativa há ${diasDesde} dia(s)`}
            </p>
          </div>
          <AcoesTopo proposta={p} propostaId={id} bancos={data.bancos} envolvidos={data.envolvidos} documentos={data.documentos} followups={data.followups} onCadastroIncompleto={onCadastroIncompletoSemArgs} />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 divide-y divide-border border-b border-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3">
          <Kpi
            label={multiBanco ? "Bancos enviados" : "Banco escolhido"}
            valor={
              multiBanco ? (
                `${bancosEnviados.length} bancos`
              ) : p.nome_banco ? (
                <span className="flex min-w-0 items-center gap-2">
                  <BancoLogo nome={p.nome_banco} size="lg" className="shrink-0" />
                  <span
                    className="truncate"
                    style={{ color: corDoBanco(p.nome_banco) }}
                  >
                    {p.nome_banco}
                  </span>
                </span>
              ) : (
                <div className="flex flex-col items-start gap-1">
                  <span className="text-destructive font-medium animate-bounce-subtle">
                    Escolha um banco para prosseguir
                  </span>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Vá na aba "Enviar ao Banco" e selecione as opções desejadas.
                  </p>
                </div>
              )
            }
          />
          <Kpi label="Valor financiado" valor={formatBRL(p.valor_financiamento)} />
          <Kpi
            label="Situação"
            valor={
              multiBanco ? (
                <span className="text-sm text-muted-foreground">Ver por banco abaixo</span>
              ) : (
                <PropostaStatusBadge status={status} banco={p.nome_banco} />
              )
            }
          />
        </div>

        {multiBanco && (
          <div className="border-b border-border p-5">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Situação por banco
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {bancosEnviados.map((b: any) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <BancoLogo nome={b.nome_banco} size="md" className="shrink-0" />
                    <span
                      className="truncate text-sm font-semibold"
                      style={{ color: corDoBanco(b.nome_banco) }}
                    >
                      {b.nome_banco}
                    </span>
                  </span>
                  <ToneBadge
                    tone={SITUACAO_BANCO_TONE[(b.situacao_banco as SituacaoBanco) ?? "nao_enviado"]}
                  >
                    {SITUACAO_BANCO_LABEL[(b.situacao_banco as SituacaoBanco) ?? "nao_enviado"]}
                  </ToneBadge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Banco feedback / Error messages */}
        {bancos.map((b: any) => {
          const erroMsg = b.mensagem_banco || b.mensagem;
          if (!erroMsg && !b.retorno_integracao) return null;

          // 3. APROVEITAR O LIMITE QUE O SANTANDER DEVOLVE
          const originalMsg = String(b.retorno_integracao || "");
          const santanderRangeMatch = originalMsg.match(/"max":\s*(\d+)/);
          const valorMax = santanderRangeMatch ? Number(santanderRangeMatch[1]) : null;
          const valorInformadoMatch = originalMsg.match(/"valueProvided":\s*(\d+)/);
          const valorInformado = valorInformadoMatch ? Number(valorInformadoMatch[1]) : null;
          const diferenca = valorInformado && valorMax ? valorInformado - valorMax : 0;

          return (
            <div
              key={b.id}
              className={cn(
                "mt-4 flex flex-col gap-3 rounded-xl border p-4 mx-5 mb-5 shadow-sm",
                b.status_banco === "erro"
                  ? "border-destructive/20 bg-destructive/5"
                  : b.status_banco === "recusada" && valorMax
                  ? "border-warning/30 bg-warning/5"
                  : "border-primary/20 bg-primary/5",
              )}
            >
              <div className="flex items-start gap-3">
                {b.status_banco === "erro" ? (
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                ) : b.status_banco === "recusada" && valorMax ? (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                ) : (
                  <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                )}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">
                      Retorno do {b.nome_banco}
                    </p>
                    {b.status_banco === "recusada" && valorMax && (
                       <span className="text-[10px] font-bold uppercase tracking-wider text-warning">Regra de limite</span>
                    )}
                  </div>
                  
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {erroMsg || "O banco não informou o motivo detalhado."}
                  </p>

                  {b.status_banco === "recusada" && valorMax && (
                    <div className="mt-2 space-y-2 border-t border-warning/20 pt-2">
                      <p className="text-xs font-medium text-warning-foreground">
                        Diferença: <span className="font-bold">{formatBRL(diferenca)}</span> acima do limite deste banco.
                      </p>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 gap-1.5 text-[11px] font-bold uppercase tracking-wider border-warning/50 text-warning-foreground hover:bg-warning/10"
                        onClick={async () => {
                          const tid = toast.loading("Ajustando valor e reenviando...");
                          try {
                            const { error: updErr } = await supabase
                              .from("propostas")
                              .update({ valor_financiamento: valorMax } as any)
                              .eq("id", id);
                            if (updErr) throw updErr;
                            await handleEnviarHook({ propostaId: id, bancoId: b.banco_id });
                            toast.success(`Proposta ajustada para ${formatBRL(valorMax)} e reenviada!`, { id: tid });
                          } catch (e: any) {
                            toast.error(e.message || "Falha ao ajustar e reenviar.", { id: tid });
                          }
                        }}
                      >
                         Ajustar para {formatBRL(valorMax)} e reenviar
                      </Button>
                    </div>
                  )}
                  
                  {(b.retorno_integracao || b.codigo_situacao_banco) && (
                    <div className="mt-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                            Detalhes técnicos <ChevronDown className="ml-1 h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="max-w-[400px]">
                          <div className="p-3 text-[11px] font-mono leading-normal text-muted-foreground">
                            {b.codigo_situacao_banco && (
                              <div className="mb-2">
                                <span className="font-bold text-foreground">Código banco:</span> {b.codigo_situacao_banco}
                              </div>
                            )}
                            {b.retorno_integracao && (
                              <div>
                                <span className="font-bold text-foreground">Payload:</span>
                                <pre className="mt-1 max-h-[200px] overflow-auto whitespace-pre-wrap rounded bg-muted/50 p-2 text-[10px]">
                                  {typeof b.retorno_integracao === 'string' 
                                    ? b.retorno_integracao 
                                    : JSON.stringify(b.retorno_integracao, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        <div className="p-5">
          <PipelineStepper status={status} detalheStatus={p.detalhe_status_atual} />
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
            {p.status_atualizado_em && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Nesta etapa desde {formatarDataHora(p.status_atualizado_em)}
              </span>
            )}
            {p.ultima_sincronizacao_em && (
              <span className="inline-flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                Última leitura do banco: {formatarDataHora(p.ultima_sincronizacao_em)}
              </span>
            )}
            {p.contrato_emitido_em && (
              <span className="inline-flex items-center gap-1 font-medium text-success">
                <Check className="h-3 w-3" />
                Contrato emitido em {formatarDataHora(p.contrato_emitido_em)}
              </span>
            )}
          </div>
        </div>

      </div>

      {/* Tabs — barra sofisticada com ícones, gradient underline e halo do ativo */}
      <div className="relative rounded-xl border border-border/70 bg-gradient-to-b from-card to-muted/30 p-1.5 shadow-sm">
        <div className="flex snap-x snap-mandatory gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => {
            const Icone = TAB_ICONS[t];
            const ativo = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "group relative flex shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider transition-all duration-300",
                  ativo
                    ? "bg-primary text-primary-foreground shadow-[0_4px_14px_-4px_hsl(var(--primary)/0.5)] ring-1 ring-primary/30"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icone
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform duration-300",
                    ativo ? "scale-110" : "group-hover:scale-110",
                  )}
                />
                <span>{TAB_LABELS[t] ?? t}</span>
                {ativo && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-3 bottom-0.5 h-[2px] rounded-full bg-gradient-to-r from-transparent via-primary-foreground/80 to-transparent"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>


      <div key={tab} className="animate-fade-in">
        {tab === "RESUMO" && <TabResumo proposta={p} bancos={data.bancos} propostaId={id} />}
        {tab === "COMPRADORES" && <ClienteSecao clienteId={p.cliente_id} propostaId={id} secao="comprador" destacarObrigatorios={destacarObrigatorios} onSalvoComprador={() => setTab("RESUMO")} idBanco={data.bancos?.[0]?.id_banco} />}
        {tab === "VENDEDORES" && <ClienteSecao clienteId={p.cliente_id} propostaId={id} secao="vendedores" />}
        {tab === "IQ" && <ClienteSecao clienteId={p.cliente_id} propostaId={id} secao="iq" />}
        {tab === "IMÓVEL" && <ClienteSecao clienteId={p.cliente_id} propostaId={id} secao="imovel" />}
        {tab === "DOCUMENTOS" && <ClienteSecao clienteId={p.cliente_id} propostaId={id} secao="documentos" />}
        {tab === "ENVIAR_BANCO" && (
          <AbaEnviarBanco
            clienteId={p.cliente_id}
            propostaId={id}
            envolvidos={data.envolvidos}
            proposta={p}
            onCompletar={(env) => {
              if (env.tipo_qualificacao === "CO") {
                setTab("COMPRADORES");
                setDestacarObrigatorios(true);
              } else {
                setParticipanteModal(env);
              }
            }}
          />
        )}
        {tab === "ATIVIDADES" && <TabAtividades historico={data.historico} />}
        {tab === "FUP" && <TabFup propostaId={id} followups={data.followups} />}
      </div>

      <ParticipanteDialog
        open={Boolean(participanteModal)}
        onOpenChange={(v) => !v && setParticipanteModal(null)}
        titulo="Completar dados do participante"
        avisoTopo={
          participanteModal && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive font-medium leading-relaxed">
              <AlertTriangle className="inline-block h-4 w-4 mr-1.5 align-text-bottom" />
              Falta{faltantesEnvolvido(participanteModal).length === 1 ? "" : "m"} {faltantesEnvolvido(participanteModal).length} dado{faltantesEnvolvido(participanteModal).length === 1 ? "" : "s"} obrigatório{faltantesEnvolvido(participanteModal).length === 1 ? "" : "s"} de{" "}
              {descreverParticipante(participanteModal)} para enviar ao banco. Preencha os campos destacados em vermelho.
            </div>
          )
        }
        participanteIndex={indiceParticipante}
        totalParticipantes={totalPendentes}
        inicial={inicialParticipante}
        conjugeInicial={conjugeInicialParticipante}
        participanteId={participanteModal?.id}
        focarPendencias={true}
        nomeConjugeExistente={React.useMemo(() => {
          if (!participanteModal?.id) return null;
          // Se o participante atual é titular e tem um cônjuge que já está na lista de envolvidos
          const principal = p.envolvidos.find((e: any) => e.id === participanteModal.id);
          if (!principal || principal.tipo_qualificacao === 'CJ') return null;
          
          const conj = p.envolvidos.find((e: any) => e.conjuge_de === principal.id || (principal.conjuge_id && e.id === principal.conjuge_id));
          return conj?.nome || null;
        }, [p.envolvidos, participanteModal?.id])}
        onSalvar={async (principal, conjuge, opcoes) => {
          if (!participanteModal?.id) return;
          let enviandoAoBanco = false;
          try {
            await atualizarEnvolvido({
              data: { id: participanteModal.id, dados: principal },
            });
            if (conjuge && participanteModal.conjuge_id) {
              await atualizarEnvolvido({
                data: { id: participanteModal.conjuge_id, dados: conjuge },
              });
            } else if (conjuge) {
              await adicionarEnvolvido({
                data: {
                  proposta_id: id,
                  dados: {
                    ...conjuge,
                    tipo_qualificacao: "TI",
                    conjuge_de: participanteModal.id,
                  },
                },
              });
            }
            // Lê a proposta novamente sem invalidar/remontar o formulário. A
            // resposta atualizada é usada para decidir o próximo passo.
            const atualizada: any = await qc.fetchQuery({
              ...propostaQueryOptions(id),
              staleTime: 0,
            });
            const envolvidosAtualizados = atualizada?.envolvidos ?? [];
            const novosPendentes = envolvidosAtualizados
              .map((env: any, index: number) => ({
                env,
                faltantes: faltantesEnvolvido(env),
                index: index + 1,
              }))
              .filter((item: any) => item.faltantes.length > 0);

            if (novosPendentes.length > 0) {
              setParticipanteModal(novosPendentes[0].env);
              setIndiceParticipante(novosPendentes[0].index);
              toast.success("Dados salvos. Complete o próximo participante.");
              return;
            }

            if (!opcoes?.enviar) {
              toast.success("Dados do participante atualizados.");
              setParticipanteModal(null);
              return;
            }

            const bancosProp = data?.bancos ?? [];
            const bancosPendentes = bancosProp.filter(
              (b: any) => b.selecionado && !bancoJaEnviado(b),
            );
            const bancoId =
              bancosPendentes.length === 1 ? bancosPendentes[0].banco_id : undefined;
            enviandoAoBanco = true;
            const r = await handleEnviarHook({
              propostaId: id,
              bancoId,
              envolvidos: envolvidosAtualizados,
              onCadastroIncompleto: onCadastroIncompleto,
            });
            
            // 2. O MODAL NÃO FECHA APÓS ENVIAR (CORREÇÃO)
            // Fechamos o modal e voltamos para o Resumo para exibir o resultado.
            if (r) {
              setParticipanteModal(null);
              setTab("RESUMO");
            }
          } catch (e: any) {
            // O gate de envio já mostra o motivo real retornado pelo banco.
            if (!enviandoAoBanco) {
              toast.error(e?.message ?? "Falha ao salvar participante.");
            }
          }
        }}
      />


    </div>
  );
}

function Kpi({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="p-5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 text-base font-semibold text-foreground">{valor}</div>
    </div>
  );
}



/* ===== Detalhamento da situação de crédito por banco ===== */


