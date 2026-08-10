import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 
 * Padroniza strings para Title Case (Somente a Primeira Maiúscula).
 * Ex: "JOÃO DA SILVA" -> "João da Silva"
 * Mantém partículas (de, da, do, dos, das, e) em minúsculo.
 */
export function toTitleCase(str: string | null | undefined): string {
  if (!str) return "";
  const particulas = ["de", "da", "do", "dos", "das", "e"];
  return str
    .toLowerCase()
    .split(" ")
    .map((word, index) => {
      if (!word) return "";
      if (index > 0 && particulas.includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}
