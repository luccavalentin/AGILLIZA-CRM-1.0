/**
 * Leitura da frase da criação rápida de tarefa: "ligar para Maria amanhã às 10h".
 *
 * Mesma regra das Tarefas do Agilliza Tech (C35: "tarefas do correspondente iguais às
 * dos assinantes"). Módulo puro, usado nos dois lados: a tela mostra, enquanto a pessoa
 * digita, o que vai ser entendido, e o servidor cria a tarefa com a MESMA função —
 * prévia calculada por outra regra seria promessa que o servidor não cumpre.
 *
 * O que não for entendido fica em branco para a pessoa ajustar depois.
 */

export type TipoTarefa = "ligacao" | "visita" | "reuniao" | "documento" | "lembrete" | "outro";

/*
 * Limite de palavra que entende acento. O `\b` do JavaScript só conhece [A-Za-z0-9_]:
 * em "amanhã às 10h" não há fronteira depois do "ã" nem antes do "à".
 */
const palavra = (fonte: string, global = false) =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${fonte})(?![\\p{L}\\p{N}])`, global ? "giu" : "iu");

const HORA_AS = "(?:às|as)\\s?(\\d{1,2})(?:[:h](\\d{2}))?h?";
const HORA_H = "(\\d{1,2})h(\\d{2})?";
const DATA = "(\\d{1,2})\\/(\\d{1,2})(?:\\/(\\d{2,4}))?";
// "depois de amanhã" antes de "amanhã": senão a parte menor ganha e o dia sai errado.
const DIAS = "depois de amanh[ãa]|amanh[ãa]|hoje|semana que vem|pr[óo]xima semana";

export interface FraseInterpretada {
  titulo: string;
  tipo: TipoTarefa;
  quando: Date | null;
}

export function interpretarFrase(texto: string, agora: Date): FraseInterpretada {
  const t = texto.trim().slice(0, 300);
  let quando: Date | null = null;

  const hora = palavra(HORA_AS).exec(t) ?? palavra(HORA_H).exec(t);
  const hNum = hora ? Number(hora[1]) : 9;
  const minNum = hora?.[2] ? Number(hora[2]) : 0;
  // Hora impossível ("às 37h") não vira data no dia seguinte: cai no horário padrão.
  const horaValida = hNum <= 23 && minNum <= 59;
  const h = horaValida ? hNum : 9;
  const min = horaValida ? minNum : 0;

  const dia = (d: number) => {
    const x = new Date(agora);
    x.setDate(x.getDate() + d);
    x.setHours(h, min, 0, 0);
    return x;
  };
  const data = palavra(DATA).exec(t);

  if (palavra("hoje").test(t)) quando = dia(0);
  else if (palavra("depois de amanh[ãa]").test(t)) quando = dia(2);
  else if (palavra("amanh[ãa]").test(t)) quando = dia(1);
  else if (palavra("semana que vem|pr[óo]xima semana").test(t)) quando = dia(7);
  else if (data) {
    const ano = data[3]
      ? data[3].length === 2
        ? 2000 + Number(data[3])
        : Number(data[3])
      : agora.getFullYear();
    const mes = Number(data[2]) - 1;
    const d = Number(data[1]);
    const x = new Date(ano, mes, d, h, min, 0, 0);
    // 31/02 não pode virar 03/03 calado: data impossível fica sem data.
    quando = x.getMonth() === mes && x.getDate() === d ? x : null;
  } else if (hora && horaValida) quando = dia(0);

  const tipo: TipoTarefa = palavra("ligar|liga[çc][ãa]o|telefonar|retornar").test(t)
    ? "ligacao"
    : palavra("visita|visitar").test(t)
      ? "visita"
      : palavra("reuni[ãa]o|reunir").test(t)
        ? "reuniao"
        : palavra("documento|documentos|contrato|assinar|assinatura").test(t)
          ? "documento"
          : "lembrete";

  let titulo = t
    .replace(palavra(DIAS, true), "")
    .replace(palavra("(?:às|as)\\s?\\d{1,2}(?:[:h]\\d{2})?h?", true), "")
    .replace(palavra("\\d{1,2}h(?:\\d{2})?", true), "")
    .replace(palavra("\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?", true), "")
    .replace(/\s{2,}/g, " ")
    .trim();
  titulo = titulo.charAt(0).toUpperCase() + titulo.slice(1);

  return { titulo: titulo || t, tipo, quando };
}
