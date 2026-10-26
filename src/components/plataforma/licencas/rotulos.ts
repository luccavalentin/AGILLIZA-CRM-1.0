/**
 * Rótulos e tons das licenças (tipo, situação, assinatura, fatura, papel), usados pela
 * lista de licenças, pela gaveta e pelas carteiras. Cor só por significado: ativa = verde,
 * em teste = marca, somente leitura = atenção, suspensa = perigo, cancelada = neutro.
 */
import type { Tom } from "@/components/plataforma/kit";
import type { Licenca, SituacaoLicenca, TipoLicenca } from "@/lib/plataforma/licencas.functions";

export const ROTULO_TIPO: Record<TipoLicenca, string> = {
  corretor: "Corretor",
  imobiliaria: "Imobiliária",
  parceiro: "Parceiro",
};

export const SITUACAO_LICENCA: Record<SituacaoLicenca, { rotulo: string; tom: Tom }> = {
  trial: { rotulo: "Em teste", tom: "marca" },
  ativo: { rotulo: "Ativa", tom: "sucesso" },
  somente_leitura: { rotulo: "Somente leitura", tom: "alerta" },
  suspenso: { rotulo: "Suspensa", tom: "perigo" },
  cancelado: { rotulo: "Cancelada", tom: "neutro" },
};

export function situacaoLicenca(s: string): { rotulo: string; tom: Tom } {
  return SITUACAO_LICENCA[s as SituacaoLicenca] ?? { rotulo: s.replace(/_/g, " "), tom: "neutro" };
}

export const ROTULO_ASSINATURA: Record<string, string> = {
  trial: "em teste",
  ativa: "ativa",
  inadimplente: "inadimplente",
  cancelada: "cancelada",
  encerrada: "encerrada",
};
export const ROTULO_FATURA: Record<string, string> = {
  pendente: "em aberto",
  vencida: "vencida",
  paga: "paga",
  cancelada: "cancelada",
  estornada: "estornada",
};
export const ROTULO_CICLO: Record<string, string> = { mensal: "mês", trimestral: "trimestre", anual: "ano" };
export const ROTULO_PAPEL: Record<string, string> = {
  dono: "Dono",
  admin: "Administrador",
  gerente: "Gerente",
  corretor: "Corretor",
  assistente: "Assistente",
  financeiro: "Financeiro",
  parceiro_dono: "Dono (parceiro)",
  parceiro_membro: "Membro (parceiro)",
};

export const rotuloDe = (mapa: Record<string, string>, v: string | null | undefined) =>
  v ? (mapa[v] ?? v.replace(/_/g, " ")) : "—";

/** Licença de cortesia ainda no período dela (criada no Agilliza como cortesia, 0228). */
export function ehCortesia(l: Pick<Licenca, "status" | "status_motivo">): boolean {
  return l.status === "ativo" && (l.status_motivo ?? "").startsWith("cortesia:");
}

/** Tipos que trocam entre si em "Mudar tipo da conta" (0590): parceiro não troca. */
export function conversivel(tipo: string): tipo is "corretor" | "imobiliaria" {
  return tipo === "corretor" || tipo === "imobiliaria";
}
