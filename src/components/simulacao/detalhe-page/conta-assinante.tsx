import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Network, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { levarSimulacaoParaConta } from "@/lib/plataforma/simulacao-na-conta.functions";

/**
 * Simulação feita para a conta de um assinante (C29): selo "Feita para <conta>" e, se a cópia na
 * conta não nasceu (a ponte estava fora, por exemplo), "Levar à conta de novo".
 */
export function ContaAssinanteDaSimulacao({
  s,
}: {
  s: {
    id: string;
    conta_assinante_id?: string | null;
    conta_assinante_nome?: string | null;
    conta_assinante_simulacao_id?: string | null;
  };
}) {
  const pode = usePermissao("saas.contas", "edit"); // eco-aud: grava na conta do assinante
  const qc = useQueryClient();
  const levarFn = useServerFn(levarSimulacaoParaConta);
  const [levando, setLevando] = useState(false);
  if (!s.conta_assinante_id) return null;
  const nome = s.conta_assinante_nome || "assinante";
  const pendente = !s.conta_assinante_simulacao_id;

  async function levar() {
    setLevando(true);
    try {
      const r = await levarFn({ data: { simulacaoId: s.id } });
      toast.success(r.mensagem);
      qc.invalidateQueries({ queryKey: ["simulacao", s.id] });
    } catch (e) {
      toast.error(mensagemDeErro(e, `Não foi possível levar a simulação à conta de ${nome}.`));
    } finally {
      setLevando(false);
    }
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <span
        className="inline-flex max-w-full items-center gap-1.5 truncate rounded-md bg-primary/8 px-2 py-0.5 text-[11px] font-semibold text-primary ring-1 ring-inset ring-primary/15"
        title={pendente ? "A cópia na conta ainda não foi criada." : "A simulação também está na carteira da conta."}
      >
        <Network className="size-3 shrink-0" />
        <span className="truncate">Feita para {nome}</span>
      </span>
      {pendente && (
        <>
          <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
            ainda não chegou à conta
          </span>
          {pode && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-[11px]"
              onClick={levar}
              disabled={levando}
            >
              {levando ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
              Levar à conta de novo
            </Button>
          )}
        </>
      )}
    </div>
  );
}
