/**
 * Períodos prontos do Financeiro do ImobMatch (datas civis aaaa-mm-dd, horário de Brasília).
 * Puro (testado em periodo.test.ts): recebe "hoje" para não depender do relógio.
 */
export type AtalhoPeriodo = "mes" | "mes_passado" | "90d" | "ano" | "personalizado";

export const ROTULO_ATALHO: Record<AtalhoPeriodo, string> = {
  mes: "Este mês",
  mes_passado: "Mês passado",
  "90d": "Últimos 90 dias",
  ano: "Este ano",
  personalizado: "Personalizado",
};

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (a: number, m: number, d: number) => `${a}-${pad(m)}-${pad(d)}`;
const ultimoDia = (a: number, m: number) => new Date(Date.UTC(a, m, 0)).getUTCDate();

/** Soma dias a uma data civil sem passar pelo fuso. */
export function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d + dias));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function periodoDoAtalho(
  atalho: Exclude<AtalhoPeriodo, "personalizado">,
  hoje: string,
): { de: string; ate: string } {
  const [a, m] = hoje.split("-").map(Number);
  switch (atalho) {
    case "mes":
      return { de: iso(a, m, 1), ate: hoje };
    case "mes_passado": {
      const am = m === 1 ? a - 1 : a;
      const mm = m === 1 ? 12 : m - 1;
      return { de: iso(am, mm, 1), ate: iso(am, mm, ultimoDia(am, mm)) };
    }
    case "90d":
      return { de: somarDias(hoje, -89), ate: hoje };
    case "ano":
      return { de: iso(a, 1, 1), ate: hoje };
  }
}

/** O banco aceita até 1.100 dias; a tela avisa antes de pedir. */
export function periodoValido(de: string, ate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate))
    return "Escolha as duas datas.";
  if (de > ate) return "O início do período vem antes do fim.";
  const dias = (Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000;
  if (dias > 1100) return "Escolha um período de até 3 anos.";
  return null;
}
