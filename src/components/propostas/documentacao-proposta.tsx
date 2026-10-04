import { lazy, Suspense, useState } from "react";
import { DocumentacaoBadge } from "@/components/propostas/documentacao-badge";
import { useAvisoDeNovidade } from "@/lib/propostas/comentarios-vistos";
import type { SituacaoDocumentacao } from "@/lib/propostas/documentacao-status";

const ComentariosPropostaDialog = lazy(() =>
  import("@/components/proposta/comentarios-proposta-dialog").then((m) => ({
    default: m.ComentariosPropostaDialog,
  })),
);

/**
 * Selo da documentação que abre os comentários da proposta ao clicar — o
 * mesmo em qualquer tela (consulta de propostas, CRM, ficha).
 *
 * Pisca enquanto houver decisão de documento da HomeFin mais nova que a última
 * leitura desta pessoa — `naoLido` vem pronto do servidor. Quem marca como
 * lido é a própria janela de comentários, ao abrir, para valer também quando
 * ela é aberta pelo menu "⋯" da lista, sem passar por aqui.
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
  const avisar = useAvisoDeNovidade(propostaId, situacao?.naoLido);
  if (!situacao) return null;
  return (
    // A janela abre por portal, mas os cliques dentro dela ainda sobem pela
    // árvore do React até a linha/card, que abrem a proposta. Param aqui.
    <span className="contents" onClick={(e) => e.stopPropagation()}>
      <DocumentacaoBadge
        situacao={situacao}
        onVerComentarios={() => setAberto(true)}
        piscando={avisar}
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
