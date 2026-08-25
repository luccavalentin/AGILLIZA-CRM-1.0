import { useEffect, useMemo, useRef, useState, useCallback, useLayoutEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  avaliarRendaMinima,
  limitesLtv,
} from "@/lib/simulacao/renda";
import { validarCamposSimulacao } from "@/lib/simulacao/campos-obrigatorios";
import { completaSchema } from "@/lib/simulacao/schemas";
import { 
  ehCasado,
  prazoMaximoParaProponentes, 
  avaliarNovoPrazo, 
  type MotivoLimitador
} from "@/lib/simulacao/prazo";
import { obterConfiguracoesModulos } from "@/lib/admin/configuracoes-modulos.functions";
import { useEnviarProposta } from "@/hooks/use-enviar-proposta";
import { criarProposta } from "@/lib/propostas/propostas.functions";
import {
  listarBancosAtivos,
  listarOperacoes,
  obterSimulacao,
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
  aceitaBancoNaOperacao,
  mensagemBancoIncompativel,
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
import {
  executarEnvioAmbos,
  executarEnvioSimples,
  type SimulacaoComparativo,
} from "./use-simulacao-completa/envio";
import { listarTitularesAlternativos } from "./use-simulacao-completa/titulares-alternativos";

export type { Form };

export interface SimulacaoCompletaCtx extends ReturnType<typeof useSimulacaoCompleta> {}

export function useSimulacaoCompleta({ duplicar, modoProposta }: OpcoesHook) {
  const router = useRouter();
  const ctxRef = useRef<any>(null);
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
  const [simulacaoResultadoId, setSimulacaoResultadoId] = useState<string | null>(null);
  const [simulacaoResultadoIdPrice, setSimulacaoResultadoIdPrice] = useState<string | null>(null);
  const [simulacaoResultadoIdSecundario, setSimulacaoResultadoIdSecundario] = useState<string | null>(null);
  /** Simulações do teste automático de CPFs, para o comparativo de taxas. */
  const [comparativoCpfs, setComparativoCpfs] = useState<SimulacaoComparativo[]>([]);
  const [listaSimulacoes, setListaSimulacoes] = useState<any[]>([]);
  const [formInvalido, setFormInvalido] = useState(false);
  const [tentouEnviar, setTentouEnviar] = useState(false);
  const [errosObrigatorios, setErrosObrigatorios] = useState<string[]>([]);
  
  const [confirmarAjustePrazo, setConfirmarAjustePrazo] = useState<{
    campo: "prazo" | "prazo_2";
    valorDigitado: number;
    teto: number;
    motivo: string;
    titulo: string;
    descricao: string;
    acaoAutomatico: boolean;
  } | null>(null);

  const {
    enviar: enviarPropostaHook,
    statusPorBanco,
    iniciarStatus: iniciarStatusEnvio,
  } = useEnviarProposta();

  const [envioEstado, setEnvioEstado] = useState<any | null>(null);

  const abrirDialogEnvio = useCallback((sim: any) => setEnvioEstado(sim), []);
  const fecharDialogEnvio = useCallback(() => setEnvioEstado(null), []);

  const { data: bancos } = useQuery({ queryKey: ["bancos-ativos"], queryFn: () => listarBancosAtivos() });
  const { data: operacoes } = useQuery({ queryKey: ["operacoes"], queryFn: () => listarOperacoes() });
  const { data: configModulos } = useQuery({ queryKey: ["configuracoes-modulos"], queryFn: () => obterConfiguracoesModulos(), staleTime: 300000 });
  const { data: origem, isLoading: carregandoOrigem } = useQuery({
    queryKey: ["simulacao-duplicar", duplicar],
    queryFn: () => obterSimulacao({ data: { id: duplicar as string } }),
    enabled: Boolean(duplicar),
  });

  /**
   * O teto de prazo é ditado pelo proponente MAIS VELHO — titular, cônjuge ou
   * participante. Considerar só o titular exibia um teto maior do que o banco
   * aceita, e o servidor acabava reduzindo o prazo depois do envio.
   */
  const dadosProponentes = useMemo(
    () => [
      { nome: f.nome_cliente || "Titular", vinculo: "Titular", dataNascimento: f.data_nascimento },
      ...(ehCasado(f.estado_civil) && f.data_nascimento_conjuge
        ? [
            {
              nome: f.nome_conjuge || "Cônjuge",
              vinculo: "Cônjuge",
              dataNascimento: f.data_nascimento_conjuge,
            },
          ]
        : []),
      ...((f.participantes as any[]) ?? [])
        .filter((p) => p?.compoe_renda && p?.data_nascimento)
        .map((p) => ({
          nome: p.nome || "Participante",
          vinculo: p.vinculo || "Participante",
          dataNascimento: p.data_nascimento,
        })),
    ],
    [
      f.nome_cliente,
      f.data_nascimento,
      f.estado_civil,
      f.nome_conjuge,
      f.data_nascimento_conjuge,
      f.participantes,
    ],
  );
  const analisePrazo = useMemo(() => prazoMaximoParaProponentes(dadosProponentes), [dadosProponentes]);
  const maxPrazoIdade = analisePrazo?.prazo;
  const limitadorPrazo = analisePrazo?.limitador;
  const isHomeEquity = f.produto === "home_equity";
  const prazoMaxOperacional = useMemo(() => Math.min(420, isHomeEquity ? 240 : 420), [isHomeEquity]);
  const prazoMaximoEfetivo = useMemo(() => Math.min(maxPrazoIdade ?? 420, prazoMaxOperacional, 420), [maxPrazoIdade, prazoMaxOperacional]);
  const restricaoEspecial = useMemo(() => calcularRestricaoEspecial(f, (bancos ?? []).filter(b => (f.bancos_ids || []).includes(b.id))), [f, bancos]);
  const ltvMax = restricaoEspecial.ativo ? restricaoEspecial.ltvMax : 0.8;
  const motivoLimitador = useMemo((): MotivoLimitador => {
    if (maxPrazoIdade && maxPrazoIdade < prazoMaxOperacional) return "idade";
    if (restricaoEspecial.isTerreno || restricaoEspecial.isComercial) return "operacao";
    if (isHomeEquity) return "produto";
    return "limite_geral";
  }, [maxPrazoIdade, prazoMaxOperacional, restricaoEspecial, isHomeEquity]);

  const financiamentoMaximo = useMemo(() => {
    const imovel = Number(f.valor_imovel) || 0;
    const { financiamentoMaximo } = limitesLtv(imovel, ltvMax);
    return financiamentoMaximo;
  }, [f.valor_imovel, ltvMax]);

  const despesasNoTeto = f.fg_financiar_despesas ? Number(f.valor_despesas_financiadas) || 0 : 0;
  const financiamentoImovelMaximo = Math.max(0, financiamentoMaximo - despesasNoTeto);
  const financiamentoTotalExibido = (Number(f.valor_financiamento) || 0) + despesasNoTeto;

  const entradaMinima = useMemo(() => {
    const imovel = Number(f.valor_imovel) || 0;
    const { entradaMinima } = limitesLtv(imovel, ltvMax);
    return entradaMinima;
  }, [f.valor_imovel, ltvMax]);

  const entradaMinimaEfetiva = useMemo(() => Math.max(0, (Number(f.valor_imovel) || 0) - financiamentoImovelMaximo), [f.valor_imovel, financiamentoImovelMaximo]);

  const financiamentoExcedido = useMemo(() => {
    const imovel = Number(f.valor_imovel) || 0;
    if (imovel <= 0) return false;
    return Math.round((Number(f.valor_financiamento) || 0) * 100) > Math.round(financiamentoImovelMaximo * 100);
  }, [f.valor_imovel, f.valor_financiamento, financiamentoImovelMaximo]);

  const melhorTaxaAno = useMemo(() => 0.1199, []);
  const rendaConsiderada = useMemo(() => Number(f.renda_total || 0) + Number(f.renda_conjuge || 0), [f.renda_total, f.renda_conjuge]);
  /** Casado(a) ou união estável — único gatilho para existir cônjuge. */
  const casado = ehCasado(f.estado_civil);
  /**
   * O estado civil é a ÚNICA fonte de verdade para a seção de cônjuge.
   * Antes bastava um `possui_conjuge`/`compoe_renda_conjuge` residual — vindo
   * de um cadastro do CRM ou de uma simulação duplicada — para a seção
   * aparecer e cobrar o sexo do cônjuge de um titular solteiro.
   */
  const mostraConjuge = casado;
  
  /** Proponentes aptos a serem testados como titular (além do titular atual). */
  const titularesTestaveis = useMemo(() => listarTitularesAlternativos(f), [f]);

  const crmVinculado = Boolean(f.cliente_id);
  const podePuxarConjugeCrm = Boolean(f.cliente_id && casado);
  const [crmData, setCrmData] = useState<any>(null);
  const faltaDadosConjugeCrm = useMemo(() => {
    if (!podePuxarConjugeCrm || !crmData) return false;
    return faltaConjugeDoCRM(f, crmData);
  }, [podePuxarConjugeCrm, crmData, f]);
  const podeInverter = Boolean(f.nome_conjuge && f.cpf_conjuge);

  const set = (k: string, v: any) => {
    if (k === "valor_entrada") setEntradaTocada(true);
    setF((prev) => {
      const next = { ...prev, [k]: v };
      const pctEntradaDefault = 1 - 0.8;
      
      // Lógica de valores de entrada/financiamento
      if (k === "valor_imovel" && !entradaTocada) {
        next.valor_entrada = Math.round((next.valor_imovel || 0) * pctEntradaDefault);
      }
      if (k === "valor_imovel" || k === "valor_entrada") {
        next.valor_financiamento = Math.max(0, (next.valor_imovel || 0) - (next.valor_entrada || 0));
      }

      // O estado civil comanda a existência do cônjuge. Marcar casado(a) ou
      // união estável abre a seção nativa de cônjuge para preenchimento —
      // com ou sem cadastro do CRM vinculado. Sair desses estados desliga a
      // seção e limpa os dados, para não sobrar cônjuge órfão na simulação.
      if (k === "estado_civil") {
        const passaASerCasado = ehCasado(v);
        next.possui_conjuge = passaASerCasado;
        if (passaASerCasado) {
          if (!next.estado_civil_conjuge) next.estado_civil_conjuge = v;
        } else {
          next.compoe_renda = false;
          next.compoe_renda_conjuge = false;
          next.nome_conjuge = "";
          next.cpf_conjuge = "";
          next.renda_conjuge = 0;
          next.data_nascimento_conjuge = "";
          // null, não "": o schema aceita nulo, mas string vazia reprova no
          // enum de sexo e vira "Falta preencher: Sexo do cônjuge".
          next.sexo_conjuge = null;
          next.estado_civil_conjuge = "";
          next.email_conjuge = EMAIL_PADRAO;
          next.celular_conjuge = "";
        }
      }

      // REMOVIDO: A RENDA INTELIGENTE NÃO DEVE MAIS PREENCHER OS CAMPOS AUTOMATICAMENTE.
      // A RENDA MÍNIMA AGORA É APENAS INFORMATIVA (EXIBIDA ABAIXO DO CAMPO).


      return next;
    });
    setErros((prev) => {
      const n = { ...prev };
      delete n[k];
      return n;
    });
  };

  const avaliarPrazoComConfirmacao = useCallback((campo: "prazo" | "prazo_2", valor: any) => {
    const numValor = Number(valor) || 0;
    if (numValor === 0) return false;
    const res = avaliarNovoPrazo({ campo, valorDigitado: numValor, prazoPrincipal: f.prazo, prazoSegundo: f.prazo_2, prazoMaximoEfetivo, prazoMaximoIdade: maxPrazoIdade ?? null, limitadorPrazo: limitadorPrazo ?? null, motivoLimitador });
    if (res.acao === "ajustar" || res.acao === "rejeitar_segundo_duplicado") {
      setConfirmarAjustePrazo({ campo, valorDigitado: numValor, teto: res.valorFinal ?? prazoMaximoEfetivo, motivo: motivoLimitador, titulo: res.titulo, descricao: res.descricao, acaoAutomatico: res.acao === "ajustar" });
      return true;
    }
    return false;
  }, [f.prazo, f.prazo_2, prazoMaximoEfetivo, maxPrazoIdade, limitadorPrazo, motivoLimitador]);

  const definirPrazo = (campo: "prazo" | "prazo_2", valor: any) => set(campo, Number(valor) || 0);
  const handlePrazoBlur = (campo: "prazo" | "prazo_2") => avaliarPrazoComConfirmacao(campo, f[campo]);
  const aplicarAjustePrazo = () => { if (confirmarAjustePrazo) { set(confirmarAjustePrazo.campo, confirmarAjustePrazo.teto); toast.success("Prazo ajustado."); setConfirmarAjustePrazo(null); } };
  const cancelarAjustePrazo = () => setConfirmarAjustePrazo(null);
  
  const aplicarEntradaSugerida = () => setF(p => ({ ...p, ...calcularEntradaSugerida(p.valor_imovel, ltvMax) }));
  const aplicarPorFinanciamento = (v: number) => setF(p => {
    const patch = calcularPorFinanciamento(v, ltvMax, p.valor_imovel);
    return { ...p, ...patch };
  });
  const aplicarPorFinanciamentoTotal = (v: number) => aplicarPorFinanciamento(v - despesasNoTeto);
  const aplicarPorEntrada = (v: number) => setF(p => {
    const patch = calcularPorEntrada(v, ltvMax, p.valor_imovel);
    return { ...p, ...patch };
  });
  const aplicarPorParcela = (v: number) => setF(p => {
    const patch = calcularPorParcela(v, { ltvMax, melhorTaxaAno, prazo: f.prazo, sistemaAmortizacao: f.sistema_amortizacao });
    return { ...p, ...patch };
  });
  const aplicarJogadaNumeros = (patch: any) => {
    setF(p => {
      const next = { ...p, ...patch };
      
      // Sincroniza flags e valores de despesas se vierem no patch
      if (patch.financiaCustas !== undefined) {
        next.fg_financiar_despesas = patch.financiaCustas;
      }
      if (patch.valorCustas !== undefined) {
        next.valor_despesas_financiadas = patch.valorCustas;
      }
      
      // Crucial: O valor do imóvel e entrada DEVEM ser atualizados conforme o cálculo da jogada
      if (patch.valorImovel !== undefined) {
        next.valor_imovel = patch.valorImovel;
      }
      if (patch.valorEntrada !== undefined) {
        next.valor_entrada = patch.valorEntrada;
        setEntradaTocada(true);
      }
      
      // O financiamento principal (líquido)
      if (patch.valorFinanciamento !== undefined) {
        next.valor_financiamento = patch.valorFinanciamento;
      } else if (patch.valorImovel !== undefined && patch.valorEntrada !== undefined) {
        next.valor_financiamento = Math.max(0, (Number(patch.valorImovel) || 0) - (Number(patch.valorEntrada) || 0));
      }
      
      return next;
    });
  };
  const setSistemaAmortizacao = (v: string) => set("sistema_amortizacao", v);
  const alternarFinanciarDespesas = () => set("fg_financiar_despesas", !f.fg_financiar_despesas);
  const definirPctDespesas = (v: string) => {
    const val = v.replace(",", ".");
    const numVal = Number(val) || 0;
    setPctDespesas(numVal);
    // Atualiza o valor das despesas com base no percentual
    const imovel = Number(f.valor_imovel) || 0;
    const valorDespesas = Math.round(imovel * (numVal / 100) * 100) / 100;
    set("valor_despesas_financiadas", valorDespesas);
  };
  const normalizarPctDespesas = () => {
    let val = pctDespesas;
    if (val < 1) val = 1;
    if (val > 5) val = 5;
    if (val !== pctDespesas) {
      definirPctDespesas(String(val));
    }
  };
  
  const puxarConjugeDoCRM = async () => {
    if (f.cliente_id) {
      const { obterClienteCRM } = await import("@/lib/simulacao/simulacoes.functions");
      const crm = await obterClienteCRM({ data: { id: f.cliente_id } });
      if (crm) {
        setCrmData(crm);
        setF(prev => patchPuxarConjugeCRM(prev, crm));
      }
    }
  };
  const inverterPrincipal = () => {
    setF(prev => {
      const next = patchInverterPrincipal(prev);
      setInvertido(!invertido);
      return next;
    });
  };
  const selecionarClienteCRM = (cliente: any) => {
    setCrmData(cliente);
    setF(prev => {
      const { next, nomeCadastro } = patchSelecionarClienteCRM(prev, cliente);
      setCadastroNome(nomeCadastro);
      return next;
    });
  };
  const limparTitular = () => {
    setCrmData(null);
    setF(prev => patchLimparTitular(prev));
    setCadastroNome(null);
  };
  const refetchCrm = async () => {
    if (f.cliente_id) {
      const { obterClienteCRM } = await import("@/lib/simulacao/simulacoes.functions");
      const crm = await obterClienteCRM({ data: { id: f.cliente_id } });
      if (crm) {
        setCrmData(crm);
        toast.success("Dados do CRM atualizados.");
      }
    }
  };

  const idOperacao = useMemo(() => operacoes?.find((o) => o.produto_sistema === f.produto)?.id_operacao ?? null, [operacoes, f.produto]);

  useEffect(() => {
    if (carregandoOrigem) return;
    
    if (origem?.simulacao) {
      if (origem.simulacao.cliente_id && !crmData) {
        import("@/lib/simulacao/simulacoes.functions").then(m => {
          m.obterClienteCRM({ data: { id: origem.simulacao.cliente_id } }).then(c => {
            if (c) setCrmData(c);
          });
        });
      }
      const s = origem.simulacao as any;
      const bancosOrigem = (origem as any).bancos || [];
      const participantesOrigem = (origem as any).participantes || [];
      
      const bancosIds = bancosOrigem.filter((b: any) => b.selecionado).map((b: any) => b.banco_id);
      const bancosSac = bancosOrigem.filter((b: any) => b.selecionado && b.sistema_amortizacao_banco === "SAC").map((b: any) => b.banco_id);
      const bancosPrice = bancosOrigem.filter((b: any) => b.selecionado && b.sistema_amortizacao_banco === "PRICE").map((b: any) => b.banco_id);

      setF(prev => {
        // Se a simulação for mista (Ambos), pegamos a renda PRICE da irmã
        let rendaPrice = s.renda_price || 0;
        if (s.sistema_amortizacao === "B" && s._irmas) {
          const irmaPrice = s._irmas.find((i: any) => i.sistema_amortizacao === "P");
          if (irmaPrice) rendaPrice = irmaPrice.renda_total || 0;
        }

        return {
          ...prev,
          cliente_id: s.cliente_id,
          nome_cliente: s.nome_cliente || "",
          cpf_cnpj: s.cpf_cnpj || "",
          email: s.email || EMAIL_PADRAO,
          celular: s.celular || "",
          data_nascimento: s.data_nascimento || "",
          sexo: s.sexo || s.dados?.sexo || prev.sexo,
          estado_civil: s.estado_civil || "",
          renda_total: s.renda_total || 0,
          renda_price: rendaPrice,
          
          possui_conjuge: s.possui_conjuge || false,
          compoe_renda: s.compoe_renda || false,
          compoe_renda_conjuge: s.compoe_renda_conjuge || false,
          nome_conjuge: s.nome_conjuge || "",
          cpf_conjuge: s.cpf_conjuge || "",
          renda_conjuge: s.renda_conjuge || 0,
          data_nascimento_conjuge: s.data_nascimento_conjuge || "",
          email_conjuge: s.email_conjuge || EMAIL_PADRAO,
          celular_conjuge: s.celular_conjuge || "",
          sexo_conjuge: s.sexo_conjuge || s.dados?.sexo_conjuge || prev.sexo_conjuge,
          estado_civil_conjuge: s.estado_civil_conjuge || "",
          regime_casamento: s.regime_casamento || "",

          produto: s.produto || prev.produto,
          id_operacao_homefin: s.id_operacao_homefin || prev.id_operacao_homefin,
          tipo_imovel: s.tipo_imovel || "",
          uso_imovel: s.uso_imovel || "",
          situacao_imovel: s.situacao_imovel || "",
          uf: s.uf || "",
          cep_imovel: s.cep_imovel || "",
          valor_imovel: s.valor_imovel || 0,
          valor_entrada: s.valor_entrada || 0,
          valor_financiamento: s.valor_financiamento || 0,
          prazo: s.prazo || 360,
          prazo_2: s.prazo_2 || null,
          sistema_amortizacao: s.sistema_amortizacao === "B" ? "B" : (s.sistema_amortizacao || "S"),
          utiliza_fgts: s.utiliza_fgts || "N",
          fg_financiar_despesas: s.fg_financiar_despesas || false,
          valor_despesas_financiadas: s.valor_despesas_financiadas || 0,
          
          bancos_ids: bancosIds,
          bancos_sac_ids: bancosSac,
          bancos_price_ids: bancosPrice,
          participantes: participantesOrigem,
          possui_participantes: participantesOrigem.length > 0,
        };
      });

      if (s.nome_cliente) setCadastroNome(s.nome_cliente);
    }
  }, [origem, carregandoOrigem]);

  useEffect(() => {
    const faltantes = validarCamposSimulacao({ ...f, id_operacao_homefin: idOperacao });
    setFormInvalido(faltantes.length > 0);
    setErrosObrigatorios(faltantes.map((x: any) => x.campo));
  }, [f, idOperacao]);

  useLayoutEffect(() => {
    ctxRef.current = {
      f, idOperacao, prazoMaximo: prazoMaximoEfetivo, motivoLimitador, modoProposta, router,
      setErros, setEnviando, setConcluidos, setListaSimulacoes, setSimulacaoResultadoId,
      setSimulacaoResultadoIdPrice, setSimulacaoResultadoIdSecundario, setComparativoCpfs, bancos, set,
      confirmarAjustePrazo, setConfirmarAjustePrazo, avaliarPrazoComConfirmacao, aplicarAjustePrazo,
      cancelarAjustePrazo, definirPrazo, handlePrazoBlur, ltvMax, financiamentoMaximo, entradaMinima,
      entradaMinimaEfetiva, financiamentoExcedido, maxPrazoIdade, restricaoEspecial, prazoMinOperacional: 0,
      mensagemPrazoInviavel: "", aplicarEntradaSugerida, aplicarPorFinanciamento, aplicarPorFinanciamentoTotal,
      financiamentoTotalExibido, aplicarPorEntrada, aplicarPorParcela, aplicarJogadaNumeros, setSistemaAmortizacao,
      alternarFinanciarDespesas, definirPctDespesas, normalizarPctDespesas, pctDespesas, isHomeEquity,
      cadastroNome, invertido, crmVinculado, podePuxarConjugeCrm, podeInverter, melhorTaxaAno,
      rendaConsiderada, mostraConjuge, puxarConjugeDoCRM, inverterPrincipal, selecionarClienteCRM,
      limparTitular, refetchCrm, simulacaoResultadoId, simulacaoResultadoIdPrice, simulacaoResultadoIdSecundario,
      fecharResultadoInline: () => setSimulacaoResultadoId(null), 
      fecharResultadoInlinePrice: () => setSimulacaoResultadoIdPrice(null),
      fecharResultadoInlineSecundario: () => setSimulacaoResultadoIdSecundario(null),
      envioEstado, statusPorBanco, abrirDialogEnvio, fecharDialogEnvio,
      enviarBancoIndividual: () => {}, enviarTodosBancos: () => {}, 
      enviarOriginal: async () => {
        setTentouEnviar(true);
        if (validarCamposSimulacao({ ...f, id_operacao_homefin: idOperacao }).length > 0) {
          const faltantes = validarCamposSimulacao({ ...f, id_operacao_homefin: idOperacao });
          toast.error("Corrija os campos obrigatórios antes de prosseguir:", {
            description: faltantes.map(x => x.campo).join(", ")
          });
          return;
        }
        if (ctxRef.current) {
          if (f.sistema_amortizacao === "B") {
            await executarEnvioAmbos(ctxRef.current);
          } else {
            await executarEnvioSimples(ctxRef.current);
          }
        }
      }, 
      formInvalido: validarCamposSimulacao({ ...f, id_operacao_homefin: idOperacao }).length > 0, 
      tentouEnviar
    };
  });

  return {
    f, set, erros, prazoMaximoEfetivo, motivoLimitador, limitadorPrazo, 
    definirPrazo, handlePrazoBlur, confirmarAjustePrazo, aplicarAjustePrazo, cancelarAjustePrazo,
    ltvMax, financiamentoMaximo, entradaMinima, entradaMinimaEfetiva, financiamentoExcedido,
    maxPrazoIdade, restricaoEspecial, prazoMinOperacional: 0, mensagemPrazoInviavel: "",
    aplicarEntradaSugerida, aplicarPorFinanciamento, aplicarPorFinanciamentoTotal,
    financiamentoTotalExibido, aplicarPorEntrada, aplicarPorParcela, aplicarJogadaNumeros,
    setSistemaAmortizacao, alternarFinanciarDespesas, definirPctDespesas, normalizarPctDespesas,
    pctDespesas, isHomeEquity, cadastroNome, invertido, crmVinculado, podePuxarConjugeCrm, faltaDadosConjugeCrm,
    podeInverter, melhorTaxaAno, rendaConsiderada, mostraConjuge, puxarConjugeDoCRM,
    inverterPrincipal, selecionarClienteCRM, limparTitular, refetchCrm,
    simulacaoResultadoId, simulacaoResultadoIdPrice, simulacaoResultadoIdSecundario,
    comparativoCpfs, limparComparativoCpfs: () => setComparativoCpfs([]),
    titularesTestaveis,
    fecharResultadoInline: () => setSimulacaoResultadoId(null), 
    fecharResultadoInlinePrice: () => setSimulacaoResultadoIdPrice(null),
    fecharResultadoInlineSecundario: () => setSimulacaoResultadoIdSecundario(null),
    envioEstado, statusPorBanco, abrirDialogEnvio, fecharDialogEnvio,
    enviarBancoIndividual: () => {}, enviarTodosBancos: () => {}, 
    enviarOriginal: async () => {
      setTentouEnviar(true);
      const faltantes = validarCamposSimulacao({ ...f, id_operacao_homefin: idOperacao });
      if (faltantes.length > 0) {
        toast.error("Corrija os campos obrigatórios antes de prosseguir:", {
          description: faltantes.map(x => x.campo).join(", ")
        });
        return;
      }
      if (ctxRef.current) {
        if (f.sistema_amortizacao === "B") {
          await executarEnvioAmbos(ctxRef.current);
        } else {
          await executarEnvioSimples(ctxRef.current);
        }
      }
    }, 
    formInvalido, tentouEnviar, bancos, aceitaBancoNaOperacao, 
    aceitaPrice,
    router, modoProposta, enviando, concluidos, listaSimulacoes,
    confirmRenda, setConfirmRenda, avaliarPrazoComConfirmacao,
    carregandoOrigem,
    enviar: async () => {
      setTentouEnviar(true);
      const faltantes = validarCamposSimulacao({ ...f, id_operacao_homefin: idOperacao });
      if (faltantes.length > 0) {
        toast.error("Corrija os campos obrigatórios antes de prosseguir:", {
          description: faltantes.map(x => x.campo).join(", ")
        });
        return;
      }
      if (ctxRef.current) {
        if (f.sistema_amortizacao === "B") {
          await executarEnvioAmbos(ctxRef.current);
        } else {
          await executarEnvioSimples(ctxRef.current);
        }
      }
    }, 
    executarEnvio: async () => {
      if (ctxRef.current) {
        if (f.sistema_amortizacao === "B") {
          await executarEnvioAmbos(ctxRef.current);
        } else {
          await executarEnvioSimples(ctxRef.current);
        }
      }
    }, 

    toggleBanco: (id: string, sistema?: "S" | "P") => {
      const field = sistema === "S" ? "bancos_sac_ids" : sistema === "P" ? "bancos_price_ids" : "bancos_ids";
      setF(prev => {
        const ids = [...(prev[field] || [])];
        const i = ids.indexOf(id);
        if (i >= 0) ids.splice(i, 1); else ids.push(id);
        return { ...prev, [field]: ids };
      });
    }
  };
}