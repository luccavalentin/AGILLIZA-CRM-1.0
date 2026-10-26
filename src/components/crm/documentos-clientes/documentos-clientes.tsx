import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileSearch,
  FolderTree,
  IdCard,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageHeader } from "@/components/shared/page-header";
import { FichaDialog } from "@/components/crm/documentos-gerais/ficha-dialog";
import { titulo } from "@/components/crm/documentos-gerais/helpers";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePermissao } from "@/hooks/use-permissao";
import { cn } from "@/lib/utils";
import { exibirDocumento } from "@/lib/crm/documento";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import {
  listarClientesComDocumentos,
  listarDocumentosDoClientePorPasta,
  type ClienteDocumentos,
  type DocumentoDoCliente,
} from "@/lib/crm/documentos-clientes.functions";
import {
  PASTAS,
  contarPorPasta,
  ehPastaDestino,
  pastasVisiveis,
  type ContagemPastas,
  type PastaPadrao,
} from "@/lib/crm/documentos-clientes/pastas";
import { IconePasta } from "./icone-pasta";
import { PainelPasta, TIPO_ARRASTO, useMoverDocumento } from "./painel-pasta";
import { PreviaDialog } from "./previa-dialog";

function iniciais(nome: string): string {
  const partes = titulo(nome).split(" ").filter(Boolean);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

/**
 * "Documentos de clientes": cada cliente é uma pasta com as sete pastas padrão
 * (Comprador, Cônjuge/Participantes, Vendedor, Imóvel, Renda, Banco e proposta,
 * Contratos). No computador, árvore à esquerda e arquivos à direita (arrastar um
 * arquivo para outra pasta da árvore move); no celular, a árvore vira acordeão e a
 * pasta abre numa gaveta.
 */
export function DocumentosDeClientes() {
  const listarFn = useServerFn(listarClientesComDocumentos);
  const docsFn = useServerFn(listarDocumentosDoClientePorPasta);
  const isMobile = useIsMobile();
  const podeEditar = usePermissao("crm.clientes", "edit");

  const [q, setQ] = useState("");
  const [termo, setTermo] = useState("");
  const [pagina, setPagina] = useState(1);
  const [aberto, setAberto] = useState<ClienteDocumentos | null>(null);
  const [pasta, setPasta] = useState<PastaPadrao>("comprador");
  const [gaveta, setGaveta] = useState(false);
  const [previa, setPrevia] = useState<DocumentoDoCliente | null>(null);
  const [ficha, setFicha] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setTermo(q.trim());
      setPagina(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const arvore = useQuery({
    queryKey: ["docs-clientes-arvore", termo, pagina],
    queryFn: () => listarFn({ data: { termo: termo || null, pagina } }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const docs = useQuery({
    queryKey: ["docs-cliente-pastas", aberto?.id],
    queryFn: () => docsFn({ data: { cliente_id: aberto!.id } }),
    enabled: !!aberto,
    staleTime: 30_000,
  });

  const mover = useMoverDocumento(aberto?.id ?? "");

  // Contagem do cliente aberto sai dos arquivos já carregados (reflete mover/enviar na hora).
  const contagemAberto = useMemo<ContagemPastas | null>(
    () => (docs.data ? contarPorPasta(docs.data) : null),
    [docs.data],
  );

  const clientes = arvore.data?.clientes ?? [];
  const total = arvore.data?.total ?? 0;
  const porPagina = arvore.data?.porPagina ?? 30;
  const paginas = Math.max(1, Math.ceil(total / porPagina));

  function abrirCliente(c: ClienteDocumentos) {
    if (aberto?.id === c.id) {
      setAberto(null);
      return;
    }
    setAberto(c);
    // Abre na primeira pasta que tem arquivo (ou Comprador).
    const primeira = pastasVisiveis(c.pastas).find((p) => c.pastas[p] > 0) ?? "comprador";
    setPasta(primeira);
  }

  function abrirPasta(c: ClienteDocumentos, p: PastaPadrao) {
    if (aberto?.id !== c.id) setAberto(c);
    setPasta(p);
    if (isMobile) setGaveta(true);
  }

  function soltarEmPasta(e: React.DragEvent, p: PastaPadrao) {
    const id = e.dataTransfer.getData(TIPO_ARRASTO);
    if (!id || !ehPastaDestino(p) || !aberto) return;
    e.preventDefault();
    const doc = docs.data?.find((d) => d.id === id);
    if (doc && doc.pasta !== p) mover.mutate({ documento: doc, pasta: p });
  }

  const painel = aberto ? (
    <PainelPasta
      clienteId={aberto.id}
      pasta={pasta}
      docs={docs.data ?? []}
      carregando={docs.isLoading}
      erro={docs.isError ? mensagemDeErro(docs.error, "Não foi possível carregar os arquivos.") : null}
      podeEditar={podeEditar}
      onPrevia={setPrevia}
      onTentarDeNovo={() => docs.refetch()}
    />
  ) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        icone={<FolderTree className="size-5" />}
        titulo="Documentos de clientes"
        descricao="Cada cliente com as pastas padrão: comprador, participantes, vendedor, imóvel, renda, banco e proposta e contratos."
      />

      <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(260px,340px)_minmax(0,1fr)] lg:gap-6">
        {/* Árvore de clientes */}
        <aside className="flex min-w-0 flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar cliente ou arquivo"
              aria-label="Buscar cliente ou arquivo"
              className="h-11 rounded-xl pl-9 pr-10 text-base sm:text-sm"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Limpar busca"
                className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
            <span>
              {arvore.data
                ? `${total} cliente${total === 1 ? "" : "s"}${termo ? " encontrados" : ""}`
                : "Carregando…"}
            </span>
            {arvore.isFetching && !arvore.isLoading && <span>Atualizando…</span>}
          </div>

          {arvore.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : arvore.isError ? (
            <div className="flex flex-col items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {mensagemDeErro(arvore.error, "Não foi possível carregar os clientes.")}
              <Button size="sm" variant="outline" onClick={() => arvore.refetch()}>
                Tentar de novo
              </Button>
            </div>
          ) : clientes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card px-4 py-10 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-primary/8 text-primary ring-1 ring-inset ring-primary/15">
                <FileSearch className="size-6" strokeWidth={1.5} />
              </span>
              <p className="text-sm font-medium text-foreground">
                {termo ? "Nenhum cliente ou arquivo encontrado." : "Nenhum cliente cadastrado."}
              </p>
              <p className="text-xs text-muted-foreground">
                {termo ? "Confira a grafia ou busque pelo código do cliente." : "Os clientes cadastrados aparecem aqui com as pastas deles."}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {clientes.map((c) => {
                const ativo = aberto?.id === c.id;
                const contagem = ativo && contagemAberto ? contagemAberto : c.pastas;
                const totalCliente = ativo && docs.data ? docs.data.length : c.total;
                return (
                  <li
                    key={c.id}
                    className={cn(
                      "overflow-hidden rounded-2xl border bg-card transition-shadow",
                      ativo ? "border-primary/40 shadow-sm ring-1 ring-primary/10" : "border-border/60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => abrirCliente(c)}
                      aria-expanded={ativo}
                      className="flex min-h-14 w-full min-w-0 items-center gap-3 px-3 py-2.5 text-left"
                    >
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-xl text-xs font-semibold ring-1 ring-inset",
                          ativo
                            ? "bg-primary text-primary-foreground ring-primary"
                            : "bg-primary/8 text-primary ring-primary/15",
                        )}
                      >
                        {iniciais(c.nome) || "?"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {titulo(c.nome)}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[c.numero_cliente, c.documento ? exibirDocumento(c.documento) : null]
                            .filter(Boolean)
                            .join(" · ")}
                          {c.arquivos_encontrados > 0 && (
                            <span className="text-primary">
                              {" "}
                              · {c.arquivos_encontrados} arquivo(s) na busca
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
                        {totalCliente}
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-transform",
                          ativo && "rotate-180",
                        )}
                      />
                    </button>
                    {ativo && (
                      <ul className="border-t border-border/60 bg-muted/20 p-1.5" aria-label={`Pastas de ${titulo(c.nome)}`}>
                        {pastasVisiveis(contagem).map((p) => {
                          const selecionada = pasta === p;
                          return (
                            <li key={p}>
                              <button
                                type="button"
                                onClick={() => abrirPasta(c, p)}
                                onDragOver={(e) => {
                                  if (ehPastaDestino(p) && e.dataTransfer.types.includes(TIPO_ARRASTO))
                                    e.preventDefault();
                                }}
                                onDrop={(e) => soltarEmPasta(e, p)}
                                className={cn(
                                  "flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm transition-colors",
                                  selecionada && !isMobile
                                    ? "bg-primary/10 font-medium text-primary"
                                    : "text-foreground hover:bg-background",
                                )}
                              >
                                <IconePasta pasta={p} ativa={selecionada && !isMobile} className="size-7 rounded-md" />
                                <span className="min-w-0 flex-1 truncate">{PASTAS[p].rotulo}</span>
                                <span
                                  className={cn(
                                    "shrink-0 text-xs tabular-nums",
                                    contagem[p] > 0 ? "font-semibold text-foreground" : "text-muted-foreground",
                                  )}
                                >
                                  {contagem[p]}
                                </span>
                                {isMobile && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {total > porPagina && (
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <Button
                variant="outline"
                size="sm"
                className="h-11 gap-1 sm:h-8"
                disabled={pagina === 1 || arvore.isFetching}
                onClick={() => setPagina((p) => p - 1)}
              >
                <ChevronLeft className="size-4" /> Anterior
              </Button>
              <span>
                Página {pagina} de {paginas}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-11 gap-1 sm:h-8"
                disabled={pagina >= paginas || arvore.isFetching}
                onClick={() => setPagina((p) => p + 1)}
              >
                Próxima <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </aside>

        {/* Pasta aberta (computador) */}
        <div className="hidden min-w-0 md:block">
          {aberto ? (
            <div className="space-y-4 rounded-2xl border border-border/60 bg-card/50 p-4 lg:p-5">
              <CabecalhoCliente cliente={aberto} onFicha={() => setFicha(true)} />
              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Pastas">
                {pastasVisiveis(contagemAberto ?? aberto.pastas).map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="tab"
                    aria-selected={pasta === p}
                    onClick={() => setPasta(p)}
                    onDragOver={(e) => {
                      if (ehPastaDestino(p) && e.dataTransfer.types.includes(TIPO_ARRASTO)) e.preventDefault();
                    }}
                    onDrop={(e) => soltarEmPasta(e, p)}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                      pasta === p
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border/70 bg-background text-foreground hover:border-primary/40 hover:text-primary",
                    )}
                  >
                    {PASTAS[p].rotulo}
                    <span className={cn("tabular-nums", pasta === p ? "opacity-80" : "text-muted-foreground")}>
                      {(contagemAberto ?? aberto.pastas)[p]}
                    </span>
                  </button>
                ))}
              </div>
              {painel}
            </div>
          ) : (
            <div className="flex h-full min-h-80 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-primary/25 bg-primary/[0.02] p-8 text-center">
              <span className="grid size-14 place-items-center rounded-2xl bg-primary/8 text-primary ring-1 ring-inset ring-primary/15">
                <FolderTree className="size-7" strokeWidth={1.5} />
              </span>
              <p className="text-sm font-medium text-foreground">Escolha um cliente</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Abra um cliente na lista para ver as pastas dele, enviar arquivos em lote e organizar
                os documentos arrastando de uma pasta para outra.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Pasta aberta (celular): gaveta */}
      <Sheet open={isMobile && gaveta && !!aberto} onOpenChange={setGaveta}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl px-4 pb-6 pt-5">
          <SheetHeader className="mb-3 text-left">
            <SheetTitle className="truncate pr-8 text-base">{aberto ? titulo(aberto.nome) : ""}</SheetTitle>
          </SheetHeader>
          {aberto && (
            <div className="space-y-4">
              <CabecalhoCliente cliente={aberto} onFicha={() => setFicha(true)} compacto />
              {painel}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <PreviaDialog doc={previa} onOpenChange={(v) => !v && setPrevia(null)} />
      {aberto && (
        <FichaDialog
          clienteId={aberto.id}
          clienteNome={aberto.nome}
          open={ficha}
          onOpenChange={setFicha}
        />
      )}
    </div>
  );
}

function CabecalhoCliente({
  cliente,
  onFicha,
  compacto,
}: {
  cliente: ClienteDocumentos;
  onFicha: () => void;
  compacto?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {!compacto && (
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-foreground">{titulo(cliente.nome)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[cliente.numero_cliente, cliente.documento ? exibirDocumento(cliente.documento) : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
        <Button variant="outline" className="h-11 gap-2 sm:h-9" onClick={onFicha}>
          <IdCard className="size-4" /> Ficha
        </Button>
        <Button asChild variant="outline" className="h-11 gap-2 sm:h-9">
          <Link to="/crm/clientes/$id" params={{ id: cliente.id }}>
            <ExternalLink className="size-4" /> Cadastro
          </Link>
        </Button>
      </div>
    </div>
  );
}
