import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  Clock,
  FileText,
  History,
  Home,
  Landmark,
  Lock,
  Paperclip,
  User,
  Users,
  Wallet,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL, formatData } from "@/lib/financeiro/format";
import {
  detalhePropostaAssinante,
  ROTULO_PROPOSTA_ASSINANTE,
  type DetalhePropostaAssinante,
  type PropostaAssinante,
} from "@/lib/plataforma/fila.functions";
import { AcoesPainel, SeloSituacao, rotuloSituacao } from "./acoes";
import { AvisoPermissao, MENSAGEM_SEM_CONTAS } from "./aviso-permissao";

const TIPO_IMOVEL: Record<string, string> = {
  apartamento: "Apartamento",
  casa: "Casa",
  casa_condominio: "Casa em condomínio",
  cobertura: "Cobertura",
  kitnet: "Kitnet",
  terreno: "Terreno",
  terreno_condominio: "Terreno em condomínio",
  sala_comercial: "Sala comercial",
  loja: "Loja",
  galpao: "Galpão",
  predio: "Prédio",
};
const ESTADO_CIVIL: Record<string, string> = {
  solteiro: "Solteiro(a)",
  casado: "Casado(a)",
  uniao_estavel: "União estável",
  divorciado: "Divorciado(a)",
  separado: "Separado(a)",
  viuvo: "Viúvo(a)",
};
const PERFIL_DOC: Record<string, string> = {
  titular: "Titular",
  conjuge: "Cônjuge",
  participante: "Participante",
  imovel: "Imóvel",
  vendedor: "Vendedor",
};
const STATUS_DOC: Record<string, string> = {
  pendente: "Pendente",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
};
const TITULO_EVENTO: Record<string, string> = {
  criada: "Proposta criada",
  envio: "Enviada ao banco",
  status: "Situação alterada",
  sincronizacao: "Consulta ao banco",
  exigencia: "Exigência registrada",
  nota: "Anotação",
  atribuicao: "Analista designado",
  erro: "Falha no envio",
  documentos: "Documentos enviados ao banco",
  assumida: "Assumida pelo correspondente",
};

const txt = (v: string | null | undefined) => (v && String(v).trim() ? String(v) : "—");
const moeda = (v: number | string | null | undefined) =>
  v == null || v === "" ? "—" : formatBRL(Number(v));
const pct = (v: number | string | null | undefined) =>
  v == null ? "—" : `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% a.a.`;
