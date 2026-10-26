/**
 * Ações de um post (lista e detalhe): publicar agora, repetir as redes que falharam,
 * duplicar como rascunho e cancelar. Quem pode o quê é o banco (social.*) que decide; a tela
 * só esconde o botão que não faz sentido para a situação.
 */
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { CalendarX, Copy, MoreHorizontal, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import {
  cancelarPostAgz,
  duplicarPostAgz,
  publicarAgoraAgz,
  repetirFalhasAgz,
  type PostResumo,
} from "@/lib/social/automacoes.functions";
import { useRecarregarAutomacoes } from "./comum";

export function useAcoesPost() {
  const recarregar = useRecarregarAutomacoes();
  const navigate = useNavigate();
  const publicarFn = useServerFn(publicarAgoraAgz);
  const repetirFn = useServerFn(repetirFalhasAgz);
  const duplicarFn = useServerFn(duplicarPostAgz);
  const cancelarFn = useServerFn(cancelarPostAgz);
  const erro = (e: unknown) => toast.error(mensagemDeErro(e, "Não foi possível concluir."));

  const publicar = useMutation({
    mutationFn: (id: string) => publicarFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Post na fila para sair agora.", {
        description: "Em até um minuto ele vai para as redes.",
      });
      recarregar();
    },
    onError: erro,
  });
  const repetir = useMutation({
    mutationFn: (id: string) => repetirFn({ data: { id } }),
    onSuccess: (r) => {
      toast.success(
        r.n
          ? `${r.n} rede(s) de volta na fila.`
          : "Nenhuma rede para repetir (reconecte as que estão sem autorização).",
      );
      recarregar();
    },
    onError: erro,
  });
  const duplicar = useMutation({
    mutationFn: (id: string) => duplicarFn({ data: { id } }),
    onSuccess: (r) => {
      toast.success("Post duplicado como rascunho.");
      recarregar();
      void navigate({ to: "/automacoes/novo", search: { post: r.id } });
    },
    onError: erro,
  });
  const cancelar = useMutation({
    mutationFn: (id: string) => cancelarFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Post cancelado. O que já saiu nas redes continua lá.");
      recarregar();
    },
    onError: erro,
  });
  return { publicar, repetir, duplicar, cancelar };
}

export const temFalha = (p: Pick<PostResumo, "status" | "destinos">) =>
  p.status === "falhou" || p.destinos.some((d) => d.status === "falhou");

export function MenuAcoesPost({ post, podeEditar }: { post: PostResumo; podeEditar: boolean }) {
  const a = useAcoesPost();
  if (!podeEditar) return null;
  const ocupado =
    a.publicar.isPending || a.repetir.isPending || a.duplicar.isPending || a.cancelar.isPending;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 sm:size-8"
          aria-label="Ações do post"
          disabled={ocupado}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {post.status === "agendado" && (
          <DropdownMenuItem onClick={() => a.publicar.mutate(post.id)}>
            <Send className="mr-2 size-4" /> Publicar agora
          </DropdownMenuItem>
        )}
        {temFalha(post) && (
          <DropdownMenuItem onClick={() => a.repetir.mutate(post.id)}>
            <RotateCcw className="mr-2 size-4" /> Tentar de novo
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => a.duplicar.mutate(post.id)}>
          <Copy className="mr-2 size-4" /> Duplicar
        </DropdownMenuItem>
        {post.status !== "cancelado" && post.status !== "publicado" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                if (window.confirm("Cancelar este post? O que já saiu nas redes continua lá."))
                  a.cancelar.mutate(post.id);
              }}
            >
              <CalendarX className="mr-2 size-4" /> Cancelar
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
