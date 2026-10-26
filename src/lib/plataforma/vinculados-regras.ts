/**
 * Regras puras dos vinculados ao correspondente (C70): as mesmas do banco (0343 do
 * Agilliza Tech), para a tela avisar antes de enviar. O banco confere de novo.
 */

export function somenteDigitos(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

/** CPF, CNPJ numérico ou CNPJ alfanumérico (Receita, 2026), com dígitos verificadores. */
export function documentoValido(v: string | null | undefined): boolean {
  const d = (v ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (d.length === 11) {
    if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
    const dig = (n: number) => {
      let s = 0;
      for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
      const r = (s * 10) % 11;
      return r === 10 ? 0 : r;
    };
    return dig(9) === Number(d[9]) && dig(10) === Number(d[10]);
  }
  if (d.length === 14) {
    if (!/^[0-9A-Z]{12}\d{2}$/.test(d) || /^(.)\1{13}$/.test(d)) return false;
    const valor = (c: string) => c.charCodeAt(0) - 48;
    const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const dv = (pesos: number[]) => {
      const s = pesos.reduce((acc, p, i) => acc + valor(d[i]) * p, 0);
      const r = s % 11;
      return r < 2 ? 0 : 11 - r;
    };
    return dv(pesos1) === Number(d[12]) && dv(pesos2) === Number(d[13]);
  }
  return false;
}

/** CRECI em maiúsculas, sem espaços ("f 12345" → "F12345"). */
export function normalizarCreci(v: string | null | undefined): string {
  return (v ?? "").toUpperCase().replace(/\s+/g, "");
}

/** Celular para exibir: (11) 98888-7777 / (11) 3333-4444. */
export function formatarCelular(v: string | null | undefined): string {
  const d = somenteDigitos(v);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v ?? "";
}

export type EstadoAcesso = "ativo" | "convite_enviado" | "convite_vencido" | "suspenso" | "encerrado";

/** Onde o acesso da pessoa está, em uma palavra para o selo da lista. */
export function estadoDoAcesso(v: {
  status: string;
  acesso_criado: boolean;
  convite_valido: boolean;
}): EstadoAcesso {
  if (v.status === "cancelado") return "encerrado";
  if (v.status === "suspenso" || v.status === "somente_leitura") return "suspenso";
  if (v.acesso_criado) return "ativo";
  return v.convite_valido ? "convite_enviado" : "convite_vencido";
}

export const ROTULO_ACESSO: Record<EstadoAcesso, string> = {
  ativo: "Ativo",
  convite_enviado: "Convite enviado",
  convite_vencido: "Convite vencido",
  suspenso: "Suspenso",
  encerrado: "Encerrado",
};

export const ROTULO_ORIGEM: Record<string, string> = {
  cadastro: "Cadastrado aqui",
  parceiro_agilliza: "Veio do portal do parceiro",
  conta_existente: "Conta que já existia",
};
