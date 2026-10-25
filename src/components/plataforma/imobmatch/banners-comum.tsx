/** Rótulos e peças comuns das abas de banners patrocinados (F3, 0275–0278). */
import { Badge } from "@/components/ui/badge";
import type { CampanhaBanner, SituacaoCampanha } from "@/lib/plataforma/patrocinados.functions";

export const CHAVE_BANNERS = ["plataforma-banners"];

export const ROTULO_BOTAO: Record<string, string> = {
  saiba_mais: "Saiba mais",
  simular: "Simular",
  fale_conosco: "Fale conosco",
  ver_ofertas: "Ver ofertas",
  peca_orcamento: "Peça um orçamento",
  conheca: "Conheça",
  cotar: "Cotar",
};

export const ROTULO_PERIODO: Record<string, string> = {
  semana: "Semana",
  mes: "Mês",
  trimestre: "Trimestre",
  semestre: "Semestre",
  ano: "Ano",
};

export const SEGMENTO: Record<string, string> = {
  banco: "Banco",
  construtora: "Construtora",
  incorporadora: "Incorporadora",
  moveis: "Móveis",
  decoracao: "Decoração",
  mudanca: "Mudança",
  seguro: "Seguro",
  reforma: "Reforma",
  servicos: "Serviços",
  outro: "Outro",
};

type Variante = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";

export const SITUACAO_CAMPANHA: Record<SituacaoCampanha, { rotulo: string; variante: Variante }> = {
  no_ar: { rotulo: "No ar", variante: "success" },
  agendada: { rotulo: "Agendada", variante: "secondary" },
  em_analise: { rotulo: "Em análise", variante: "warning" },
  pausada: { rotulo: "Pausada", variante: "warning" },
  aguardando_pagamento: { rotulo: "Aguardando pagamento", variante: "outline" },
  encerrada: { rotulo: "Encerrada", variante: "secondary" },
  reprovada: { rotulo: "Reprovada", variante: "destructive" },
  rascunho: { rotulo: "Rascunho", variante: "outline" },
  estornada: { rotulo: "Estornada", variante: "destructive" },
  cancelada: { rotulo: "Cancelada", variante: "secondary" },
};

export function SeloCampanha({ situacao }: { situacao: SituacaoCampanha }) {
  const s = SITUACAO_CAMPANHA[situacao] ?? { rotulo: situacao, variante: "outline" as Variante };
  return <Badge variant={s.variante}>{s.rotulo}</Badge>;
}

/** Onde a campanha aparece: cidade/UF e finalidade (ou o Brasil todo). */
export function praca(c: Pick<CampanhaBanner, "uf" | "cidade" | "finalidade">): string {
  const lugar = c.cidade ? `${c.cidade}${c.uf ? `/${c.uf}` : ""}` : c.uf ? c.uf : "Brasil todo";
  const fin =
    c.finalidade === "comprar" ? " · comprar" : c.finalidade === "alugar" ? " · alugar" : "";
  return lugar + fin;
}
