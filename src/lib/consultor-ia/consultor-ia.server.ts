/**
 * Núcleo do Consultor IA (server-only) — C18.
 *
 * Fluxo de uma pergunta:
 *   1. RAG: os artigos PUBLICADOS da Base de conhecimento mais próximos da pergunta
 *      (`consultor_ia_trechos`, busca textual sem acento no banco + reordenação aqui);
 *   2. ferramentas determinísticas: parcela SAC/PRICE, comprometimento, capacidade e custos
 *      com os parâmetros da conta — o número sai calculado, não "chutado";
 *   3. detecção de pergunta que depende de dado atual;
 *   4. prompt de especialista + histórico real da conversa → provedor da conta (camada
 *      única, com streaming);
 *   5. resposta limpa, fontes citadas (só as que vieram da base), cálculos e aviso gravados.
 *
 * Compartilhado pela rota de streaming (`/api/consultor-ia/stream`).
 */
import { createClient } from "@supabase/supabase-js";
import { paraRedeInterna } from "@/integrations/supabase/rede-interna";
import type { Database } from "@/integrations/supabase/types";
import {
  configDaLinha,
  erroDaResposta,
  gerarTextoStream as gerarStreamProvedor,
  MODELO_PADRAO,
  type ConfigProvedor,
  type Mensagem,
} from "@/lib/ia/provedor.server";
import type { ParametrosCalculo } from "./calculos";
import {
  blocoParaPrompt,
  executarFerramentas,
  precisaDadoAtual,
  type ResultadoFerramenta,
} from "./ferramentas";
import {
  limparResposta,
  mensagemComContexto,
  promptDeSistema,
  MARCADOR_SEM_INFO,
  type FonteCitada,
} from "./prompt";

export { MARCADOR_SEM_INFO };
export type { FonteCitada };

export interface TrechoBase {
  id: string;
  categoria: string;
  titulo: string;
  conteudo: string;
  tags: string[];
}

const STOPWORDS = new Set([
  "a",
  "o",
  "as",
  "os",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "um",
  "uma",
  "para",
  "por",
  "com",
  "que",
  "qual",
  "quais",
  "como",
  "quando",
  "onde",
  "é",
  "sao",
  "são",
  "no",
  "na",
  "nos",
  "nas",
  "ao",
  "aos",
  "se",
  "sobre",
  "meu",
  "minha",
  "the",
  "of",
]);

function tokens(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
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
      score += Math.min(
        alvoConteudo.filter((x) => x === t || x.startsWith(t) || t.startsWith(x)).length,
        4,
      );
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
        return fetch(paraRedeInterna(input), { ...init, headers });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Formato antigo (usado pelo e-book): provedor, modelo, chave e endereço. */
export interface ConfigIa {
  provedor: "gemini" | "openai";
  modelo: string;
  apiKey: string;
  baseUrl: string;
}

/**
 * Provedor, modelo e chave da IA da conta (Configurações gerais › APIs de IA), lidos com o
 * client de serviço e filtrados pela conta (a tabela só é legível por administradores; quem
 * consulta é qualquer pessoa da conta). A chave não sai do servidor. O segundo parâmetro é
 * mantido por compatibilidade: o modelo padrão agora é o da camada única de provedor.
 */
export async function configIaDaConta(
  corr: string | null,
  _modeloPadraoAntigo?: string,
): Promise<ConfigIa> {
  const cfg = await configProvedorDaConta(corr);
  return { provedor: cfg.provedor, modelo: cfg.modelo, apiKey: cfg.apiKey, baseUrl: cfg.baseUrl };
}

async function configProvedorDaConta(corr: string | null): Promise<ConfigProvedor> {
  let linha: {
    api_key: string | null;
    base_url: string | null;
    config: unknown;
    ativo: boolean;
  } | null = null;
  if (corr) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("admin_api_integrations")
      .select("api_key, base_url, config, ativo")
      .eq("correspondente_id", corr)
      .eq("chave", "ia")
      .maybeSingle();
    if (error) throw new Error("Não foi possível ler a integração de IA da conta.");
    linha = data ?? null;
  }
  const cfg = configDaLinha(linha);
  // Modelo descontinuado salvo numa configuração antiga: usa o padrão atual.
  if (/-exp$|^gemini-1\.5/.test(cfg.modelo)) cfg.modelo = MODELO_PADRAO.gemini;
  return { ...cfg, temperatura: Math.min(cfg.temperatura, 0.4) };
}

