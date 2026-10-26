/**
 * Trocar o e-mail de ACESSO (login) pela própria pessoa — SÓ SERVIDOR (02/11/2026).
 *
 * O SMTP do Auth em produção é o carteiro de TESTE: `updateUser({ email })` mandaria a
 * confirmação para lugar nenhum. Aqui o fluxo é o da plataforma (0601 do Corretor):
 *   1. a senha atual é conferida no Auth (um cliente descartável, sem guardar sessão);
 *   2. o banco freia, recusa e-mail em uso, gera o token e põe na fila o link (ao e-mail NOVO)
 *      e o aviso (ao ANTIGO) — o worker do Corretor manda;
 *   3. pelo link (`/confirmar-email`), com ou sem sessão: o banco reserva a troca, o Auth
 *      recebe o e-mail novo (`auth.admin.updateUserById`), o perfil também, o banco conclui
 *      (avisa o antigo e liga a cópia das senhas provisórias por 72 h, 0498) e TODAS as
 *      sessões do Auth são encerradas.
 * Papel, nível e correspondente não mudam. O e-mail e o token nunca vão para o log.
 *
 * Carregar só por import dinâmico dentro do handler da server function.
 */
import { isIP } from "node:net";
import { enderecoDoAgilliza, normalizarEmail } from "@/lib/auth/recuperar-senha.server";
import type { SituacaoTrocaEmail } from "@/lib/plataforma/ponte.server";

export type RespostaTroca = { ok: boolean; mensagem: string };

const AGUARDE = "Muitos pedidos de troca em pouco tempo. Aguarde uma hora e tente de novo.";

/** A frase de cada resposta do banco. "Em uso" é neutra: não diz de quem é o endereço. */
export const MENSAGENS_TROCA: Record<SituacaoTrocaEmail, RespostaTroca> = {
  enviado: {
    ok: true,
    mensagem:
      "Enviamos um link para o e-mail novo. A troca só acontece quando você abrir esse link (vale 24 horas). Avisamos também o e-mail atual.",
  },
  senha_errada: { ok: false, mensagem: "A senha atual não confere." },
  email_invalido: { ok: false, mensagem: "Informe um e-mail válido." },
  mesmo_email: { ok: false, mensagem: "Este já é o seu e-mail de acesso." },
  email_em_uso: {
    ok: false,
    mensagem: "Não é possível usar este e-mail como acesso. Escolha outro endereço.",
  },
  freio_usuario: { ok: false, mensagem: AGUARDE },
  freio_ip: { ok: false, mensagem: AGUARDE },
};

/** Nome do erro para o log — nunca a mensagem (pode ecoar o e-mail). */
function rotuloDoErro(e: unknown): string {
  const err = e as { code?: unknown; status?: unknown; name?: unknown } | null;
  return String(err?.code ?? err?.status ?? err?.name ?? "erro");
}

/**
 * A senha atual confere? Entra no Auth com um cliente que não guarda nem renova sessão e
 * encerra SÓ a sessão que acabou de abrir (escopo local: as outras continuam).
 */
export async function senhaAtualConfere(
  authUid: string,
  email: string,
  senha: string,
): Promise<boolean> {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !chave || !senha) return false;
  const { createClient } = await import("@supabase/supabase-js");
  const { paraRedeInterna } = await import("@/integrations/supabase/rede-interna");
  const opaca = chave.startsWith("sb_publishable_") || chave.startsWith("sb_secret_");
  const cliente = createClient(url, chave, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (opaca && h.get("Authorization") === `Bearer ${chave}`) h.delete("Authorization");
        h.set("apikey", chave);
        return fetch(paraRedeInterna(input), { ...init, headers: h });
      },
    },
  });
  try {
    const { data, error } = await cliente.auth.signInWithPassword({ email, password: senha });
    if (error || !data.session) return false;
    await cliente.auth.signOut({ scope: "local" }).catch(() => undefined);
    return data.user?.id === authUid;
  } catch (e) {
    console.error("[trocar-email] conferência da senha:", rotuloDoErro(e));
    return false;
  }
}

