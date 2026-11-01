import { createFileRoute, Link } from "@tanstack/react-router";
import { UserX } from "lucide-react";

/**
 * Página pública de exclusão de conta, exigida pela App Store e pelo Google Play.
 * O pedido é atendido pela equipe, porque a conta pode ter propostas e documentos
 * que precisam ser mantidos por obrigação legal.
 */
export const Route = createFileRoute("/excluir-conta")({
  head: () => ({
    meta: [
      { title: "Excluir minha conta — Agilliza" },
      {
        name: "description",
        content: "Como solicitar a exclusão da sua conta Agilliza e dos dados pessoais associados.",
      },
      { name: "theme-color", content: "#000f9f" },
    ],
  }),
  component: ExcluirConta,
});

const EMAIL_ATENDIMENTO = "luccasantana88@gmail.com";

function ExcluirConta() {
  const assunto = encodeURIComponent("Excluir minha conta Agilliza");
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="bg-primary px-4 py-6 text-primary-foreground">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
          <UserX className="h-7 w-7 shrink-0" aria-hidden />
          <h1 className="text-xl font-semibold leading-tight">Excluir minha conta Agilliza</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-8 text-sm leading-relaxed text-muted-foreground">
        <p>
          Você pode solicitar a exclusão da sua conta e dos dados pessoais associados. Envie o
          pedido a partir do e-mail cadastrado na conta, para confirmarmos que é você.
        </p>
        <a
          href={`mailto:${EMAIL_ATENDIMENTO}?subject=${assunto}`}
          className="inline-flex min-h-11 max-w-full items-center break-all rounded-lg bg-primary px-5 font-semibold text-primary-foreground"
        >
          {EMAIL_ATENDIMENTO}
        </a>
        <p>
          O pedido inclui seus dados de perfil e de acesso. Documentos e registros que precisem ser
          mantidos por obrigação legal, execução de contratos ou prevenção de fraude são avaliados
          pela equipe, que informa o motivo e o prazo de retenção na resposta. Dados de outros
          usuários da mesma empresa não são excluídos por este pedido.
        </p>
        <p>
          <Link to="/politica-de-privacidade" className="text-primary underline">
            Política de Privacidade
          </Link>
        </p>
      </main>
    </div>
  );
}