/** Os artigos mais relevantes para a pergunta (só publicados, regra de leitura no banco). */
export async function buscarTrechosBase(
  supabase: any,
  pergunta: string,
  limite: number,
): Promise<TrechoBase[]> {
  const { data, error } = await supabase.rpc("consultor_ia_trechos", {
    _pergunta: pergunta,
    _limite: 20,
  });
  if (error) throw new Error("Não foi possível consultar a base de conhecimento.");
  return selecionarTrechos((data ?? []) as TrechoBase[], pergunta, limite);
}

/** Parâmetros de cálculo da conta (a linha nasce com os padrões da tabela). */
export async function parametrosDaConta(supabase: any): Promise<ParametrosCalculo> {
  const { data, error } = await supabase.rpc("consultor_ia_parametros_da_conta");
  if (error || !data) throw new Error("Não foi possível ler os parâmetros de cálculo da conta.");
  const r = Array.isArray(data) ? data[0] : data;
  return {
    itbi_percentual: Number(r.itbi_percentual),
    itbi_municipios: Array.isArray(r.itbi_municipios) ? r.itbi_municipios : [],
    cartorio_percentual: Number(r.cartorio_percentual),
    avaliacao_banco: Number(r.avaliacao_banco),
    certidoes_valor: Number(r.certidoes_valor),
    comprometimento_max_percentual: Number(r.comprometimento_max_percentual),
    taxa_referencia_anual: r.taxa_referencia_anual == null ? null : Number(r.taxa_referencia_anual),
  };
}

export interface Preparo {
  cfg: ConfigProvedor;
  conversaId: string;
  trechos: TrechoBase[];
  sistema: string;
  mensagens: Mensagem[];
  calculos: ResultadoFerramenta[];
  avisoDadoAtual: boolean;
}

const MAX_HISTORICO = 8;

