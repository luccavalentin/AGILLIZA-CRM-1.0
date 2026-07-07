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
import { supabase } from "@/integrations/supabase/client";
import {
  listarDocumentos,
  anexarDocumento,
  revisarDocumento,
  urlDocumento,
  editarDocumento,
  excluirDocumento,
} from "@/lib/crm/clientes.functions";

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

type Pasta = {
  id: string;
  nome: string;
  categorias: Categoria[];
};

const PASTAS: Pasta[] = [
  { id: "comprador", nome: "Comprador / Titular e Cônjuge", categorias: ["comprador", "conjuge"] },
  { id: "vendedor", nome: "Vendedor e Cônjuge", categorias: ["vendedor", "vendedor_conjuge"] },
  { id: "imovel", nome: "Imóvel", categorias: ["imovel"] },
  { id: "outros", nome: "Outros", categorias: ["outros"] },
];

const statusTone: Record<string, "success" | "warning" | "danger" | "muted" | "info"> = {
  aprovado: "success",
  recebido: "info",
  pendente: "warning",
  reprovado: "danger",
  expirado: "danger",
};

export function DocumentosTab({ clienteId }: { clienteId: string }) {
  const qc = useQueryClient();
  const listar = useServerFn(listarDocumentos);
  const anexar = useServerFn(anexarDocumento);
  const revisar = useServerFn(revisarDocumento);
  const gerarUrl = useServerFn(urlDocumento);
  const editar = useServerFn(editarDocumento);
  const excluir = useServerFn(excluirDocumento);

  const [aba, setAba] = useState<"documentos" | "checklist">("documentos");
  const [pastaId, setPastaId] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<Categoria>("comprador");
  const [tipo, setTipo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [editDoc, setEditDoc] = useState<any | null>(null);
  const [editCategoria, setEditCategoria] = useState<Categoria>("comprador");
  const [editTipo, setEditTipo] = useState("");
  const [salvandoEdit, setSalvandoEdit] = useState(false);
  const [delDoc, setDelDoc] = useState<any | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const { data: docs, isLoading } = useQuery({
    queryKey: ["cliente-docs", clienteId],
    queryFn: () => listar({ data: { cliente_id: clienteId } }),
  });

  const pasta = useMemo(() => PASTAS.find((p) => p.id === pastaId) ?? null, [pastaId]);

  const contagem = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of PASTAS) map[p.id] = 0;
    for (const d of docs ?? []) {
      const p = PASTAS.find((x) => x.categorias.includes(d.categoria));
      if (p) map[p.id] += 1;
    }
    return map;
  }, [docs]);

  const docsPasta = useMemo(
    () => (pasta ? (docs ?? []).filter((d: any) => pasta.categorias.includes(d.categoria)) : []),
    [docs, pasta],
  );

  function abrirPasta(p: Pasta) {
    setPastaId(p.id);
    setCategoria(p.categorias[0]);
    setTipo("");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
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
          tipo_documento: tipo.trim(),
          nome_arquivo: file.name,
          storage_path: path,
          mime_type: file.type,
          tamanho_bytes: file.size,
        },
      });
      toast.success("Documento anexado.");
      setTipo("");
      qc.invalidateQueries({ queryKey: ["cliente-docs", clienteId] });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha no upload.");
    } finally {
      setEnviando(false);
    }
  }

  async function baixar(storage_path: string) {
    try {
      const { url } = await gerarUrl({ data: { storage_path } });
      window.open(url, "_blank");
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
    setEditTipo(d.tipo_documento ?? "");
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
      qc.invalidateQueries({ queryKey: ["cliente-docs", clienteId] });
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
      qc.invalidateQueries({ queryKey: ["cliente-docs", clienteId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir.");
    } finally {
      setExcluindo(false);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  // Visão de pastas
  if (!pasta) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {PASTAS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => abrirPasta(p)}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-accent"
          >
            <Folder className="size-8 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{p.nome}</p>
              <p className="text-xs text-muted-foreground">
                {contagem[p.id] ?? 0} documento(s)
              </p>
            </div>
          </button>
        ))}
      </div>
    );
  }

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
          {pasta.categorias.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Titular do documento</label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as Categoria)}>
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pasta.categorias.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORIA_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Tipo (ex.: RG, IR, Matrícula)</label>
            <Input className="w-52" value={tipo} onChange={(e) => setTipo(e.target.value)} />
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
                onClick={() => baixar(d.storage_path)}
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
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Titular do documento</label>
              <Select value={editCategoria} onValueChange={(v) => setEditCategoria(v as Categoria)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(PASTAS.find((p) => p.categorias.includes(editCategoria))?.categorias ?? []).map(
                    (c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORIA_LABEL[c]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Tipo (ex.: RG, IR, Matrícula)</label>
              <Input value={editTipo} onChange={(e) => setEditTipo(e.target.value)} />
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
    </div>
  );
}
