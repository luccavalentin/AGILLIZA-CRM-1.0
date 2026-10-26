import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Link2Off, Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { confirmarTrocaDeEmail } from "@/lib/conta/trocar-email.functions";

const TOKEN = /^[A-Za-z0-9_-]{20,200}$/;

/**
 * Destino do link enviado ao e-mail NOVO na troca do e-mail de acesso (02/11/2026):
 * /confirmar-email?token=… Pública (a pessoa pode estar deslogada). Confirma só pelo botão:
 * o filtro de um provedor de e-mail que abre o link sozinho não troca nada.
 */
export const Route = createFileRoute("/confirmar-email")({
  validateSearch: (s: Record<string, unknown>): { token?: string } => ({
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Confirmar novo e-mail — Agilliza" },
      { name: "robots", content: "noindex" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  const { token } = Route.useSearch();
  const valido = typeof token === "string" && TOKEN.test(token);
  const confirmarFn = useServerFn(confirmarTrocaDeEmail);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<
    { ok: true; email: string | null } | { ok: false; mensagem: string; linkRuim: boolean } | null
  >(null);

  async function confirmar() {
    if (!valido || enviando) return;
    setEnviando(true);
    try {
      const r = await confirmarFn({ data: { token } });
      if (r.ok) {
        // As sessões do Auth foram encerradas no servidor; a deste navegador sai também.
        await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      }
      setResultado(r);
    } catch {
      setResultado({
        ok: false,
        mensagem: "Não foi possível confirmar agora. Tente de novo em alguns instantes.",
        linkRuim: false,
      });
    } finally {
      setEnviando(false);
    }
  }

  const linkRuim = !valido || (resultado && !resultado.ok && resultado.linkRuim);

  return (
    <AuthSplitLayout
      portalNome="Portal do Correspondente"
      portalDescricao="Confirme o seu novo e-mail de acesso."
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {resultado?.ok ? <ShieldCheck className="size-5" /> : <MailCheck className="size-5" />}
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-foreground">
              {resultado?.ok ? "E-mail de acesso trocado" : "Confirmar novo e-mail"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {resultado?.ok
                ? "Entre de novo com o e-mail novo e a sua senha de sempre."
                : "Este endereço passa a ser o login da sua conta no Agilliza."}
            </p>
          </div>
        </div>

        {resultado?.ok ? (
          <>
            <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm">
              Daqui em diante, o login é{" "}
              <strong className="break-all">{resultado.email ?? "o e-mail novo"}</strong>. Por
              segurança, encerramos as sessões abertas em todos os aparelhos.
            </p>
            <Button asChild className="w-full">
              <Link to="/auth">Entrar com o e-mail novo</Link>
            </Button>
          </>
        ) : !valido ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400"
          >
            <Link2Off className="mt-0.5 size-4 shrink-0" />
            Este link está incompleto ou foi copiado pela metade. Abra de novo pelo botão do e-mail.
          </p>
        ) : (
          <>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>O login da sua conta passa a ser este e-mail.</li>
              <li>Senha, nível e permissões continuam os mesmos.</li>
              <li>Todos os aparelhos são desconectados e o e-mail antigo é avisado.</li>
            </ul>
            {resultado && !resultado.ok && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              >
                {resultado.linkRuim && <Link2Off className="mt-0.5 size-4 shrink-0" />}
                {resultado.mensagem}
              </p>
            )}
            {!linkRuim && (
              <Button onClick={confirmar} disabled={enviando} className="w-full">
                {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar novo e-mail
              </Button>
            )}
          </>
        )}

        {!resultado?.ok && (
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Voltar para o login
          </Link>
        )}
      </div>
    </AuthSplitLayout>
  );
}
