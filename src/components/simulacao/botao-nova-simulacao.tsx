import { useRouter } from "@tanstack/react-router";
import { CopyPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Substitui o "Reenviar" dos bancos que falharam.
 *
 * Reenviar repete o envio DENTRO da mesma oportunidade da HomeFin. Quando o
 * banco falha nela — sobretudo o Santander com "o provedor não registrou o
 * envio" —, as tentativas seguintes na mesma oportunidade falham igual: em
 * 16/09 um cliente teve 21 tentativas presas numa oportunidade e nenhuma foi
 * despachada; a primeira simulação nova, em oportunidade nova, respondeu na
 * hora.
 *
 * Este botão abre uma simulação nova com os mesmos dados (o mesmo fluxo de
 * "Duplicar"/"Editar", que não herda a oportunidade nem os ids no provedor).
 * O operador revisa e envia — e pode aproveitar para ajustar o que o banco
 * recusou.
 */
export function BotaoNovaSimulacao({
  simulacaoId,
  variante = "padrao",
  className,
}: {
  simulacaoId: string;
  /** `padrao`: ícone + texto. `compacto`: menor, para tabelas. `icone`: só ícone. */
  variante?: "padrao" | "compacto" | "icone";
  className?: string;
}) {
  const router = useRouter();
  const titulo =
    "Gera uma nova simulação com os mesmos dados, em oportunidade nova. " +
    "Reenviar na mesma oportunidade não resolve quando o banco falha.";
  const abrir = () =>
    router.navigate({
      to: "/operacional/simulacoes/completa",
      search: { duplicar: simulacaoId },
    });

  if (variante === "icone") {
    return (
      <Button
        size="icon"
        variant="secondary"
        className={cn("h-8 w-8", className)}
        title={titulo}
        aria-label="Nova simulação"
        onClick={abrir}
      >
        <CopyPlus className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      className={cn(variante === "compacto" && "h-8 px-3 text-[11px]", className)}
      title={titulo}
      onClick={abrir}
    >
      <CopyPlus className={variante === "compacto" ? "mr-1.5 h-3 w-3" : "mr-1 h-4 w-4"} />
      Nova simulação
    </Button>
  );
}
