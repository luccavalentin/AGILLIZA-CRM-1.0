import { Loader2, Ban, CheckCircle2, XCircle, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { corDoBanco } from "@/lib/bancos/cores";
import { numeroBancoParaExibir } from "@/lib/propostas/numero-banco-display";
import { SITUACOES_BANCO } from "@/lib/propostas/propostas.functions";

type SituacaoBanco = (typeof SITUACOES_BANCO)[number];

export function DetalhamentoBancoDialog({
  banco,
  onClose,
}: {
  banco: any | null;
  onClose: () => void;
}) {
  const situacao = (banco?.situacao_banco as SituacaoBanco) ?? "nao_enviado";

  const conteudo: Record<
    SituacaoBanco,
    { icone: React.ReactNode; titulo: string; mensagem: string }
  > = {
    nao_enviado: {
      icone: <Info className="h-6 w-6 text-muted-foreground" />,
      titulo: "Proposta ainda não enviada",
      mensagem:
        "Esta proposta ainda não foi enviada ao banco. Envie-a para acompanhar a análise de crédito.",
    },
    em_analise: {
      icone: <Loader2 className="h-6 w-6 text-info" />,
      titulo: "Em análise de crédito",
      mensagem:
        "O banco está analisando a proposta. Assim que houver um retorno, o detalhamento será atualizado aqui.",
    },
    condicionado: {
      icone: <CheckCircle2 className="h-6 w-6 text-warning" />,
      titulo: "Aprovado com condições",
      mensagem:
        "O crédito foi aprovado, mas o banco estabeleceu condições. Confira abaixo as observações enviadas pelo banco.",
    },
    aprovado: {
      icone: <CheckCircle2 className="h-6 w-6 text-success" />,
      titulo: "Parabéns! Crédito aprovado 🎉",
      mensagem:
        "O banco aprovou o crédito desta proposta. Prossiga com as próximas etapas para dar sequência ao financiamento.",
    },
    recusado: {
      icone: <XCircle className="h-6 w-6 text-destructive" />,
      titulo: "Crédito recusado",
      mensagem: "Infelizmente o banco recusou o crédito.",
    },
    cancelado: {
      icone: <Ban className="h-6 w-6 text-muted-foreground" />,
      titulo: "Proposta cancelada",
      mensagem: "Esta proposta foi cancelada neste banco.",
    },
  };

  const info = conteudo[situacao];

  return (
    <Dialog open={banco !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {info?.icone}
            {info?.titulo}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {banco?.nome_banco && (
            <p
              className="flex items-center gap-2 font-medium"
              style={{ color: corDoBanco(banco.nome_banco) }}
            >
              <BancoLogo nome={banco.nome_banco} size="md" className="shrink-0" />
              {banco.nome_banco}
            </p>
          )}
          <p className="text-muted-foreground">{info?.mensagem}</p>
          {banco?.mensagem_banco && (
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Retorno do banco</p>
              <p className="whitespace-pre-wrap text-foreground">{banco.mensagem_banco}</p>
            </div>
          )}
          {(() => {
            const nb = numeroBancoParaExibir(banco?.numero_proposta_banco);
            return nb ? (
              <p className="text-xs text-muted-foreground">Nº oficial da proposta no banco: {nb}</p>
            ) : null;
          })()}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
