import { useServerFn } from "@tanstack/react-start";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { toast } from "sonner";
import { Activity, Download, FileSearch, Paperclip } from "lucide-react";
import { urlAnexoDemanda } from "@/lib/operacional/demandas.functions";
import { statusDemanda } from "@/components/operacional/status";

/** Ações do histórico em português (antes apareciam os códigos: "status", "transferida"…). */
const ROTULO_ACAO: Record<string, string> = {
  criada: "criou a demanda",
  editada: "editou a demanda",
  status: "mudou o status",
  transferida: "transferiu a demanda",
  escalonada: "escalonou a demanda (SLA estourado)",
  participantes_adicionados: "adicionou participantes",
};

function detalheAtividade(h: any): string | null {
  if (!h.detalhe) return null;
  // Na mudança de status o detalhe é o código do novo status.
  if (h.acao === "status") return `Novo status: ${statusDemanda(String(h.detalhe)).label}`;
  return String(h.detalhe);
}

export function ArquivosTab({ anexos }: { anexos: any[] }) {
  const urlFn = useServerFn(urlAnexoDemanda);
  // Antes mandava o id ao servidor, que espera o caminho do arquivo: nunca abria.
  async function abrir(storagePath: string) {
    try {
      const { url } = await urlFn({ data: { storage_path: storagePath } });
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível abrir o arquivo."));
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
          onClick={() => abrir(a.storage_path)}
          className="flex w-full items-center gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5 text-left transition hover:border-primary/40 hover:bg-primary/5"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <FileSearch className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{a.nome ?? "Arquivo"}</p>
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
              <span className="text-muted-foreground">
                {ROTULO_ACAO[h.acao] ?? String(h.acao ?? "").replace(/_/g, " ")}
              </span>
            </p>
            {h.acao === "transferida" && (h.nome_anterior || h.nome_novo) && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {h.nome_anterior ?? "—"} → {h.nome_novo ?? "—"}
              </p>
            )}
            {detalheAtividade(h) && (
              <p className="mt-0.5 text-xs text-muted-foreground">{detalheAtividade(h)}</p>
            )}
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {h.created_at ? new Date(h.created_at).toLocaleString("pt-BR") : ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
