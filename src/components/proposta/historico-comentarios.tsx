import { ToneBadge } from "@/components/crm/tone-badge";

/** "Hoje", "Ontem" ou a data — o separador de dia da conversa. */
function rotuloDoDia(data: Date): string {
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  if (data.toDateString() === hoje.toDateString()) return "Hoje";
  if (data.toDateString() === ontem.toDateString()) return "Ontem";
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Histórico de comentários da proposta em formato de chat: o que sai do
 * Agilliza fica à direita, com quem escreveu; o que vem da integração fica à
 * esquerda, em nome dela. Um separador marca cada dia. Usado na aba FUP e na
 * janela "Ver comentários".
 */
export function HistoricoComentarios({ followups }: { followups: any[] }) {
  if (followups.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhum comentário ainda. Escreva a primeira mensagem.
      </p>
    );
  }
  const ordenados = [...followups].sort(
    (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
  );
  return (
    <div className="flex flex-col gap-2.5">
      {ordenados.map((f, i) => {
        const quando = new Date(f.created_at);
        const anterior = i > 0 ? new Date(ordenados[i - 1].created_at) : null;
        const novoDia = !anterior || anterior.toDateString() !== quando.toDateString();
        const nosso = f.tipo !== "banco";
        const autor = nosso ? `Agilliza · ${f.autor_nome ?? "operador"}` : "HomeFin · integração";
        return (
          <div key={f.id} className="flex flex-col gap-2.5">
            {novoDia && (
              <div className="my-1 flex items-center gap-3" role="separator">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[11px] font-medium text-muted-foreground">
                  {rotuloDoDia(quando)}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
            )}
            <div className={`flex w-full ${nosso ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl border px-3 py-2 ${
                  nosso
                    ? "rounded-br-md border-primary/20 bg-primary/[0.08]"
                    : "rounded-bl-md border-border bg-card"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">{autor}</span>
                  {nosso && (
                    <ToneBadge tone={f.tipo === "externo" ? "info" : "muted"}>
                      {f.tipo === "externo" ? "enviado à HomeFin" : "interno"}
                    </ToneBadge>
                  )}
                </div>
                {f.titulo && <p className="mt-1 font-medium text-foreground">{f.titulo}</p>}
                <p className="whitespace-pre-wrap text-sm text-foreground/80">{f.comentario}</p>
                <p className="mt-1 text-right text-[10px] tabular-nums text-muted-foreground">
                  {quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
