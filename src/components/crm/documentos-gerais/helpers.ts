/** Formatação da ficha consolidada do cliente (Documentos de clientes › Ficha). */
import { exibirDocumento, formatarCelular } from "@/lib/crm/documento";
import { ESTADOS_CIVIS } from "@/components/crm/cliente-form/constants";
import { formatData } from "@/lib/financeiro/format";

export const brl = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Data civil (nascimento) sem deslocar o dia; instante convertido para o dia local. */
export function fmtData(v: string | null | undefined) {
  return formatData(v);
}

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "di", "du"]);

/** Formata nomes em Maiúscula/minúscula corretas ("NOVA SOLUÇÃO" → "Nova Solução"). */
export function titulo(s: string | null | undefined): string {
  if (!s || !s.trim()) return "—";
  return s.toLowerCase().replace(/\S+/g, (palavra, offset: number) => {
    if (offset !== 0 && MINUSCULAS.has(palavra)) return palavra;
    return palavra.charAt(0).toUpperCase() + palavra.slice(1);
  });
}

/** CPF/CNPJ com pontuação; documento já mascarado (sem permissão de PII) fica como veio. */
export function docExib(v: string | null | undefined): string | null {
  return v ? exibirDocumento(v) : null;
}

/** Celular "(11) 99999-9999". */
export function celularExib(v: string | null | undefined): string | null {
  return v ? formatarCelular(v) : null;
}

/** Estado civil em português ("uniao_estavel" → "União estável"). */
export function estadoCivilExib(v: string | null | undefined): string | null {
  if (!v) return null;
  return ESTADOS_CIVIS.find((e) => e.v === v)?.l ?? v;
}
