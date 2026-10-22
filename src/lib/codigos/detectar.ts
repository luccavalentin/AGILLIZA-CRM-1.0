/**
 * Códigos de acesso: o que conta como "e-mail de código", qual é o código e de
 * que banco veio. Puro (sem rede nem banco) para ser testado à parte.
 *
 * As palavras são as mesmas do Gerenciador de E-mail antigo, que funcionou bem
 * na prática: "código" em qualquer variação, token, OTP, senha, verificação,
 * confirmação, acesso, autenticação, validação, 2FA, MFA.
 */

const PALAVRAS =
  /\w*codigo\w*|\b(?:code|codes|token|tokens|otp|otps|pin|pins|senha|senhas|verificacao|verificacoes|confirmacao|confirmacoes|acesso|acessos|autenticacao|autenticacoes|validacao|validacoes|2fa|mfa)\b/;

export function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Texto corrido de um HTML de e-mail (sem estilos, scripts nem marcação). */
export function htmlParaTexto(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/** O e-mail fala de código? Devolve a palavra que casou, ou null. */
export function palavraDeCodigo(assunto: string, corpo: string): string | null {
  const m = PALAVRAS.exec(semAcento(`${assunto}\n${corpo}`));
  return m ? m[0] : null;
}

/**
 * O código em si: sequência de 4 a 8 dígitos (aceita "482 917" e "482-917"), de
 * preferência perto das palavras de código. Descarta o que parece data, ano,
 * hora, valor, CEP, telefone ou documento.
 */
export function extrairCodigo(assunto: string, corpo: string): string | null {
  const texto = `${assunto}\n${corpo}`;
  const candidatos: { codigo: string; pos: number }[] = [];
  // Ponto, vírgula, barra, dois-pontos e hífen só desqualificam quando colados a outro
  // dígito (data, hora, valor, telefone); no fim de frase ("…é 908172.") o código vale.
  const re = /(?<!\d|\d[/.,:-])(\d{2,4}[ -]?\d{2,4}|\d{4,8})(?![\d%]|[/.,:-]\d|\s?(?:reais|h\b|min))/gi;
  for (const m of texto.matchAll(re)) {
    const bruto = m[1]!;
    const digitos = bruto.replace(/[ -]/g, "");
    if (digitos.length < 4 || digitos.length > 8) continue;
    // Ano solto (1990–2099) não é código.
    if (digitos.length === 4 && /^(19|20)\d{2}$/.test(digitos)) continue;
    const antes = texto.slice(Math.max(0, (m.index ?? 0) - 6), m.index ?? 0);
    if (/r\$\s*$/i.test(antes)) continue;
    candidatos.push({ codigo: digitos, pos: m.index ?? 0 });
  }
  if (candidatos.length === 0) return null;

  // Perto de "código"/"token"/"senha"… ganha; senão, o primeiro do texto.
  const normal = semAcento(texto);
  const ancoras = [...normal.matchAll(new RegExp(PALAVRAS.source, "g"))].map((m) => m.index ?? 0);
  if (ancoras.length === 0) return candidatos[0]!.codigo;
  let melhor = candidatos[0]!;
  let menor = Number.POSITIVE_INFINITY;
  for (const c of candidatos) {
    const d = Math.min(...ancoras.map((a) => Math.abs(a - c.pos)));
    if (d < menor) {
      menor = d;
      melhor = c;
    }
  }
  return melhor.codigo;
}

/** Bancos conhecidos pelo domínio de quem enviou. */
const BANCOS: { banco: string; dominios: string[] }[] = [
  { banco: "Itaú", dominios: ["itau.com.br", "itau-unibanco.com.br", "itau.com", "itaubba.com"] },
  { banco: "Bradesco", dominios: ["bradesco.com.br", "bradesconet.com.br", "bradescoseguros.com.br"] },
  { banco: "Santander", dominios: ["santander.com.br", "santander.com"] },
  { banco: "Banco Inter", dominios: ["inter.co", "bancointer.com.br"] },
  { banco: "Caixa", dominios: ["caixa.gov.br"] },
  { banco: "Banco do Brasil", dominios: ["bb.com.br"] },
  { banco: "Sicredi", dominios: ["sicredi.com.br"] },
  { banco: "Sicoob", dominios: ["sicoob.com.br"] },
  { banco: "Safra", dominios: ["safra.com.br"] },
  { banco: "Banrisul", dominios: ["banrisul.com.br"] },
  { banco: "Nubank", dominios: ["nubank.com.br", "nu.com.br"] },
  { banco: "C6 Bank", dominios: ["c6bank.com.br", "c6bank.com"] },
  { banco: "Banco Pan", dominios: ["bancopan.com.br"] },
  { banco: "BRB", dominios: ["brb.com.br"] },
];

/** Nome do banco a partir do e-mail (e, se preciso, do nome) de quem enviou. */
export function bancoDoRemetente(email: string | null, nome: string | null): string | null {
  const dominio = (email ?? "").toLowerCase().split("@")[1] ?? "";
  for (const b of BANCOS) {
    if (b.dominios.some((d) => dominio === d || dominio.endsWith(`.${d}`))) return b.banco;
  }
  const n = semAcento(nome ?? "");
  for (const b of BANCOS) {
    if (n.includes(semAcento(b.banco))) return b.banco;
  }
  return null;
}

/** Trecho curto do corpo, perto do código, para a pessoa saber para que ele serve. */
export function trechoDoCorpo(corpo: string, codigo: string | null, limite = 220): string {
  const limpo = corpo.replace(/\s+/g, " ").trim();
  if (!limpo) return "";
  let inicio = 0;
  if (codigo) {
    const i = limpo.replace(/[ -](?=\d)/g, "").indexOf(codigo);
    const j = i >= 0 ? i : limpo.indexOf(codigo.slice(0, 3));
    if (j > 0) inicio = Math.max(0, j - Math.floor(limite / 2));
  }
  const pedaco = limpo.slice(inicio, inicio + limite).trim();
  return `${inicio > 0 ? "…" : ""}${pedaco}${inicio + limite < limpo.length ? "…" : ""}`;
}
