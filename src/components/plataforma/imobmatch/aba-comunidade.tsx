/**
 * Aba "Comunidade": as denúncias do ImobMatch Comunidade (posts, comentários, stories,
 * mensagens, membros e anúncios da rede). Cada denúncia mostra o conteúdo, quem denunciou,
 * o motivo e quantas denúncias o mesmo alvo já tem; a equipe decide **Aprovar** (o conteúdo
 * fica) ou **Remover** (sai; denúncia de membro suspende o membro), sempre com motivo.
 * A decisão resolve todas as denúncias abertas do mesmo alvo.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Flag, ImageIcon, Loader2, MessageCircle, ShieldCheck, Trash2, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, ChipsFiltro, EstadoErro, EstadoVazio, ListaCarregando, Selo, type Tom } from "@/components/plataforma/kit";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import {
  decidirDenunciaComunidade,
  lerDenunciasComunidade,
  SITUACOES_COMUNIDADE,
  type AlvoDenuncia,
  type DenunciaComunidade,
} from "@/lib/plataforma/comunidade.functions";
import { CHAVE_IMOBMATCH } from "./aba-revisao";

type Situacao = (typeof SITUACOES_COMUNIDADE)[number];

const ROTULO_SITUACAO: Record<Situacao, string> = {
  aberta: "A decidir",
  procedente: "Removidas",
  improcedente: "Aprovadas",
};

const ROTULO_ALVO: Record<AlvoDenuncia, string> = {
  post: "Post",
  comentario: "Comentário",
  story: "Story",
  mensagem: "Mensagem",
  membro: "Membro",
  anuncio: "Anúncio",
};

const ROTULO_MOTIVO: Record<string, string> = {
  imovel_inexistente: "Imóvel inexistente",
  preco_enganoso: "Preço enganoso",
  fraude: "Fraude",
  conteudo_improprio: "Conteúdo impróprio",
  spam: "Spam",
  assedio: "Assédio",
  perfil_falso: "Perfil falso",
  dados_pessoais: "Expõe dados pessoais",
  discurso_de_odio: "Discurso de ódio",
  outro: "Outro",
};

const TOM_MOTIVO: Record<string, Tom> = {
  fraude: "perigo",
  assedio: "perigo",
  discurso_de_odio: "perigo",
  dados_pessoais: "perigo",
};

/** O que "Remover" faz em cada tipo de alvo (dito antes de confirmar). */
const EFEITO_REMOVER: Record<AlvoDenuncia, string> = {
  post: "O post sai da comunidade e o autor é avisado com o motivo.",
  comentario: "O comentário sai do post e o autor é avisado com o motivo.",
  story: "O story sai da comunidade e o autor é avisado com o motivo.",
  mensagem: "A mensagem é apagada da conversa.",
  membro: "O membro fica suspenso da comunidade.",
  anuncio: "O anúncio sai do marketplace e o anunciante é avisado.",
};

const CHAVE = [...CHAVE_IMOBMATCH, "comunidade"];

const quando = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

export function AbaComunidade() {
  const lerFn = useServerFn(lerDenunciasComunidade);
  const podeDecidir = usePermissao("saas.imobmatch", "edit");
  const [situacao, setSituacao] = useState<Situacao>("aberta");
  const [decidindo, setDecidindo] = useState<{ d: DenunciaComunidade; decisao: "aprovar" | "remover" } | null>(null);
  const q = useQuery({
    queryKey: [...CHAVE, situacao],
    queryFn: () => lerFn({ data: { situacao } }),
    staleTime: 20_000,
    placeholderData: (a) => a,
  });
  const itens = q.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <ChipsFiltro<Situacao>
          rotulo="Situação das denúncias"
          valor={situacao}
          onChange={setSituacao}
          opcoes={SITUACOES_COMUNIDADE.map((s) => ({
            valor: s,
            rotulo: ROTULO_SITUACAO[s],
            contagem: s === situacao ? itens.length : null,
          }))}
        />
        <p className="text-xs text-muted-foreground">
          <Users className="mr-1 inline size-3.5" /> ImobMatch Comunidade: posts, stories, mensagens e membros.
        </p>
      </div>

      {q.isLoading && <ListaCarregando linhas={3} />}
      {q.isError && (
        <EstadoErro mensagem={mensagemDeErro(q.error, "Não foi possível ler as denúncias da comunidade.")} onTentar={() => q.refetch()} />
      )}
      {!q.isLoading && !q.isError && itens.length === 0 && (
        <EstadoVazio
          icone={<ShieldCheck />}
          titulo={situacao === "aberta" ? "Nenhuma denúncia para decidir" : "Nada por aqui ainda"}
          descricao={
            situacao === "aberta"
              ? "Quando alguém denunciar um conteúdo ou membro do ImobMatch Comunidade, ele aparece aqui."
              : undefined
          }
        />
      )}

      <ul className="grid gap-3 lg:grid-cols-2">
        {itens.map((d) => (
          <li key={d.id}>
            <CartaoDenuncia
              d={d}
              podeDecidir={podeDecidir && d.status === "aberta"}
              onDecidir={(decisao) => setDecidindo({ d, decisao })}
            />
          </li>
        ))}
      </ul>

      <DialogoDecisao alvo={decidindo} aoFechar={() => setDecidindo(null)} />
    </div>
  );
}

