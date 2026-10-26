import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { getPortalNovoParceiro } from "@/lib/parceiro/portal-novo.functions";

/**
 * Convite do portal antigo do parceiro para o portal novo (C70). O portal antigo continua
 * funcionando para quem ainda não migrou; este aviso só convida.
 */
export function AvisoPortalNovo() {
  const q = useQuery({
    queryKey: ["parceiro-portal-novo"],
    queryFn: () => getPortalNovoParceiro(),
    staleTime: 5 * 60_000,
  });
  if (!q.data) return null;
  const { convertido, urlEntrar } = q.data;

  return (
    <section className="relative mb-6 overflow-hidden rounded-xl border border-primary/20 bg-primary/[0.04] p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_6px_16px_-6px_rgba(0,15,159,0.55)]">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-foreground">
              {convertido ? "Seu acesso ao portal novo está pronto" : "O portal do parceiro está de casa nova"}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {convertido
                ? "Você recebeu um e-mail para criar a senha do Agilliza Tech: CRM completo, simulações e propostas direto com a nossa operação, sem mensalidade. Este portal continua funcionando enquanto você muda."
                : "Agora os parceiros do correspondente usam o Agilliza Tech: CRM completo, simulações e propostas direto com a nossa operação, sem mensalidade. Peça o seu acesso ao seu contato no correspondente."}
            </p>
          </div>
        </div>
        {convertido && (
          <a
            href={urlEntrar}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Entrar no portal novo <ArrowUpRight className="size-4" />
          </a>
        )}
      </div>
    </section>
  );
}
