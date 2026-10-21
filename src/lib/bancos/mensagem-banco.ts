/**
 * Mensagem do banco em texto que o operador entende.
 *
 * Módulo puro (servidor e tela). O retorno da integração às vezes é o JSON
 * inteiro do provedor — o Santander devolve `{"error":{"error@context":{…}}}`
 * com centenas de KB e nenhuma mensagem — e isso ia parar na tela. Aqui:
 *  - se houver uma frase legível dentro do retorno, ela é extraída;
 *  - se o retorno for só técnico, vira uma orientação curta;
 *  - textos longos são encurtados.
 */

import { semMarcaIntegracao } from "@/lib/texto/sem-marca-integracao";

const LIMITE = 280;

const CHAVES_MENSAGEM = ["mensagem", "message", "descricaoMotivo", "error_description", "detail"];

/** Parece JSON/stack, não frase: não deve ir para a tela como está. */
function ehTecnico(texto: string): boolean {
  const t = texto.trim();
  return /^[[{]/.test(t) || /"[\w@.]+"\s*:/.test(t) || /\bat\s+\S+\s+\(/.test(t);
}

function limpar(frase: string): string {
  return frase
    .replace(/\\n[\s\S]*$/, "")
    .replace(/\\"/g, '"')
    .replace(/^\s*(AppError\s+)?[A-Z]{2,5}-\d{2,4}:\s*/i, "")
    .replace(/^N[aã]o foi poss[ií]vel recuperar os dados solicitados:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Primeira frase legível dentro de um retorno técnico, se houver. */
function fraseDentro(texto: string): string | null {
  for (const chave of CHAVES_MENSAGEM) {
    const re = new RegExp(`"${chave}"\\s*:\\s*"((?:[^"\\\\]|\\\\.){3,400})"`, "i");
    const m = texto.match(re);
    if (m) {
      const frase = limpar(m[1]);
      if (frase && !ehTecnico(frase)) return frase;
    }
  }
  // "AppError STD-001: Nao foi possivel recuperar os dados solicitados: Favor inserir…"
  const stack = texto.match(/[A-Z]{2,5}-\d{2,4}:\s*((?:[^"\\]|\\[^n"])+)/);
  if (stack) {
    const frase = limpar(stack[1]);
    if (frase) return frase;
  }
  return null;
}

function encurtar(frase: string): string {
  return frase.length > LIMITE ? `${frase.slice(0, LIMITE - 1).trimEnd()}…` : frase;
}

export function semMotivoDoBanco(nomeBanco?: string | null): string {
  const banco = String(nomeBanco ?? "").trim() || "O banco";
  return `${banco} recusou o envio sem informar o motivo. Tente enviar de novo em alguns minutos; se continuar, acione o suporte da integração bancária.`;
}

const CAMPOS_ENDERECO: [string, string][] = [
  ["cep", "CEP"],
  ["logradouro", "logradouro"],
  ["numeroLogradouro", "número"],
  ["bairro", "bairro"],
  ["municipio", "município"],
];

/**
 * O retorno técnico do Santander traz o `auditContext` do que a integração recebeu, e o
 * texto chega CORTADO pela integração (6.000 caracteres), então a mensagem do banco no fim
 * se perde. Quando o contexto mostra o endereço vazio — causa real de recusa —, isso vira
 * o motivo, em vez de "sem informar o motivo".
 */
function enderecoVazioNoContexto(texto: string): string[] {
  if (!/auditContext/i.test(texto)) return [];
  return CAMPOS_ENDERECO.filter(([chave]) =>
    new RegExp(`"${chave}"\\s*:\\s*(null|"\\s*")`).test(texto),
  ).map(([, rotulo]) => rotulo);
}

export function mensagemBancoLegivel(msg: unknown, nomeBanco?: string | null): string {
  // Retorno antigo pode trazer o nome do provedor da integração: some aqui.
  const texto = semMarcaIntegracao(String(msg ?? "").trim());
  if (!texto) return "";
  if (/erro desconhecido na integra/i.test(texto) && texto.length < 80) {
    return semMotivoDoBanco(nomeBanco);
  }
  if (!ehTecnico(texto)) return encurtar(texto);
  const frase = fraseDentro(texto);
  if (frase) return encurtar(frase);
  const vazios = enderecoVazioNoContexto(texto);
  if (vazios.length > 0) {
    const banco = String(nomeBanco ?? "").trim() || "O banco";
    return `${banco} recusou o envio: o endereço do imóvel foi sem ${vazios.join(", ")}. Complete o endereço do imóvel no cadastro do cliente e envie de novo.`;
  }
  return semMotivoDoBanco(nomeBanco);
}
