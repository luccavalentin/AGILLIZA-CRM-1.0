/**
 * Peças comuns da Gestão de Parceiros e Anúncios (ImobMatch): selos, ficha do anúncio
 * com fotos, cartões de resumo e o campo de motivo. Os dados vêm prontos das funções
 * `plataforma.imobmatch_*` (0283); aqui só se desenha.
 */
import type { ReactNode } from "react";
import {
  BadgeCheck,
  Bath,
  BedDouble,
  CarFront,
  Flag,
  Heart,
  ImageOff,
  MapPin,
  MessageSquare,
  Ruler,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatBRL, formatData } from "@/lib/financeiro/format";
import { cn } from "@/lib/utils";
import type {
  FichaAnuncio,
  MotivoDenuncia,
  SituacaoCreci,
  StatusAnuncio,
} from "@/lib/plataforma/imobmatch.functions";

type Variante =
  "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "soft";

export const STATUS_ANUNCIO: Record<StatusAnuncio, { rotulo: string; variante: Variante }> = {
  publicado: { rotulo: "No ar", variante: "success" },
  revisao: { rotulo: "Em revisão", variante: "warning" },
  retirado: { rotulo: "Fora do ar", variante: "secondary" },
  moderado: { rotulo: "Moderado", variante: "destructive" },
};

export const MOTIVO_DENUNCIA: Record<MotivoDenuncia, string> = {
  golpe: "Golpe ou fraude",
  imovel_inexistente: "Imóvel não existe",
  ja_negociado: "Já vendido ou alugado",
  preco_enganoso: "Preço enganoso",
  fotos_enganosas: "Fotos enganosas",
  duplicado: "Anúncio repetido",
  conteudo_improprio: "Conteúdo impróprio",
  outro: "Outro motivo",
};

export const SITUACAO_CRECI: Record<SituacaoCreci, { rotulo: string; variante: Variante }> = {
  sem_pedido: { rotulo: "Sem pedido", variante: "outline" },
  pendente: { rotulo: "A conferir", variante: "warning" },
  verificado: { rotulo: "Verificado", variante: "success" },
  recusado: { rotulo: "Recusado", variante: "destructive" },
  suspenso: { rotulo: "Suspenso", variante: "destructive" },
};

export const TIPO_CONTA: Record<string, string> = {
  corretor: "Corretor",
  imobiliaria: "Imobiliária",
  particular: "Particular",
  parceiro: "Parceiro",
};

const TIPO_IMOVEL: Record<string, string> = {
  apartamento: "Apartamento",
  casa: "Casa",
  casa_condominio: "Casa em condomínio",
  cobertura: "Cobertura",
  terreno: "Terreno",
  sala: "Sala",
  loja: "Loja",
  galpao: "Galpão",
  sitio: "Sítio",
  chacara: "Chácara",
  fazenda: "Fazenda",
  kitnet: "Kitnet",
  studio: "Studio",
};

const ACAO: Record<string, string> = {
  moderar: "Moderado",
  reverter: "Moderação desfeita",
  revisao_publicar: "Revisão: os dois ficam",
  revisao_manter_outro: "Revisão: ficou o outro anúncio",
  revisao_trocar: "Revisão: este ficou",
  duplicado_de_outro: "Saiu como duplicado",
  denuncia_procedente: "Denúncia procedente",
  denuncia_improcedente: "Denúncia improcedente",
};

/** Motivos que o banco grava como código (0259/0268/0283), na língua da equipe. */
const MOTIVO_CODIGO: Record<string, string> = {
  possivel_duplicado: "Mesmo endereço de outra conta",
  moderado_antes: "Endereço com anúncio moderado antes",
  endereco_incompleto: "Endereço sem número: conferir antes de publicar",
  retirado_pelo_anunciante: "Retirado pelo anunciante",
  limite_do_plano: "Passou do limite do plano",
  moderacao_revertida: "Moderação desfeita: o anunciante pode publicar de novo",
  imovel_vendido: "Imóvel vendido",
  imovel_alugado: "Imóvel alugado",
  imovel_inativo: "Imóvel inativo",
  imovel_apagado: "Imóvel arquivado",
};

export const motivoLegivel = (m: string | null | undefined) => (m ? (MOTIVO_CODIGO[m] ?? m) : null);
export const rotuloTipo = (t: string) =>
  TIPO_IMOVEL[t] ?? t.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
