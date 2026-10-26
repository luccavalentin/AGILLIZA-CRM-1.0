import { Copy, Landmark } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Chave Pix da Agilliza (CNPJ) quando a configuração das matrículas ainda não tem uma. */
export const PIX_AGILLIZA = "51.306.419/0001-07";

/** Faixa com o Pix para quem pediu a matrícula pagar a Agilliza (vem da configuração). */
export function PixBanner({ chave, titular }: { chave?: string | null; titular?: string | null }) {
  const pix = chave?.trim() || PIX_AGILLIZA;
  function copiar() {
    navigator.clipboard
      .writeText(pix)
      .then(() => toast.success("Chave Pix copiada."))
      .catch(() => toast.error("Não consegui copiar. Selecione a chave e copie."));
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Landmark className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Pix para pagar a Agilliza</p>
          <p className="truncate font-semibold tabular-nums text-foreground">{pix}</p>
          <p className="truncate text-xs text-muted-foreground">
            {titular?.trim() || "Agilliza"} · quem pediu a matrícula paga por aqui
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={copiar}>
        <Copy className="mr-1 h-4 w-4" /> Copiar chave
      </Button>
    </div>
  );
}
