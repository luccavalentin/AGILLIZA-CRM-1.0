import { lazy, Suspense, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { ExternalLink, FileCheck2, ListChecks, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { bancoPermiteCarta } from "@/lib/propostas/carta-analise/dados";
import { podeContinuarProposta } from "@/lib/propostas/state-machine";

const CartaAnaliseDialog = lazy(() =>
  import("@/components/proposta/carta-analise-dialog").then((m) => ({
    default: m.CartaAnaliseDialog,
  })),
);

/** Menu "⋯" de cada proposta na lista. */
export function MenuAcoesProposta({
  propostaId,
  status,
  bancos,
}: {
  propostaId: string;
  status: string | null | undefined;
  bancos: { nome_banco: string | null; status_banco: string | null }[] | null | undefined;
}) {
  const router = useRouter();
  const [cartaAberta, setCartaAberta] = useState(false);
  const temAprovacao = (bancos ?? []).some((b) => bancoPermiteCarta(b));
  // Só crédito aprovado/condicionado (e as etapas seguintes) seguem pelo fluxo.
  const podeContinuar = podeContinuarProposta(status, bancos);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Mais ações">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem
            onSelect={() =>
              router.navigate({ to: "/operacional/propostas/$id", params: { id: propostaId } })
            }
          >
            <ExternalLink className="mr-2 h-4 w-4" /> Abrir proposta
          </DropdownMenuItem>
          {podeContinuar && (
            <DropdownMenuItem
              onSelect={() =>
                router.navigate({
                  to: "/operacional/propostas/$id/continuar",
                  params: { id: propostaId },
                })
              }
            >
              <ListChecks className="mr-2 h-4 w-4" />
              <div className="flex flex-col">
                <span>Continuar proposta</span>
                <span className="text-[11px] text-muted-foreground">
                  Conferir dados e enviar documentos
                </span>
              </div>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem disabled={!temAprovacao} onSelect={() => setCartaAberta(true)}>
            <FileCheck2 className="mr-2 h-4 w-4" />
            <div className="flex flex-col">
              <span>Baixar carta de análise</span>
              {!temAprovacao && (
                <span className="text-[11px] text-muted-foreground">
                  Disponível após aprovação do banco
                </span>
              )}
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {cartaAberta && (
        <Suspense fallback={null}>
          <CartaAnaliseDialog
            open={cartaAberta}
            onOpenChange={setCartaAberta}
            propostaId={propostaId}
          />
        </Suspense>
      )}
    </>
  );
}
