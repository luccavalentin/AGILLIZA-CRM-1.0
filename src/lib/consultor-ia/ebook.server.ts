/**
 * Geração do e-book/FAQ da base de conhecimento (server-only).
 *
 * A partir de uma pergunta (e, quando houver, da resposta já dada no chat), a
 * IA elabora um documento estruturado de nível editorial: título, sumário
 * executivo, seções com tabelas, exemplos práticos, dados para gráfico, FAQ,
 * glossário, checklist e fontes de pesquisa.
 */
import { selecionarTrechos, mensagemErroIa, type TrechoBase } from "./consultor-ia.server";

export interface EbookTabela {
  titulo: string;
  colunas: string[];
  linhas: string[][];
}

export interface EbookSecao {
  titulo: string;
  paragrafos: string[];
  bullets: string[];
  tabela?: EbookTabela | null;
}

export interface EbookExemplo {
  titulo: string;
  cenario: string;
  passos: string[];
  resultado: string;
}

export interface EbookGrafico {
  titulo: string;
  tipo: "barras" | "linha" | "pizza";
  unidade: string;
  series: { rotulo: string; valor: number }[];
  nota: string;
}

export interface EbookFaq {
  titulo: string;
  subtitulo: string;
  categoria: string;
  tags: string[];
  resumo_executivo: string;
  pontos_chave: string[];
  secoes: EbookSecao[];
  exemplos: EbookExemplo[];
  graficos: EbookGrafico[];
  perguntas_frequentes: { pergunta: string; resposta: string }[];
  glossario: { termo: string; definicao: string }[];
  checklist: string[];
  fontes_pesquisa: { titulo: string; referencia: string }[];
  fontes_base: { id: string; titulo: string; categoria: string }[];
}

export interface ConfigIa {
  provedor: "gemini" | "openai";
  modelo: string;
  apiKey: string;
  baseUrl: string;
}

/** Resolve provedor/modelo/chave da IA para o correspondente do usuário. */
export async function resolverConfigIa(supabase: any, userId: string): Promise<ConfigIa> {
  const { data: perfil } = await supabase
    .from("profiles")
    .select("correspondente_id")
    .eq("id", userId)
    .maybeSingle();
  const corr = (perfil?.correspondente_id as string | null) ?? null;

  const { data: cfgRow } = await supabase
    .from("admin_api_integrations")
    .select("api_key, base_url, config, ativo")
    .eq("correspondente_id", corr)
    .eq("chave", "ia")
    .maybeSingle();

  if (cfgRow && cfgRow.ativo === false) {
    throw new Error("Integração de IA desativada. Ative-a em Admin › APIs de IA.");
  }
  const cfg = (cfgRow?.config ?? {}) as Record<string, unknown>;
  const provedor: "gemini" | "openai" = cfg.provedor === "openai" ? "openai" : "gemini";
  const modelo =
    typeof cfg.modelo === "string" && cfg.modelo.trim()
      ? cfg.modelo.trim()
      : provedor === "openai"
        ? "gpt-4o"
        : "gemini-2.0-flash-exp";
  const apiKeySalva = typeof cfgRow?.api_key === "string" ? cfgRow.api_key.trim() : "";
  const apiKey =
    apiKeySalva ||
    (provedor === "openai" ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY) ||
    "";
  if (!apiKey) throw new Error("Chave da API não cadastrada. Configure-a em Admin › APIs de IA.");
  const baseUrl = (
    (typeof cfgRow?.base_url === "string" && cfgRow.base_url) ||
    (provedor === "openai"
      ? "https://api.openai.com/v1"
      : "https://generativelanguage.googleapis.com")
  ).replace(/\/+$/, "");

  return { provedor, modelo, apiKey, baseUrl };
}

