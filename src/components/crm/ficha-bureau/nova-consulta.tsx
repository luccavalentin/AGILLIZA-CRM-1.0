import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Fingerprint,
  Loader2,
  ScanSearch,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buscarClientesCRM } from "@/lib/crm/clientes.functions";
import { exibirDocumento, mascararTelefone } from "@/lib/crm/documento";
import {
  BASES_LEGAIS,
  FINALIDADE_MAX,
  FINALIDADE_PADRAO,
  analisarDocumento,
  documentoDaConsulta,
  documentoMascarado,
  explicarIndisponivel,
  finalidadeRegistrada,
  formularioValido,
  mascararDigitacao,
  validarFormulario,
  type BaseLegal,
  type ClienteEscolhido,
  type Disponibilidade,
  type ModoConsulta,
} from "./logica";

export interface PedidoConsulta {
  documento: string;
  finalidade: string;
  /** Base legal e autorização como a pessoa marcou (a plataforma confere de novo). */
  base: BaseLegal;
  autorizou: boolean;
  cliente_id: string | null;
  /** Nome para o cartão de resultado (cliente do CRM ou o digitado). */
  nome: string | null;
}

/**
 * "Nova consulta" — o mesmo formulário da Consulta Ficha dos assinantes:
 *   1. quem consultar (cliente do CRM ou dados digitados);
 *   2. finalidade e base legal (LGPD), com a autorização do titular;
 *   3. consultar.
 * No Agilliza não há créditos: o correspondente usa o contrato de bureau dele
 * (Administração › Integrações), e o resumo mostra o fornecedor em vez do saldo.
 */
