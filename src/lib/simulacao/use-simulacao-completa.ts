import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { avaliarRendaMinima, TAXA_MIP_MES, TAXA_DFI_MES, TAXA_ADMIN_MES } from "@/lib/simulacao/renda";
import { taxaAnoDeBanco } from "@/lib/simulacao/simulacao-rapida";
import { completaSchema } from "@/lib/simulacao/schemas";
import { formatBRL } from "@/lib/simulacao/format";
import { ajustarPrazoPorIdade, prazoMaximoPorIdade } from "@/lib/simulacao/prazo";
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
  patchInverterPrincipal,
} from "./use-simulacao-completa/cliente-crm";
import {
  executarEnvioAmbos,
  executarEnvioSimples,
} from "./use-simulacao-completa/envio";

export type { Form };

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
  }>(null);
  const [pctDespesas, setPctDespesas] = useState<number>(0);
  // Guarda o id da última simulação gerada para exibir o resultado inline
  // (sem redirecionar), permitindo o usuário ajustar o prazo e simular novamente.
  const [simulacaoResultadoId, setSimulacaoResultadoId] = useState<string | null>(null);
  // Segundo id de simulação para o modo "Ambos" (uma simulação SAC + uma PRICE).
  const [simulacaoResultadoIdPrice, setSimulacaoResultadoIdPrice] = useState<string | null>(null);

  const { data: bancos } = useQuery({
    queryKey: ["bancos-ativos"],
    queryFn: () => listarBancosAtivos(),
  });
  const { data: operacoes } = useQuery({
    queryKey: ["operacoes"],
    queryFn: () => listarOperacoes(),
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

  // pré-preenche a partir da simulação duplicada (novo nº é gerado ao salvar)
  useEffect(() => {
    if (!origem?.simulacao) return;
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
      compoe_renda: Boolean(s.compoe_renda),
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
        next.valor_financiamento = Math.max(0, next.valor_imovel - next.valor_entrada);
      if (k === "estado_civil") next.possui_conjuge = v === "CA" || v === "UE";
      return next;
    });
  }

  const maxPrazoIdade = useMemo(
    () => prazoMaximoPorIdade(f.data_nascimento),
    [f.data_nascimento],
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
    () => (Number(f.renda_total) || 0) + (f.compoe_renda ? Number(f.renda_conjuge) || 0 : 0),
    [f.renda_total, f.compoe_renda, f.renda_conjuge],
  );

  // Restrições operacionais por tipo de operação:
  //  - Terreno (TE/TC): apenas Bradesco opera, LTV 70%, prazo máx 240 meses.
  //  - Imóvel comercial (uso "C"): todos os bancos operam, LTV 70%, prazo máx 240 meses.
  //  - Home Equity: Itaú não opera; LTV 60%.
  const restricaoEspecial = useMemo(
    () => calcularRestricaoEspecial(f),
    [f.tipo_imovel, f.uso_imovel],
  );

  const isHomeEquity = f.produto === "home_equity";

  function aceitaBancoNaOperacao(b: { codigo_banco?: number | string | null; nome_banco?: string | null }) {
    return aceitaBancoNaOperacaoPuro(b, { isHomeEquity, restricao: restricaoEspecial });
  }

  function mensagemBancoIncompativel(b: { codigo_banco?: number | string | null; nome_banco?: string | null }) {
    return mensagemBancoIncompativelPuro(b, { isHomeEquity, restricao: restricaoEspecial });
  }


  // Teto de financiamento (LTV) por produto e restrição especial.
  const ltvMax = restricaoEspecial.ativo
    ? restricaoEspecial.ltvMax
    : isHomeEquity
      ? 0.6
      : 0.8;
  // Mantém a ref sincronizada para handlers criados antes desta linha.
  ltvMaxRef.current = ltvMax;

  // Reajusta entrada/financiamento quando o LTV muda (ex.: usuário seleciona
  // Terreno/Comercial → 70%, ou volta para Residencial → 80%). Garante que o
  // financiamento nunca ultrapasse o teto do banco, adaptando a entrada.
  useEffect(() => {
    const imovel = Number(f.valor_imovel) || 0;
    if (imovel <= 0) return;
    const finMax = Math.floor(imovel * ltvMax);
    const finAtual = Number(f.valor_financiamento) || 0;
    if (finAtual <= finMax) return;
    const novaEntrada = imovel - finMax;
    setEntradaTocada(true);
    setF((prev) => ({
      ...prev,
      valor_entrada: novaEntrada,
      valor_financiamento: finMax,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ltvMax]);
  // Home Equity: prazo máximo operacional de 240 meses (regra das IFs).
  const prazoMaxOperacional = useMemo(() => {
    const restr = restricaoEspecial.ativo ? restricaoEspecial.prazoMax : 420;
    const he = isHomeEquity ? 240 : 420;
    return Math.min(restr, he);
  }, [restricaoEspecial, isHomeEquity]);
  const prazoMaximo = useMemo(() => {
    const idade = maxPrazoIdade ?? 420;
    return Math.min(idade, prazoMaxOperacional);
  }, [maxPrazoIdade, prazoMaxOperacional]);
  const financiamentoMaximo = useMemo(
    () => Math.floor((Number(f.valor_imovel) || 0) * ltvMax),
    [f.valor_imovel, ltvMax],
  );
  const despesasNoTeto = f.fg_financiar_despesas
    ? Number(f.valor_despesas_financiadas) || 0
    : 0;
  const financiamentoImovelMaximo = Math.max(0, financiamentoMaximo - despesasNoTeto);
  const entradaMinima = useMemo(
    () => Math.max(0, (Number(f.valor_imovel) || 0) - financiamentoMaximo),
    [f.valor_imovel, financiamentoMaximo],
  );
  const entradaMinimaEfetiva = Math.max(
    0,
    (Number(f.valor_imovel) || 0) - financiamentoImovelMaximo,
  );
  const financiamentoExcedido =
    (Number(f.valor_imovel) || 0) > 0 &&
    (Number(f.valor_financiamento) || 0) > financiamentoImovelMaximo;

  /** Aplica o prazo digitado, ajustando pela idade e pelo teto da operação. */
  function definirPrazo(valor: number) {
    if (!Number.isFinite(valor) || valor <= 0) {
      set("prazo", 0);
      return;
    }
    const { prazo, ajustado, mensagem } = ajustarPrazoPorIdade(valor, f.data_nascimento);
    let final = prazo;
    if (restricaoEspecial.ativo && final > restricaoEspecial.prazoMax) {
      final = restricaoEspecial.prazoMax;
      toast.warning(
        `${restricaoEspecial.motivo}: prazo máximo de ${restricaoEspecial.prazoMax} meses.`,
      );
    } else if (ajustado && mensagem) {
      toast.warning(mensagem);
    }
    set("prazo", final);
  }

  // Reajusta o prazo se a data de nascimento reduzir o máximo permitido.
  useEffect(() => {
    if (maxPrazoIdade != null && f.prazo > maxPrazoIdade) {
      const { mensagem } = ajustarPrazoPorIdade(f.prazo, f.data_nascimento);
      if (mensagem) toast.warning(mensagem);
      set("prazo", maxPrazoIdade);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxPrazoIdade]);

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
      const prazoClamp =
        restricaoEspecial.ativo && prev.prazo > restricaoEspecial.prazoMax
          ? restricaoEspecial.prazoMax
          : prev.prazo;
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
      if (mudouPrazo)
        toast.info(
          `${restricaoEspecial.motivo}: prazo ajustado para ${restricaoEspecial.prazoMax} meses.`,
        );
      return { ...prev, bancos_ids: bancosFiltrados, prazo: prazoClamp };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restricaoEspecial.ativo, restricaoEspecial.apenasBradesco, isHomeEquity, bancos]);


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
    const patch = calcularPorEntrada(valorEntrada, ltvMax);
    setF((prev) => ({ ...prev, ...patch }));
  }

  /**
   * Preenche imóvel + entrada a partir do valor a financiar (lógica inversa).
   * valorImóvel = financiamento / LTV; entrada = imóvel - financiamento.
   */
  function aplicarPorFinanciamento(valorFinanciamento: number) {
    setEntradaTocada(true);
    const patch = calcularPorFinanciamento(valorFinanciamento, ltvMax);
    setF((prev) => ({ ...prev, ...patch }));
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
      const pct = dados.valorImovel > 0
        ? Math.round((dados.valorCustas / dados.valorImovel) * 1000) / 10
        : 5;
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
        toast.error("O sistema PRICE está disponível apenas em Bradesco e Santander — nenhum deles está habilitado.");
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
        const sacBase =
          prev.bancos_sac_ids.length > 0 ? prev.bancos_sac_ids : prev.bancos_ids;
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
      toast.info("Modo Ambos: escolha os bancos SAC e PRICE separadamente e preencha a renda para PRICE.");
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


  const mostraConjuge = f.possui_conjuge || f.compoe_renda;

  const obterClienteCrmFn = useServerFn(obterClienteCRM);
  const { data: crmVinculado } = useQuery({
    queryKey: ["cliente-crm-vinculado", f.cliente_id],
    queryFn: () => obterClienteCrmFn({ data: { id: f.cliente_id as string } }),
    enabled: Boolean(f.cliente_id),
  });

  const crmTemConjuge = Boolean(
    crmVinculado &&
      (crmVinculado.conjuge_nome || crmVinculado.conjuge_cpf || crmVinculado.conjuge_renda),
  );

  const podePuxarConjugeCrm = crmTemConjuge && !String(f.nome_conjuge ?? "").trim();

  function puxarConjugeDoCRM() {
    if (!crmVinculado) return;
    setF((prev) => patchPuxarConjugeCRM(prev, crmVinculado));
    toast.success("Dados do cônjuge puxados do cadastro do CRM.");
  }

  const podeInverter = useMemo(() => {
    return (
      mostraConjuge &&
      String(f.nome_conjuge ?? "").trim().length >= 3 &&
      String(f.cpf_conjuge ?? "").trim().length > 0 &&
      String(f.data_nascimento_conjuge ?? "").trim().length > 0
    );
  }, [mostraConjuge, f.nome_conjuge, f.cpf_conjuge, f.data_nascimento_conjuge]);

  /** Inverte titular ⇄ cônjuge. */
  function inverterPrincipal() {
    setF(patchInverterPrincipal);
    setInvertido((v) => !v);
    setErros({});
    toast.success("Titular e cônjuge invertidos. Confira os dados obrigatórios.");
  }

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

  /** Verifica a renda contra o sugestivo; abre o popup de confirmação se insuficiente. */
  function rendaSuficiente(): boolean {
    const av = avaliarRendaMinima({
      valor_imovel: f.valor_imovel,
      valor_financiamento: f.valor_financiamento,
      prazo_meses: f.prazo,
      taxa_ano: melhorTaxaAno,
      sistema: f.sistema_amortizacao === "P" ? "P" : "S",
      renda_informada: rendaConsiderada,
    });
    if (av && av.suficiente === false) {
      setConfirmRenda({ rendaMinima: av.rendaMinima, rendaInformada: rendaConsiderada });
      return false;
    }
    return true;
  }

  async function enviar() {
    if (f.sistema_amortizacao === "B") {
      await enviarAmbos();
      return;
    }
    const parsed = completaSchema.safeParse({ ...f, id_operacao_homefin: idOperacao });
    if (!parsed.success) {
      const novos: Record<string, string> = {};
      for (const issue of parsed.error.issues) novos[String(issue.path[0])] = issue.message;
      setErros(novos);
      toast.error("Revise os campos destacados.");
      return;
    }
    setErros({});
    if (financiamentoExcedido) {
      toast.error(
        f.fg_financiar_despesas
          ? `Financiamento + despesas não pode passar de ${Math.round(ltvMax * 100)}% do imóvel (${formatBRL(financiamentoMaximo)}). Aumente a entrada para pelo menos ${formatBRL(entradaMinimaEfetiva)}.`
          : `O banco financia no máximo ${Math.round(ltvMax * 100)}% do imóvel (${formatBRL(financiamentoMaximo)}). Aumente a entrada para pelo menos ${formatBRL(entradaMinima)}.`,
      );
      return;
    }
    if (!rendaSuficiente()) return;
    await executarEnvio();
  }


  async function enviarAmbos() {
    await executarEnvioAmbos({
      f, idOperacao, router, setErros, setEnviando, setConcluidos,
      setSimulacaoResultadoId, setSimulacaoResultadoIdPrice,
    });
  }

  async function executarEnvio() {
    await executarEnvioSimples({
      f, idOperacao, modoProposta, router, setErros, setEnviando, setConcluidos,
      setSimulacaoResultadoId, setSimulacaoResultadoIdPrice,
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
    prazoMaximo,
    // valores calculados
    ltvMax,
    financiamentoMaximo,
    financiamentoImovelMaximo,
    entradaMinima,
    entradaMinimaEfetiva,
    financiamentoExcedido,
    maxPrazoIdade,
    melhorTaxaAno,
    rendaConsiderada,
    mostraConjuge,
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
    // resultado inline
    simulacaoResultadoId,
    simulacaoResultadoIdPrice,
    fecharResultadoInline: () => setSimulacaoResultadoId(null),
    fecharResultadoInlinePrice: () => setSimulacaoResultadoIdPrice(null),
  };
}

export type SimulacaoCompletaCtx = ReturnType<typeof useSimulacaoCompleta>;