const ESQUEMA = `{
  "titulo": "título editorial curto e específico (máx. 90 caracteres, sem 'Guia sobre...' genérico)",
  "subtitulo": "linha de apoio explicando o escopo",
  "categoria": "uma de: FGTS | SFH_SFI | Bradesco | Santander | Itau | Documentacao | Regulatorio | Duvidas_Frequentes",
  "tags": ["5 a 8 palavras-chave em minúsculas"],
  "resumo_executivo": "2 a 4 frases respondendo diretamente a pergunta",
  "pontos_chave": ["4 a 6 conclusões objetivas"],
  "secoes": [{
    "titulo": "título da seção",
    "paragrafos": ["texto corrido explicativo"],
    "bullets": ["itens curtos, opcional"],
    "tabela": { "titulo": "...", "colunas": ["..."], "linhas": [["..."]] }
  }],
  "exemplos": [{ "titulo": "...", "cenario": "...", "passos": ["..."], "resultado": "..." }],
  "graficos": [{ "titulo": "...", "tipo": "barras|linha|pizza", "unidade": "R$ | % | meses", "series": [{"rotulo":"...","valor": 0}], "nota": "como ler o gráfico" }],
  "perguntas_frequentes": [{ "pergunta": "...", "resposta": "..." }],
  "glossario": [{ "termo": "...", "definicao": "..." }],
  "checklist": ["itens práticos de execução"],
  "fontes_pesquisa": [{ "titulo": "nome da norma/manual/instituição", "referencia": "artigo, resolução, manual do banco ou link oficial" }]
}`;

export function montarPromptEbook(
  pergunta: string,
  respostaChat: string | null,
  trechos: TrechoBase[],
): string {
  const referencias = trechos.length
    ? trechos
        .map(
          (t, i) =>
            `--- TRECHO ${i + 1} | id=${t.id} | categoria=${t.categoria} | título="${t.titulo}"\n${t.conteudo.slice(0, 3000)}`,
        )
        .join("\n\n")
    : "(nenhum trecho interno corresponde a esta pergunta)";

  return (
    `Você é editor-chefe de conteúdo técnico de um correspondente bancário brasileiro ` +
    `especializado em crédito imobiliário (SFH, SFI, FGTS, Bradesco, Santander, Itaú, Caixa).\n\n` +
    `TAREFA: transformar a dúvida abaixo em um VERBETE DE FAQ no formato de e-book profissional, ` +
    `completo, didático e pronto para publicação — nível de material institucional.\n\n` +
    `EXIGÊNCIAS:\n` +
    `1. Entenda a intenção real da pergunta e responda-a por completo.\n` +
    `2. Elabore o MELHOR título possível: específico, direto, sem clickbait.\n` +
    `3. Escreva de 3 a 6 seções com progressão lógica (conceito → regras → aplicação prática → riscos/erros comuns).\n` +
    `4. Inclua ao menos 1 tabela comparativa/numérica quando fizer sentido.\n` +
    `5. Inclua de 1 a 2 exemplos numéricos reais (valores, prazos, percentuais) com passo a passo do cálculo.\n` +
    `6. Inclua de 1 a 2 gráficos com dados coerentes e verificáveis (evolução de saldo, comparação SAC x PRICE, composição de custos etc.). Os valores devem ser números puros.\n` +
    `7. Liste fontes de pesquisa reais (Lei 8.036/90, Resoluções CMN, Manual do FGTS, normativos do banco, Banco Central). Não invente links; se não tiver URL, cite a norma.\n` +
    `8. Priorize os TRECHOS INTERNOS quando existirem; complemente com conhecimento técnico geral.\n` +
    `9. Nunca invente taxas ou condições específicas como se fossem oficiais — sinalize quando variar por banco/data.\n` +
    `10. Português do Brasil, tom profissional, sem emojis, sem markdown dentro dos campos.\n\n` +
    `Responda EXCLUSIVAMENTE com um JSON válido neste formato:\n${ESQUEMA}\n\n` +
    `TRECHOS INTERNOS DA BASE:\n${referencias}\n\n` +
    (respostaChat
      ? `RESPOSTA JÁ DADA NO CHAT (use como ponto de partida e aprofunde):\n${respostaChat.slice(0, 4000)}\n\n`
      : "") +
    `PERGUNTA DO USUÁRIO: ${pergunta}`
  );
}

function extrairJson(texto: string): any {
  const limpo = texto
    .replace(/^```(?:json)?/im, "")
    .replace(/```\s*$/m, "")
    .trim();
  const ini = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  if (ini < 0 || fim <= ini) throw new Error("A IA não devolveu um JSON válido.");
  return JSON.parse(limpo.slice(ini, fim + 1));
}

