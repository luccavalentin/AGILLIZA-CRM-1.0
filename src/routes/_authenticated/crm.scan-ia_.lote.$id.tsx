import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Layers,
  ShieldCheck,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { assertModuloPermitido } from "@/lib/route-guards";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { ClienteCRMPicker } from "@/components/simulacao/cliente-crm-picker";
import { aplicarLoteScan, obterLoteScan } from "@/lib/crm/scan-ia.functions";
import {
  CONFIANCA_LABEL,
  TIPOS_DOCUMENTO,
  TIPO_DOCUMENTO_LABEL,
  faixaConfianca,
  rotuloTipo,
  type TipoDocumentoScan,
} from "@/lib/crm/scan-ia-tipos";
import { cnpjValido, cpfValido, validarCampo } from "@/lib/crm/scan-ia-validacao";

export const Route = createFileRoute("/_authenticated/crm/scan-ia_/lote/$id")({
  head: () => ({ meta: [{ title: "Conferir documentos — Scan IA — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.scan_ia", ["crm.clientes"]),
  component: Pagina,
});

type Linha = {
  campo: string;
  rotulo: string;
  valor: string;
  confianca: number;
  origem: string | null;
  aplicar: boolean;
  escolha: "manter" | "substituir";
};

const TOM_FAIXA: Record<"alta" | "media" | "revisar", string> = {
  alta: "border-success/30 bg-success/5",
  media: "border-warning/40 bg-warning/5",
  revisar: "border-destructive/40 bg-destructive/5",
};

/**
 * Conferência do lote (C17): documento ao lado dos campos lidos de TODOS os documentos,
 * já consolidados (melhor valor por campo, divergências e regras), e a decisão do operador:
 * criar o cliente com esses dados ou completar um cliente existente.
 */
function Pagina() {
  const { id } = useParams({ from: "/_authenticated/crm/scan-ia_/lote/$id" });
  const navigate = useNavigate();
  const podeCriar = usePermissao("crm.clientes", "create");
  const podeEditar = usePermissao("crm.clientes", "edit");
  const [modo, setModo] = useState<"novo" | "existente">("novo");
  const [clienteSel, setClienteSel] = useState<{ id: string; nome: string } | null>(null);
  const [docAberto, setDocAberto] = useState(0);
  const [tipos, setTipos] = useState<Record<string, string>>({});
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [novoDoc, setNovoDoc] = useState("");
  const [hidratado, setHidratado] = useState<string | null>(null);

  const clienteParaComparar = modo === "existente" ? (clienteSel?.id ?? null) : null;
  const lote = useQuery({
    queryKey: ["scan-ia-lote", id, clienteParaComparar],
    queryFn: () => obterLoteScan({ data: { id, cliente_id: clienteParaComparar } }),
    refetchOnWindowFocus: false,
  });
  const d = lote.data;

  // Hidrata o formulário uma vez por lote (não a cada troca de cliente comparado).
  useEffect(() => {
    if (!d || hidratado === d.id) return;
    setTipos(
      Object.fromEntries(
        d.documentos.map((x) => [x.id, x.tipo_documento ?? x.tipo_documento_sugerido ?? "outro"]),
      ),
    );
    setLinhas(
      d.consolidados.map((c) => ({
        campo: c.campo,
        rotulo: c.rotulo,
        valor: c.escolhido.valor,
        confianca: c.escolhido.confianca,
        origem: c.escolhido.tipo_documento,
        aplicar: c.aplicavel && c.escolhido.valido !== false && c.escolhido.confianca >= 0.6,
        escolha: "manter",
      })),
    );
    setNovoNome(d.sugestao.nome);
    setNovoDoc(d.sugestao.documento);
    if (d.cliente_id && d.cliente_nome) {
      setModo("existente");
      setClienteSel({ id: d.cliente_id, nome: d.cliente_nome });
    }
    setHidratado(d.id);
  }, [d, hidratado]);

  const porCampo = useMemo(() => new Map((d?.consolidados ?? []).map((c) => [c.campo, c])), [d]);
  const docNovo = novoDoc.replace(/\D/g, "");
  const docNovoOk =
    docNovo.length === 11
      ? cpfValido(docNovo)
      : docNovo.length === 14
        ? cnpjValido(docNovo)
        : false;
  const emLeitura = (d?.documentos ?? []).some(
    (x) => x.status === "processando" || x.status === "pendente",
  );
  const aplicado = d?.status === "aplicado";

  const aplicar = useMutation({
    mutationFn: () =>
      aplicarLoteScan({
        data: {
          lote_id: id,
          cliente_id: modo === "existente" ? (clienteSel?.id ?? null) : null,
          novo: modo === "novo" ? { nome: novoNome.trim(), documento: novoDoc } : null,
          tipos: Object.entries(tipos).map(([leitura_id, tipo]) => ({ leitura_id, tipo })),
          campos: linhas.map((l) => ({
            campo: l.campo,
            valor: l.valor,
            confianca: Math.max(0, Math.min(1, l.confianca)),
            aplicar: l.aplicar,
            escolha: l.escolha,
          })),
        },
      }),
    onSuccess: (r) => {
      toast.success(
        `${r.criado ? "Cliente criado" : "Cadastro completado"}: ${r.aplicados} campo(s) preenchido(s), ${r.arquivados} documento(s) nas pastas do cliente.`,
      );
      if (r.erros_arquivo.length) toast.warning(r.erros_arquivo[0]);
      navigate({ to: "/crm/clientes/$id", params: { id: r.cliente_id } });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível aplicar os documentos.")),
  });

  const atualizar = (campo: string, p: Partial<Linha>) =>
    setLinhas((ls) => ls.map((l) => (l.campo === campo ? { ...l, ...p } : l)));

  const marcados = linhas.filter((l) => l.aplicar).length;
  const podeAplicar =
    !aplicado &&
    !emLeitura &&
    podeEditar &&
    (modo === "novo" ? podeCriar && novoNome.trim().length >= 3 && docNovoOk : !!clienteSel);

  if (lote.isLoading) {
    return (
      <div className="grid gap-4 p-4 md:p-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Skeleton className="h-[480px] w-full rounded-2xl" />
        <Skeleton className="h-[480px] w-full rounded-2xl" />
      </div>
    );
  }
  if (lote.isError || !d) {
    return (
      <div className="space-y-3 p-4 md:p-6">
        <p className="text-sm text-destructive">
          {mensagemDeErro(lote.error, "Não foi possível carregar o lote.")}
        </p>
        <Button size="sm" variant="outline" onClick={() => lote.refetch()}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  const doc = d.documentos[docAberto] ?? d.documentos[0];

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/crm/scan-ia">
              <ArrowLeft className="mr-1 h-4 w-4" /> Scan IA
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <Layers className="h-5 w-5 text-primary" /> Conferir documentos
            </h1>
            <p className="text-xs text-muted-foreground">
              {d.documentos.length} documento(s) · {d.consolidados.length} campo(s) lido(s) ·{" "}
              {d.consolidados.filter((c) => c.divergente).length} divergência(s) entre documentos
            </p>
          </div>
        </div>
        {aplicado && (
          <Badge className="gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Aplicado{" "}
            {d.cliente_nome ? `a ${d.cliente_nome}` : ""}
          </Badge>
        )}
      </div>

      {emLeitura && (
        <div className="flex gap-2 rounded-xl border border-warning/50 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          Ainda há documento sendo lido pela IA. Atualize em instantes.
          <Button
            size="sm"
            variant="outline"
            className="ml-auto h-7"
            onClick={() => lote.refetch()}
          >
            Atualizar
          </Button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Documento */}
        <section className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {d.documentos.map((x, i) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setDocAberto(i)}
                className={cn(
                  "flex min-w-[150px] max-w-[200px] shrink-0 flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left text-xs transition-colors",
                  i === docAberto
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-card hover:border-primary/40",
                )}
              >
                <span className="font-semibold">
                  {rotuloTipo(tipos[x.id] ?? x.tipo_documento_sugerido)}
                </span>
                <span className="w-full truncate text-muted-foreground">{x.arquivo_nome}</span>
                {x.status === "erro" && <span className="text-destructive">Erro na leitura</span>}
              </button>
            ))}
          </div>
          {doc && (
            <div className="overflow-hidden rounded-2xl border border-border bg-muted shadow-sm">
              {doc.arquivo_assinado ? (
                /\.(png|jpe?g|webp)$/i.test(doc.arquivo_nome) ? (
                  <img
                    src={doc.arquivo_assinado}
                    alt={doc.arquivo_nome}
                    className="max-h-[70vh] w-full object-contain"
                  />
                ) : (
                  <iframe
                    title="Documento"
                    src={doc.arquivo_assinado}
                    className="h-[60vh] w-full lg:h-[70vh]"
                  />
                )
              ) : (
                <div className="flex h-64 items-center justify-center text-muted-foreground">
                  <FileText className="h-8 w-8" />
                </div>
              )}
            </div>
          )}
          {doc?.erro && <p className="text-xs text-destructive">{doc.erro}</p>}
        </section>

        {/* Decisões */}
        <section className="space-y-4">
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">1. Tipo de cada documento</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {d.documentos.map((x) => (
                <div key={x.id} className="space-y-1">
                  <Label className="truncate text-xs text-muted-foreground">{x.arquivo_nome}</Label>
                  <Select
                    value={tipos[x.id] ?? ""}
                    onValueChange={(v) => setTipos((t) => ({ ...t, [x.id]: v }))}
                    disabled={aplicado}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Tipo do documento" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_DOCUMENTO.map((t) => (
                        <SelectItem key={t} value={t}>
                          {TIPO_DOCUMENTO_LABEL[t as TipoDocumentoScan]}
                          {t === x.tipo_documento_sugerido ? " (IA)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">2. Cliente</h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={aplicado}
                onClick={() => setModo("novo")}
                className={cn(
                  "flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition-colors",
                  modo === "novo"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/40",
                )}
              >
                <UserPlus className="h-4 w-4 shrink-0" /> Criar cliente
              </button>
              <button
                type="button"
                disabled={aplicado}
                onClick={() => setModo("existente")}
                className={cn(
                  "flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition-colors",
                  modo === "existente"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/40",
                )}
              >
                <UserCheck className="h-4 w-4 shrink-0" /> Completar existente
              </button>
            </div>
            {modo === "novo" ? (
              <div className="grid gap-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <div className="space-y-1">
                  <Label htmlFor="lote-nome" className="text-xs">
                    Nome completo *
                  </Label>
                  <Input
                    id="lote-nome"
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    disabled={aplicado}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lote-doc" className="text-xs">
                    CPF / CNPJ *
                  </Label>
                  <Input
                    id="lote-doc"
                    inputMode="numeric"
                    value={novoDoc}
                    onChange={(e) => setNovoDoc(e.target.value)}
                    disabled={aplicado}
                    aria-invalid={!!novoDoc && !docNovoOk}
                  />
                  {novoDoc && (
                    <p className={cn("text-xs", docNovoOk ? "text-success" : "text-destructive")}>
                      {docNovoOk
                        ? "Dígito verificador confere."
                        : "CPF/CNPJ não confere — corrija antes de criar."}
                    </p>
                  )}
                </div>
                {!podeCriar && (
                  <p className="text-xs text-warning sm:col-span-2">
                    Você não tem permissão para cadastrar clientes.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <ClienteCRMPicker
                  selecionado={clienteSel?.nome ?? null}
                  onSelect={(c) => setClienteSel({ id: c.id, nome: c.nome ?? "Cliente" })}
                />
                <p className="text-xs text-muted-foreground">
                  O que já está no cadastro aparece ao lado; divergência só é substituída se você
                  escolher.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">3. Dados lidos (de todos os documentos)</h2>
              <span className="text-xs text-muted-foreground">
                {marcados} marcado(s) para preencher
              </span>
            </div>
            {linhas.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nenhum campo lido. Reprocesse os documentos no Scan IA ou envie digitalizações mais
                nítidas.
              </p>
            ) : (
              <ul className="space-y-2">
                {linhas.map((l) => {
                  const c = porCampo.get(l.campo);
                  const v = validarCampo(l.campo, l.valor);
                  const faixa = v.valido ? faixaConfianca(l.confianca) : "revisar";
                  return (
                    <li
                      key={l.campo}
                      className={cn("space-y-2 rounded-xl border p-3", TOM_FAIXA[faixa])}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Checkbox
                          id={`ap-${l.campo}`}
                          checked={l.aplicar}
                          disabled={aplicado || c?.aplicavel === false}
                          onCheckedChange={(x) => atualizar(l.campo, { aplicar: !!x })}
                          aria-label={`Preencher ${l.rotulo}`}
                        />
                        <Label
                          htmlFor={`ap-${l.campo}`}
                          className="text-xs font-semibold uppercase tracking-wide"
                        >
                          {l.rotulo}
                        </Label>
                        <span className="ml-auto flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                          {l.origem && <Badge variant="outline">{rotuloTipo(l.origem)}</Badge>}
                          {CONFIANCA_LABEL[faixa]} · {Math.round(l.confianca * 100)}%
                        </span>
                      </div>
                      <Input
                        value={l.valor}
                        disabled={aplicado}
                        onChange={(e) =>
                          atualizar(l.campo, { valor: e.target.value, confianca: 1 })
                        }
                        aria-label={l.rotulo}
                      />
                      {!v.valido && <p className="text-xs text-destructive">{v.motivo}</p>}
                      {c?.aplicavel === false && (
                        <p className="text-xs text-muted-foreground">{c.motivo}</p>
                      )}
                      {c && c.alternativas.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span
                            className={cn(c.divergente ? "text-warning" : "text-muted-foreground")}
                          >
                            {c.divergente ? "Outros documentos dizem:" : "Confirmado também em:"}
                          </span>
                          {c.alternativas.map((a) => (
                            <button
                              key={a.campo_id}
                              type="button"
                              disabled={aplicado}
                              onClick={() =>
                                atualizar(l.campo, {
                                  valor: a.valor,
                                  confianca: a.confianca,
                                  origem: a.tipo_documento,
                                })
                              }
                              className="max-w-full truncate rounded-full border border-border bg-background px-2 py-0.5 hover:border-primary hover:text-primary"
                              title="Usar este valor"
                            >
                              {a.valor}{" "}
                              <span className="opacity-60">({rotuloTipo(a.tipo_documento)})</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {c?.valor_atual && (
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-muted-foreground">
                            No cadastro:{" "}
                            <strong className="text-foreground">{c.valor_atual}</strong>
                          </span>
                          {c.conflito && (
                            <Select
                              value={l.escolha}
                              onValueChange={(x) =>
                                atualizar(l.campo, { escolha: x as Linha["escolha"] })
                              }
                              disabled={aplicado}
                            >
                              <SelectTrigger className="h-7 w-[190px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="manter">Manter o do cadastro</SelectItem>
                                <SelectItem value="substituir">
                                  Substituir pelo documento
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-2xl border border-primary/20 bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Ao confirmar, os documentos vão para as pastas do cliente e tudo fica registrado na
              auditoria.
            </p>
            <Button
              disabled={!podeAplicar || aplicar.isPending}
              onClick={() => aplicar.mutate()}
              className="shrink-0"
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              {aplicar.isPending
                ? "Aplicando…"
                : modo === "novo"
                  ? "Criar cliente e preencher"
                  : "Completar o cadastro"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
