/**
 * Opções por rede de um destino (`social.destinos.opcoes`): primeiro comentário do Instagram,
 * título e privacidade do YouTube, os controles que a auditoria do TikTok exige e o evento,
 * a oferta e o botão do Google Meu Negócio. As chaves são as do catálogo (`validarOpcoes`).
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { BOTOES_GOOGLE, PRIVACIDADES_TIKTOK, PRIVACIDADES_YOUTUBE } from "@/lib/social/catalogo";
import { infoCriadorTiktokAgz, type Opcoes } from "@/lib/social/automacoes.functions";
import type { ContaPrevia } from "./previa";
import { MarcaRede } from "./comum";

type Valor = string | number | boolean | null;

/** A rede/formato tem opções para mostrar? */
export function temOpcoes(rede: string, formato: string): boolean {
  if (rede === "instagram") return formato !== "story";
  return rede === "youtube" || rede === "tiktok" || rede === "google_business";
}

const txt = (v: unknown) => (typeof v === "string" ? v : "");

export function OpcoesDestino({
  conta,
  formato,
  opcoes,
  mudar,
  podeEditar,
}: {
  conta: ContaPrevia;
  formato: string;
  opcoes: Opcoes;
  mudar: (o: Opcoes) => void;
  podeEditar: boolean;
}) {
  const definir = (k: string, v: Valor) => mudar({ ...opcoes, [k]: v });
  const id = (k: string) => `op-${conta.id}-${k}`;
  return (
    <fieldset className="rounded-xl border bg-card p-3.5" disabled={!podeEditar}>
      <legend className="flex items-center gap-2 px-1 text-sm font-medium">
        <MarcaRede rede={conta.rede} className="size-4" /> {conta.nome}
      </legend>

      {conta.rede === "instagram" && (
        <div className="space-y-1.5">
          <Label htmlFor={id("pc")}>Primeiro comentário (opcional)</Label>
          <Textarea
            id={id("pc")}
            rows={2}
            maxLength={2200}
            value={txt(opcoes.primeiroComentario)}
            onChange={(e) => definir("primeiroComentario", e.target.value)}
            placeholder="Hashtags ou link: sai como o primeiro comentário, logo depois do post."
            className="text-base sm:text-sm"
          />
        </div>
      )}

      {conta.rede === "youtube" && (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
          <div className="space-y-1.5">
            <Label htmlFor={id("titulo")}>Título do vídeo</Label>
            <Input
              id={id("titulo")}
              maxLength={100}
              value={txt(opcoes.titulo)}
              onChange={(e) => definir("titulo", e.target.value)}
              placeholder="Sem título, vale a primeira linha da legenda"
              className="h-11 text-base sm:h-10 sm:text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Quem vê</Label>
            <Select
              value={txt(opcoes.privacidade) || "public"}
              onValueChange={(v) => definir("privacidade", v)}
            >
              <SelectTrigger className="h-11 sm:h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIVACIDADES_YOUTUBE.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {conta.rede === "tiktok" && (
        <OpcoesTiktok conta={conta} formato={formato} opcoes={opcoes} mudar={mudar} />
      )}

      {conta.rede === "google_business" && (
        <div className="space-y-3">
          {(formato === "evento" || formato === "oferta") && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-3">
                <Label htmlFor={id("gt")}>
                  Título {formato === "evento" ? "do evento" : "da oferta"}
                </Label>
                <Input
                  id={id("gt")}
                  maxLength={58}
                  value={txt(opcoes.titulo)}
                  onChange={(e) => definir("titulo", e.target.value)}
                  className="h-11 text-base sm:h-10 sm:text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={id("gi")}>Início</Label>
                <Input
                  id={id("gi")}
                  type="datetime-local"
                  value={txt(opcoes.inicio)}
                  onChange={(e) => definir("inicio", e.target.value)}
                  className="h-11 text-base sm:h-10 sm:text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={id("gf")}>Fim</Label>
                <Input
                  id={id("gf")}
                  type="datetime-local"
                  value={txt(opcoes.fim)}
                  onChange={(e) => definir("fim", e.target.value)}
                  className="h-11 text-base sm:h-10 sm:text-sm"
                />
              </div>
              {formato === "oferta" && (
                <div className="space-y-1.5">
                  <Label htmlFor={id("gc")}>Cupom (opcional)</Label>
                  <Input
                    id={id("gc")}
                    maxLength={58}
                    value={txt(opcoes.cupom)}
                    onChange={(e) => definir("cupom", e.target.value)}
                    className="h-11 text-base sm:h-10 sm:text-sm"
                  />
                </div>
              )}
            </div>
          )}
          {formato === "oferta" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={id("gr")}>Link para resgatar (opcional)</Label>
                <Input
                  id={id("gr")}
                  type="url"
                  value={txt(opcoes.urlResgate)}
                  onChange={(e) => definir("urlResgate", e.target.value)}
                  placeholder="https://"
                  className="h-11 text-base sm:h-10 sm:text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={id("gtc")}>Termos (opcional)</Label>
                <Input
                  id={id("gtc")}
                  maxLength={500}
                  value={txt(opcoes.termos)}
                  onChange={(e) => definir("termos", e.target.value)}
                  className="h-11 text-base sm:h-10 sm:text-sm"
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
              <div className="space-y-1.5">
                <Label>Botão</Label>
                <Select
                  value={txt(opcoes.tipoBotao) || "LEARN_MORE"}
                  onValueChange={(v) => definir("tipoBotao", v)}
                >
                  <SelectTrigger className="h-11 sm:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BOTOES_GOOGLE.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {txt(opcoes.tipoBotao) !== "CALL" && (
                <div className="space-y-1.5">
                  <Label htmlFor={id("gu")}>Link do botão</Label>
                  <Input
                    id={id("gu")}
                    type="url"
                    value={txt(opcoes.urlBotao)}
                    onChange={(e) => definir("urlBotao", e.target.value)}
                    placeholder="Sem link, vale o primeiro link da legenda"
                    className="h-11 text-base sm:h-10 sm:text-sm"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </fieldset>
  );
}

/**
 * Exigências da auditoria do TikTok (Content Posting API): apelido da conta à vista; quem pode
 * ver SEM valor padrão, só com as opções que a conta permite agora (creator_info); comentário,
 * dueto e costura desligados por padrão e travados quando a conta desativou; divulgação de
 * conteúdo comercial; e a frase de consentimento antes de publicar.
 */
function OpcoesTiktok({
  conta,
  formato,
  opcoes,
  mudar,
}: {
  conta: ContaPrevia;
  formato: string;
  opcoes: Opcoes;
  mudar: (o: Opcoes) => void;
}) {
  const infoFn = useServerFn(infoCriadorTiktokAgz);
  const q = useQuery({
    queryKey: ["automacoes", "tiktok-criador", conta.id],
    queryFn: () => infoFn({ data: { conta: conta.id } }),
    staleTime: 60_000,
    retry: false,
  });
  const definir = (k: string, v: Valor) => mudar({ ...opcoes, [k]: v });
  const i = q.data;
  const video = formato === "video";
  const comercial = opcoes.divulgacaoComercial === true;
  const id = (k: string) => `tt-${conta.id}-${k}`;
  const interruptor = (chave: string, rotulo: string, desativado: boolean) => (
    <label className="flex min-h-11 items-center justify-between gap-3 text-sm sm:min-h-9">
      <span className={desativado ? "text-muted-foreground" : ""}>
        {rotulo}
        {desativado && (
          <span className="block text-xs">Desativado nas configurações da conta do TikTok</span>
        )}
      </span>
      <Switch
        checked={!desativado && opcoes[chave] === true}
        disabled={desativado}
        onCheckedChange={(v) => definir(chave, v)}
        aria-label={rotulo}
      />
    </label>
  );
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Publicando como{" "}
        <span className="font-medium text-foreground">
          {i?.apelido ?? conta.nome}
          {i?.usuario || conta.usuario
            ? ` (@${(i?.usuario ?? conta.usuario ?? "").replace(/^@/, "")})`
            : ""}
        </span>
        {i?.duracaoMaximaS ? ` · vídeos de até ${Math.floor(i.duracaoMaximaS / 60)} min` : ""}
      </p>
      {q.isLoading && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Consultando a conta no TikTok…
        </p>
      )}
      {q.isError && (
        <p className="flex items-start gap-2 rounded-lg bg-warning/15 px-3 py-2 text-xs text-warning-foreground">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          {mensagemDeErro(q.error, "Não foi possível consultar a conta no TikTok agora.")}
        </p>
      )}
      <div className="space-y-1.5">
        <Label>Quem pode ver este post *</Label>
        <Select
          value={typeof opcoes.privacidade === "string" ? opcoes.privacidade : ""}
          onValueChange={(v) => definir("privacidade", v)}
        >
          <SelectTrigger className="h-11 sm:h-10" aria-label="Quem pode ver no TikTok">
            <SelectValue placeholder="Escolha" />
          </SelectTrigger>
          <SelectContent>
            {(i?.privacidades ?? []).map((p) => (
              <SelectItem
                key={p}
                value={p}
                disabled={p === "SELF_ONLY" && opcoes.conteudoDeMarca === true}
              >
                {PRIVACIDADES_TIKTOK[p] ?? p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="divide-y rounded-lg border px-3">
        {interruptor(
          "permitirComentario",
          "Permitir comentários",
          Boolean(i?.comentarioDesativado),
        )}
        {video && interruptor("permitirDueto", "Permitir dueto", Boolean(i?.duetoDesativado))}
        {video &&
          interruptor(
            "permitirCostura",
            "Permitir costura (stitch)",
            Boolean(i?.costuraDesativada),
          )}
      </div>
      <div className="rounded-lg border p-3">
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm sm:min-h-9">
          <span>
            Divulgar conteúdo comercial
            <span className="block text-xs text-muted-foreground">
              Ligue se o post promove uma marca, produto ou serviço.
            </span>
          </span>
          <Switch
            checked={comercial}
            onCheckedChange={(v) =>
              mudar({
                ...opcoes,
                divulgacaoComercial: v,
                ...(v ? {} : { suaMarca: false, conteudoDeMarca: false }),
              })
            }
            aria-label="Divulgar conteúdo comercial"
          />
        </label>
        {comercial && (
          <div className="mt-2 space-y-2 border-t pt-2">
            <label
              htmlFor={id("marca")}
              className="flex min-h-11 items-start gap-2.5 text-sm sm:min-h-9"
            >
              <Checkbox
                id={id("marca")}
                checked={opcoes.suaMarca === true}
                onCheckedChange={(v) => definir("suaMarca", v === true)}
              />
              <span>
                Sua marca
                <span className="block text-xs text-muted-foreground">
                  Você promove o próprio negócio. O post leva o rótulo “Conteúdo promocional”.
                </span>
              </span>
            </label>
            <label
              htmlFor={id("terceiro")}
              className="flex min-h-11 items-start gap-2.5 text-sm sm:min-h-9"
            >
              <Checkbox
                id={id("terceiro")}
                checked={opcoes.conteudoDeMarca === true}
                onCheckedChange={(v) => definir("conteudoDeMarca", v === true)}
              />
              <span>
                Conteúdo de marca
                <span className="block text-xs text-muted-foreground">
                  Você promove outra marca ou um parceiro. O post leva o rótulo “Parceria paga”.
                </span>
              </span>
            </label>
          </div>
        )}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Ao publicar, você concorda com a{" "}
        <a
          className="underline"
          href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
          target="_blank"
          rel="noreferrer"
        >
          Music Usage Confirmation
        </a>{" "}
        do TikTok
        {opcoes.conteudoDeMarca === true && (
          <>
            {" "}
            e com a{" "}
            <a
              className="underline"
              href="https://www.tiktok.com/legal/page/global/bc-policy/en"
              target="_blank"
              rel="noreferrer"
            >
              Branded Content Policy
            </a>
          </>
        )}
        . O post pode levar alguns minutos para aparecer no perfil.
      </p>
    </div>
  );
}
