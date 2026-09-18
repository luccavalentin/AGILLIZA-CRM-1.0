/**
 * Estado do polling de propostas (tabela `proposta_sync_estado`, só servidor).
 *
 * Guarda quando cada proposta foi consultada pela última vez no provedor, para
 * o ritmo de `sync-backoff.ts` valer entre todas as origens (agendador, lista
 * de propostas, tela da proposta) sem gravar em `propostas` a cada consulta —
 * essa gravação disparava o realtime de todas as telas inscritas.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

async function admin(): Promise<SupabaseClient<any, any, any>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** Última consulta ao provedor por proposta (id → ISO). */
export async function lerUltimasConsultas(ids: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  if (ids.length === 0) return mapa;
  try {
    const sb = await admin();
    // Em lotes: a lista vai na URL, e mil uuids passariam do limite.
    for (let i = 0; i < ids.length; i += 150) {
      const { data } = await sb
        .from("proposta_sync_estado")
        .select("proposta_id, ultima_consulta_em")
        .in("proposta_id", ids.slice(i, i + 150));
      for (const r of (data ?? []) as any[]) mapa.set(String(r.proposta_id), r.ultima_consulta_em);
    }
  } catch (e) {
    // Sem o estado, as regras caem na leitura gravada na proposta.
    console.error("[sync-estado] leitura falhou", e);
  }
  return mapa;
}

/**
 * Propostas vencidas para consulta, segundo `sync-backoff.ts`, das mais
 * atrasadas para as mais recentes. `supabase` define o que é visível: o
 * agendador passa o cliente administrativo; a lista de propostas, o do usuário
 * (as regras de acesso de sempre valem).
 */
export async function selecionarParaSincronizar(
  supabase: SupabaseClient<any, any, any>,
  statusAtivos: readonly string[],
  limite: number,
): Promise<{ id: string }[]> {
  const { data: candidatas, error } = await supabase
    .from("propostas")
    .select(
      "id, status, nome_banco, ultima_sincronizacao_em, status_atualizado_em, enviada_em, created_at",
    )
    .in("status", statusAtivos as any)
    .not("homefin_id_oportunidade", "is", null)
    // Proposta na lixeira não tem retorno para receber.
    .is("deleted_at", null)
    .order("ultima_sincronizacao_em", { ascending: true, nullsFirst: true } as any)
    .limit(1000);
  if (error) throw new Error(error.message);
  const lista = (candidatas ?? []) as any[];
  const ultimas = await lerUltimasConsultas(lista.map((p) => String(p.id)));
  const { filtrarParaSincronizar } = await import("./sync-backoff");
  const vencidas = filtrarParaSincronizar(
    lista.map((p) => ({ ...p, ultima_consulta_em: ultimas.get(String(p.id)) ?? null })),
  );
  const quando = (p: any) =>
    Math.max(
      p.ultima_consulta_em ? new Date(p.ultima_consulta_em).getTime() : 0,
      p.ultima_sincronizacao_em ? new Date(p.ultima_sincronizacao_em).getTime() : 0,
    );
  return vencidas
    .sort((a, b) => quando(a) - quando(b))
    .slice(0, limite)
    .map((p) => ({ id: String(p.id) }));
}

/** Registra que a proposta acabou de ser consultada no provedor. */
export async function marcarConsulta(propostaId: string): Promise<void> {
  try {
    const sb = await admin();
    await sb
      .from("proposta_sync_estado")
      .upsert(
        { proposta_id: propostaId, ultima_consulta_em: new Date().toISOString() },
        { onConflict: "proposta_id" },
      );
  } catch (e) {
    console.error("[sync-estado] gravação falhou", e);
  }
}

/**
 * Resumo da última resposta registrada no log, para gravar a consulta de
 * acompanhamento só quando a resposta mudou. Devolve `true` se o resumo é novo
 * (e já o guarda).
 */
export async function resumoMudou(propostaId: string, resumo: string): Promise<boolean> {
  try {
    const sb = await admin();
    const { data } = await sb
      .from("proposta_sync_estado")
      .select("ultimo_resumo")
      .eq("proposta_id", propostaId)
      .maybeSingle();
    if (data && (data as any).ultimo_resumo === resumo) return false;
    await sb
      .from("proposta_sync_estado")
      .upsert(
        {
          proposta_id: propostaId,
          ultimo_resumo: resumo,
          ultima_consulta_em: new Date().toISOString(),
        },
        { onConflict: "proposta_id" },
      );
    return true;
  } catch {
    // Na dúvida, registra: perder um log é pior que gravar um repetido.
    return true;
  }
}

/** JSON com chaves ordenadas — o jsonb do banco não preserva a ordem da API. */
export function estavel(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return `[${v.map(estavel).join(",")}]`;
  if (typeof v === "object") {
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${estavel((v as any)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

/**
 * O valor novo é igual ao gravado? Números vindos do banco podem chegar como
 * texto (`numeric` → "24000"), então primitivos comparam pelo texto; objetos
 * (jsonb) comparam por conteúdo, sem depender da ordem das chaves.
 */
export function mesmoValor(atual: unknown, novo: unknown): boolean {
  const vazio = (x: unknown) => x === null || x === undefined || x === "";
  if (vazio(atual) && vazio(novo)) return true;
  if (typeof novo === "object" || typeof atual === "object")
    return estavel(atual) === estavel(novo);
  if (typeof novo === "number" || typeof atual === "number") {
    const a = Number(atual);
    const b = Number(novo);
    if (Number.isFinite(a) && Number.isFinite(b)) return a === b;
  }
  return String(atual) === String(novo);
}

/** Só os campos do patch que mudam algo em relação à linha atual. */
export function camposQueMudam(
  atual: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (!mesmoValor(atual?.[k], v)) out[k] = v;
  }
  return out;
}
