import { useMemo, useRef, useState } from "react";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  Download,
  Eye,
  Trash2,
  Loader2,
  Landmark,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Users,
  Home,
  UserCheck,
  FolderOpen,
  Heart,
  Send,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useEnviarProposta } from "@/hooks/use-enviar-proposta";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  faltantesEnvolvido,
  proponentesPendentes,
  descreverParticipante,
  listarLabels,
  QUALIFICACAO_LABEL,
} from "@/lib/propostas/campos-obrigatorios";
import {
  listarDocumentos,
  anexarDocumento,
  urlDocumento,
  excluirDocumento,
} from "@/lib/crm/clientes.functions";
import { dadosImovelBanco, enviarDocumentosBanco } from "@/lib/propostas/propostas.functions";
import { VisualizadorArquivo } from "@/components/comum/visualizador-arquivo";
import { nomeArquivoSeguro } from "@/lib/storage/nome-arquivo";
import { donoDoDocumento } from "@/lib/propostas/enviar/documentos-vagas";
import { nomeDoTipoDocumento, sugerirTipoDocumento } from "@/lib/documentos/tipos-banco";
import {
  TIPOS_DOCUMENTO_POR_CATEGORIA,
  TIPO_OUTRO,
  type CategoriaDocumento,
} from "@/lib/crm/documento-tipos";

type Categoria = CategoriaDocumento;

/**
 * Um grupo por dono, na mesma divisão que a HomeFin usa no checklist da
 * oportunidade: comprador, cônjuge do comprador, vendedor, cônjuge do
 * vendedor, imóvel. Antes comprador e cônjuge dividiam um grupo e o anexo
 * sempre gravava "comprador" — não havia como anexar documento do cônjuge.
 */
const GRUPOS: { categoria: Categoria; titulo: string; icone: typeof Users }[] = [
  { categoria: "comprador", titulo: "Comprador", icone: Users },
  { categoria: "conjuge", titulo: "Cônjuge do comprador", icone: Heart },
  { categoria: "vendedor", titulo: "Vendedor", icone: UserCheck },
  { categoria: "vendedor_conjuge", titulo: "Cônjuge do vendedor", icone: Heart },
  { categoria: "imovel", titulo: "Imóvel", icone: Home },
  { categoria: "outros", titulo: "Outros documentos", icone: FolderOpen },
];

const MAX_BYTES_BANCO = 5 * 1024 * 1024;

const T = TIPOS_DOCUMENTO_POR_CATEGORIA;

/**
 * Documentos esperados em cada grupo — o mesmo checklist do CRM
 * (`documentos-checklist/secao-*.tsx`). Vendedor PJ troca os documentos
 * pessoais pelos da empresa; FGTS só entra quando a proposta usa FGTS.
 */
function esperadosDoGrupo(cat: Categoria, ctx: { fgts: boolean; vendedorPJ: boolean }): string[] {
  switch (cat) {
    case "comprador":
      return [
        T.comprador[0],
        T.comprador[1],
        T.comprador[2],
        ...(ctx.fgts ? T.comprador.slice(3, 7) : []),
      ];
    case "conjuge":
      return [T.conjuge[0]];
    case "vendedor":
      return ctx.vendedorPJ ? T.vendedor.slice(3, 7) : T.vendedor.slice(0, 3);
    case "vendedor_conjuge":
      return [T.vendedor_conjuge[0]];
    case "imovel":
      return [T.imovel[0], T.imovel[1]];
    default:
      return [];
  }
}

const mesmoTipo = (a: unknown, b: string) =>
  String(a ?? "") === b || nomeDoTipoDocumento(String(a ?? "")) === nomeDoTipoDocumento(b);

