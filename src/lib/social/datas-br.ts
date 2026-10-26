/**
 * Datas comemorativas e de varejo no Brasil, para planejar conteúdo no calendário das
 * Automações (porte do `dates-br.ts` do Postei). As móveis (Carnaval, Páscoa, Dia das Mães e
 * dos Pais, Black Friday) são calculadas por ano.
 */

export type TipoData = "feriado" | "varejo" | "campanha" | "imobiliario";
export type DataEspecial = { chave: string; nome: string; tipo: TipoData };

const FIXAS: [number, number, string, TipoData][] = [
  [1, 1, "Ano Novo", "feriado"],
  [1, 25, "Aniversário de São Paulo", "campanha"],
  [2, 14, "Valentine's Day", "campanha"],
  [3, 8, "Dia da Mulher", "campanha"],
  [3, 15, "Dia do Consumidor", "varejo"],
  [4, 21, "Tiradentes", "feriado"],
  [4, 22, "Descobrimento do Brasil", "campanha"],
  [5, 1, "Dia do Trabalho", "feriado"],
  [6, 12, "Dia dos Namorados", "varejo"],
  [6, 24, "São João", "campanha"],
  [7, 20, "Dia do Amigo", "campanha"],
  [7, 26, "Dia dos Avós", "campanha"],
  [8, 27, "Dia do Corretor de Imóveis", "imobiliario"],
  [9, 7, "Independência do Brasil", "feriado"],
  [9, 15, "Dia do Cliente", "varejo"],
  [9, 21, "Dia da Árvore", "campanha"],
  [10, 12, "Dia das Crianças", "varejo"],
  [10, 15, "Dia do Professor", "campanha"],
  [10, 31, "Halloween", "campanha"],
  [11, 2, "Finados", "feriado"],
  [11, 15, "Proclamação da República", "feriado"],
  [11, 20, "Dia da Consciência Negra", "feriado"],
  [12, 24, "Véspera de Natal", "varejo"],
  [12, 25, "Natal", "feriado"],
  [12, 31, "Réveillon", "varejo"],
];

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

/** n-ésimo dia da semana (0 = domingo) de um mês. */
function enesimoDiaDaSemana(ano: number, mes: number, diaSemana: number, n: number): Date {
  const primeiro = new Date(ano, mes - 1, 1);
  const desloca = (diaSemana - primeiro.getDay() + 7) % 7;
  return new Date(ano, mes - 1, 1 + desloca + (n - 1) * 7);
}

const somarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** "2026-10-26" no fuso do navegador. */
export const chaveDoDia = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const cache = new Map<number, Map<string, DataEspecial[]>>();

export function datasDoAno(ano: number): Map<string, DataEspecial[]> {
  const salvo = cache.get(ano);
  if (salvo) return salvo;
  const mapa = new Map<string, DataEspecial[]>();
  const marcar = (d: Date, nome: string, tipo: TipoData) => {
    const k = chaveDoDia(d);
    mapa.set(k, [...(mapa.get(k) ?? []), { chave: k, nome, tipo }]);
  };
  for (const [m, d, nome, tipo] of FIXAS) marcar(new Date(ano, m - 1, d), nome, tipo);
  const p = pascoa(ano);
  marcar(somarDias(p, -47), "Carnaval", "feriado");
  marcar(somarDias(p, -2), "Sexta-feira Santa", "feriado");
  marcar(p, "Páscoa", "varejo");
  marcar(somarDias(p, 60), "Corpus Christi", "feriado");
  marcar(enesimoDiaDaSemana(ano, 5, 0, 2), "Dia das Mães", "varejo");
  marcar(enesimoDiaDaSemana(ano, 8, 0, 2), "Dia dos Pais", "varejo");
  // Black Friday: o dia seguinte à 4ª quinta-feira de novembro.
  const bf = somarDias(enesimoDiaDaSemana(ano, 11, 4, 4), 1);
  marcar(bf, "Black Friday", "varejo");
  marcar(somarDias(bf, 3), "Cyber Monday", "varejo");
  cache.set(ano, mapa);
  return mapa;
}

export function datasDoDia(d: Date): DataEspecial[] {
  return datasDoAno(d.getFullYear()).get(chaveDoDia(d)) ?? [];
}
