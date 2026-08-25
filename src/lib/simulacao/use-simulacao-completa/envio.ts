/**
 * Orquestração dos envios de simulação (modos simples e "Ambos" SAC+PRICE).
 * Extraído de `use-simulacao-completa.ts` para reduzir a superfície do hook.
 *
 * Estas funções contêm side effects (chamadas de servidor, toasts, navegação),
 * mas recebem todas as dependências como parâmetros para permanecerem fora do
 * ciclo de vida do React e serem testáveis isoladamente.
 */
import { mensagemCamposPendentes } from "@/lib/simulacao/rotulos-campos";
import { toast } from "sonner";
import { completaSchema, validarCepImovelHomeEquity } from "@/lib/simulacao/schemas";
import {
  criarSimulacao,
  enviarSimulacaoBanco,
  obterSimulacao,
} from "@/lib/simulacao/simulacoes.functions";
import { criarProposta } from "@/lib/propostas/propostas.functions";
import type { Form } from "./state";

type Router = { navigate: (opts: any) => void };

interface CtxBase {
  f: Form;
  idOperacao: number | null;
  prazoMaximo: number;
  modoProposta?: boolean;
  router: Router;
  set: (k: string, v: any) => void; // Adicionado para permitir ajuste real do estado se necessário
  setErros: (v: Record<string, string>) => void;
  setEnviando: (v: boolean) => void;
  setConcluidos: (v: number) => void;
  setListaSimulacoes?: (v: any[]) => void;
  setSimulacaoResultadoId: (v: string | null) => void;
  setSimulacaoResultadoIdPrice: (v: string | null) => void;
  setSimulacaoResultadoIdSecundario?: (v: string | null) => void;
}

export type ItemEnvio = {
  chave: string; // `${sistema}-${prazo}-${banco_id}`
  banco_id: string;
  nome_banco: string;
  sistema: "S" | "P";
  prazo: number;
  estado: "pendente" | "disparada" | "retornada" | "erro";
};

function bloquearSemCepHomeEquity(f: Form, setErros: (v: Record<string, string>) => void): boolean {
  const msg = validarCepImovelHomeEquity(f as any);
  if (!msg) return false;
  setErros({ cep_imovel: msg });
  toast.error(msg);
  if (typeof document !== "undefined") {
    const el = document.getElementById("campo-cep-imovel");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      const input = el?.querySelector("input") as HTMLInputElement | null;
      input?.focus();
    }, 300);
  }
  return true;
}

/**
 * Envio no modo "Ambos": cria uma simulação SAC (com renda_total) e uma
 * simulação PRICE (com renda_price). Cada simulação usa somente os bancos
 * selecionados no seu grupo. Se a renda PRICE não foi preenchida, o envio
 * é bloqueado e o usuário é levado ao campo para completar.
 */
