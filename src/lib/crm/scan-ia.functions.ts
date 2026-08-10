import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  valoresEquivalentes,
  CAMPOS_ESPERADOS,
  CAMPOS_POR_TIPO,
  TODOS_CAMPOS_EXTRAIVEIS,
  TIPOS_DOCUMENTO,
  camposEsperadosDoTipo,
  converterValor,
  destinoDoCampo,
  ehTipoConhecido,
  faixaConfianca,
  rotuloCampo,
} from "./scan-ia-tipos";

export interface LeituraLista {
  id: string;
  tipo_documento: string | null;
  tipo_documento_sugerido: string | null;
  tipo_confirmado: boolean;
  status: string;
  erro: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  proposta_id: string | null;
  created_at: string;
  total_campos: number;
  criador_id: string | null;
  criador_nome: string | null;
}

export interface CampoExtraido {
  id: string;
  campo: string;
  valor: string | null;
  confianca: number | null;
}

export interface LeituraDetalhe {
  id: string;
  arquivo_url: string;
  tipo_documento: string | null;
  tipo_documento_sugerido: string | null;
  tipo_confirmado: boolean;
  cliente_id: string | null;
  cliente_nome: string | null;
  cliente_documento: string | null;
  status: string;
  erro: string | null;
  created_at: string;
  campos: CampoExtraido[];
  arquivo_assinado: string | null;
  criador_id: string | null;
  criador_nome: string | null;
}


/**
 * Detecta o MIME real pelos bytes ("magic numbers"). O `blob.type` vindo do
 * Storage costuma chegar vazio ou como octet-stream no runtime do servidor —
 * usar o fallback fixo "application/pdf" fazia o provedor de IA responder
 * "The document has no pages" ao receber uma imagem rotulada como PDF.
 */
function detectarMime(bytes: Buffer, arquivoUrl: string, tipoBlob?: string): string {
  const b = bytes;
  const hex = (n: number) => b.subarray(0, n).toString("hex").toUpperCase();
  const ascii = (i: number, n: number) => b.subarray(i, i + n).toString("latin1");

  if (ascii(0, 4) === "%PDF") return "application/pdf";
  if (hex(3) === "FFD8FF") return "image/jpeg";
  if (hex(8) === "89504E470D0A1A0A") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (ascii(0, 3) === "GIF") return "image/gif";
  if (hex(4) === "49492A00" || hex(4) === "4D4D002A") return "image/tiff";
  if (hex(2) === "424D") return "image/bmp";
  if (ascii(4, 4) === "ftyp") {
    const marca = ascii(8, 4).toLowerCase();
    if (marca.startsWith("heic") || marca.startsWith("heix")) return "image/heic";
    if (marca.startsWith("mif1") || marca.startsWith("msf1") || marca.startsWith("heif"))
      return "image/heif";
  }

  // Sem assinatura reconhecida: tenta o tipo declarado, depois a extensão.
  const declarado = (tipoBlob ?? "").toLowerCase();
  if (declarado && declarado !== "application/octet-stream") return declarado;

  const ext = (arquivoUrl.split("?")[0].split(".").pop() ?? "").toLowerCase();
  const porExt: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    heic: "image/heic",
    heif: "image/heif",
    tif: "image/tiff",
    tiff: "image/tiff",
    bmp: "image/bmp",
  };
  return porExt[ext] ?? "application/octet-stream";
}

/** Formatos que os provedores de IA conseguem interpretar diretamente. */
const MIMES_SUPORTADOS = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

async function correspondenteDoUsuario(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("correspondente_id")
    .eq("id", userId)
    .maybeSingle();
  return data?.correspondente_id ?? null;
}

/** Retorna o correspondente_id do usuário para montar o caminho do upload. */
export const contextoScanIa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ correspondenteId: string | null }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    return { correspondenteId: corr };
  });

export const listarLeituras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LeituraLista[]> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) return [];

    const { data, error } = await supabase
      .from("scan_ia_leituras")
      .select(
        "id, tipo_documento, tipo_documento_sugerido, tipo_confirmado, status, erro, cliente_id, proposta_id, created_at, criador_id, scan_ia_campos_extraidos(count)",
      )
      .eq("correspondente_id", corr)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    const linhas = data ?? [];
    const criadorIds = [...new Set(linhas.map((r: any) => r.criador_id).filter(Boolean))];
    let nomes = new Map<string, string | null>();
    if (criadorIds.length > 0) {
      const { data: perfis } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", criadorIds);
      nomes = new Map((perfis ?? []).map((p: any) => [p.id, p.nome]));
    }

    const clienteIds = [...new Set(linhas.map((r: any) => r.cliente_id).filter(Boolean))];
    let clientes = new Map<string, string | null>();
    if (clienteIds.length > 0) {
      const { data: cs } = await supabase.from("clientes").select("id, nome").in("id", clienteIds);
      clientes = new Map((cs ?? []).map((c: any) => [c.id, c.nome]));
    }

    return linhas.map((r: any) => ({
      id: r.id,
      tipo_documento: r.tipo_documento,
      tipo_documento_sugerido: r.tipo_documento_sugerido ?? null,
      tipo_confirmado: !!r.tipo_confirmado,
      status: r.status,
      erro: r.erro,
      cliente_id: r.cliente_id,
      cliente_nome: r.cliente_id ? (clientes.get(r.cliente_id) ?? null) : null,
      proposta_id: r.proposta_id,
      created_at: r.created_at,
      total_campos: r.scan_ia_campos_extraidos?.[0]?.count ?? 0,
      criador_id: r.criador_id ?? null,
      criador_nome: r.criador_id ? (nomes.get(r.criador_id) ?? null) : null,
    }));

  });

