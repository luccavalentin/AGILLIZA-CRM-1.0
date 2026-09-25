import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileCheck2, Loader2, Lock, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { propostaQueryOptions } from "@/lib/propostas/queries";
import {
  bancoPermiteCarta,
  camposEmBrancoCarta,
  camposIniciaisCarta,
  camposParaPdf,
  CAMPOS_MANUAIS,
  mascaraData,
  MODELOS_CARTA,
  NAO_SE_APLICA,
  parecerDaCarta,
  type CamposCarta,
  type ModeloCarta,
} from "@/lib/propostas/carta-analise/dados";
import { cn } from "@/lib/utils";

/**
 * Falha ao carregar o gerador da carta porque a aba é de antes de um deploy
 * (o arquivo da versão anterior já não existe no servidor). A página recarrega
 * sozinha (`vite:preloadError` em __root); a mensagem cobre o intervalo.
 */
function versaoDesatualizada(e: unknown): boolean {
  const msg = String((e as { message?: unknown })?.message ?? e ?? "");
  return /dynamically imported module|Importing a module script failed|ChunkLoadError|preload/i.test(
    msg,
  );
}

function mensagemFalhaCarta(e: unknown): string {
  return versaoDesatualizada(e)
    ? "O sistema foi atualizado. Recarregue a página (F5) e gere a carta de novo."
    : "Não foi possível gerar a carta.";
}

/** Campos gerados do sistema que o usuário pode corrigir antes de emitir. */
const CAMPOS_SISTEMA: { chave: keyof CamposCarta; rotulo: string }[] = [
  { chave: "numeroAnalise", rotulo: "Nº da análise" },
  { chave: "data", rotulo: "Data" },
  { chave: "proponente1Nome", rotulo: "1º proponente" },
  { chave: "proponente1Cpf", rotulo: "CPF 1º proponente" },
  { chave: "proponente2Nome", rotulo: "2º proponente" },
  { chave: "proponente2Cpf", rotulo: "CPF 2º proponente" },
  { chave: "produto", rotulo: "Produto" },
  { chave: "valorImovel", rotulo: "Valor do imóvel" },
  { chave: "valorFinanciamento", rotulo: "Valor do financiamento" },
  { chave: "primeiraParcela", rotulo: "1ª parcela" },
  { chave: "sistemaAmortizacao", rotulo: "Sistema de amortização" },
  { chave: "prazo", rotulo: "Prazo" },
  { chave: "indexador", rotulo: "Indexador" },
  { chave: "rendaFamiliar", rotulo: "Total renda familiar" },
];

/** O que o usuário digitou fica guardado neste navegador, por proposta e banco. */
const chaveRascunho = (propostaId: string, bancoId: string) =>
  `carta-analise:${propostaId}:${bancoId}`;
function lerRascunho(chave: string): Partial<CamposCarta> {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as Partial<CamposCarta>) : {};
  } catch {
    return {};
  }
}
function gravarRascunho(chave: string, campos: CamposCarta) {
  try {
    localStorage.setItem(chave, JSON.stringify(campos));
  } catch {
    /* sem storage: o formulário segue funcionando */
  }
}

