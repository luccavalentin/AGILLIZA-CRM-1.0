/**
 * Feriados nacionais do Brasil — calculados por algoritmo para QUALQUER ano.
 *
 * Como são calculados (fixos + móveis baseados na Páscoa), a lista está sempre
 * atualizada, sem depender de cadastro manual. Feriados móveis usam o algoritmo
 * de Butcher/Meeus para determinar o Domingo de Páscoa.
 */

export type FeriadoBR = {
  /** Data no formato YYYY-MM-DD (horário local). */
  data: string;
  descricao: string;
  /** Ponto facultativo nacional amplamente observado (ex.: Carnaval). */
  facultativo?: boolean;
};

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function domingoDePascoa(ano: number): Date {
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

function somarDias(base: Date, dias: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + dias);
  return d;
}

/** Retorna todos os feriados nacionais (fixos e móveis) de um ano. */
export function feriadosNacionais(ano: number): FeriadoBR[] {
  const pascoa = domingoDePascoa(ano);

  const lista: FeriadoBR[] = [
    { data: `${ano}-01-01`, descricao: "Confraternização Universal" },
    { data: `${ano}-04-21`, descricao: "Tiradentes" },
    { data: `${ano}-05-01`, descricao: "Dia do Trabalho" },
    { data: `${ano}-09-07`, descricao: "Independência do Brasil" },
    { data: `${ano}-10-12`, descricao: "Nossa Senhora Aparecida" },
    { data: `${ano}-11-02`, descricao: "Finados" },
    { data: `${ano}-11-15`, descricao: "Proclamação da República" },
    { data: `${ano}-11-20`, descricao: "Dia da Consciência Negra" },
    { data: `${ano}-12-25`, descricao: "Natal" },
    // Móveis (relativos à Páscoa)
    { data: iso(somarDias(pascoa, -48)), descricao: "Carnaval", facultativo: true },
    { data: iso(somarDias(pascoa, -47)), descricao: "Carnaval", facultativo: true },
    {
      data: iso(somarDias(pascoa, -46)),
      descricao: "Quarta-feira de Cinzas",
      facultativo: true,
    },
    { data: iso(somarDias(pascoa, -2)), descricao: "Sexta-feira Santa" },
    { data: iso(pascoa), descricao: "Páscoa" },
    { data: iso(somarDias(pascoa, 60)), descricao: "Corpus Christi", facultativo: true },
  ];

  return lista.sort((a, b) => a.data.localeCompare(b.data));
}

/** Mapa data(YYYY-MM-DD) -> descrição, cobrindo os anos informados. */
export function mapaFeriados(anos: number[]): Map<string, FeriadoBR> {
  const m = new Map<string, FeriadoBR>();
  for (const ano of anos) {
    for (const f of feriadosNacionais(ano)) {
      // Mantém o primeiro (feriado real tem precedência sobre facultativo homônimo)
      if (!m.has(f.data)) m.set(f.data, f);
    }
  }
  return m;
}
