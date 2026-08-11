export const MACRO_STAGES = [
  {
    key: "simulacao",
    label: "Simulação",
    codes: ["cadastro_basico", "cadastro_completo", "simulacao"],
  },
  { key: "credito", label: "Crédito", codes: ["credito_enviado"] },
  {
    key: "documentacao",
    label: "Documentação",
    codes: ["credito_aprovado", "coleta_documentos", "aguardando_documentos"],
  },
  {
    key: "vistoria",
    label: "Vistoria & Jurídico",
    codes: ["engenharia_vistoria", "analise_juridica"],
  },
  { key: "contratacao", label: "Contrato", codes: ["contrato_emitido"] },
] as const;

export function macroIndexOf(codigo: string | null): number {
  if (!codigo) return 0;
  for (let i = 0; i < MACRO_STAGES.length; i++) {
    if ((MACRO_STAGES[i].codes as readonly string[]).includes(codigo)) return i;
  }
  return 0;
}

export function formatarBRL(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatarTamanho(b: number | null | undefined): string {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}
