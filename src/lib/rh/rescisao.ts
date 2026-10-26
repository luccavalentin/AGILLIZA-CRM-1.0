/**
 * Desligamento guiado: estimativa das verbas rescisórias (CLT) e checklist de saída.
 *
 * Função pura e informativa — mostra ao DP o tamanho da rescisão antes de calcular
 * no contador/eSocial. Não desconta INSS/IRRF (dependem da tabela e da natureza de
 * cada verba). Regras:
 *  · saldo de salário: dias do mês até o desligamento (base 30);
 *  · aviso prévio proporcional (Lei 12.506/2011): 30 dias + 3 por ano completo, até 90;
 *    indenizado na dispensa sem justa causa, metade no acordo (art. 484-A) e descontado
 *    no pedido de demissão sem cumprimento; a projeção do aviso indenizado conta para
 *    13º e férias proporcionais;
 *  · 13º proporcional e férias proporcionais + 1/3: avos (fração de 15 dias conta), não
 *    devidos na justa causa;
 *  · férias vencidas + 1/3: sempre devidas;
 *  · multa do FGTS: 40% (sem justa causa), 20% (acordo) sobre o saldo informado ou,
 *    sem ele, 8% do salário por mês trabalhado.
 */
import { avosAte } from "@/lib/rh/ferias-clt";

export type TipoDesligamento =
  | "sem_justa_causa"
  | "justa_causa"
  | "pedido_demissao"
  | "acordo"
  | "termino_contrato"
  | "termino_experiencia"
  | "outro";

export type AvisoPrevio = "trabalhado" | "indenizado" | "dispensado";

export const TIPO_DESLIGAMENTO_LABEL: Record<TipoDesligamento, string> = {
  sem_justa_causa: "Dispensa sem justa causa",
  justa_causa: "Dispensa por justa causa",
  pedido_demissao: "Pedido de demissão",
  acordo: "Acordo entre as partes (art. 484-A)",
  termino_contrato: "Término de contrato por prazo determinado",
  termino_experiencia: "Término do contrato de experiência",
  outro: "Outro",
};

export const AVISO_LABEL: Record<AvisoPrevio, string> = {
  trabalhado: "Trabalhado",
  indenizado: "Indenizado",
  dispensado: "Dispensado (sem cumprimento e sem desconto)",
};

export interface EntradaRescisao {
  salario: number;
  data_admissao: string;
  data_desligamento: string;
  tipo: TipoDesligamento;
  aviso: AvisoPrevio;
  /** Dias de férias vencidas ainda não gozadas (períodos completos). */
  ferias_vencidas_dias: number;
  /** Saldo do FGTS para a multa; sem ele, estima 8% do salário por mês trabalhado. */
  saldo_fgts?: number | null;
}

export interface LinhaRescisao {
  codigo: string;
  descricao: string;
  referencia: string;
  valor: number;
  natureza: "provento" | "desconto" | "informativo";
}

export interface ResultadoRescisao {
  linhas: LinhaRescisao[];
  total_proventos: number;
  total_descontos: number;
  liquido_estimado: number;
  aviso_dias: number;
  data_projetada: string;
}

const DIA = 86400000;
const d = (iso: string) => {
  const [y, m, dd] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd));
};
const iso = (x: Date) => x.toISOString().slice(0, 10);
const r2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

/** Anos completos de casa na data. */
export function anosCompletos(admissao: string, data: string): number {
  const a = d(admissao);
  const b = d(data);
  let anos = b.getUTCFullYear() - a.getUTCFullYear();
  if (b.getUTCMonth() < a.getUTCMonth() || (b.getUTCMonth() === a.getUTCMonth() && b.getUTCDate() < a.getUTCDate())) {
    anos -= 1;
  }
  return Math.max(0, anos);
}

/** Dias de aviso prévio proporcional (30 + 3 por ano completo, até 90). */
export function diasAvisoPrevio(admissao: string, desligamento: string): number {
  return Math.min(90, 30 + 3 * anosCompletos(admissao, desligamento));
}

/** Início do período aquisitivo em curso na data (aniversário da admissão). */
function inicioPeriodoAquisitivo(admissao: string, data: string): Date {
  const a = d(admissao);
  const anos = anosCompletos(admissao, data);
  return new Date(Date.UTC(a.getUTCFullYear() + anos, a.getUTCMonth(), a.getUTCDate()));
}

