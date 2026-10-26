/**
 * Biblioteca de mídia das Automações (estrutura do Postei): o que foi enviado para os posts e
 * as fotos dos imóveis, com filtro de tipo e origem, busca, envio de foto e vídeo e remoção.
 * A mesma grade serve de seletor no compositor (`escolher`).
 */
import { useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Film, ImagePlus, Images, Loader2, Play, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  BarraFiltros,
  CampoBusca,
  ChipsFiltro,
  EstadoErro,
  EstadoVazio,
  ListaCarregando,
} from "@/components/plataforma/kit";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { enviarFotoSocial, enviarVideoSocial } from "@/lib/plataforma/midias.functions";
import {
  bibliotecaAgz,
  removerMidiaAgz,
  type ItemBiblioteca,
} from "@/lib/social/automacoes.functions";
import { cn } from "@/lib/utils";
import { useRecarregarAutomacoes } from "./comum";

export type MidiaEscolhida = {
  id: string;
  mime: string;
  url: string | null;
  duracaoMs: number | null;
};

const tamanho = (b: number) =>
  b >= 1024 * 1024
    ? `${(b / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`
    : `${Math.max(1, Math.round(b / 1024))} KB`;
const duracao = (ms: number | null) => {
  if (!ms) return null;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Envio de foto (JPG/PNG/WebP até 5 MB) e vídeo (MP4/MOV/WebM até 60 MB). */
export function useEnvioDeMidia(aoEnviar: (m: MidiaEscolhida) => void) {
  const fotoFn = useServerFn(enviarFotoSocial);
  const videoFn = useServerFn(enviarVideoSocial);
  const [enviando, setEnviando] = useState(0);
  async function enviar(lista: FileList | File[] | null) {
    const arquivos = Array.from(lista ?? []);
    if (!arquivos.length) return;
    setEnviando((n) => n + arquivos.length);
    for (const f of arquivos) {
      const form = new FormData();
      form.set("arquivo", f);
      try {
        if (f.type.startsWith("video/")) {
          const r = await videoFn({ data: form });
          aoEnviar({ id: r.id, mime: r.tipo, url: r.url, duracaoMs: r.duracaoMs });
        } else {
          form.set("destino", "social_post");
          const r = await fotoFn({ data: form });
          aoEnviar({ id: r.id, mime: r.tipo, url: r.url, duracaoMs: null });
        }
      } catch (e) {
        toast.error(mensagemDeErro(e, `Não foi possível enviar ${f.name}.`));
      } finally {
        setEnviando((n) => n - 1);
      }
    }
  }
  return { enviar, enviando: enviando > 0 };
}

export const ACEITOS = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm";

export function Biblioteca({
  escolher,
  selecionadas = [],
  podeEditar,
}: {
  /** Modo seletor: cada clique alterna a mídia no post. */
  escolher?: (m: MidiaEscolhida) => void;
  selecionadas?: string[];
  podeEditar: boolean;
}) {
  const [tipo, setTipo] = useState<"todos" | "foto" | "video">("todos");
  const [origem, setOrigem] = useState<"todas" | "enviadas" | "imoveis">("todas");
  const [busca, setBusca] = useState("");
  const [arrastando, setArrastando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const recarregar = useRecarregarAutomacoes();
  const listarFn = useServerFn(bibliotecaAgz);
  const removerFn = useServerFn(removerMidiaAgz);
  const q = useQuery({
    queryKey: ["automacoes", "biblioteca", tipo, origem, busca.trim()],
    queryFn: () => listarFn({ data: { tipo, origem, busca: busca.trim(), limite: 120 } }),
    placeholderData: keepPreviousData,
  });
  const envio = useEnvioDeMidia((m) => {
    recarregar();
    escolher?.(m);
    toast.success("Arquivo enviado.");
  });
  const remover = useMutation({
    mutationFn: (id: string) => removerFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Arquivo tirado da biblioteca.");
      recarregar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível apagar.")),
  });

  return (
    <div
      className={cn(
        "space-y-3",
        arrastando && "rounded-[14px] outline-dashed outline-2 outline-primary/50",
      )}
      onDragOver={(e) => {
        if (!podeEditar || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => {
        if (!podeEditar || !e.dataTransfer.files.length) return;
        e.preventDefault();
        setArrastando(false);
        void envio.enviar(e.dataTransfer.files);
      }}
    >
      <BarraFiltros>
        <ChipsFiltro
          rotulo="Tipo"
          valor={tipo}
          onChange={setTipo}
          opcoes={[
            { valor: "todos", rotulo: "Tudo" },
            { valor: "foto", rotulo: "Fotos" },
            { valor: "video", rotulo: "Vídeos" },
          ]}
        />
        <ChipsFiltro
          rotulo="Origem"
          valor={origem}
          onChange={setOrigem}
          opcoes={[
            { valor: "todas", rotulo: "Todas" },
            { valor: "enviadas", rotulo: "Enviadas" },
            { valor: "imoveis", rotulo: "Dos imóveis" },
          ]}
        />
        <CampoBusca
          valor={busca}
          onChange={setBusca}
          placeholder="Buscar pelo nome"
          rotulo="Buscar mídia"
          className="md:ml-auto"
        />
        {podeEditar && (
          <>
            <Button
              className="min-h-11 sm:min-h-10"
              onClick={() => entrada.current?.click()}
              disabled={envio.enviando}
            >
              {envio.enviando ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Upload className="mr-1.5 size-4" />
              )}
              {envio.enviando ? "Enviando…" : "Enviar"}
            </Button>
            <input
              ref={entrada}
              type="file"
              accept={ACEITOS}
              multiple
              hidden
              onChange={(e) => {
                void envio.enviar(e.target.files);
                e.target.value = "";
              }}
            />
          </>
        )}
      </BarraFiltros>

      {q.isError ? (
        <EstadoErro
          mensagem={mensagemDeErro(q.error, "Não foi possível carregar a biblioteca.")}
          onTentar={() => q.refetch()}
        />
      ) : q.isLoading ? (
        <ListaCarregando linhas={3} />
      ) : !q.data?.itens.length ? (
        <EstadoVazio
          icone={<Images />}
          titulo="Nada por aqui ainda"
          descricao="Envie fotos e vídeos (ou arraste para esta área). Eles ficam guardados para usar em qualquer post."
          acao={
            podeEditar ? (
              <Button className="min-h-11 sm:min-h-9" onClick={() => entrada.current?.click()}>
                <ImagePlus className="mr-1.5 size-4" /> Enviar foto ou vídeo
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {q.data.itens.map((m) => (
              <Cartao
                key={m.id}
                m={m}
                marcada={selecionadas.includes(m.id)}
                aoEscolher={
                  escolher
                    ? () =>
                        escolher({
                          id: m.id,
                          mime: m.mime,
                          url: m.url ?? null,
                          duracaoMs: m.duracao_ms,
                        })
                    : undefined
                }
                aoRemover={
                  podeEditar && !escolher && m.origem === "enviada"
                    ? () => {
                        if (
                          window.confirm(
                            "Tirar este arquivo da biblioteca? Posts já publicados não mudam.",
                          )
                        )
                          remover.mutate(m.id);
                      }
                    : undefined
                }
              />
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {q.data.total.toLocaleString("pt-BR")} arquivo(s) · {tamanho(q.data.bytes_enviados)}{" "}
            enviados para as Automações
          </p>
        </>
      )}
    </div>
  );
}

function Cartao({
  m,
  marcada,
  aoEscolher,
  aoRemover,
}: {
  m: ItemBiblioteca;
  marcada: boolean;
  aoEscolher?: () => void;
  aoRemover?: () => void;
}) {
  const video = m.mime.startsWith("video/");
  const corpo = (
    <>
      <span className="relative block aspect-square overflow-hidden rounded-[10px] bg-secondary">
        {m.url ? (
          video ? (
            <video src={m.url} muted preload="metadata" className="size-full object-cover" />
          ) : (
            <img src={m.url} alt="" loading="lazy" className="size-full object-cover" />
          )
        ) : (
          <span className="grid size-full place-items-center text-muted-foreground">
            {video ? <Film className="size-6" /> : <Images className="size-6" />}
          </span>
        )}
        {video && (
          <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-medium text-white">
            <Play className="size-3 fill-white" /> {duracao(m.duracao_ms) ?? "vídeo"}
          </span>
        )}
        {marcada && (
          <span className="absolute inset-0 grid place-items-center bg-primary/35">
            <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground shadow">
              <Check className="size-4" />
            </span>
          </span>
        )}
      </span>
      <span className="mt-1.5 block truncate text-xs text-foreground">
        {m.origem === "imovel" ? `Imóvel ${m.imovel_codigo ?? ""}` : (m.nome ?? "Arquivo")}
      </span>
      <span className="block truncate text-[11px] text-muted-foreground">
        {tamanho(m.bytes)}
        {m.usos ? ` · em ${m.usos} post(s)` : ""}
      </span>
    </>
  );
  return (
    <li className="group relative min-w-0">
      {aoEscolher ? (
        <button
          type="button"
          onClick={aoEscolher}
          aria-pressed={marcada}
          className="block w-full rounded-[12px] p-1 text-left hover:bg-secondary/50"
        >
          {corpo}
        </button>
      ) : (
        <div className="p-1">{corpo}</div>
      )}
      {aoRemover && (
        <button
          type="button"
          onClick={aoRemover}
          aria-label="Apagar arquivo"
          className="absolute right-2 top-2 grid size-9 place-items-center rounded-lg bg-card/90 text-muted-foreground opacity-100 shadow ring-1 ring-border hover:text-destructive sm:size-8 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </li>
  );
}
