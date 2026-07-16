/**
 * Tipos e helpers compartilhados pela lista de simulações.
 * Extraídos de `routes/_authenticated/operacional.simulacoes.tsx`
 * sem qualquer alteração de comportamento.
 */

export interface HandlersLinha {
  onVer: (id: string) => void;
  onEditar: (id: string) => void;
  onBaixarComparativo: (id: string) => void;
  onBaixarDetalhada: (id: string) => void;
  onDuplicar: (id: string) => void;
  onEnviarProposta: (id: string, numero: string) => void;
  onExcluir: (id: string) => void;
  onRestaurar: (id: string) => void;
}

export function formatDataHoraBR(v?: string | null): string {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}