export const inteiro = (n: number | null | undefined) => Number(n ?? 0).toLocaleString("pt-BR");
export const dataHora = (s: string | null | undefined) => {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

export function precoTexto(f: FichaAnuncio): string {
  if (f.preco_sob_consulta) return "Sob consulta";
  const partes = [
    f.valor_venda != null ? formatBRL(Number(f.valor_venda)) : null,
    f.valor_locacao != null ? `${formatBRL(Number(f.valor_locacao))}/mês` : null,
  ].filter(Boolean);
  return partes.join(" · ") || "Sem preço";
}

export const localTexto = (f: FichaAnuncio) =>
  [f.bairro, [f.cidade, f.uf].filter(Boolean).join("/")].filter(Boolean).join(", ") || "Sem local";

export function SeloStatus({ status }: { status: StatusAnuncio }) {
  const s = STATUS_ANUNCIO[status] ?? { rotulo: status, variante: "outline" as Variante };
  return <Badge variant={s.variante}>{s.rotulo}</Badge>;
}

export function SeloCreci({ situacao }: { situacao: SituacaoCreci }) {
  const s = SITUACAO_CRECI[situacao] ?? { rotulo: situacao, variante: "outline" as Variante };
  return <Badge variant={s.variante}>{s.rotulo}</Badge>;
}

/** Fotos lado a lado (até 4). Sem a ponte de arquivos, o lugar da foto fica vazio. */
export function FaixaFotos({ f, compacta = false }: { f: FichaAnuncio; compacta?: boolean }) {
  const fotos = f.fotos.filter((x) => x.url);
  if (fotos.length === 0) {
    return (
      <div
        className={cn(
          "grid place-items-center rounded-lg border border-dashed border-border bg-muted/40 text-muted-foreground",
          compacta ? "h-20" : "h-32",
        )}
      >
        <span className="flex items-center gap-1.5 text-xs">
          <ImageOff className="size-4" aria-hidden /> Sem foto para mostrar
        </span>
      </div>
    );
  }
  const [capa, ...resto] = fotos.slice(0, 4);
  const img = (x: (typeof fotos)[number], n: number, cls: string) => (
    <a
      key={x.id}
      href={x.url!}
      target="_blank"
      rel="noreferrer"
      className={cn("group relative block overflow-hidden rounded-md bg-muted", cls)}
      aria-label={`Abrir a foto ${n} de ${f.codigo} em outra aba`}
    >
      <img
        src={x.url!}
        alt=""
        loading="lazy"
        className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
      />
    </a>
  );
  return (
    <div
      className={cn(
        "grid gap-1.5",
        resto.length ? "grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : "grid-cols-1",
        compacta ? "h-24" : "h-36 sm:h-40",
      )}
    >
      {img(capa, 1, "h-full")}
      {resto.length > 0 && (
        <div
          className="grid min-h-0 gap-1.5"
          style={{ gridTemplateRows: `repeat(${resto.length}, minmax(0, 1fr))` }}
        >
          {resto.map((x, i) => img(x, i + 2, "h-full"))}
        </div>
      )}
    </div>
  );
}

function Caracteristica({ icone, texto }: { icone: ReactNode; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      {icone}
      {texto}
    </span>
  );
}

/** Ficha do anúncio para a equipe decidir: fotos, conta, preço, local e provas. */
export function FichaDoAnuncio({
  f,
  rotulo,
  destaque = false,
  rodape,
}: {
  f: FichaAnuncio;
  /** "Em revisão", "Já no ar"… acima do título. */
  rotulo?: string;
  destaque?: boolean;
  rodape?: ReactNode;
}) {
  const motivo = motivoLegivel(f.motivo);
  return (
    <article
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-3 sm:p-4",
        destaque ? "border-primary/40 ring-1 ring-primary/15" : "border-border",
      )}
    >
      <FaixaFotos f={f} />
      <div className="min-w-0 space-y-1">
        {rotulo && (
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {rotulo}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="min-w-0 break-words text-sm font-semibold">
            {f.titulo ?? rotuloTipo(f.tipo)}
          </h3>
          <SeloStatus status={f.status} />
        </div>
        <p className="text-xs tabular-nums text-muted-foreground">
          {f.codigo} · {rotuloTipo(f.tipo)} ·{" "}
          {f.anunciante === "proprietario" ? "anúncio de proprietário" : "anúncio profissional"}
        </p>
      </div>

      <div className="grid gap-1.5 text-sm">
        <p className="font-semibold tabular-nums">{precoTexto(f)}</p>
        <p className="flex items-start gap-1 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 break-words">{localTexto(f)}</span>
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {f.area != null && (
            <Caracteristica
              icone={<Ruler className="size-3.5" aria-hidden />}
              texto={`${inteiro(f.area)} m²`}
            />
          )}
          {f.quartos != null && (
            <Caracteristica
              icone={<BedDouble className="size-3.5" aria-hidden />}
              texto={`${f.quartos} qto${f.quartos === 1 ? "" : "s"}`}
            />
          )}
          {f.banheiros != null && (
            <Caracteristica
              icone={<Bath className="size-3.5" aria-hidden />}
              texto={`${f.banheiros} banh.`}
            />
          )}
          {f.vagas != null && (
            <Caracteristica
              icone={<CarFront className="size-3.5" aria-hidden />}
              texto={`${f.vagas} vaga${f.vagas === 1 ? "" : "s"}`}
            />
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg bg-muted/40 p-2.5 text-xs">
        <div className="col-span-2 min-w-0">
          <dt className="text-muted-foreground">Conta</dt>
          <dd className="flex flex-wrap items-center gap-1 break-words font-medium">
            {f.conta.nome}
            <span className="font-normal text-muted-foreground">
              · {TIPO_CONTA[f.conta.tipo] ?? f.conta.tipo}
            </span>
            {f.conta.verificado && (
              <BadgeCheck className="size-3.5 text-emerald-600" aria-label="CRECI verificado" />
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">CRECI</dt>
          <dd className="break-words">
            {f.conta.creci
              ? `${f.conta.creci}${f.conta.creci_uf ? `/${f.conta.creci_uf}` : ""}`
              : "—"}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">Autorização</dt>
          <dd className="flex items-center gap-1">
            {f.autorizacao ? (
              <>
                {f.autorizacao.exclusiva && (
                  <ShieldCheck className="size-3.5 text-emerald-600" aria-hidden />
                )}
                {f.autorizacao.exclusiva ? "Exclusiva" : "Simples"} desde{" "}
                {formatData(f.autorizacao.inicio)}
              </>
            ) : (
              <span className="text-amber-700 dark:text-amber-400">Nenhuma vigente</span>
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">No ar desde</dt>
          <dd>{f.publicado_em ? formatData(f.publicado_em) : "—"}</dd>
        </div>
        <div className="flex min-w-0 items-end gap-3">
          <span className="inline-flex items-center gap-1" title="AMEI">
            <Heart className="size-3.5 text-muted-foreground" aria-hidden />
            <span className="tabular-nums">{inteiro(f.amei)}</span>
            <span className="sr-only">AMEI</span>
          </span>
          <span className="inline-flex items-center gap-1" title="Pedidos de contato">
            <MessageSquare className="size-3.5 text-muted-foreground" aria-hidden />
            <span className="tabular-nums">{inteiro(f.pedidos)}</span>
            <span className="sr-only">pedidos de contato</span>
          </span>
          {f.denuncias_abertas > 0 && (
            <span
              className="inline-flex items-center gap-1 text-destructive"
              title="Denúncias abertas"
            >
              <Flag className="size-3.5" aria-hidden />
              <span className="tabular-nums">{inteiro(f.denuncias_abertas)}</span>
              <span className="sr-only">denúncias abertas</span>
            </span>
          )}
        </div>
      </dl>

      {motivo && f.status !== "publicado" && (
        <p className="rounded-md border border-border px-2.5 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Motivo: </span>
          {motivo}
        </p>
      )}
      {rodape}
    </article>
  );
}

/** Linha do tempo das decisões da equipe sobre o anúncio. */
export function HistoricoDecisoes({ f }: { f: FichaAnuncio }) {
  if (!f.historico.length) return null;
  return (
    <ol className="space-y-2 border-l border-border pl-3">
      {f.historico.map((h, i) => (
        <li key={`${h.em}-${i}`} className="text-xs">
          <p className="font-medium">{ACAO[h.acao] ?? h.acao}</p>
          <p className="tabular-nums text-muted-foreground">
            {dataHora(h.em)}
            {h.operador ? ` · ${h.operador}` : ""}
          </p>
          {h.motivo && <p className="mt-0.5 break-words text-muted-foreground">“{h.motivo}”</p>}
        </li>
      ))}
    </ol>
  );
}

/** Cartão de número clicável (a mesma peça da Rede e do Marketplace). */
export function Resumo({
  rotulo,
  valor,
  detalhe,
  alerta,
  carregando,
  onClick,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  alerta?: boolean;
  carregando: boolean;
  onClick?: () => void;
}) {
  const corpo = (
    <>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      {carregando ? (
        <Skeleton className="mt-1 h-7 w-16" />
      ) : (
        <p className="truncate text-xl font-semibold tabular-nums">{valor}</p>
      )}
      <p className="truncate text-[11px] text-muted-foreground">{detalhe}</p>
    </>
  );
  const cls = cn(
    "min-w-0 rounded-lg border bg-card p-3 text-left",
    alerta ? "border-amber-400/70" : "border-border",
    onClick ? "transition-colors hover:bg-muted/40" : "",
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>
      {corpo}
    </button>
  ) : (
    <div className={cls}>{corpo}</div>
  );
}

/** Lista vazia: o que aconteceu e o que vem depois. */
export function Vazio({
  icone,
  titulo,
  texto,
}: {
  icone: ReactNode;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
        {icone}
      </span>
      <p className="text-sm font-semibold">{titulo}</p>
      <p className="max-w-md text-sm text-muted-foreground">{texto}</p>
    </div>
  );
}

/** Campo do motivo, com contador (o anunciante lê o que for escrito aqui). */
export function CampoMotivo({
  id,
  valor,
  onValor,
  obrigatorio,
  max = 200,
  dica,
}: {
  id: string;
  valor: string;
  onValor: (v: string) => void;
  obrigatorio: boolean;
  max?: number;
  dica?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>Motivo{obrigatorio ? " (obrigatório)" : " (opcional)"}</Label>
      <Textarea
        id={id}
        rows={3}
        value={valor}
        maxLength={max}
        onChange={(e) => onValor(e.target.value.slice(0, max))}
        placeholder={dica ?? "O anunciante lê este texto. Seja claro e objetivo."}
      />
      <p className="text-right text-[11px] tabular-nums text-muted-foreground">
        {valor.length}/{max}
        {obrigatorio && valor.trim().length < 10 ? " · mínimo 10" : ""}
      </p>
    </div>
  );
}

export function Carregando() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
