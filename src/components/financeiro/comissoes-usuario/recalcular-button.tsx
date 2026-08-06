import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { recalcularComissoesUsuario } from "@/lib/financeiro/comissoes-usuario.functions";

/**
 * Ação de destaque para reprocessar as comissões de todos os usuários a partir
 * das regras e das etapas atuais das propostas. Fica disponível tanto na aba de
 * regras quanto na de lançamentos.
 */
export function RecalcularComissoesButton({ className }: { className?: string }) {
  const qc = useQueryClient();

  const recalcular = useMutation({
    mutationFn: () => recalcularComissoesUsuario({ data: {} } as never),
    onSuccess: (r: any) => {
      toast.success(
        r?.criados
          ? `${r.criados} comissão(ões) gerada(s) a partir das etapas atuais.`
          : "Nenhuma comissão pendente: tudo já está computado.",
      );
      qc.invalidateQueries({ queryKey: ["fin-com-usr"] });
      qc.invalidateQueries({ queryKey: ["fin-com-usr-lanc"] });
      qc.invalidateQueries({ queryKey: ["fin-com-usr-regras"] });
      qc.invalidateQueries({ queryKey: ["fin-com-usr-resumo"] });
      qc.invalidateQueries({ queryKey: ["fin-contas"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao recalcular."),
  });

  return (
    <button
      type="button"
      onClick={() => recalcular.mutate()}
      disabled={recalcular.isPending}
      className={cn(
        "group relative inline-flex items-center gap-2.5 overflow-hidden rounded-xl px-4 py-2.5",
        "bg-gradient-to-r from-primary via-primary to-primary/80 text-primary-foreground",
        "text-sm font-semibold shadow-lg shadow-primary/25 ring-1 ring-inset ring-white/10",
        "transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/35",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        "disabled:pointer-events-none disabled:opacity-70",
        className,
      )}
    >
      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      <span className="relative grid size-6 place-items-center rounded-lg bg-white/15">
        {recalcular.isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RefreshCw className="size-3.5 transition-transform duration-500 group-hover:rotate-180" />
        )}
      </span>
      <span className="relative">
        {recalcular.isPending ? "Recalculando…" : "Recalcular comissões"}
      </span>
    </button>
  );
}
