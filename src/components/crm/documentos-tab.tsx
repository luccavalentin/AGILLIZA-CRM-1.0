import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentosChecklist } from "@/components/crm/documentos-checklist";
import { VisualizadorArquivo } from "@/components/comum/visualizador-arquivo";
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
  type DocumentoPasta,
} from "@/lib/crm/documento-pastas.functions";
import { tiposParaCategorias } from "@/lib/crm/documento-tipos";
import { AbaBar } from "./documentos-tab/aba-bar";
import { CardPasta } from "./documentos-tab/card-pasta";
import { Trilha } from "./documentos-tab/trilha";
import { UploadBar } from "./documentos-tab/upload-bar";
import { LinhaDocumento } from "./documentos-tab/linha-documento";
import {
  NovaPastaDialog,
  RenomearPastaDialog,
  ExcluirPastaDialog,
} from "./documentos-tab/pasta-dialogs";
import {
  EditarDocumentoDialog,
  ExcluirDocumentoDialog,
} from "./documentos-tab/editar-documento-dialog";
import { categoriasDaPasta, docNaPasta, type Categoria } from "./documentos-tab/types";

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

  const [novaPastaOpen, setNovaPastaOpen] = useState(false);
  const [novaPastaNome, setNovaPastaNome] = useState("");
  const [salvandoPasta, setSalvandoPasta] = useState(false);
  const [renomearAlvo, setRenomearAlvo] = useState<DocumentoPasta | null>(null);
  const [renomearNome, setRenomearNome] = useState("");
  const [delPasta, setDelPasta] = useState<DocumentoPasta | null>(null);
  const [excluindoPasta, setExcluindoPasta] = useState(false);
  const [visualizando, setVisualizando] = useState<{ url: string; nome: string } | null>(
    null,
  );

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

  const subpastas = useMemo(
    () => (pastas ?? []).filter((p) => (p.parent_id ?? null) === pastaId),
    [pastas, pastaId],
  );

  const trilhaPastas = useMemo(() => {
    if (!pastaId) return [] as DocumentoPasta[];
    const porId = new Map((pastas ?? []).map((p) => [p.id, p]));
    const cadeia: DocumentoPasta[] = [];
    let atual = porId.get(pastaId) ?? null;
    let guarda = 0;
    while (atual && guarda++ < 20) {
      cadeia.unshift(atual);
      atual = atual.parent_id ? (porId.get(atual.parent_id) ?? null) : null;
    }
    return cadeia;
  }, [pastas, pastaId]);

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

  async function enviarUm(
    file: File,
    pastaDestinoId: string,
    cat: Categoria,
    tipoDoc: string,
  ) {
    const path = `${clienteId}/${crypto.randomUUID()}-${file.name}`;
    const { error: upErr } = await supabase.storage
      .from("cliente-documentos")
      .upload(path, file);
    if (upErr) throw upErr;
    await anexar({
      data: {
        cliente_id: clienteId,
        categoria: cat,
        pasta_id: pastaDestinoId,
        tipo_documento: tipoDoc,
        nome_arquivo: file.name,
        storage_path: path,
        mime_type: file.type,
        tamanho_bytes: file.size,
      },
    });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0 || !pasta) return;
    if (files.some((f) => f.size > 10 * 1024 * 1024))
      return toast.error("Cada arquivo deve ter no máximo 10 MB.");
    if (!tipo.trim()) return toast.error("Informe o tipo do documento.");
    setEnviando(true);
    let ok = 0;
    let falhas = 0;
    for (const file of files) {
      try {
        await enviarUm(file, pasta.id, categoria, tipo.trim());
        ok++;
      } catch {
        falhas++;
      }
    }
    if (falhas > 0) toast.warning(`${ok} enviado(s), ${falhas} com falha.`);
    else toast.success(`${ok} documento(s) anexado(s).`);
    setTipo("");
    recarregar();
    setEnviando(false);
  }

  async function garantirSubpastas(
    partes: string[],
    paiInicial: string,
    cache: Map<string, string>,
  ): Promise<string> {
    let pai = paiInicial;
    let chave = paiInicial;
    for (const parte of partes) {
      chave = `${chave}/${parte}`;
      const existente = cache.get(chave);
      if (existente) {
        pai = existente;
        continue;
      }
      const { id } = await criarPasta({
        data: { cliente_id: clienteId, nome: parte, parent_id: pai },
      });
      cache.set(chave, id);
      pai = id;
    }
    return pai;
  }

  async function onFolder(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0 || !pasta) return;
    if (files.some((f) => f.size > 10 * 1024 * 1024))
      return toast.error("Cada arquivo deve ter no máximo 10 MB.");
    setEnviando(true);
    const cache = new Map<string, string>();
    let ok = 0;
    let falhas = 0;
    for (const file of files) {
      try {
        const rel = (file as any).webkitRelativePath as string | undefined;
        let destino = pasta.id;
        if (rel && rel.includes("/")) {
          const partes = rel.split("/");
          partes.pop();
          destino = await garantirSubpastas(partes, pasta.id, cache);
        }
        await enviarUm(file, destino, categoria, file.name);
        ok++;
      } catch {
        falhas++;
      }
    }
    if (falhas > 0) toast.warning(`${ok} enviado(s), ${falhas} com falha.`);
    else toast.success(`Pasta enviada — ${ok} arquivo(s).`);
    recarregar();
    setEnviando(false);
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

  async function solicitarCorrecao(doc: any) {
    const observacao = window.prompt(
      `Descreva o que precisa ser corrigido em "${doc.nome_arquivo}":`,
      "",
    );
    if (observacao === null) return;
    try {
      await revisar({
        data: { id: doc.id, status: "pendente", observacao: observacao.trim() || null },
      });
      toast.success("Correção solicitada.");
      qc.invalidateQueries({ queryKey: ["cliente-docs", clienteId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao solicitar correção.");
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
      await criarPasta({
        data: { cliente_id: clienteId, nome: novaPastaNome.trim(), parent_id: pastaId },
      });
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

  const abaBar = <AbaBar aba={aba} onChange={setAba} />;

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

  // Diálogos de pasta reutilizados em ambas as visões
  const pastaDialogs = (
    <>
      <NovaPastaDialog
        open={novaPastaOpen}
        onOpenChange={setNovaPastaOpen}
        nome={novaPastaNome}
        setNome={setNovaPastaNome}
        onConfirmar={confirmarNovaPasta}
        salvando={salvandoPasta}
        titulo={pasta ? "Nova subpasta" : "Nova pasta"}
      />
      <RenomearPastaDialog
        alvo={renomearAlvo}
        onClose={() => setRenomearAlvo(null)}
        nome={renomearNome}
        setNome={setRenomearNome}
        onConfirmar={confirmarRenomear}
        salvando={salvandoPasta}
      />
      <ExcluirPastaDialog
        alvo={delPasta}
        onClose={() => setDelPasta(null)}
        onConfirmar={confirmarExclusaoPasta}
        excluindo={excluindoPasta}
        descricaoExtra={pasta ? "e suas subpastas" : undefined}
      />
    </>
  );

  function abrirRenomear(p: DocumentoPasta) {
    setRenomearAlvo(p);
    setRenomearNome(p.nome);
  }

  // Visão de pastas (raiz)
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
          {subpastas.map((p) => (
            <CardPasta
              key={p.id}
              pasta={p}
              onOpen={abrirPasta}
              onRenomear={abrirRenomear}
              onExcluir={setDelPasta}
            />
          ))}
        </div>
        {pastaDialogs}
      </div>
    );
  }

  const categoriasPasta = categoriasDaPasta(pasta);

  // Visão dentro de uma pasta
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Trilha
          cadeia={trilhaPastas}
          onRaiz={() => setPastaId(null)}
          onNavegar={setPastaId}
        />
        <Button size="sm" variant="outline" onClick={() => setNovaPastaOpen(true)}>
          <FolderPlus className="size-4" />
          Nova subpasta
        </Button>
      </div>

      {subpastas.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {subpastas.map((p) => (
            <CardPasta
              key={p.id}
              pasta={p}
              onOpen={abrirPasta}
              onRenomear={abrirRenomear}
              onExcluir={setDelPasta}
              compact
            />
          ))}
        </div>
      )}

      <UploadBar
        categoriasPasta={categoriasPasta}
        categoria={categoria}
        setCategoria={setCategoria}
        tipo={tipo}
        setTipo={setTipo}
        tipoOutro={tipoOutro}
        setTipoOutro={setTipoOutro}
        tiposCategoria={tiposCategoria}
        enviando={enviando}
        onFile={onFile}
        onFolder={onFolder}
      />

      {docsPasta.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhum documento nesta pasta.
        </p>
      ) : (
        <div className="space-y-2">
          {docsPasta.map((d: any) => (
            <LinhaDocumento
              key={d.id}
              doc={d}
              onBaixar={baixar}
              onEditar={abrirEdicao}
              onMarcar={marcar}
              onSolicitarCorrecao={solicitarCorrecao}
              onExcluir={setDelDoc}
            />
          ))}
        </div>
      )}

      <EditarDocumentoDialog
        doc={editDoc}
        onClose={() => setEditDoc(null)}
        categoriasPasta={categoriasPasta}
        editCategoria={editCategoria}
        setEditCategoria={setEditCategoria}
        editTipo={editTipo}
        setEditTipo={setEditTipo}
        editTipoOutro={editTipoOutro}
        setEditTipoOutro={setEditTipoOutro}
        tiposEditCategoria={tiposEditCategoria}
        onSalvar={salvarEdicao}
        salvando={salvandoEdit}
      />

      <ExcluirDocumentoDialog
        doc={delDoc}
        onClose={() => setDelDoc(null)}
        onConfirmar={confirmarExclusao}
        excluindo={excluindo}
      />

      {pastaDialogs}

      <VisualizadorArquivo
        arquivo={visualizando}
        open={!!visualizando}
        onOpenChange={(o) => !o && setVisualizando(null)}
      />
    </div>
  );
}
