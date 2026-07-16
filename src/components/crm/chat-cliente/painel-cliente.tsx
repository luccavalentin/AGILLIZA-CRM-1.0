import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { obterPainelChatCliente } from "@/lib/crm/chat-cliente.functions";
import { type ChatEtiqueta } from "@/lib/crm/chat-gestao.functions";

import { AbaCliente } from "./painel/aba-cliente";
import { AbaInteracoes } from "./painel/aba-interacoes";
import { AbaArquivos } from "./painel/aba-arquivos";
import { LinhaResumo } from "./painel/painel-primitivos";
import { macroIndexOf } from "./painel/painel-utils";

const TABS = [
  { id: "cliente", label: "Cliente" },
  { id: "detalhes", label: "Detalhes" },
  { id: "interacoes", label: "Interações" },
  { id: "arquivos", label: "Arquivos" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function PainelChatCliente({
  clienteId,
  etiquetas = [],
}: {
  clienteId: string;
  etiquetas?: ChatEtiqueta[];
}) {
  const [tab, setTab] = useState<TabId>("cliente");
  const painelFn = useServerFn(obterPainelChatCliente);
  const { data, isLoading } = useQuery({
    queryKey: ["painel-chat-cliente", clienteId],
    queryFn: () => painelFn({ data: { cliente_id: clienteId } }),
    staleTime: 30_000,
  });

  const zap = useMemo(() => {
    const cel = (data?.celular ?? "").replace(/\D/g, "");
    return cel ? `https://wa.me/55${cel}` : null;
  }, [data?.celular]);

  const atualIdx = useMemo(() => macroIndexOf(data?.etapa_codigo ?? null), [data?.etapa_codigo]);
  const encerradaMotivo = useMemo<"recusado" | "cancelada" | null>(() => {
    const st = (data?.proposta?.status ?? "").toLowerCase();
    if (st.includes("recusad") || st.includes("reprovad")) return "recusado";
    if (st.includes("cancelad")) return "cancelada";
    return null;
  }, [data?.proposta?.status]);

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border/60 shadow-sm">
      <div className="flex shrink-0 gap-1 border-b bg-muted/30 px-2 pt-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "relative rounded-t-lg px-3 py-2 text-xs font-medium transition-colors",
              tab === t.id ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">Cliente não encontrado.</p>
        ) : tab === "cliente" ? (
          <AbaCliente
            clienteId={clienteId}
            data={data}
            zap={zap}
            atualIdx={atualIdx}
            encerradaMotivo={encerradaMotivo}
            etiquetas={etiquetas}
          />
        ) : tab === "detalhes" ? (
          <div className="space-y-3 text-sm">
            <LinhaResumo rotulo="Nome" valor={data.nome ?? "—"} />
            <LinhaResumo rotulo="Documento" valor={data.documento ?? "—"} />
            <LinhaResumo rotulo="Celular" valor={data.celular ?? "—"} />
            <LinhaResumo rotulo="E-mail" valor={data.email ?? "—"} />
            <LinhaResumo rotulo="Etapa" valor={data.etapa_nome ?? "—"} />
            <LinhaResumo rotulo="Responsável" valor={data.responsavel_nome ?? "—"} />
          </div>
        ) : tab === "interacoes" ? (
          <AbaInteracoes clienteId={clienteId} />
        ) : (
          <AbaArquivos clienteId={clienteId} />
        )}
      </div>
    </Card>
  );
}
