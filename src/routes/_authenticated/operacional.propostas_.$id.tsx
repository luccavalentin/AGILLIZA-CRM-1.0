import * as React from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { assertModuloPermitido } from "@/lib/route-guards";
import { propostaQueryOptions } from "@/lib/propostas/queries";
import {
  sincronizarProposta,
  atualizarEnvolvido,
  adicionarEnvolvido,
} from "@/lib/propostas/propostas.functions";
import { 
  faltantesEnvolvido, 
} from "@/lib/propostas/campos-obrigatorios";
import { supabase } from "@/integrations/supabase/client";
import { envolvidoParaForm } from "@/components/proposta/participante-form";
import { bancoJaEnviado } from "@/components/proposta/status-bancos-proposta";
import { useEnviarProposta } from "@/hooks/use-enviar-proposta";

// Novos componentes de visualização
import { PropostaSkeleton, PropostaNaoEncontrada, PropostaErro } from "@/components/proposta/visualizacao/proposta-skeletons";
import { PropostaView } from "@/components/proposta/visualizacao/proposta-view";

export const Route = createFileRoute("/_authenticated/operacional/propostas_/$id")({
  head: () => ({ meta: [{ title: "Proposta — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("operacional.propostas"),
  validateSearch: (search: Record<string, unknown>): { complementar?: 1; abrir_cadastro?: string } =>
    ({ 
      complementar: search.complementar === 1 || search.complementar === "1" ? 1 : undefined,
      abrir_cadastro: typeof search.abrir_cadastro === 'string' ? search.abrir_cadastro : undefined
    }),
  component: PropostaRoute,
  errorComponent: (props) => {
    return <PropostaErroWrapper {...props} />;
  },
});

function PropostaErroWrapper(props: any) {
  const { id } = Route.useParams();
  return <PropostaErro {...props} id={id} />;
}

function PropostaRoute() {
  const { id } = Route.useParams();
  const { complementar, abrir_cadastro } = Route.useSearch();
  const router = useRouter();
  const qc = useQueryClient();
  const { enviar: handleEnviarHook } = useEnviarProposta();

  // 1. Hooks de dados
  const { data, isLoading, isError, error } = useQuery({
    ...propostaQueryOptions(id),
    refetchInterval: (q: any) => {
      const st = q.state.data?.proposta?.status as string | undefined;
      if (!st) return 30_000;
      const terminais = ["contrato_emitido", "cancelada", "credito_recusado"];
      return terminais.includes(st) ? false : 15_000;
    },
    refetchOnWindowFocus: true,
  });

  const sincronizarAutoFn = useServerFn(sincronizarProposta);

  // 2. Estados de controle de dados
  const [participanteModal, setParticipanteModal] = React.useState<any>(null);
  const [indiceParticipante, setIndiceParticipante] = React.useState(0);
  const enviouAutoRef = React.useRef(false);

  // 3. Handlers de dados (memoized)
  const envolvidos = data?.envolvidos ?? [];
  const bancos = data?.bancos ?? [];

  const onCadastroIncompleto = React.useCallback((envolvidoPendente: any) => {
    if (envolvidoPendente && envolvidoPendente.id) {
      setParticipanteModal(envolvidoPendente);
      const idx = envolvidos.findIndex((e: any) => e.id === envolvidoPendente.id);
      setIndiceParticipante(idx + 1);
    } else {
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

  const onSalvarParticipante = React.useCallback(async (principal: any, conjuge: any, opcoes: any) => {
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
      const bancoId = bancosPendentes.length === 1 ? bancosPendentes[0].banco_id : undefined;
      enviandoAoBanco = true;
      
      const r = await handleEnviarHook({
        propostaId: id,
        bancoId,
        envolvidos: envolvidosAtualizados,
        onCadastroIncompleto: onCadastroIncompleto,
      });
      
      if (r) {
        setParticipanteModal(null);
      }
    } catch (e: any) {
      if (!enviandoAoBanco) {
        toast.error(e?.message ?? "Falha ao salvar participante.");
      }
    }
  }, [participanteModal, id, qc, handleEnviarHook, onCadastroIncompleto, data?.bancos]);

  // 4. Effects
  React.useEffect(() => {
    if (abrir_cadastro && envolvidos.length > 0) {
      const env = envolvidos.find((e: any) => e.id === abrir_cadastro);
      if (env) {
        setParticipanteModal(env);
        const idx = envolvidos.findIndex((e: any) => e.id === abrir_cadastro);
        setIndiceParticipante(idx + 1);
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

  const propostaStatus = data?.proposta?.status as string | undefined;
  const temProtocoloBanco = (data?.bancos ?? []).some(
    (b: any) => !!(b.numero_proposta_banco || b.homefin_id_proposta || b.codigo_oportunidade_homefin),
  );

  React.useEffect(() => {
    const terminais = ["contrato_emitido", "cancelada", "credito_recusado", "rascunho"];
    if (!propostaStatus || terminais.includes(propostaStatus)) return;
    if (!temProtocoloBanco) return;
    let cancelado = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const BASE = 5 * 60_000;
    let intervalo = BASE;

    const tick = async () => {
      if (cancelado) return;
      try {
        const r = await sincronizarAutoFn({ data: { proposta_id: id } });
        if (!cancelado && r?.atualizado) {
          qc.invalidateQueries({ queryKey: ["proposta", id] });
        }
      } catch {
        intervalo = Math.min(intervalo * 2, 20 * 60_000);
      }
      if (!cancelado) timer = setTimeout(tick, intervalo);
    };
    timer = setTimeout(tick, 60_000);
    return () => {
      cancelado = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, propostaStatus, temProtocoloBanco, sincronizarAutoFn, qc]);

  React.useEffect(() => {
    if (complementar !== 1 || enviouAutoRef.current) return;
    enviouAutoRef.current = true;
    router.navigate({ to: "/operacional/propostas/$id", params: { id }, search: {}, replace: true });
    
    (async () => {
      try {
        await handleEnviarHook({
          propostaId: id,
          bancoId: "todos",
          envolvidos,
          onCadastroIncompleto,
        });
      } catch {
        enviouAutoRef.current = false;
      }
    })();
  }, [complementar, id, router, handleEnviarHook, envolvidos, onCadastroIncompleto]);

  React.useEffect(() => {
    const invalidar = () => qc.invalidateQueries({ queryKey: ["proposta", id] });
    const channel = supabase
      .channel(`proposta-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "propostas", filter: `id=eq.${id}` }, invalidar)
      .on("postgres_changes", { event: "*", schema: "public", table: "proposta_bancos", filter: `proposta_id=eq.${id}` }, invalidar)
      .on("postgres_changes", { event: "*", schema: "public", table: "proposta_historico", filter: `proposta_id=eq.${id}` }, invalidar)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, qc]);

  // 5. Memos
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
  }, [participanteModal?.id, participanteModal?.conjuge_id, envolvidos]);

  const nomeConjugeExistente = React.useMemo(() => {
    if (!participanteModal?.id || !envolvidos) return null;
    const principal = envolvidos.find((e: any) => e.id === participanteModal.id);
    if (!principal || principal.tipo_qualificacao === 'CJ') return null;
    const conj = envolvidos.find((e: any) => e.id !== principal.id && (e.conjuge_de === principal.id || (principal.conjuge_id && e.id === principal.conjuge_id)));
    return conj?.nome || null;
  }, [envolvidos, participanteModal?.id]);

  // 6. Returns condicionais (após todos os hooks)
  if (isError) throw error;
  if (isLoading) return <PropostaSkeleton />;
  if (!data) return <PropostaNaoEncontrada />;

  return (
    <PropostaView
      id={id}
      data={data}
      handleEnviarHook={handleEnviarHook}
      onCadastroIncompletoSemArgs={onCadastroIncompletoSemArgs}
      onCadastroIncompleto={onCadastroIncompleto}
      inicialParticipante={inicialParticipante}
      conjugeInicialParticipante={conjugeInicialParticipante}
      indiceParticipante={indiceParticipante}
      totalPendentes={envolvidos.length}
      participanteModal={participanteModal}
      setParticipanteModal={setParticipanteModal}
      onSalvarParticipante={onSalvarParticipante}
      nomeConjugeExistente={nomeConjugeExistente}
      router={router}
    />
  );
}