function CartaoDenuncia({
  d,
  podeDecidir,
  onDecidir,
}: {
  d: DenunciaComunidade;
  podeDecidir: boolean;
  onDecidir: (decisao: "aprovar" | "remover") => void;
}) {
  const texto = d.conteudo?.legenda ?? d.conteudo?.corpo ?? d.conteudo?.texto ?? null;
  const apagado = d.conteudo?.apagado || d.conteudo?.apagada;
  return (
    <article className="flex h-full flex-col gap-3 rounded-[14px] border border-border/80 bg-card p-4 shadow-[0_1px_2px_rgb(16_24_40/0.04)]">
      <header className="flex flex-wrap items-center gap-1.5">
        <Selo tom="marca">{ROTULO_ALVO[d.alvo] ?? d.alvo}</Selo>
        <Selo tom={TOM_MOTIVO[d.motivo] ?? "alerta"}>
          <Flag className="mr-0.5 inline size-3" /> {ROTULO_MOTIVO[d.motivo] ?? d.motivo}
        </Selo>
        {d.denuncias_no_alvo > 1 && <Selo tom="perigo">{d.denuncias_no_alvo} denúncias abertas</Selo>}
        {d.status !== "aberta" && (
          <Selo tom={d.status === "procedente" ? "neutro" : "sucesso"}>
            {d.status === "procedente" ? "Removido" : "Aprovado"}
          </Selo>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">{quando(d.criado_em)}</span>
      </header>

      {d.membro && (
        <div className="flex items-center gap-2.5">
          <Avatar nome={String(d.membro.nome ?? d.membro.apelido ?? "?")} tamanho="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {String(d.membro.nome ?? "—")}
              {d.membro.apelido ? <span className="font-normal text-muted-foreground"> @{String(d.membro.apelido)}</span> : null}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {String(d.membro.conta ?? "")}
              {d.membro.suspenso ? " · suspenso" : ""}
            </p>
          </div>
        </div>
      )}

      {d.anuncio && (
        <div className="rounded-lg bg-secondary/50 p-3 text-sm">
          <p className="font-medium">{d.anuncio.titulo}</p>
          <p className="text-xs text-muted-foreground">
            {[d.anuncio.codigo, [d.anuncio.cidade, d.anuncio.uf].filter(Boolean).join("/"), d.anuncio.conta]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {d.anuncio.descricao && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{d.anuncio.descricao}</p>}
        </div>
      )}

      {d.conteudo && (
        <div className="rounded-lg border border-border/70 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            <MessageCircle className="size-3.5" /> Conteúdo denunciado
            {d.conteudo.status && d.conteudo.status !== "publicado" && <Selo className="ml-1">{d.conteudo.status}</Selo>}
          </p>
          {apagado ? (
            <p className="text-sm italic text-muted-foreground">O autor já apagou este conteúdo.</p>
          ) : texto ? (
            <p className="line-clamp-6 whitespace-pre-wrap break-words text-sm">{texto}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Sem texto.</p>
          )}
          {d.midias.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {d.midias.slice(0, 6).map((m) =>
                m.url && m.mime.startsWith("image/") ? (
                  <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-border">
                    <img src={m.url} alt={m.nome} loading="lazy" className="aspect-square w-full object-cover" />
                  </a>
                ) : m.url && m.mime.startsWith("video/") ? (
                  <video key={m.id} src={m.url} controls preload="none" className="aspect-square w-full rounded-md border border-border object-cover" />
                ) : (
                  <span key={m.id} className="grid aspect-square place-items-center rounded-md border border-dashed border-border text-muted-foreground">
                    <ImageIcon className="size-4" />
                  </span>
                ),
              )}
            </div>
          )}
        </div>
      )}

      {d.detalhe && (
        <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          <span className="font-medium">O que disseram:</span> {d.detalhe}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        <UserRound className="mr-1 inline size-3.5" />
        Denunciado por {d.denunciante?.nome ?? "—"}
        {d.denunciante?.conta ? ` (${d.denunciante.conta})` : ""}
      </p>
      {d.decisao_obs && d.status !== "aberta" && (
        <p className="text-xs text-muted-foreground">
          Motivo da decisão: {d.decisao_obs} · {quando(d.resolvida_em)}
        </p>
      )}

      {podeDecidir && (
        <footer className="mt-auto flex flex-col gap-2 border-t border-border/70 pt-3 sm:flex-row">
          <Button className="min-h-11 flex-1 sm:min-h-9" onClick={() => onDecidir("aprovar")}>
            <Check className="mr-1.5 size-4" /> Aprovar
          </Button>
          <Button
            variant="outline"
            className="min-h-11 flex-1 border-destructive/40 text-destructive hover:bg-destructive/5 sm:min-h-9"
            onClick={() => onDecidir("remover")}
          >
            <Trash2 className="mr-1.5 size-4" /> Remover
          </Button>
        </footer>
      )}
    </article>
  );
}

function DialogoDecisao({
  alvo,
  aoFechar,
}: {
  alvo: { d: DenunciaComunidade; decisao: "aprovar" | "remover" } | null;
  aoFechar: () => void;
}) {
  const qc = useQueryClient();
  const decidirFn = useServerFn(decidirDenunciaComunidade);
  const [motivo, setMotivo] = useState("");
  const decidir = useMutation({
    mutationFn: () => decidirFn({ data: { id: alvo!.d.id, decisao: alvo!.decisao, motivo } }),
    onSuccess: (r) => {
      toast.success(
        `${alvo?.decisao === "aprovar" ? "Conteúdo aprovado" : "Conteúdo removido"}: ${r.resolvidas} denúncia(s) resolvida(s).`,
      );
      qc.invalidateQueries({ queryKey: CHAVE_IMOBMATCH });
      setMotivo("");
      aoFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível registrar a decisão.")),
  });
  const aprovar = alvo?.decisao === "aprovar";
  const ok = motivo.trim().length >= 5;
  return (
    <Dialog open={!!alvo} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{aprovar ? "Aprovar o conteúdo" : "Remover da comunidade"}</DialogTitle>
          <DialogDescription>
            {aprovar
              ? "A denúncia é arquivada e o conteúdo continua no ImobMatch Comunidade (volta ao ar se tinha sido escondido pelas denúncias)."
              : alvo
                ? EFEITO_REMOVER[alvo.d.alvo]
                : ""}{" "}
            Todas as denúncias abertas sobre o mesmo alvo são resolvidas juntas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="com-motivo">Motivo da decisão</Label>
          <Textarea
            id="com-motivo"
            rows={3}
            maxLength={500}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={aprovar ? "Ex.: divulgação normal de imóvel, sem irregularidade." : "Ex.: anúncio falso repetido em vários posts."}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">Pelo menos 5 letras. Fica registrado na denúncia.</p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" className="min-h-11 sm:min-h-9" onClick={aoFechar}>
            Voltar
          </Button>
          <Button
            variant={aprovar ? "default" : "destructive"}
            className="min-h-11 sm:min-h-9"
            disabled={!ok || decidir.isPending}
            onClick={() => decidir.mutate()}
          >
            {decidir.isPending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            {aprovar ? "Aprovar" : "Remover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
