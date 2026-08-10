/**
 * Núcleo do Consultor IA (server-only).
 *
 * Compartilhado entre a server function (resposta única) e a rota de streaming
 * (`/api/consultor-ia/stream`), que entrega o texto token a token — é isso que
 * dá a sensação de resposta imediata, como no ChatGPT/Gemini.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const MARCADOR_SEM_INFO = "SEM_INFORMACAO_NA_BASE";

export interface FonteCitada {
  id: string;
  titulo: string;
  categoria: string;
}

export interface TrechoBase {
  id: string;
  categoria: string;
  titulo: string;
  conteudo: string;
  tags: string[];
}

const STOPWORDS = new Set([
  "a","o","as","os","de","da","do","das","dos","e","em","um","uma","para","por","com","que",
  "qual","quais","como","quando","onde","é","sao","são","no","na","nos","nas","ao","aos","se",
  "sobre","meu","minha","the","of",
]);

function tokens(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

export function selecionarTrechos(itens: TrechoBase[], pergunta: string, limite = 4): TrechoBase[] {
  const termos = tokens(pergunta);
  if (termos.length === 0) return itens.slice(0, limite);
  const pontuados = itens.map((it) => {
    const alvoTitulo = tokens(`${it.titulo} ${(it.tags ?? []).join(" ")}`);
    const alvoConteudo = tokens(it.conteudo);
    let score = 0;
    for (const t of termos) {
      if (alvoTitulo.some((x) => x.startsWith(t) || t.startsWith(x))) score += 3;
      score += Math.min(alvoConteudo.filter((x) => x === t).length, 4);
    }
    return { it, score };
  });
  return pontuados
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limite)
    .map((p) => p.it);
}

/** Cliente Supabase autenticado como o usuário (para a rota de streaming). */
export function clienteDoToken(token: string) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const opaca = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  return createClient<Database>(url, key, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (opaca && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface Preparo {
  conversaId: string;
  trechos: TrechoBase[];
  prompt: string;
  provedor: "gemini" | "openai";
  modelo: string;
  apiKey: string;
  baseUrl: string;
}

/** Limite de contexto por trecho — prompts menores = resposta mais rápida. */
const MAX_CHARS_TRECHO = 2500;

export async function prepararConsulta(
  supabase: any,
  userId: string,
  entrada: { conversa_id?: string | null; pergunta: string },
): Promise<Preparo> {
  // Perfil (correspondente) + base de conhecimento em paralelo.
  const [perfilRes, baseRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("correspondente_id, full_name")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("consultor_ia_base")
      .select("id, categoria, titulo, conteudo, tags")
      .eq("ativo", true)
      .limit(500),
  ]);
  const corr = (perfilRes.data?.correspondente_id as string | null) ?? null;
  const nomeUsuario = (perfilRes.data?.full_name as string | null) ?? "Especialista";

  let conversaId = entrada.conversa_id ?? null;
  const [cfgRes] = await Promise.all([
    supabase
      .from("admin_api_integrations")
      .select("api_key, base_url, config, ativo")
      .eq("correspondente_id", corr)
      .eq("chave", "ia")
      .maybeSingle(),
    (async () => {
      if (conversaId) return;
      const bruto = entrada.pergunta.trim();
      const titulo = bruto.slice(0, 80) + (bruto.length > 80 ? "…" : "");
      const { data: nova, error } = await supabase
        .from("consultor_ia_conversas")
        .insert({ usuario_id: userId, correspondente_id: corr, titulo })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      conversaId = nova.id as string;
    })(),
  ]);

  const historicoRes = await supabase
    .from("consultor_ia_mensagens")
    .select("papel, conteudo")
    .eq("conversa_id", conversaId)
    .order("created_at", { ascending: false })
    .limit(6);

  // Grava a pergunta sem bloquear a chamada ao modelo.
  const gravaPergunta = supabase.from("consultor_ia_mensagens").insert({
    conversa_id: conversaId,
    papel: "usuario",
    conteudo: entrada.pergunta,
  });

  const cfgRow = cfgRes.data;
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
  if (cfgRow && cfgRow.ativo === false) {
    throw new Error("Integração de IA desativada. Ative-a em Admin › APIs de IA.");
  }
  if (!apiKey) {
    throw new Error("Chave da API não cadastrada. Configure-a em Admin › APIs de IA.");
  }
  const baseUrl = (
    (typeof cfgRow?.base_url === "string" && cfgRow.base_url) ||
    (provedor === "openai" ? "https://api.openai.com/v1" : "https://generativelanguage.googleapis.com")
  ).replace(/\/+$/, "");

  const trechos = selecionarTrechos((baseRes.data ?? []) as TrechoBase[], entrada.pergunta, 4);

  const referencias = trechos.length
    ? trechos
        .map(
          (t, i) =>
            `--- TRECHO ${i + 1} | id=${t.id} | categoria=${t.categoria} | título="${t.titulo}"\n${t.conteudo.slice(0, MAX_CHARS_TRECHO)}`,
        )
        .join("\n\n")
    : "(nenhum trecho cadastrado na base corresponde a esta pergunta)";

  const ultimas = ((historicoRes.data ?? []) as any[]).reverse();
  const historicoTexto = ultimas.length
    ? ultimas
        .map((m: any) => `${m.papel === "usuario" ? "Usuário" : "Consultor"}: ${m.conteudo.slice(0, 800)}`)
        .join("\n")
    : "(sem histórico)";

  const prompt =
    `Você é o Consultor Especialista de Elite da Agilliza, a maior referência em crédito imobiliário sofisticado do Brasil. Sua atuação deve ser marcada por extrema elegância executiva, precisão técnica absoluta e um tom consultivo de alto nível.\n\n` +
    `DIRETRIZES CRÍTICAS DE IDENTIDADE:\n` +
    `1. VOCÊ É UM ESPECIALISTA FALANDO COM OUTRO ESPECIALISTA: O usuário logado é ${nomeUsuario}. Trate-o pelo nome de forma profissional. NUNCA o chame de "cliente" ou "prezado cliente". Ele é o consultor/parceiro da Agilliza na ponta.\n` +
    `2. GERAÇÃO DE IMAGENS: Se o usuário pedir para gerar uma imagem profissional (ex: de um imóvel, de um contrato, de uma situação de crédito), você DEVE incluir no final da sua resposta uma tag de imagem markdown no formato: ![Descrição profissional da imagem](https://image.pollinations.ai/prompt/{prompt_em_ingles}?width=1024&height=1024&nologo=true). O prompt deve ser altamente detalhado e em inglês para melhor resultado, focando em estética premium e corporativa.\n` +
    `3. CONTEÚDO VISUAL: Sempre que o conteúdo for beneficiado por uma imagem ilustrativa profissional, sinta-se à vontade para gerá-la usando a técnica acima.\n` +
    `4. TOM: Executivo, sofisticado e autoritativo. Use um vocabulário rico mas acessível.\n` +
    `5. ESTRUTURA: Respostas visualmente organizadas com títulos em negrito e listas elegantes.\n` +
    `6. VERACIDADE TÉCNICA: Seja exato em termos como SFH, SFI, LTV, CET e ITBI.\n` +
    `7. FONTES: Finalize sempre com "FONTES: id1, id2" em uma linha única.\n\n` +
    `TRECHOS DE REFERÊNCIA (INTELIGÊNCIA AGILLIZA):\n${referencias}\n\n` +
    `HISTÓRICO DA CONSULTORIA:\n${historicoTexto}\n\n` +
    `DEMANDA DO ESPECIALISTA ${nomeUsuario.toUpperCase()}: ${entrada.pergunta}`;


  await gravaPergunta;

  return { conversaId: conversaId!, trechos, prompt, provedor, modelo, apiKey, baseUrl };
}

export async function mensagemErroIa(resp: Response): Promise<string> {
  const body = await resp.text();
  if (resp.status === 429) {
    return "Cota da API de IA esgotada. Verifique o plano/billing da chave ou tente mais tarde.";
  }
  if (resp.status === 401 || resp.status === 403) {
    return "Chave da API inválida ou sem permissão. Revise em Admin › APIs de IA.";
  }
  return `Provedor de IA retornou ${resp.status}: ${body.slice(0, 200)}`;
}

function corpoGemini(prompt: string) {
  return {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1200,
      // Desliga o "pensamento" do Gemini 2.5 Flash: é o que mais atrasa a
      // primeira palavra da resposta neste caso de uso (RAG objetivo).
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
}

/** Chamada sem streaming (fallback). */
export async function gerarTexto(p: Preparo): Promise<string> {
  if (p.provedor === "openai") {
    const resp = await fetch(`${p.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.apiKey}` },
      body: JSON.stringify({ model: p.modelo, messages: [{ role: "user", content: p.prompt }] }),
    });
    if (!resp.ok) throw new Error(await mensagemErroIa(resp));
    const json: any = await resp.json();
    return json?.choices?.[0]?.message?.content ?? "";
  }
  const resp = await fetch(
    `${p.baseUrl}/v1beta/models/${encodeURIComponent(p.modelo)}:generateContent?key=${encodeURIComponent(p.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpoGemini(p.prompt)),
    },
  );
  if (!resp.ok) throw new Error(await mensagemErroIa(resp));
  const json: any = await resp.json();
  return json?.candidates?.[0]?.content?.parts?.map((x: any) => x.text).join("") ?? "";
}

/** Chamada com streaming — devolve pedaços de texto conforme o modelo gera. */
export async function* gerarTextoStream(p: Preparo): AsyncGenerator<string> {
  const url =
    p.provedor === "openai"
      ? `${p.baseUrl}/chat/completions`
      : `${p.baseUrl}/v1beta/models/${encodeURIComponent(p.modelo)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(p.apiKey)}`;

  const resp = await fetch(url, {
    method: "POST",
    headers:
      p.provedor === "openai"
        ? { "Content-Type": "application/json", Authorization: `Bearer ${p.apiKey}` }
        : { "Content-Type": "application/json" },
    body: JSON.stringify(
      p.provedor === "openai"
        ? { model: p.modelo, messages: [{ role: "user", content: p.prompt }], stream: true }
        : corpoGemini(p.prompt),
    ),
  });
  if (!resp.ok || !resp.body) throw new Error(await mensagemErroIa(resp));

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const linhas = buffer.split("\n");
    buffer = linhas.pop() ?? "";
    for (const linha of linhas) {
      const l = linha.trim();
      if (!l.startsWith("data:")) continue;
      const payload = l.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        const pedaco =
          p.provedor === "openai"
            ? (json?.choices?.[0]?.delta?.content ?? "")
            : (json?.candidates?.[0]?.content?.parts ?? [])
                .map((x: any) => x?.text ?? "")
                .join("");
        if (pedaco) yield pedaco as string;
      } catch {
        // linha parcial — ignora
      }
    }
  }
}

export interface Finalizacao {
  mensagem_id: string;
  resposta: string;
  fontes: FonteCitada[];
  sem_resposta: boolean;
}

/** Limpa marcadores, extrai fontes e grava a resposta do assistente. */
export async function finalizarResposta(
  supabase: any,
  conversaId: string,
  trechos: TrechoBase[],
  bruto: string,
): Promise<Finalizacao> {
  let texto = bruto;
  const idsCitados = new Set<string>();
  const linhaFontes = texto.match(/^FONTES:\s*(.*)$/im);
  if (linhaFontes) {
    for (const parte of linhaFontes[1].split(/[,\s]+/)) {
      const id = parte.trim();
      if (id && trechos.some((t) => t.id === id)) idsCitados.add(id);
    }
    texto = texto.replace(/^FONTES:.*$/gim, "").trim();
  }
  const semResposta = texto.includes(MARCADOR_SEM_INFO);
  texto = texto.replace(new RegExp(MARCADOR_SEM_INFO, "g"), "").trim();
  if (!texto) texto = "Não consegui gerar uma resposta agora. Tente reformular a pergunta.";

  const fontes: FonteCitada[] = trechos
    .filter((t) => idsCitados.has(t.id))
    .map((t) => ({ id: t.id, titulo: t.titulo, categoria: t.categoria }));

  const { data: msg, error } = await supabase
    .from("consultor_ia_mensagens")
    .insert({
      conversa_id: conversaId,
      papel: "assistente",
      conteudo: texto,
      fontes_usadas: fontes,
      sem_resposta: semResposta,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await supabase
    .from("consultor_ia_conversas")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversaId);

  return { mensagem_id: msg.id as string, resposta: texto, fontes, sem_resposta: semResposta };
}