async function gerarJson(cfg: ConfigIa, prompt: string): Promise<any> {
  if (cfg.provedor === "openai") {
    const resp = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.modelo,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) throw new Error(await mensagemErroIa(resp));
    const json: any = await resp.json();
    return extrairJson(json?.choices?.[0]?.message?.content ?? "");
  }
  const resp = await fetch(
    `${cfg.baseUrl}/v1beta/models/${encodeURIComponent(cfg.modelo)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    },
  );
  if (!resp.ok) throw new Error(await mensagemErroIa(resp));
  const json: any = await resp.json();
  const texto = (json?.candidates?.[0]?.content?.parts ?? [])
    .map((x: any) => x?.text ?? "")
    .join("");
  return extrairJson(texto);
}

const CATEGORIAS = [
  "FGTS",
  "SFH_SFI",
  "Bradesco",
  "Santander",
  "Itau",
  "Documentacao",
  "Regulatorio",
  "Duvidas_Frequentes",
];

function txt(v: unknown, alt = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : alt;
}
function lista(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => txt(x)).filter(Boolean) : [];
}

/** Normaliza a saída da IA para o formato consumido pela UI e pelo PDF. */
export function normalizarEbook(bruto: any, pergunta: string, trechos: TrechoBase[]): EbookFaq {
  const secoes: EbookSecao[] = (Array.isArray(bruto?.secoes) ? bruto.secoes : [])
    .map((s: any) => {
      const tab = s?.tabela;
      const colunas = lista(tab?.colunas);
      const linhas: string[][] = Array.isArray(tab?.linhas)
        ? tab.linhas
            .map((l: any) => (Array.isArray(l) ? l.map((c: any) => txt(c)) : []))
            .filter((l: string[]) => l.length)
        : [];
      return {
        titulo: txt(s?.titulo, "Seção"),
        paragrafos: lista(s?.paragrafos),
        bullets: lista(s?.bullets),
        tabela:
          colunas.length && linhas.length ? { titulo: txt(tab?.titulo), colunas, linhas } : null,
      };
    })
    .filter((s: EbookSecao) => s.paragrafos.length || s.bullets.length || s.tabela);

  const graficos: EbookGrafico[] = (Array.isArray(bruto?.graficos) ? bruto.graficos : [])
    .map((g: any) => ({
      titulo: txt(g?.titulo, "Gráfico"),
      tipo: (["barras", "linha", "pizza"].includes(g?.tipo)
        ? g.tipo
        : "barras") as EbookGrafico["tipo"],
      unidade: txt(g?.unidade),
      nota: txt(g?.nota),
      series: (Array.isArray(g?.series) ? g.series : [])
        .map((s: any) => ({ rotulo: txt(s?.rotulo), valor: Number(s?.valor) }))
        .filter((s: any) => s.rotulo && Number.isFinite(s.valor)),
    }))
    .filter((g: EbookGrafico) => g.series.length >= 2);

  const categoriaBruta = txt(bruto?.categoria);
  return {
    titulo: txt(bruto?.titulo, pergunta.slice(0, 90)),
    subtitulo: txt(bruto?.subtitulo, "Verbete da base de conhecimento Agilliza"),
    categoria: CATEGORIAS.includes(categoriaBruta) ? categoriaBruta : "Duvidas_Frequentes",
    tags: lista(bruto?.tags).slice(0, 10),
    resumo_executivo: txt(bruto?.resumo_executivo),
    pontos_chave: lista(bruto?.pontos_chave),
    secoes,
    exemplos: (Array.isArray(bruto?.exemplos) ? bruto.exemplos : []).map((e: any) => ({
      titulo: txt(e?.titulo, "Exemplo prático"),
      cenario: txt(e?.cenario),
      passos: lista(e?.passos),
      resultado: txt(e?.resultado),
    })),
    graficos,
    perguntas_frequentes: (Array.isArray(bruto?.perguntas_frequentes)
      ? bruto.perguntas_frequentes
      : []
    )
      .map((f: any) => ({ pergunta: txt(f?.pergunta), resposta: txt(f?.resposta) }))
      .filter((f: any) => f.pergunta && f.resposta),
    glossario: (Array.isArray(bruto?.glossario) ? bruto.glossario : [])
      .map((g: any) => ({ termo: txt(g?.termo), definicao: txt(g?.definicao) }))
      .filter((g: any) => g.termo && g.definicao),
    checklist: lista(bruto?.checklist),
    fontes_pesquisa: (Array.isArray(bruto?.fontes_pesquisa) ? bruto.fontes_pesquisa : [])
      .map((f: any) => ({ titulo: txt(f?.titulo), referencia: txt(f?.referencia) }))
      .filter((f: any) => f.titulo),
    fontes_base: trechos.map((t) => ({ id: t.id, titulo: t.titulo, categoria: t.categoria })),
  };
}

/** Converte o e-book em markdown — é o conteúdo salvo no item da base. */
export function ebookParaMarkdown(e: EbookFaq): string {
  const p: string[] = [];
  if (e.resumo_executivo) p.push(`## Resumo executivo\n\n${e.resumo_executivo}`);
  if (e.pontos_chave.length)
    p.push(`## Pontos-chave\n\n${e.pontos_chave.map((x) => `- ${x}`).join("\n")}`);
  for (const s of e.secoes) {
    const bloco = [`## ${s.titulo}`];
    if (s.paragrafos.length) bloco.push(s.paragrafos.join("\n\n"));
    if (s.bullets.length) bloco.push(s.bullets.map((b) => `- ${b}`).join("\n"));
    if (s.tabela) {
      bloco.push(
        [
          s.tabela.titulo ? `**${s.tabela.titulo}**` : "",
          `| ${s.tabela.colunas.join(" | ")} |`,
          `| ${s.tabela.colunas.map(() => "---").join(" | ")} |`,
          ...s.tabela.linhas.map((l) => `| ${l.join(" | ")} |`),
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }
    p.push(bloco.join("\n\n"));
  }
  for (const ex of e.exemplos) {
    p.push(
      [
        `## Exemplo — ${ex.titulo}`,
        ex.cenario,
        ex.passos.map((x, i) => `${i + 1}. ${x}`).join("\n"),
        ex.resultado ? `**Resultado:** ${ex.resultado}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
  }
  for (const g of e.graficos) {
    p.push(
      [
        `## ${g.titulo}`,
        g.series
          .map((s) => `- ${s.rotulo}: ${s.valor}${g.unidade ? ` ${g.unidade}` : ""}`)
          .join("\n"),
        g.nota,
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
  }
  if (e.perguntas_frequentes.length) {
    p.push(
      `## Perguntas frequentes\n\n` +
        e.perguntas_frequentes.map((f) => `**${f.pergunta}**\n\n${f.resposta}`).join("\n\n"),
    );
  }
  if (e.checklist.length)
    p.push(`## Checklist\n\n${e.checklist.map((x) => `- [ ] ${x}`).join("\n")}`);
  if (e.glossario.length) {
    p.push(
      `## Glossário\n\n${e.glossario.map((g) => `- **${g.termo}**: ${g.definicao}`).join("\n")}`,
    );
  }
  if (e.fontes_pesquisa.length) {
    p.push(
      `## Fontes de pesquisa\n\n${e.fontes_pesquisa.map((f) => `- ${f.titulo}${f.referencia ? ` — ${f.referencia}` : ""}`).join("\n")}`,
    );
  }
  return p.join("\n\n");
}

/** Pipeline completo: recupera trechos, chama a IA e normaliza o e-book. */
export async function gerarEbookFaq(
  supabase: any,
  userId: string,
  pergunta: string,
  respostaChat: string | null,
): Promise<EbookFaq> {
  const [cfg, baseRes] = await Promise.all([
    resolverConfigIa(supabase, userId),
    supabase
      .from("consultor_ia_base")
      .select("id, categoria, titulo, conteudo, tags")
      .eq("ativo", true)
      .limit(500),
  ]);
  const trechos = selecionarTrechos((baseRes.data ?? []) as TrechoBase[], pergunta, 5);
  const bruto = await gerarJson(cfg, montarPromptEbook(pergunta, respostaChat, trechos));
  return normalizarEbook(bruto, pergunta, trechos);
}