function telefone(v: string | null | undefined) {
  const d = (v ?? "").replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return txt(v);
}
/** CPF/CNPJ formatado quando vem completo; o que vier diferente passa como está. */
function documento(v: string | null | undefined) {
  const d = (v ?? "").replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return txt(v);
}
function dataHora(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function Secao({
  icone,
  titulo,
  children,
}: {
  icone: ReactNode;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="text-primary [&>svg]:size-3.5">{icone}</span>
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function Campos({ itens }: { itens: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-2.5 rounded-xl border border-border/60 bg-card p-3 text-sm min-[420px]:grid-cols-2">
      {itens.map(([rotulo, valor]) => (
        <div key={rotulo} className="min-w-0">
          <dt className="text-[11px] text-muted-foreground">{rotulo}</dt>
          <dd className="break-words font-medium text-foreground">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Painel com TUDO o que o assinante mandou, para conferir antes de agir. Dados exigem
 * `saas.contas` (ver a base da conta); as ações, `saas.fila`.
 */
export function DetalhePropostaSheet({
  proposta,
  onFechar,
  onDesignar,
  onDevolver,
}: {
  proposta: PropostaAssinante | null;
  onFechar: () => void;
  onDesignar: (p: PropostaAssinante) => void;
  onDevolver: (p: PropostaAssinante) => void;
}) {
  const podeVerDados = usePermissao("saas.contas", "view");
  const detalheFn = useServerFn(detalhePropostaAssinante);
  const q = useQuery({
    queryKey: ["proposta-assinante", proposta?.id],
    queryFn: () => detalheFn({ data: { id: proposta!.id } }),
    enabled: !!proposta && podeVerDados,
    staleTime: 30_000,
  });
  const d = q.data;
  const p = proposta;

  return (
    // Modal centralizado, à frente de tudo (pedido do dono, 21/10/2026): o painel
    // lateral ficava espremido à direita. Cabeçalho e ações fixos; o meio rola.
    <Dialog open={!!p} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="gap-0 p-0 sm:max-w-3xl w-[calc(100%-1.5rem)] max-h-[92dvh] sm:max-h-[88vh]">
        {p && (
          <>
            <DialogHeader className="mb-0 space-y-1.5 border-b border-border/60 px-4 pb-4 pr-12 pt-5 text-left sm:px-6 sm:pr-14">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-base tabular-nums">{p.codigo}</DialogTitle>
                {d?.id_op && (
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    ID {d.id_op}
                  </span>
                )}
                <SeloSituacao status={d?.status ?? p.status} atrasada={d?.atrasada ?? p.atrasada} banco={p.banco} />
              </div>
              <DialogDescription className="text-left">
                {p.cliente} · {p.conta} (
                {p.conta_tipo === "imobiliaria" ? "imobiliária" : "corretor"})
              </DialogDescription>
              {d?.agilliza?.numero_proposta && (
                <p className="text-xs font-medium text-primary">
                  Proposta no Agilliza: {d.agilliza.numero_proposta}
                </p>
              )}
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:px-6 sm:py-5">
              {!podeVerDados ? (
                <AvisoPermissao texto={MENSAGEM_SEM_CONTAS} />
              ) : q.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-xl" />
                  ))}
                </div>
              ) : q.isError || !d ? (
                <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {mensagemDeErro(q.error, "Não foi possível carregar os dados da proposta.")}
                </p>
              ) : (
                <Conteudo d={d} />
              )}
            </div>

            <div className="shrink-0 border-t border-border/60 bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
              <AcoesPainel
                proposta={{
                  ...p,
                  status: d?.status ?? p.status,
                  pendente: d?.pendente ?? p.pendente,
                  minha: d?.minha ?? p.minha,
                  analista: d?.analista ?? p.analista,
                  banco: d?.banco.nome ?? p.banco,
                  proposta_agilliza_id: d?.agilliza?.proposta_id ?? p.proposta_agilliza_id,
                }}
                onDesignar={() => onDesignar(p)}
                onDevolver={() => onDevolver(p)}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Conteudo({ d }: { d: DetalhePropostaAssinante }) {
  const c = d.cliente;
  const s = d.simulacao;
  const i = d.imovel;
  const endereco = [i.logradouro, i.numero, i.complemento, i.bairro].filter(Boolean).join(", ");
  const cidade = [i.cidade, i.uf].filter(Boolean).join("/");
  const anexados = d.documentos.filter((x) => x.anexado).length;

  return (
    <>
      <Secao icone={<Clock />} titulo="Situação">
        <Campos
          itens={[
            ["Situação", rotuloSituacao(d.status)],
            ["Recebida em", dataHora(d.criado_em)],
            ["Analista", d.analista ?? (d.pendente ? "Aguardando um analista" : "—")],
            ["Prazo (SLA)", d.sla_ate ? dataHora(d.sla_ate) : "—"],
            ["Número no banco", txt(d.numero_proposta_banco)],
            ["ID", txt(d.id_op)],
            ["Proposta no Agilliza", txt(d.agilliza?.numero_proposta)],
          ]}
        />
        {d.mensagem_banco && (
          <p className="rounded-xl border border-border/60 bg-muted/40 p-3 text-sm">
            <span className="font-medium">Retorno do banco: </span>
            {d.mensagem_banco}
          </p>
        )}
        {d.aprovado && (
          <Campos
            itens={[
              ["Valor aprovado", moeda(d.aprovado.valor)],
              ["Parcela aprovada", moeda(d.aprovado.parcela)],
              ["Prazo aprovado", d.aprovado.prazo ? `${d.aprovado.prazo} meses` : "—"],
              ["Taxa aprovada", pct(d.aprovado.taxa)],
            ]}
          />
        )}
      </Secao>

      <Secao icone={<Landmark />} titulo={`Simulação do assinante (${s.codigo})`}>
        <CotacoesDoAssinante d={d} />
      </Secao>

      <Secao icone={<User />} titulo="Cliente">
        <Campos
          itens={[
            ["Nome", txt(c.nome)],
            [
              c.tipo_pessoa === "PJ" ? "CNPJ" : "CPF",
              documento(c.documento ?? c.documento_mascarado),
            ],
            ["Nascimento", formatData(c.nascimento)],
            [
              "Estado civil",
              c.estado_civil ? (ESTADO_CIVIL[c.estado_civil] ?? c.estado_civil) : "—",
            ],
            ["Renda", moeda(c.renda)],
            ["Profissão", txt(c.profissao)],
            ["Celular", telefone(c.celular)],
            ["E-mail", txt(c.email)],
            [
              "Endereço",
              [c.logradouro, c.numero, c.complemento, c.bairro].filter(Boolean).join(", ") || "—",
            ],
            [
              "Cidade / CEP",
              [[c.cidade, c.uf].filter(Boolean).join("/"), c.cep].filter(Boolean).join(" · ") ||
                "—",
            ],
          ]}
        />
      </Secao>

      {(d.conjuge || d.participantes.length > 0) && (
        <Secao icone={<Users />} titulo="Cônjuge e participantes">
          {d.conjuge && (
            <Campos
              itens={[
                ["Cônjuge", txt(d.conjuge.nome)],
                ["CPF", documento(d.conjuge.documento ?? d.conjuge.documento_mascarado)],
                ["Renda", moeda(d.conjuge.renda)],
                ["Compõe renda", d.conjuge.compoe_renda ? "Sim" : "Não"],
              ]}
            />
          )}
          {d.participantes.map((x, k) => (
            <Campos
              key={k}
              itens={[
                [`Participante${x.vinculo ? ` (${x.vinculo})` : ""}`, txt(x.nome)],
                ["CPF", documento(x.documento ?? x.documento_mascarado)],
                ["Renda", moeda(x.renda)],
              ]}
            />
          ))}
        </Secao>
      )}

      <Secao icone={<Wallet />} titulo="Valores">
        <Campos
          itens={[
            ["Valor do imóvel", moeda(s.valor_imovel)],
            ["Financiamento", moeda(s.valor_financiamento)],
            ["Entrada", moeda(s.valor_entrada)],
            ["Prazo", s.prazo ? `${s.prazo} meses` : "—"],
            ["Sistema", txt(d.banco.sistema ?? s.sistema)],
            ["Renda total", moeda(s.renda_total)],
            ["Usa FGTS", s.usa_fgts ? "Sim" : "Não"],
            [
              "Financiar despesas",
              s.financiar_despesas ? `Sim (${moeda(s.valor_despesas)})` : "Não",
            ],
          ]}
        />
      </Secao>

      <Secao icone={<Home />} titulo="Imóvel">
        <Campos
          itens={[
            ["Tipo", i.tipo ? (TIPO_IMOVEL[i.tipo] ?? i.tipo) : "—"],
            ["Uso / situação", [i.uso, i.situacao].filter(Boolean).join(" · ") || "—"],
            ["Endereço", endereco || "—"],
            ["Cidade", cidade || "—"],
            ["CEP", txt(i.cep)],
            [
              "Contato da avaliação",
              i.contato_avaliacao
                ? `${i.contato_avaliacao}${i.contato_avaliacao_telefone ? ` · ${telefone(i.contato_avaliacao_telefone)}` : ""}`
                : "—",
            ],
          ]}
        />
      </Secao>

      <Secao
        icone={<Paperclip />}
        titulo={`Documentos (${anexados} de ${d.documentos.length} anexados)`}
      >
        {d.documentos.length === 0 ? (
          <p className="text-sm text-muted-foreground">O assinante não anexou documentos.</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
            {d.documentos.map((doc) => (
              <li key={doc.id} className="flex items-center gap-3 p-3 text-sm">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{txt(doc.descricao)}</p>
                  <p className="text-xs text-muted-foreground">
                    {PERFIL_DOC[doc.perfil] ?? doc.perfil}
                    {doc.participante ? ` · ${doc.participante}` : ""} ·{" "}
                    {doc.anexado ? (STATUS_DOC[doc.status] ?? doc.status) : "Não anexado"}
                  </p>
                </div>
                {doc.arquivo ? (
                  <a
                    href={doc.arquivo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 items-center rounded-md px-3 text-sm font-medium text-primary hover:bg-primary/5 md:h-8"
                  >
                    Abrir
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {!d.minha && d.documentos.some((x) => x.anexado) && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" /> Os arquivos abrem depois que a proposta é assumida por
            você.
          </p>
        )}
      </Secao>

      {d.exigencias.length > 0 && (
        <Secao icone={<FileText />} titulo="Exigências">
          <ul className="space-y-2">
            {d.exigencias.map((e, k) => (
              <li key={k} className="rounded-xl border border-border/60 bg-card p-3 text-sm">
                <p>{e.descricao}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {e.status === "atendida"
                    ? `Atendida em ${formatData(e.atendida_em)}`
                    : "Pendente"}{" "}
                  · aberta em {formatData(e.criado_em)}
                </p>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      <Secao icone={<History />} titulo="Histórico">
        {d.eventos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem eventos.</p>
        ) : (
          <ol className="relative space-y-3 border-l border-border/70 pl-4">
            {d.eventos.map((e, k) => (
              <li key={k} className="text-sm">
                <span className="absolute -left-[4.5px] mt-1.5 size-2 rounded-full bg-primary/60" />
                <p className="font-medium">
                  {e.descricao ??
                    (e.status_para
                      ? `${TITULO_EVENTO[e.tipo] ?? e.tipo}: ${ROTULO_PROPOSTA_ASSINANTE[e.status_para] ?? e.status_para}`
                      : (TITULO_EVENTO[e.tipo] ?? e.tipo))}
                </p>
                <p className="text-xs text-muted-foreground">
                  {dataHora(e.criado_em)}
                  {e.autor ? ` · ${e.autor}` : e.automatico ? " · automático" : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Secao>

      <Secao icone={<Building2 />} titulo="Conta e quem enviou">
        <Campos
          itens={[
            ["Conta", d.conta ? `${d.conta.nome}` : "—"],
            ["Tipo", d.conta?.tipo === "imobiliaria" ? "Imobiliária" : "Corretor"],
            [
              "CRECI",
              d.conta?.creci
                ? `${d.conta.creci}${d.conta.creci_uf ? `/${d.conta.creci_uf}` : ""}`
                : "—",
            ],
            [
              "Contato da conta",
              d.conta?.celular ? telefone(d.conta.celular) : txt(d.conta?.email),
            ],
            ["Enviada por", txt(d.enviado_por?.nome)],
            [
              "Contato de quem enviou",
              d.enviado_por?.celular ? telefone(d.enviado_por.celular) : txt(d.enviado_por?.email),
            ],
          ]}
        />
      </Secao>
    </>
  );
}

const ESTADO_COTACAO: Record<string, string> = {
  cotado: "Cotado",
  erro: "Recusado",
  enviado: "Aguardando o banco",
  aguardando_cotacao: "Aguardando o banco",
  preparando: "Preparando",
};

/** A simulação que o corretor/imobiliária já fez: bancos, parcelas, taxas e o escolhido. */
function CotacoesDoAssinante({ d }: { d: DetalhePropostaAssinante }) {
  const lista = d.cotacoes ?? [];
  if (lista.length === 0) {
    return <p className="text-sm text-muted-foreground">O assinante não tem cotação registrada.</p>;
  }
  return (
    <ul className="space-y-2">
      {lista.map((c, k) => (
        <li
          key={`${c.banco_id}-${c.sistema}-${k}`}
          className={
            c.escolhida
              ? "rounded-xl border border-primary/40 bg-primary/5 p-3 ring-1 ring-inset ring-primary/15"
              : "rounded-xl border border-border/60 bg-card p-3"
          }
        >
          <div className="flex items-center gap-3">
            <BancoLogo nome={c.banco} size="md" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                {c.banco}
                <span className="text-xs font-normal text-muted-foreground">{c.sistema}</span>
                {c.escolhida && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                    Escolhido pelo assinante
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {ESTADO_COTACAO[c.estado] ?? c.estado}
                {c.prazo ? ` · ${c.prazo} meses` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums">{moeda(c.parcela)}</p>
              <p className="text-[11px] text-muted-foreground">1ª parcela</p>
            </div>
          </div>
          {c.estado === "erro" && c.erro ? (
            <p className="mt-2 text-xs text-destructive">{c.erro}</p>
          ) : (
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs min-[420px]:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Taxa</dt>
                <dd className="font-medium tabular-nums">{pct(c.taxa_juros_aa)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">CET</dt>
                <dd className="font-medium tabular-nums">{pct(c.cet_aa)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Última parcela</dt>
                <dd className="font-medium tabular-nums">{moeda(c.ultima_parcela)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Financiado</dt>
                <dd className="font-medium tabular-nums">{moeda(c.valor_financiado)}</dd>
              </div>
            </dl>
          )}
        </li>
      ))}
    </ul>
  );
}
