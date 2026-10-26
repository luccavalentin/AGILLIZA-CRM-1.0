import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, History, Loader2, Lock, RotateCcw, Tag, X } from "lucide-react";
import {
  definirEtiquetas,
  listarVersoes,
  restaurarVersao,
  urlArquivo,
  type ArquivoNo,
} from "@/lib/documentos/arquivos.functions";
import { formatarBytes, normalizarEtiquetas } from "@/lib/documentos/arquivos-regras";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { mensagemDeErro } from "@/lib/erros/mensagem";

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="min-w-0 truncate text-foreground">{valor}</dd>
    </div>
  );
}

/** Detalhes de um item: informações, etiquetas e (arquivo) versões. */
export function DetalhesSheet({ no, onClose }: { no: ArquivoNo | null; onClose: () => void }) {
  const qc = useQueryClient();
  const fnVersoes = useServerFn(listarVersoes);
  const fnRestaurar = useServerFn(restaurarVersao);
  const fnEtiquetas = useServerFn(definirEtiquetas);
  const fnUrl = useServerFn(urlArquivo);
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [nova, setNova] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setEtiquetas(no?.etiquetas ?? []);
    setNova("");
  }, [no]);

  const versoes = useQuery({
    queryKey: ["arquivos-versoes", no?.id],
    queryFn: () => fnVersoes({ data: { id: no!.id } }),
    enabled: !!no && no.tipo === "arquivo",
  });

  const podeEditar = (no?.nivel ?? 0) >= 2;

  async function salvarEtiquetas(lista: string[]) {
    if (!no) return;
    setSalvando(true);
    try {
      const r = await fnEtiquetas({ data: { id: no.id, etiquetas: normalizarEtiquetas(lista) } });
      setEtiquetas(r.etiquetas);
      qc.invalidateQueries({ queryKey: ["arquivos"] });
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível salvar as etiquetas."));
    } finally {
      setSalvando(false);
    }
  }

  async function baixarVersao(versao: number) {
    if (!no) return;
    try {
      const { url } = await fnUrl({ data: { id: no.id, versao, download: true } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível baixar esta versão."));
    }
  }

  async function voltarPara(versao: number) {
    if (!no) return;
    try {
      const r = await fnRestaurar({ data: { id: no.id, versao } });
      toast.success(`A versão ${versao} voltou a ser a atual (agora v${r.versao}).`);
      qc.invalidateQueries({ queryKey: ["arquivos"] });
      qc.invalidateQueries({ queryKey: ["arquivos-versoes", no.id] });
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível voltar a esta versão."));
    }
  }

  return (
    <Sheet open={!!no} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="break-words pr-6">{no?.nome}</SheetTitle>
          <SheetDescription>{no?.tipo === "pasta" ? "Pasta" : "Arquivo"}</SheetDescription>
        </SheetHeader>

        {no && (
          <div className="mt-4 space-y-6">
            <dl className="divide-y divide-border/60 rounded-lg border border-border/60 px-3">
              {no.tipo === "arquivo" && <Linha rotulo="Tamanho" valor={formatarBytes(no.tamanho)} />}
              {no.tipo === "pasta" && <Linha rotulo="Itens" valor={no.itens ?? 0} />}
              <Linha rotulo="Criado por" valor={no.criado_por_nome ?? "—"} />
              <Linha rotulo="Criado em" valor={dataHora(no.created_at)} />
              <Linha rotulo="Alterado em" valor={dataHora(no.updated_at)} />
              <Linha
                rotulo="Acesso"
                valor={
                  no.restrita ? (
                    <span className="inline-flex items-center gap-1">
                      <Lock className="h-3.5 w-3.5" /> Restrito
                    </span>
                  ) : (
                    "Equipe do escritório"
                  )
                }
              />
              <Linha
                rotulo="Você pode"
                valor={no.nivel >= 3 ? "Gerir" : no.nivel === 2 ? "Editar" : "Ver"}
              />
            </dl>

            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <Tag className="h-4 w-4 text-primary" /> Etiquetas
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {etiquetas.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhuma etiqueta.</p>
                )}
                {etiquetas.map((e) => (
                  <span
                    key={e}
                    className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                  >
                    {e}
                    {podeEditar && (
                      <button
                        type="button"
                        aria-label={`Tirar a etiqueta ${e}`}
                        className="rounded hover:bg-primary/20"
                        disabled={salvando}
                        onClick={() => salvarEtiquetas(etiquetas.filter((x) => x !== e))}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {podeEditar && (
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={(ev) => {
                    ev.preventDefault();
                    if (nova.trim()) {
                      salvarEtiquetas([...etiquetas, nova]);
                      setNova("");
                    }
                  }}
                >
                  <Input
                    value={nova}
                    maxLength={30}
                    onChange={(e) => setNova(e.target.value)}
                    placeholder="Nova etiqueta (ex.: itaú, 2026)"
                    className="h-8 max-w-[14rem] text-sm"
                  />
                  <Button type="submit" size="sm" variant="outline" disabled={salvando || !nova.trim()}>
                    {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
                  </Button>
                </form>
              )}
            </section>

            {no.tipo === "arquivo" && (
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <History className="h-4 w-4 text-primary" /> Versões
                </h3>
                {versoes.isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : versoes.isError ? (
                  <p className="text-sm text-destructive">Não foi possível carregar as versões.</p>
                ) : (
                  <ol className="divide-y divide-border/60 rounded-lg border border-border/60">
                    {(versoes.data ?? []).map((v) => (
                      <li key={v.versao} className="flex items-center gap-2 px-3 py-2">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold">
                          v{v.versao}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">
                            {v.atual ? "Atual" : dataHora(v.created_at)}
                            <span className="text-muted-foreground"> · {formatarBytes(v.tamanho)}</span>
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {v.criado_por_nome ?? "—"}
                            {v.atual ? ` · ${dataHora(v.created_at)}` : ""}
                          </span>
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          aria-label={`Baixar a versão ${v.versao}`}
                          onClick={() => baixarVersao(v.versao)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {podeEditar && !v.atual && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-label={`Voltar para a versão ${v.versao}`}
                            title="Voltar para esta versão"
                            onClick={() => voltarPara(v.versao)}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Enviar um arquivo com o mesmo nome nesta pasta cria uma versão nova.
                </p>
              </section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
