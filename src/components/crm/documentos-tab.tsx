import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  Download,
  Check,
  X,
  Loader2,
  Folder,
  FolderPlus,
  ChevronLeft,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ToneBadge } from "@/components/crm/tone-badge";
import { DocumentosChecklist } from "@/components/crm/documentos-checklist";
import { supabase } from "@/integrations/supabase/client";
import {
  listarDocumentos,
  anexarDocumento,
  revisarDocumento,
  urlDocumento,
  editarDocumento,
  excluirDocumento,
} from "@/lib/crm/clientes.functions";
import {
  listarPastasDocumentos,
  criarPastaDocumentos,
  renomearPastaDocumentos,
  excluirPastaDocumentos,
  SLUG_CATEGORIAS,
  type DocumentoPasta,
} from "@/lib/crm/documento-pastas.functions";
import { tiposParaCategorias, TIPO_OUTRO } from "@/lib/crm/documento-tipos";
import { VisualizadorArquivo } from "@/components/comum/visualizador-arquivo";

type Categoria =
  | "comprador"
  | "conjuge"
  | "vendedor"
  | "vendedor_conjuge"
  | "imovel"
  | "outros";

const CATEGORIA_LABEL: Record<Categoria, string> = {
  comprador: "Comprador / Titular",
  conjuge: "Cônjuge / Composição",
  vendedor: "Vendedor",
  vendedor_conjuge: "Cônjuge do vendedor",
  imovel: "Imóvel",
  outros: "Outros",
};

const statusTone: Record<string, "success" | "warning" | "danger" | "muted" | "info"> = {
  aprovado: "success",
  recebido: "info",
  pendente: "warning",
  reprovado: "danger",
  expirado: "danger",
};

/** Categorias oferecidas no seletor "titular" de uma pasta. */
function categoriasDaPasta(pasta: DocumentoPasta | null): Categoria[] {
  if (!pasta) return ["outros"];
  if (pasta.slug && SLUG_CATEGORIAS[pasta.slug]) {
    return SLUG_CATEGORIAS[pasta.slug] as Categoria[];
  }
  return ["outros"];
}

/** Um documento pertence à pasta por vínculo direto ou (legado) pela categoria. */
function docNaPasta(doc: any, pasta: DocumentoPasta): boolean {
  if (doc.pasta_id) return doc.pasta_id === pasta.id;
  if (!pasta.slug) return false;
  return (SLUG_CATEGORIAS[pasta.slug] ?? []).includes(doc.categoria);
}

