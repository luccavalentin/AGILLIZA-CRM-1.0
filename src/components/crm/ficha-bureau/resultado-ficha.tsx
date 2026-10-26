import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  ChevronDown,
  FileText,
  FileWarning,
  Gauge,
  Mail,
  MapPin,
  Phone,
  Printer,
  Receipt,
  Scale,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/simulacao/format";
import { exibirDocumento } from "@/lib/crm/documento";
import type { FichaBureau } from "@/lib/bureau/tipos";
import { MedidorScore } from "./medidor-score";
import { Icone3D, type TomIcone3D } from "@/components/ui/icone-3d";
import { pluralizar, resumirFicha, tomDoFator, type ChaveFator, type Tom } from "./logica";

/** Classes por tom (tokens; vermelho só para alerta de verdade). */
export const CLASSE_TOM: Record<Tom | "info", string> = {
  sucesso: "border-success/25 bg-success/10 text-success-texto",
  alerta: "border-warning/30 bg-warning/15 text-warning-foreground",
  perigo: "border-destructive/25 bg-destructive/10 text-destructive",
  neutro: "border-border bg-muted text-muted-foreground",
  info: "border-primary/20 bg-primary/10 text-primary",
};

export function Selo({
  tom,
  children,
  ponto,
  className,
}: {
  tom: Tom | "info";
  children: ReactNode;
  ponto?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        CLASSE_TOM[tom],
        className,
      )}
    >
      {ponto && <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden />}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Peça 3D do Agilliza (`Icone3D`) no tom da ficha; vermelho só para alerta de verdade. */
const TOM_3D: Record<Tom | "info", TomIcone3D> = {
  sucesso: "sucesso",
  alerta: "alerta",
  perigo: "perigo",
  neutro: "neutro",
  info: "marca",
};

export function Ladrilho({ icone, tom, grande }: { icone: LucideIcon; tom: Tom | "info"; grande?: boolean }) {
  return <Icone3D icone={icone} tom={TOM_3D[tom]} tamanho={grande ? "lg" : "md"} />;
}

const ICONE_FATOR: Record<ChaveFator, LucideIcon> = {
  pendencias: AlertTriangle,
  protestos: FileWarning,
  cheques: Receipt,
  acoes: Scale,
};

function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return "agora";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "agora";
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

const ICONE_CONTATO = { telefone: Phone, email: Mail, endereco: MapPin } as const;

/**
 * Resultado da consulta: o mesmo cartão na tela da consulta e no relatório completo.
 * O resumo vem de `resumirFicha`: o que o fornecedor não informou aparece como
 * "não informado", nunca como "nada consta".
 */