export const obterLeitura = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<LeituraDetalhe> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");

    const { data: leitura, error } = await supabase
      .from("scan_ia_leituras")
      .select(
        "id, arquivo_url, tipo_documento, tipo_documento_sugerido, tipo_confirmado, cliente_id, status, erro, created_at, correspondente_id, criador_id",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!leitura || leitura.correspondente_id !== corr) throw new Error("Leitura não encontrada.");

    const { data: campos } = await supabase
      .from("scan_ia_campos_extraidos")
      .select("id, campo, valor, confianca")
      .eq("leitura_id", data.id)
      .order("campo", { ascending: true });

    const { data: signed } = await supabase.storage
      .from("scan-ia")
      .createSignedUrl(leitura.arquivo_url, 600);

    let criadorNome: string | null = null;
    if (leitura.criador_id) {
      const { data: perfil } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", leitura.criador_id)
        .maybeSingle();
      criadorNome = perfil?.nome ?? null;
    }

    let clienteNome: string | null = null;
    let clienteDocumento: string | null = null;
    if (leitura.cliente_id) {
      const { data: cli } = await supabase
        .from("clientes")
        .select("nome, documento")
        .eq("id", leitura.cliente_id)
        .maybeSingle();
      clienteNome = cli?.nome ?? null;
      clienteDocumento = cli?.documento ?? null;
    }

    return {
      id: leitura.id,
      arquivo_url: leitura.arquivo_url,
      tipo_documento: leitura.tipo_documento,
      tipo_documento_sugerido: leitura.tipo_documento_sugerido ?? null,
      tipo_confirmado: !!leitura.tipo_confirmado,
      cliente_id: leitura.cliente_id ?? null,
      cliente_nome: clienteNome,
      cliente_documento: clienteDocumento,
      status: leitura.status,
      erro: leitura.erro,
      created_at: leitura.created_at,
      campos: (campos ?? []) as CampoExtraido[],
      arquivo_assinado: signed?.signedUrl ?? null,
      criador_id: leitura.criador_id ?? null,
      criador_nome: criadorNome,
    };
  });

