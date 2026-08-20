import { Copy, Landmark } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Chave Pix fixa da Agilliza (CNPJ), exposta para copiar e colar. */
export const PIX_AGILLIZA = "51.306.419/0001-07";

/** Faixa azul com o Pix da Agilliza, apenas para copiar. */
export function PixBanner() {
  function copiar() {
    navigator.clipboard.writeText(PIX_AGILLIZA);
    toast.success("Chave Pix copiada.");
  }

  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary to-primary/80 p-0 text-primary-foreground shadow-lg">
      <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-primary-foreground/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-primary-foreground/10 blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-foreground/15 p-2.5 ring-1 ring-primary-foreground/20">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide opacity-80">Segue o Pix da Agilliza</p>
            <p className="text-lg font-semibold tabular-nums">{PIX_AGILLIZA}</p>
            <p className="text-xs opacity-80">
              Chave CNPJ — os corretores usam para reembolsar a Agilliza.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={copiar}>
            <Copy className="mr-1 h-4 w-4" /> Copiar chave
          </Button>
        </div>
      </div>
    </Card>
  );
}
