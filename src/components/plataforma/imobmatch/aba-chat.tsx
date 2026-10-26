/**
 * Aba "Chat": as denúncias do chat universal (mensagens e pessoas). Cada denúncia mostra o
 * trecho, o contexto curto da conversa, quem denunciou, o denunciado (com o @) e quantas
 * denúncias abertas ele já tem. A equipe decide **Manter**, **Remover a mensagem** ou
 * **Bloquear no chat**, sempre com motivo. Embaixo, quem está bloqueado — e Reativar.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ban, Check, Flag, Loader2, MessageCircle, ShieldCheck, Trash2, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, ChipsFiltro, EstadoErro, EstadoVazio, ListaCarregando, Selo, type Tom } from "@/components/plataforma/kit";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import {
  decidirDenunciaChat,
  lerDenunciasChat,
  lerSuspensosChat,
  reativarNoChat,
  SITUACOES_CHAT,
  type DecisaoChat,
  type DenunciaChat,
  type SituacaoDenunciaChat,
  type SuspensoChat,
} from "@/lib/plataforma/chat-moderacao.functions";
import { CHAVE_IMOBMATCH } from "./aba-revisao";
import { useModeraImobMatch } from "@/hooks/use-permissao-imobmatch";

const CHAVE = [...CHAVE_IMOBMATCH, "chat"];

const ROTULO_SITUACAO: Record<SituacaoDenunciaChat, string> = {
  aberta: "A decidir",
  procedente: "Com ação",
  improcedente: "Mantidas",
};

const ROTULO_MOTIVO: Record<string, string> = {
  spam: "Spam",
  assedio: "Assédio",
  golpe: "Golpe",
  ofensa: "Ofensa",
  perfil_falso: "Perfil falso",
  conteudo_improprio: "Conteúdo impróprio",
  outro: "Outro",
};
const TOM_MOTIVO: Record<string, Tom> = { assedio: "perigo", golpe: "perigo", ofensa: "perigo" };

const ROTULO_ACAO: Record<DecisaoChat, string> = {
  manter: "Mantida",
  remover_mensagem: "Mensagem removida",
  bloquear_usuario: "Usuário bloqueado",
};

const DECISAO: Record<DecisaoChat, { titulo: string; efeito: string; botao: string; exemplo: string }> = {
  manter: {
    titulo: "Manter",
    efeito: "A denúncia é arquivada e nada muda na conversa.",
    botao: "Manter",
    exemplo: "Ex.: conversa normal de trabalho, sem irregularidade.",
  },
  remover_mensagem: {
    titulo: "Remover a mensagem",
    efeito: "A mensagem é apagada para todos na conversa. As denúncias abertas da mesma mensagem são resolvidas juntas.",
    botao: "Remover mensagem",
    exemplo: "Ex.: ofensa direta ao cliente.",
  },
  bloquear_usuario: {
    titulo: "Bloquear no chat",
    efeito: "A pessoa continua lendo, mas não escreve mais no chat de ninguém até ser reativada. As denúncias abertas contra ela são resolvidas juntas.",
    botao: "Bloquear",
    exemplo: "Ex.: assédio repetido a várias pessoas.",
  },
};

const quando = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

export function AbaChat() {
  const lerFn = useServerFn(lerDenunciasChat);
  const podeDecidir = useModeraImobMatch("edit");
  const [situacao, setSituacao] = useState<SituacaoDenunciaChat>("aberta");
  const [decidindo, setDecidindo] = useState<{ d: DenunciaChat; decisao: DecisaoChat } | null>(null);
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
        <ChipsFiltro<SituacaoDenunciaChat>
          rotulo="Situação das denúncias do chat"
          valor={situacao}
          onChange={setSituacao}
          opcoes={SITUACOES_CHAT.map((s) => ({ valor: s, rotulo: ROTULO_SITUACAO[s], contagem: s === situacao ? itens.length : null }))}
        />
        <p className="text-xs text-muted-foreground">
          <MessageCircle className="mr-1 inline size-3.5" /> Chat do ecossistema: Agilliza Tech, correspondente e portais.
        </p>
      </div>

      {q.isLoading && <ListaCarregando linhas={3} />}
      {q.isError && <EstadoErro mensagem={mensagemDeErro(q.error, "Não foi possível ler as denúncias do chat.")} onTentar={() => q.refetch()} />}
      {!q.isLoading && !q.isError && itens.length === 0 && (
        <EstadoVazio
          icone={<ShieldCheck />}
          titulo={situacao === "aberta" ? "Nenhuma denúncia do chat para decidir" : "Nada por aqui ainda"}
          descricao={situacao === "aberta" ? "Quando alguém denunciar uma mensagem ou uma pessoa no chat, ela aparece aqui." : undefined}
        />
      )}

      <ul className="grid gap-3 lg:grid-cols-2">
        {itens.map((d) => (
          <li key={d.id}>
            <CartaoDenunciaChat d={d} podeDecidir={podeDecidir && d.status === "aberta"} onDecidir={(decisao) => setDecidindo({ d, decisao })} />
          </li>
        ))}
      </ul>

      <Suspensos podeReativar={podeDecidir} />
      <DialogoDecisao alvo={decidindo} aoFechar={() => setDecidindo(null)} />
    </div>
  );
}

function Pessoa({ p, rotulo }: { p: DenunciaChat["denunciado"]; rotulo: string }) {
  if (!p) return null;
  return (
    <div className="flex items-center gap-2.5">
      <Avatar nome={p.nome} tamanho="sm" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {p.nome}
          {p.arroba && <span className="font-normal text-muted-foreground"> @{p.arroba}</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {rotulo}
          {p.detalhe ? ` · ${p.detalhe}` : ""}
          {p.suspenso ? " · bloqueado no chat" : ""}
        </p>
      </div>
    </div>
  );
}

function CartaoDenunciaChat({
  d,
  podeDecidir,
  onDecidir,
}: {
  d: DenunciaChat;
  podeDecidir: boolean;
  onDecidir: (decisao: DecisaoChat) => void;
}) {
  return (
    <article className="flex h-full flex-col gap-3 rounded-[14px] border border-border/80 bg-card p-4 shadow-[0_1px_2px_rgb(16_24_40/0.04)]">
      <header className="flex flex-wrap items-center gap-1.5">
        <Selo tom="marca">{d.mensagem ? "Mensagem" : "Pessoa"}</Selo>
        <Selo tom={TOM_MOTIVO[d.motivo] ?? "alerta"}>
          <Flag className="mr-0.5 inline size-3" /> {ROTULO_MOTIVO[d.motivo] ?? d.motivo}
        </Selo>
        {d.denuncias_contra > 1 && <Selo tom="perigo">{d.denuncias_contra} denúncias abertas contra a pessoa</Selo>}
        {d.acao && d.status !== "aberta" && <Selo tom={d.acao === "manter" ? "sucesso" : "neutro"}>{ROTULO_ACAO[d.acao]}</Selo>}
        <span className="ml-auto text-[11px] text-muted-foreground">{quando(d.criado_em)}</span>
      </header>

      <Pessoa p={d.denunciado} rotulo="Denunciado(a)" />

      {d.contexto.length > 0 && (
        <div className="rounded-lg border border-border/70 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            <MessageCircle className="size-3.5" /> {d.grupo ? "Grupo" : "Conversa"} — contexto
          </p>
          <ol className="space-y-1.5">
            {d.contexto.map((m, i) => (
              <li
                key={i}
                className={
                  m.denunciada
                    ? "rounded-md border-l-2 border-destructive/60 bg-destructive/5 px-2 py-1"
                    : "px-2 py-0.5"
                }
              >
                <p className="text-[11px] text-muted-foreground">
                  <span className={m.do_denunciado ? "font-semibold text-foreground" : ""}>{m.autor ?? "—"}</span> · {quando(m.criado_em)}
                  {m.denunciada && <span className="ml-1 font-medium text-destructive">(denunciada)</span>}
                </p>
                <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm">
                  {m.apagada ? <em className="text-muted-foreground">Mensagem apagada</em> : m.corpo || <em className="text-muted-foreground">Arquivo</em>}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
      {d.trecho && d.contexto.every((m) => !m.denunciada) && (
        <p className="rounded-lg border border-border/70 p-3 text-sm">
          <span className="text-xs text-muted-foreground">Trecho denunciado: </span>
          {d.trecho}
        </p>
      )}

      {d.detalhe && (
        <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          <span className="font-medium">O que disseram:</span> {d.detalhe}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        <UserRound className="mr-1 inline size-3.5" />
        Denunciado por {d.denunciante?.nome ?? "—"}
        {d.denunciante?.arroba ? ` (@${d.denunciante.arroba})` : ""}
      </p>
      {d.nota && d.status !== "aberta" && (
        <p className="text-xs text-muted-foreground">
          Motivo da decisão: {d.nota} · {quando(d.resolvido_em)}
        </p>
      )}

      {podeDecidir && (
        <footer className="mt-auto grid gap-2 border-t border-border/70 pt-3 sm:grid-cols-3">
          <Button className="min-h-11 sm:min-h-9" onClick={() => onDecidir("manter")}>
            <Check className="mr-1.5 size-4" /> Manter
          </Button>
          <Button
            variant="outline"
            className="min-h-11 border-destructive/40 text-destructive hover:bg-destructive/5 sm:min-h-9"
            disabled={!d.mensagem || d.mensagem.apagada}
            title={!d.mensagem ? "A denúncia é da pessoa, não de uma mensagem" : undefined}
            onClick={() => onDecidir("remover_mensagem")}
          >
            <Trash2 className="mr-1.5 size-4" /> Remover
          </Button>
          <Button
            variant="outline"
            className="min-h-11 border-destructive/40 text-destructive hover:bg-destructive/5 sm:min-h-9"
            disabled={!d.denunciado}
            onClick={() => onDecidir("bloquear_usuario")}
          >
            <Ban className="mr-1.5 size-4" /> Bloquear
          </Button>
        </footer>
      )}
    </article>
  );
}

function DialogoDecisao({ alvo, aoFechar }: { alvo: { d: DenunciaChat; decisao: DecisaoChat } | null; aoFechar: () => void }) {
  const qc = useQueryClient();
  const decidirFn = useServerFn(decidirDenunciaChat);
  const [motivo, setMotivo] = useState("");
  const decidir = useMutation({
    mutationFn: () => decidirFn({ data: { id: alvo!.d.id, decisao: alvo!.decisao, motivo } }),
    onSuccess: (r) => {
      toast.success(`${alvo ? ROTULO_ACAO[alvo.decisao] : "Decidida"}: ${r.resolvidas} denúncia(s) resolvida(s).`);
      qc.invalidateQueries({ queryKey: CHAVE });
      setMotivo("");
      aoFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível registrar a decisão.")),
  });
  const cfg = alvo ? DECISAO[alvo.decisao] : null;
  const perigo = alvo?.decisao !== "manter";
  return (
    <Dialog open={!!alvo} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{cfg?.titulo}</DialogTitle>
          <DialogDescription>{cfg?.efeito}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="chat-motivo">Motivo da decisão</Label>
          <Textarea id="chat-motivo" rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={cfg?.exemplo} autoFocus />
          <p className="text-xs text-muted-foreground">Pelo menos 5 letras. Fica registrado na denúncia.</p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" className="min-h-11 sm:min-h-9" onClick={aoFechar}>
            Voltar
          </Button>
          <Button
            variant={perigo ? "destructive" : "default"}
            className="min-h-11 sm:min-h-9"
            disabled={motivo.trim().length < 5 || decidir.isPending}
            onClick={() => decidir.mutate()}
          >
            {decidir.isPending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            {cfg?.botao}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Suspensos({ podeReativar }: { podeReativar: boolean }) {
  const lerFn = useServerFn(lerSuspensosChat);
  const reativarFn = useServerFn(reativarNoChat);
  const qc = useQueryClient();
  const [alvo, setAlvo] = useState<SuspensoChat | null>(null);
  const [motivo, setMotivo] = useState("");
  const q = useQuery({ queryKey: [...CHAVE, "suspensos"], queryFn: () => lerFn(), staleTime: 20_000 });
  const reativar = useMutation({
    mutationFn: () => reativarFn({ data: { usuarioId: alvo!.usuario_id, motivo } }),
    onSuccess: () => {
      toast.success("Pessoa reativada no chat.");
      qc.invalidateQueries({ queryKey: CHAVE });
      setAlvo(null);
      setMotivo("");
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível reativar.")),
  });
  const lista = q.data ?? [];
  if (q.isLoading || lista.length === 0) return null;
  return (
    <section className="rounded-[14px] border border-border/80 bg-card p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
        <Users className="size-4" /> Bloqueados no chat ({lista.length})
      </h3>
      <ul className="divide-y divide-border/70">
        {lista.map((s) => (
          <li key={s.usuario_id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {s.nome}
                {s.arroba && <span className="font-normal text-muted-foreground"> @{s.arroba}</span>}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {s.motivo} · desde {quando(s.desde)}
                {s.por ? ` · por ${s.por}` : ""}
              </p>
            </div>
            {podeReativar && (
              <Button variant="outline" className="min-h-11 sm:min-h-8" onClick={() => setAlvo(s)}>
                Reativar
              </Button>
            )}
          </li>
        ))}
      </ul>
      <Dialog open={!!alvo} onOpenChange={(v) => !v && setAlvo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reativar {alvo?.nome} no chat</DialogTitle>
            <DialogDescription>A pessoa volta a escrever no chat. O motivo fica registrado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="chat-reativar">Motivo</Label>
            <Textarea id="chat-reativar" rows={2} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="min-h-11 sm:min-h-9" onClick={() => setAlvo(null)}>
              Voltar
            </Button>
            <Button className="min-h-11 sm:min-h-9" disabled={motivo.trim().length < 5 || reativar.isPending} onClick={() => reativar.mutate()}>
              {reativar.isPending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Reativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
