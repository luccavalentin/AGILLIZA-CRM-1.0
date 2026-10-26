import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EyeOff, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatData } from "@/lib/financeiro/format";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import {
  lerComentariosNews,
  ocultarComentarioNews,
  tirarDoArNews,
  type ItemFeedNews,
} from "@/lib/plataforma/news.functions";
import { useAcaoNews } from "./news-comum";

/**
 * O que está no ar, como o leitor vê (`radar.feed`), com curtidas e comentários contados.
 * Abrir os comentários permite à curadoria ocultar o que não cabe — o registro fica.
 */
export function AudienciaNews({
  feed,
  carregando,
  pode,
}: {
  feed: ItemFeedNews[];
  carregando: boolean;
  pode: boolean;
}) {
  const [aberto, setAberto] = useState<ItemFeedNews | null>(null);
  const tirarFn = useServerFn(tirarDoArNews);
  const tirar = useAcaoNews(
    (i: ItemFeedNews) => tirarFn({ data: { tipo: i.tipo, id: i.id } }),
    "Não foi possível tirar do ar.",
  );
  const totalCurtidas = feed.reduce((s, i) => s + Number(i.curtidas || 0), 0);
  const totalComentarios = feed.reduce((s, i) => s + Number(i.comentarios || 0), 0);

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="font-semibold">No ar e audiência</h2>
        <p className="text-sm text-muted-foreground">
          {feed.length} item(ns) no ar · {totalCurtidas} curtida(s) · {totalComentarios}{" "}
          comentário(s) visível(is). Destaques aparecem primeiro, como na tela do corretor.
        </p>
      </div>
      {carregando ? (
        <Skeleton className="h-40" />
      ) : !feed.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nada no ar ainda.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Curtidas</TableHead>
              <TableHead className="text-right">Comentários</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feed.map((i) => (
              <TableRow key={`${i.tipo}-${i.id}`}>
                <TableCell className="min-w-[12rem] align-top">
                  <div className="break-words font-medium">{i.titulo ?? "Sem título"}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <Badge variant="outline">{i.tipo === "post" ? "Agilliza" : "Matéria"}</Badge>
                    {i.fixado && <Badge variant="secondary">Destaque</Badge>}
                    <span>
                      {i.categoria_nome ?? ""}
                      {i.fonte ? ` · ${i.fonte}` : ""}
                      {i.publicado_em ? ` · ${formatData(i.publicado_em)}` : ""}
                      {i.fim_em ? ` · até ${formatData(i.fim_em)}` : ""}
                    </span>
                    {i.publico !== "todos" && (
                      <Badge variant="outline">
                        {i.publico === "equipe" ? "Só equipe" : "Só assinantes"}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right align-top tabular-nums">{i.curtidas}</TableCell>
                <TableCell className="text-right align-top">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setAberto(i)}
                    aria-label={`Ver comentários de ${i.titulo ?? "item"}`}
                  >
                    <MessageSquare className="mr-1 size-4" />
                    <span className="tabular-nums">{i.comentarios}</span>
                  </Button>
                  {pode && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground"
                      disabled={tirar.isPending}
                      onClick={() => tirar.mutate(i)}
                      aria-label={`Tirar do ar: ${i.titulo ?? "item"}`}
                    >
                      Tirar do ar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Sheet open={Boolean(aberto)} onOpenChange={(v) => !v && setAberto(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Comentários</SheetTitle>
            <SheetDescription className="break-words">{aberto?.titulo ?? ""}</SheetDescription>
          </SheetHeader>
          {aberto && (
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <Comentarios item={aberto} pode={pode} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function Comentarios({ item, pode }: { item: ItemFeedNews; pode: boolean }) {
  const lerFn = useServerFn(lerComentariosNews);
  const ocultarFn = useServerFn(ocultarComentarioNews);
  const qc = useQueryClient();
  const chave = ["plataforma-news-comentarios", item.tipo, item.id];
  const q = useQuery({
    queryKey: chave,
    queryFn: () => lerFn({ data: { tipo: item.tipo, itemId: item.id } }),
  });
  const ocultar = useAcaoNews(
    (id: string) => ocultarFn({ data: { id, motivo: "Moderação da Agilliza." } }),
    "Não foi possível ocultar.",
  );

  if (q.isLoading) return <Skeleton className="h-32" />;
  if (q.isError)
    return (
      <p className="text-sm text-destructive">
        {mensagemDeErro(q.error, "Não foi possível ler os comentários.")}
      </p>
    );
  const lista = q.data ?? [];
  if (!lista.length)
    return <p className="py-6 text-center text-sm text-muted-foreground">Nenhum comentário.</p>;

  return (
    <ul className="space-y-3 pb-4">
      {lista.map((c) => (
        <li
          key={c.id}
          className={`space-y-1 rounded-md border border-border p-3 ${c.oculto ? "opacity-60" : ""}`}
        >
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{c.autor ?? "Usuário"}</span>
            <span>{c.criado_em}</span>
            {c.editado && <span>(editado)</span>}
            {c.oculto && <Badge variant="outline">Oculto</Badge>}
          </div>
          <p className="whitespace-pre-wrap break-words text-sm">{c.corpo}</p>
          {pode && !c.oculto && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={ocultar.isPending}
              onClick={() =>
                ocultar.mutate(c.id, {
                  onSuccess: () => qc.invalidateQueries({ queryKey: chave }),
                })
              }
            >
              <EyeOff className="mr-1 size-4" /> Ocultar
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