export function ResultadoFicha({
  ficha,
  titulo,
  documento,
  quando,
  consultaId,
  clienteId,
  fornecedor,
  completo = false,
  onAbrirRelatorio,
  acoesExtras,
}: {
  ficha: FichaBureau;
  /** Nome do cliente do CRM (senão o nome devolvido na ficha). */
  titulo?: string | null;
  documento?: string | null;
  quando?: string | null;
  consultaId?: string | null;
  clienteId?: string | null;
  fornecedor?: string | null;
  /** No relatório completo os detalhes já abrem e há botão de imprimir. */
  completo?: boolean;
  onAbrirRelatorio?: () => void;
  acoesExtras?: ReactNode;
}) {
  const [aberto, setAberto] = useState(completo);
  const r = resumirFicha(ficha);
  const nome = titulo || r.titulo;
  const doc = exibirDocumento(documento ?? ficha.documento) || "—";

  return (
    <section
      className="space-y-5 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5"
      aria-labelledby="fb-resultado-titulo"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
            Resultado{fornecedor ? ` · ${fornecedor}` : ""}
          </p>
          <h2 id="fb-resultado-titulo" className="mt-0.5 truncate text-lg font-semibold text-foreground">
            {nome ?? doc}
          </h2>
          <p className="text-xs tabular-nums text-muted-foreground">
            {nome ? `${doc} · ` : ""}
            {r.situacao ? `${r.situacao} · ` : ""}
            {formatarDataHora(quando ?? ficha.consultadoEm)}
          </p>
        </div>
        {r.apontamentos != null && (
          <Selo tom={r.apontamentos > 0 ? "alerta" : "sucesso"} ponto>
            {r.apontamentos > 0 ? pluralizar(r.apontamentos, "apontamento") : "Sem apontamentos"}
          </Selo>
        )}
      </header>

      <div className="flex flex-wrap items-center justify-center gap-5">
        {r.score != null ? (
          <MedidorScore
            score={r.score}
            id={`fb-arco-${consultaId ?? "novo"}${completo ? "-c" : ""}`}
            legenda={`Score${r.faixa ? ` · ${r.faixa.toLowerCase()}` : ""}`}
          />
        ) : (
          <div className="grid w-60 max-w-full justify-items-center gap-2 text-center">
            <Ladrilho icone={Gauge} tom="neutro" grande />
            <p className="text-sm text-muted-foreground">
              O fornecedor não devolveu score para este documento.
            </p>
          </div>
        )}
        <div className="grid min-w-[min(100%,240px)] flex-1 gap-2">
          {r.faixa && (
            <Fator icone={Gauge} tom={r.tom} valor={r.faixa} rotulo="Faixa de risco" />
          )}
          {r.fatores.map((f) => (
            <Fator
              key={f.chave}
              icone={ICONE_FATOR[f.chave]}
              tom={tomDoFator(f.valor)}
              valor={f.valor == null ? "—" : f.valor.toLocaleString("pt-BR")}
              rotulo={`${f.rotulo}${f.valor == null ? " · não informado" : f.valor === 0 ? " · nada encontrado" : ""}`}
            />
          ))}
          {r.valorTotal != null && (
            <Fator icone={Wallet} tom="perigo" valor={formatBRL(r.valorTotal)} rotulo="Valor em aberto informado" />
          )}
          {r.probabilidade != null && (
            <Fator
              icone={AlertTriangle}
              tom={r.probabilidade >= 10 ? "alerta" : "neutro"}
              valor={`${r.probabilidade.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
              rotulo="Chance de inadimplência em 12 meses"
            />
          )}
        </div>
      </div>

      <div className="fb-nao-imprimir flex flex-wrap gap-2">
        {!completo && onAbrirRelatorio && (
          <button
            type="button"
            onClick={onAbrirRelatorio}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm ring-1 ring-primary/20 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FileText className="size-4" aria-hidden /> Relatório completo
          </button>
        )}
        {clienteId && (
          <Link
            to="/crm/clientes/$id"
            params={{ id: clienteId }}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground transition hover:border-primary/40 hover:text-primary"
          >
            <UserRound className="size-4" aria-hidden /> Ficha do cliente
          </Link>
        )}
        {completo && (
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground transition hover:border-primary/40 hover:text-primary"
          >
            <Printer className="size-4" aria-hidden /> Imprimir
          </button>
        )}
        {acoesExtras}
      </div>

      <div className="rounded-xl border border-border/70">
        <button
          type="button"
          className="fb-nao-imprimir flex min-h-11 w-full items-center justify-between gap-2 px-4 text-left text-sm font-medium text-foreground"
          aria-expanded={aberto}
          onClick={() => setAberto((v) => !v)}
        >
          Todos os dados devolvidos pelo fornecedor
          <ChevronDown className={cn("size-4 shrink-0 transition-transform", aberto && "rotate-180")} aria-hidden />
        </button>
        {aberto && <DetalhesFicha ficha={ficha} />}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Consulta registrada com quem consultou, a data e a finalidade (LGPD). Use a ficha como
        apoio à análise de crédito.
      </p>
    </section>
  );
}

function Fator({
  icone,
  tom,
  valor,
  rotulo,
}: {
  icone: LucideIcon;
  tom: Tom;
  valor: string;
  rotulo: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border/70 bg-muted/40 px-3 py-2">
      <Ladrilho icone={icone} tom={tom} />
      <div className="min-w-0">
        <b className="block truncate text-sm font-semibold tabular-nums text-foreground">{valor}</b>
        <small className="block truncate text-xs text-muted-foreground">{rotulo}</small>
      </div>
    </div>
  );
}

function Secao({ titulo, icone: Icone, children }: { titulo: string; icone: LucideIcon; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <Icone className="size-3.5" aria-hidden /> {titulo}
      </p>
      {children}
    </div>
  );
}

const Nenhum = ({ texto }: { texto: string }) => (
  <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{texto}</p>
);

/** Detalhe da ficha, organizado por seção (a lista crua do fornecedor nunca chega aqui). */
export function DetalhesFicha({ ficha }: { ficha: FichaBureau }) {
  const restricoes = Array.isArray(ficha.restricoes) ? ficha.restricoes.filter(Boolean) : [];
  const consultas = Array.isArray(ficha.consultasAnteriores) ? ficha.consultasAnteriores.filter(Boolean) : [];
  const participacoes = Array.isArray(ficha.participacoes) ? ficha.participacoes.filter(Boolean) : [];
  const contatos = Array.isArray(ficha.contatos) ? ficha.contatos.filter(Boolean) : [];
  return (
    <div className="space-y-5 border-t border-border/70 p-4">
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">
            {ficha.tipoPessoa === "J" ? "Fundação" : "Nascimento"}
          </dt>
          <dd className="font-medium tabular-nums">{formatarData(ficha.nascimentoOuFundacao)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Renda presumida</dt>
          <dd className="font-medium tabular-nums">
            {ficha.rendaPresumida != null ? formatBRL(ficha.rendaPresumida) : "Não informada"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Modelo do score</dt>
          <dd className="font-medium">{ficha.score?.modelo ?? "—"}</dd>
        </div>
      </dl>

      <Secao titulo="Restrições" icone={AlertTriangle}>
        {restricoes.length === 0 ? (
          <Nenhum texto="Nenhuma restrição informada pelo fornecedor." />
        ) : (
          <ul className="divide-y divide-border/70 rounded-xl border border-border/70">
            {restricoes.map((x, i) => (
              <li key={i} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {x.tipo || "Restrição"} <span className="text-muted-foreground">· {x.origem || "—"}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[x.credor, x.local, x.descricao].filter(Boolean).join(" · ") || "Sem detalhe"}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs tabular-nums sm:justify-end">
                  <span className="text-muted-foreground">{formatarData(x.data)}</span>
                  <span className="font-semibold text-destructive">
                    {x.valor != null ? formatBRL(x.valor) : "—"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao titulo="Consultas anteriores ao documento" icone={CalendarClock}>
        {consultas.length === 0 ? (
          <Nenhum texto="Nenhuma consulta anterior informada." />
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {consultas.map((c, i) => (
              <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs">
                <span className="truncate font-medium text-foreground">
                  {c.empresa ?? "Empresa não informada"}
                  {c.segmento ? <span className="text-muted-foreground"> · {c.segmento}</span> : null}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{formatarData(c.data)}</span>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao titulo="Participações em empresas" icone={Building2}>
        {participacoes.length === 0 ? (
          <Nenhum texto="Nenhuma participação informada." />
        ) : (
          <ul className="grid gap-1.5">
            {participacoes.map((p, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs">
                <span className="min-w-0 truncate font-medium text-foreground">{p.razaoSocial}</span>
                <span className="tabular-nums text-muted-foreground">
                  {exibirDocumento(p.cnpj) || p.cnpj}
                  {p.participacao != null ? ` · ${p.participacao}%` : ""}
                  {p.situacao ? ` · ${p.situacao}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao titulo="Contatos" icone={Phone}>
        {contatos.length === 0 ? (
          <Nenhum texto="Nenhum contato informado (ou seu acesso não mostra dados sensíveis)." />
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {contatos.map((c, i) => {
              const Icone = ICONE_CONTATO[c.tipo] ?? Phone;
              return (
                <li key={i} className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs">
                  <Icone className="size-3.5 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0 break-words text-foreground">{c.valor}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Secao>
    </div>
  );
}