/** Pedido da tela de Segurança. Lança só a frase do banco (pessoa sem acesso, sem ponte). */
export async function pedirTroca(p: {
  authUid: string;
  emailAtual: string | null;
  novo: unknown;
  senha: unknown;
  ip: string | null;
}): Promise<RespostaTroca> {
  const senha = typeof p.senha === "string" ? p.senha.slice(0, 256) : "";
  const bruto = typeof p.novo === "string" ? p.novo.trim().slice(0, 320) : "";
  if (!senha) return { ok: false, mensagem: "Informe a senha atual." };
  if (!normalizarEmail(bruto)) return MENSAGENS_TROCA.email_invalido;
  const atual = normalizarEmail(p.emailAtual);
  if (!atual) return { ok: false, mensagem: "Este acesso não entra com e-mail e senha." };

  const confere = await senhaAtualConfere(p.authUid, atual, senha);
  const ponte = await import("@/lib/plataforma/ponte.server");
  const situacao = await ponte.pedirTrocaDeEmailNaPlataforma({
    authUid: p.authUid,
    novo: bruto,
    senhaConfere: confere,
    ip: p.ip && isIP(p.ip.trim()) ? p.ip.trim() : null,
    endereco: enderecoDoAgilliza(),
  });
  return MENSAGENS_TROCA[situacao] ?? MENSAGENS_TROCA.email_invalido;
}

export type RespostaConfirmacao =
  { ok: true; email: string | null } | { ok: false; mensagem: string; linkRuim: boolean };

const LINK_RUIM: Record<string, string> = {
  invalido: "Este link já foi usado ou foi substituído por um pedido mais novo.",
  vencido: "Este link venceu (vale 24 horas). Peça a troca de novo em Segurança.",
  email_em_uso:
    "Não foi possível usar este e-mail como acesso. Peça a troca de novo com outro endereço.",
  concorrente:
    "O e-mail de acesso desta conta mudou depois do pedido. Se ainda quiser trocar, peça de novo em Segurança.",
};

/** Confirmação pelo link do e-mail novo. Nunca lança: qualquer falha vira frase para a tela. */
export async function confirmarTroca(token: unknown): Promise<RespostaConfirmacao> {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{20,200}$/.test(token)) {
    return {
      ok: false,
      mensagem: "Este link está incompleto. Abra de novo pelo botão do e-mail.",
      linkRuim: true,
    };
  }
  // A troca reservada e ainda não fechada: se algo falhar no meio, fecha como recusada
  // (senão ficaria presa em "confirmando" até um pedido novo).
  let reservada: string | null = null;
  const ponte = await import("@/lib/plataforma/ponte.server");
  try {
    const aberta = await ponte.abrirTrocaDeEmailNaPlataforma(token);
    if (aberta.situacao !== "ok" || !aberta.trocaId || !aberta.authUid || !aberta.emailNovo) {
      return {
        ok: false,
        mensagem: LINK_RUIM[aberta.situacao] ?? LINK_RUIM.invalido!,
        linkRuim: true,
      };
    }

    reservada = aberta.trocaId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(aberta.authUid, {
      email: aberta.emailNovo,
      email_confirm: true,
    });
    if (error) {
      const emUso = /already|exists|registered/i.test(error.message ?? "");
      console.error("[trocar-email] o Auth recusou o e-mail novo:", rotuloDoErro(error));
      reservada = null;
      await ponte.concluirTrocaDeEmailNaPlataforma(
        aberta.trocaId,
        false,
        emUso ? "email_em_uso" : "auth_recusou",
      );
      return {
        ok: false,
        mensagem: emUso
          ? LINK_RUIM.email_em_uso!
          : "Não foi possível concluir a troca agora. Peça de novo em Segurança.",
        linkRuim: true,
      };
    }

    const { error: erroPerfil } = await supabaseAdmin
      .from("profiles")
      .update({ email: aberta.emailNovo })
      .eq("id", aberta.authUid);
    if (erroPerfil)
      console.error("[trocar-email] perfil não atualizado:", rotuloDoErro(erroPerfil));

    reservada = null;
    const fim = await ponte.concluirTrocaDeEmailNaPlataforma(aberta.trocaId, true);

    // Todas as sessões do Auth (todos os aparelhos): entra de novo com o e-mail novo.
    const { error: erroSessoes } = await supabaseAdmin.rpc(
      "encerrar_sessoes_auth" as never,
      {
        _user_id: aberta.authUid,
      } as never,
    );
    if (erroSessoes)
      console.error("[trocar-email] sessões não encerradas:", rotuloDoErro(erroSessoes));

    return { ok: true, email: fim.emailMascarado };
  } catch (e) {
    console.error("[trocar-email] confirmação:", rotuloDoErro(e));
    if (reservada) {
      await ponte
        .concluirTrocaDeEmailNaPlataforma(reservada, false, "falha_no_servidor")
        .catch(() => undefined);
      return {
        ok: false,
        mensagem: "Não foi possível concluir a troca agora. Peça de novo em Segurança.",
        linkRuim: true,
      };
    }
    return {
      ok: false,
      mensagem: "Não foi possível confirmar agora. Tente de novo em alguns instantes.",
      linkRuim: false,
    };
  }
}