export function NovaConsulta({
  disp,
  carregandoConfig,
  podeConfigurar,
  clienteInicial,
  ocupado,
  erro,
  onConsultar,
  versao,
}: {
  disp: Disponibilidade;
  carregandoConfig: boolean;
  podeConfigurar: boolean;
  clienteInicial: ClienteEscolhido | null;
  ocupado: boolean;
  erro: string | null;
  onConsultar: (p: PedidoConsulta) => void;
  /** Muda a cada "Nova consulta" para limpar o formulário. */
  versao: number;
}) {
  const [modo, setModo] = useState<ModoConsulta>("crm");
  const [cliente, setCliente] = useState<ClienteEscolhido | null>(clienteInicial);
  const [documento, setDocumento] = useState("");
  const [nome, setNome] = useState("");
  const [finalidade, setFinalidade] = useState(FINALIDADE_PADRAO);
  const [base, setBase] = useState<BaseLegal>("consentimento");
  const [autorizou, setAutorizou] = useState(false);
  const [mostrarErros, setMostrarErros] = useState(false);

  useEffect(() => {
    if (clienteInicial) setCliente(clienteInicial);
  }, [clienteInicial]);

  useEffect(() => {
    if (versao === 0) return;
    setCliente(null);
    setDocumento("");
    setNome("");
    setAutorizou(false);
    setMostrarErros(false);
  }, [versao]);

  const form = { modo, cliente, documento, finalidade, base, autorizou };
  const erros = validarFormulario(form);
  const valido = formularioValido(erros);
  const precisaDigitarNoCrm =
    modo === "crm" && cliente != null && (!cliente.documento || documentoMascarado(cliente.documento));
  const docDigitado = analisarDocumento(documento);

  function trocarModo(m: ModoConsulta) {
    if (m === modo) return;
    setModo(m);
    setDocumento("");
    setMostrarErros(false);
  }

  function consultar() {
    setMostrarErros(true);
    if (!valido || !disp.disponivel || ocupado) return;
    onConsultar({
      documento: documentoDaConsulta(form),
      finalidade: finalidadeRegistrada(finalidade, base, autorizou),
      base,
      autorizou,
      cliente_id: modo === "crm" ? (cliente?.id ?? null) : null,
      nome: modo === "crm" ? (cliente?.nome ?? null) : nome.trim() || null,
    });
  }

  return (
    <section
      className="space-y-5 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5"
      data-tour="ficha-nova-consulta"
      aria-labelledby="fb-form-titulo"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
            {disp.fornecedor ?? "Bureau de crédito"}
          </p>
          <h2 id="fb-form-titulo" className="text-lg font-semibold text-foreground">
            Nova consulta
          </h2>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
          <ShieldCheck className="size-3.5" aria-hidden /> Registro LGPD
        </span>
      </header>

      {!carregandoConfig && !disp.disponivel && (
        <div className="flex flex-col gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm font-medium text-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" aria-hidden />
            <span>
              Consulta indisponível
              {(podeConfigurar || disp.motivo === "plataforma") && (
                <span className="block text-xs font-normal text-muted-foreground">
                  {explicarIndisponivel(disp)}
                </span>
              )}
            </span>
          </p>
          {podeConfigurar && disp.motivo !== "plataforma" && (
            <Link
              to={"/admin/integracoes" as string}
              className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground hover:border-primary/40 hover:text-primary"
            >
              Abrir Integrações <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          )}
        </div>
      )}

      {/* 1. Quem consultar */}
      <fieldset className="min-w-0 space-y-3" disabled={ocupado}>
        <legend className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Passo n={1} /> Quem consultar
        </legend>
        <div
          className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/50 p-1"
          role="tablist"
          aria-label="Como escolher quem consultar"
        >
          {(
            [
              ["crm", UserRound, "Cliente do CRM"],
              ["digitar", Fingerprint, "Digitar dados"],
            ] as const
          ).map(([m, Icone, rotulo]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={modo === m}
              onClick={() => trocarModo(m)}
              className={cn(
                "inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg px-2 text-sm font-medium transition",
                modo === m
                  ? "bg-background text-primary shadow-sm ring-1 ring-primary/15"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icone className="size-4 shrink-0" aria-hidden strokeWidth={1.6} />
              <span className="truncate">{rotulo}</span>
            </button>
          ))}
        </div>

        {modo === "crm" ? (
          cliente ? (
            <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
              <span
                className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                aria-hidden
              >
                {cliente.nome.trim().charAt(0).toUpperCase() || "?"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{cliente.nome}</p>
                <p className="truncate text-xs tabular-nums text-muted-foreground">
                  {cliente.documento ? exibirDocumento(cliente.documento) : "sem CPF/CNPJ no CRM"}
                  {cliente.celular ? ` · ${mascararTelefone(cliente.celular)}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCliente(null);
                  setDocumento("");
                }}
                className="grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground"
                aria-label="Trocar o cliente"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ) : (
            <BuscaCliente onEscolher={setCliente} />
          )
        ) : null}

        {(modo === "digitar" || precisaDigitarNoCrm) && (
          <div className="grid gap-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
            <div className="space-y-1.5">
              <Label htmlFor="fb-doc">CPF ou CNPJ</Label>
              <div className="relative">
                <Fingerprint className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" aria-hidden />
                <Input
                  id="fb-doc"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000.000.000-00"
                  value={documento}
                  onChange={(e) => setDocumento(mascararDigitacao(e.target.value))}
                  className="h-11 pl-9 pr-9 text-base tabular-nums sm:text-sm"
                  aria-invalid={Boolean(mostrarErros && erros.quem)}
                />
                {docDigitado.valido && (
                  <Check className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-success" aria-label="Documento válido" />
                )}
              </div>
            </div>
            {modo === "digitar" && (
              <div className="space-y-1.5">
                <Label htmlFor="fb-nome">Nome (opcional)</Label>
                <Input
                  id="fb-nome"
                  value={nome}
                  maxLength={120}
                  autoComplete="off"
                  placeholder="Para reconhecer no histórico"
                  onChange={(e) => setNome(e.target.value)}
                  className="h-11 text-base sm:text-sm"
                />
              </div>
            )}
          </div>
        )}
        {(mostrarErros || (docDigitado.digitos.length >= 11 && modo === "digitar")) && erros.quem && (
          <p className="text-xs font-medium text-destructive">{erros.quem}</p>
        )}
        {precisaDigitarNoCrm && !mostrarErros && (
          <p className="text-xs text-muted-foreground">
            {cliente?.documento
              ? "Seu acesso não mostra o documento completo deste cliente: digite o CPF/CNPJ."
              : "Este cliente não tem CPF/CNPJ no CRM: digite o documento."}
          </p>
        )}
      </fieldset>

      {/* 2. Finalidade e base legal */}
      <fieldset className="min-w-0 space-y-3" disabled={ocupado}>
        <legend className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Passo n={2} /> Finalidade e base legal (LGPD)
        </legend>
        <div className="space-y-1.5">
          <Label htmlFor="fb-fin">Finalidade da consulta</Label>
          <Textarea
            id="fb-fin"
            rows={2}
            maxLength={FINALIDADE_MAX}
            value={finalidade}
            onChange={(e) => setFinalidade(e.target.value)}
            className="resize-none text-base sm:text-sm"
            aria-invalid={Boolean(mostrarErros && erros.finalidade)}
          />
          {mostrarErros && erros.finalidade && (
            <p className="text-xs font-medium text-destructive">{erros.finalidade}</p>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Base legal">
          {BASES_LEGAIS.map((b) => (
            <button
              key={b.valor}
              type="button"
              role="radio"
              aria-checked={base === b.valor}
              onClick={() => setBase(b.valor)}
              className={cn(
                "flex min-h-11 min-w-0 items-start gap-2.5 rounded-xl border p-3 text-left transition",
                base === b.valor
                  ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                  : "border-border bg-background hover:border-primary/30",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                  base === b.valor ? "border-primary" : "border-muted-foreground/40",
                )}
                aria-hidden
              >
                {base === b.valor && <span className="size-2 rounded-full bg-primary" />}
              </span>
              <span className="min-w-0">
                <b className="block text-sm font-medium text-foreground">{b.rotulo}</b>
                <small className="block text-xs text-muted-foreground">{b.ajuda}</small>
              </span>
            </button>
          ))}
        </div>
        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-xl border p-3",
            mostrarErros && erros.autorizacao ? "border-destructive/40 bg-destructive/5" : "border-border",
          )}
        >
          <Checkbox
            checked={autorizou}
            onCheckedChange={(v) => setAutorizou(v === true)}
            className="mt-0.5"
            aria-label="Tenho autorização do titular para esta consulta"
          />
          <span className="min-w-0">
            <b className="block text-sm font-medium text-foreground">
              Tenho autorização do titular para esta consulta
            </b>
            <small className="block text-xs text-muted-foreground">
              {base === "consentimento"
                ? "Obrigatório com base no consentimento. Guarde a autorização."
                : "Recomendado. Fica registrado com quem consultou e por quê."}
            </small>
          </span>
        </label>
        {mostrarErros && erros.autorizacao && (
          <p className="text-xs font-medium text-destructive">{erros.autorizacao}</p>
        )}
      </fieldset>

      {/* 3. Consultar */}
      <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-3 sm:p-4">
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Fornecedor</dt>
            <dd className="truncate font-medium">{disp.fornecedor ?? "Não contratado"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Base legal</dt>
            <dd className="truncate font-medium">
              {BASES_LEGAIS.find((b) => b.valor === base)?.rotulo}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Registro</dt>
            <dd className="truncate font-medium">Operador, data e finalidade</dd>
          </div>
        </dl>
        {erro && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {erro}
          </p>
        )}
        <button
          type="button"
          onClick={consultar}
          disabled={!disp.disponivel || ocupado}
          className="flex min-h-[52px] w-full items-center gap-2.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-md ring-1 ring-primary/20 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          {ocupado ? (
            <Loader2 className="size-[18px] animate-spin" aria-hidden />
          ) : (
            <ScanSearch className="size-[18px]" aria-hidden strokeWidth={1.6} />
          )}
          {!disp.disponivel ? "Consulta indisponível" : ocupado ? "Consultando…" : "Consultar agora"}
          <ArrowRight className="ml-auto size-[18px]" aria-hidden strokeWidth={1.6} />
        </button>
        <p className="text-xs text-muted-foreground">
          Consulte apenas com base legal: cliente em negociação ou proposta em andamento. Toda
          consulta fica no histórico, inclusive a que não for concluída.
        </p>
      </div>
    </section>
  );
}

function Passo({ n }: { n: number }) {
  return (
    <span
      className="grid size-[22px] shrink-0 place-items-center rounded-full border border-primary/30 text-[11px] font-semibold text-primary"
      aria-hidden
    >
      {n}
    </span>
  );
}

/** Busca incremental no CRM (nome, CPF/CNPJ, e-mail ou nº do cliente). */
function BuscaCliente({ onEscolher }: { onEscolher: (c: ClienteEscolhido) => void }) {
  const buscarFn = useServerFn(buscarClientesCRM);
  const [q, setQ] = useState("");
  const [termo, setTermo] = useState("");
  const [aberta, setAberta] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTermo(q.trim()), q.trim().length >= 2 ? 220 : 0);
    return () => clearTimeout(t);
  }, [q]);

  const busca = useQuery({
    queryKey: ["ficha-bureau-buscar-clientes", termo],
    queryFn: () => buscarFn({ data: { q: termo } }),
    enabled: termo.length >= 2,
    staleTime: 30_000,
  });
  const resultados = (busca.data ?? []) as Array<{
    id: string;
    nome: string;
    documento: string | null;
    email: string | null;
    telefone_celular?: string | null;
  }>;

  return (
    <div className="relative min-w-0">
      <Label htmlFor="fb-busca" className="sr-only">
        Buscar cliente
      </Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id="fb-busca"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setAberta(true);
          }}
          onFocus={() => setAberta(true)}
          placeholder="Nome, CPF/CNPJ ou e-mail do cliente"
          autoComplete="off"
          aria-controls="fb-lista-clientes"
          className="h-11 pl-9 pr-9 text-base sm:text-sm"
        />
        {busca.isFetching && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
        )}
      </div>
      {aberta && (
        <ul
          id="fb-lista-clientes"
          role="listbox"
          aria-label="Clientes do CRM"
          className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg"
        >
          {termo.length < 2 ? (
            <li className="px-3 py-3 text-center text-xs text-muted-foreground">
              Digite ao menos 2 letras ou números para buscar no CRM.
            </li>
          ) : busca.isError ? (
            <li className="px-3 py-3 text-center text-xs text-destructive">
              Não foi possível buscar agora. Tente de novo.
            </li>
          ) : busca.isLoading ? (
            <li className="px-3 py-3 text-center text-xs text-muted-foreground">Buscando…</li>
          ) : resultados.length === 0 ? (
            <li className="px-3 py-3 text-center text-xs text-muted-foreground">
              Nenhum cliente encontrado. Use “Digitar dados” para consultar mesmo assim.
            </li>
          ) : (
            resultados.slice(0, 8).map((c) => (
              <li key={c.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onClick={() => {
                    onEscolher({
                      id: c.id,
                      nome: c.nome,
                      documento: c.documento,
                      celular: c.telefone_celular ?? null,
                    });
                    setAberta(false);
                    setQ("");
                  }}
                  className="flex min-h-11 w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-primary/5"
                >
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm font-medium text-foreground">{c.nome}</b>
                    <small className="block truncate text-xs text-muted-foreground">
                      {c.email ?? "sem e-mail"}
                    </small>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {c.documento ? exibirDocumento(c.documento) : "sem CPF/CNPJ"}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
