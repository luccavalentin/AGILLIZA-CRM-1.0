import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { estadoCivilCrmParaCodigo } from "@/lib/propostas/dominios";
import { avaliarRendaMinima, TAXA_MIP_MES, TAXA_DFI_MES, TAXA_ADMIN_MES } from "@/lib/simulacao/renda";
import { taxaAnoDeBanco } from "@/lib/simulacao/simulacao-rapida";
import { completaSchema } from "@/lib/simulacao/schemas";
import { maskCpfCnpj, maskCelular, formatBRL } from "@/lib/simulacao/format";
import { ajustarPrazoPorIdade, prazoMaximoPorIdade } from "@/lib/simulacao/prazo";
import {
  listarBancosAtivos,
  listarOperacoes,
  criarSimulacao,
  enviarSimulacaoBanco,
  obterSimulacao,
  obterClienteCRM,
} from "@/lib/simulacao/simulacoes.functions";
import { criarProposta } from "@/lib/propostas/propostas.functions";

export type Form = Record<string, any>;

interface Banco {
  id: string;
  nome_banco?: string | null;
  codigo_banco?: number | string | null;
  flag_padrao?: boolean | null;
}

const ESTADO_INICIAL: Form = {
  produto: "financiamento_imobiliario",
  tipo_imovel: "",
  uso_imovel: "",
  situacao_imovel: "",
  uf: "",
  valor_imovel: 0,
  valor_entrada: 0,
  valor_financiamento: 0,
  simular_por_parcela: false,
  parcela_alvo: 0,

  prazo: 360,
  utiliza_fgts: "N",
  fg_financiar_despesas: false,
  valor_despesas_financiadas: 0,
  sistema_amortizacao: "S",
  nome_cliente: "",
  cpf_cnpj: "",
  renda_total: 0,
  renda_price: 0,
  data_nascimento: "",
  estado_civil: "",
  email: "",
  celular: "",
  possui_conjuge: false,
  compoe_renda: false,
  bancos_ids: [] as string[],
  bancos_sac_ids: [] as string[],
  bancos_price_ids: [] as string[],
  consentimento_lgpd: false,
  consentimento_scr: false,
  email_verificado_em: null,
};

/** Bancos que operam pelo sistema PRICE (Tabela Price). Hoje: Bradesco (237) e Santander (33). */
function aceitaPrice(b: { codigo_banco?: number | string | null; nome_banco?: string | null }) {
  const cod = String(b.codigo_banco ?? "").replace(/^0+/, "");
  const nome = (b.nome_banco ?? "").toLowerCase();
  return cod === "237" || cod === "33" || nome.includes("bradesco") || nome.includes("santander");
}

