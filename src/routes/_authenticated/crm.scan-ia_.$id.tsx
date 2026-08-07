import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, FileText, Save, ShieldCheck, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  obterLeitura,
  salvarCampos,
  confirmarTipoDocumento,
  vincularClienteLeitura,
  criarClienteParaLeitura,
  arquivarDocumentoDaLeitura,
} from "@/lib/crm/scan-ia.functions";
import {
  CONFIANCA_LABEL,
  TIPOS_DOCUMENTO,
  TIPO_DOCUMENTO_LABEL,
  faixaConfianca,
  rotuloCampo,
  rotuloTipo,
  type TipoDocumentoScan,
} from "@/lib/crm/scan-ia-tipos";
import { ClienteCRMPicker } from "@/components/simulacao/cliente-crm-picker";
import { AplicarCadastroDialog } from "@/components/crm/scan-ia/aplicar-cadastro-dialog";

export const Route = createFileRoute("/_authenticated/crm/scan-ia_/$id")({
  head: () => ({ meta: [{ title: "Revisar leitura — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("crm.clientes"),
  component: Pagina,
});

const TOM_FAIXA: Record<string, { box: string }> = {
  alta: { box: "bg-success/10 border-success/30" },
  media: { box: "bg-warning/10 border-warning/30" },
  revisar: { box: "bg-destructive/10 border-destructive/40" },
};

function Pagina() {
  const { id } = useParams({ from: "/_authenticated/crm/scan-ia_/$id" });
  const qc = useQueryClient();
  const [valores, setValores] = useState<Record<string, string>>({});
  const [tipoEscolhido, setTipoEscolhido] = useState<string>("");
  const [aplicarAberto, setAplicarAberto] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoDoc, setNovoDoc] = useState("");

  const leitura = useQuery({
    queryKey: ["scan-ia-leitura", id],
    queryFn: () => obterLeitura({ data: { id } }),
    // Evita que um refetch (foco de janela, invalidação em background) sobrescreva
    // edições em andamento do formulário antes do salvar.
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  // Só reidrata `valores` quando o ID muda (nova leitura) — não a cada refetch.
  const hidratadoParaIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!leitura.data) return;
    if (hidratadoParaIdRef.current === id) return;
    const inicial: Record<string, string> = {};
    for (const c of leitura.data.campos) inicial[c.id] = c.valor ?? "";
    setValores(inicial);
    setTipoEscolhido(
      leitura.data.tipo_confirmado
        ? (leitura.data.tipo_documento ?? "")
        : (leitura.data.tipo_documento_sugerido ?? leitura.data.tipo_documento ?? ""),
    );
    const porCampo = (nome: string) =>
      leitura.data!.campos.find((c) => c.campo === nome)?.valor ?? "";
    setNovoNome(porCampo("nome_completo"));
    setNovoDoc(porCampo("cpf_cnpj"));
    hidratadoParaIdRef.current = id;
  }, [leitura.data, id]);

  const salvar = useMutation({
    mutationFn: () =>
      salvarCampos({
        data: {
          leitura_id: id,
          campos: Object.entries(valores).map(([cid, valor]) => ({ id: cid, valor })),
        },
      }),
    onSuccess: () => {
      toast.success("Campos salvos.");
      qc.invalidateQueries({ queryKey: ["scan-ia-leitura", id] });
      qc.invalidateQueries({ queryKey: ["scan-ia-leituras"] });
      qc.invalidateQueries({ queryKey: ["scan-ia-previa", id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar."),
  });

  const confirmarTipo = useMutation({
    mutationFn: (tipo: string) =>
      confirmarTipoDocumento({ data: { leitura_id: id, tipo: tipo as TipoDocumentoScan } }),
    onSuccess: () => {
      toast.success("Tipo confirmado.");
      qc.invalidateQueries({ queryKey: ["scan-ia-leitura", id] });
      qc.invalidateQueries({ queryKey: ["scan-ia-leituras"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao confirmar tipo."),
  });

  const vincular = useMutation({
    mutationFn: (clienteId: string | null) =>
      vincularClienteLeitura({ data: { leitura_id: id, cliente_id: clienteId } }),
    onSuccess: () => {
      toast.success("Cliente vinculado à leitura.");
      qc.invalidateQueries({ queryKey: ["scan-ia-leitura", id] });
      qc.invalidateQueries({ queryKey: ["scan-ia-leituras"] });
      qc.invalidateQueries({ queryKey: ["scan-ia-previa", id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao vincular cliente."),
  });

  const criarCliente = useMutation({
    mutationFn: () =>
      criarClienteParaLeitura({
        data: { leitura_id: id, nome: novoNome.trim(), documento: novoDoc.trim() },
      }),
    onSuccess: (r) => {
      toast.success(
        r.reaproveitado
          ? "Já existia um cliente com esse documento — leitura vinculada a ele."
          : "Cliente criado e vinculado.",
      );
      qc.invalidateQueries({ queryKey: ["scan-ia-leitura", id] });
      qc.invalidateQueries({ queryKey: ["scan-ia-leituras"] });
      qc.invalidateQueries({ queryKey: ["scan-ia-previa", id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao criar cliente."),
  });

  const arquivar = useMutation({
    mutationFn: () => arquivarDocumentoDaLeitura({ data: { leitura_id: id } }),
    onSuccess: (r) => {
      toast.success(
        r.ja_existia
          ? "Este documento já estava na documentação do cliente."
          : "Documento arquivado na aba Documentos do cliente.",
      );
      qc.invalidateQueries({ queryKey: ["cliente-docs"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao arquivar documento."),
  });

  const d = leitura.data;
  const divergencia = useMemo(() => {
    if (!d?.tipo_documento_sugerido) return false;
    if (d.tipo_confirmado) return false;
    const informado = (d.tipo_documento ?? "").trim();
    return !!informado && informado !== d.tipo_documento_sugerido;
  }, [d]);

  const baixaConfianca = (d?.campos ?? []).filter(
    (c) => faixaConfianca(c.confianca) === "revisar",
  ).length;

  const podeAplicar = !!d?.cliente_id && !!d?.tipo_confirmado && (d?.campos.length ?? 0) > 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/crm/scan-ia">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Link>
        </Button>
      </div>

      {leitura.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : leitura.isError || !d ? (
        <p className="text-sm text-destructive">Não foi possível carregar a leitura.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">{rotuloTipo(d.tipo_documento)}</h2>
                <p className="text-xs text-muted-foreground">
                  Enviado por {d.criador_nome ?? "—"} ·{" "}
                  {new Date(d.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <Badge variant="outline">{d.status}</Badge>
            </div>
            <div className="overflow-hidden rounded-lg border border-border bg-muted">
              {d.arquivo_assinado ? (
                <iframe title="Documento" src={d.arquivo_assinado} className="h-[600px] w-full" />
              ) : (
                <div className="flex h-64 items-center justify-center text-muted-foreground">
                  <FileText className="h-8 w-8" />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {/* 1. Tipo detectado × tipo confirmado */}
            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">1. Tipo do documento</h2>
                {d.tipo_confirmado ? (
                  <Badge variant="default" className="gap-1">
                    <ShieldCheck className="h-3 w-3" /> Confirmado
                  </Badge>
                ) : (
                  <Badge variant="secondary">Aguardando confirmação</Badge>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Detectado pela IA:{" "}
                <span className="font-medium text-foreground">
                  {rotuloTipo(d.tipo_documento_sugerido)}
                </span>
                {d.tipo_documento ? (
                  <>
                    {" "}
                    · informado no envio:{" "}
                    <span className="font-medium text-foreground">
                      {rotuloTipo(d.tipo_documento)}
                    </span>
                  </>
                ) : null}
              </p>

              {divergencia ? (
                <div className="flex gap-2 rounded-md border border-warning/50 bg-warning/10 p-3 text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                  <span>
                    A IA classificou este documento de forma diferente do tipo informado no envio.
                    Escolha abaixo qual é o tipo correto antes de continuar.
                  </span>
                </div>
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={tipoEscolhido} onValueChange={setTipoEscolhido}>
                  <SelectTrigger className="sm:flex-1">
                    <SelectValue placeholder="Selecione o tipo correto" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_DOCUMENTO.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TIPO_DOCUMENTO_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  disabled={!tipoEscolhido || confirmarTipo.isPending}
                  onClick={() => confirmarTipo.mutate(tipoEscolhido)}
                >
                  Confirmar tipo
                </Button>
              </div>
            </div>

            {/* 2. Cliente vinculado */}
            <div
              className={`space-y-3 rounded-lg border bg-card p-4 ${
                d.cliente_id ? "border-border" : "border-warning/60 ring-1 ring-warning/20"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">2. Cliente</h2>
                {d.cliente_id ? (
                  <Badge variant="default">{d.cliente_nome ?? "Vinculado"}</Badge>
                ) : (
                  <Badge variant="secondary">Sem vínculo</Badge>
                )}
              </div>

              {!d.cliente_id ? (
                <div className="flex gap-2 rounded-md border border-warning/50 bg-warning/10 p-3 text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                  <span>
                    Este documento ainda não pertence a nenhum cliente. Escolha{" "}
                    <strong>uma das duas opções abaixo</strong> para continuar:{" "}
                    <strong>A)</strong> buscar um cliente que já existe, ou <strong>B)</strong>{" "}
                    cadastrar um cliente novo com os dados lidos do documento.
                  </span>
                </div>
              ) : null}

              <div className="space-y-2">
                {!d.cliente_id ? (
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    A) O cliente já é cadastrado
                  </p>
                ) : null}
                <ClienteCRMPicker
                  selecionado={d.cliente_nome ?? null}
                  onSelect={(c) => vincular.mutate(c.id)}
                />
              </div>

              {d.cliente_id ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={vincular.isPending}
                  onClick={() => vincular.mutate(null)}
                >
                  Desvincular
                </Button>
              ) : (
                <div className="space-y-3 rounded-md border-2 border-dashed border-primary/50 bg-primary/5 p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      B) O cliente ainda NÃO tem cadastro
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Vamos criar o cadastro agora com o nome e o CPF/CNPJ lidos do documento e já
                      vincular esta leitura a ele. Confira os dois campos abaixo — a leitura da IA
                      pode conter erros.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-1">
                      <Label htmlFor="novo-nome" className="text-xs">
                        Nome completo *
                      </Label>
                      <Input
                        id="novo-nome"
                        value={novoNome}
                        placeholder="Nome do cliente"
                        onChange={(e) => setNovoNome(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="novo-doc" className="text-xs">
                        CPF / CNPJ *
                      </Label>
                      <Input
                        id="novo-doc"
                        value={novoDoc}
                        placeholder="Somente números"
                        onChange={(e) => setNovoDoc(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    disabled={criarCliente.isPending || novoNome.trim().length < 3 || !novoDoc.trim()}
                    onClick={() => criarCliente.mutate()}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    {criarCliente.isPending
                      ? "Criando cadastro…"
                      : "Criar cadastro do cliente e vincular este documento"}
                  </Button>
                  {novoNome.trim().length < 3 || !novoDoc.trim() ? (
                    <p className="text-xs text-muted-foreground">
                      Preencha nome (mín. 3 letras) e CPF/CNPJ para habilitar o botão.
                    </p>
                  ) : null}
                </div>
              )}
            </div>


            {/* 3. Campos extraídos */}
            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">3. Campos extraídos</h2>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={salvar.isPending || d.campos.length === 0}
                  onClick={() => salvar.mutate()}
                >
                  <Save className="mr-2 h-4 w-4" /> Salvar revisão
                </Button>
              </div>

              {baixaConfianca > 0 ? (
                <div className="flex gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                  <span>
                    {baixaConfianca} campo(s) com confiança abaixo de 60%. Confira no documento e
                    corrija antes de aplicar ao cadastro.
                  </span>
                </div>
              ) : null}

              {d.campos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {d.status === "erro"
                    ? (d.erro ?? "Erro no processamento.")
                    : "Nenhum campo extraído. Reprocesse o documento na listagem."}
                </p>
              ) : (
                <div className="space-y-3">
                  {d.campos.map((campo) => {
                    const faixa = faixaConfianca(campo.confianca);
                    return (
                      <div key={campo.id} className={`rounded-lg border p-3 ${TOM_FAIXA[faixa].box}`}>
                        <div className="mb-1 flex items-center justify-between">
                          <Label htmlFor={campo.id} className="text-xs uppercase tracking-wide">
                            {rotuloCampo(campo.campo)}
                          </Label>
                          <span className="text-xs text-muted-foreground">
                            {CONFIANCA_LABEL[faixa]} · {Math.round((campo.confianca ?? 0) * 100)}%
                          </span>
                        </div>
                        <Input
                          id={campo.id}
                          value={valores[campo.id] ?? ""}
                          onChange={(e) =>
                            setValores((v) => ({ ...v, [campo.id]: e.target.value }))
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. Aplicar ao cadastro */}
            <div className="space-y-2 rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">4. Aplicar ao cadastro</h2>
              <p className="text-xs text-muted-foreground">
                A revisão é obrigatória: você decide campo a campo o que entra no cadastro do
                cliente. Nada é gravado automaticamente. Ao confirmar, o arquivo original também é
                arquivado na aba <strong>Documentos</strong> do cliente.
              </p>
              {!podeAplicar ? (
                <p className="text-xs text-warning">
                  {!d.tipo_confirmado
                    ? "Confirme o tipo do documento."
                    : !d.cliente_id
                      ? "Vincule ou crie um cliente."
                      : "Nenhum campo extraído."}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button disabled={!podeAplicar} onClick={() => setAplicarAberto(true)}>
                  Aplicar ao cadastro
                </Button>
                <Button
                  variant="outline"
                  disabled={!d.cliente_id || arquivar.isPending}
                  onClick={() => arquivar.mutate()}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {arquivar.isPending ? "Arquivando…" : "Só arquivar em Documentos"}
                </Button>
                {d.cliente_id ? (
                  <Button asChild variant="ghost">
                    <Link to="/crm/clientes/$id" params={{ id: d.cliente_id }}>
                      Ver documentação do cliente
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>

          </div>
        </div>
      )}

      {d ? (
        <AplicarCadastroDialog
          leituraId={id}
          aberto={aplicarAberto}
          onOpenChange={setAplicarAberto}
        />
      ) : null}
    </div>
  );
}
