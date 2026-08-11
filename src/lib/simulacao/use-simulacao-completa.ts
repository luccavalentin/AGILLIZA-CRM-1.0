import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { mensagemCamposPendentes } from "@/lib/simulacao/rotulos-campos";
import { toast } from "sonner";
import {
  avaliarRendaMinima,
  TAXA_MIP_MES,
  TAXA_DFI_MES,
  TAXA_ADMIN_MES,
  limitesLtv,
} from "@/lib/simulacao/renda";
import { taxaAnoDeBanco } from "@/lib/simulacao/simulacao-rapida";
import { completaSchema } from "@/lib/simulacao/schemas";
import { formatBRL, maskCpfCnpj, maskCelular } from "@/lib/simulacao/format";
import { ajustarPrazoPorIdade, prazoMaximoParaProponentes } from "@/lib/simulacao/prazo";
import { obterConfiguracoesModulos } from "@/lib/admin/configuracoes-modulos.functions";
import { useEnviarProposta } from "@/hooks/use-enviar-proposta";
import { criarProposta } from "@/lib/propostas/propostas.functions";
import {
  listarBancosAtivos,
  listarOperacoes,
  obterSimulacao,
  obterClienteCRM,
} from "@/lib/simulacao/simulacoes.functions";

import {
  EMAIL_PADRAO,
  ESTADO_INICIAL,
  type Banco,
  type Form,
  type OpcoesHook,
} from "./use-simulacao-completa/state";
import {
  aceitaPrice,
  calcularRestricaoEspecial,
  aceitaBancoNaOperacao as aceitaBancoNaOperacaoPuro,
  mensagemBancoIncompativel as mensagemBancoIncompativelPuro,
} from "./use-simulacao-completa/bancos-helpers";
import {
  calcularEntradaSugerida,
  calcularPorEntrada,
  calcularPorFinanciamento,
  calcularPorParcela,
} from "./use-simulacao-completa/calculos";
import {
  patchSelecionarClienteCRM,
  patchLimparTitular,
  patchPuxarConjugeCRM,
  faltaConjugeDoCRM,
  patchInverterPrincipal,
} from "./use-simulacao-completa/cliente-crm";
import { executarEnvioAmbos, executarEnvioSimples } from "./use-simulacao-completa/envio";

export type { Form };

export interface SimulacaoCompletaCtx extends ReturnType<typeof useSimulacaoCompleta> {}

/**
 * Concentra todo o estado, regras de negócio e efeitos da simulação completa.
 * A UI (rota + seções) apenas consome este contrato — responsabilidade única.
 */
