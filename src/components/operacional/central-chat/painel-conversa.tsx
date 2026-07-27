import { Link } from "@tanstack/react-router";
import { ArrowLeft, Maximize2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  abrirChatFlutuante,
  abrirDemandaChatFlutuante,
  abrirDmFlutuante,
} from "@/components/shared/floating-chat-store";
import { ChatClienteConversa } from "@/components/crm/chat-cliente-tab";
import { DemandaChatConversa } from "@/components/operacional/demanda-chat";
import { DmConversa } from "@/components/operacional/central-chat/dm-conversa";
import { ConversaMenuAcoes } from "@/components/shared/conversa-menu-acoes";
import type { EstadoChat } from "@/lib/chats/gestao.functions";
import { chaveConversa, iniciais, type SelecionadoState } from "./helpers";

export function PainelConversa({
  selecionado,
  estadoPor,
  etiquetaPor,
  onVoltar,
}: {
  selecionado: NonNullable<SelecionadoState>;
  estadoPor: Map<string, EstadoChat>;
  etiquetaPor: Map<string, string[]>;
  onVoltar?: () => void;
}) {
  const BackBtn = onVoltar ? (
    <Button
      variant="ghost"
      size="icon"
      className="size-9 shrink-0 rounded-full lg:hidden"
      onClick={onVoltar}
      aria-label="Voltar para a lista"
    >
      <ArrowLeft className="size-4" />
    </Button>
  ) : null;
  if (selecionado.kind === "dm") {
    const key = chaveConversa("dm", selecionado.conversaId);
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="mb-2 flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
          <Avatar className="size-10 border border-border/60">
            <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
              {iniciais(selecionado.nome)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
              Mensagem direta
            </p>
            <p className="truncate text-sm font-semibold text-foreground">
              Conversando com {selecionado.nome ?? "colega"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() =>
              abrirDmFlutuante(selecionado.conversaId, { nome: selecionado.nome })
            }
          >
            <Maximize2 className="size-3.5" />
            <span className="hidden sm:inline">Soltar chat</span>
          </Button>
          <ConversaMenuAcoes
            chatTipo="dm"
            chatId={selecionado.conversaId}
            arquivado={!!estadoPor.get(key)?.arquivado_em}
            fixado={!!estadoPor.get(key)?.pinado_em}
            apelidoAtual={estadoPor.get(key)?.apelido ?? null}
            nomeReferencia={selecionado.nome}
            etiquetaIds={etiquetaPor.get(key) ?? []}
          />
        </div>
        <div className="min-h-0 flex-1">
          <DmConversa conversaId={selecionado.conversaId} />
        </div>
      </div>
    );
  }

  if (selecionado.kind === "cliente") {
    const key = chaveConversa("cliente", selecionado.clienteId);
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="mb-2 flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
          <Avatar className="size-10 border border-border/60">
            {selecionado.foto && <AvatarImage src={selecionado.foto} alt={selecionado.nome ?? ""} />}
            <AvatarFallback className="bg-success text-xs font-semibold text-success-foreground">
              {iniciais(selecionado.nome)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              Cliente
            </p>
            <p className="truncate text-sm font-semibold text-foreground">
              Conversando com {selecionado.nome ?? "cliente"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() =>
              abrirChatFlutuante(selecionado.clienteId, {
                nome: selecionado.nome ?? "Cliente",
              })
            }
          >
            <Maximize2 className="size-3.5" />
            <span className="hidden sm:inline">Soltar chat</span>
          </Button>
          <ConversaMenuAcoes
            chatTipo="cliente"
            chatId={selecionado.clienteId}
            arquivado={!!estadoPor.get(key)?.arquivado_em}
            fixado={!!estadoPor.get(key)?.pinado_em}
            apelidoAtual={estadoPor.get(key)?.apelido ?? null}
            nomeReferencia={selecionado.nome}
            etiquetaIds={etiquetaPor.get(key) ?? []}
          />
        </div>
        <div className="min-h-0 flex-1">
          <ChatClienteConversa
            clienteId={selecionado.clienteId}
            info={{ nome: selecionado.nome ?? "Cliente" }}
          />
        </div>
      </div>
    );
  }

  const key = chaveConversa("demanda", selecionado.demandaId);
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="mb-2 flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
        <Avatar className="size-10 border border-border/60">
          {selecionado.interlocutorFoto && (
            <AvatarImage
              src={selecionado.interlocutorFoto}
              alt={selecionado.interlocutorNome ?? "Usuário"}
            />
          )}
          <AvatarFallback className="bg-warning text-xs font-semibold text-warning-foreground">
            {iniciais(selecionado.interlocutorNome ?? selecionado.numero ?? "DE")}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-warning">
            Demanda · {selecionado.numero ?? "—"}
          </p>
          <p className="truncate text-sm font-semibold text-foreground">
            Conversando com {selecionado.interlocutorNome ?? "usuário da demanda"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {selecionado.titulo ?? "Chat da demanda"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() =>
            abrirDemandaChatFlutuante(selecionado.demandaId, {
              numero: selecionado.numero,
              titulo: selecionado.titulo,
              interlocutorNome: selecionado.interlocutorNome,
              interlocutorFoto: selecionado.interlocutorFoto,
            })
          }
        >
          <Maximize2 className="size-3.5" />
          <span className="hidden sm:inline">Soltar chat</span>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/operacional/demandas/$id" params={{ id: selecionado.demandaId }}>
            Abrir demanda
          </Link>
        </Button>
        <ConversaMenuAcoes
          chatTipo="demanda"
          chatId={selecionado.demandaId}
          arquivado={!!estadoPor.get(key)?.arquivado_em}
          fixado={!!estadoPor.get(key)?.pinado_em}
          apelidoAtual={estadoPor.get(key)?.apelido ?? null}
          nomeReferencia={
            selecionado.interlocutorNome ?? selecionado.titulo ?? selecionado.numero
          }
          etiquetaIds={etiquetaPor.get(key) ?? []}
        />
      </div>
      <div className="min-h-0 flex-1">
        <DemandaChatConversa
          demandaId={selecionado.demandaId}
          info={{
            numero: selecionado.numero,
            titulo: selecionado.titulo,
            interlocutorNome: selecionado.interlocutorNome,
            interlocutorFoto: selecionado.interlocutorFoto,
          }}
        />
      </div>
    </div>
  );
}
