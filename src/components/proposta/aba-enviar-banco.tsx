import { useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import {
  faltantesEnvolvido,
  descreverParticipante,
  listarLabels,
  QUALIFICACAO_LABEL,
} from "@/lib/propostas/campos-obrigatorios";
import { ParticipanteDialog } from "./participante-form";
import {
  listarDocumentos,
  anexarDocumento,
  urlDocumento,
  excluirDocumento,
} from "@/lib/crm/clientes.functions";
import { enviarDocumentosBanco } from "@/lib/propostas/propostas.functions";
import { VisualizadorArquivo } from "@/components/comum/visualizador-arquivo";

type Categoria = "comprador" | "conjuge" | "vendedor" | "vendedor_conjuge" | "imovel" | "outros";

interface Grupo {
  chave: string;
  titulo: string;
  icone: typeof Users;
  categorias: Categoria[];
  categoriaUpload: Categoria;
}

const GRUPOS: Grupo[] = [
  {
    chave: "comprador",
    titulo: "Documentação do comprador",
    icone: Users,
    categorias: ["comprador", "conjuge"],
    categoriaUpload: "comprador",
  },
  {
    chave: "vendedor",
    titulo: "Documentação do vendedor",
    icone: UserCheck,
    categorias: ["vendedor", "vendedor_conjuge"],
    categoriaUpload: "vendedor",
  },
  {
    chave: "imovel",
    titulo: "Documentação do imóvel",
    icone: Home,
    categorias: ["imovel"],
    categoriaUpload: "imovel",
  },
  {
    chave: "outros",
    titulo: "Outros documentos",
    icone: FolderOpen,
    categorias: ["outros"],
    categoriaUpload: "outros",
  },
];

function ehFormatoBanco(d: { mime_type?: string | null; nome_arquivo?: string | null }): boolean {
  const mime = String(d.mime_type ?? "").toLowerCase();
  const nome = String(d.nome_arquivo ?? "").toLowerCase();
  if (mime.includes("pdf") || nome.endsWith(".pdf")) return true;
  if (
    mime.includes("jpeg") ||
    mime.includes("jpg") ||
    nome.endsWith(".jpg") ||
    nome.endsWith(".jpeg")
  )
    return true;
  if (mime.includes("png") || nome.endsWith(".png")) return true;
  return false;
}

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

  const [visualizando, setVisualizando] = useState<{ url: string; nome: string } | null>(null);
  const [excluindo, setExcluindo] = useState<{ id: string; nome: string } | null>(null);
  const { enviar: handleEnviar, busy: enviandoBanco } = useEnviarProposta();
  const [enviando, setEnviando] = useState(false);
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const [uploadCat, setUploadCat] = useState<Categoria | null>(null);
  const [resultado, setResultado] = useState<{
    enviados: number;
    total: number;
    sucesso: { nome: string; participante?: string | null }[];
    erros: { nome: string; motivo: string; participante?: string | null }[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pendencias = useMemo(() => {
    return (envolvidos ?? [])
      .map((env) => ({
        env,
        faltantes: faltantesEnvolvido(env || {}),
      }))
      .filter((p) => p.faltantes && p.faltantes.length > 0);
  }, [envolvidos]);

  const bloqueado = pendencias.length > 0;

  const { data: docs, isLoading } = useQuery({
    queryKey: ["cliente-docs", clienteId],
    queryFn: () => listar({ data: { cliente_id: clienteId as string } }),
    enabled: Boolean(clienteId),
  });

  const porGrupo = useMemo(() => {
    const lista = (docs ?? []) as any[];
    return GRUPOS.map((g) => ({
      ...g,
      itens: lista.filter((d) => g.categorias.includes(d.categoria)),
    }));
  }, [docs]);

  const totalPdfs = useMemo(
    () => ((docs ?? []) as any[]).filter((d) => ehFormatoBanco(d)).length,
    [docs],
  );

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

  function abrirUpload(cat: Categoria) {
    setUploadCat(cat);
    inputRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const cat = uploadCat;
    setUploadCat(null);
    if (files.length === 0 || !cat || !clienteId) return;
    if (files.some((f) => f.size > 10 * 1024 * 1024))
      return toast.error("Cada arquivo deve ter no máximo 10 MB.");
    let ok = 0;
    let falhas = 0;
    for (const file of files) {
      try {
        const path = `${clienteId}/${crypto.randomUUID()}-${file.name}`;
        const { error } = await supabase.storage.from("cliente-documentos").upload(path, file);
        if (error) throw error;
        await anexar({
          data: {
            cliente_id: clienteId,
            categoria: cat,
            tipo_documento: file.name.replace(/\.[^.]+$/, ""),
            nome_arquivo: file.name,
            storage_path: path,
            mime_type: file.type,
            tamanho_bytes: file.size,
          },
        });
        ok++;
      } catch {
        falhas++;
      }
    }
    if (falhas > 0) toast.warning(`${ok} enviado(s), ${falhas} com falha.`);
    else toast.success(`${ok} documento(s) anexado(s).`);
    recarregar();
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    try {
      await excluir({ data: { id: excluindo.id } });
      toast.success("Documento excluído.");
      recarregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir.");
    } finally {
      setExcluindo(null);
    }
  }

  async function enviarAoBanco(documentoIds?: string[]) {
    if (bloqueado) {
      handleEnviar({
        propostaId,
        bancoId: "todos",
        envolvidos,
        onCadastroIncompleto: (primeiro) => onCompletar?.(primeiro),
      });
      return;
    }
    const individual = Array.isArray(documentoIds) && documentoIds.length === 1;
    if (individual) setEnviandoId(documentoIds![0]);
    else setEnviando(true);
    setResultado(null);
    try {
      const r = await enviar({
        data: { proposta_id: propostaId, documento_ids: documentoIds },
      });
      setResultado(r);
      if (r.enviados > 0) toast.success(`${r.enviados} documento(s) enviado(s) ao banco.`);
      if (r.erros.length > 0)
        toast.warning(`${r.erros.length} documento(s) não puderam ser enviados.`);
      if (r.enviados === 0 && r.erros.length === 0) toast.info("Nenhum documento foi enviado.");
      recarregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar ao banco.");
    } finally {
      setEnviando(false);
      setEnviandoId(null);
    }
  }

  if (!clienteId) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Vincule um cliente à proposta para enviar os documentos ao banco.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Checklist de Dados Obrigatórios */}
      {envolvidos.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            Checklist de dados obrigatórios
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          {QUALIFICACAO_LABEL[env.tipo_qualificacao] ?? env.tipo_qualificacao}
                        </p>
                        {ok ? (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 pt-1">
                            <CheckCircle2 className="h-3 w-3" /> Todos os dados preenchidos
                          </p>
                        ) : (
                          <div className="pt-1.5 space-y-1">
                            <p className="text-[11px] font-bold text-destructive uppercase flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> PENDENTE
                            </p>
                            <p className="text-xs text-destructive/80 leading-relaxed italic">
                              Falta: {listarLabels(faltantes)}
                            </p>
                          </div>
                        )}
                      </div>
                      {!ok && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 border-primary/20 bg-primary/5 text-primary hover:bg-primary hover:text-white transition-colors font-semibold"
                          onClick={() => {
                            if (onCompletar) onCompletar(env);
                          }}
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

      {/* Disclaimer PDF — enxuto */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">
            O banco aceita PDF, JPG e PNG (até 10 MB).
          </span>{" "}
          Os documentos de todos os participantes (comprador, cônjuge, coproponente e vendedor) são
          enviados automaticamente para a vaga do dono, quando cadastrados no módulo{" "}
          <span className="font-medium text-foreground">Documentos</span> do cliente correspondente.
        </p>
      </div>

      {/* Ação de envio */}
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.07] via-card to-card shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1",
                totalPdfs === 0
                  ? "bg-destructive/10 text-destructive ring-destructive/20"
                  : "bg-primary/10 text-primary ring-primary/15",
              )}
            >
              <Landmark className="h-5 w-5" />
            </span>
            <div className="text-sm">
              <p
                className={cn(
                  "font-semibold tracking-tight",
                  totalPdfs === 0 ? "text-destructive" : "text-foreground",
                )}
              >
                {totalPdfs === 0 ? "Nenhum banco/documento pronto" : "Enviar documentos ao banco"}
              </p>
              <p className="text-muted-foreground">
                {totalPdfs > 0
                  ? `${totalPdfs} documento(s) em PDF/JPG/PNG prontos para envio.`
                  : "A proposta precisa de um banco selecionado e documentos em PDF/JPG/PNG."}
              </p>
            </div>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    onClick={() => {
                      if (bloqueado) {
                        const pendente = envolvidos.find(
                          (env) => faltantesEnvolvido(env).length > 0,
                        );
                        onCompletar?.(pendente || envolvidos[0]);
                      } else {
                        enviarAoBanco();
                      }
                    }}
                    disabled={enviando || enviandoBanco || totalPdfs === 0}
                    className="h-11 w-full gap-2 rounded-xl px-6 font-semibold shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98] disabled:shadow-none sm:w-auto"
                  >
                    {enviando || enviandoBanco ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Landmark className="h-4 w-4" />
                    )}
                    {enviando || enviandoBanco
                      ? "Enviando…"
                      : bloqueado
                        ? "Completar cadastro e enviar"
                        : "Enviar todos os documentos ao banco"}
                  </Button>
                </span>
              </TooltipTrigger>
              {bloqueado && (
                <TooltipContent className="max-w-xs space-y-2">
                  <p className="font-semibold text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Dados incompletos
                  </p>
                  <ul className="text-xs space-y-1">
                    {pendencias.map((p, i) => (
                      <li key={i}>• {descreverParticipante(p.env)}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    Complete os dados dos participantes acima para habilitar o envio.
                  </p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* Resultado do último envio */}
      {resultado &&
        (() => {
          const semVaga = resultado.erros.filter((er) =>
            /sem vaga|sem correspond/i.test(er.motivo),
          );
          const recusados = resultado.erros.filter((er) => !semVaga.includes(er));
          return (
            <Card>
              <CardContent className="space-y-3 p-4 text-sm">
                <div className="flex flex-wrap items-center gap-3 border-b border-border pb-2">
                  <p className="font-medium text-foreground">Resultado do envio</p>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    {resultado.enviados} enviado(s)
                  </span>
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                    {semVaga.length} sem vaga
                  </span>
                  <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                    {recusados.length} recusado(s) pelo banco
                  </span>
                </div>
                {resultado.sucesso.map((s, i) => (
                  <div key={`s-${i}`} className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="truncate">
                      <span className="text-foreground">{s.nome}</span>
                      {s.participante ? ` — ${s.participante}` : ""}
                    </span>
                  </div>
                ))}
                {semVaga.length > 0 && (
                  <div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      Documentos sem vaga correspondente
                    </p>
                    {semVaga.map((er, i) => (
                      <div key={`sv-${i}`} className="flex items-start gap-2 text-muted-foreground">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>
                          <span className="text-foreground">{er.nome}</span>
                          {er.participante ? ` — ${er.participante}` : ""} — {er.motivo}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {recusados.length > 0 && (
                  <div className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-2">
                    <p className="text-xs font-medium text-destructive">Recusados pelo banco</p>
                    {recusados.map((er, i) => (
                      <div key={`rc-${i}`} className="flex items-start gap-2 text-muted-foreground">
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                        <span>
                          <span className="text-foreground">{er.nome}</span>
                          {er.participante ? ` — ${er.participante}` : ""} — {er.motivo}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

      {/* Documentos consolidados por tipo */}
      {isLoading ? (
        <div className="flex items-center justify-center rounded-lg border border-border bg-card p-10 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando documentos…
        </div>
      ) : (
        porGrupo.map((g) => {
          const Icone = g.icone;
          return (
            <Card key={g.chave} className="overflow-hidden transition-shadow hover:shadow-sm">
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/10">
                      <Icone className="h-4 w-4" />
                    </span>
                    <h3 className="text-sm font-semibold tracking-tight text-foreground">
                      {g.titulo}
                    </h3>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {g.itens.length}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 rounded-lg"
                    onClick={() => abrirUpload(g.categoriaUpload)}
                  >
                    <Upload className="h-3.5 w-3.5" /> Enviar
                  </Button>
                </div>

                {g.itens.length === 0 ? (
                  <p className="py-3 text-center text-xs text-muted-foreground">
                    Nenhum documento nesta categoria.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {g.itens.map((d: any) => {
                      const pdf = ehFormatoBanco(d);
                      return (
                        <li
                          key={d.id}
                          className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                        >
                          <FileText
                            className={`h-4 w-4 shrink-0 ${pdf ? "text-primary" : "text-muted-foreground"}`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-foreground">{d.nome_arquivo}</p>
                            <p className="flex flex-wrap items-center gap-2 truncate text-xs text-muted-foreground">
                              <span>{d.tipo_documento}</span>
                              {!pdf && (
                                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                  formato não aceito
                                </span>
                              )}
                              {d.situacao_integracao === "enviado" && (
                                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                  enviado ao banco
                                </span>
                              )}
                              {d.situacao_integracao === "erro" && (
                                <span
                                  className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive"
                                  title={d.erro_integracao ?? undefined}
                                >
                                  falha no envio
                                </span>
                              )}
                              {!d.situacao_integracao && pdf && (
                                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                  aguardando envio
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            {pdf && d.situacao_integracao !== "enviado" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1.5 rounded-lg px-2.5"
                                title="Enviar este documento ao banco"
                                disabled={enviando || enviandoId === d.id}
                                onClick={() => enviarAoBanco([d.id])}
                              >
                                {enviandoId === d.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Landmark className="h-3.5 w-3.5" />
                                )}
                                <span className="hidden sm:inline">Enviar</span>
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              title="Visualizar"
                              onClick={() => visualizar(d.storage_path, d.nome_arquivo)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              title="Baixar"
                              onClick={() => baixar(d.storage_path, d.nome_arquivo)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              title="Excluir"
                              onClick={() => setExcluindo({ id: d.id, nome: d.nome_arquivo })}
                            >
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
              O documento “{excluindo?.nome}” será removido definitivamente do cadastro.
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
