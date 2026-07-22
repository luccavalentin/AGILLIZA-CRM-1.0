/**
 * Helpers puros de normalização/sanitização de dados enviados aos bancos.
 * Sem dependência de Supabase/integração — reutilizáveis em qualquer contexto.
 */

export function soDigitos(v: unknown): string | undefined {
  const s = String(v ?? "").replace(/\D/g, "");
  return s.length ? s : undefined;
}

export function soDigitosStr(v?: string | null): string | undefined {
  if (!v) return undefined;
  const s = String(v).replace(/\D+/g, "");
  return s.length ? s : undefined;
}

/**
 * Remove máscara/pontuação de números de documento (RG/CNH/RNE...) antes de
 * enviar ao banco. O Bradesco em particular rejeita silenciosamente valores
 * com pontos/hífens (ex.: "333.312.398-36"): precisa ir só com caracteres
 * alfanuméricos. Preservamos letras porque alguns tipos (ex.: RNE) as usam.
 */
export function sanitizarNumeroDocumento(v: unknown): string | undefined {
  const s = String(v ?? "").replace(/[^0-9A-Za-z]/g, "").trim();
  return s.length ? s : undefined;
}

export function enumBancoId(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "object" && "id" in (v as Record<string, unknown>)) {
    return enumBancoId((v as Record<string, unknown>).id);
  }
  const s = String(v).trim();
  return s.length ? s : undefined;
}

export function normalizarTexto(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Normaliza texto para comparação (sem acento, minúsculo, só alfanumérico). */
export function normTexto(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Normaliza textos livres antes de enviar ao banco. O usuário pode preencher
 * livremente, mas alguns bancos recusam caracteres como parênteses em campos
 * de ocupação (ex.: "Administrador(a)").
 */
export function textoLivreParaBanco(v: unknown): string | undefined {
  const s = String(v ?? "")
    .replace(/\((?:a|o)\)/gi, "")
    .replace(/[(){}[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s || undefined;
}

export function estadoCivilBanco(v: unknown): string | undefined {
  const raw = enumBancoId(v);
  if (!raw) return undefined;
  const upper = raw.toUpperCase();
  if (["CA", "S", "VI", "DI", "SL", "UE"].includes(upper)) return upper;
  const n = normalizarTexto(raw);
  if (n.includes("uniao") || n.includes("uniao estavel")) return "UE";
  if (n.includes("casad")) return "CA";
  if (n.includes("solteir")) return "S";
  if (n.includes("divorci")) return "DI";
  if (n.includes("viuv")) return "VI";
  if (n.includes("separ")) return "SL";
  return upper;
}

export function exigeConjugePorEstadoCivil(v: unknown): boolean {
  const ec = estadoCivilBanco(v);
  return ec === "CA" || ec === "UE";
}

export function codigoBancoDe(v: any): string | null {
  const raw = v?.codigo_banco ?? v?.codigoBanco ?? v?.banco?.codigoBanco ?? null;
  if (raw == null || raw === "") return null;
  return String(raw);
}

export function nomeBancoNormalizado(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bbanco\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarChaveRetorno(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Busca recursivamente um valor por qualquer uma das chaves informadas
 * dentro de objetos, arrays e strings JSON/serializadas.
 */
export function buscarCampoRetorno(
  obj: unknown,
  chaves: string[],
  visitados = new WeakSet<object>(),
): string | null {
  if (obj == null) return null;
  if (typeof obj === "string") {
    const texto = obj.trim();
    if (!texto) return null;
    if (texto.startsWith("{") || texto.startsWith("[")) {
      try {
        const parsed = JSON.parse(texto);
        const achado = buscarCampoRetorno(parsed, chaves, visitados);
        if (achado) return achado;
      } catch {
        // Continua para extração por regex em strings não-JSON ou JSON malformado.
      }
    }
    for (const chave of chaves) {
      const re = new RegExp(`"?${chave}"?\\s*[:=]\\s*"?([A-Za-z0-9._/-]+)`, "i");
      const match = texto.match(re);
      if (match?.[1]) return match[1];
    }
    return null;
  }
  if (typeof obj !== "object") return null;
  if (visitados.has(obj)) return null;
  visitados.add(obj);

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const achado = buscarCampoRetorno(item, chaves, visitados);
      if (achado) return achado;
    }
    return null;
  }

  const mapaChaves = new Set(chaves.map(normalizarChaveRetorno));
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (mapaChaves.has(normalizarChaveRetorno(k)) && v != null && String(v).trim()) {
      return String(v).trim();
    }
  }
  for (const v of Object.values(obj as Record<string, unknown>)) {
    const achado = buscarCampoRetorno(v, chaves, visitados);
    if (achado) return achado;
  }
  return null;
}