interface OpcoesHook {
  duplicar?: string;
  modoProposta: boolean;
}

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
      email: s.email ?? "",
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

  // Restrição especial: Terreno (TE/TC) ou Imóvel comercial (uso "C")
  // -> LTV 70%, prazo máx 240 meses, apenas Bradesco opera.
  const restricaoEspecial = useMemo(() => {
    const isTerreno = f.tipo_imovel === "TE" || f.tipo_imovel === "TC";
    const isComercial = f.uso_imovel === "C";
    const ativo = isTerreno || isComercial;
    const motivo = !ativo
      ? ""
      : isTerreno && isComercial
        ? "Terreno / Imóvel comercial"
        : isTerreno
          ? "Terreno"
          : "Imóvel comercial";
    return { ativo, motivo, ltvMax: 0.7, prazoMax: 240 };
  }, [f.tipo_imovel, f.uso_imovel]);

  function aceitaBancoNaOperacao(b: { codigo_banco?: number | string | null; nome_banco?: string | null }) {
    if (!restricaoEspecial.ativo) return true;
    const cod = String(b.codigo_banco ?? "").replace(/^0+/, "");
    const nome = (b.nome_banco ?? "").toLowerCase();
    return cod === "237" || nome.includes("bradesco");
  }

  // Teto de financiamento (LTV) por produto e restrição especial.
  const ltvMax = restricaoEspecial.ativo
    ? restricaoEspecial.ltvMax
    : f.produto === "home_equity"
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
  const prazoMaximo = useMemo(() => {
    const idade = maxPrazoIdade ?? 420;
    return restricaoEspecial.ativo ? Math.min(idade, restricaoEspecial.prazoMax) : idade;
  }, [maxPrazoIdade, restricaoEspecial]);
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

  // Aplica a restrição de Terreno / Imóvel comercial: prazo <=240m e apenas
  // Bradesco elegível. Filtra bancos selecionados e clampa o prazo.
  useEffect(() => {
    if (!restricaoEspecial.ativo) return;
    setF((prev) => {
      const bancosFiltrados = prev.bancos_ids.filter((id: string) => {
        const b = (bancos ?? []).find((x) => x.id === id);
        return b ? aceitaBancoNaOperacao(b) : false;
      });
      const prazoClamp =
        prev.prazo > restricaoEspecial.prazoMax ? restricaoEspecial.prazoMax : prev.prazo;
      const mudouBancos = bancosFiltrados.length !== prev.bancos_ids.length;
      const mudouPrazo = prazoClamp !== prev.prazo;
      if (!mudouBancos && !mudouPrazo) return prev;
      if (mudouBancos)
        toast.info(
          `${restricaoEspecial.motivo}: apenas Bradesco opera. Outros bancos foram removidos.`,
        );
      if (mudouPrazo)
        toast.info(
          `${restricaoEspecial.motivo}: prazo ajustado para ${restricaoEspecial.prazoMax} meses.`,
        );
      return { ...prev, bancos_ids: bancosFiltrados, prazo: prazoClamp };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restricaoEspecial.ativo, bancos]);


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
    const pctEntrada = 1 - ltvMax;
    setF((prev) => {
      const entrada = Math.round((prev.valor_imovel || 0) * pctEntrada);
      return {
        ...prev,
        valor_entrada: entrada,
        valor_financiamento: Math.max(0, prev.valor_imovel - entrada),
      };
    });
  }

  /**
   * Preenche imóvel + financiamento a partir do valor de entrada.
   * Regra: entrada = (1 - LTV) do imóvel  ⇒  imóvel = entrada / (1 - LTV).
   * financiamento = imóvel − entrada.
   */
  function aplicarPorEntrada(valorEntrada: number) {
    const entrada = Math.max(0, Number(valorEntrada) || 0);
    setEntradaTocada(true);
    if (entrada <= 0) {
      setF((prev) => ({ ...prev, valor_entrada: 0 }));
      return;
    }
    const pctEntrada = 1 - ltvMax;
    const imovel = Math.round(entrada / pctEntrada);
    const fin = Math.max(0, imovel - entrada);
    setF((prev) => ({
      ...prev,
      valor_imovel: imovel,
      valor_entrada: entrada,
      valor_financiamento: fin,
    }));
  }

  /**
   * Preenche imóvel + entrada a partir do valor a financiar (lógica inversa).
   * valorImóvel = financiamento / LTV; entrada = imóvel - financiamento.
   */
  function aplicarPorFinanciamento(valorFinanciamento: number) {
    const fin = Math.max(0, Number(valorFinanciamento) || 0);
    if (fin <= 0) {
      setEntradaTocada(true);
      setF((prev) => ({ ...prev, valor_financiamento: 0 }));
      return;
    }
    // Arredonda o imóvel para o milhar mais próximo (para cima) e garante que
    // financiamento derivado respeite o LTV.
    const imovel = Math.ceil(fin / ltvMax / 1000) * 1000;
    const entrada = Math.max(0, imovel - fin);
    setEntradaTocada(true);
    setF((prev) => ({
      ...prev,
      valor_imovel: imovel,
      valor_entrada: entrada,
      valor_financiamento: fin,
    }));
  }

  /**
   * Lógica inversa por parcela: dado o valor de parcela alvo, encontra o PV
   * (valor financiado) máximo, e daí deriva imóvel = PV / LTV e entrada.
   *
   * Fórmula: PMT_alvo = fator_amortização · PV + encargos(PV)
   *   PRICE  fator = i(1+i)^n / ((1+i)^n - 1)
   *   SAC    fator = 1/n + i   (primeira e maior parcela)
   *   encargos ≈ (MIP_mes + DFI_mes/LTV)·PV + Taxa_admin  (linear em PV)
   * ⇒ PV = (PMT_alvo - Taxa_admin) / (fator + k)
   * Usa a MAIOR taxa entre os bancos selecionados (conservador: menor PV).
   */
  function aplicarPorParcela(parcelaAlvo: number) {
    const pmt = Math.max(0, Number(parcelaAlvo) || 0);
    // Sempre persistir o valor digitado — nunca bloquear a digitação.
    if (pmt <= 0) {
      setEntradaTocada(true);
      setF((prev) => ({
        ...prev,
        parcela_alvo: 0,
        valor_financiamento: 0,
        valor_imovel: 0,
        valor_entrada: 0,
      }));
      return;
    }
    const taxaAno = melhorTaxaAno || 0.1199;
    const i = Math.pow(1 + taxaAno, 1 / 12) - 1;
    const n = Math.max(1, Math.round(Number(f.prazo) || 360));
    const fator =
      f.sistema_amortizacao === "P"
        ? (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1)
        : 1 / n + i;
    const k = TAXA_MIP_MES + TAXA_DFI_MES / ltvMax;
    const pmtLiq = pmt - TAXA_ADMIN_MES;
    const pv = pmtLiq > 0 ? pmtLiq / (fator + k) : 0;
    // Se a parcela ainda é insuficiente (usuário digitando), só guardamos o valor sem toast.
    if (pv <= 0) {
      setF((prev) => ({ ...prev, parcela_alvo: pmt }));
      return;
    }
    // Arredonda o imóvel para o milhar mais próximo (para baixo) para evitar
    // centavos e garantir que o financiamento derivado (floor(imovel*LTV))
    // nunca ultrapasse o teto do banco.
    const pvBruto = pv;
    const imovel = Math.max(1000, Math.floor(pvBruto / ltvMax / 1000) * 1000);
    const financiamento = Math.floor(imovel * ltvMax);
    const entrada = imovel - financiamento;
    setEntradaTocada(true);
    setF((prev) => ({
      ...prev,
      parcela_alvo: pmt,
      valor_financiamento: financiamento,
      valor_imovel: imovel,
      valor_entrada: entrada,
    }));
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
          toast.info(`${restricaoEspecial.motivo}: apenas Bradesco opera essa modalidade.`);
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
        toast.info(
          `${restricaoEspecial.motivo}: apenas Bradesco opera essa modalidade.`,
        );
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
    setF((prev) => {
      // Se o titular está com estado civil de casal, mantém; senão assume casado.
      const ecTitular =
        prev.estado_civil === "CA" || prev.estado_civil === "UE" ? prev.estado_civil : "CA";
      return {
        ...prev,
        possui_conjuge: true,
        compoe_renda: prev.compoe_renda || Number(crmVinculado.conjuge_renda) > 0,
        estado_civil: ecTitular,
        estado_civil_conjuge: ecTitular,
        nome_conjuge: crmVinculado.conjuge_nome ?? "",
        cpf_conjuge: crmVinculado.conjuge_cpf ? maskCpfCnpj(crmVinculado.conjuge_cpf) : "",
        renda_conjuge: crmVinculado.conjuge_renda ?? 0,
        data_nascimento_conjuge: crmVinculado.conjuge_data_nascimento ?? "",
        email_conjuge: crmVinculado.conjuge_email ?? "",
        celular_conjuge: crmVinculado.conjuge_celular
          ? maskCelular(crmVinculado.conjuge_celular)
          : "",
      };
    });
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
    setF((prev) => ({
      ...prev,
      nome_cliente: prev.nome_conjuge ?? "",
      cpf_cnpj: prev.cpf_conjuge ?? "",
      renda_total: Number(prev.renda_conjuge) || 0,
      data_nascimento: prev.data_nascimento_conjuge ?? "",
      estado_civil: prev.estado_civil_conjuge || prev.estado_civil,
      email: prev.email_conjuge ?? "",
      celular: prev.celular_conjuge ?? "",
      nome_conjuge: prev.nome_cliente ?? "",
      cpf_conjuge: prev.cpf_cnpj ?? "",
      renda_conjuge: Number(prev.renda_total) || 0,
      data_nascimento_conjuge: prev.data_nascimento ?? "",
      estado_civil_conjuge: prev.estado_civil || prev.estado_civil_conjuge,
      email_conjuge: prev.email ?? "",
      celular_conjuge: prev.celular ?? "",
    }));
    setInvertido((v) => !v);
    setErros({});
    toast.success("Titular e cônjuge invertidos. Confira os dados obrigatórios.");
  }

  /** Seleciona o titular a partir de um cliente do CRM. */
  function selecionarClienteCRM(c: any) {
    const ecOriginal = estadoCivilCrmParaCodigo(c.estado_civil);
    const conjugePreenchido = Boolean(c.conjuge_nome || c.conjuge_cpf || c.conjuge_renda);
    // Se há cônjuge cadastrado, o titular é considerado casado (mantém CA/UE se já for de casal).
    const ec =
      ecOriginal === "CA" || ecOriginal === "UE"
        ? ecOriginal
        : conjugePreenchido
          ? "CA"
          : ecOriginal;
    const temConjuge = ec === "CA" || ec === "UE";
    setF((prev) => ({
      ...prev,
      cliente_id: c.id,
      nome_cliente: c.nome ?? "",
      cpf_cnpj: c.documento ? maskCpfCnpj(c.documento) : "",
      email: c.email ?? "",
      celular: c.telefone_celular ? maskCelular(c.telefone_celular) : "",
      data_nascimento: c.data_nascimento ?? "",
      estado_civil: ec || prev.estado_civil,
      renda_total: c.renda_total_declarada ?? prev.renda_total,
      possui_conjuge: temConjuge,
      compoe_renda: prev.compoe_renda || (temConjuge && Number(c.conjuge_renda) > 0),
      nome_conjuge: c.conjuge_nome ?? "",
      cpf_conjuge: c.conjuge_cpf ? maskCpfCnpj(c.conjuge_cpf) : "",
      renda_conjuge: c.conjuge_renda ?? 0,
      data_nascimento_conjuge: c.conjuge_data_nascimento ?? "",
      email_conjuge: c.conjuge_email ?? "",
      celular_conjuge: c.conjuge_celular ? maskCelular(c.conjuge_celular) : "",
      // O cônjuge herda o mesmo estado civil de casal do titular.
      estado_civil_conjuge: temConjuge ? ec : (prev.estado_civil_conjuge ?? ""),
    }));
    setCadastroNome(c.nome ?? "");
    setInvertido(false);
    toast.success(
      conjugePreenchido
        ? "Dados do cliente e do cônjuge preenchidos."
        : "Dados do cliente preenchidos.",
    );
  }

  /** Remove o vínculo do titular com o cadastro do CRM. */
  function limparTitular() {
    setF((prev) => ({
      ...prev,
      cliente_id: null,
      nome_cliente: "",
      cpf_cnpj: "",
      email: "",
      celular: "",
      data_nascimento: "",
      estado_civil: "",
      renda_total: 0,
      possui_conjuge: false,
      compoe_renda: false,
      nome_conjuge: "",
      cpf_conjuge: "",
      renda_conjuge: 0,
      data_nascimento_conjuge: "",
      email_conjuge: "",
      celular_conjuge: "",
    }));
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

  /**
   * Envio no modo "Ambos": cria uma simulação SAC (com renda_total) e uma
   * simulação PRICE (com renda_price). Cada simulação usa somente os bancos
   * selecionados no seu grupo. Se a renda PRICE não foi preenchida, o envio
   * é bloqueado e o usuário é levado ao campo para completar.
   */
  async function enviarAmbos() {
    const novosErros: Record<string, string> = {};
    if (!(Number(f.renda_price) > 0)) {
      novosErros.renda_price = "Informe a renda para o sistema PRICE.";
    }
    const totalBancos = f.bancos_sac_ids.length + f.bancos_price_ids.length;
    if (totalBancos === 0) {
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
    setEnviando(true);
    const idsGerados: string[] = [];
    let done = 0;
    // No modo "Ambos", geramos um único agrupador para colapsar as duas
    // simulações (SAC + PRICE) em um único item na listagem.
    const agrupador_id =
      f.sistema_amortizacao === "B" && f.bancos_sac_ids.length > 0 && f.bancos_price_ids.length > 0
        ? (crypto.randomUUID?.() ??
          `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`)
        : null;
    try {
      // Simulação SAC
      if (f.bancos_sac_ids.length > 0) {
        const parsedS = completaSchema.safeParse({
          ...f,
          sistema_amortizacao: "S",
          bancos_ids: f.bancos_sac_ids,
          id_operacao_homefin: idOperacao,
        });
        if (!parsedS.success) {
          const novos: Record<string, string> = {};
          for (const issue of parsedS.error.issues) novos[String(issue.path[0])] = issue.message;
          setErros(novos);
          toast.error("Revise os campos destacados.");
          setEnviando(false);
          setConcluidos(0);
          return;
        }
        const { id } = await criarSimulacao({
          data: {
            modo: "completa",
            dados: {
              ...parsedS.data,
              id_operacao_homefin: idOperacao,
              email_verificado_em: f.email_verificado_em,
              agrupador_id,
            } as any,
          },
        });
        idsGerados.push(id);
        for (const bid of f.bancos_sac_ids) {
          try {
            await enviarSimulacaoBanco({ data: { simulacao_id: id, banco_ids: [bid] } });
          } catch (e) {
            toast.error(
              e instanceof Error
                ? e.message
                : "Falha ao enviar a um banco (SAC). Você pode reenviar na tela da simulação.",
            );
          }
          done++;
          setConcluidos(done);
        }
      }

      // Simulação PRICE (usa a renda específica para PRICE como renda_total)
      if (f.bancos_price_ids.length > 0) {
        const parsedP = completaSchema.safeParse({
          ...f,
          sistema_amortizacao: "P",
          bancos_ids: f.bancos_price_ids,
          renda_total: Number(f.renda_price),
          id_operacao_homefin: idOperacao,
        });
        if (!parsedP.success) {
          const novos: Record<string, string> = {};
          for (const issue of parsedP.error.issues) novos[String(issue.path[0])] = issue.message;
          setErros(novos);
          toast.error("Revise os campos destacados.");
          setEnviando(false);
          setConcluidos(0);
          return;
        }
        const { id } = await criarSimulacao({
          data: {
            modo: "completa",
            dados: {
              ...parsedP.data,
              id_operacao_homefin: idOperacao,
              email_verificado_em: f.email_verificado_em,
              agrupador_id,
            } as any,
          },
        });
        idsGerados.push(id);
        for (const bid of f.bancos_price_ids) {
          try {
            await enviarSimulacaoBanco({ data: { simulacao_id: id, banco_ids: [bid] } });
          } catch (e) {
            toast.error(
              e instanceof Error
                ? e.message
                : "Falha ao enviar a um banco (PRICE). Você pode reenviar na tela da simulação.",
            );
          }
          done++;
          setConcluidos(done);
        }
      }

      sessionStorage.removeItem("simulacao_wizard");
      setSimulacaoResultadoId(idsGerados[0] ?? null);
      setSimulacaoResultadoIdPrice(idsGerados[1] ?? null);
      setEnviando(false);
      setConcluidos(0);
      toast.success("Simulações SAC e PRICE geradas. Confira os resultados abaixo.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível criar as simulações.",
      );
      setEnviando(false);
      setConcluidos(0);
    }
  }

  async function executarEnvio() {
    const parsed = completaSchema.safeParse({ ...f, id_operacao_homefin: idOperacao });
    if (!parsed.success) {
      toast.error("Revise os campos destacados.");
      return;
    }
    setErros({});
    setConcluidos(0);
    setEnviando(true);
    try {
      const { id } = await criarSimulacao({
        data: {
          modo: "completa",
          dados: {
            ...parsed.data,
            id_operacao_homefin: idOperacao,
            email_verificado_em: f.email_verificado_em,
          } as any,
        },
      });
      sessionStorage.removeItem("simulacao_wizard");
      const idsBancos = f.bancos_ids.length > 0 ? f.bancos_ids : [];
      if (idsBancos.length === 0) {
        try {
          await enviarSimulacaoBanco({ data: { simulacao_id: id } });
        } catch (e) {
          toast.error(
            e instanceof Error
              ? e.message
              : "Falha ao enviar ao banco. Você pode reenviar na tela da simulação.",
          );
        }
        setConcluidos(1);
      } else {
        for (let i = 0; i < idsBancos.length; i++) {
          try {
            await enviarSimulacaoBanco({
              data: { simulacao_id: id, banco_ids: [idsBancos[i]] },
            });
          } catch (e) {
            toast.error(
              e instanceof Error
                ? e.message
                : "Falha ao enviar a um dos bancos. Você pode reenviar na tela da simulação.",
            );
          }
          setConcluidos(i + 1);
        }
      }

      // Fluxo "Nova Proposta": após simular, cria a proposta a partir da
      // simulação e direciona ao cadastro antes do envio ao banco. O envio só
      // acontece depois do cadastro salvo, para evitar proposta sem participante
      // completo e para não cair na aba de documentos.
      if (modoProposta) {
        try {
          const dadosSim: any = await obterSimulacao({ data: { id } });
          const bancosSim: any[] = dadosSim.bancos ?? [];
          const simulados = bancosSim.filter((b) => b.status_banco === "simulada");
          if (simulados.length === 0) {
            toast.error(
              "Nenhum banco aceitou a proposta. Revise os dados e envie novamente.",
            );
            setEnviando(false);
            setConcluidos(0);
            return;
          }
          // Respeita a escolha do usuário: usa o banco selecionado na tela,
          // NÃO o de menor parcela. Só cai no fallback se o escolhido não
          // tiver simulado com sucesso.
          const escolhidoUsuarioId = idsBancos[0] ?? null;
          const escolhido =
            simulados.find((b: any) => b.banco_id === escolhidoUsuarioId) ??
            simulados[0];
          const bancoId = escolhido.banco_id as string;
          const { proposta_id } = await criarProposta({
            data: { simulacao_id: id, banco_id: bancoId },
          });
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
          toast.error(
            e instanceof Error ? e.message : "Não foi possível criar a proposta.",
          );
          setEnviando(false);
          setConcluidos(0);
          return;
        }
      }

      // Download automático do extrato removido a pedido do usuário.
      // O PDF continua disponível sob demanda na ficha da simulação.

      // Mantém o usuário na tela do simulador e exibe o resultado inline,
      // para permitir comparar rapidamente com outro prazo sem precisar
      // navegar entre telas.
      setSimulacaoResultadoId(id);
      setEnviando(false);
      setConcluidos(0);
      toast.success("Simulação realizada. Os extratos por banco serão baixados automaticamente assim que os retornos chegarem.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : null;
      toast.error(
        msg ?? (modoProposta ? "Não foi possível criar a proposta." : "Não foi possível criar a simulação."),
      );
      setEnviando(false);
      setConcluidos(0);
    }
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