/** Registra a leitura após o upload do arquivo no bucket. O tipo é OPCIONAL — em branco, a IA identifica. */
export const criarLeitura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { arquivo_url: string; tipo_documento?: string | null }) =>
    z
      .object({
        arquivo_url: z.string().min(1),
        tipo_documento: z.string().max(120).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");

    const tipoInformado = (data.tipo_documento ?? "").trim() || null;

    const { data: inserida, error } = await supabase
      .from("scan_ia_leituras")
      .insert({
        correspondente_id: corr,
        arquivo_url: data.arquivo_url,
        tipo_documento: tipoInformado,
        tipo_confirmado: false,
        status: "pendente",
        criador_id: userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: inserida.id };
  });


/** Processa a leitura com IA (OCR + extração estruturada de campos). */
export const processarLeitura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean; erro?: string }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");

    const { data: leitura } = await supabase
      .from("scan_ia_leituras")
      .select("id, arquivo_url, tipo_documento, tipo_confirmado, correspondente_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!leitura || leitura.correspondente_id !== corr) throw new Error("Leitura não encontrada.");

    // Carrega a configuração salva pelo usuário em Admin › APIs de IA.
    const { data: cfgRow } = await supabase
      .from("admin_api_integrations")
      .select("api_key, base_url, config, ativo")
      .eq("correspondente_id", corr)
      .eq("chave", "ia")
      .maybeSingle();

    const cfg = (cfgRow?.config ?? {}) as Record<string, unknown>;
    const provedor: "gemini" | "openai" = cfg.provedor === "openai" ? "openai" : "gemini";
    const modeloCfg =
      typeof cfg.modelo === "string" && cfg.modelo.trim().length > 0
        ? cfg.modelo.trim()
        : provedor === "openai"
          ? "gpt-4o"
          : "gemini-2.0-flash-exp";
    const temperatura = typeof cfg.temperatura === "number" ? cfg.temperatura : 0;
    const promptSistema =
      typeof cfg.prompt_scan === "string" && cfg.prompt_scan.trim().length > 0
        ? cfg.prompt_scan.trim()
        : "";

    // Prioriza a chave salva no sistema; só cai para o env se o usuário não configurou.
    const apiKeySalva = typeof cfgRow?.api_key === "string" ? cfgRow.api_key.trim() : "";
    const apiKey =
      apiKeySalva ||
      (provedor === "openai" ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY) ||
      "";

    if (cfgRow && cfgRow.ativo === false) {
      const msg = "Integração de IA desativada. Ative-a em Admin › APIs de IA.";
      await supabase
        .from("scan_ia_leituras")
        .update({ status: "erro", erro: msg })
        .eq("id", data.id);
      return { ok: false, erro: msg };
    }

    if (!apiKey) {
      const msg = "Chave da API não cadastrada. Configure-a em Admin › APIs de IA.";
      await supabase
        .from("scan_ia_leituras")
        .update({ status: "erro", erro: msg })
        .eq("id", data.id);
      return { ok: false, erro: msg };
    }

    await supabase
      .from("scan_ia_leituras")
      .update({ status: "processando", erro: null })
      .eq("id", data.id);

    try {
      // Baixa o arquivo do armazenamento (server-side, respeitando RLS do usuário)
      const { data: blob, error: dlErr } = await supabase.storage
        .from("scan-ia")
        .download(leitura.arquivo_url);
      if (dlErr || !blob) throw new Error("Falha ao baixar o arquivo.");

      const bytes = Buffer.from(await blob.arrayBuffer());
      const base64 = bytes.toString("base64");
      const mime = detectarMime(bytes, leitura.arquivo_url, (blob as Blob).type);
      if (!MIMES_SUPORTADOS.has(mime)) {
        throw new Error(
          `Formato do arquivo (${mime}) não é suportado pela leitura automática. ` +
            `Envie o documento em PDF, JPG, PNG ou WEBP.`,
        );
      }
      const ehPdf = mime === "application/pdf";

      const mapaTipos = Object.entries(CAMPOS_POR_TIPO)
        .map(([t, cs]) => `- ${t}: ${cs.join(", ")}`)
        .join("\n");
      const tipoInformado = (leitura.tipo_documento ?? "").trim();

      const instrucaoBase =
        `Você é um Especialista de Crédito Imobiliário Sênior da Agilliza. Sua missão é fornecer análises técnicas, profissionais e altamente sofisticadas.\n` +
        `PASSO 1 — Identifique e classifique o documento com precisão absoluta em um destes tipos: ${TIPOS_DOCUMENTO.join(", ")}.\n` +
        `PASSO 2 — Realize OCR de alta fidelidade e extração estruturada dos campos previstos:\n${mapaTipos}\n` +
        `DIRETRIZES DE QUALIDADE:\n` +
        `- Mantenha um tom executivo, formal e consultivo em qualquer campo de observação ou texto livre.\n` +
        `- Para documentos de residência e renda, extraia todos os detalhes com rigor (logradouros completos, centavos, datas de emissão).\n` +
        `- Em certidões, capture averbações e regimes de bens com terminologia jurídica correta.\n` +
        `- Em matrículas (matricula_imovel), forneça um parecer técnico sobre a cadeia dominial e gravames vigentes. Identifique proprietários atuais e descrições detalhadas do imóvel (áreas, confrontações, registros de IPTU).\n` +
        `- Se o documento for ilegível ou suspeito, aponte a inconformidade de forma profissional no campo erro ou observação.\n` +
        `OBJETIVO: Transformar imagens e PDFs em dados estruturados prontos para análise bancária de alto nível.\n\n` +
        `Responda EXCLUSIVAMENTE em formato JSON:\n` +
        `{"tipo_documento":"<tipo>","confianca_tipo":<0-1>,"campos":[{"campo":"<nome>","valor":"<texto>","confianca":<0-1>}]}. ` +
        `Todo "valor" deve ser uma STRING simples (nunca objeto ou lista). ` +
        `Use exatamente os nomes de campo listados acima. Para valores monetários, mantenha o formato numérico. ` +
        `Datas em dd/mm/aaaa. A confiança deve refletir a legibilidade e a certeza da extração. ` +
        `Não invente valores: se um campo não existir no documento, não o inclua.`;
      const prompt = promptSistema ? `${promptSistema}\n\n${instrucaoBase}` : instrucaoBase;



      let resp: Response;
      if (provedor === "openai") {
        const baseUrl = (
          (typeof cfgRow?.base_url === "string" && cfgRow.base_url) || "https://api.openai.com/v1"
        ).replace(/\/+$/, "");
        resp = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modeloCfg,
            temperature: temperatura,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  // PDFs vão como arquivo; imagens como image_url (o endpoint rejeita
                  // um PDF enviado dentro de image_url).
                  ehPdf
                    ? {
                        type: "file",
                        file: {
                          filename: (leitura.arquivo_url.split("/").pop() ?? "documento.pdf"),
                          file_data: `data:${mime};base64,${base64}`,
                        },
                      }
                    : { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
                ],
              },
            ],
          }),
        });
      } else {
        const baseUrl = (
          (typeof cfgRow?.base_url === "string" && cfgRow.base_url) ||
          "https://generativelanguage.googleapis.com"
        ).replace(/\/+$/, "");
        resp = await fetch(
          `${baseUrl}/v1beta/models/${encodeURIComponent(modeloCfg)}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    { text: prompt },
                    { inline_data: { mime_type: mime, data: base64 } },
                  ],
                },
              ],
              generationConfig: {
                temperature: temperatura,
                responseMimeType: "application/json",
                maxOutputTokens: 16384,
              },

            }),
          },
        );
      }

      if (!resp.ok) {
        const body = await resp.text();
        if (resp.status === 429) {
          throw new Error(
            "Cota da API esgotada. Verifique o plano/billing da sua chave ou tente novamente mais tarde.",
          );
        }
        if (resp.status === 401 || resp.status === 403) {
          throw new Error(
            "Chave da API inválida ou sem permissão. Revise a chave em Admin › APIs de IA.",
          );
        }
        if (/has no pages|Unsupported MIME|invalid image|unsupported image/i.test(body)) {
          throw new Error(
            "O provedor de IA não conseguiu abrir este arquivo. Verifique se o PDF não está " +
              "corrompido/protegido por senha e tente enviar como JPG ou PNG.",
          );
        }
        throw new Error(`Provedor de IA retornou ${resp.status}: ${body.slice(0, 300)}`);
      }

      const json = await resp.json();
      const texto: string =
        provedor === "openai"
          ? (json?.choices?.[0]?.message?.content ?? "")
          : (json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "");

      let parsed: {
        tipo_documento?: string;
        confianca_tipo?: number;
        campos?: Array<{ campo: string; valor: string; confianca: number }>;
      };
      try {
        parsed = JSON.parse(texto);
      } catch (parseError: any) {
        // Tenta recuperar se for apenas um problema de markdown ou caracteres extras
        const m = texto.match(/\{[\s\S]*\}/);
        if (m) {
          try {
            parsed = JSON.parse(m[0]);
          } catch {
            throw new Error(`JSON malformado devolvido pela IA: ${parseError.message}. Resposta: ${texto.slice(0, 500)}`);
          }
        } else {
          throw new Error(`Resposta da IA não contém um JSON válido: ${parseError.message}. Resposta: ${texto.slice(0, 500)}`);
        }
      }

      // Identificação automática do tipo
      const confiancaTipo = Number(parsed.confianca_tipo) || 0;
      const tipoSugerido = ehTipoConhecido(parsed.tipo_documento)
        ? parsed.tipo_documento
        : "outro";

      // O tipo informado pelo usuário tem precedência para o processamento de campos se existir
      const tipoParaFiltro = tipoInformado && ehTipoConhecido(tipoInformado) ? tipoInformado : tipoSugerido;

      // Só aceita campos previstos para o tipo sugerido (evita ruído do modelo).
      const permitidos = new Set([
        ...camposEsperadosDoTipo(tipoParaFiltro),
        ...TODOS_CAMPOS_EXTRAIVEIS,
        ...CAMPOS_ESPERADOS,
      ]);

      // O modelo às vezes devolve objeto/lista (ex.: ônus com vários atos) — achata em texto.
      const comoTexto = (v: unknown): string => {
        if (v == null) return "";
        if (typeof v === "string") return v.trim();
        if (typeof v === "number" || typeof v === "boolean") return String(v);
        if (Array.isArray(v)) return v.map(comoTexto).filter(Boolean).join(" | ");
        return Object.entries(v as Record<string, unknown>)
          .filter(([, val]) => val != null && val !== "")
          .map(([k, val]) => `${k.replace(/_/g, " ")}: ${comoTexto(val)}`)
          .join("; ");
      };

      const campos = (parsed.campos ?? [])
        .flatMap((c) =>
          normalizarCampoExtraido(String(c?.campo ?? ""), comoTexto(c?.valor)).map((n) => ({
            bruto: c,
            ...n,
          })),
        )
        .filter((c) => c.campo && c.valor && permitidos.has(c.campo))
        .map((c) => ({
          leitura_id: data.id,
          campo: c.campo.slice(0, 120),
          valor: c.valor.slice(0, 2000),
          confianca: Math.max(0, Math.min(1, Number(c.bruto?.confianca) || 0)),
        }))
        .filter((c) => c.valor.length > 0);


      // Substitui campos anteriores
      await supabase.from("scan_ia_campos_extraidos").delete().eq("leitura_id", data.id);
      if (campos.length > 0) {
        const { error: insErr } = await supabase.from("scan_ia_campos_extraidos").insert(campos);
        if (insErr) throw insErr;
      }

      // O tipo sugerido NUNCA sobrescreve o tipo efetivo — só um humano confirma.
      await supabase
        .from("scan_ia_leituras")
        .update({
          status: "concluida",
          erro:
            campos.length === 0
              ? "A IA não conseguiu extrair campos deste documento. Verifique a qualidade da digitalização ou tente reprocessar."
              : null,
          tipo_documento_sugerido: tipoSugerido,
          // Se não houver tipo informado e a confiança for alta, podemos pré-selecionar
          tipo_documento: !tipoInformado && confiancaTipo >= 0.8 ? tipoSugerido : leitura.tipo_documento,
          tipo_confirmado: !tipoInformado && confiancaTipo >= 0.8 ? false : !!leitura.tipo_confirmado,
        })
        .eq("id", data.id);

      await supabase.from("scan_ia_auditoria").insert({
        correspondente_id: corr,
        leitura_id: data.id,
        ator_id: userId,
        acao: "processada",
        dados: {
          total_campos: campos.length,
          tipo_informado: tipoInformado || null,
          tipo_sugerido: tipoSugerido,
          confianca_tipo: confiancaTipo,
          divergencia_tipo: !!tipoInformado && tipoInformado !== tipoSugerido,
          prompt_utilizado: prompt.slice(0, 1000),
        },
      });


      return { ok: true };
    } catch (e: any) {
      console.error("[processarLeitura] Erro:", e);
      const msg = e?.message ? String(e.message).slice(0, 1000) : "Erro ao processar leitura.";
      
      // Garante que o erro seja persistido para diagnóstico
      await supabase
        .from("scan_ia_leituras")
        .update({ 
          status: "erro", 
          erro: msg 
        })
        .eq("id", data.id);
        
      return { ok: false, erro: msg };
    }
  });

/** Salva as correções feitas pelo revisor. */
export const salvarCampos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { leitura_id: string; campos: Array<{ id: string; valor: string }> }) =>
    z
      .object({
        leitura_id: z.string().uuid(),
        campos: z.array(z.object({ id: z.string().uuid(), valor: z.string().max(2000) })),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");

    const { data: leitura } = await supabase
      .from("scan_ia_leituras")
      .select("id, correspondente_id")
      .eq("id", data.leitura_id)
      .maybeSingle();
    if (!leitura || leitura.correspondente_id !== corr) throw new Error("Leitura não encontrada.");

    for (const c of data.campos) {
      await supabase
        .from("scan_ia_campos_extraidos")
        .update({ valor: c.valor, confianca: 1 })
        .eq("id", c.id)
        .eq("leitura_id", data.leitura_id);
    }

    await supabase
      .from("scan_ia_leituras")
      .update({ status: "revisada" })
      .eq("id", data.leitura_id);
    await supabase.from("scan_ia_auditoria").insert({
      correspondente_id: corr,
      leitura_id: data.leitura_id,
      ator_id: userId,
      acao: "revisada",
      dados: { campos_editados: data.campos.length },
    });

    return { ok: true };
  });

/** Exclui uma leitura do Scan IA, registrando a ação em auditoria antes de remover. */
export const excluirLeitura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");

    const { data: leitura } = await supabase
      .from("scan_ia_leituras")
      .select(
        "id, tipo_documento, status, arquivo_url, cliente_id, proposta_id, criador_id, correspondente_id, created_at",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (!leitura || leitura.correspondente_id !== corr) throw new Error("Leitura não encontrada.");

    const { data: campos } = await supabase
      .from("scan_ia_campos_extraidos")
      .select("campo, valor, confianca")
      .eq("leitura_id", data.id);

    // Trilha de auditoria: mantém o registro do que foi excluído (leitura_id fica nulo pois a leitura é removida).
    await supabase.from("scan_ia_auditoria").insert({
      correspondente_id: corr,
      leitura_id: null,
      ator_id: userId,
      acao: "excluida",
      dados: {
        leitura_id: leitura.id,
        tipo_documento: leitura.tipo_documento,
        status: leitura.status,
        arquivo_url: leitura.arquivo_url,
        criador_id: leitura.criador_id,
        created_at: leitura.created_at,
        campos: campos ?? [],
      },
    });

    await supabase.from("scan_ia_campos_extraidos").delete().eq("leitura_id", data.id);
    const { error } = await supabase.from("scan_ia_leituras").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* ────────────────────────────────────────────────────────────────────────────
 * VALIDAÇÃO HUMANA OBRIGATÓRIA
 * Nada abaixo grava dado da IA no cadastro sem uma decisão explícita do usuário.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Confirma (humano) o tipo efetivo do documento. */
export const confirmarTipoDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { leitura_id: string; tipo: string }) =>
    z.object({ leitura_id: z.string().uuid(), tipo: z.enum(TIPOS_DOCUMENTO) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");

    const { data: leitura } = await supabase
      .from("scan_ia_leituras")
      .select("id, correspondente_id, tipo_documento, tipo_documento_sugerido")
      .eq("id", data.leitura_id)
      .maybeSingle();
    if (!leitura || leitura.correspondente_id !== corr) throw new Error("Leitura não encontrada.");

    const { error } = await supabase
      .from("scan_ia_leituras")
      .update({ tipo_documento: data.tipo, tipo_confirmado: true })
      .eq("id", data.leitura_id);
    if (error) throw error;

    await supabase.from("scan_ia_auditoria").insert({
      correspondente_id: corr,
      leitura_id: data.leitura_id,
      ator_id: userId,
      acao: "tipo_confirmado",
      dados: {
        tipo_anterior: leitura.tipo_documento,
        tipo_sugerido_ia: leitura.tipo_documento_sugerido,
        tipo_confirmado_pelo_usuario: data.tipo,
      },
    });
    return { ok: true };
  });

/** Vincula (ou desvincula) a leitura a um cliente já cadastrado. */
export const vincularClienteLeitura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { leitura_id: string; cliente_id: string | null }) =>
    z
      .object({ leitura_id: z.string().uuid(), cliente_id: z.string().uuid().nullable() })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");

    const { data: leitura } = await supabase
      .from("scan_ia_leituras")
      .select("id, correspondente_id")
      .eq("id", data.leitura_id)
      .maybeSingle();
    if (!leitura || leitura.correspondente_id !== corr) throw new Error("Leitura não encontrada.");

    if (data.cliente_id) {
      const { data: cli } = await supabase
        .from("clientes")
        .select("id")
        .eq("id", data.cliente_id)
        .maybeSingle();
      if (!cli) throw new Error("Cliente não encontrado.");
    }

    const { error } = await supabase
      .from("scan_ia_leituras")
      .update({ cliente_id: data.cliente_id })
      .eq("id", data.leitura_id);
    if (error) throw error;

    await supabase.from("scan_ia_auditoria").insert({
      correspondente_id: corr,
      leitura_id: data.leitura_id,
      ator_id: userId,
      acao: "cliente_vinculado",
      dados: { cliente_id: data.cliente_id },
    });
    return { ok: true };
  });

/**
 * Cria um cliente novo a partir da leitura. Nome e documento vêm do formulário
 * revisado pelo operador (não direto da IA) — os demais campos só entram depois,
 * pelo modal de "Aplicar ao cadastro".
 */
export const criarClienteParaLeitura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { leitura_id: string; nome: string; documento: string }) =>
    z
      .object({
        leitura_id: z.string().uuid(),
        nome: z.string().trim().min(3).max(200),
        documento: z.string().trim().min(11).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ cliente_id: string; reaproveitado: boolean }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");

    const { data: leitura } = await supabase
      .from("scan_ia_leituras")
      .select("id, correspondente_id")
      .eq("id", data.leitura_id)
      .maybeSingle();
    if (!leitura || leitura.correspondente_id !== corr) throw new Error("Leitura não encontrada.");

    const documento = data.documento.replace(/\D/g, "");
    if (documento.length !== 11 && documento.length !== 14) {
      throw new Error("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.");
    }

    const { data: existente } = await supabase
      .from("clientes")
      .select("id, deleted_at")
      .eq("correspondente_id", corr)
      .eq("documento", documento)
      .maybeSingle();

    let clienteId = existente?.id ?? null;
    let reaproveitado = !!existente;

    // Se o cadastro com esse documento estava excluído (soft delete), ele é
    // restaurado — caso contrário o "cliente criado" pela IA ficaria invisível
    // no CRM, que filtra registros excluídos.
    if (existente?.id && existente.deleted_at) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("clientes")
        .update({
          deleted_at: null,
          deleted_by: null,
          deleted_motivo: null,
          ativo: true,
          nome: data.nome.trim(),
          responsavel_id: userId,
        })
        .eq("id", existente.id);
    }

    if (!clienteId) {
      const { data: novo, error } = await supabase
        .from("clientes")
        .insert({
          correspondente_id: corr,
          numero_cliente: "",
          nome: data.nome.trim(),
          documento,
          tipo_pessoa: documento.length === 14 ? "PJ" : "PF",
          criador_id: userId,
          responsavel_id: userId,
        })
        .select("id")
        .single();
      if (error) throw error;
      clienteId = novo.id;
      reaproveitado = false;
    }

    await supabase
      .from("scan_ia_leituras")
      .update({ cliente_id: clienteId })
      .eq("id", data.leitura_id);

    await supabase.from("scan_ia_auditoria").insert({
      correspondente_id: corr,
      leitura_id: data.leitura_id,
      ator_id: userId,
      acao: reaproveitado ? "cliente_vinculado" : "cliente_criado",
      dados: { cliente_id: clienteId, nome: data.nome.trim(), documento },
    });

    return { cliente_id: clienteId!, reaproveitado };
  });

export interface PreviaCampoAplicacao {
  campo_id: string;
  campo: string;
  rotulo: string;
  valor: string;
  confianca: number;
  faixa: "alta" | "media" | "revisar";
  aplicavel: boolean;
  motivo_nao_aplicavel: string | null;
  destino: string;
  valor_atual: string | null;
  conflito: boolean;
}

export interface PreviaAplicacao {
  cliente_id: string | null;
  cliente_nome: string | null;
  tipo_documento: string | null;
  tipo_confirmado: boolean;
  campos: PreviaCampoAplicacao[];
}

function textoValorAtual(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return String(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function normalizarCampoExtraido(campo: string, valor: string): Array<{ campo: string; valor: string }> {
  const c = campo.trim();
  const v = valor.trim();
  if (c === "endereco_completo" || c === "endereco") {
    const cep = v.match(/\b\d{5}[-\s]?\d{3}\b/);
    const linha = cep ? v.replace(cep[0], "").trim().replace(/[,-]\s*$/, "") : v;
    return cep
      ? [
          { campo: c, valor: linha },
          { campo: "endereco_cep", valor: cep[0] },
        ]
      : [{ campo: c, valor: v }];
  }
  if (c === "cep") return [{ campo: "endereco_cep", valor: v }];
  if (c === "bairro") return [{ campo: "endereco_bairro", valor: v }];
  if (c === "cidade") return [{ campo: "endereco_cidade", valor: v }];
  if (c === "uf") return [{ campo: "endereco_uf", valor: v }];
  return [{ campo: c, valor: v }];
}

/** Monta a prévia do modal de aplicação: valor da IA x valor atual do cadastro. */
export const previaAplicacao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { leitura_id: string }) =>
    z.object({ leitura_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<PreviaAplicacao> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");

    const { data: leitura } = await supabase
      .from("scan_ia_leituras")
      .select("id, correspondente_id, cliente_id, tipo_documento, tipo_confirmado")
      .eq("id", data.leitura_id)
      .maybeSingle();
    if (!leitura || leitura.correspondente_id !== corr) throw new Error("Leitura não encontrada.");

    const { data: campos } = await supabase
      .from("scan_ia_campos_extraidos")
      .select("id, campo, valor, confianca")
      .eq("leitura_id", data.leitura_id)
      .order("campo", { ascending: true });

    let cliente: Record<string, any> | null = null;
    let enderecoPrincipal: Record<string, any> | null = null;
    if (leitura.cliente_id) {
      const { data: c } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", leitura.cliente_id)
        .maybeSingle();
      cliente = (c as any) ?? null;
      const { data: end } = await supabase
        .from("cliente_enderecos")
        .select("*")
        .eq("cliente_id", leitura.cliente_id)
        .eq("principal", true)
        .maybeSingle();
      enderecoPrincipal = (end as any) ?? null;
    }

    const lista: PreviaCampoAplicacao[] = (campos ?? []).map((c: any) => {
      const valor = String(c.valor ?? "");
      const destino = destinoDoCampo(c.campo);
      const conv = converterValor(c.campo, valor);
      const confianca = Number(c.confianca ?? 0);

      let valorAtual: string | null = null;
      if (cliente) {
        if (destino.tipo === "coluna") valorAtual = textoValorAtual(cliente[destino.coluna]);
        else if (destino.tipo === "endereco") {
          valorAtual = textoValorAtual(enderecoPrincipal?.[destino.coluna]);
        }
        else if (destino.tipo === "matricula") {
          const m = (cliente.imovel_matricula ?? {}) as Record<string, unknown>;
          valorAtual = textoValorAtual(m?.[destino.chave]);
        }
      }

      const novoTexto = conv.ok ? textoValorAtual(conv.valor) : null;
      const conflito = !!valorAtual && !!novoTexto && !valoresEquivalentes(valorAtual, novoTexto);

      return {
        campo_id: c.id,
        campo: c.campo,
        rotulo: rotuloCampo(c.campo),
        valor,
        confianca,
        faixa: faixaConfianca(confianca),
        aplicavel: conv.ok,
        motivo_nao_aplicavel: conv.ok ? null : conv.motivo,
        destino:
          destino.tipo === "coluna"
            ? destino.coluna
            : destino.tipo === "endereco"
              ? `endereco_principal.${destino.coluna}`
            : destino.tipo === "matricula"
              ? `imovel_matricula.${destino.chave}`
              : "—",
        valor_atual: valorAtual,
        conflito,
      };
    });

    return {
      cliente_id: leitura.cliente_id ?? null,
      cliente_nome: cliente?.nome ?? null,
      tipo_documento: leitura.tipo_documento ?? null,
      tipo_confirmado: !!leitura.tipo_confirmado,
      campos: lista,
    };
  });

/**
 * Aplica ao cadastro do cliente APENAS os campos que o usuário marcou, com a
 * escolha explícita feita em cada conflito. Registra a trilha completa.
 */
export const aplicarAoCadastro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      leitura_id: string;
      decisoes: Array<{ campo_id: string; aplicar: boolean; escolha?: "manter" | "substituir" }>;
    }) =>
      z
        .object({
          leitura_id: z.string().uuid(),
          decisoes: z.array(
            z.object({
              campo_id: z.string().uuid(),
              aplicar: z.boolean(),
              escolha: z.enum(["manter", "substituir"]).optional(),
            }),
          ),
        })
        .parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      ok: boolean;
      aplicados: number;
      descartados: number;
      arquivado: boolean;
      erro_arquivo: string | null;
    }> => {
      const { supabase, userId } = context;
      const corr = await correspondenteDoUsuario(supabase, userId);
      if (!corr) throw new Error("Sem correspondente.");

      const { data: leitura } = await supabase
        .from("scan_ia_leituras")
        .select(
          "id, correspondente_id, cliente_id, tipo_documento, tipo_confirmado, arquivo_url",
        )
        .eq("id", data.leitura_id)
        .maybeSingle();
      if (!leitura || leitura.correspondente_id !== corr)
        throw new Error("Leitura não encontrada.");
      if (!leitura.cliente_id) throw new Error("Vincule um cliente antes de aplicar.");
      if (!leitura.tipo_confirmado)
        throw new Error("Confirme o tipo do documento antes de aplicar.");

      const { data: campos } = await supabase
        .from("scan_ia_campos_extraidos")
        .select("id, campo, valor, confianca")
        .eq("leitura_id", data.leitura_id);

      const { data: clienteAtual } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", leitura.cliente_id)
        .maybeSingle();
      if (!clienteAtual) throw new Error("Cliente não encontrado.");

      const { data: enderecoAtual } = await supabase
        .from("cliente_enderecos")
        .select("*")
        .eq("cliente_id", leitura.cliente_id)
        .eq("principal", true)
        .maybeSingle();

      const porId = new Map((campos ?? []).map((c: any) => [c.id, c]));
      const patch: Record<string, any> = {};
      const matriculaPatch: Record<string, unknown> = {};
      const enderecoPatch: Record<string, unknown> = {};
      const aplicados: any[] = [];
      const descartados: any[] = [];

      for (const dec of data.decisoes) {
        const campo = porId.get(dec.campo_id);
        if (!campo) continue;

        const valor = String(campo.valor ?? "");
        const destino = destinoDoCampo(campo.campo);
        const conv = converterValor(campo.campo, valor);

        let valorAtual: unknown = null;
        if (destino.tipo === "coluna") valorAtual = (clienteAtual as any)[destino.coluna];
        else if (destino.tipo === "endereco") valorAtual = (enderecoAtual as any)?.[destino.coluna];
        else if (destino.tipo === "matricula") {
          const m = ((clienteAtual as any).imovel_matricula ?? {}) as Record<string, unknown>;
          valorAtual = m?.[destino.chave];
        }
        const temAtual = valorAtual !== null && valorAtual !== undefined && valorAtual !== "";
        const novoTexto = conv.ok ? textoValorAtual(conv.valor) : null;
        const conflito = temAtual && !!novoTexto && !valoresEquivalentes(textoValorAtual(valorAtual), novoTexto);

        const registro = {
          campo: campo.campo,
          rotulo: rotuloCampo(campo.campo),
          valor_documento: valor,
          valor_anterior: textoValorAtual(valorAtual),
          confianca: Number(campo.confianca ?? 0),
          conflito,
          escolha: dec.escolha ?? null,
        };

        if (!dec.aplicar || !conv.ok) {
          descartados.push({ ...registro, motivo: conv.ok ? "nao_marcado" : conv.motivo });
          continue;
        }
        if (conflito && dec.escolha !== "substituir") {
          // Sem escolha explícita de substituição, o valor atual prevalece.
          descartados.push({ ...registro, motivo: "conflito_mantido" });
          continue;
        }

        if (destino.tipo === "coluna") patch[destino.coluna] = conv.valor;
        else if (destino.tipo === "endereco") enderecoPatch[destino.coluna] = conv.valor;
        else if (destino.tipo === "matricula") matriculaPatch[destino.chave] = conv.valor;
        else {
          descartados.push({ ...registro, motivo: "sem_destino" });
          continue;
        }
        aplicados.push(registro);
      }

      if (Object.keys(matriculaPatch).length > 0) {
        const atual = ((clienteAtual as any).imovel_matricula ?? {}) as Record<string, unknown>;
        // Mescla — nunca sobrescreve o jsonb inteiro.
        patch.imovel_matricula = { ...atual, ...matriculaPatch };
      }

      if (Object.keys(patch).length > 0) {
        const { error: upErr } = await supabase
          .from("clientes")
          .update(patch as never)
          .eq("id", leitura.cliente_id);
        if (upErr) throw upErr;
      }

      if (Object.keys(enderecoPatch).length > 0) {
        const payload = { ...enderecoPatch, principal: true };
        const enderecoId = (enderecoAtual as any)?.id;
        if (enderecoId) {
          const { error: endErr } = await supabase
            .from("cliente_enderecos")
            .update(payload)
            .eq("id", enderecoId);
          if (endErr) throw endErr;
        } else {
          const { error: endErr } = await supabase
            .from("cliente_enderecos")
            .insert({ cliente_id: leitura.cliente_id, ...payload });
          if (endErr) throw endErr;
        }
      }

      await supabase
        .from("scan_ia_leituras")
        .update({ status: "aplicada" })
        .eq("id", data.leitura_id);

      // Documento confirmado → vai para a Documentação do cliente.
      const { arquivarLeituraNaDocumentacao } = await import("./scan-ia-arquivar.server");
      const arq = await arquivarLeituraNaDocumentacao({
        supabase,
        userId,
        leituraId: data.leitura_id,
        clienteId: leitura.cliente_id,
        tipoDocumento: leitura.tipo_documento,
        arquivoUrl: leitura.arquivo_url,
      });

      await supabase.from("scan_ia_auditoria").insert({
        correspondente_id: corr,
        leitura_id: data.leitura_id,
        ator_id: userId,
        acao: "aplicada_ao_cadastro",
        dados: {
          cliente_id: leitura.cliente_id,
          tipo_documento: leitura.tipo_documento,
          validado_por_humano: true,
          campos_aplicados: aplicados,
          campos_descartados: descartados,
          colunas_atualizadas: Object.keys(patch),
          endereco_atualizado: Object.keys(enderecoPatch),
          documento_arquivado: arq.arquivado,
          documento_id: arq.documento_id,
          erro_arquivo: arq.erro,
        },
      });

      return {
        ok: true,
        aplicados: aplicados.length,
        descartados: descartados.length,
        arquivado: arq.arquivado,
        erro_arquivo: arq.erro,
      };
    },
  );

/**
 * Arquiva o arquivo da leitura na Documentação do cliente sem aplicar campos.
 * Útil quando o operador só quer guardar o documento no cadastro.
 */
export const arquivarDocumentoDaLeitura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { leitura_id: string }) =>
    z.object({ leitura_id: z.string().uuid() }).parse(d),
  )
  .handler(
    async ({ data, context }): Promise<{ ok: boolean; ja_existia: boolean; erro: string | null }> => {
      const { supabase, userId } = context;
      const corr = await correspondenteDoUsuario(supabase, userId);
      if (!corr) throw new Error("Sem correspondente.");

      const { data: leitura } = await supabase
        .from("scan_ia_leituras")
        .select("id, correspondente_id, cliente_id, tipo_documento, arquivo_url")
        .eq("id", data.leitura_id)
        .maybeSingle();
      if (!leitura || leitura.correspondente_id !== corr) throw new Error("Leitura não encontrada.");
      if (!leitura.cliente_id) throw new Error("Vincule um cliente antes de arquivar o documento.");

      const { arquivarLeituraNaDocumentacao } = await import("./scan-ia-arquivar.server");
      const arq = await arquivarLeituraNaDocumentacao({
        supabase,
        userId,
        leituraId: data.leitura_id,
        clienteId: leitura.cliente_id,
        tipoDocumento: leitura.tipo_documento,
        arquivoUrl: leitura.arquivo_url,
      });
      if (!arq.arquivado) throw new Error(arq.erro ?? "Falha ao arquivar o documento.");

      await supabase.from("scan_ia_auditoria").insert({
        correspondente_id: corr,
        leitura_id: data.leitura_id,
        ator_id: userId,
        acao: "documento_arquivado",
        dados: { cliente_id: leitura.cliente_id, documento_id: arq.documento_id },
      });

      return { ok: true, ja_existia: arq.ja_existia, erro: null };
    },
  );