export async function executarEnvioAmbos(ctx: CtxBase): Promise<void> {
  const { f, idOperacao, setErros, setEnviando, setConcluidos } = ctx;
  if (bloquearSemCepHomeEquity(f, setErros)) return;
  const novosErros: Record<string, string> = {};
  if (!(Number(f.renda_price) > 0)) {
    novosErros.renda_price = "Informe a renda para o sistema PRICE.";
  }
  const segundoPrazoInformado = f.prazo_2 && Number(f.prazo_2) > 0 && Number(f.prazo_2) !== Number(f.prazo);
  const qtdPrazos = segundoPrazoInformado ? 2 : 1;
  const totalSimulacoes = ((f.bancos_sac_ids?.length ?? 0) + (f.bancos_price_ids?.length ?? 0)) * qtdPrazos;

  if (totalSimulacoes === 0) {
    novosErros.bancos_ids = "Selecione ao menos um banco em SAC ou PRICE.";
  }
  if (Object.keys(novosErros).length > 0) {
    setErros(novosErros);
    if (novosErros.renda_price) {
      toast.error("Preencha a renda para o sistema PRICE antes de enviar.");
      if (typeof document !== "undefined") {
        const el = document.getElementById("campo-renda-price");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => {
            const input = el.querySelector("input") as HTMLInputElement | null;
            input?.focus();
          }, 300);
        }
      }
    } else {
      toast.error(novosErros.bancos_ids ?? "Revise os campos destacados.");
    }
    return;
  }
  setErros({});

  setConcluidos(0);

  // ------------------------------------------------------------------
  // ETAPA 1 — VALIDAÇÃO DE TODOS OS CENÁRIOS *ANTES* DE ABRIR O OVERLAY.
  // Nada de tela em 0%: se algum cenário reprovar, o usuário recebe a
  // mensagem com o nome do campo e o overlay nem chega a abrir.
  // ------------------------------------------------------------------
  const tValidacao = performance.now();

  if (!Number.isInteger(idOperacao)) {
    const msg =
      "Não foi possível identificar a operação HomeFin para este produto. Recarregue a página e tente novamente.";
    setErros({ id_operacao_homefin: msg });
    toast.error(msg);
    console.error("[executarEnvioAmbos] idOperacao ausente:", idOperacao);
    return;
  }

  const { prazoMaximo, set } = ctx;
  const fValidado = { ...f };
  
  // Normalização unificada determinística
  if (fValidado.prazo > prazoMaximo) {
    fValidado.prazo = prazoMaximo;
    set?.("prazo", prazoMaximo);
  }
  if (fValidado.prazo_2 && fValidado.prazo_2 > prazoMaximo) {
    fValidado.prazo_2 = prazoMaximo;
    set?.("prazo_2", prazoMaximo);
  }
  if (fValidado.prazo_2 && Number(fValidado.prazo_2) === Number(fValidado.prazo)) {
    fValidado.prazo_2 = null;
    set?.("prazo_2", null);
  }


  type Cenario = {
    sistema: "S" | "P";
    bancosIds: string[];
    setResultadoId: (id: string | null) => void;
    dados: any;
  };
  const cenarios: Cenario[] = [];
  const errosValidacao: Record<string, string> = {};
  const camposPendentes: string[] = [];

  const validarCenario = (
    sistema: "S" | "P",
    bancosIds: string[],
    setResultadoId: (id: string | null) => void,
    rendaOverride?: number,
  ) => {
    const parsed = completaSchema.safeParse({
      ...fValidado,
      sistema_amortizacao: sistema,
      bancos_ids: bancosIds,
      renda_total: rendaOverride ?? f.renda_total,
      id_operacao_homefin: idOperacao,
    });
    if (!parsed.success) {
      console.error(
        `[executarEnvioAmbos] Falha na validação ${sistema}:`,
        parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      );
      parsed.error.issues.forEach((issue) => {
        const campo = String(issue.path[0]);
        if (!errosValidacao[campo]) {
          errosValidacao[campo] = issue.message;
          camposPendentes.push(campo);
        }
      });
      return;
    }
    cenarios.push({ sistema, bancosIds, setResultadoId, dados: parsed.data });
  };

  if ((f.bancos_sac_ids?.length ?? 0) > 0) {
    validarCenario("S", f.bancos_sac_ids, ctx.setSimulacaoResultadoId);
  }
  if ((f.bancos_price_ids?.length ?? 0) > 0) {
    validarCenario("P", f.bancos_price_ids, ctx.setSimulacaoResultadoIdPrice, Number(f.renda_price));
  }

  console.log(
    `[SIM-PERF][ETAPA] validacao duration_ms=${(performance.now() - tValidacao).toFixed(0)}`,
  );

  if (camposPendentes.length > 0 || cenarios.length === 0) {
    setErros(errosValidacao);
    toast.error(
      camposPendentes.length > 0
        ? mensagemCamposPendentes(camposPendentes)
        : "Não foi possível montar o envio. Revise os dados da simulação.",
    );
    return;
  }

  // ------------------------------------------------------------------
  // ETAPA 2 — SÓ AGORA o overlay abre, já com a lista de rastreio real.
  // ------------------------------------------------------------------
  const lista: ItemEnvio[] = [];
  const prazos = Array.from(
    new Set([Number(fValidado.prazo), Number(fValidado.prazo_2)].filter((p) => p && p > 0)),
  );

  const nomeDoBanco = (bid: string) =>
    bid.toLowerCase().includes("itau")
      ? "Itaú"
      : bid.toLowerCase().includes("bradesco")
        ? "Bradesco"
        : bid.toLowerCase().includes("santander")
          ? "Santander"
          : (ctx as any).bancos?.find((b: any) => b.id === bid)?.nome_banco || bid;

  for (const p of prazos) {
    for (const bid of (f.bancos_sac_ids ?? [])) {
      lista.push({ chave: `S-${p}-${bid}`, banco_id: bid, nome_banco: nomeDoBanco(bid), sistema: "S", prazo: p, estado: "pendente" });
    }
    for (const bid of (f.bancos_price_ids ?? [])) {
      lista.push({ chave: `P-${p}-${bid}`, banco_id: bid, nome_banco: nomeDoBanco(bid), sistema: "P", prazo: p, estado: "pendente" });
    }
  }

  const atualizarLista = (chave: string, estado: ItemEnvio["estado"], nomeBanco?: string) => {
    const idx = lista.findIndex(item => item.chave === chave);
    if (idx !== -1) {
      lista[idx].estado = estado;
      if (nomeBanco) lista[idx].nome_banco = nomeBanco;
      ctx.setListaSimulacoes?.([...lista]);
    }
  };

  ctx.setListaSimulacoes?.([...lista]);
  setEnviando(true);
  const idsGerados: string[] = [];
  const bancosSimulados: any[] = [];
  let retornadasCount = 0;
  let primeiraCriacaoLogada = false;
  let primeiraChamadaLogada = false;
  const errosEnvio: string[] = [];

  const agrupador_id =
    (f.bancos_sac_ids?.length ?? 0) > 0 && (f.bancos_price_ids?.length ?? 0) > 0
      ? (crypto.randomUUID?.() ??
        `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`)
      : null;

  // Processamento Sequencial (evita condições de corrida em agrupadores).
  const processarSistema = async (cenario: Cenario) => {
    const { sistema, bancosIds, setResultadoId, dados } = cenario;
    const tCenario = performance.now();
    try {
      console.log(`[Envio ${sistema === "S" ? "SAC" : "PRICE"}] Iniciando fluxo`);

      const tCriacao = performance.now();
      const { id } = await criarSimulacao({
        data: {
          modo: "completa",
          dados: {
            ...dados,
            id_operacao_homefin: idOperacao,
            email_verificado_em: f.email_verificado_em,
            agrupador_id,
          } as any,
        },
      });
      if (!primeiraCriacaoLogada) {
        primeiraCriacaoLogada = true;
        console.log(
          `[SIM-PERF][ETAPA] criacao_simulacao duration_ms=${(performance.now() - tCriacao).toFixed(0)}`,
        );
      }
      idsGerados.push(id);
      setResultadoId(id);

      const bancosParaLote = [...bancosIds];
      bancosParaLote.forEach(bid => atualizarLista(`${sistema}-${dados.prazo}-${bid}`, "disparada"));

      const tChamada = performance.now();
      try {
        const respLote: any = await enviarSimulacaoBanco({ 
          data: { simulacao_id: id, banco_ids: bancosParaLote } 
        });
        if (!primeiraChamadaLogada) {
          primeiraChamadaLogada = true;
          console.log(
            `[SIM-PERF][ETAPA] primeira_chamada duration_ms=${(performance.now() - tChamada).toFixed(0)}`,
          );
        }

        if (respLote?.bancos) {
          for (const bResult of respLote.bancos) {
            const chave = `${sistema}-${dados.prazo}-${bResult.banco_id}`;
            if (bResult.status === "simulada") {
              atualizarLista(chave, "retornada", bResult.nome_banco);
              bancosSimulados.push({ idSimulacao: id, banco_id: bResult.banco_id, nome_banco: bResult.nome_banco });
            } else if (bResult.status === "erro") {
              atualizarLista(chave, "erro");
              if (bResult.mensagem_erro) errosEnvio.push(`${bResult.nome_banco ?? bResult.banco_id}: ${bResult.mensagem_erro}`);
            }
            retornadasCount++;
            setConcluidos(retornadasCount);
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[Envio ${sistema}] Falha no lote:`, e);
        errosEnvio.push(`${sistema === "S" ? "SAC" : "PRICE"}: ${msg}`);
        toast.error(`Falha ao consultar os bancos (${sistema === "S" ? "SAC" : "PRICE"}): ${msg}`);
        bancosParaLote.forEach(bid => atualizarLista(`${sistema}-${dados.prazo}-${bid}`, "erro"));
        retornadasCount += bancosParaLote.length;
        setConcluidos(retornadasCount);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[Envio ${sistema}] Falha ao criar a simulação:`, e);
      errosEnvio.push(`${sistema === "S" ? "SAC" : "PRICE"}: ${msg}`);
      toast.error(`Não foi possível criar a simulação (${sistema === "S" ? "SAC" : "PRICE"}): ${msg}`);
      bancosIds.forEach(bid => atualizarLista(`${sistema}-${dados.prazo}-${bid}`, "erro"));
    } finally {
      console.log(`[SIM-PERF][CENARIO] sistema=${sistema} duration_ms=${(performance.now() - tCenario).toFixed(0)}`);
    }
  };

  try {
    for (const cenario of cenarios) {
      await processarSistema(cenario);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[executarEnvioAmbos] Erro crítico no envio:", e);
    toast.error(`FALHA NO ENVIO: ${msg}`);
  } finally {
    setEnviando(false);
    setConcluidos(0);
  }

  if (idsGerados.length === 0) {
    toast.error(
      errosEnvio.length > 0
        ? `Nenhuma simulação foi criada. ${errosEnvio[0]}`
        : "Nenhuma simulação foi criada. Tente novamente.",
    );
    return;
  }


  sessionStorage.removeItem("simulacao_wizard");
  ctx.setSimulacaoResultadoId(idsGerados[0] ?? null);
  ctx.setSimulacaoResultadoIdPrice(idsGerados[1] ?? null);
  setEnviando(false);
  setConcluidos(0);
  
  if (idsGerados.length > 0) {
    toast.success("Simulações processadas. Confira os resultados abaixo.");
  }

  // Download automático dos PDFs
  if (bancosSimulados.length > 0 && f.download_automatico !== false) {
    try {
      const { baixarSimulacaoDetalhadaPDF } = await import("@/lib/simulacao/simulacao-pdf");
      const porSim = bancosSimulados.reduce(
        (acc, curr) => {
          if (!acc[curr.idSimulacao]) acc[curr.idSimulacao] = [];
          acc[curr.idSimulacao].push(curr.banco_id);
          return acc;
        },
        {} as Record<string, string[]>,
      );

      for (const [simId, bancoIds] of Object.entries(porSim)) {
        const simData = await obterSimulacao({ data: { id: simId } });
        // `obterSimulacao` devolve os bancos de todas as simulações irmãs do
        // mesmo agrupador (SAC, PRICE e a invertida por CPF). Sem prender ao
        // `simulacao_id` desta iteração o mesmo banco sairia repetido; sem
        // exigir `status_banco === "simulada"` sairia um PDF em branco para
        // quem não retornou.
        const bancosReais = (simData.bancos as any[])?.filter(
          (b: any) =>
            b.simulacao_id === simId &&
            b.status_banco === "simulada" &&
            (bancoIds as string[]).includes(b.banco_id),
        );
        if (bancosReais?.length > 0) {
          await baixarSimulacaoDetalhadaPDF({
            simulacao: simData.simulacao,
            bancos: bancosReais,
          });
          await new Promise((r) => setTimeout(r, 800));
        }
      }
    } catch (e) {
      console.error("[PDF Automático Ambos]", e);
    }
  }

}

/** Envio padrão (SAC ou PRICE isolado). */
export async function executarEnvioSimples(ctx: CtxBase): Promise<void> {
  const { f, idOperacao, modoProposta, router, setErros, setEnviando, setConcluidos, setListaSimulacoes } = ctx;
  if (bloquearSemCepHomeEquity(f, setErros)) return;
  // 1. Validação final e normalização de prazos (Rede de segurança final)
  const { prazoMaximo, set } = ctx;
  
  const fValidado = { ...f };
  if (fValidado.prazo > prazoMaximo) {
    fValidado.prazo = prazoMaximo;
    set?.("prazo", prazoMaximo);
  }
  if (fValidado.prazo_2 && fValidado.prazo_2 > prazoMaximo) {
    fValidado.prazo_2 = prazoMaximo;
    set?.("prazo_2", prazoMaximo);
  }
  
  // Regra: se prazo_2 ficou igual ao principal, limpa o comparativo
  if (fValidado.prazo_2 && Number(fValidado.prazo_2) === Number(fValidado.prazo)) {
    fValidado.prazo_2 = null;
    set?.("prazo_2", null);
  }


  const res = completaSchema.safeParse({ ...fValidado, id_operacao_homefin: idOperacao });
  if (!res.success) {
    const novos: Record<string, string> = {};
    const pendentes: string[] = [];
    
    res.error.issues.forEach(issue => {
      const campo = String(issue.path[0]);
      novos[campo] = issue.message;
      pendentes.push(campo);
    });
    
    setErros(novos);
    console.error("[executarEnvioSimples] Falha na validação:", novos);
    toast.error(mensagemCamposPendentes(pendentes));
    return;
  }

  setErros({});
  setConcluidos(0);
  setEnviando(true);
  try {
    const data = res.data;
    const { id, agrupador_id } = await criarSimulacao({
      data: {
        modo: "completa",
        dados: {
          ...data,
          id_operacao_homefin: idOperacao,
          email_verificado_em: f.email_verificado_em,
          prazo_2: Number(fValidado.prazo_2) !== Number(fValidado.prazo) ? fValidado.prazo_2 : null,
        } as any,
      },
    });
    sessionStorage.removeItem("simulacao_wizard");
    
    // 1. Envio de todas as simulações vinculadas ao agrupador
    const idsParaEnviar = [id];
    if (agrupador_id) {
      try {
        const { obterSimulacoesPorAgrupador } = await import("@/lib/simulacao/simulacoes.functions");
        const vinculadas = await obterSimulacoesPorAgrupador({ data: { agrupador_id } });
        if (vinculadas && vinculadas.length > 0) {
          idsParaEnviar.push(...vinculadas.map(v => v.id).filter(vid => vid !== id));
        }
      } catch (e) {
        console.error("[executarEnvioSimples] Falha ao buscar simulações agrupadas:", e);
      }
    }

    const idsBancos = (f.bancos_ids?.length ?? 0) > 0 ? f.bancos_ids : [];
    const bancosParaEnviar = idsBancos.length > 0 ? [...idsBancos] : [null];
    let retornadasCount = 0;
    const segundoPrazoInformado = f.prazo_2 && Number(f.prazo_2) > 0 && Number(f.prazo_2) !== Number(f.prazo);
    const qtdPrazos = segundoPrazoInformado ? 2 : 1;
    const totalSimulacoes = (idsBancos?.length > 0 ? idsBancos.length : 1) * qtdPrazos;

    // 0. Preparar lista de rastreio
    const lista: ItemEnvio[] = [];
    for (const currentSimId of idsParaEnviar) {
      const fila = [...bancosParaEnviar];
      for (const bid of fila) {
        const nome_banco = bid?.toLowerCase().includes("itau") ? "Itaú" : 
                           bid?.toLowerCase().includes("bradesco") ? "Bradesco" : 
                           bid?.toLowerCase().includes("santander") ? "Santander" : 
                           ((ctx as any).bancos?.find((b: any) => b.id === bid)?.nome_banco || (bid || 'Consultando...'));
        lista.push({ 
          chave: `${currentSimId}-${bid || 'default'}`, 
          banco_id: bid || 'default', 
          nome_banco, 
          sistema: 'S', 
          prazo: f.prazo, 
          estado: 'pendente' 
        });
      }
    }
    
    const atualizarLista = (chave: string, estado: ItemEnvio["estado"], nomeBanco?: string) => {
      const idx = lista.findIndex(item => item.chave === chave);
      if (idx !== -1) {
        lista[idx].estado = estado;
        if (nomeBanco) lista[idx].nome_banco = nomeBanco;
        ctx.setListaSimulacoes?.([...lista]);
      }
    };

    ctx.setListaSimulacoes?.([...lista]);

    for (const currentSimId of idsParaEnviar) {
      try {
        const fila = [...bancosParaEnviar];
        console.log(`[Envio Simples] [LOTE] Despachando lote de ${fila.length} bancos para simulação ${currentSimId}`);
        
        fila.forEach(bid => atualizarLista(`${currentSimId}-${bid || 'default'}`, "disparada"));

        try {
          const respLote: any = await enviarSimulacaoBanco({
            data: { simulacao_id: currentSimId, banco_ids: fila.length > 0 ? fila : undefined },
          });

          if (respLote?.bancos) {
            for (const bResult of respLote.bancos) {
              const chave = `${currentSimId}-${bResult.banco_id || 'default'}`;
              if (bResult.status === "simulada") {
                atualizarLista(chave, "retornada", bResult.nome_banco);
              } else if (bResult.status === "erro") {
                atualizarLista(chave, "erro");
              }
              retornadasCount++;
              setConcluidos(retornadasCount);
            }
          }
        } catch (e) {
          console.error(`[Envio Simples] [LOTE] Falha no lote da simulação ${currentSimId}:`, e);
          fila.forEach(bid => atualizarLista(`${currentSimId}-${bid || 'default'}`, "erro"));
          retornadasCount += fila.length;
          setConcluidos(retornadasCount);
        }
      } catch (e) {
        console.error(`[executarEnvioSimples] Erro na simulação ${currentSimId}:`, e);
      }
    }


    // Fluxo "Nova Proposta": após simular, cria a proposta e redireciona.
    if (modoProposta) {
      try {
        const dadosSim: any = await obterSimulacao({ data: { id } });
        const bancosSim: any[] = dadosSim.bancos ?? [];
        const simulados = bancosSim.filter((b) => b.status_banco === "simulada");
        if (simulados.length === 0) {
          toast.error("Nenhum banco aceitou a proposta. Revise os dados e envie novamente.");
          setEnviando(false);
          setConcluidos(0);
          return;
        }
        const escolhidoUsuarioId = idsBancos[0] ?? null;
        const escolhido =
          simulados.find((b: any) => b.banco_id === escolhidoUsuarioId) ?? simulados[0];
        const bancoId = escolhido.banco_id as string;
        const { proposta_id } = await criarProposta({
          data: { simulacao_id: id, banco_id: bancoId },
        });

        // Download automático se solicitado
        if (f.download_automatico !== false) {
          try {
            const { baixarSimulacaoDetalhadaPDF } = await import("@/lib/simulacao/simulacao-pdf");
            const simData = await obterSimulacao({ data: { id } });
            // Idem: restringe às linhas desta simulação para não repetir os
            // bancos das irmãs do mesmo agrupador.
            const bancosSimulados = (simData.bancos as any[])?.filter(
              (b: any) => b.simulacao_id === id && b.status_banco === "simulada",
            );
            if (bancosSimulados?.length > 0) {
              await baixarSimulacaoDetalhadaPDF({
                simulacao: simData.simulacao,
                bancos: bancosSimulados,
              });
            }
          } catch (e) {
            console.error("[PDF Automático Proposta]", e);
          }
        }

        toast.success("Proposta criada. Complete o cadastro para enviar ao banco.");
        if (f.cliente_id) {
          router.navigate({
            to: "/operacional/propostas/$id",
            params: { id: proposta_id },
            search: { complementar: 1 },
          });
        } else {
          router.navigate({
            to: "/crm/clientes/novo",
            search: { proposta: proposta_id, enviar: 1 },
          });
        }
        return;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível criar a proposta.");
        setEnviando(false);
        setConcluidos(0);
        return;
      }
    }

    ctx.setSimulacaoResultadoId(id);
    if (agrupador_id) {
      // No modo simples com múltiplos prazos/sistemas, a UI exibe via agrupador.
      // O hook já deve ter lógica para lidar com isso ou buscar as irmãs.
      if (f.prazo_2) {
        // Marcamos a primeira como principal, a UI se encarrega de agrupar.
      }
    }
    setEnviando(false);
    setConcluidos(0);
    toast.success("Simulação realizada. Os retornos dos bancos estão sendo processados.");
  } catch (e: any) {
    console.error("[executarEnvioSimples] Erro crítico no envio:", e);
    console.error("[executarEnvioSimples] Stack:", e?.stack);
    console.error("[executarEnvioSimples] Detalhes Contexto:", {
      prazo_principal: f.prazo,
      prazo_2: f.prazo_2,
      modoProposta,
      bancos: f.bancos_ids
    });
    const msg = e instanceof Error ? e.message : String(e);
    toast.error(
      `FALHA NO ENVIO: ${msg}`
    );
    setEnviando(false);
    setConcluidos(0);
  }
}
