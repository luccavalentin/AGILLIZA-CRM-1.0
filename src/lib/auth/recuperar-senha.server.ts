/**
 * "Esqueci minha senha" — SÓ SERVIDOR (defeito de produção de 30/10/2026).
 *
 * Antes a tela chamava `supabase.auth.resetPasswordForEmail`, que manda pelo SMTP do Auth —
 * em produção, o carteiro de TESTE (supabase-mail:2500): nenhum e-mail saía. Agora o link
 * de recuperação é gerado aqui (`auth.admin.generateLink`, que NÃO troca a senha: ela só muda
 * quando a pessoa clica e escolhe outra) e vai pelo e-mail da plataforma (outbox + worker do
 * Corretor, migração 0560), o mesmo caminho da senha provisória.
 *
 * Regras:
 *   · a resposta é SEMPRE a mesma frase, exista a conta ou não, e leva no mínimo o mesmo
 *     tempo (sem pista pelo relógio);
 *   · os freios (por e-mail e por IP) e o perfil (ativo, com login e e-mail) são do banco;
 *   · o e-mail digitado e o link nunca vão para o log.
 *
 * Carregar só por import dinâmico dentro do handler da server function.
 */
import { isIP } from "node:net";

export const RESPOSTA_RECUPERACAO =
  "Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha. Confira também a caixa de spam.";

/** A resposta leva pelo menos isto: quem tem conta e quem não tem esperam o mesmo. */
const TEMPO_MINIMO_MS = 1200;

const AGILLIZA_PADRAO = "https://crm.agillizatech.com.br";

/** E-mail como o banco compara: minúsculo, sem espaços nas pontas. `null` se não é e-mail. */
export function normalizarEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  if (e.length < 6 || e.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return null;
  return e;
}

/** Endereço do Agilliza para onde o link volta (https, ou http só na própria máquina). */
export function enderecoDoAgilliza(): string {
  const bruto = (process.env.VITE_SITE_URL ?? "").trim();
  try {
    const u = new URL(bruto);
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol === "https:" || (u.protocol === "http:" && local)) {
      return `${u.protocol}//${u.host}`;
    }
  } catch {
    /* vazio ou inválido: o padrão */
  }
  return AGILLIZA_PADRAO;
}

/** Nome do erro para o log — nunca a mensagem (pode ecoar o e-mail). */
function rotuloDoErro(e: unknown): string {
  const err = e as { code?: unknown; status?: unknown; name?: unknown } | null;
  return String(err?.code ?? err?.status ?? err?.name ?? "erro");
}

async function tentarEnviar(email: string, ip: string | null): Promise<void> {
  const ponte = await import("@/lib/plataforma/ponte.server");
  const pedido = await ponte.pedirRecuperacaoNaPlataforma(email, ip);
  if (pedido.situacao !== "enviar" || !pedido.authUid) {
    if (pedido.situacao !== "sem_conta") {
      console.info("[recuperar-senha] pedido sem envio:", pedido.situacao);
    }
    return;
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
    // `recuperar=1`: a tela /auth sabe que a sessão que chega é de recuperação e pede a senha nova.
    options: { redirectTo: `${enderecoDoAgilliza()}/auth?recuperar=1` },
  });
  const link = data?.properties?.action_link;
  if (error || !link) {
    console.error("[recuperar-senha] link não gerado:", error ? rotuloDoErro(error) : "sem link");
    return;
  }
  // O Auth achou outra pessoa pelo e-mail (perfil e login com e-mails diferentes): não manda.
  if (data.user?.id !== pedido.authUid) {
    console.error("[recuperar-senha] link não enviado: a pessoa do Auth não é a do perfil");
    return;
  }
  await ponte.enviarLinkDeRecuperacao(pedido.authUid, link);
}

/**
 * Atende o pedido da tela. Nunca lança: qualquer falha vira a mesma resposta (e um log
 * sem dado pessoal).
 */
export async function pedirRecuperacao(
  entrada: { email: unknown; ip: string | null },
  opcoes: { tempoMinimoMs?: number } = {},
): Promise<{ ok: true; mensagem: string }> {
  const inicio = Date.now();
  try {
    const email = normalizarEmail(entrada.email);
    if (email) {
      const ip = entrada.ip && isIP(entrada.ip.trim()) ? entrada.ip.trim() : null;
      await tentarEnviar(email, ip);
    }
  } catch (e) {
    console.error("[recuperar-senha] falha:", rotuloDoErro(e));
  }
  const falta = (opcoes.tempoMinimoMs ?? TEMPO_MINIMO_MS) - (Date.now() - inicio);
  if (falta > 0) await new Promise((r) => setTimeout(r, falta));
  return { ok: true, mensagem: RESPOSTA_RECUPERACAO };
}