export function calcularRescisao(e: EntradaRescisao): ResultadoRescisao {
  const salario = Math.max(0, Number(e.salario) || 0);
  const desl = d(e.data_desligamento);
  if (d(e.data_admissao).getTime() > desl.getTime()) {
    throw new Error("O desligamento não pode ser antes da admissão.");
  }
  const linhas: LinhaRescisao[] = [];
  const add = (l: LinhaRescisao) => {
    if (l.valor > 0) linhas.push({ ...l, valor: r2(l.valor) });
  };

  // Saldo de salário.
  const diasMes = Math.min(30, desl.getUTCDate());
  add({
    codigo: "S01",
    descricao: "Saldo de salário",
    referencia: `${diasMes} dia(s)`,
    valor: (salario / 30) * diasMes,
    natureza: "provento",
  });

  // Aviso prévio.
  const avisoDias = diasAvisoPrevio(e.data_admissao, e.data_desligamento);
  let diasProjecao = 0;
  const comAviso = e.tipo === "sem_justa_causa" || e.tipo === "acordo";
  if (comAviso && e.aviso === "indenizado") {
    const fator = e.tipo === "acordo" ? 0.5 : 1;
    diasProjecao = e.tipo === "acordo" ? Math.round(avisoDias / 2) : avisoDias;
    add({
      codigo: "S02",
      descricao: e.tipo === "acordo" ? "Aviso prévio indenizado (metade — acordo)" : "Aviso prévio indenizado",
      referencia: `${diasProjecao} dia(s)`,
      valor: (salario / 30) * avisoDias * fator,
      natureza: "provento",
    });
  }
  if (e.tipo === "pedido_demissao" && e.aviso === "indenizado") {
    add({
      codigo: "D01",
      descricao: "Aviso prévio não cumprido (desconto)",
      referencia: "30 dias",
      valor: salario,
      natureza: "desconto",
    });
  }
  const projetada = new Date(desl.getTime() + diasProjecao * DIA);

  const justa = e.tipo === "justa_causa";

  // 13º proporcional (ano do desligamento, com a projeção do aviso).
  if (!justa) {
    const inicioAno = new Date(Date.UTC(projetada.getUTCFullYear(), 0, 1));
    const adm = d(e.data_admissao);
    const inicio = adm > inicioAno ? adm : inicioAno;
    const avos = Math.min(12, avosAte(inicio, projetada));
    add({
      codigo: "S03",
      descricao: "13º salário proporcional",
      referencia: `${avos}/12`,
      valor: (salario / 12) * avos,
      natureza: "provento",
    });
  }

  // Férias vencidas + 1/3.
  const vencidas = Math.max(0, Number(e.ferias_vencidas_dias) || 0);
  if (vencidas > 0) {
    add({
      codigo: "S04",
      descricao: "Férias vencidas + 1/3",
      referencia: `${vencidas} dia(s)`,
      valor: (salario / 30) * vencidas * (4 / 3),
      natureza: "provento",
    });
  }

  // Férias proporcionais + 1/3.
  if (!justa) {
    const inicioPA = inicioPeriodoAquisitivo(e.data_admissao, iso(projetada));
    const avos = Math.min(12, avosAte(inicioPA, projetada));
    add({
      codigo: "S05",
      descricao: "Férias proporcionais + 1/3",
      referencia: `${avos}/12`,
      valor: (salario / 12) * avos * (4 / 3),
      natureza: "provento",
    });
  }

  // Multa do FGTS (paga pelo empregador na conta vinculada — informativo).
  const pctMulta = e.tipo === "sem_justa_causa" ? 0.4 : e.tipo === "acordo" ? 0.2 : 0;
  if (pctMulta > 0) {
    const meses = Math.max(1, avosAte(d(e.data_admissao), desl));
    const saldo = e.saldo_fgts != null && e.saldo_fgts > 0 ? e.saldo_fgts : salario * 0.08 * meses;
    add({
      codigo: "F01",
      descricao: `Multa do FGTS (${Math.round(pctMulta * 100)}%) — depósito na conta vinculada`,
      referencia: e.saldo_fgts ? "sobre o saldo informado" : `estimada: ${meses} mês(es) de depósito`,
      valor: saldo * pctMulta,
      natureza: "informativo",
    });
  }

  const total_proventos = r2(linhas.filter((l) => l.natureza === "provento").reduce((s, l) => s + l.valor, 0));
  const total_descontos = r2(linhas.filter((l) => l.natureza === "desconto").reduce((s, l) => s + l.valor, 0));
  return {
    linhas,
    total_proventos,
    total_descontos,
    liquido_estimado: r2(total_proventos - total_descontos),
    aviso_dias: avisoDias,
    data_projetada: iso(projetada),
  };
}

export interface ItemChecklistSaida {
  chave: string;
  rotulo: string;
  feito: boolean;
  feito_em: string | null;
}

/** Checklist de saída padrão (o que o DP confere em todo desligamento). */
export const CHECKLIST_SAIDA: Array<{ chave: string; rotulo: string }> = [
  { chave: "comunicado", rotulo: "Comunicado de desligamento / aviso prévio assinado" },
  { chave: "exame_demissional", rotulo: "Exame demissional (ASO) realizado" },
  { chave: "acessos", rotulo: "Acessos aos sistemas, e-mail e Agilliza bloqueados" },
  { chave: "equipamentos", rotulo: "Equipamentos, crachá e chaves devolvidos" },
  { chave: "calculo", rotulo: "Cálculo da rescisão conferido com o contador" },
  { chave: "trct", rotulo: "TRCT assinado e pagamento até 10 dias (art. 477)" },
  { chave: "fgts", rotulo: "Guias do FGTS / chave de saque e seguro-desemprego entregues" },
  { chave: "ctps", rotulo: "Baixa na CTPS digital / eSocial (S-2299)" },
];

export function checklistSaidaInicial(): ItemChecklistSaida[] {
  return CHECKLIST_SAIDA.map((i) => ({ ...i, feito: false, feito_em: null }));
}
