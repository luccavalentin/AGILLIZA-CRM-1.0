import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Database,
  FileSearch,
  HardHat,
  Keyboard,
  Loader2,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminHero } from "@/components/admin/admin-hero";
import { FichaBureauView } from "@/components/bureau/ficha-bureau-view";
import {
  consultarFichaBureau,
  listarConsultasBureau,
  obterConfigBureau,
} from "@/lib/bureau/bureau.functions";
import { buscarClientesCRM } from "@/lib/crm/clientes.functions";
import type { FichaBureau } from "@/lib/bureau/tipos";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { assertModuloPermitido } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/crm/ficha-bureau")({
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  head: () => ({ meta: [{ title: "Consulta Ficha Cliente — Agilliza" }] }),
  component: Pagina,
});

/** 000.000.000-00 / 00.000.000/0000-00, conforme o tamanho. */
function mascararDocumento(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

/**
 * Documento pronto para a tela.
 *
 * Quem não tem permissão de PII recebe o documento já mascarado pelo servidor
 * ("***.***.123-**"). `mascararDocumento` só olha dígitos e transformaria isso
 * em "123" — pior do que não mostrar. Nesse caso exibimos o que veio.
 */
function exibirDocumento(doc: string): string {
  if (!doc) return "—";
  return doc.includes("*") ? doc : mascararDocumento(doc);
}

const FINALIDADES = [
  "Análise de crédito imobiliário",
  "Cadastro de cliente",
  "Revisão de proposta em andamento",
];

/** De onde vêm os dados da consulta. */
type Origem = "crm" | "manual";

interface ClienteSelecionado {
  id: string;
  nome: string;
  documento: string;
}

function Pagina() {
  const [origem, setOrigem] = useState<Origem>("crm");
  const [documento, setDocumento] = useState("");
  const [finalidade, setFinalidade] = useState(FINALIDADES[0]);
  const [cliente, setCliente] = useState<ClienteSelecionado | null>(null);
  const [ficha, setFicha] = useState<FichaBureau | null>(null);

  const config = useQuery({ queryKey: ["bureau-config"], queryFn: () => obterConfigBureau() });
  const historico = useQuery({
    queryKey: ["bureau-historico"],
    queryFn: () => listarConsultasBureau(),
  });

  const consulta = useMutation({
    mutationFn: () =>
      consultarFichaBureau({
        data: {
          documento: documento.replace(/\D/g, ""),
          finalidade,
          // Amarra a consulta ao cadastro quando ela nasceu do CRM: é o que
          // permite reencontrar a ficha pelo cliente depois.
          cliente_id: origem === "crm" ? (cliente?.id ?? null) : null,
        },
      }),
    onSuccess: (f) => {
      setFicha(f);
      void historico.refetch();
    },
    onError: (e) => {
      setFicha(null);
      toast.error(mensagemDeErro(e, "Não foi possível consultar a ficha."));
      void historico.refetch();
    },
  });

  const digitos = documento.replace(/\D/g, "");
  const podeConsultar = digitos.length === 11 || digitos.length === 14;
  const configurado = Boolean(config.data?.provedor && config.data?.ativo);

  /** Troca de origem sem carregar o documento da origem anterior. */
  function trocarOrigem(nova: Origem) {
    if (nova === origem) return;
    setOrigem(nova);
    setDocumento("");
    setCliente(null);
    setFicha(null);
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <AdminHero
        secao="CRM"
        icon={<FileSearch className="h-5 w-5" />}
        titulo="Consulta Ficha Cliente"
        descricao="Ficha única do cliente nos bureaus de crédito: score, restrições, protestos, participações e histórico de consultas."
      />

      {/* Faixa de implantação: o módulo está no ar, mas a integração com o
          bureau ainda está em homologação. Fica no topo, antes de qualquer
          resultado, para ninguém tomar decisão de crédito achando que a
          ficha já é definitiva. */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-400/15 p-4">
        <HardHat className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="text-sm font-bold tracking-wide text-foreground">EM IMPLANTAÇÃO</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            A integração com o bureau ainda está em homologação. Use a ficha como apoio, não como
            decisão final de crédito.
          </p>
        </div>
      </div>

      {!config.isLoading && !configurado && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-foreground">Nenhum bureau configurado</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                A consulta precisa de um fornecedor contratado (Serasa, SPC ou um agregador) e das
                chaves de acesso dele.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link to={"/admin/integracoes" as string}>
              Configurar em Integrações <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Search className="h-4 w-4 text-primary" />
            Consultar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Duas portas de entrada: o cliente que já existe no CRM e o que
              ainda não existe (primeiro contato, indicação, terceiro na
              operação). Antes só havia a segunda, e o operador tinha de sair
              da tela para copiar o CPF do cadastro. */}
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => trocarOrigem("crm")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                origem === "crm"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              Puxar do CRM
            </button>
            <button
              type="button"
              onClick={() => trocarOrigem("manual")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                origem === "manual"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Keyboard className="h-3.5 w-3.5" />
              Digitar os dados
            </button>
          </div>

          {origem === "crm" &&
            (cliente ? (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <Database className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{cliente.nome}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {exibirDocumento(cliente.documento)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => {
                    setCliente(null);
                    setDocumento("");
                  }}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Trocar
                </Button>
              </div>
            ) : (
              <ClientePicker
                onSelecionar={(c) => {
                  setCliente(c);
                  setDocumento(c.documento.includes("*") ? "" : mascararDocumento(c.documento));
                }}
              />
            ))}

          <form
            className="grid gap-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (podeConsultar) consulta.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="doc">CPF ou CNPJ</Label>
              <Input
                id="doc"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={documento}
                // Vindo do CRM o documento é o do cadastro; ainda assim pode
                // ser ajustado, porque cadastro antigo às vezes tem o CPF do
                // cônjuge no lugar do titular.
                onChange={(e) => setDocumento(mascararDocumento(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fin">Finalidade da consulta</Label>
              {/* Exigida pela LGPD e pelos contratos de bureau: fica gravada
                  no histórico junto de quem consultou. */}
              <select
                id="fin"
                value={finalidade}
                onChange={(e) => setFinalidade(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {FINALIDADES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <Button type="submit" disabled={!podeConsultar || consulta.isPending}>
              {consulta.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Consultar ficha completa
            </Button>
          </form>

          {/* Sem permissão de PII o CRM devolve o CPF mascarado. Melhor dizer
              isso do que deixar o botão desabilitado sem explicação. */}
          {cliente && !podeConsultar && (
            <p className="flex items-start gap-2 text-[11px] font-medium text-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Seu acesso não exibe o documento completo deste cadastro. Digite o CPF/CNPJ para
              consultar.
            </p>
          )}

          <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Cada consulta fica registrada com o operador, a data e a finalidade. Consulte apenas com
            base legal — cliente em negociação ou proposta em andamento.
          </p>
        </CardContent>
      </Card>

      {ficha && <FichaBureauView ficha={ficha} />}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Últimas consultas</CardTitle>
        </CardHeader>
        <CardContent>
          {(historico.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma consulta registrada ainda.
            </p>
          ) : (
            <ul className="divide-y">
              {(historico.data ?? []).map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <span className="font-mono text-sm text-foreground">
                    {mascararDocumento(c.documento)}
                  </span>
                  <span className="text-xs text-muted-foreground">{c.finalidade}</span>
                  <span
                    className={
                      c.sucesso
                        ? "text-[11px] font-medium text-emerald-600"
                        : "text-[11px] font-medium text-destructive"
                    }
                  >
                    {c.sucesso ? "consultada" : (c.erro ?? "falhou")}
                  </span>
                  <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                    {new Date(c.created_at).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Busca incremental de clientes do CRM (mesma fonte usada pela DPS). */
function ClientePicker({ onSelecionar }: { onSelecionar: (c: ClienteSelecionado) => void }) {
  const [q, setQ] = useState("");
  const [termo, setTermo] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setTermo(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const busca = useQuery({
    queryKey: ["bureau-buscar-clientes", termo],
    queryFn: () => buscarClientesCRM({ data: { q: termo } }),
    enabled: termo.length >= 2,
  });

  const resultados = (busca.data ?? []) as Array<{
    id: string;
    nome: string;
    documento: string | null;
    email: string | null;
  }>;

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nome, CPF/CNPJ ou e-mail do cliente…"
          className="pl-9"
        />
        {busca.isFetching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {termo.length < 2 && (
        <p className="py-2 text-center text-xs text-muted-foreground">
          Digite ao menos 2 caracteres para buscar no CRM.
        </p>
      )}
      {busca.isError && (
        <p className="py-2 text-center text-xs text-destructive">
          {busca.error instanceof Error ? busca.error.message : "Falha na busca."}
        </p>
      )}
      {termo.length >= 2 && busca.isSuccess && resultados.length === 0 && (
        <p className="py-2 text-center text-xs text-muted-foreground">
          Nenhum cliente encontrado. Use “Digitar os dados” para consultar mesmo assim.
        </p>
      )}

      {resultados.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelecionar({ id: c.id, nome: c.nome, documento: c.documento ?? "" })}
          className="flex w-full items-center gap-3 rounded-md border border-transparent px-3 py-2 text-left transition hover:border-primary/40 hover:bg-primary/5"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{c.nome}</p>
            <p className="truncate text-xs text-muted-foreground">{c.email ?? "sem e-mail"}</p>
          </div>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">
            {exibirDocumento(c.documento ?? "")}
          </span>
        </button>
      ))}
    </div>
  );
}
