import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ajustarPrazoPorIdade, prazoMaximoPorIdade } from "@/lib/simulacao/prazo";

export const PRAZO_MIN = 60;
export const PRAZO_MAX = 420;
const PCT_ENTRADA_PADRAO = 0.2;

export interface WizardState {
  produto: "financiamento_imobiliario" | "home_equity";
  valor_imovel: number;
  valor_entrada: number;
  valor_financiamento: number;
  data_nascimento: string;
  prazo_meses: number;
  renda_familiar: number;
}

type CampoValor = "valor_imovel" | "valor_entrada" | "valor_financiamento";

function recomputarTerceiro(
  valores: { valor_imovel: number; valor_entrada: number; valor_financiamento: number },
  editado: CampoValor,
  outroAncora: CampoValor | undefined,
) {
  const { valor_imovel, valor_entrada, valor_financiamento } = valores;

  if (!outroAncora) {
    if (editado === "valor_imovel") {
      return {
        valor_imovel,
        valor_entrada: Math.round(valor_imovel * PCT_ENTRADA_PADRAO),
        valor_financiamento: Math.round(valor_imovel * (1 - PCT_ENTRADA_PADRAO)),
      };
    }
    if (editado === "valor_entrada") {
      const imovel = Math.round(valor_entrada / PCT_ENTRADA_PADRAO);
      return { valor_imovel: imovel, valor_entrada, valor_financiamento: Math.max(0, imovel - valor_entrada) };
    }
    const imovel = Math.round(valor_financiamento / (1 - PCT_ENTRADA_PADRAO));
    return { valor_imovel: imovel, valor_entrada: Math.max(0, imovel - valor_financiamento), valor_financiamento };
  }

  const alvo = (["valor_imovel", "valor_entrada", "valor_financiamento"] as CampoValor[]).find(
    (c) => c !== editado && c !== outroAncora,
  )!;
  if (alvo === "valor_financiamento") {
    return { valor_imovel, valor_entrada, valor_financiamento: Math.max(0, valor_imovel - valor_entrada) };
  }
  if (alvo === "valor_entrada") {
    return { valor_imovel, valor_entrada: Math.max(0, valor_imovel - valor_financiamento), valor_financiamento };
  }
  return { valor_imovel: Math.max(0, valor_entrada + valor_financiamento), valor_entrada, valor_financiamento };
}

export function useWizardSimulacao() {
  const [w, setW] = useState<WizardState>({
    produto: "financiamento_imobiliario",
    valor_imovel: 0,
    valor_entrada: 0,
    valor_financiamento: 0,
    data_nascimento: "",
    prazo_meses: 360,
    renda_familiar: 0,
  });
  const [ultimosEditados, setUltimosEditados] = useState<CampoValor[]>([]);
  const entradaTocada = ultimosEditados.includes("valor_entrada");

  const entradaSugerida = Math.round((w.valor_imovel || 0) * PCT_ENTRADA_PADRAO);

  function set<K extends keyof WizardState>(k: K, v: WizardState[K]) {
    setW((prev) => {
      const next = { ...prev, [k]: v };
      if (k === "valor_imovel" || k === "valor_entrada" || k === "valor_financiamento") {
        const campo = k as CampoValor;
        const outroAncora = ultimosEditados.filter((c) => c !== campo && (next[c] as number) > 0)[0];
        const recalc = recomputarTerceiro(
          {
            valor_imovel: next.valor_imovel,
            valor_entrada: next.valor_entrada,
            valor_financiamento: next.valor_financiamento,
          },
          campo,
          outroAncora,
        );
        next.valor_imovel = recalc.valor_imovel;
        next.valor_entrada = recalc.valor_entrada;
        next.valor_financiamento = recalc.valor_financiamento;
        setUltimosEditados((old) => {
          const semAtual = old.filter((c) => c !== campo);
          if ((v as number) > 0) return [campo, ...semAtual].slice(0, 2);
          return semAtual;
        });
      }
      return next;
    });
  }

  function aplicarEntradaSugerida() {
    setW((prev) => {
      const entrada = Math.round((prev.valor_imovel || 0) * PCT_ENTRADA_PADRAO);
      return {
        ...prev,
        valor_entrada: entrada,
        valor_financiamento: Math.max(0, prev.valor_imovel - entrada),
      };
    });
    setUltimosEditados(["valor_entrada", "valor_imovel"]);
  }

  const maxPrazoIdade = useMemo(() => prazoMaximoPorIdade(w.data_nascimento), [w.data_nascimento]);

  const valido =
    w.valor_imovel > 0 &&
    w.valor_financiamento > 0 &&
    w.data_nascimento !== "" &&
    w.prazo_meses >= PRAZO_MIN &&
    w.prazo_meses <= (maxPrazoIdade ?? PRAZO_MAX);

  function definirPrazo(valor: number) {
    if (!Number.isFinite(valor) || valor <= 0) {
      set("prazo_meses", 0);
      return;
    }
    const { prazo, ajustado, mensagem } = ajustarPrazoPorIdade(valor, w.data_nascimento);
    if (ajustado && mensagem) toast.warning(mensagem);
    set("prazo_meses", prazo);
  }

  useEffect(() => {
    if (maxPrazoIdade != null && w.prazo_meses > maxPrazoIdade) {
      const { mensagem } = ajustarPrazoPorIdade(w.prazo_meses, w.data_nascimento);
      if (mensagem) toast.warning(mensagem);
      set("prazo_meses", maxPrazoIdade);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxPrazoIdade]);

  return {
    w,
    set,
    valido,
    maxPrazoIdade,
    entradaSugerida,
    entradaTocada,
    aplicarEntradaSugerida,
    definirPrazo,
  };
}