export function CartaAnaliseDialog({
  open,
  onOpenChange,
  propostaId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  propostaId: string;
}) {
  const { data, isLoading } = useQuery({ ...propostaQueryOptions(propostaId), enabled: open });
  const bancosAprovados = useMemo(
    () =>
      ((data?.bancos as any[]) ?? []).filter(
        (b) => b.selecionado !== false && bancoPermiteCarta(b),
      ),
    [data],
  );

  const [bancoId, setBancoId] = useState<string>("");
  const [modelo, setModelo] = useState<ModeloCarta>("modelo2");
  const [campos, setCampos] = useState<CamposCarta | null>(null);
  const [incluirObservacoes, setIncluirObservacoes] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  // Falha da pré-visualização: em vez de girar "Montando…" para sempre, a
  // tela diz o que houve e oferece tentar de novo.
  const [erroPreview, setErroPreview] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const urlAnterior = useRef<string | null>(null);

  const banco = bancosAprovados.find((b) => b.id === bancoId) ?? null;
  const parecer = banco ? parecerDaCarta(banco) : null;

  useEffect(() => {
    if (!open) return;
    if (!bancoId && bancosAprovados.length > 0) setBancoId(bancosAprovados[0].id);
  }, [open, bancosAprovados, bancoId]);

  // Campos iniciais sempre que troca o banco (rascunho do navegador por cima).
  useEffect(() => {
    if (!open || !data || !banco) return;
    const iniciais = camposIniciaisCarta({
      proposta: data.proposta,
      banco,
      envolvidos: (data.envolvidos as any[]) ?? [],
    });
    const rascunho = lerRascunho(chaveRascunho(propostaId, banco.id));
    const inicial = { ...iniciais, ...rascunho, data: iniciais.data };
    setCampos(inicial);
    // Quem já escreveu observações neste rascunho continua com a página ligada.
    setIncluirObservacoes(Boolean(inicial.textoFgts?.trim() || inicial.observacoes?.trim()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data, bancoId]);

  useEffect(() => {
    if (campos && banco) gravarRascunho(chaveRascunho(propostaId, banco.id), campos);
  }, [campos, banco, propostaId]);

  // Pré-visualização ao vivo, com espera curta enquanto digita.
  useEffect(() => {
    if (!open || !campos || !parecer) return;
    const t = setTimeout(async () => {
      setGerando(true);
      try {
        const { gerarCartaAnalisePdf } = await import("@/lib/propostas/carta-analise/pdf");
        const doc = await gerarCartaAnalisePdf(modelo, camposParaPdf(campos), parecer, {
          incluirObservacoes,
        });
        const url = String(doc.output("bloburl"));
        if (urlAnterior.current) URL.revokeObjectURL(urlAnterior.current);
        urlAnterior.current = url;
        setPreviewUrl(url);
        setErroPreview(null);
      } catch (e) {
        console.error("Falha ao gerar pré-visualização da carta", e);
        setErroPreview(mensagemFalhaCarta(e));
      } finally {
        setGerando(false);
      }
    }, 650);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, campos, modelo, parecer?.curto, incluirObservacoes, tentativa]);

  useEffect(
    () => () => {
      if (urlAnterior.current) URL.revokeObjectURL(urlAnterior.current);
    },
    [],
  );

  const emBranco = campos ? camposEmBrancoCarta(campos) : [];
  const set = (chave: keyof CamposCarta, valor: string) =>
    setCampos((c) => (c ? { ...c, [chave]: valor } : c));

  async function baixar() {
    if (!campos || !parecer) return;
    const t = toast.loading("Gerando carta de análise…");
    try {
      const { gerarCartaAnalisePdf, nomeArquivoCarta } =
        await import("@/lib/propostas/carta-analise/pdf");
      const doc = await gerarCartaAnalisePdf(modelo, camposParaPdf(campos), parecer, {
        incluirObservacoes,
      });
      doc.save(nomeArquivoCarta(campos));
      toast.success("Carta de análise baixada.", { id: t });
    } catch (e) {
      console.error(e);
      toast.error(mensagemFalhaCarta(e), { id: t });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-w-[1200px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1200px]">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-primary" /> Carta de análise de crédito
          </DialogTitle>
          <DialogDescription>
            Os dados da proposta já vêm preenchidos. O que ficar em branco sai como "Não se aplica".
          </DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando proposta…
          </div>
        ) : bancosAprovados.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="font-medium">Nenhum banco aprovou esta proposta ainda.</p>
            <p className="text-sm text-muted-foreground">
              A carta de análise fica disponível quando um banco devolve aprovação ou aprovação com
              condições.
            </p>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[440px_1fr]">
            {/* Formulário */}
            <div className="min-h-0 space-y-6 overflow-y-auto border-r border-border px-6 py-5">
              {bancosAprovados.length > 1 && (
                <section className="space-y-2">
                  <Label>Banco</Label>
                  <div className="flex flex-wrap gap-2">
                    {bancosAprovados.map((b) => (
                      <Button
                        key={b.id}
                        type="button"
                        size="sm"
                        variant={b.id === bancoId ? "default" : "outline"}
                        onClick={() => setBancoId(b.id)}
                      >
                        {b.nome_banco}
                      </Button>
                    ))}
                  </div>
                </section>
              )}

              {parecer && (
                <section className="rounded-xl border border-border bg-muted/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Parecer · {banco?.nome_banco}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Lock className="h-3 w-3" /> definido pelo banco
                    </span>
                  </div>
                  <p className="mt-1 text-lg font-bold text-primary">{parecer.curto}</p>
                  {/bradesco/i.test(String(banco?.nome_banco)) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Aprovações do Bradesco saem sempre como pré-aprovado.
                    </p>
                  )}
                </section>
              )}

              <section className="space-y-2">
                <Label>Modelo</Label>
                <div className="grid grid-cols-3 gap-2">
                  {MODELOS_CARTA.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setModelo(m.id)}
                      className={cn(
                        "overflow-hidden rounded-lg border text-left transition",
                        modelo === m.id
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      <img
                        src={
                          m.id === "modelo3"
                            ? "/cartas/modelo3-foto.jpg"
                            : `/cartas/${m.id}-capa.jpg`
                        }
                        alt=""
                        className="h-20 w-full object-cover"
                      />
                      <div className="px-2 py-1.5">
                        <p className="text-xs font-semibold leading-tight">{m.nome}</p>
                        <p className="text-[10px] leading-tight text-muted-foreground">
                          {m.descricao}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {campos && (
                <>
                  <section className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold">Complete se quiser</h3>
                      <p className="text-xs text-muted-foreground">
                        Nada é obrigatório: o que ficar em branco sai como "Não se aplica".
                      </p>
                    </div>
                    {CAMPOS_MANUAIS.filter((f) => !f.multilinha).map((f) => (
                      <div key={f.chave} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label htmlFor={`carta-${f.chave}`}>{f.rotulo}</Label>
                          {f.naoSeAplica && (
                            <button
                              type="button"
                              className="text-[11px] font-medium text-primary hover:underline"
                              onClick={() => set(f.chave, NAO_SE_APLICA)}
                            >
                              Não se aplica
                            </button>
                          )}
                        </div>
                        <Input
                          id={`carta-${f.chave}`}
                          value={campos[f.chave]}
                          placeholder={
                            f.data ? "dd/mm/aaaa" : `${f.placeholder} — em branco: Não se aplica`
                          }
                          inputMode={f.data ? "numeric" : undefined}
                          maxLength={f.data ? 10 : undefined}
                          onChange={(e) =>
                            set(
                              f.chave,
                              f.data && e.target.value !== NAO_SE_APLICA
                                ? mascaraData(e.target.value)
                                : e.target.value,
                            )
                          }
                        />
                      </div>
                    ))}
                  </section>

                  <section className="space-y-3 rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Label htmlFor="carta-incluir-obs" className="text-sm font-semibold">
                          Página de observações
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Opcional: FGTS e condições específicas da proposta, em uma página a mais.
                        </p>
                      </div>
                      <Switch
                        aria-label="Incluir página de observações"
                        id="carta-incluir-obs"
                        checked={incluirObservacoes}
                        onCheckedChange={setIncluirObservacoes}
                      />
                    </div>
                    {incluirObservacoes &&
                      CAMPOS_MANUAIS.filter((f) => f.multilinha).map((f) => (
                        <div key={f.chave} className="space-y-1">
                          <Label htmlFor={`carta-${f.chave}`}>{f.rotulo}</Label>
                          <Textarea
                            id={`carta-${f.chave}`}
                            rows={3}
                            value={campos[f.chave]}
                            placeholder={f.placeholder}
                            onChange={(e) => set(f.chave, e.target.value)}
                          />
                        </div>
                      ))}
                  </section>

                  <details className="group rounded-xl border border-border">
                    <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold">
                      Dados da proposta{" "}
                      <span className="font-normal text-muted-foreground">
                        (já preenchidos — abra para corrigir)
                      </span>
                    </summary>
                    <div className="grid grid-cols-2 gap-3 border-t border-border px-4 py-4">
                      {CAMPOS_SISTEMA.map((f) => (
                        <div key={f.chave} className="space-y-1">
                          <Label htmlFor={`carta-${f.chave}`} className="text-xs">
                            {f.rotulo}
                          </Label>
                          <Input
                            id={`carta-${f.chave}`}
                            value={campos[f.chave]}
                            onChange={(e) => set(f.chave, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  </details>
                </>
              )}
            </div>

            {/* Pré-visualização */}
            <div className="flex min-h-0 flex-col bg-muted/30">
              <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
                <div className="min-w-0 text-xs">
                  {emBranco.length > 0 ? (
                    <span className="text-muted-foreground">
                      Sairão como "Não se aplica": {emBranco.join(" · ")}
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Tudo preenchido — pronto para baixar.
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {gerando && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <Button size="sm" onClick={baixar} disabled={!campos}>
                    <Download className="mr-1.5 h-4 w-4" /> Baixar PDF
                  </Button>
                </div>
              </div>
              {previewUrl && !erroPreview ? (
                <iframe
                  title="Pré-visualização da carta"
                  src={`${previewUrl}#toolbar=0&navpanes=0&zoom=page-fit&view=Fit`}
                  className="min-h-0 flex-1 bg-white"
                />
              ) : erroPreview ? (
                <div
                  role="alert"
                  className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"
                >
                  <p className="max-w-sm text-sm text-muted-foreground">{erroPreview}</p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={gerando}
                      onClick={() => setTentativa((n) => n + 1)}
                    >
                      <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", gerando && "animate-spin")} />
                      Tentar de novo
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => window.location.reload()}>
                      Recarregar a página
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Montando pré-visualização…
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
