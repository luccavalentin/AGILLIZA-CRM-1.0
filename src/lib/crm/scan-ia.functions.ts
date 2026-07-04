import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface LeituraLista {
  id: string;
  tipo_documento: string | null;
  status: string;
  erro: string | null;
  cliente_id: string | null;
  proposta_id: string | null;
  created_at: string;
  total_campos: number;
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
  status: string;
  erro: string | null;
  created_at: string;
  campos: CampoExtraido[];
  arquivo_assinado: string | null;
}

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
        "id, tipo_documento, status, erro, cliente_id, proposta_id, created_at, scan_ia_campos_extraidos(count)",
      )
      .eq("correspondente_id", corr)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    return (data ?? []).map((r: any) => ({
      id: r.id,
      tipo_documento: r.tipo_documento,
      status: r.status,
      erro: r.erro,
      cliente_id: r.cliente_id,
      proposta_id: r.proposta_id,
      created_at: r.created_at,
      total_campos: r.scan_ia_campos_extraidos?.[0]?.count ?? 0,
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
      .select("id, arquivo_url, tipo_documento, status, erro, created_at, correspondente_id")
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

    return {
      id: leitura.id,
      arquivo_url: leitura.arquivo_url,
      tipo_documento: leitura.tipo_documento,
      status: leitura.status,
      erro: leitura.erro,
      created_at: leitura.created_at,
      campos: (campos ?? []) as CampoExtraido[],
      arquivo_assinado: signed?.signedUrl ?? null,
    };
  });

/** Registra a leitura após o upload do arquivo no bucket. */
export const criarLeitura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { arquivo_url: string; tipo_documento: string }) =>
    z
      .object({
        arquivo_url: z.string().min(1),
        tipo_documento: z.string().min(1).max(120),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const corr = await correspondenteDoUsuario(supabase, userId);
    if (!corr) throw new Error("Sem correspondente.");

    const { data: inserida, error } = await supabase
      .from("scan_ia_leituras")
      .insert({
        correspondente_id: corr,
        arquivo_url: data.arquivo_url,
        tipo_documento: data.tipo_documento,
        status: "pendente",
        criador_id: userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: inserida.id };
  });

const CAMPOS_ESPERADOS = [
  "nome_completo",
  "cpf_cnpj",
  "rg",
  "data_nascimento",
  "estado_civil",
  "renda_mensal",
  "endereco",
  "cep",
  "telefone",
  "email",
  "valor_imovel",
  "numero_documento",
];

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
      .select("id, arquivo_url, tipo_documento, correspondente_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!leitura || leitura.correspondente_id !== corr) throw new Error("Leitura não encontrada.");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const msg = "Provedor de IA não configurado. Cadastre a chave do provedor nas configurações.";
      await supabase.from("scan_ia_leituras").update({ status: "erro", erro: msg }).eq("id", data.id);
      return { ok: false, erro: msg };
    }

    await supabase.from("scan_ia_leituras").update({ status: "processando", erro: null }).eq("id", data.id);

    try {
      // Baixa o arquivo do armazenamento (server-side, respeitando RLS do usuário)
      const { data: blob, error: dlErr } = await supabase.storage
        .from("scan-ia")
        .download(leitura.arquivo_url);
      if (dlErr || !blob) throw new Error("Falha ao baixar o arquivo.");

      const bytes = Buffer.from(await blob.arrayBuffer());
      const base64 = bytes.toString("base64");
      const mime = (blob as Blob).type || "application/pdf";

      const prompt =
        `Você é um extrator de dados de documentos brasileiros de financiamento imobiliário. ` +
        `Tipo do documento: "${leitura.tipo_documento ?? "desconhecido"}". ` +
        `Faça OCR e extraia os campos a seguir quando presentes: ${CAMPOS_ESPERADOS.join(", ")}. ` +
        `Responda SOMENTE com JSON no formato ` +
        `{"campos":[{"campo":"<nome>","valor":"<texto>","confianca":<0-1>}]}. ` +
        `Use exatamente os nomes de campo listados. Para valores monetários, mantenha o formato numérico. ` +
        `A confiança deve refletir a legibilidade e a certeza da extração. ` +
        `Não invente valores: se um campo não existir no documento, não o inclua.`;

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: base64 } }],
              },
            ],
            generationConfig: { temperature: 0, responseMimeType: "application/json" },
          }),
        },
      );

      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`Provedor de IA retornou ${resp.status}: ${body.slice(0, 300)}`);
      }

      const json = await resp.json();
      const texto: string =
        json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";

      let parsed: { campos?: Array<{ campo: string; valor: string; confianca: number }> };
      try {
        parsed = JSON.parse(texto);
      } catch {
        const m = texto.match(/\{[\s\S]*\}/);
        parsed = m ? JSON.parse(m[0]) : { campos: [] };
      }

      const campos = (parsed.campos ?? [])
        .filter((c) => c && c.campo && c.valor != null)
        .map((c) => ({
          leitura_id: data.id,
          campo: String(c.campo).slice(0, 120),
          valor: String(c.valor).slice(0, 2000),
          confianca: Math.max(0, Math.min(1, Number(c.confianca) || 0)),
        }));

      // Substitui campos anteriores
      await supabase.from("scan_ia_campos_extraidos").delete().eq("leitura_id", data.id);
      if (campos.length > 0) {
        const { error: insErr } = await supabase.from("scan_ia_campos_extraidos").insert(campos);
        if (insErr) throw insErr;
      }

      await supabase
        .from("scan_ia_leituras")
        .update({ status: "concluida", erro: null })
        .eq("id", data.id);

      await supabase.from("scan_ia_auditoria").insert({
        correspondente_id: corr,
        leitura_id: data.id,
        ator_id: userId,
        acao: "processada",
        dados: { total_campos: campos.length },
      });

      return { ok: true };
    } catch (e: any) {
      const msg = e?.message ? String(e.message).slice(0, 500) : "Erro ao processar leitura.";
      await supabase.from("scan_ia_leituras").update({ status: "erro", erro: msg }).eq("id", data.id);
      return { ok: false, erro: msg };
    }
  });

/** Salva as correções feitas pelo revisor. */
export const salvarCampos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { leitura_id: string; campos: Array<{ id: string; valor: string }> }) =>
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

    await supabase.from("scan_ia_leituras").update({ status: "revisada" }).eq("id", data.leitura_id);
    await supabase.from("scan_ia_auditoria").insert({
      correspondente_id: corr,
      leitura_id: data.leitura_id,
      ator_id: userId,
      acao: "revisada",
      dados: { campos_editados: data.campos.length },
    });

    return { ok: true };
  });