export function useSimulacaoCompleta({ duplicar, modoProposta }: OpcoesHook) {
  const router = useRouter();
  const [f, setF] = useState<Form>(ESTADO_INICIAL);
  const [enviando, setEnviando] = useState(false);
  const [concluidos, setConcluidos] = useState(0);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [entradaTocada, setEntradaTocada] = useState(false);
  const [cadastroNome, setCadastroNome] = useState<string | null>(null);
  const [invertido, setInvertido] = useState(false);
  const [confirmRenda, setConfirmRenda] = useState<null | {
    rendaMinima: number;
    rendaInformada: number;
    detalhe_fonte?: string;
  }>(null);
  const [pctDespesas, setPctDespesas] = useState<number>(0);
  // Guarda o id da última simulação gerada para exibir o resultado inline
  // (sem redirecionar), permitindo o usuário ajustar o prazo e simular novamente.
  const [simulacaoResultadoId, setSimulacaoResultadoId] = useState<string | null>(null);
  // Segundo id de simulação para o modo "Ambos" (uma simulação SAC + uma PRICE).
  const [simulacaoResultadoIdPrice, setSimulacaoResultadoIdPrice] = useState<string | null>(null);
  const [simulacaoResultadoIdSecundario, setSimulacaoResultadoIdSecundario] = useState<
    string | null
  >(null);

  const {
    enviar: enviarPropostaHook,
    statusPorBanco,
    iniciarStatus: iniciarStatusEnvio,
  } = useEnviarProposta();

  // Estado para o diálogo de "Enviar Proposta"
  const [envioEstado, setEnvioEstado] = useState<any | null>(null);

  const abrirDialogEnvio = useCallback((sim: any) => {
    setEnvioEstado(sim);
  }, []);

  const fecharDialogEnvio = useCallback(() => {
    setEnvioEstado(null);
  }, []);

  const { data: bancos } = useQuery({
    queryKey: ["bancos-ativos"],
    queryFn: () => listarBancosAtivos(),
  });
  const { data: operacoes } = useQuery({
    queryKey: ["operacoes"],
    queryFn: () => listarOperacoes(),
  });

  // Prazos mínimos APRENDIDOS com as respostas das IFs (banco + tipo de imóvel).
  // Não há mínimo documentado além de PRAZO_MIN; estes valores são apenas aviso
  // e ajuste automático, nunca bloqueio.
  const { data: configModulos } = useQuery({
    queryKey: ["configuracoes-modulos"],
    queryFn: () => obterConfiguracoesModulos(),
    staleTime: 5 * 60 * 1000,
  });

  // Carrega a simulação de origem quando estamos duplicando.
  const { data: origem } = useQuery({
    queryKey: ["simulacao-duplicar", duplicar],
    queryFn: () => obterSimulacao({ data: { id: duplicar as string } }),
    enabled: Boolean(duplicar),
  });

  // pré-preenche do wizard (consome e limpa imediatamente para não fixar o cliente)
  useEffect(() => {
    if (duplicar) return;
    const raw = sessionStorage.getItem("simulacao_wizard");
    if (raw) {
      sessionStorage.removeItem("simulacao_wizard");
      try {
        const w = JSON.parse(raw);
        setF((prev) => ({ ...prev, ...w }));
      } catch {
        /* ignore */
      }
    }
  }, [duplicar]);

  // pré-preenche a partir da simulação duplicada (novo nº é gerado ao salvar).
  // Usa uma ref para garantir que o prefill só rode UMA vez — sem isso, um
  // refetch do react-query (foco de janela, invalidação) sobrescreveria as
  // escolhas do usuário, como a lista de bancos, com os valores da origem.
  const prefillOrigemAplicadoRef = useRef(false);
  useEffect(() => {
    if (!origem?.simulacao) return;
    if (prefillOrigemAplicadoRef.current) return;
    prefillOrigemAplicadoRef.current = true;
    const s = origem.simulacao as any;
    const valorImovel = Number(s.valor_imovel) || 0;
    const valorFin = Number(s.valor_financiamento) || 0;
    setEntradaTocada(true);
    setF((prev) => ({
      ...prev,
      produto: s.produto ?? prev.produto,
      tipo_imovel: s.tipo_imovel ?? "",
      uso_imovel: s.uso_imovel ?? "",
      situacao_imovel: s.situacao_imovel ?? "",
      uf: s.uf ?? "",
      cep_imovel: s.cep_imovel ?? prev.cep_imovel,
      valor_imovel: valorImovel,
      valor_entrada: Math.max(0, valorImovel - valorFin),
      valor_financiamento: valorFin,
      prazo: Number(s.prazo) || prev.prazo,
      utiliza_fgts: s.utiliza_fgts ?? "N",
      fg_financiar_despesas: Boolean(s.fg_financiar_despesas),
      valor_despesas_financiadas: Number(s.valor_despesas_financiadas) || 0,
      sistema_amortizacao: s.sistema_amortizacao ?? "S",
      cliente_id: s.cliente_id ?? prev.cliente_id,
      nome_cliente: s.nome_cliente ?? "",
      cpf_cnpj: s.cpf_cnpj ?? "",
      renda_total: Number(s.renda_total) || 0,
      renda_conjuge: Number(s.renda_conjuge) || 0,
      data_nascimento: s.data_nascimento ?? "",
      estado_civil: s.estado_civil ?? "",
      email: s.email || EMAIL_PADRAO,
      celular: s.celular ?? "",
      possui_conjuge: Boolean(s.possui_conjuge),
      compoe_renda: Boolean(s.compoe_renda) && Boolean(s.possui_conjuge),
      compoe_renda_conjuge:
        Boolean(s.possui_conjuge) &&
        (s.compoe_renda_conjuge !== undefined
          ? Boolean(s.compoe_renda_conjuge)
          : Boolean(s.compoe_renda)),

      nome_conjuge: s.nome_conjuge ?? "",
      cpf_conjuge: s.cpf_conjuge ?? "",
      data_nascimento_conjuge: s.data_nascimento_conjuge ?? "",
      email_conjuge: s.email_conjuge || EMAIL_PADRAO,
      celular_conjuge: s.celular_conjuge ?? "",
      estado_civil_conjuge: s.estado_civil_conjuge ?? s.estado_civil ?? "",

      consentimento_lgpd: Boolean(s.consentimento_lgpd),
      consentimento_scr: Boolean(s.consentimento_scr),
      bancos_ids: (origem.bancos ?? []).map((b: any) => b.banco_id).filter(Boolean),
      email_verificado_em: null,
    }));
    if (s.cliente_id) setCadastroNome(s.nome_cliente ?? "");
  }, [origem]);

  // default bancos padrão — apenas na simulação. Em "Nova Proposta" o usuário
  // escolhe explicitamente a instituição para envio; nunca selecionamos por ele.
  useEffect(() => {
    if (modoProposta) return;
    if (bancos && f.bancos_ids.length === 0) {
      const padrao = bancos.filter((b) => b.flag_padrao).map((b) => b.id);
      if (padrao.length > 0) setF((prev) => ({ ...prev, bancos_ids: padrao }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bancos]);

  const idOperacao = useMemo(() => {
    const op = operacoes?.find((o) => o.produto_sistema === f.produto);
    return op?.id_operacao ?? null;
  }, [operacoes, f.produto]);

  // Ref para acessar o LTV atual dentro de handlers definidos antes da declaração
  // de `ltvMax` (evita "cannot access before initialization").
  const ltvMaxRef = useRef(0.8);

  function set(k: string, v: any) {
    if (k === "valor_entrada") setEntradaTocada(true);
    setF((prev) => {
      const next = { ...prev, [k]: v };
      // Percentual padrão de entrada = 1 - LTV do banco (20% no SFH, 30% em
      // terreno/comercial, 40% em home equity).
      const pctEntradaDefault = 1 - ltvMaxRef.current;
      if (k === "valor_imovel" && !entradaTocada)
        next.valor_entrada = Math.round((next.valor_imovel || 0) * pctEntradaDefault);
      if (k === "valor_imovel" || k === "valor_entrada")
        next.valor_financiamento = Math.max(
          0,
          (next.valor_imovel || 0) - (next.valor_entrada || 0),
        );

      if (k === "estado_civil") {
        next.possui_conjuge = v === "CA" || v === "UE";
        // Quando for casado/UE, por padrão ativa compoe_renda_conjuge
        if (next.possui_conjuge) {
          next.compoe_renda_conjuge = true;
          next.compoe_renda = true;
        } else {
          next.compoe_renda_conjuge = false;
          next.compoe_renda = false;
        }
      }
      return next;
    });

    // Limpa o erro do campo alterado imediatamente para habilitar o botão de envio
    if (erros[k]) {
      setErros((prev) => {
        const novos = { ...prev };
        delete novos[k];
        return novos;
      });
    }
  }

  // Datas adicionais consideradas no cálculo do prazo máximo: o banco usa a
  // idade do MAIS VELHO para o teto de idade ao término, mas apenas se o
  // proponente estiver compondo renda.
  const datasProponentesPrazo = useMemo(() => {
    const extras: string[] = [];
    if (f.compoe_renda_conjuge && f.data_nascimento_conjuge) extras.push(f.data_nascimento_conjuge);
    return extras;
  }, [f.compoe_renda_conjuge, f.data_nascimento_conjuge]);

  const maxPrazoIdade = useMemo(
    () => prazoMaximoParaProponentes([f.data_nascimento, ...datasProponentesPrazo]),
    [f.data_nascimento, datasProponentesPrazo],
  );

  const melhorTaxaAno = useMemo(() => {
    const selecionados = (bancos ?? []).filter((b) => f.bancos_ids.includes(b.id));
    const base = selecionados.length > 0 ? selecionados : (bancos ?? []);
    if (base.length === 0) return 0.1199;
    // "Melhor" taxa = a MENOR entre os bancos escolhidos. Usar Math.max inflava
    // artificialmente a parcela e, portanto, a renda mínima exibida na dica.
    return Math.min(...base.map((b) => taxaAnoDeBanco(b.codigo_banco)));
  }, [bancos, f.bancos_ids]);

  const rendaConsiderada = useMemo(
    () =>
      (Number(f.renda_total) || 0) + (f.compoe_renda_conjuge ? Number(f.renda_conjuge) || 0 : 0),
    [f.renda_total, f.compoe_renda_conjuge, f.renda_conjuge],
  );

  // Restrições operacionais por tipo de operação:
  //  - Terreno (TE/TC): apenas Bradesco opera, LTV 70%, prazo máx 240 meses.
  //  - Imóvel comercial (uso "C"): todos os bancos operam, LTV 70%, prazo máx 240 meses.
  //  - Home Equity: Itaú não opera; LTV 70% (entrada mínima 30%).
  const restricaoEspecial = useMemo(
    () => calcularRestricaoEspecial(f),
    [f.tipo_imovel, f.uso_imovel],
  );

  const isHomeEquity = f.produto === "home_equity";

  // Home Equity sempre usa imóvel já existente como garantia. Mantém esse
  // ajuste restrito ao produto HE para não alterar o financiamento imobiliário.
  useEffect(() => {
    if (!isHomeEquity || f.situacao_imovel === "U") return;
    setF((prev) =>
      prev.produto === "home_equity" && prev.situacao_imovel !== "U"
        ? { ...prev, situacao_imovel: "U" }
        : prev,
    );
  }, [isHomeEquity, f.situacao_imovel]);

  function aceitaBancoNaOperacao(b: {
    codigo_banco?: number | string | null;
    nome_banco?: string | null;
  }) {
    return aceitaBancoNaOperacaoPuro(b, { isHomeEquity, restricao: restricaoEspecial });
  }

  function mensagemBancoIncompativel(b: {
    codigo_banco?: number | string | null;
    nome_banco?: string | null;
  }) {
    return mensagemBancoIncompativelPuro(b, { isHomeEquity, restricao: restricaoEspecial });
  }

  // Teto de financiamento (LTV) por produto e restrição especial.
  const ltvMax = restricaoEspecial.ativo ? restricaoEspecial.ltvMax : isHomeEquity ? 0.7 : 0.8;
  // Mantém a ref sincronizada para handlers criados antes desta linha.
  ltvMaxRef.current = ltvMax;

  // Reajusta entrada/financiamento quando o LTV muda (ex.: usuário seleciona
  // Terreno/Comercial → 70%, ou volta para Residencial → 80%). Garante que o
  // financiamento nunca ultrapasse o teto do banco, adaptando a entrada.
  useEffect(() => {
    const imovel = Number(f.valor_imovel) || 0;
    if (imovel <= 0) return;
    const { financiamentoMaximo, entradaMinima } = limitesLtv(imovel, ltvMax);
    const finAtual = Number(f.valor_financiamento) || 0;

    // Se o financiamento atual exceder o máximo permitido pelo LTV,
    // ajustamos a entrada para cobrir a diferença.
    // Usamos comparação em centavos para evitar resíduos de float.
    const finAtualCentavos = Math.round(finAtual * 100);
    const finMaxCentavos = Math.round(financiamentoMaximo * 100);

    if (finAtualCentavos > finMaxCentavos) {
      setEntradaTocada(true);
      setF((prev) => ({
        ...prev,
        valor_entrada: entradaMinima,
        valor_financiamento: financiamentoMaximo,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ltvMax]);
  // Home Equity: prazo máximo operacional de 240 meses (regra das IFs).
  const prazoMaxOperacional = useMemo(() => {
    const restr = restricaoEspecial.ativo ? restricaoEspecial.prazoMax : 420;
    const he = isHomeEquity ? 240 : 420;
    return Math.min(restr, he);
  }, [restricaoEspecial, isHomeEquity]);
  /**
   * Piso de prazo aprendido com as respostas das IFs para os bancos
   * selecionados e o tipo de imóvel atual. Vazio = sem piso conhecido.
   */
  const prazoMinOperacional = useMemo(() => {
    const aprendidos = (configModulos?.["simulacao_prazos_minimos"] ?? {}) as Record<
      string,
      unknown
    >;
    const tipo = f.tipo_imovel || "NA";
    const selecionados = (bancos ?? []).filter((b: any) => f.bancos_ids.includes(b.id));
    let maior = 0;
    for (const b of selecionados) {
      const cod = String((b as any).codigo_banco ?? "").replace(/^0+/, "");
      const nome = String((b as any).nome_banco ?? "").toLowerCase();
      const valor = Number(aprendidos[`${cod}:${tipo}`] ?? aprendidos[`${nome}:${tipo}`] ?? 0);
      if (Number.isFinite(valor) && valor > maior) maior = valor;
    }
    return maior;
  }, [configModulos, f.tipo_imovel, f.bancos_ids, bancos]);
  const prazoMaximo = useMemo(() => {
    const idade = maxPrazoIdade ?? 420;
    return Math.min(idade, prazoMaxOperacional);
  }, [maxPrazoIdade, prazoMaxOperacional]);
  /**
   * Aviso (nunca bloqueio): o piso aprendido para esta combinação é maior que
   * o teto por idade dos proponentes, então o banco provavelmente recusará.
   */
  const terrenoInviavelPorIdade =
    prazoMinOperacional > 0 && maxPrazoIdade != null && maxPrazoIdade < prazoMinOperacional;
  const mensagemPrazoInviavel = terrenoInviavelPorIdade
    ? `Em operações anteriores este banco exigiu no mínimo ${prazoMinOperacional} meses, mas a idade dos proponentes permite no máximo ${maxPrazoIdade}. O banco pode recusar.`
    : null;
  const financiamentoMaximo = useMemo(() => {
    const imovel = Number(f.valor_imovel) || 0;
    const { financiamentoMaximo } = limitesLtv(imovel, ltvMax);
    return financiamentoMaximo;
  }, [f.valor_imovel, ltvMax]);

  const despesasNoTeto = f.fg_financiar_despesas ? Number(f.valor_despesas_financiadas) || 0 : 0;
  const financiamentoImovelMaximo = Math.max(0, financiamentoMaximo - despesasNoTeto);

  /** Valor a financiar exibido: parcela do imóvel + despesas financiadas. */
  const financiamentoTotalExibido = (Number(f.valor_financiamento) || 0) + despesasNoTeto;

  const entradaMinima = useMemo(() => {
    const imovel = Number(f.valor_imovel) || 0;
    const { entradaMinima } = limitesLtv(imovel, ltvMax);
    return entradaMinima;
  }, [f.valor_imovel, ltvMax]);

  const entradaMinimaEfetiva = useMemo(() => {
    const imovel = Number(f.valor_imovel) || 0;
    const { entradaMinima } = limitesLtv(imovel, ltvMax);
    // Se o financiamento máximo é reduzido pelas despesas, a entrada mínima sobe
    return Math.max(0, imovel - financiamentoImovelMaximo);
  }, [f.valor_imovel, financiamentoImovelMaximo, ltvMax]);

  const financiamentoExcedido = useMemo(() => {
    const imovel = Number(f.valor_imovel) || 0;
    if (imovel <= 0) return false;
    const atual = Number(f.valor_financiamento) || 0;
    const atualCentavos = Math.round(atual * 100);
    const maxCentavos = Math.round(financiamentoImovelMaximo * 100);
    return atualCentavos > maxCentavos;
  }, [f.valor_imovel, f.valor_financiamento, financiamentoImovelMaximo]);

  const entradaInsuficiente = useMemo(() => {
    const imovel = Number(f.valor_imovel) || 0;
    if (imovel <= 0) return false;
    const atual = Number(f.valor_entrada) || 0;
    const atualCentavos = Math.round(atual * 100);
    const minCentavos = Math.round(entradaMinimaEfetiva * 100);
    return atualCentavos < minCentavos;
  }, [f.valor_entrada, entradaMinimaEfetiva, f.valor_imovel]);

  /** Aplica o prazo digitado, ajustando pela idade e pelo teto da operação. */
  function definirPrazo(valor: number) {
    if (!Number.isFinite(valor) || valor <= 0) {
      set("prazo", 0);
      return;
    }
    const { prazo, ajustado, mensagem } = ajustarPrazoPorIdade(
      valor,
      f.data_nascimento,
      datasProponentesPrazo,
    );
    let final = prazo;
    if (restricaoEspecial.ativo && final > restricaoEspecial.prazoMax) {
      final = restricaoEspecial.prazoMax;
      toast.warning(
        `${restricaoEspecial.motivo}: prazo máximo de ${restricaoEspecial.prazoMax} meses.`,
      );
    } else if (isHomeEquity && final > 240) {
      final = 240;
      toast.warning("Home Equity: prazo máximo de 240 meses.");
    } else if (ajustado && mensagem) {
      toast.warning(mensagem);
    }
    if (prazoMinOperacional > 0 && final < prazoMinOperacional) {
      if (maxPrazoIdade != null && maxPrazoIdade < prazoMinOperacional) {
        toast.warning(mensagemPrazoInviavel ?? "Prazo abaixo do mínimo já exigido por este banco.");
      } else {
        final = prazoMinOperacional;
        toast.warning(
          `Este banco já exigiu no mínimo ${prazoMinOperacional} meses nesta modalidade. Ajustamos o campo automaticamente.`,
        );
      }
    }
    set("prazo", final);
  }

  // Recalcula o prazo sempre que o titular, o cônjuge ou as datas de nascimento
  // mudarem: o valor não pode ser herdado da simulação anterior. Reaplica o teto
  // por idade e o piso/teto operacional da modalidade.
  useEffect(() => {
    setF((prev) => {
      const atual = Number(prev.prazo) || 0;
      if (atual <= 0) return prev;
      let alvo = atual;
      if (maxPrazoIdade != null && alvo > maxPrazoIdade) alvo = maxPrazoIdade;
      if (alvo > prazoMaxOperacional) alvo = prazoMaxOperacional;
      if (
        prazoMinOperacional > 0 &&
        alvo < prazoMinOperacional &&
        (maxPrazoIdade == null || maxPrazoIdade >= prazoMinOperacional)
      ) {
        alvo = prazoMinOperacional;
      }
      if (alvo === atual) return prev;
      toast.warning(
        `Prazo recalculado de ${atual} para ${alvo} meses conforme a idade dos proponentes e os limites da modalidade.`,
      );
      return { ...prev, prazo: alvo };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxPrazoIdade, prazoMaxOperacional, prazoMinOperacional, f.cpf_cnpj, f.cliente_id]);

  // Aplica restrições operacionais:
  //  - Terreno/Comercial: prazo <=240m; Terreno filtra apenas Bradesco.
  //  - Home Equity: remove Itaú dos bancos selecionados.
  useEffect(() => {
    if (!restricaoEspecial.ativo && !isHomeEquity) return;
    setF((prev) => {
      const bancosFiltrados = prev.bancos_ids.filter((id: string) => {
        const b = (bancos ?? []).find((x) => x.id === id);
        return b ? aceitaBancoNaOperacao(b) : false;
      });
      let prazoClamp = Math.min(prev.prazo, prazoMaxOperacional);
      if (
        prazoMinOperacional > 0 &&
        prazoClamp < prazoMinOperacional &&
        (maxPrazoIdade == null || maxPrazoIdade >= prazoMinOperacional)
      ) {
        prazoClamp = prazoMinOperacional;
      }
      const mudouBancos = bancosFiltrados.length !== prev.bancos_ids.length;
      const mudouPrazo = prazoClamp !== prev.prazo;
      if (!mudouBancos && !mudouPrazo) return prev;
      if (mudouBancos) {
        if (restricaoEspecial.apenasBradesco) {
          toast.info(
            `${restricaoEspecial.motivo}: apenas Bradesco opera. Outros bancos foram removidos.`,
          );
        } else if (isHomeEquity) {
          toast.info("Home Equity: Itaú não opera este produto. Banco removido.");
        } else {
          toast.info("Bancos incompatíveis com a operação foram removidos.");
        }
      }
      if (mudouPrazo) {
        if (isHomeEquity && prazoClamp === 240) {
          toast.info("Home Equity: prazo ajustado para 240 meses.");
        } else if (restricaoEspecial.ativo) {
          toast.info(
            `${restricaoEspecial.motivo}: prazo ajustado para ${restricaoEspecial.prazoMax} meses.`,
          );
        }
      }
      return { ...prev, bancos_ids: bancosFiltrados, prazo: prazoClamp };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    restricaoEspecial.ativo,
    restricaoEspecial.apenasBradesco,
    isHomeEquity,
    bancos,
    prazoMaxOperacional,
  ]);

  // Ambos SAC+PRICE: preenche automaticamente "Renda familiar — PRICE" enquanto
  // o campo estiver vazio. Se a renda informada já cobre o mínimo do PRICE, usa
  // a própria renda; caso contrário usa a renda mínima necessária no PRICE
  // (o usuário pode alterar depois).
  useEffect(() => {
    if (f.sistema_amortizacao !== "B") return;
    const rendaTotal = Number(f.renda_total) || 0;
    const rendaPrice = Number(f.renda_price) || 0;
    if (rendaPrice > 0) return;
    if (!(Number(f.valor_financiamento) > 0) || !(Number(f.prazo) > 0)) return;
    const av = avaliarRendaMinima({
      valor_imovel: f.valor_imovel,
      valor_financiamento: f.valor_financiamento,
      prazo_meses: f.prazo,
      taxa_ano: melhorTaxaAno,
      sistema: "P",
      renda_informada: rendaTotal > 0 ? rendaTotal : undefined,
    });
    if (!av) return;
    const alvo = rendaTotal >= av.rendaMinima ? rendaTotal : av.rendaMinima;
    if (!(alvo > 0)) return;
    setF((prev) => (Number(prev.renda_price) > 0 ? prev : { ...prev, renda_price: alvo }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    f.sistema_amortizacao,
    f.renda_total,
    f.valor_financiamento,
    f.valor_imovel,
    f.prazo,
    melhorTaxaAno,
  ]);

  // Mantém as despesas coladas no percentual e respeita o teto de LTV.
  useEffect(() => {
    if (!f.fg_financiar_despesas) return;
    const imovel = Number(f.valor_imovel) || 0;
    if (imovel <= 0) return;
    const pct = pctDespesas > 0 ? pctDespesas : 5;
    const despesasAlvo = Math.round(imovel * (pct / 100) * 100) / 100;
    const despesas = Number(f.valor_despesas_financiadas) || 0;
    if (Math.abs(despesas - despesasAlvo) > 0.5) {
      setF((prev) => ({ ...prev, valor_despesas_financiadas: despesasAlvo }));
      return;
    }
    const financiamentoComDespesas = (Number(f.valor_financiamento) || 0) + despesas;
    if (financiamentoComDespesas <= financiamentoMaximo) return;
    const novoFinanciamento = Math.max(0, financiamentoMaximo - despesas);
    const novaEntrada = imovel - novoFinanciamento;
    setEntradaTocada(true);
    setF((prev) => ({
      ...prev,
      valor_entrada: novaEntrada,
      valor_financiamento: novoFinanciamento,
    }));
    const pctEntrada = Math.round((novaEntrada / imovel) * 100);
    toast.info(
      `Entrada ajustada para ${pctEntrada}% (${formatBRL(novaEntrada)}) — o financiamento com as despesas não pode passar de ${Math.round(ltvMax * 100)}% do imóvel.`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    f.fg_financiar_despesas,
    f.valor_despesas_financiadas,
    f.valor_financiamento,
    f.valor_imovel,
    pctDespesas,
    financiamentoMaximo,
  ]);

  function aplicarEntradaSugerida() {
    setEntradaTocada(true);
    setF((prev) => ({ ...prev, ...calcularEntradaSugerida(prev.valor_imovel || 0, ltvMax) }));
  }

  /**
   * Preenche imóvel + financiamento a partir do valor de entrada.
   * Regra: entrada = (1 - LTV) do imóvel  ⇒  imóvel = entrada / (1 - LTV).
   */
  function aplicarPorEntrada(valorEntrada: number) {
    setEntradaTocada(true);
    setF((prev) => ({
      ...prev,
      ...calcularPorEntrada(valorEntrada, ltvMax, Number(prev.valor_imovel) || 0),
    }));
  }

  /**
   * Preenche imóvel + entrada a partir do valor a financiar (lógica inversa).
   * valorImóvel = financiamento / LTV; entrada = imóvel - financiamento.
   */
  function aplicarPorFinanciamento(valorFinanciamento: number) {
    setEntradaTocada(true);
    setF((prev) => ({
      ...prev,
      ...calcularPorFinanciamento(valorFinanciamento, ltvMax, Number(prev.valor_imovel) || 0),
    }));
  }

  /**
   * "Valor a financiar" exibido ao usuário JÁ INCLUI as despesas financiadas.
   * Ao digitar o total, descontamos as despesas para obter a parcela do
   * imóvel e recalculamos entrada/imóvel a partir dela.
   */
  function aplicarPorFinanciamentoTotal(valorTotal: number) {
    const despesas = f.fg_financiar_despesas ? Number(f.valor_despesas_financiadas) || 0 : 0;
    aplicarPorFinanciamento(Math.max(0, (Number(valorTotal) || 0) - despesas));
  }

  /**
   * Wrapper fino sobre `calcularPorParcela` — a fórmula (PV a partir de PMT
   * alvo) mora em `calculos.ts`.
   */
  function aplicarPorParcela(parcelaAlvo: number) {
    setEntradaTocada(true);
    const patch = calcularPorParcela(parcelaAlvo, {
      ltvMax,
      melhorTaxaAno,
      prazo: Number(f.prazo) || 360,
      sistemaAmortizacao: String(f.sistema_amortizacao ?? "S"),
    });
    setF((prev) => ({ ...prev, ...patch }));
  }

  /** Aplica a "jogada de números": infla o valor de compra e venda para liberar o financiamento. */
  function aplicarJogadaNumeros(dados: {
    valorImovel: number;
    valorEntrada: number;
    valorFinanciamento: number;
    financiaCustas: boolean;
    valorCustas: number;
  }) {
    setEntradaTocada(true);
    setF((prev) => ({
      ...prev,
      valor_imovel: dados.valorImovel,
      valor_entrada: dados.valorEntrada,
      valor_financiamento: dados.valorFinanciamento,
      // Quando a jogada inclui custas, marca o flag para o banco receber a
      // operação como "custas financiadas"; senão, desliga para não desfazer a jogada.
      fg_financiar_despesas: dados.financiaCustas,
      valor_despesas_financiadas: dados.financiaCustas ? dados.valorCustas : 0,
    }));
    if (dados.financiaCustas) {
      const pct =
        dados.valorImovel > 0 ? Math.round((dados.valorCustas / dados.valorImovel) * 1000) / 10 : 5;
      setPctDespesas(pct > 0 ? pct : 5);
    }
    const msgCustas = dados.financiaCustas
      ? `, custas financiadas ${formatBRL(dados.valorCustas)}`
      : "";
    toast.success(
      `Jogada aplicada: imóvel ${formatBRL(dados.valorImovel)}, entrada ${formatBRL(dados.valorEntrada)}, financiamento ${formatBRL(dados.valorFinanciamento)}${msgCustas}.`,
    );
  }

  function setSistemaAmortizacao(v: string) {
    if (v === "P") {
      const elegiveis = (bancos ?? []).filter(aceitaPrice).map((b) => b.id);
      if (elegiveis.length === 0) {
        toast.error(
          "O sistema PRICE está disponível apenas em Bradesco e Santander — nenhum deles está habilitado.",
        );
      } else {
        toast.info("Sistema PRICE: apenas Bradesco e Santander foram mantidos na seleção.");
      }
      setF((prev) => ({ ...prev, sistema_amortizacao: v, bancos_ids: elegiveis }));
      return;
    }
    if (v === "B") {
      // Modo "Ambos": mantém as seleções separadas por sistema.
      // Se ainda não há bancos separados, propaga a seleção atual como base
      // para SAC (todos elegíveis) e PRICE (só Bradesco/Santander).
      setF((prev) => {
        const sacBase = prev.bancos_sac_ids.length > 0 ? prev.bancos_sac_ids : prev.bancos_ids;
        const priceBase =
          prev.bancos_price_ids.length > 0
            ? prev.bancos_price_ids
            : prev.bancos_ids.filter((id: string) => {
                const b = (bancos ?? []).find((x) => x.id === id);
                return b ? aceitaPrice(b) : false;
              });
        return {
          ...prev,
          sistema_amortizacao: "B",
          bancos_sac_ids: sacBase,
          bancos_price_ids: priceBase,
        };
      });
      toast.info(
        "Modo Ambos: escolha os bancos SAC e PRICE separadamente e preencha a renda para PRICE.",
      );
      return;
    }
    set("sistema_amortizacao", v);
  }

  function toggleBanco(id: string, sistemaAlvo?: "S" | "P") {
    setF((prev) => {
      const banco = (bancos ?? []).find((b) => b.id === id);

      // Modo "Ambos": alterna dentro de bancos_sac_ids ou bancos_price_ids.
      if (prev.sistema_amortizacao === "B" && sistemaAlvo) {
        if (sistemaAlvo === "P" && banco && !aceitaPrice(banco)) {
          toast.info("PRICE: apenas Bradesco e Santander operam esse sistema.");
          return prev;
        }
        if (banco && !aceitaBancoNaOperacao(banco)) {
          toast.info(mensagemBancoIncompativel(banco));
          return prev;
        }
        const key = sistemaAlvo === "S" ? "bancos_sac_ids" : "bancos_price_ids";
        const arr = (prev[key] as string[]) ?? [];
        const has = arr.includes(id);
        return { ...prev, [key]: has ? arr.filter((x) => x !== id) : [...arr, id] };
      }

      const has = prev.bancos_ids.includes(id);
      if (prev.sistema_amortizacao === "P" && !has && banco && !aceitaPrice(banco)) {
        toast.info("No sistema PRICE, apenas Bradesco e Santander podem ser selecionados.");
        return prev;
      }
      if (!has && banco && !aceitaBancoNaOperacao(banco)) {
        toast.info(mensagemBancoIncompativel(banco));
        return prev;
      }
      // Em "Nova Proposta" a seleção é única: o banco escolhido é o que
      // receberá a proposta. Marcar outro substitui o anterior.
      if (modoProposta) {
        return { ...prev, bancos_ids: has ? [] : [id] };
      }
      return {
        ...prev,
        bancos_ids: has
          ? prev.bancos_ids.filter((x: string) => x !== id)
          : [...prev.bancos_ids, id],
      };
    });
  }

  // Invariante: composição de renda só existe com estado civil CA/UE.
  useEffect(() => {
    const casado = f.estado_civil === "CA" || f.estado_civil === "UE";
    if (casado) return;
    setF((prev) =>
      prev.compoe_renda || prev.compoe_renda_conjuge
        ? { ...prev, compoe_renda: false, compoe_renda_conjuge: false }
        : prev,
    );
  }, [f.estado_civil]);

  const mostraConjuge = f.possui_conjuge;

  const obterClienteCrmFn = useServerFn(obterClienteCRM);
  const { data: crmVinculado, refetch: refetchCrm } = useQuery({
    queryKey: ["cliente-crm-vinculado", f.cliente_id],
    queryFn: () => obterClienteCrmFn({ data: { id: f.cliente_id as string } }),
    enabled: Boolean(f.cliente_id),
    refetchInterval: 5000, // Atualiza a cada 5s para refletir mudanças no cadastro (CRM) de forma "instantânea"
  });

  const crmTemConjuge = Boolean(
    crmVinculado &&
    (crmVinculado.conjuge_nome || crmVinculado.conjuge_cpf || crmVinculado.conjuge_renda),
  );

  const podePuxarConjugeCrm =
    crmTemConjuge && (!String(f.nome_conjuge ?? "").trim() || faltaConjugeDoCRM(f, crmVinculado));

  const puxarConjugeDoCRM = useCallback(() => {
    if (!crmVinculado) return;
    setF((prev) => patchPuxarConjugeCRM(prev, crmVinculado));
    toast.success("Dados do cônjuge puxados do cadastro do CRM.");
  }, [crmVinculado]);

  // Casado/união estável: completa automaticamente os dados do cônjuge com o
  // que existe no CRM (merge — nunca sobrescreve o que o usuário digitou).
  // Também atualiza os dados do titular e do cônjuge quando o cadastro no CRM muda.
  useEffect(() => {
    if (!crmVinculado || invertido) return;

    // 1. Atualiza dados do titular se houver mudanças no CRM
    setF((prev) => {
      // Evita loops infinitos: só atualiza se os dados forem diferentes
      const nomeDiferente = crmVinculado.nome && prev.nome_cliente !== crmVinculado.nome;
      const rendaDiferente =
        crmVinculado.renda_total_declarada &&
        prev.renda_total !== crmVinculado.renda_total_declarada;

      if (nomeDiferente || rendaDiferente) {
        return {
          ...prev,
          nome_cliente: crmVinculado.nome ?? prev.nome_cliente,
          renda_total: Number(crmVinculado.renda_total_declarada) || prev.renda_total,
          cpf_cnpj: crmVinculado.documento ? maskCpfCnpj(crmVinculado.documento) : prev.cpf_cnpj,
          email: crmVinculado.email || prev.email,
          celular: crmVinculado.telefone_celular
            ? maskCelular(crmVinculado.telefone_celular)
            : prev.celular,
          data_nascimento: crmVinculado.data_nascimento ?? prev.data_nascimento,
        };
      }
      return prev;
    });

    // 2. Merge de cônjuge
    const casado = f.estado_civil === "CA" || f.estado_civil === "UE";
    if (!casado || !crmTemConjuge) return;

    // Se o cônjuge já está preenchido (ou se acabamos de inverter), não aplica o merge automático
    // para não desfazer a vontade do usuário, EXCETO se o usuário pedir explicitamente via botão.
    // Mas para satisfazer a regra de "atualizar instantaneamente", fazemos um merge suave.
    if (String(f.nome_conjuge ?? "").trim()) {
      // Se já tem nome, apenas sincroniza campos vazios
      setF((prev) => patchPuxarConjugeCRM(prev, crmVinculado));
      return;
    }

    puxarConjugeDoCRM();
  }, [f.estado_civil, crmVinculado, crmTemConjuge, f.nome_conjuge, puxarConjugeDoCRM, invertido]);

  const podeInverter = useMemo(() => {
    return (
      mostraConjuge &&
      String(f.nome_conjuge ?? "").trim().length >= 3 &&
      String(f.cpf_conjuge ?? "").trim().length > 0 &&
      String(f.data_nascimento_conjuge ?? "").trim().length > 0
    );
  }, [mostraConjuge, f.nome_conjuge, f.cpf_conjuge, f.data_nascimento_conjuge]);

  /** Inverte titular ⇄ cônjuge. */
  const inverterPrincipal = useCallback(() => {
    // Validação prévia de CPFs iguais para mostrar o alerta antes de inverter se necessário,
    // ou apenas garantir que a troca não resulte em duplicidade de CPF.
    if (f.cpf_cnpj && f.cpf_cnpj === f.cpf_conjuge) {
      toast.error("O titular e o cônjuge não podem ter o mesmo CPF.");
      return;
    }

    setF((prev) => {
      const next = patchInverterPrincipal(prev);

      // Verificação de segurança após a troca
      if (next.cpf_cnpj === prev.cpf_cnpj && next.nome_cliente === prev.nome_cliente) {
        if (!prev.nome_conjuge && !prev.cpf_conjuge) {
          toast.error("Preencha os dados do cônjuge para realizar a inversão.");
          return prev;
        }
      }

      // Preenchimento automático da renda necessária após inverter
      if (next.valor_financiamento > 0 && next.prazo > 0) {
        // SAC
        const avalSac = avaliarRendaMinima({
          valor_financiamento: next.valor_financiamento,
          valor_imovel: next.valor_imovel,
          prazo_meses: next.prazo,
          taxa_ano: melhorTaxaAno,
          sistema: "S",
        });
        if (avalSac) next.renda_total = avalSac.rendaMinima;

        // PRICE (apenas se estiver em modo Ambos/PRICE)
        if (next.sistema_amortizacao === "B" || next.sistema_amortizacao === "P") {
          const avalPrice = avaliarRendaMinima({
            valor_financiamento: next.valor_financiamento,
            valor_imovel: next.valor_imovel,
            prazo_meses: next.prazo,
            taxa_ano: melhorTaxaAno,
            sistema: "P",
          });
          if (avalPrice) next.renda_price = avalPrice.rendaMinima;
        }
      }

      return next;
    });
    setInvertido(true);
    setErros({});
    toast.success("Titular e cônjuge invertidos com rendas sugeridas.");
  }, [f.cpf_cnpj, f.cpf_conjuge, f.nome_cliente, f.nome_conjuge]);

  /** Seleciona o titular a partir de um cliente do CRM. */
  function selecionarClienteCRM(c: any) {
    let resumo: { temConjugePreenchido: boolean; nomeCadastro: string } = {
      temConjugePreenchido: false,
      nomeCadastro: "",
    };
    setF((prev) => {
      const { next, temConjugePreenchido, nomeCadastro } = patchSelecionarClienteCRM(prev, c);
      resumo = { temConjugePreenchido, nomeCadastro };
      return next;
    });
    setCadastroNome(resumo.nomeCadastro);
    setInvertido(false);
    toast.success(
      resumo.temConjugePreenchido
        ? "Dados do cliente e do cônjuge preenchidos."
        : "Dados do cliente preenchidos.",
    );
  }

  /** Remove o vínculo do titular com o cadastro do CRM. */
  function limparTitular() {
    setF(patchLimparTitular);
    setCadastroNome(null);
    setInvertido(false);
    toast.info("Titular removido. Pesquise outro cliente ou preencha manualmente.");
  }

  /** Marca/desmarca o financiamento das despesas (padrão 5% do imóvel). */
  function alternarFinanciarDespesas(marcado: boolean) {
    set("fg_financiar_despesas", marcado);
    if (marcado) {
      setPctDespesas(5);
      set("valor_despesas_financiadas", Math.round((f.valor_imovel || 0) * 0.05 * 100) / 100);
    }
  }

  /** Ajusta o percentual de despesas a financiar (1 a 5%). */
  function definirPctDespesas(raw: string) {
    const limpo = raw.replace(/[^\d,.]/g, "").replace(",", ".");
    let pct = limpo ? Number(limpo) : 0;
    if (Number.isNaN(pct)) pct = 0;
    if (pct > 5) pct = 5;
    setPctDespesas(pct);
    set("valor_despesas_financiadas", Math.round((f.valor_imovel || 0) * (pct / 100) * 100) / 100);
  }

  /** Garante o mínimo de 1% ao sair do campo de percentual. */
  function normalizarPctDespesas() {
    if (pctDespesas > 0 && pctDespesas < 1) {
      setPctDespesas(1);
      set("valor_despesas_financiadas", Math.round((f.valor_imovel || 0) * 0.01 * 100) / 100);
    }
  }

  /** Verifica a renda contra o sugestivo; abre o popup de confirmação se insuficiente. (Problema 3) */
  function rendaSuficiente(): boolean {
    const { rendaMinimaSugerida } = require("@/lib/simulacao/renda");
    const av = rendaMinimaSugerida({
      valor_imovel: Number(f.valor_imovel) || 0,
      valor_financiamento: Number(f.valor_financiamento) || 0,
      prazo_meses: f.prazo,
      taxa_ano: melhorTaxaAno,
      bancos_ids: f.bancos_ids,
      renda_informada: rendaConsiderada,
    });

    if (av && av.suficiente === false) {
      setConfirmRenda({
        rendaMinima: av.rendaMinima,
        rendaInformada: rendaConsiderada,
        detalhe_fonte: av.detalhe_fonte,
      });
      return false;
    }
    return true;
  }

  async function enviar() {
    // Aplica a renda mínima necessária antes de enviar, se a informada for menor.
    // Isso garante que a simulação sempre tenha sucesso nos bancos mesmo se o usuário esquecer de ajustar.
    let fEnvio = { ...f };
    let houveAjuste = false;

    if (fEnvio.valor_financiamento > 0 && fEnvio.prazo > 0) {
      // SAC
      const avalSac = avaliarRendaMinima({
        valor_financiamento: fEnvio.valor_financiamento,
        valor_imovel: fEnvio.valor_imovel,
        prazo_meses: fEnvio.prazo,
        taxa_ano: melhorTaxaAno,
        sistema: "S",
      });
      if (avalSac && (Number(fEnvio.renda_total) || 0) < avalSac.rendaMinima) {
        fEnvio.renda_total = avalSac.rendaMinima;
        houveAjuste = true;
      }

      // PRICE (no modo Ambos ou sistema PRICE)
      if (fEnvio.sistema_amortizacao === "B" || fEnvio.sistema_amortizacao === "P") {
        const avalPrice = avaliarRendaMinima({
          valor_financiamento: fEnvio.valor_financiamento,
          valor_imovel: fEnvio.valor_imovel,
          prazo_meses: fEnvio.prazo,
          taxa_ano: melhorTaxaAno,
          sistema: "P",
        });
        const rendaPriceAtual =
          fEnvio.sistema_amortizacao === "B"
            ? Number(fEnvio.renda_price) || 0
            : Number(fEnvio.renda_total) || 0;

        if (avalPrice && rendaPriceAtual < avalPrice.rendaMinima) {
          if (fEnvio.sistema_amortizacao === "B") {
            fEnvio.renda_price = avalPrice.rendaMinima;
          } else {
            fEnvio.renda_total = avalPrice.rendaMinima;
          }
          houveAjuste = true;
        }
      }
    }

    if (houveAjuste) {
      setF(fEnvio);
      toast.info(
        "Ajustamos a renda para o mínimo necessário para garantir o sucesso da simulação.",
      );
    }

    if (fEnvio.sistema_amortizacao === "B") {
      await executarEnvioAmbos({
        f: fEnvio,
        idOperacao,
        router,
        setErros,
        setEnviando,
        setConcluidos,
        setSimulacaoResultadoId,
        setSimulacaoResultadoIdPrice,
        setSimulacaoResultadoIdSecundario,
      });
      return;
    }

    // 1. Validar esquema completo (Zod)
    const parsed = completaSchema.safeParse({ ...fEnvio, id_operacao_homefin: idOperacao });
    if (!parsed.success) {
      const novos: Record<string, string> = {};
      let firstErrorKey: string | null = null;
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        novos[key] = issue.message;
        if (!firstErrorKey) firstErrorKey = key;
      }
      setErros(novos);
      toast.error(mensagemCamposPendentes(Object.keys(novos)));

      // Scroll para o primeiro campo com erro
      if (firstErrorKey && typeof document !== "undefined") {
        const fieldName = firstErrorKey;
        const el =
          document.getElementsByName(fieldName)[0] ||
          document.getElementById(fieldName) ||
          document.querySelector(`[aria-invalid][name="${fieldName}"]`) ||
          document.querySelector(`[name="${fieldName}"]`);

        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
            setTimeout(() => el.focus(), 500);
          }
        }
      }
      return;
    }
    setErros({});

    const imovel = Number(fEnvio.valor_imovel) || 0;
    const entrada = Number(fEnvio.valor_entrada) || 0;
    const fin = Number(fEnvio.valor_financiamento) || 0;
    if (imovel > 0 && Math.abs(imovel - (entrada + fin)) > 1) {
      toast.error(
        `Os valores não batem: entrada (${formatBRL(entrada)}) + financiamento (${formatBRL(fin)}) = ${formatBRL(entrada + fin)}, mas o imóvel vale ${formatBRL(imovel)}. Ajuste antes de enviar.`,
      );
      return;
    }
    if (financiamentoExcedido) {
      toast.error(
        fEnvio.fg_financiar_despesas
          ? `Financiamento + despesas não pode passar de ${Math.round(ltvMax * 100)}% do imóvel (${formatBRL(financiamentoMaximo)}). Aumente a entrada para pelo menos ${formatBRL(entradaMinimaEfetiva)}.`
          : `O banco financia no máximo ${Math.round(ltvMax * 100)}% do imóvel (${formatBRL(financiamentoMaximo)}). Aumente a entrada para pelo menos ${formatBRL(entradaMinima)}.`,
      );
      return;
    }
    // Renda mínima não bloqueia mais o envio (Princípio #1 - Simulação nunca trava)
    // if (!rendaSuficiente()) return;
    await executarEnvio(fEnvio);
  }

  async function enviarAmbos() {
    await executarEnvioAmbos({
      f,
      idOperacao,
      router,
      setErros,
      setEnviando,
      setConcluidos,
      setSimulacaoResultadoId,
      setSimulacaoResultadoIdPrice,
      setSimulacaoResultadoIdSecundario,
    });
  }

  async function executarEnvio(dados: any) {
    await executarEnvioSimples({
      f: dados,
      idOperacao,
      modoProposta,
      router,
      setErros,
      setEnviando,
      setConcluidos,
      setSimulacaoResultadoId,
      setSimulacaoResultadoIdPrice,
      setSimulacaoResultadoIdSecundario,
    });
  }

  return {
    router,
    modoProposta,
    f,
    set,
    erros,
    enviando,
    concluidos,
    bancos: bancos as Banco[] | undefined,
    aceitaPrice,
    aceitaBancoNaOperacao,
    restricaoEspecial,
    prazoMinOperacional,
    terrenoInviavelPorIdade,
    mensagemPrazoInviavel,
    prazoMaximo,
    // valores calculados
    ltvMax,
    financiamentoMaximo,
    financiamentoImovelMaximo,
    financiamentoTotalExibido,
    entradaMinima,
    entradaMinimaEfetiva,
    financiamentoExcedido,
    maxPrazoIdade,
    melhorTaxaAno,
    rendaConsiderada,
    mostraConjuge,
    isHomeEquity,
    // vínculo CRM / inversão
    cadastroNome,
    invertido,
    crmVinculado,
    podePuxarConjugeCrm,
    podeInverter,
    // despesas
    pctDespesas,
    // confirmação de renda
    confirmRenda,
    setConfirmRenda,
    // handlers
    definirPrazo,
    aplicarEntradaSugerida,
    aplicarPorFinanciamento,
    aplicarPorFinanciamentoTotal,
    aplicarPorEntrada,
    aplicarPorParcela,

    aplicarJogadaNumeros,
    setSistemaAmortizacao,
    toggleBanco,
    puxarConjugeDoCRM,
    inverterPrincipal,
    selecionarClienteCRM,
    limparTitular,
    alternarFinanciarDespesas,
    definirPctDespesas,
    normalizarPctDespesas,
    enviar,
    executarEnvio,
    enviarAmbos,
    // Diálogo de envio
    envioEstado,
    statusPorBanco,
    abrirDialogEnvio,
    fecharDialogEnvio,
    // Handler individual para o diálogo
    enviarBancoIndividual: async (banco: any) => {
      if (!envioEstado) return;
      iniciarStatusEnvio(banco.id);
      return enviarPropostaHook({
        propostaId: undefined, // será criada
        bancoId: banco.id,
        criarPropostaFn: async () => {
          const { proposta_id } = await criarProposta({
            data: {
              simulacao_id: envioEstado.id,
              banco_id: banco.id,
            },
          });
          return { proposta_id };
        },
      });
    },
    enviarTodosBancos: async (bancos: any[]) => {
      if (!envioEstado) return;
      for (const b of bancos) {
        iniciarStatusEnvio(b.id);
        enviarPropostaHook({
          propostaId: undefined,
          bancoId: b.id,
          criarPropostaFn: async () => {
            const { proposta_id } = await criarProposta({
              data: {
                simulacao_id: envioEstado.id,
                banco_id: b.id,
              },
            });
            return { proposta_id };
          },
        });
      }
    },

    // resultado inline
    simulacaoResultadoId,
    simulacaoResultadoIdPrice,
    simulacaoResultadoIdSecundario,
    fecharResultadoInline: () => setSimulacaoResultadoId(null),
    fecharResultadoInlinePrice: () => setSimulacaoResultadoIdPrice(null),
    fecharResultadoInlineSecundario: () => setSimulacaoResultadoIdSecundario(null),
    refetchCrm,
  };
}
