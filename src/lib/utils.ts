import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Padroniza strings para Title Case (Somente a Primeira Maiúscula).
 * Ex: "JOÃO DA SILVA" -> "João da Silva"
 * Mantém partículas (de, da, do, dos, das, e) em minúsculo.
 *
 * Preserva o que não é nome comum: marcador entre colchetes ("[TESTE]"),
 * código com dígito ("F4", "2B") e sufixos de empresa ("LTDA", "ME", "S/A").
 * Antes "[TESTE] F4 Cliente" virava "[Teste] F4 Cliente" e "Ltda".
 */
const SIGLAS_EMPRESA = new Set(["ltda", "me", "epp", "eireli", "mei", "sa", "s/a", "s.a.", "cia"]);

export function toTitleCase(str: string | null | undefined): string {
  if (!str) return "";
  const particulas = ["de", "da", "do", "dos", "das", "e"];
  return str
    .split(" ")
    .map((original, index) => {
      if (!original) return "";
      if (/^\[.*\]$/.test(original) || /\d/.test(original)) return original;
      const word = original.toLowerCase();
      if (index > 0 && SIGLAS_EMPRESA.has(word)) return word.toUpperCase();
      if (index > 0 && particulas.includes(word)) return word;
      // Primeira LETRA da palavra ("(joão)" vira "(João)").
      return word.replace(/\p{L}/u, (c) => c.toUpperCase());
    })
    .join(" ");
}
