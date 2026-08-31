import { useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  enviarPropostaHomeFin,
  ressincronizarDadosParticipantes,
} from "@/lib/propostas/propostas.functions";
import { proponentesPendentes } from "@/lib/propostas/campos-obrigatorios";
import { propostaQueryOptions } from "@/lib/propostas/queries";
import { playChatSound } from "@/lib/chat-sound";

export type EtapaEnvio =
  | "criando"
  | "preparando"
  | "participantes"
  | "simulacao"
  | "enviando"
  | "aguardando";

export interface StatusEnvioBanco {
  bancoId: string;
  status: "idle" | "loading" | "success" | "error";
  etapa?: EtapaEnvio;
  etapaNumero?: number;
  mensagem?: string;
  protocolo?: string;
  propostaId?: string;
  numeroProposta?: string;
  tempoDecorrido?: number;
  tipoStatus?: string;
  erroEstruturado?: any;
}

export function useEnviarProposta() {
  const router = useRouter();
  const qc = useQueryClient();
  const [statusPorBanco, setStatusPorBanco] = useState<Record<string, StatusEnvioBanco>>({});
  const [busyBancoId, setBusyBancoId] = useState<string | null>(null);
  const clickLock = useRef<Record<string, boolean>>({});

  const enviarFnDefault = useServerFn(enviarPropostaHomeFin);
  const ressincronizarFn = useServerFn(ressincronizarDadosParticipantes);

  const busy = useMemo(
    () => Object.values(statusPorBanco).some((s) => s.status === "loading"),
    [statusPorBanco],
  );

  const atualizarStatus = useCallback((bancoId: string, patch: Partial<StatusEnvioBanco>) => {
    setStatusPorBanco((prev) => ({
      ...prev,
      [bancoId]: { ...(prev[bancoId] || { bancoId, status: "idle" }), ...patch },
    }));
  }, []);

  /**
   * Leva o usuário ao formulário de cadastro — sempre.
   *
   * Quem chama pode tratar a pendência na própria tela (a página da proposta
   * abre o diálogo ali mesmo, via `onCadastroIncompleto`). Quem NÃO trata
   * — a simulação, o resultado inline, a lista — antes simplesmente parava:
   * o hook retornava sem `proposta_id`, a navegação não acontecia e o botão
   * ficava girando à toa. Agora o próprio hook navega para a proposta com o
   * formulário aberto no participante pendente.
   */
  const abrirFormularioPendencias = useCallback(
    (propostaId: string, envolvidoPendente: any, tratadoPeloChamador?: (env: any) => void) => {
      if (tratadoPeloChamador) {
        tratadoPeloChamador(envolvidoPendente);
        return;
      }
      toast.info("Complete o cadastro do participante para enviar ao banco.");
      router.navigate({
        to: "/operacional/propostas/$id",
        params: { id: propostaId },
        search: { abrir_cadastro: envolvidoPendente?.id },
      });
    },
    [router],
  );

  const iniciarStatus = useCallback(
    (bancoId: string) => {
      atualizarStatus(bancoId, {
        status: "loading",
        etapa: "criando",
        etapaNumero: 1,
        mensagem: "Criando proposta...",
        tempoDecorrido: 0,
      });
    },
    [atualizarStatus],
  );

  const enviar = useCallback(
    async ({
      propostaId: propIdExistente,
      bancoId,
      envolvidos,
      onCadastroIncompleto,
      enviarFn: customEnviarFn,
      criarPropostaFn,
      reiniciarSeIncompleto = true,
    }: {
      propostaId?: string;
      bancoId: string;
      envolvidos?: any[];
      onCadastroIncompleto?: (primeiroPendente: any) => void;
      enviarFn?: (args: { data: { proposta_id: string; banco_id?: string } }) => Promise<any>;
      criarPropostaFn?: () => Promise<{ proposta_id: string }>;
      reiniciarSeIncompleto?: boolean;
    }) => {
      // 5. TRAVA CONTRA CLIQUE DUPLO
      if (clickLock.current[bancoId]) return;
      clickLock.current[bancoId] = true;

      const fnParaUsar = customEnviarFn || enviarFnDefault;
      setBusyBancoId(bancoId);

      // Inicia status se ainda não foi iniciado manualmente
      if (!statusPorBanco[bancoId] || statusPorBanco[bancoId].status !== "loading") {
        iniciarStatus(bancoId);
      }

      const startTime = Date.now();
      const interval = setInterval(() => {
        atualizarStatus(bancoId, { tempoDecorrido: Math.round((Date.now() - startTime) / 1000) });
      }, 1000);

      let currentPropostaId = propIdExistente;

      try {
        // 1. Criar proposta se necessário (etapa 1 de 6)
        if (!currentPropostaId && criarPropostaFn) {
          atualizarStatus(bancoId, {
            etapa: "criando",
            etapaNumero: 1,
            mensagem: "Criando proposta no sistema...",
          });
          const { proposta_id } = await criarPropostaFn();
          currentPropostaId = proposta_id;
        }

        if (!currentPropostaId) throw new Error("ID da proposta não definido.");

        // 2. Ressincronizar (etapa 2 de 6)
        atualizarStatus(bancoId, {
          etapa: "preparando",
          etapaNumero: 2,
          mensagem: "Sincronizando participantes...",
        });
        const res = await ressincronizarFn({ data: { proposta_id: currentPropostaId } });

        // 3. Validar (etapa 3 de 6)
        atualizarStatus(bancoId, {
          etapa: "participantes",
          etapaNumero: 3,
          mensagem: "Validando dados obrigatórios...",
        });
        let currentEnvolvidos = envolvidos;
        if (!currentEnvolvidos || res.alterados > 0) {
          const atualizada = await qc.fetchQuery({
            ...propostaQueryOptions(currentPropostaId),
            staleTime: 0,
          });
          currentEnvolvidos = (atualizada as any)?.envolvidos ?? [];
        }

        // Só bloqueia por quem realmente vira participante na API (CO/TI).
        const pendencias = proponentesPendentes(currentEnvolvidos ?? []);

        if (pendencias.length > 0) {
          clearInterval(interval);
          setBusyBancoId(null);
          clickLock.current[bancoId] = false;

          const campos = pendencias.flatMap((p) =>
            p.faltantes.map((f) => ({
              envolvido_id: p.env.id,
              campo: f.chave,
              rotulo: f.label,
            })),
          );

          atualizarStatus(bancoId, {
            status: "error",
            mensagem: "Cadastro incompleto",
            erroEstruturado: {
              codigo: "CADASTRO_INCOMPLETO",
              campos,
            },
          });

          abrirFormularioPendencias(currentPropostaId, pendencias[0].env, onCadastroIncompleto);
          return;
        }

        // 4. Simulação (etapa 4 de 6)
        atualizarStatus(bancoId, {
          etapa: "simulacao",
          etapaNumero: 4,
          mensagem: "Sincronizando simulação bancária...",
        });

        // 5. Enviar (etapa 5 de 6)
        atualizarStatus(bancoId, {
          etapa: "enviando",
          etapaNumero: 5,
          mensagem: "Enviando ao banco...",
        });
        const r = await fnParaUsar({ data: { proposta_id: currentPropostaId, banco_id: bancoId } });

        // 6. Aguardar (etapa 6 de 6)
        atualizarStatus(bancoId, {
          etapa: "aguardando",
          etapaNumero: 6,
          mensagem: "Aguardando retorno final...",
        });

        clearInterval(interval);
        setBusyBancoId(null);
        clickLock.current[bancoId] = false;

        const bancoInfo = (r?.bancos || [])?.find((b: any) => b.banco_id === bancoId);
        const protocolo = bancoInfo?.numero_proposta_banco;
        const tipoStatus = bancoInfo?.status;

        atualizarStatus(bancoId, {
          status: "success",
          protocolo,
          tipoStatus,
          propostaId: r?.proposta_id,
          numeroProposta: r?.numero_proposta,
          mensagem: protocolo ? "Enviada com sucesso" : "Aguardando confirmação",
        });

        playChatSound(); // Som ao finalizar com sucesso
        await qc.invalidateQueries({ queryKey: ["proposta", currentPropostaId] });
        return r;
      } catch (e) {
        clearInterval(interval);
        setBusyBancoId(null);
        clickLock.current[bancoId] = false;
        const msg =
          e instanceof Error
            ? e.message
            : "Falha ao enviar proposta. Verifique os dados dos participantes.";
        let erroEstruturado = (e as any)?.data?.erro_estruturado || (e as any)?.erro_estruturado;

        // O servidor também barra por cadastro incompleto (participante que já
        // existe na oportunidade e está sem campo obrigatório), mas lança um
        // erro de texto puro: `erro_estruturado` chega sempre indefinido aqui.
        // Em vez de depender da serialização do erro, reconferimos as
        // pendências com dados frescos — se houver, é cadastro incompleto e o
        // formulário precisa abrir, venha a recusa de onde vier.
        if (!erroEstruturado && currentPropostaId) {
          try {
            const atual: any = await qc.fetchQuery({
              ...propostaQueryOptions(currentPropostaId),
              staleTime: 0,
            });
            const pendentes = proponentesPendentes(atual?.envolvidos ?? []);
            if (pendentes.length > 0) {
              erroEstruturado = {
                codigo: "CADASTRO_INCOMPLETO",
                campos: pendentes.flatMap((p) =>
                  p.faltantes.map((f) => ({
                    envolvido_id: (p.env as any).id,
                    campo: f.chave,
                    rotulo: f.label,
                  })),
                ),
              };
              atualizarStatus(bancoId, {
                status: "error",
                mensagem: "Cadastro incompleto",
                erroEstruturado,
              });
              abrirFormularioPendencias(currentPropostaId, pendentes[0].env, onCadastroIncompleto);
              playChatSound();
              throw e;
            }
          } catch (erroAoConferir) {
            // Se a reconferência falhar, seguimos com o erro original.
            if (erroAoConferir === e) throw e;
          }
        }

        atualizarStatus(bancoId, {
          status: "error",
          mensagem: msg,
          erroEstruturado,
        });

        if (erroEstruturado?.codigo === "CADASTRO_INCOMPLETO") {
          onCadastroIncompleto?.(null);
        }
        playChatSound(); // Som também no erro
        throw e;
      }
    },
    [
      enviarFnDefault,
      ressincronizarFn,
      qc,
      atualizarStatus,
      iniciarStatus,
      statusPorBanco,
      abrirFormularioPendencias,
    ],
  );

  const limparStatus = useCallback(() => {
    setStatusPorBanco({});
    clickLock.current = {};
  }, []);

  return { enviar, busy, busyBancoId, statusPorBanco, iniciarStatus, limparStatus };
}