function ehFormatoBanco(d: { mime_type?: string | null; nome_arquivo?: string | null }): boolean {
  const mime = String(d.mime_type ?? "").toLowerCase();
  const nome = String(d.nome_arquivo ?? "").toLowerCase();
  return (
    mime.includes("pdf") ||
    nome.endsWith(".pdf") ||
    mime.includes("jpeg") ||
    mime.includes("jpg") ||
    nome.endsWith(".jpg") ||
    nome.endsWith(".jpeg") ||
    mime.includes("png") ||
    nome.endsWith(".png")
  );
}

interface ArquivoPendente {
  file: File;
  tipo: string;
  tipoLivre: string;
}

type ResultadoDocs = {
  enviados: number;
  total: number;
  sucesso: { nome: string; participante?: string | null }[];
  naHomefin: { nome: string; motivo: string; participante?: string | null }[];
  erros: { nome: string; motivo: string; participante?: string | null }[];
};

export function AbaEnviarBanco({
  clienteId,
  propostaId,
  envolvidos = [],
  onCompletar,
  proposta,
}: {
  clienteId: string | null | undefined;
  propostaId: string;
  envolvidos?: any[];
  onCompletar?: (participante: any) => void;
  proposta: any;
}) {
  const qc = useQueryClient();
  const listar = useServerFn(listarDocumentos);
  const anexar = useServerFn(anexarDocumento);
  const gerarUrl = useServerFn(urlDocumento);
  const excluir = useServerFn(excluirDocumento);
  const enviar = useServerFn(enviarDocumentosBanco);
  const dadosImovelFn = useServerFn(dadosImovelBanco);

  const [visualizando, setVisualizando] = useState<{ url: string; nome: string } | null>(null);
  const [excluindo, setExcluindo] = useState<{ id: string; nome: string } | null>(null);
  const { enviar: handleEnviar, busy: enviandoBanco } = useEnviarProposta();
  const [enviando, setEnviando] = useState(false);
  const [enviandoImovel, setEnviandoImovel] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [resultado, setResultado] = useState<ResultadoDocs | null>(null);
  const [resultadoImovel, setResultadoImovel] = useState<any | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadCat, setUploadCat] = useState<Categoria | null>(null);
  const [uploadTipo, setUploadTipo] = useState<string | null>(null);
  const [pendentesUpload, setPendentesUpload] = useState<{
    categoria: Categoria;
    arquivos: ArquivoPendente[];
  } | null>(null);
  const [subindo, setSubindo] = useState(false);

  const pendencias = useMemo(() => proponentesPendentes(envolvidos ?? []), [envolvidos]);
  const bloqueado = pendencias.length > 0;
  const propostaNoBanco = Boolean(proposta?.homefin_id_oportunidade);

  const { data: docs, isLoading } = useQuery({
    queryKey: ["cliente-docs", clienteId],
    queryFn: () => listar({ data: { cliente_id: clienteId as string } }),
    enabled: Boolean(clienteId),
  });

  const { data: previaImovel } = useQuery({
    queryKey: ["dados-imovel-banco", propostaId],
    queryFn: () => dadosImovelFn({ data: { proposta_id: propostaId, enviar: false } }),
  });

  const nomeDoGrupo = (cat: Categoria) =>
    donoDoDocumento({ cliente_id: clienteId, categoria: cat }, envolvidos, proposta?.nome_cliente);

  const temConjuge = envolvidos.some((e) => e.conjuge_de);
  const vendedor = envolvidos.find((e) => e.tipo_qualificacao === "VD");
  const conjugeVendedor = vendedor ? envolvidos.find((e) => e.conjuge_de === vendedor.id) : null;

  const lista = (docs ?? []) as any[];
  const ctxEsperados = {
    fgts: Boolean(proposta?.utiliza_fgts),
    vendedorPJ: vendedor?.tipo_pessoa === "J",
  };
  const grupos = GRUPOS.map((g) => {
    const itens = lista.filter((d) => d.categoria === g.categoria);
    const esperados = esperadosDoGrupo(g.categoria, ctxEsperados);
    return {
      ...g,
      dono: g.categoria === "imovel" || g.categoria === "outros" ? "" : nomeDoGrupo(g.categoria),
      itens,
      esperados,
      faltando: esperados.filter((tipo) => !itens.some((d) => mesmoTipo(d.tipo_documento, tipo))),
    };
  }).filter((g) => {
    if (g.itens.length > 0) return true;
    if (g.categoria === "conjuge") return temConjuge;
    if (g.categoria === "vendedor_conjuge") return Boolean(conjugeVendedor);
    return true;
  });

  const aptos = lista.filter((d) => ehFormatoBanco(d));
  const naoEnviados = aptos.filter((d) => d.situacao_integracao !== "enviado");

  function recarregar() {
    qc.removeQueries({ queryKey: ["cliente-docs", clienteId] });
  }

  async function visualizar(storage_path: string, nome: string) {
    try {
      const { url } = await gerarUrl({ data: { storage_path } });
      setVisualizando({ url, nome });
    } catch {
      toast.error("Falha ao abrir o documento.");
    }
  }

  async function baixar(storage_path: string, nome: string) {
    try {
      const { url } = await gerarUrl({ data: { storage_path } });
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      a.target = "_blank";
      a.click();
    } catch {
      toast.error("Falha ao gerar link.");
    }
  }

  // ---------------------------------------------------------------- anexo
  function abrirUpload(cat: Categoria, tipo?: string) {
    setUploadCat(cat);
    setUploadTipo(tipo ?? null);
    inputRef.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const cat = uploadCat;
    const tipoEscolhido = uploadTipo;
    setUploadCat(null);
    setUploadTipo(null);
    if (files.length === 0 || !cat) return;
    if (files.some((f) => f.size > 10 * 1024 * 1024)) {
      toast.error("Cada arquivo deve ter no máximo 10 MB.");
      return;
    }
    // Antes de subir, o usuário confirma o TIPO de cada arquivo — é o tipo que
    // acha a vaga certa no checklist do banco. Sugerimos pelo nome do arquivo.
    setPendentesUpload({
      categoria: cat,
      arquivos: files.map((file) => ({
        file,
        tipo: tipoEscolhido ?? (sugerirTipoDocumento(file.name, cat) || TIPO_OUTRO),
        tipoLivre: "",
      })),
    });
  }

  async function confirmarUpload(enviarAoBancoDepois: boolean) {
    if (!pendentesUpload || !clienteId) return;
    const semTipo = pendentesUpload.arquivos.filter(
      (a) => a.tipo === TIPO_OUTRO && !a.tipoLivre.trim(),
    );
    if (semTipo.length > 0) {
      toast.error("Informe o tipo de todos os documentos.");
      return;
    }
    setSubindo(true);
    const novosIds: string[] = [];
    let falhas = 0;
    for (const a of pendentesUpload.arquivos) {
      try {
        const path = `${clienteId}/${crypto.randomUUID()}-${nomeArquivoSeguro(a.file.name)}`;
        const { error } = await supabase.storage.from("cliente-documentos").upload(path, a.file);
        if (error) throw error;
        const { id } = await anexar({
          data: {
            cliente_id: clienteId,
            categoria: pendentesUpload.categoria,
            tipo_documento: a.tipo === TIPO_OUTRO ? a.tipoLivre.trim() : a.tipo,
            nome_arquivo: a.file.name,
            storage_path: path,
            mime_type: a.file.type,
            tamanho_bytes: a.file.size,
          },
        });
        novosIds.push(id);
      } catch (err) {
        console.error(err);
        falhas++;
      }
    }
    setSubindo(false);
    setPendentesUpload(null);
    if (falhas > 0) toast.warning(`${novosIds.length} anexado(s), ${falhas} com falha.`);
    else toast.success(`${novosIds.length} documento(s) anexado(s).`);
    recarregar();
    if (enviarAoBancoDepois && novosIds.length > 0) await enviarDocumentos(novosIds);
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    try {
      await excluir({ data: { id: excluindo.id } });
      toast.success("Documento excluído.");
      setSelecionados((s) => {
        const n = new Set(s);
        n.delete(excluindo.id);
        return n;
      });
      recarregar();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Falha ao excluir."));
    } finally {
      setExcluindo(null);
    }
  }

  // ---------------------------------------------------------------- envio
  function exigirCadastroCompleto(): boolean {
    if (!bloqueado) return false;
    const pendente = proponentesPendentes(envolvidos)[0]?.env;
    onCompletar?.(pendente || envolvidos[0]);
    toast.error("Complete os dados dos participantes antes de enviar.");
    return true;
  }

  async function enviarDocumentos(ids: string[]) {
    if (exigirCadastroCompleto()) return;
    if (ids.length === 0) {
      toast.info("Nenhum documento selecionado.");
      return;
    }
    setEnviando(true);
    setResultado(null);
    try {
      const r = await enviar({ data: { proposta_id: propostaId, documento_ids: ids } });
      setResultado(r);
      if (r.enviados > 0) toast.success(`${r.enviados} documento(s) confirmado(s) pelo banco.`);
      if (r.naHomefin.length > 0)
        toast.info(`${r.naHomefin.length} documento(s) na HomeFin, aguardando o banco.`);
      if (r.erros.length > 0) toast.warning(`${r.erros.length} ponto(s) de atenção no envio.`);
      setSelecionados(new Set());
      recarregar();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Falha ao enviar ao banco."));
    } finally {
      setEnviando(false);
    }
  }

  async function enviarDadosImovel(silencioso = false) {
    if (!previaImovel || previaImovel.campos.length === 0) {
      if (!silencioso) toast.info("Não há dados do imóvel para enviar.");
      return;
    }
    setEnviandoImovel(true);
    try {
      const r = await dadosImovelFn({ data: { proposta_id: propostaId, enviar: true } });
      setResultadoImovel(r);
      if (r.erro) toast.error(`Dados do imóvel: ${r.erro}`);
      else if (r.naoConfirmados.length > 0)
        toast.warning("Dados do imóvel enviados, mas o banco não confirmou todos os campos.");
      else if (!silencioso) toast.success("Dados do imóvel e da vistoria enviados ao banco.");
    } catch (e) {
      toast.error(mensagemDeErro(e, "Falha ao enviar os dados do imóvel."));
    } finally {
      setEnviandoImovel(false);
    }
  }

  /** Lote completo: dados do imóvel/vistoria + todos os documentos ainda não enviados. */
  async function enviarPendentes() {
    if (exigirCadastroCompleto()) return;
    await enviarDadosImovel(true);
    if (naoEnviados.length > 0) await enviarDocumentos(naoEnviados.map((d) => d.id));
    else toast.info("Todos os documentos já foram enviados ao banco.");
  }

  const alternar = (id: string) =>
    setSelecionados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const alternarGrupo = (ids: string[], marcar: boolean) =>
    setSelecionados((s) => {
      const n = new Set(s);
      for (const id of ids) {
        if (marcar) n.add(id);
        else n.delete(id);
      }
      return n;
    });

  if (!clienteId) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Vincule um cliente à proposta para enviar os documentos ao banco.
      </div>
    );
  }

  const ocupado = enviando || enviandoBanco || enviandoImovel;

  return (
    <div className="space-y-6">
      {/* Checklist de dados obrigatórios dos participantes */}
      {envolvidos.length > 0 && (
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <UserCheck className="h-4 w-4 text-primary" />
            Dados obrigatórios dos participantes
          </h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {envolvidos.map((env) => {
              const faltantes = faltantesEnvolvido(env);
              const ok = faltantes.length === 0;
              return (
                <Card
                  key={env.id}
                  className={cn(
                    "overflow-hidden border-l-4 transition-colors",
                    ok
                      ? "border-l-emerald-500 bg-emerald-500/5"
                      : "border-l-destructive bg-destructive/5",
                  )}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none text-foreground">
                          {env.nome}
                        </p>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {QUALIFICACAO_LABEL[env.tipo_qualificacao] ?? env.tipo_qualificacao}
                        </p>
                        {ok ? (
                          <p className="flex items-center gap-1 pt-1 text-xs text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> Todos os dados preenchidos
                          </p>
                        ) : (
                          <p className="pt-1.5 text-xs italic leading-relaxed text-destructive/80">
                            Falta: {listarLabels(faltantes)}
                          </p>
                        )}
                      </div>
                      {!ok && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 border-primary/20 bg-primary/5 font-semibold text-primary"
                          onClick={() => onCompletar?.(env)}
                        >
                          Completar agora
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <input ref={inputRef} type="file" multiple className="hidden" onChange={onFile} />

      {/* Ação principal: lote */}
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.07] via-card to-card shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <Landmark className="h-5 w-5" />
            </span>
            <div className="text-sm">
              <p className="font-semibold tracking-tight text-foreground">
                Enviar documentação ao banco
              </p>
              <p className="text-muted-foreground">
                {!propostaNoBanco
                  ? "Envie a proposta ao banco primeiro: o checklist de documentos é criado por ela."
                  : naoEnviados.length > 0
                    ? `${naoEnviados.length} documento(s) ainda não enviado(s), cada um vai para a vaga do dono.`
                    : "Todos os documentos aceitos já foram enviados."}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {selecionados.size > 0 && (
              <Button
                variant="outline"
                onClick={() => enviarDocumentos(Array.from(selecionados))}
                disabled={ocupado || !propostaNoBanco}
                className="h-11 gap-2 rounded-xl"
              >
                <Send className="h-4 w-4" /> Enviar {selecionados.size} selecionado(s)
              </Button>
            )}
            <Button
              onClick={enviarPendentes}
              disabled={ocupado || !propostaNoBanco}
              className="h-11 gap-2 rounded-xl px-6 font-semibold shadow-md shadow-primary/20"
            >
              {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />}
              {ocupado ? "Enviando…" : bloqueado ? "Completar cadastro e enviar" : "Enviar pendentes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultado do último envio */}
      {(resultado || resultadoImovel) && (
        <Card>
          <CardContent className="space-y-3 p-4 text-sm">
            <p className="border-b border-border pb-2 font-medium text-foreground">
              Resultado do envio
            </p>
            {resultadoImovel && (
              <div className="space-y-1">
                {resultadoImovel.erro ? (
                  <Linha icone="erro" titulo="Dados do imóvel e vistoria" detalhe={resultadoImovel.erro} />
                ) : (
                  <>
                    {resultadoImovel.confirmados.length > 0 && (
                      <Linha
                        icone="ok"
                        titulo="Dados do imóvel e vistoria"
                        detalhe={`${resultadoImovel.confirmados.length} campo(s) gravado(s) no banco`}
                      />
                    )}
                    {resultadoImovel.naoConfirmados.length > 0 && (
                      <Linha
                        icone="alerta"
                        titulo="Não confirmados pelo banco"
                        detalhe={resultadoImovel.campos
                          .filter((c: any) => resultadoImovel.naoConfirmados.includes(c.campo))
                          .map((c: any) => c.rotulo)
                          .join(", ")}
                      />
                    )}
                  </>
                )}
              </div>
            )}
            {resultado?.sucesso.map((s, i) => (
              <Linha key={`s-${i}`} icone="ok" titulo={s.nome} detalhe={s.participante ?? undefined} />
            ))}
            {resultado?.naHomefin?.map((h, i) => (
              <Linha
                key={`h-${i}`}
                icone="alerta"
                titulo={`${h.nome}${h.participante ? ` — ${h.participante}` : ""}`}
                detalhe={h.motivo}
              />
            ))}
            {resultado?.erros.map((er, i) => (
              <Linha
                key={`e-${i}`}
                icone={/sem (vaga|item) correspond/i.test(er.motivo) ? "alerta" : "erro"}
                titulo={`${er.nome}${er.participante ? ` — ${er.participante}` : ""}`}
                detalhe={er.motivo}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Grupos por dono */}
      {isLoading ? (
        <div className="flex items-center justify-center rounded-lg border border-border bg-card p-10 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando documentos…
        </div>
      ) : (
        grupos.map((g) => {
          const Icone = g.icone;
          const aptosGrupo = g.itens.filter((d: any) => ehFormatoBanco(d)).map((d: any) => d.id);
          const todosMarcados =
            aptosGrupo.length > 0 && aptosGrupo.every((id: string) => selecionados.has(id));
          return (
            <Card key={g.categoria} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {aptosGrupo.length > 0 && (
                      <Checkbox
                        checked={todosMarcados}
                        onCheckedChange={(v) => alternarGrupo(aptosGrupo, Boolean(v))}
                        aria-label={`Selecionar documentos de ${g.titulo}`}
                      />
                    )}
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/10">
                      <Icone className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold tracking-tight text-foreground">
                        {g.titulo}
                        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {g.esperados.length > 0
                            ? `${g.esperados.length - g.faltando.length}/${g.esperados.length}`
                            : g.itens.length}
                        </span>
                      </h3>
                      {g.dono && <p className="truncate text-xs text-muted-foreground">{g.dono}</p>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {aptosGrupo.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 rounded-lg"
                        title={`Envia ao banco os ${aptosGrupo.length} documento(s) de ${g.titulo}`}
                        disabled={ocupado || !propostaNoBanco}
                        onClick={() => enviarDocumentos(aptosGrupo)}
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Enviar seção</span>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 rounded-lg"
                      onClick={() => abrirUpload(g.categoria)}
                    >
                      <Upload className="h-3.5 w-3.5" /> Anexar
                    </Button>
                  </div>
                </div>

                {g.categoria === "vendedor" && !vendedor && (
                  <Aviso>
                    Cadastre o vendedor na aba <strong>Vendedores</strong>: é o cadastro dele que cria
                    as vagas de documento do vendedor no banco.
                  </Aviso>
                )}

                {g.categoria === "imovel" && previaImovel && (
                  <DadosImovel
                    previa={previaImovel}
                    enviando={enviandoImovel}
                    habilitado={propostaNoBanco && !ocupado}
                    onEnviar={() => enviarDadosImovel(false)}
                  />
                )}

                {g.faltando.length > 0 && (
                  <ul className="mb-2 space-y-1 rounded-lg border border-dashed border-border p-2">
                    {g.faltando.map((tipo) => (
                      <li key={tipo} className="flex items-center gap-3 px-1 py-1">
                        <span className="h-4 w-4 shrink-0 rounded border border-muted-foreground/40" />
                        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                          {tipo}
                        </span>
                        <Selo>pendente</Selo>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1.5 px-2 text-xs"
                          onClick={() => abrirUpload(g.categoria, tipo)}
                        >
                          <Upload className="h-3.5 w-3.5" /> Anexar
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}

                {g.itens.length === 0 ? (
                  g.faltando.length === 0 && (
                    <p className="py-3 text-center text-xs text-muted-foreground">
                      Nenhum documento anexado.
                    </p>
                  )
                ) : (
                  <ul className="divide-y divide-border">
                    {g.itens.map((d: any) => {
                      const apto = ehFormatoBanco(d);
                      const grande = Number(d.tamanho_bytes) > MAX_BYTES_BANCO;
                      return (
                        <li key={d.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                          <Checkbox
                            checked={selecionados.has(d.id)}
                            disabled={!apto}
                            onCheckedChange={() => alternar(d.id)}
                            aria-label={`Selecionar ${d.nome_arquivo}`}
                          />
                          <FileText
                            className={cn("h-4 w-4 shrink-0", apto ? "text-primary" : "text-muted-foreground")}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {nomeDoTipoDocumento(d.tipo_documento)}
                            </p>
                            <p className="flex flex-wrap items-center gap-2 truncate text-xs text-muted-foreground">
                              <span className="truncate">{d.nome_arquivo}</span>
                              {!apto && <Selo tom="alerta">formato não aceito</Selo>}
                              {apto && grande && <Selo tom="alerta">acima de 5 MB</Selo>}
                              {d.situacao_integracao === "enviado" && <Selo tom="ok">enviado ao banco</Selo>}
                              {d.situacao_integracao === "erro" && (
                                <Selo tom="erro" titulo={d.erro_integracao ?? undefined}>
                                  falha no envio
                                </Selo>
                              )}
                              {d.situacao_integracao === "homefin" && (
                                <Selo tom="alerta" titulo={d.erro_integracao ?? undefined}>
                                  na HomeFin
                                </Selo>
                              )}
                              {!d.situacao_integracao && apto && <Selo>salvo, não enviado</Selo>}
                            </p>
                            {d.situacao_integracao === "erro" && d.erro_integracao && (
                              <p className="mt-0.5 text-xs text-destructive">{d.erro_integracao}</p>
                            )}
                            {d.situacao_integracao === "homefin" && d.erro_integracao && (
                              <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                                {d.erro_integracao}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {apto && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1.5 rounded-lg px-2.5"
                                title={
                                  d.situacao_integracao === "enviado"
                                    ? "Reenviar este documento ao banco"
                                    : "Enviar este documento ao banco"
                                }
                                disabled={ocupado || !propostaNoBanco}
                                onClick={() => enviarDocumentos([d.id])}
                              >
                                <Landmark className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">
                                  {d.situacao_integracao === "enviado" ? "Reenviar" : "Enviar"}
                                </span>
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="Visualizar"
                              onClick={() => visualizar(d.storage_path, d.nome_arquivo)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="Baixar"
                              onClick={() => baixar(d.storage_path, d.nome_arquivo)}>
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                              title="Excluir" onClick={() => setExcluindo({ id: d.id, nome: d.nome_arquivo })}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Confirmação do tipo antes de anexar */}
      <Dialog open={!!pendentesUpload} onOpenChange={(o) => !o && !subindo && setPendentesUpload(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Anexar em {GRUPOS.find((g) => g.categoria === pendentesUpload?.categoria)?.titulo}
              {pendentesUpload && nomeDoGrupoSeguro(pendentesUpload.categoria, nomeDoGrupo)}
            </DialogTitle>
            <DialogDescription>
              Confirme o tipo de cada arquivo. É o tipo que coloca o documento na vaga certa do banco.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
            {pendentesUpload?.arquivos.map((a, i) => {
              const opcoes = TIPOS_DOCUMENTO_POR_CATEGORIA[pendentesUpload.categoria] ?? [];
              const atualizar = (patch: Partial<ArquivoPendente>) =>
                setPendentesUpload((p) =>
                  p ? { ...p, arquivos: p.arquivos.map((x, j) => (j === i ? { ...x, ...patch } : x)) } : p,
                );
              return (
                <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                  <p className="flex items-center gap-2 truncate text-sm font-medium">
                    <FileText className="h-4 w-4 shrink-0 text-primary" /> {a.file.name}
                    {a.file.size > MAX_BYTES_BANCO && <Selo tom="alerta">acima de 5 MB: o banco recusa</Selo>}
                  </p>
                  <Select value={a.tipo} onValueChange={(v) => atualizar({ tipo: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo do documento" />
                    </SelectTrigger>
                    <SelectContent>
                      {opcoes.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                      <SelectItem value={TIPO_OUTRO}>Outro (digitar)</SelectItem>
                    </SelectContent>
                  </Select>
                  {a.tipo === TIPO_OUTRO && (
                    <Input
                      autoFocus
                      placeholder="Ex.: Holerite, Laudo, Procuração…"
                      value={a.tipoLivre}
                      onChange={(e) => atualizar({ tipoLivre: e.target.value })}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" disabled={subindo} onClick={() => setPendentesUpload(null)}>
              Cancelar
            </Button>
            <Button variant="secondary" disabled={subindo} onClick={() => confirmarUpload(false)}>
              {subindo && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Salvar
            </Button>
            <Button disabled={subindo || !propostaNoBanco} onClick={() => confirmarUpload(true)}>
              {subindo && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Salvar e enviar ao banco
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VisualizadorArquivo
        arquivo={visualizando}
        open={!!visualizando}
        onOpenChange={(o) => !o && setVisualizando(null)}
      />

      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              O documento “{excluindo?.nome}” será removido do cadastro e, se já foi enviado,
              também da HomeFin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarExclusao}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function nomeDoGrupoSeguro(cat: Categoria, nomeDoGrupo: (c: Categoria) => string) {
  if (cat === "imovel" || cat === "outros") return "";
  const n = nomeDoGrupo(cat);
  return n ? ` — ${n}` : "";
}

function Selo({
  children,
  tom,
  titulo,
}: {
  children: React.ReactNode;
  tom?: "ok" | "erro" | "alerta";
  titulo?: string;
}) {
  return (
    <span
      title={titulo}
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-medium",
        tom === "ok" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        tom === "erro" && "bg-destructive/15 text-destructive",
        tom === "alerta" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
        !tom && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
      <span>{children}</span>
    </div>
  );
}

function Linha({
  icone,
  titulo,
  detalhe,
}: {
  icone: "ok" | "erro" | "alerta";
  titulo: string;
  detalhe?: string;
}) {
  const Icone = icone === "ok" ? CheckCircle2 : icone === "erro" ? XCircle : AlertTriangle;
  return (
    <div className="flex items-start gap-2 text-muted-foreground">
      <Icone
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          icone === "ok" && "text-emerald-600 dark:text-emerald-400",
          icone === "erro" && "text-destructive",
          icone === "alerta" && "text-amber-600 dark:text-amber-400",
        )}
      />
      <span>
        <span className="text-foreground">{titulo}</span>
        {detalhe ? ` — ${detalhe}` : ""}
      </span>
    </div>
  );
}

function DadosImovel({
  previa,
  enviando,
  habilitado,
  onEnviar,
}: {
  previa: {
    campos: { campo: string; rotulo: string; valor: string }[];
    semCampoNaApi: string[];
  };
  enviando: boolean;
  habilitado: boolean;
  onEnviar: () => void;
}) {
  const vistoria = previa.campos.filter((c) => c.campo.includes("Avaliacao"));
  const endereco = previa.campos.filter(
    (c) => !c.campo.includes("Avaliacao") && !c.campo.includes("Interveniente"),
  );
  const iq = previa.campos.filter((c) => c.campo.includes("Interveniente"));
  return (
    <div className="mb-3 space-y-2 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Dados do imóvel e da vistoria
        </p>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" disabled={!habilitado || enviando || previa.campos.length === 0} onClick={onEnviar}>
          {enviando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          Enviar ao banco
        </Button>
      </div>
      {previa.campos.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nada para enviar: preencha o contato da vistoria no checklist e o endereço do imóvel na
          proposta.
        </p>
      ) : (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          {[...vistoria, ...endereco, ...iq].map((c) => (
            <div key={c.campo} className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{c.rotulo}</dt>
              <dd className="truncate font-medium text-foreground">{c.valor}</dd>
            </div>
          ))}
        </dl>
      )}
      {vistoria.length === 0 && previa.campos.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Sem contato da vistoria: preencha nome e telefone no checklist do imóvel.
        </p>
      )}
      {previa.semCampoNaApi.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {previa.semCampoNaApi.join(", ")}: a API do banco não tem campo para essa informação, ela
          fica só no Agilliza.
        </p>
      )}
    </div>
  );
}