export async function prepararConsulta(
  supabase: any,
  userId: string,
  entrada: { conversa_id?: string | null; pergunta: string },
): Promise<Preparo> {
  const [perfilRes, trechos, parametros] = await Promise.all([
    supabase.from("profiles").select("correspondente_id, nome").eq("id", userId).maybeSingle(),
    buscarTrechosBase(supabase, entrada.pergunta, 5),
    parametrosDaConta(supabase),
  ]);
  if (perfilRes.error) throw new Error("Não foi possível carregar seu perfil.");
  const corr = (perfilRes.data?.correspondente_id as string | null) ?? null;
  const nomeUsuario = (perfilRes.data?.nome as string | null)?.trim() || "Especialista";

  const cfg = await configProvedorDaConta(corr);

  let conversaId = entrada.conversa_id ?? null;
  if (!conversaId) {
    const bruto = entrada.pergunta.trim();
    const titulo = bruto.slice(0, 80) + (bruto.length > 80 ? "…" : "");
    const { data: nova, error } = await supabase
      .from("consultor_ia_conversas")
      .insert({ usuario_id: userId, correspondente_id: corr, titulo })
      .select("id")
      .single();
    if (error) throw new Error("Não foi possível abrir a conversa.");
    conversaId = nova.id as string;
  }

  const historicoRes = await supabase
    .from("consultor_ia_mensagens")
    .select("papel, conteudo")
    .eq("conversa_id", conversaId)
    .order("created_at", { ascending: false })
    .limit(MAX_HISTORICO);
  if (historicoRes.error) throw new Error("Não foi possível carregar a conversa.");

  const { error: erroPergunta } = await supabase
    .from("consultor_ia_mensagens")
    .insert({ conversa_id: conversaId, papel: "usuario", conteudo: entrada.pergunta });
  if (erroPergunta) throw new Error("Não foi possível gravar a pergunta na conversa.");

  // Ferramentas: os números da pergunta (e, se faltar, o pedido do dado que falta).
  let calculos: ResultadoFerramenta[] = [];
  try {
    calculos = executarFerramentas(entrada.pergunta, parametros);
  } catch (e) {
    calculos = [
      {
        tipo: "faltando",
        titulo: "Cálculo",
        dados: { faltam: [] },
        markdown: `Não foi possível calcular: ${e instanceof Error ? e.message : "dados inválidos"}.`,
      },
    ];
  }
  const avisoDadoAtual = precisaDadoAtual(entrada.pergunta);

  const historico = ((historicoRes.data ?? []) as Array<{ papel: string; conteudo: string }>)
    .reverse()
    .map(
      (m) =>
        ({
          papel: m.papel === "usuario" ? "usuario" : "assistente",
          texto: m.conteudo.slice(0, 1500),
        }) as Mensagem,
    );
  // O Gemini exige que a conversa comece pelo usuário.
  while (historico.length && historico[0]!.papel !== "usuario") historico.shift();

  const mensagens: Mensagem[] = [
    ...historico,
    {
      papel: "usuario",
      texto: mensagemComContexto({
        pergunta: entrada.pergunta,
        trechos,
        calculos: blocoParaPrompt(calculos),
        dadoAtual: avisoDadoAtual,
      }),
    },
  ];
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return {
    cfg,
    conversaId,
    trechos,
    sistema: promptDeSistema({ nomeUsuario, hoje }),
    mensagens,
    calculos,
    avisoDadoAtual,
  };
}

/** Mensagem de erro de uma resposta HTTP do provedor (usada pelo e-book). */
export async function mensagemErroIa(resp: Response): Promise<string> {
  return erroDaResposta(resp.status, await resp.text().catch(() => "")).message;
}

/** Streaming da resposta pelo provedor da conta. */
export function gerarTextoStream(p: Preparo, f?: typeof fetch): AsyncGenerator<string> {
  return gerarStreamProvedor(
    p.cfg,
    { sistema: p.sistema, mensagens: p.mensagens, maxTokens: 2048 },
    f,
  );
}

export interface Finalizacao {
  mensagem_id: string;
  resposta: string;
  fontes: FonteCitada[];
  sem_resposta: boolean;
  calculos: ResultadoFerramenta[];
  aviso_dado_atual: boolean;
}

/** Limpa marcadores, extrai fontes e grava a resposta (com cálculos e aviso). */
export async function finalizarResposta(
  supabase: any,
  p: Preparo,
  bruto: string,
): Promise<Finalizacao> {
  const { texto, fontes, semInfo } = limparResposta(bruto, p.trechos);
  const aviso = semInfo || (p.avisoDadoAtual && fontes.length === 0);
  const { data: msg, error } = await supabase
    .from("consultor_ia_mensagens")
    .insert({
      conversa_id: p.conversaId,
      papel: "assistente",
      conteudo: texto,
      fontes_usadas: fontes,
      sem_resposta: semInfo,
      calculos: p.calculos,
      aviso_dado_atual: aviso,
    })
    .select("id")
    .single();
  if (error) throw new Error("Não foi possível gravar a resposta.");
  await supabase
    .from("consultor_ia_conversas")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", p.conversaId);
  return {
    mensagem_id: msg.id as string,
    resposta: texto,
    fontes,
    sem_resposta: semInfo,
    calculos: p.calculos,
    aviso_dado_atual: aviso,
  };
}
