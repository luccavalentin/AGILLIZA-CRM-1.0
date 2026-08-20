import { ArrowLeft, MessagesSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChatClienteTab } from "@/components/crm/chat-cliente-tab";
import { ChatParticipantes } from "@/components/crm/chat-participantes";
import type { UseChatConversas } from "./use-chat-conversas";

type Props = {
  hook: UseChatConversas;
  acoes: React.ReactNode;
};

/**
 * Coluna central do Chat CRM: cabeçalho mobile "Voltar", chat + follow-up
 * do cliente e placeholder quando nada está selecionado. Puramente
 * apresentacional — a máquina de estados (leitura/gestão, atendente
 * atual) segue vindo do hook `useChatConversas`.
 */
export function PainelChat({ hook, acoes }: Props) {
  const { alvoAtual, selecionado, setSelecionado } = hook;

  return (
    <div
      className={cn(
        "min-h-0 min-w-0 flex-col overflow-hidden",
        selecionado ? "flex" : "hidden lg:flex",
      )}
    >
      <button
        type="button"
        onClick={() => setSelecionado(null)}
        className="mb-2 inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground lg:hidden"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar às conversas
      </button>
      {alvoAtual ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
          {(() => {
            // Só é leitura quando a thread não é minha e eu não fui incluído
            // como participante. Convidados conversam na mesma conversa.
            const somenteLeitura = !alvoAtual.minha && !alvoAtual.participo;
            const podeGerir = !somenteLeitura && !!alvoAtual.atendente_id;
            return (
              <>
                {podeGerir && (
                  <div className="flex shrink-0 justify-end">
                    <ChatParticipantes
                      clienteId={alvoAtual.cliente_id}
                      atendenteId={alvoAtual.atendente_id!}
                    />
                  </div>
                )}
                <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                  <ChatClienteTab
                    key={`${alvoAtual.cliente_id}::${alvoAtual.atendente_id ?? ""}`}
                    clienteId={alvoAtual.cliente_id}
                    atendenteId={alvoAtual.atendente_id ?? undefined}
                    somenteLeitura={somenteLeitura}
                    atendenteNome={alvoAtual.atendente_nome ?? undefined}
                    acoes={acoes}
                    info={{
                      nome: alvoAtual.nome,
                      documento: alvoAtual.documento,
                      contexto: alvoAtual.etapa_nome ?? undefined,
                    }}
                  />
                </div>
              </>
            );
          })()}
        </div>
      ) : (
        <Card className="flex h-full min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-4 border-dashed border-border/60 p-8 text-center shadow-sm">
          <div className="relative flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
            <MessagesSquare className="h-7 w-7" strokeWidth={1.75} />
            <span className="absolute inset-0 -z-10 rounded-2xl bg-primary/5 blur-xl" aria-hidden />
          </div>
          <div className="max-w-[18rem] space-y-1.5">
            <p className="text-sm font-semibold text-foreground">Nenhuma conversa aberta</p>
            <p className="text-xs text-muted-foreground">
              Selecione uma conversa ao lado ou busque um cliente para começar o atendimento.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
