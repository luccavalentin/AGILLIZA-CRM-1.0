import { Send } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { corDoBanco } from "@/lib/bancos/cores";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/simulacao/format";

export type PropostaCriada = {
  simulacao_banco_id: string;
  banco_id: string;
  nome_banco: string;
  proposta_id: string;
  numero: string;
};

export type EnvioEstado = {
  id: string;
  numero: string;
  bancos: any[];
};

export function EnviarPropostaDialog({
  envio,
  onClose,
  carregando,
  enviandoBancoId,
  propostasCriadas,
  onEnviarBanco,
}: {
  envio: EnvioEstado | null;
  onClose: () => void;
  carregando: boolean;
  enviandoBancoId: string | null;
  propostasCriadas: PropostaCriada[];
  onEnviarBanco: (banco: any) => void;
}) {
  const router = useRouter();

  return (
    <Dialog open={!!envio} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar proposta</DialogTitle>
          <DialogDescription>
            Envie a proposta{" "}
            {envio?.numero ? `da simulação ${envio.numero}` : ""} para cada banco individualmente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {carregando ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Carregando bancos…</p>
          ) : (envio?.bancos.length ?? 0) === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum banco simulado disponível para envio.
            </p>
          ) : (
            envio?.bancos.map((b: any) => {
              const criada = propostasCriadas.find((p) => p.simulacao_banco_id === b.id);
              const esteEnviando = enviandoBancoId === b.id;
              const cor = corDoBanco(b.nome_banco);
              // Prioriza o sistema REQUISITADO na simulação. O retorno da API
              // (sistema_amortizacao_banco) é usado só como fallback porque o
              // Santander devolve "SAC" mesmo em simulações executadas em PRICE.
              const req = String(b.sistema_amortizacao ?? "").toUpperCase();
              const api = String(b.sistema_amortizacao_banco ?? "").toUpperCase();
              const sis =
                req === "P" || req.includes("PRICE")
                  ? "PRICE"
                  : req === "S" || req.includes("SAC")
                    ? "SAC"
                    : api === "P" || api.includes("PRICE")
                      ? "PRICE"
                      : api === "S" || api.includes("SAC")
                        ? "SAC"
                        : null;
              return (
                <div
                  key={b.id}
                  style={criada ? { borderColor: cor } : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors",
                    criada ? "border-2" : "border-border",
                  )}
                >
                  <BancoLogo nome={b.nome_banco} size="lg" className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                        {b.nome_banco}
                      </span>
                      {sis && (
                        <span className="inline-flex h-5 shrink-0 items-center rounded-[5px] border border-primary/25 bg-primary/[0.08] px-1.5 text-[9px] font-semibold uppercase leading-none tracking-wide text-primary">
                          {sis}
                        </span>
                      )}
                    </span>
                    {b.valor_parcela != null && (
                      <span className="block text-xs text-muted-foreground">
                        Parcela {formatBRL(b.valor_parcela)}
                      </span>
                    )}
                  </span>
                  {criada ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onClose();
                        router.navigate({
                          to: "/operacional/propostas/$id",
                          params: { id: criada.proposta_id },
                          search: { complementar: 1 },
                        });
                      }}
                    >
                      Abrir {criada.numero}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => onEnviarBanco(b)}
                      disabled={!!enviandoBancoId}
                    >
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                      {esteEnviando ? "Enviando…" : "Enviar"}
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={!!enviandoBancoId}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
