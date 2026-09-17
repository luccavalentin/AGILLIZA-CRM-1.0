import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Landmark, Loader2, RefreshCw, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { anexarDocumento } from "@/lib/crm/clientes.functions";
import {
  checklistBancoProposta,
  removerArquivoVagaBanco,
} from "@/lib/propostas/propostas.functions";
import { ROTULO_TIPO_VAGA, vagaAceitaCategoria } from "@/lib/propostas/enviar/documentos-vagas";
import { nomeDoTipoDocumento } from "@/lib/documentos/tipos-banco";
import { nomeArquivoSeguro } from "@/lib/storage/nome-arquivo";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { normTexto } from "@/lib/propostas/enviar/shared-utils";
import { cn } from "@/lib/utils";

const ANALISE: Record<string, { rotulo: string; tom?: "ok" | "erro" | "alerta" }> = {
  P: { rotulo: "pendente" },
  I: { rotulo: "em análise na HomeFin", tom: "alerta" },
  A: { rotulo: "aprovado na HomeFin", tom: "ok" },
  R: { rotulo: "recusado na HomeFin", tom: "erro" },
  D: { rotulo: "dispensado" },
};

const MAX_BYTES = 5 * 1024 * 1024;

/** Nome do arquivo como subiu, sem o prefixo que o liga ao documento do CRM. */
const semPrefixo = (nome: string) => nome.replace(/^[0-9a-f]{8}-/i, "");

/**
 * Vagas do checklist de documentos da oportunidade na HomeFin, separadas por
 * dono (comprador, cônjuge, vendedor, imóvel). Cada arquivo vai para a vaga
 * escolhida aqui — sem dedução por nome — e fica guardado também no CRM.
 */
