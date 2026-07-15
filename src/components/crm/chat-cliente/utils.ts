export function formatarHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", 
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatarDia(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  const mesmoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (mesmoDia(d, hoje)) return "Hoje";
  if (mesmoDia(d, ontem)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", 
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function iniciais(nome?: string | null): string {
  if (!nome) return "?";
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

export interface ChatClienteInfo {
  nome: string;
  documento?: string | null;
  email?: string | null;
  celular?: string | null;
  contexto?: string | null;
}
