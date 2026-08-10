export const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

export const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

/** Chave estável (yyyy-mm-dd em horário local) para indexar um dia. */
export function chaveDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Gera as 42 células (6 semanas) que compõem a grade de um mês. */
export function montarCelulas(ref: Date): Date[] {
  const primeiro = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const inicio = new Date(primeiro);
  inicio.setDate(inicio.getDate() - primeiro.getDay());
  const celulas: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    celulas.push(d);
  }
  return celulas;
}