export function VagasBanco({
  propostaId,
  clienteId,
  envolvidos,
  docs,
  ocupado,
  onEnviar,
  onAnexado,
}: {
  propostaId: string;
  clienteId: string;
  envolvidos: any[];
  docs: any[];
  ocupado: boolean;
  onEnviar: (ids: string[], vagas: Record<string, string>) => Promise<void>;
  onAnexado: () => void;
}) {
  const buscar = useServerFn(checklistBancoProposta);
  const anexar = useServerFn(anexarDocumento);
  const removerArquivo = useServerFn(removerArquivoVagaBanco);
  const inputRef = useRef<HTMLInputElement>(null);
  const [vagaDoUpload, setVagaDoUpload] = useState<any | null>(null);
  const [trabalhando, setTrabalhando] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["checklist-banco", propostaId],
    queryFn: () => buscar({ data: { proposta_id: propostaId } }),
    refetchOnWindowFocus: false,
  });

  const vagas = useMemo(() => data?.vagas ?? [], [data]);

  // Na HomeFin o cônjuge que compõe renda também tem vagas de comprador (CO)
  // com o nome dele: o arquivo fica na pasta do cônjuge no CRM.
  const nomesConjuges = useMemo(
    () => envolvidos.filter((e) => e.conjuge_de).map((e) => normTexto(e.nome)),
    [envolvidos],
  );
  const categoriaParaCrm = (v: any) =>
    v.categoria === "comprador" && nomesConjuges.includes(normTexto(v.referente))
      ? "conjuge"
      : v.categoria;

  const grupos = useMemo(() => {
    const mapa = new Map<string, { titulo: string; dono: string | null; vagas: any[] }>();
    for (const v of vagas) {
      const chave = `${v.tipoDocumento ?? "?"}|${v.referente ?? ""}`;
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          titulo: ROTULO_TIPO_VAGA[String(v.tipoDocumento ?? "").toUpperCase()] ?? "Documentos",
          dono: v.referente,
          vagas: [],
        });
      }
      mapa.get(chave)!.vagas.push(v);
    }
    return Array.from(mapa.values());
  }, [vagas]);

  const temVendedor = vagas.some((v) => ["VD", "CV", "RV"].includes(String(v.tipoDocumento)));
  const temImovel = vagas.some((v) => ["IM", "IQ"].includes(String(v.tipoDocumento)));

  function escolherArquivo(vaga: any) {
    setVagaDoUpload(vaga);
    inputRef.current?.click();
  }

  async function onArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const vaga = vagaDoUpload;
    setVagaDoUpload(null);
    if (!file || !vaga) return;
    if (!/pdf|png|jpe?g/i.test(`${file.type} ${file.name}`)) {
      return toast.error("O banco aceita só PDF, PNG ou JPEG.");
    }
    if (file.size > MAX_BYTES) return toast.error("Arquivo acima de 5 MB, o limite do banco.");
    setTrabalhando(vaga.idDocumento);
    try {
      const path = `${clienteId}/${crypto.randomUUID()}-${nomeArquivoSeguro(file.name)}`;
      const { error: upErr } = await supabase.storage.from("cliente-documentos").upload(path, file);
      if (upErr) throw upErr;
      const { id } = await anexar({
        data: {
          cliente_id: clienteId,
          categoria: categoriaParaCrm(vaga),
          tipo_documento: vaga.nomeDocumento,
          nome_arquivo: file.name,
          storage_path: path,
          mime_type: file.type,
          tamanho_bytes: file.size,
        },
      });
      onAnexado();
      await onEnviar([id], { [id]: vaga.idDocumento });
    } catch (err) {
      toast.error(mensagemDeErro(err, "Falha ao enviar o arquivo."));
    } finally {
      setTrabalhando(null);
      refetch();
    }
  }

  async function remover(vaga: any, arquivo: any) {
    if (
      !window.confirm(
        `Tirar "${semPrefixo(arquivo.nomeArquivo)}" desta vaga no banco? O documento continua salvo no CRM.`,
      )
    ) {
      return;
    }
    setTrabalhando(vaga.idDocumento);
    try {
      await removerArquivo({
        data: {
          proposta_id: propostaId,
          id_arquivo: arquivo.idArquivo,
          documento_crm_id: arquivo.documentoCrmId,
        },
      });
      toast.success("Arquivo retirado da vaga do banco.");
      onAnexado();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível retirar o arquivo."));
    } finally {
      setTrabalhando(null);
      refetch();
    }
  }

  async function usarSalvo(vaga: any, documentoId: string) {
    setTrabalhando(vaga.idDocumento);
    try {
      await onEnviar([documentoId], { [documentoId]: vaga.idDocumento });
    } finally {
      setTrabalhando(null);
      refetch();
    }
  }

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardContent className="space-y-4 p-4">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          className="hidden"
          onChange={onArquivo}
        />
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Landmark className="h-4 w-4" />
            </span>
            <div className="text-sm">
              <p className="font-semibold text-foreground">Vagas do banco</p>
              <p className="text-xs text-muted-foreground">
                Checklist da oportunidade na HomeFin{data?.nomeBanco ? ` (${data.nomeBanco})` : ""}.
                Cada arquivo vai para a vaga escolhida e fica salvo no CRM.
                {data && !data.loteAutomatico
                  ? " Este banco recebe os documentos pela HomeFin, sem envio automático."
                  : ""}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} /> Atualizar
          </Button>
        </div>

        {data?.resumo && vagas.length > 0 && (
          <div className="flex flex-wrap gap-1.5 text-xs">
            <Selo tom={data.resumo.semArquivo > 0 ? "alerta" : "ok"}>
              {data.resumo.semArquivo} sem arquivo
            </Selo>
            {data.resumo.recusados > 0 && (
              <Selo tom="erro">{data.resumo.recusados} recusado(s)</Selo>
            )}
            {data.resumo.emAnalise > 0 && (
              <Selo tom="alerta">{data.resumo.emAnalise} em análise na HomeFin</Selo>
            )}
            {data.resumo.noBanco > 0 && <Selo tom="ok">{data.resumo.noBanco} no banco</Selo>}
          </div>
        )}

        {isLoading && (
          <p className="flex items-center text-xs text-muted-foreground">
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Consultando o checklist no
            banco…
          </p>
        )}
        {error && (
          <p className="text-xs text-destructive">
            {mensagemDeErro(error, "Não foi possível consultar o checklist do banco.")}
          </p>
        )}
        {data && vagas.length === 0 && (
          <p className="text-xs text-muted-foreground">
            O banco ainda não abriu o checklist de documentos desta oportunidade.
          </p>
        )}

        {grupos.map((g) => (
          <div key={`${g.titulo}-${g.dono}`} className="rounded-lg border border-border">
            <p className="border-b border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-foreground">
              {g.titulo}
              {g.dono ? (
                <span className="font-normal text-muted-foreground"> — {g.dono}</span>
              ) : null}
            </p>
            <ul className="divide-y divide-border">
              {g.vagas.map((v: any) => {
                const analise = ANALISE[v.situacaoAnalise] ?? ANALISE.P;
                const compativeis = docs.filter(
                  (d) =>
                    vagaAceitaCategoria(v, d.categoria) &&
                    /pdf|png|jpe?g/i.test(`${d.mime_type ?? ""} ${d.nome_arquivo ?? ""}`),
                );
                const busy = trabalhando === v.idDocumento;
                return (
                  <li key={v.idDocumento} className="space-y-1.5 px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                        {v.nomeDocumento}
                      </span>
                      <Selo tom={analise.tom}>{analise.rotulo}</Selo>
                      {v.situacaoIntegracao === "success" && <Selo tom="ok">no banco</Selo>}
                      {v.situacaoIntegracao === "error" && <Selo tom="erro">banco recusou</Selo>}
                    </div>
                    {v.arquivos.length > 0 && (
                      <ul className="space-y-1">
                        {v.arquivos.map((a: any) => (
                          <li
                            key={a.idArquivo}
                            className="flex items-center gap-2 text-xs text-muted-foreground"
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {semPrefixo(a.nomeArquivo)}
                            </span>
                            {v.situacaoIntegracao !== "success" && (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                                disabled={ocupado || busy}
                                onClick={() => remover(v, a)}
                                title="Tirar este arquivo da vaga no banco"
                              >
                                <X className="h-3 w-3" /> Remover da vaga
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {(v.mensagemIntegracao || v.comentarioAnalise) && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        {v.mensagemIntegracao || v.comentarioAnalise}
                      </p>
                    )}
                    {v.aceitaArquivo && (
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5"
                          disabled={ocupado || busy}
                          onClick={() => escolherArquivo(v)}
                        >
                          {busy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Upload className="h-3.5 w-3.5" />
                          )}
                          Enviar arquivo
                        </Button>
                        {compativeis.length > 0 && (
                          <Select
                            value=""
                            disabled={ocupado || busy}
                            onValueChange={(id) => usarSalvo(v, id)}
                          >
                            <SelectTrigger className="h-8 w-full max-w-xs text-xs">
                              <SelectValue placeholder="Usar documento já salvo no CRM" />
                            </SelectTrigger>
                            <SelectContent>
                              {compativeis.map((d) => (
                                <SelectItem key={d.id} value={d.id} className="text-xs">
                                  {nomeDoTipoDocumento(d.tipo_documento)} — {d.nome_arquivo}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {data && vagas.length > 0 && (!temVendedor || !temImovel) && (
          <p className="rounded-md border border-dashed border-border p-2 text-xs text-muted-foreground">
            {[!temVendedor && "vendedor", !temImovel && "imóvel"].filter(Boolean).join(" e ")}: o
            banco ainda não abriu vagas nesta etapa. Esses documentos ficam salvos no CRM (abaixo) e
            podem ser enviados quando a HomeFin liberar as vagas.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Selo({ children, tom }: { children: React.ReactNode; tom?: "ok" | "erro" | "alerta" }) {
  return (
    <span
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
