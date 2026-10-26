/**
 * Horários recomendados por rede (porte do `best-times.ts` do Postei): janelas de maior
 * alcance para o público brasileiro. Quando houver histórico de métricas da conta, dá para
 * trocar por horários próprios. Dias: 0 = domingo … 6 = sábado.
 */
import type { Rede } from "./catalogo";

const JANELAS: Partial<Record<Rede, { dias: number[]; horas: number[] }>> = {
  instagram: { dias: [1, 2, 3, 4, 5], horas: [12, 18, 20] },
  facebook: { dias: [1, 2, 3, 4, 5], horas: [9, 13, 19] },
  linkedin: { dias: [2, 3, 4], horas: [8, 12, 17] },
  tiktok: { dias: [0, 1, 2, 3, 4, 5, 6], horas: [19, 21] },
  youtube: { dias: [4, 5, 6], horas: [17, 19] },
  google_business: { dias: [1, 2, 3, 4, 5], horas: [9, 11] },
};

export interface HorarioSugerido {
  data: Date;
  rotulo: string;
  /** Quantas das redes escolhidas consideram esse horário bom. */
  nota: number;
}

const DIA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Próximos horários bons para o conjunto de redes, nos próximos 7 dias. */
export function horariosRecomendados(
  redes: string[],
  agora = new Date(),
  limite = 4,
): HorarioSugerido[] {
  const js = redes.map((r) => JANELAS[r as Rede]).filter(Boolean) as {
    dias: number[];
    horas: number[];
  }[];
  const base = js.length ? js : [{ dias: [1, 2, 3, 4, 5], horas: [9, 12, 18] }];
  const saida: HorarioSugerido[] = [];
  for (let d = 0; d < 7; d++) {
    const dia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + d);
    const horas = new Set(base.flatMap((w) => (w.dias.includes(dia.getDay()) ? w.horas : [])));
    for (const h of horas) {
      const data = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, 0, 0, 0);
      if (data.getTime() < agora.getTime() + 20 * 60_000) continue;
      const nota = base.filter((w) => w.dias.includes(data.getDay()) && w.horas.includes(h)).length;
      const rotuloDia = d === 0 ? "Hoje" : d === 1 ? "Amanhã" : DIA[data.getDay()];
      saida.push({ data, rotulo: `${rotuloDia}, ${h}h`, nota });
    }
  }
  // Primeiro os bons para mais redes; depois os mais próximos.
  return saida
    .sort((a, b) => b.nota - a.nota || a.data.getTime() - b.data.getTime())
    .slice(0, limite)
    .sort((a, b) => a.data.getTime() - b.data.getTime());
}
