import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, Upload, Eye, Pencil, Trash2, Download, Loader2, Search } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  type BancoFormulario,
  type FormularioBancario,
  listarFormularios,
  criarFormulario,
  atualizarFormulario,
  excluirFormulario,
  urlFormulario,
} from "@/lib/formularios/formularios.functions";
import { DpsView } from "@/components/formularios/dps-view";
import { OpHero } from "@/components/operacional/ui";
import { BancoLogo } from "@/components/bancos/banco-logo";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { usePermissao } from "@/hooks/use-permissao";

export const CATEGORIA_LABEL: Record<BancoFormulario, string> = {
  itau: "Itaú",
  bradesco: "Bradesco",
  santander: "Santander",
  inter: "Inter",
  diversos: "Diversos",
  dps: "DPS",
};

function formatBytes(n: number | null): string {
  if (!n && n !== 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function uploadPdf(banco: BancoFormulario, file: File): Promise<string> {
  const safe = file.name.replace(/[^\w.\-]/g, "_");
  const path = `${banco}/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage.from("formularios-bancarios").upload(path, file, {
    contentType: file.type || "application/pdf",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export function FormulariosView({ banco }: { banco: BancoFormulario }) {
  if (banco === "dps") return <DpsView />;
  return <FormulariosLista banco={banco} />;
}

function FormulariosLista({ banco }: { banco: BancoFormulario }) {
  const listar = useServerFn(listarFormularios);
  const qc = useQueryClient();
  // Enviar, editar e excluir: "Formulários: enviar" (o servidor confere).
  const podeEnviar = usePermissao("documentos.formularios", "create");
  const { data, isLoading } = useQuery({
    queryKey: ["formularios"],
    queryFn: () => listar(),
  });

  const [uploadOpen, setUploadOpen] = useState(false);
  const [editando, setEditando] = useState<FormularioBancario | null>(null);
  const [excluindo, setExcluindo] = useState<FormularioBancario | null>(null);

  const [busca, setBusca] = useState("");
  const daCategoria = (data ?? []).filter((f) => f.banco === banco);
  const termo = busca.trim().toLowerCase();
  const itens = termo
    ? daCategoria.filter((f) => `${f.nome} ${f.descricao ?? ""}`.toLowerCase().includes(termo))
    : daCategoria;
  const contagem = (c: BancoFormulario) => (data ?? []).filter((f) => f.banco === c).length;

  const abrirArquivo = useServerFn(urlFormulario);
  const excluirFn = useServerFn(excluirFormulario);

  const visualizar = useMutation({
    mutationFn: (id: string) => abrirArquivo({ data: { id } }),
    onSuccess: (r) => window.open(r.url, "_blank", "noopener,noreferrer"),
    onError: (e: any) => toast.error(mensagemDeErro(e, "Não foi possível abrir o arquivo.")),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => excluirFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Formulário excluído.");
      setExcluindo(null);
      qc.invalidateQueries({ queryKey: ["formularios"] });
    },
    onError: (e: any) => toast.error(mensagemDeErro(e, "Falha ao excluir.")),
  });

  const label = CATEGORIA_LABEL[banco];
  const ehBanco =
    banco === "itau" || banco === "bradesco" || banco === "santander" || banco === "inter";

  return (
    <div className="mx-auto w-full max-w-none space-y-5 p-4 md:p-6">
      <OpHero
        icon={ehBanco ? <BancoLogo nome={label} size="lg" /> : <FileText className="h-5 w-5" />}
        eyebrow="Documentos · Formulários"
        titulo={label}
        descricao={`Modelos de formulários em PDF da categoria ${label}.`}
        acoes={
          podeEnviar ? (
            <Button data-tour="formularios-enviar" onClick={() => setUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Enviar formulário
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-2 lg:flex-row lg:items-center">
        <nav data-tour="formularios-categorias"
          aria-label="Categorias de formulários"
          className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {(Object.keys(CATEGORIA_LABEL) as BancoFormulario[]).map((c) => {
            const ativo = c === banco;
            const comLogo = c !== "diversos" && c !== "dps";
            return (
              <Link
                key={c}
                to="/formularios/$banco"
                params={{ banco: c }}
                className={
                  "flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-colors " +
                  (ativo
                    ? "border-primary bg-primary/5 font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground")
                }
              >
                {comLogo ? (
                  <BancoLogo nome={CATEGORIA_LABEL[c]} size="sm" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                {CATEGORIA_LABEL[c]}
                <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
                  {isLoading ? "…" : contagem(c)}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="relative lg:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={`Buscar em ${label}`}
            className="h-9 pl-8"
            aria-label="Buscar formulário"
          />
        </div>
      </div>

      <div data-tour="formularios-lista" className="space-y-2.5">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
        ) : itens.length === 0 ? (
          <Card>
            <CardContent className="py-14 text-center">
              <span className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                <FileText className="h-6 w-6" />
              </span>
              <p className="text-sm text-muted-foreground">
                {termo
                  ? `Nenhum formulário de ${label} com “${busca.trim()}”.`
                  : `Nenhum formulário de ${label} cadastrado ainda.`}
              </p>
            </CardContent>
          </Card>
        ) : (
          itens.map((f) => (
            <div
              key={f.id}
              className="group flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-all hover:border-primary/30 hover:shadow-sm"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 transition-transform group-hover:scale-105">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground group-hover:text-primary">
                    {f.nome}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {f.descricao ? `${f.descricao} · ` : ""}
                    {formatBytes(f.tamanho)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => visualizar.mutate(f.id)}
                  disabled={visualizar.isPending}
                >
                  <Eye className="mr-1 h-4 w-4" />
                  Ver
                </Button>
                {podeEnviar && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setEditando(f)}>
                      <Pencil className="mr-1 h-4 w-4" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Excluir formulário"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setExcluindo(f)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {uploadOpen && (
        <UploadDialog
          banco={banco}
          onClose={() => setUploadOpen(false)}
          onDone={() => {
            setUploadOpen(false);
            qc.invalidateQueries({ queryKey: ["formularios"] });
          }}
        />
      )}

      {editando && (
        <EditarDialog
          formulario={editando}
          onClose={() => setEditando(null)}
          onDone={() => {
            setEditando(null);
            qc.invalidateQueries({ queryKey: ["formularios"] });
          }}
        />
      )}

      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir formulário</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo "{excluindo?.nome}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => excluindo && excluir.mutate(excluindo.id)}
              disabled={excluir.isPending}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UploadDialog({
  banco,
  onClose,
  onDone,
}: {
  banco: BancoFormulario;
  onClose: () => void;
  onDone: () => void;
}) {
  const criar = useServerFn(criarFormulario);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function escolher(f: File | null) {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Envie um arquivo PDF.");
      return;
    }
    setFile(f);
    if (!nome) setNome(f.name.replace(/\.pdf$/i, ""));
  }

  async function salvar() {
    if (!file) {
      toast.error("Selecione um PDF.");
      return;
    }
    if (!nome.trim()) {
      toast.error("Informe um nome.");
      return;
    }
    setSalvando(true);
    try {
      const path = await uploadPdf(banco, file);
      await criar({
        data: {
          banco,
          nome: nome.trim(),
          descricao: descricao.trim() || null,
          storage_path: path,
          content_type: file.type || "application/pdf",
          tamanho: file.size,
        },
      });
      toast.success("Formulário enviado.");
      onDone();
    } catch (e: any) {
      toast.error(mensagemDeErro(e, "Falha no envio."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar formulário · {CATEGORIA_LABEL[banco]}</DialogTitle>
          <DialogDescription>Adicione um modelo de formulário em PDF.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Ficha cadastral PF"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes sobre o formulário…"
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Arquivo PDF</Label>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => escolher(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-left ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">
                {file ? file.name : <span className="text-muted-foreground">Selecionar PDF</span>}
              </span>
            </button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditarDialog({
  formulario,
  onClose,
  onDone,
}: {
  formulario: FormularioBancario;
  onClose: () => void;
  onDone: () => void;
}) {
  const atualizar = useServerFn(atualizarFormulario);
  const baixar = useServerFn(urlFormulario);
  const banco = formulario.banco;
  const [nome, setNome] = useState(formulario.nome);
  const [descricao, setDescricao] = useState(formulario.descricao ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function escolher(f: File | null) {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Envie um arquivo PDF.");
      return;
    }
    setFile(f);
  }

  async function abrir() {
    try {
      const r = await baixar({ data: { id: formulario.id } });
      window.open(r.url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(mensagemDeErro(e, "Não foi possível abrir."));
    }
  }

  async function salvar() {
    if (!nome.trim()) {
      toast.error("Informe um nome.");
      return;
    }
    setSalvando(true);
    try {
      let novoPath: string | null = null;
      if (file) novoPath = await uploadPdf(banco, file);
      await atualizar({
        data: {
          id: formulario.id,
          nome: nome.trim(),
          descricao: descricao.trim() || null,
          banco,
          novo_storage_path: novoPath,
          content_type: file?.type ?? null,
          tamanho: file?.size ?? null,
        },
      });
      toast.success("Formulário atualizado.");
      onDone();
    } catch (e: any) {
      toast.error(mensagemDeErro(e, "Falha ao salvar."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar formulário</DialogTitle>
          <DialogDescription>Atualize os dados ou substitua o arquivo PDF.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Substituir arquivo (opcional)</Label>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => escolher(e.target.files?.[0] ?? null)}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="min-w-0 flex-1 justify-start"
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate">{file ? file.name : "Escolher novo PDF"}</span>
              </Button>
              <Button type="button" variant="outline" className="shrink-0" onClick={abrir}>
                <Download className="mr-2 h-4 w-4" />
                Ver atual
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
