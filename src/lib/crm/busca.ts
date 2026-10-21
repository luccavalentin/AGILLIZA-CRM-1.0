/**
 * Termo de busca no mesmo formato de `clientes.nome_busca` (minúsculo, sem
 * acento), para "joao" achar "João" e "JOÃO" achar "joao".
 */
export function termoSemAcento(termo: string): string {
  return termo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
