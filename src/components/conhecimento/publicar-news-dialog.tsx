import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImageIcon, Loader2, Megaphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { despublicarArtigoDaNews, publicarArtigoNaNews } from "@/lib/conhecimento/base.functions";
import { listarCategoriasNews } from "@/lib/plataforma/news.functions";
import { enviarCapaNews } from "@/lib/plataforma/midias.functions";
import type { ItemBase } from "@/lib/consultor-ia/consultor-ia.functions";
import { SeletorCategoria } from "@/components/plataforma/news-comum";
import {
  AGENDA_PADRAO,
  CamposAgendaNews,
  agendaParaEnvio,
  type AgendaNews,
} from "@/components/plataforma/news-agenda";

/**
 * "Publicar no Agilliza News" a partir de um artigo da Base de conhecimento (C20): dias no
 * ar (ou data de fim), público, destaque e capa. Publicar de novo atualiza o mesmo post;
 * "Tirar da News" despublica.
 */
export function PublicarNewsDialog({
  artigo,
  onFechar,
}: {
  artigo: ItemBase | null;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const catFn = useServerFn(listarCategoriasNews);
  const categorias = useQuery({
    queryKey: ["news-categorias"],
    queryFn: () => catFn(),
    enabled: !!artigo,
  });
  const [agenda, setAgenda] = useState<AgendaNews>(AGENDA_PADRAO);
  const [categoria, setCategoria] = useState("agilliza");
  const [capa, setCapa] = useState<{ id: string; url: string | null } | null>(null);
  const [subindo, setSubindo] = useState(false);
  const seletor = useRef<HTMLInputElement>(null);
  const capaFn = useServerFn(enviarCapaNews);

  const publicar = useMutation({
    mutationFn: () =>
      publicarArtigoNaNews({
        data: {
          id: artigo!.id,
          destaque: agenda.destaque,
          categoria_news: categoria,
          capaMidiaId: capa?.id ?? null,
          ...agendaParaEnvio(agenda),
        },
      }),
    onSuccess: (r) => {
      toast.success(r.mensagem);
      qc.invalidateQueries({ queryKey: ["consultor-ia-base"] });
      onFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível publicar na News.")),
  });
  const despublicar = useMutation({
    mutationFn: () => despublicarArtigoDaNews({ data: { id: artigo!.id } }),
    onSuccess: (r) => {
      toast.success(r.mensagem);
      qc.invalidateQueries({ queryKey: ["consultor-ia-base"] });
      onFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível tirar da News.")),
  });

  const enviarCapa = async (arquivo?: File) => {
    if (!arquivo) return;
    setSubindo(true);
    try {
      const forma = new FormData();
      forma.append("arquivo", arquivo);
      forma.append("destino", "capa_news");
      const r = await capaFn({ data: forma });
      setCapa({ id: r.id, url: r.url });
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível enviar a capa."));
    } finally {
      setSubindo(false);
      if (seletor.current) seletor.current.value = "";
    }
  };

  const naNews = !!artigo?.news_post_id;
  return (
    <Dialog open={!!artigo} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="size-5 text-primary" />{" "}
            {naNews ? "Atualizar na Agilliza News" : "Publicar na Agilliza News"}
          </DialogTitle>
          <DialogDescription className="break-words">
            “{artigo?.titulo}” aparece no feed da News para o público escolhido, com o texto e as
            imagens do artigo. Os anexos ficam só na base.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <SeletorCategoria
            id="pub-news-cat"
            valor={categoria}
            onChange={setCategoria}
            opcoes={categorias.data ?? [{ id: "agilliza", nome: "Da Agilliza" }]}
          />
          <div className="space-y-1">
            <Label>Capa na News (opcional)</Label>
            <div className="flex flex-wrap items-center gap-2">
              {capa?.url && (
                <img
                  src={capa.url}
                  alt="Capa"
                  className="h-12 w-20 rounded-md border object-cover"
                />
              )}
              <input
                ref={seletor}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => void enviarCapa(e.target.files?.[0])}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={subindo}
                onClick={() => seletor.current?.click()}
              >
                {subindo ? (
                  <Loader2 className="mr-1 size-4 animate-spin" />
                ) : (
                  <ImageIcon className="mr-1 size-4" />
                )}
                {capa ? "Trocar capa" : "Enviar capa"}
              </Button>
              {capa && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setCapa(null)}>
                  <Trash2 className="mr-1 size-4" /> Tirar
                </Button>
              )}
            </div>
          </div>
          <CamposAgendaNews idBase="pub-news" valor={agenda} onChange={setAgenda} />
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {naNews ? (
            <Button
              variant="ghost"
              className="text-destructive"
              disabled={despublicar.isPending}
              onClick={() => despublicar.mutate()}
            >
              Tirar da News
            </Button>
          ) : (
            <span />
          )}
          <Button disabled={publicar.isPending} onClick={() => publicar.mutate()}>
            {publicar.isPending ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <Megaphone className="mr-1 size-4" />
            )}
            {naNews ? "Atualizar na News" : "Publicar na News"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