export function DocumentosTab({ clienteId }: { clienteId: string }) {
  const qc = useQueryClient();
  const listar = useServerFn(listarDocumentos);
  const anexar = useServerFn(anexarDocumento);
  const revisar = useServerFn(revisarDocumento);
  const gerarUrl = useServerFn(urlDocumento);
  const editar = useServerFn(editarDocumento);
  const excluir = useServerFn(excluirDocumento);
  const listarPastas = useServerFn(listarPastasDocumentos);
  const criarPasta = useServerFn(criarPastaDocumentos);
  const renomearPasta = useServerFn(renomearPastaDocumentos);
  const excluirPasta = useServerFn(excluirPastaDocumentos);

  const [aba, setAba] = useState<"documentos" | "checklist">("documentos");
  const [pastaId, setPastaId] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<Categoria>("comprador");
  const [tipo, setTipo] = useState("");
  const [tipoOutro, setTipoOutro] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [editDoc, setEditDoc] = useState<any | null>(null);
  const [editCategoria, setEditCategoria] = useState<Categoria>("comprador");
  const [editTipo, setEditTipo] = useState("");
  const [editTipoOutro, setEditTipoOutro] = useState(false);
  const [salvandoEdit, setSalvandoEdit] = useState(false);
  const [delDoc, setDelDoc] = useState<any | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  // Pastas
  const [novaPastaOpen, setNovaPastaOpen] = useState(false);
  const [novaPastaNome, setNovaPastaNome] = useState("");
  const [salvandoPasta, setSalvandoPasta] = useState(false);
  const [renomearAlvo, setRenomearAlvo] = useState<DocumentoPasta | null>(null);
  const [renomearNome, setRenomearNome] = useState("");
  const [delPasta, setDelPasta] = useState<DocumentoPasta | null>(null);
  const [excluindoPasta, setExcluindoPasta] = useState(false);
  const [visualizando, setVisualizando] = useState<{ url: string; nome: string } | null>(null);

  const { data: docs, isLoading } = useQuery({
    queryKey: ["cliente-docs", clienteId],
    queryFn: () => listar({ data: { cliente_id: clienteId } }),
  });
  const { data: pastas, isLoading: pastasLoading } = useQuery({
    queryKey: ["cliente-doc-pastas", clienteId],
    queryFn: () => listarPastas({ data: { cliente_id: clienteId } }),
  });

  const pasta = useMemo(
    () => (pastas ?? []).find((p) => p.id === pastaId) ?? null,
    [pastas, pastaId],
  );

  const docsPasta = useMemo(
    () => (pasta ? (docs ?? []).filter((d: any) => docNaPasta(d, pasta)) : []),
    [docs, pasta],
  );

  const tiposCategoria = useMemo(() => tiposParaCategorias([categoria]), [categoria]);
  const tiposEditCategoria = useMemo(
    () => tiposParaCategorias([editCategoria]),
    [editCategoria],
  );

  function abrirPasta(p: DocumentoPasta) {
    setPastaId(p.id);
    setCategoria(categoriasDaPasta(p)[0]);
    setTipo("");
  }

  function recarregar() {
    qc.invalidateQueries({ queryKey: ["cliente-docs", clienteId] });
    qc.invalidateQueries({ queryKey: ["cliente-doc-pastas", clienteId] });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !pasta) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("Arquivo acima de 10 MB.");
    if (!tipo.trim()) return toast.error("Informe o tipo do documento.");
    setEnviando(true);
    try {
      const path = `${clienteId}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("cliente-documentos").upload(path, file);
      if (upErr) throw upErr;
      await anexar({
        data: {
          cliente_id: clienteId,
          categoria,
          pasta_id: pasta.id,
          tipo_documento: tipo.trim(),
          nome_arquivo: file.name,
          storage_path: path,
          mime_type: file.type,
          tamanho_bytes: file.size,
        },
      });
      toast.success("Documento anexado.");
      setTipo("");
      recarregar();
    } catch (err: any) {
      toast.error(err?.message ?? "Falha no upload.");
    } finally {
      setEnviando(false);
    }
  }

  async function baixar(storage_path: string, nome: string) {
    try {
      const { url } = await gerarUrl({ data: { storage_path } });
      setVisualizando({ url, nome });
    } catch {
      toast.error("Falha ao gerar link.");
    }
  }

  async function marcar(id: string, status: "aprovado" | "reprovado") {
    try {
      await revisar({ data: { id, status } });
      toast.success(status === "aprovado" ? "Documento aprovado." : "Documento reprovado.");
      qc.invalidateQueries({ queryKey: ["cliente-docs", clienteId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao revisar documento.");
    }
  }

  function abrirEdicao(d: any) {
    setEditDoc(d);
    setEditCategoria(d.categoria);
    const t = d.tipo_documento ?? "";
    setEditTipo(t);
    setEditTipoOutro(t !== "" && !tiposParaCategorias([d.categoria as Categoria]).includes(t));
  }


  async function salvarEdicao() {
    if (!editDoc) return;
    if (!editTipo.trim()) return toast.error("Informe o tipo do documento.");
    setSalvandoEdit(true);
    try {
      await editar({
        data: { id: editDoc.id, categoria: editCategoria, tipo_documento: editTipo.trim() },
      });
      toast.success("Documento atualizado.");
      setEditDoc(null);
      recarregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar.");
    } finally {
      setSalvandoEdit(false);
    }
  }

  async function confirmarExclusao() {
    if (!delDoc) return;
    setExcluindo(true);
    try {
      await excluir({ data: { id: delDoc.id } });
      toast.success("Documento excluído.");
      setDelDoc(null);
      recarregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir.");
    } finally {
      setExcluindo(false);
    }
  }

  async function confirmarNovaPasta() {
    if (!novaPastaNome.trim()) return toast.error("Informe o nome da pasta.");
    setSalvandoPasta(true);
    try {
      await criarPasta({ data: { cliente_id: clienteId, nome: novaPastaNome.trim() } });
      toast.success("Pasta criada.");
      setNovaPastaOpen(false);
      setNovaPastaNome("");
      qc.invalidateQueries({ queryKey: ["cliente-doc-pastas", clienteId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar pasta.");
    } finally {
      setSalvandoPasta(false);
    }
  }

  async function confirmarRenomear() {
    if (!renomearAlvo) return;
    if (!renomearNome.trim()) return toast.error("Informe o nome da pasta.");
    setSalvandoPasta(true);
    try {
      await renomearPasta({ data: { id: renomearAlvo.id, nome: renomearNome.trim() } });
      toast.success("Pasta renomeada.");
      setRenomearAlvo(null);
      qc.invalidateQueries({ queryKey: ["cliente-doc-pastas", clienteId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao renomear.");
    } finally {
      setSalvandoPasta(false);
    }
  }

  async function confirmarExclusaoPasta() {
    if (!delPasta) return;
    setExcluindoPasta(true);
    try {
      await excluirPasta({ data: { id: delPasta.id } });
      toast.success("Pasta excluída.");
      setDelPasta(null);
      recarregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir pasta.");
    } finally {
      setExcluindoPasta(false);
    }
  }

  const abaBar = (
    <div className="inline-flex rounded-lg border border-border p-1">
      <button
        type="button"
        onClick={() => setAba("documentos")}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          aba === "documentos" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
        }`}
      >
        Pastas de documentos
      </button>
      <button
        type="button"
        onClick={() => setAba("checklist")}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          aba === "checklist" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
        }`}
      >
        Checklist
      </button>
    </div>
  );

  if (aba === "checklist") {
    return (
      <div className="space-y-4">
        {abaBar}
        <DocumentosChecklist clienteId={clienteId} />
      </div>
    );
  }

  if (isLoading || pastasLoading) {
    return (
      <div className="space-y-4">
        {abaBar}
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  // Visão de pastas
  if (!pasta) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {abaBar}
          <Button size="sm" variant="outline" onClick={() => setNovaPastaOpen(true)}>
            <FolderPlus className="size-4" />
            Nova pasta
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(pastas ?? []).map((p) => (
            <div
              key={p.id}
              className="group flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <button
                type="button"
                onClick={() => abrirPasta(p)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <Folder className="size-8 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.total_documentos} documento(s)
                  </p>
                  {p.criado_por_nome ? (
                    <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      <User className="size-3 shrink-0" />
                      <span className="truncate">{p.criado_por_nome}</span>
                    </span>
                  ) : null}
                </div>

              </button>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  title="Renomear pasta"
                  onClick={() => {
                    setRenomearAlvo(p);
                    setRenomearNome(p.nome);
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Excluir pasta"
                  onClick={() => setDelPasta(p)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Nova pasta */}
        <Dialog open={novaPastaOpen} onOpenChange={(o) => !o && setNovaPastaOpen(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova pasta</DialogTitle>
            </DialogHeader>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Nome da pasta</label>
              <Input
                value={novaPastaNome}
                onChange={(e) => setNovaPastaNome(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmarNovaPasta()}
                placeholder="Ex.: Certidões, Comprovantes…"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNovaPastaOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={confirmarNovaPasta} disabled={salvandoPasta}>
                {salvandoPasta ? "Criando…" : "Criar pasta"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Renomear pasta */}
        <Dialog open={!!renomearAlvo} onOpenChange={(o) => !o && setRenomearAlvo(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Renomear pasta</DialogTitle>
            </DialogHeader>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Nome da pasta</label>
              <Input
                value={renomearNome}
                onChange={(e) => setRenomearNome(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmarRenomear()}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRenomearAlvo(null)}>
                Cancelar
              </Button>
              <Button onClick={confirmarRenomear} disabled={salvandoPasta}>
                {salvandoPasta ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Excluir pasta */}
        <AlertDialog open={!!delPasta} onOpenChange={(o) => !o && setDelPasta(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir pasta?</AlertDialogTitle>
              <AlertDialogDescription>
                A pasta "{delPasta?.nome}" será removida. Os documentos dentro dela serão movidos
                para "Outros". Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  confirmarExclusaoPasta();
                }}
                disabled={excluindoPasta}
              >
                {excluindoPasta ? "Excluindo…" : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  const categoriasPasta = categoriasDaPasta(pasta);

  // Visão dentro de uma pasta
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setPastaId(null)}>
          <ChevronLeft className="size-4" />
          Pastas
        </Button>
        <span className="text-sm font-medium text-foreground">{pasta.nome}</span>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          {categoriasPasta.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Titular do documento</label>
              <Select
                value={categoria}
                onValueChange={(v) => {
                  setCategoria(v as Categoria);
                  setTipo("");
                  setTipoOutro(false);
                }}
              >
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoriasPasta.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORIA_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Tipo de documento</label>
            <Select
              value={tiposCategoria.includes(tipo) || tipo === "" ? tipo : TIPO_OUTRO}
              onValueChange={(v) => {
                if (v === TIPO_OUTRO) {
                  setTipoOutro(true);
                  setTipo("");
                } else {
                  setTipoOutro(false);
                  setTipo(v);
                }
              }}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {tiposCategoria.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
                <SelectItem value={TIPO_OUTRO}>Outro (especificar)…</SelectItem>
              </SelectContent>
            </Select>
            {(tipoOutro || tiposCategoria.length === 0) && (
              <Input
                className="mt-1.5 w-64"
                placeholder="Descreva o tipo do documento"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
              />
            )}
          </div>
          <Button asChild disabled={enviando} className="relative">
            <label>
              {enviando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Enviar arquivo
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="sr-only"
                onChange={onFile}
                disabled={enviando}
              />
            </label>
          </Button>
        </CardContent>
      </Card>

      {docsPasta.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhum documento nesta pasta.
        </p>
      ) : (
        <div className="space-y-2">
          {docsPasta.map((d: any) => (
            <div
              key={d.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >
              <FileText className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{d.nome_arquivo}</p>
                <p className="text-xs text-muted-foreground">
                  {CATEGORIA_LABEL[d.categoria as Categoria]} · {d.tipo_documento} · v{d.versao}
                </p>
              </div>
              <ToneBadge tone={statusTone[d.status] ?? "muted"}>{d.status}</ToneBadge>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => baixar(d.storage_path, d.nome_arquivo)}
                title="Visualizar / baixar"
              >
                <Download className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => abrirEdicao(d)} title="Editar">
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => marcar(d.id, "aprovado")}
                title="Aprovar"
              >
                <Check className="size-4 text-success" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => marcar(d.id, "reprovado")}
                title="Reprovar"
              >
                <X className="size-4 text-destructive" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setDelDoc(d)}
                title="Excluir"
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Editar */}
      <Dialog open={!!editDoc} onOpenChange={(o) => !o && setEditDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {categoriasPasta.length > 1 && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Titular do documento</label>
                <Select value={editCategoria} onValueChange={(v) => setEditCategoria(v as Categoria)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriasPasta.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORIA_LABEL[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Tipo de documento</label>
              <Select
                value={
                  tiposEditCategoria.includes(editTipo) || editTipo === ""
                    ? editTipo
                    : TIPO_OUTRO
                }
                onValueChange={(v) => {
                  if (v === TIPO_OUTRO) {
                    setEditTipoOutro(true);
                    setEditTipo("");
                  } else {
                    setEditTipoOutro(false);
                    setEditTipo(v);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {tiposEditCategoria.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                  <SelectItem value={TIPO_OUTRO}>Outro (especificar)…</SelectItem>
                </SelectContent>
              </Select>
              {(editTipoOutro ||
                (editTipo !== "" && !tiposEditCategoria.includes(editTipo)) ||
                tiposEditCategoria.length === 0) && (
                <Input
                  className="mt-1.5"
                  placeholder="Descreva o tipo do documento"
                  value={editTipo}
                  onChange={(e) => setEditTipo(e.target.value)}
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDoc(null)}>
              Cancelar
            </Button>
            <Button onClick={salvarEdicao} disabled={salvandoEdit}>
              {salvandoEdit ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <AlertDialog open={!!delDoc} onOpenChange={(o) => !o && setDelDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo "{delDoc?.nome_arquivo}" será removido permanentemente. Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmarExclusao();
              }}
              disabled={excluindo}
            >
              {excluindo ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <VisualizadorArquivo
        arquivo={visualizando}
        open={!!visualizando}
        onOpenChange={(o) => !o && setVisualizando(null)}
      />
    </div>
  );
}
