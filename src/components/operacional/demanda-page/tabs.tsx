import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Activity, Download, FileSearch, Paperclip, StickyNote } from "lucide-react";
import { urlAnexoDemanda } from "@/lib/operacional/demandas.functions";

export function NotasInternas() {
  return (
    <div className="flex flex-1 items-center justify-center p-10 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-muted/50 text-muted-foreground">
          <StickyNote className="size-5" />
        </div>
        <p className="text-sm font-medium text-foreground">Notas internas</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Espaço reservado para comentários privados da equipe — não visíveis ao cliente.
        </p>
      </div>
    </div>
  );
}

export function ArquivosTab({ anexos }: { anexos: any[] }) {
  const urlFn = useServerFn(urlAnexoDemanda);
  async function abrir(anexoId: string) {
    try {
      const url = await urlFn({ data: { id: anexoId } });
      if (typeof url === "string") window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível abrir o arquivo.");
    }
  }
  if (!anexos.length) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-center">
        <div className="max-w-sm">
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-muted/50 text-muted-foreground">
            <Paperclip className="size-5" />
          </div>
          <p className="text-sm font-medium text-foreground">Nenhum arquivo anexado</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Compartilhe arquivos direto no chat da demanda usando o ícone de anexo.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex-1 space-y-2 overflow-y-auto p-4">
      {anexos.map((a: any) => (
        <button
          key={a.id}
          type="button"
          onClick={() => abrir(a.id)}
          className="flex w-full items-center gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5 text-left transition hover:border-primary/40 hover:bg-primary/5"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <FileSearch className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {a.nome_arquivo ?? "Arquivo"}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {a.nome_autor ? `Enviado por ${a.nome_autor} · ` : ""}
              {a.created_at ? new Date(a.created_at).toLocaleString("pt-BR") : ""}
            </p>
          </div>
          <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}

export function AtividadesTab({ historico }: { historico: any[] }) {
  if (!historico.length) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-center">
        <div className="max-w-sm">
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-muted/50 text-muted-foreground">
            <Activity className="size-5" />
          </div>
          <p className="text-sm font-medium text-foreground">Sem atividades registradas</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ações como criação, edição, transferência e mudanças de status aparecerão aqui.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-4">
      {historico.map((h: any) => (
        <div key={h.id} className="flex gap-3">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
          <div className="min-w-0 flex-1 pb-3">
            <p className="text-sm text-foreground">
              <span className="font-medium">{h.nome_ator ?? "Sistema"}</span>{" "}
              <span className="text-muted-foreground">— {h.acao}</span>
            </p>
            {h.detalhe && <p className="mt-0.5 text-xs text-muted-foreground">{h.detalhe}</p>}
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {h.created_at ? new Date(h.created_at).toLocaleString("pt-BR") : ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
