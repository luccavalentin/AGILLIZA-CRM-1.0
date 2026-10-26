/**
 * Peças comuns das telas de Automações (Calendário, Posts, Novo post, Mídia, Relatórios e
 * Redes): situação dos posts, miniatura, formatação e a marca das redes.
 */
import { Play, Type } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Selo, type Tom } from "@/components/plataforma/kit";
import type { DestinoPost, PostResumo, StatusPost } from "@/lib/social/automacoes.functions";
import { REDES, type Rede } from "@/lib/social/catalogo";
import { cn } from "@/lib/utils";
import { MarcaRede } from "./marca-rede";

export { MarcaRede };

export const STATUS_POST: Record<StatusPost, { rotulo: string; tom: Tom; ponto: string }> = {
  rascunho: { rotulo: "Rascunho", tom: "neutro", ponto: "bg-muted-foreground/50" },
  aguardando_aprovacao: { rotulo: "Em aprovação", tom: "alerta", ponto: "bg-warning" },
  agendado: { rotulo: "Agendado", tom: "marca", ponto: "bg-primary" },
  publicando: { rotulo: "Publicando", tom: "info", ponto: "bg-sky-500" },
  publicado: { rotulo: "Publicado", tom: "sucesso", ponto: "bg-success" },
  parcial: { rotulo: "Publicado em parte", tom: "alerta", ponto: "bg-warning" },
  falhou: { rotulo: "Falhou", tom: "perigo", ponto: "bg-destructive" },
  cancelado: { rotulo: "Cancelado", tom: "neutro", ponto: "bg-muted-foreground/30" },
};

export const STATUS_DESTINO: Record<DestinoPost["status"], { rotulo: string; tom: Tom }> = {
  pendente: { rotulo: "Na fila", tom: "marca" },
  publicando: { rotulo: "Publicando", tom: "info" },
  publicado: { rotulo: "Publicado", tom: "sucesso" },
  falhou: { rotulo: "Falhou", tom: "perigo" },
  cancelado: { rotulo: "Cancelado", tom: "neutro" },
};

export function SeloStatus({ status }: { status: StatusPost }) {
  const s = STATUS_POST[status] ?? STATUS_POST.rascunho;
  return (
    <Selo tom={s.tom} ponto={status === "publicando" || status === "agendado"}>
      {s.rotulo}
    </Selo>
  );
}

export const num = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR");

export const compacto = (n: number | null | undefined) =>
  n == null
    ? "—"
    : Number(n).toLocaleString("pt-BR", {
        notation: Number(n) >= 10_000 ? "compact" : "standard",
        maximumFractionDigits: 1,
      });

export const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function dataHora(iso: string | null | undefined): string {
  if (!iso) return "Sem data";
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dataCurta(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export const rotuloRede = (r: string) => REDES[r as Rede]?.rotulo ?? r;
export const rotuloFormato = (r: string, f: string) =>
  REDES[r as Rede]?.formatos.find((x) => x.id === f)?.rotulo ?? f;

/** Primeira linha não vazia da legenda. */
export const primeiraLinha = (t: string) =>
  t
    .split("\n")
    .find((l) => l.trim())
    ?.trim() ?? "";

/** Miniatura do post: a primeira mídia (vídeo com selo de play) ou "Aa" quando é só texto. */
export function Miniatura({
  capa,
  className,
}: {
  capa: { url: string; mime: string } | null | undefined;
  className?: string;
}) {
  if (!capa)
    return (
      <span
        className={cn(
          "grid shrink-0 place-items-center bg-secondary text-muted-foreground",
          className,
        )}
        aria-hidden
      >
        <Type className="size-4" />
      </span>
    );
  if (capa.mime.startsWith("video/"))
    return (
      <span
        className={cn("relative shrink-0 overflow-hidden bg-foreground", className)}
        aria-hidden
      >
        <video
          src={capa.url}
          muted
          preload="metadata"
          className="size-full object-cover opacity-90"
        />
        <Play className="absolute inset-0 m-auto size-3.5 fill-white text-white" />
      </span>
    );
  return (
    <img
      src={capa.url}
      alt=""
      loading="lazy"
      className={cn("shrink-0 bg-secondary object-cover", className)}
    />
  );
}

/** Marcas das redes de destino, empilhadas (até 4 + contagem). */
export function RedesDoPost({
  post,
  tamanho = "size-4",
}: {
  post: Pick<PostResumo, "destinos">;
  tamanho?: string;
}) {
  const redes = post.destinos.map((d) => d.rede);
  return (
    <span className="flex items-center -space-x-1">
      {redes.slice(0, 4).map((r, i) => (
        <span
          key={i}
          className="grid place-items-center rounded-[5px] bg-card p-[2px] ring-1 ring-border"
        >
          <MarcaRede rede={r} className={tamanho} />
        </span>
      ))}
      {redes.length > 4 && (
        <span className="grid h-5 min-w-5 place-items-center rounded-[5px] bg-secondary px-1 text-[10px] font-medium text-muted-foreground ring-1 ring-border">
          +{redes.length - 4}
        </span>
      )}
    </span>
  );
}

/** Invalida tudo das Automações depois de uma ação (calendário, listas, resumo…). */
export function useRecarregarAutomacoes() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["automacoes"] });
}

export function copiarTexto(texto: string, aviso: (ok: boolean) => void) {
  void navigator.clipboard.writeText(texto).then(
    () => aviso(true),
    () => aviso(false),
  );
}
