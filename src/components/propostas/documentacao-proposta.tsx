import { lazy, Suspense, useState } from "react";
import { DocumentacaoBadge } from "@/components/propostas/documentacao-badge";
import type { SituacaoDocumentacao } from "@/lib/propostas/documentacao-status";

const ComentariosPropostaDialog = lazy(() =>
  import("@/components/proposta/comentarios-proposta-dialog").then((m) => ({
    default: m.ComentariosPropostaDialog,
  })),
);

/**
 * Selo da documentação que abre os comentários da proposta ao clicar — o
 * mesmo em qualquer tela (consulta de propostas, CRM, ficha).
 */
export function DocumentacaoProposta({
  propostaId,
  situacao,
  centralizado,
  className,
}: {
  propostaId: string;
  situacao: SituacaoDocumentacao | null | undefined;
  centralizado?: boolean;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  if (!situacao) return null;
  return (
    // A janela abre por portal, mas os cliques dentro dela ainda sobem pela
    // árvore do React até a linha/card, que abrem a proposta. Param aqui.
    <span className="contents" onClick={(e) => e.stopPropagation()}>
      <DocumentacaoBadge
        situacao={situacao}
        onVerComentarios={() => setAberto(true)}
        centralizado={centralizado}
        className={className}
      />
      {aberto && (
        <Suspense fallback={null}>
          <ComentariosPropostaDialog
            open={aberto}
            onOpenChange={setAberto}
            propostaId={propostaId}
          />
        </Suspense>
      )}
    </span>
  );
}
