import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  CircleDot,
  Download,
  FileSearch,
  Hourglass,
  Paperclip,
  PlusCircle,
  Shuffle,
  Undo2,
  UserPlus,
} from "lucide-react";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { urlAnexoDemanda } from "@/lib/operacional/demandas.functions";
import { ROTULO_MOTIVO_ATRIBUICAO, ROTULO_STATUS_DEMANDA, type DemandaStatus } from "@/lib/operacional/demandas-regras";
import { VazioDemandas } from "./pecas";

interface Anexo {
  id: string;
  nome: string;
  storage_path: string;
  created_at: string;
  nome_autor: string | null;
  origem: "anexo" | "chat";
}

export function ArquivosDemanda({ anexos }: { anexos: Anexo[] }) {
  const urlFn = useServerFn(urlAnexoDemanda);
  async function abrir(path: string) {
    try {
      const { url } = await urlFn({ data: { storage_path: path } });
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível abrir o arquivo."));
    }
  }
  if (!anexos.length) {
    return (
      <div className="p-4">
        <VazioDemandas
          titulo="Nenhum arquivo ainda"
          texto="Arquivos enviados pela conversa da demanda aparecem aqui, com quem enviou e quando."
          icone={<Paperclip className="size-5" />}
        />
      </div>
    );
  }
  return (
    <ul className="grid gap-2 p-4 sm:grid-cols-2">
      {anexos.map((a) => (
        <li key={a.id}>
          <button
            type="button"
            onClick={() => abrir(a.storage_path)}
            className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-2.5 text-left transition hover:border-primary/40 hover:bg-primary/5"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/8 text-primary">
              <FileSearch className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-medium">{a.nome}</span>
              <span className="block text-[10.5px] text-muted-foreground">
                {a.nome_autor ?? "—"} · {new Date(a.created_at).toLocaleString("pt-BR")}
                {a.origem === "chat" ? " · pela conversa" : ""}
              </span>
            </span>
            <Download className="size-4 text-muted-foreground" />
          </button>
        </li>
      ))}
    </ul>
  );
}

interface Hist {
  id: string;
  acao: string;
  detalhe: string | null;
  motivo: string | null;
  created_at: string;
  nome_ator: string | null;
  nome_anterior: string | null;
  nome_novo: string | null;
  dados?: { motivo?: string; candidatos?: { nome: string; carga: number; limite: number | null; ausente: boolean; disponivel: boolean }[] } | null;
}

const ICONE: Record<string, React.ReactNode> = {
  criada: <PlusCircle className="size-3.5" />,
  atribuida: <Shuffle className="size-3.5" />,
  transferida: <ArrowRightLeft className="size-3.5" />,
  devolvida: <Undo2 className="size-3.5" />,
  aguardando_fila: <Hourglass className="size-3.5" />,
  sem_fila: <Hourglass className="size-3.5" />,
  participantes_adicionados: <UserPlus className="size-3.5" />,
};

function frase(h: Hist): string {
  const quem = h.nome_ator ?? "Sistema";
  switch (h.acao) {
    case "criada":
      return `${quem} criou a demanda`;
    case "atribuida": {
      const m = h.dados?.motivo ? ROTULO_MOTIVO_ATRIBUICAO[h.dados.motivo] : null;
      return `${h.nome_novo ?? "Alguém"} ficou responsável${m ? ` (${m.toLowerCase()})` : ""}`;
    }
    case "transferida":
      return `${quem} reatribuiu de ${h.nome_anterior ?? "fila"} para ${h.nome_novo ?? "—"}`;
    case "devolvida":
      return `${quem} devolveu à fila (estava com ${h.nome_anterior ?? "—"})`;
    case "aguardando_fila":
      return "Aguardando alguém disponível na fila";
    case "sem_fila":
      return "Sem fila para este tipo e origem";
    case "status":
      return `${quem} mudou para ${ROTULO_STATUS_DEMANDA[(h.detalhe ?? "") as DemandaStatus] ?? h.detalhe}`;
    case "editada":
      return `${quem} editou a demanda`;
    case "participantes_adicionados":
      return `${quem} adicionou participantes`;
    case "escalonada":
      return "Prazo estourado: escalonada";
    default:
      return `${quem}: ${h.acao}`;
  }
}

export function HistoricoDemanda({ historico }: { historico: Hist[] }) {
  if (!historico.length) {
    return (
      <div className="p-4">
        <VazioDemandas titulo="Sem histórico" texto="Cada atribuição, mudança de situação e reatribuição aparece aqui com o porquê." />
      </div>
    );
  }
  return (
    <ol className="relative space-y-4 p-4 pl-8 before:absolute before:bottom-6 before:left-[1.4rem] before:top-6 before:w-px before:bg-border">
      {historico.map((h) => (
        <li key={h.id} className="relative">
          <span className="absolute -left-[1.55rem] top-0.5 grid size-5 place-items-center rounded-full border border-border bg-card text-primary">
            {ICONE[h.acao] ?? <CircleDot className="size-3" />}
          </span>
          <p className="text-[12.5px] font-medium text-foreground">{frase(h)}</p>
          {h.acao !== "status" && h.detalhe && h.acao !== "criada" && (
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{h.detalhe}</p>
          )}
          {h.motivo && <p className="mt-0.5 text-[12px] italic text-muted-foreground">Motivo: {h.motivo}</p>}
          {h.dados?.candidatos && h.dados.candidatos.length > 0 && (
            <details className="mt-1 text-[11.5px] text-muted-foreground">
              <summary className="cursor-pointer select-none font-medium text-primary">Ver a fila no momento</summary>
              <ul className="mt-1 space-y-0.5">
                {h.dados.candidatos.map((c, i) => (
                  <li key={i}>
                    {c.nome}: {c.carga} aberta{c.carga === 1 ? "" : "s"}
                    {c.limite !== null ? ` (limite ${c.limite})` : ""}
                    {c.ausente ? " · ausente" : !c.disponivel ? " · no limite" : ""}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="mt-0.5 text-[10.5px] text-muted-foreground/80">{new Date(h.created_at).toLocaleString("pt-BR")}</p>
        </li>
      ))}
    </ol>
  );
}
