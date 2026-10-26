/**
 * Leitura de boleto (C45e): PDF (texto do próprio PDF, no servidor), imagem (leitor de
 * código de barras do navegador, quando existe) ou linha digitada/colada. O resultado é
 * sempre um RASCUNHO que a pessoa confere: dígitos FEBRABAN validados, beneficiário x
 * fornecedor, vencido, código x documento e duplicatas — nada é salvo sem revisão e
 * nada é pago.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Barcode, CheckCircle2, FileUp, ScanLine, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/simulacao/currency-input";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { hojeISO } from "@/lib/financeiro/format";
import {
  alertasDoRascunho,
  analisarBoleto,
  conferirBeneficiario,
  formatarLinhaDigitavel,
  somenteDigitos,
  type AnaliseBoleto,
  type DadosDoTexto,
} from "@/lib/financeiro/boleto";
import { consultar, executar, executarOuFalhar, invalidarFinanceiro, type AvisoFinanceiro } from "@/lib/financeiro/cliente";
import { lerBoletoPdf } from "@/lib/financeiro/matriz.functions";
import type { Cadastros, ContaFin } from "@/lib/financeiro/tipos";
import { arquivoParaBase64, enviarAnexo } from "./anexos";
import { moeda } from "./base";
import { DialogoAviso } from "./dialogos";

interface Rascunho {
  linha: string;
  tipo: "bancario" | "arrecadacao" | null;
  banco: string | null;
  valor: number;
  vencimento: string;
  beneficiario: string;
  documento: string;
  fornecedorId: string;
  descricao: string;
  categoriaId: string;
  centroId: string;
  observacao: string;
}

const VAZIO: Rascunho = {
  linha: "",
  tipo: null,
  banco: null,
  valor: 0,
  vencimento: "",
  beneficiario: "",
  documento: "",
  fornecedorId: "",
  descricao: "",
  categoriaId: "",
  centroId: "",
  observacao: "",
};

declare global {
  interface Window {
    BarcodeDetector?: {
      new (opts: { formats: string[] }): { detect: (img: ImageBitmapSource) => Promise<{ rawValue: string }[]> };
      getSupportedFormats?: () => Promise<string[]>;
    };
  }
}

async function lerImagem(arquivo: File): Promise<string | null> {
  const BD = window.BarcodeDetector;
  if (!BD) return null;
  const formatos = (await BD.getSupportedFormats?.()) ?? [];
  if (formatos.length && !formatos.includes("itf")) return null;
  const bmp = await createImageBitmap(arquivo);
  const achados = await new BD({ formats: ["itf"] }).detect(bmp);
  const cod = achados.map((a) => somenteDigitos(a.rawValue)).find((d) => d.length === 44);
  return cod ?? null;
}

export function LeitorBoleto({
  aberto,
  onFechar,
  cadastros,
  rascunhoExistente,
}: {
  aberto: boolean;
  onFechar: () => void;
  cadastros: Cadastros | undefined;
  /** Conferir um rascunho já guardado. */
  rascunhoExistente?: ContaFin | null;
}) {
  const qc = useQueryClient();
  const [passo, setPasso] = useState<"origem" | "conferir">("origem");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [colado, setColado] = useState("");
  const [lendo, setLendo] = useState(false);
  const [avisoLeitura, setAvisoLeitura] = useState<string | null>(null);
  const [analise, setAnalise] = useState<AnaliseBoleto | null>(null);
  const [doTexto, setDoTexto] = useState<DadosDoTexto | null>(null);
  const [r, setR] = useState<Rascunho>(VAZIO);
  const [aviso, setAviso] = useState<{ a: AvisoFinanceiro; modo: "rascunho" | "conta" } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const fornecedores = cadastros?.fornecedores ?? [];

  useEffect(() => {
    if (!aberto) return;
    setArquivo(null);
    setColado("");
    setAvisoLeitura(null);
    setAviso(null);
    if (rascunhoExistente) {
      const a = rascunhoExistente.linha_digitavel ? analisarBoleto(rascunhoExistente.linha_digitavel) : null;
      setAnalise(a);
      setDoTexto(null);
      setR({
        ...VAZIO,
        linha: rascunhoExistente.linha_digitavel ?? "",
        tipo: a?.tipo ?? null,
        banco: a?.banco ?? null,
        valor: rascunhoExistente.valor,
        vencimento: rascunhoExistente.vencimento,
        beneficiario: rascunhoExistente.contraparte ?? "",
        fornecedorId: rascunhoExistente.fornecedor_id ?? "",
        descricao: rascunhoExistente.descricao,
        categoriaId: rascunhoExistente.categoria_id ?? "",
        centroId: rascunhoExistente.cost_center_id ?? "",
        observacao: rascunhoExistente.observacao ?? "",
      });
      setPasso("conferir");
    } else {
      setAnalise(null);
      setDoTexto(null);
      setR(VAZIO);
      setPasso("origem");
    }
  }, [aberto, rascunhoExistente]);

  function preencher(a: AnaliseBoleto | null, t: DadosDoTexto | null) {
    setAnalise(a);
    setDoTexto(t);
    const doc = t?.documento ?? "";
    const forn = doc ? fornecedores.find((f) => f.documento === doc) : undefined;
    setR({
      ...VAZIO,
      linha: a?.linhaDigitavel ?? "",
      tipo: a?.tipo ?? null,
      banco: a?.banco ?? null,
      valor: a?.valor ?? t?.valor ?? 0,
      vencimento: a?.vencimento ?? t?.vencimento ?? "",
      beneficiario: t?.beneficiario ?? forn?.nome ?? "",
      documento: doc,
      fornecedorId: forn?.id ?? "",
      descricao: t?.beneficiario ? `Boleto ${t.beneficiario}` : "Boleto",
      categoriaId: forn?.categoria_id ?? "",
    });
    setPasso("conferir");
  }

  async function ler() {
    setLendo(true);
    setAvisoLeitura(null);
    try {
      if (colado.trim()) {
        const a = analisarBoleto(colado);
        if (!a.valido) {
          setAvisoLeitura(a.erros.join(" "));
          return;
        }
        preencher(a, null);
        return;
      }
      if (!arquivo) return;
      if (arquivo.type === "application/pdf" || /\.pdf$/i.test(arquivo.name)) {
        if (arquivo.size > 10 * 1024 * 1024) throw new Error("PDF acima de 10 MB.");
        const res = await lerBoletoPdf({ data: { nome: arquivo.name, base64: await arquivoParaBase64(arquivo) } });
        const c = res.codigos[0];
        if (!c) {
          setAvisoLeitura(
            res.temTexto
              ? "Não achei uma linha digitável válida no PDF. Digite ou cole a linha abaixo (os dados escritos no boleto já foram lidos)."
              : "O PDF não tem texto legível (provavelmente é uma imagem escaneada). Digite ou cole a linha digitável abaixo.",
          );
          setDoTexto(res.dados);
          return;
        }
        preencher(analisarBoleto(c.linhaDigitavel ?? c.codigoBarras ?? ""), res.dados);
        return;
      }
      if (arquivo.type.startsWith("image/")) {
        const cod = await lerImagem(arquivo).catch(() => null);
        if (!cod) {
          setAvisoLeitura(
            "Não há leitor de código de barras de imagem neste navegador (ou a foto não está nítida). Digite ou cole a linha digitável abaixo — a imagem fica anexada.",
          );
          return;
        }
        const a = analisarBoleto(cod);
        if (!a.valido) {
          setAvisoLeitura(`O código lido da imagem não confere: ${a.erros.join(" ")} Digite a linha digitável.`);
          return;
        }
        preencher(a, null);
        return;
      }
      throw new Error("Envie um PDF ou uma imagem (foto do boleto).");
    } catch (e) {
      setAvisoLeitura(mensagemDeErro(e, "Não foi possível ler o boleto."));
    } finally {
      setLendo(false);
    }
  }

  const fornecedor = fornecedores.find((f) => f.id === r.fornecedorId) ?? null;
  const conferencia = conferirBeneficiario({ documento: r.documento, beneficiario: r.beneficiario }, fornecedor);
  const alertas = alertasDoRascunho(analise, doTexto, hojeISO());
  const digitos = somenteDigitos(r.linha);
  const analiseAtual = useMemo(() => (digitos ? analisarBoleto(digitos) : null), [digitos]);

  const dup = useQuery({
    queryKey: ["financeiro", "duplicatas-boleto", digitos, r.fornecedorId, r.valor, r.vencimento, rascunhoExistente?.id],
    enabled: passo === "conferir" && (digitos.length >= 44 || (!!r.valor && !!r.vencimento)),
    queryFn: () =>
      consultar<{ numero: string; descricao: string; valor: number; vencimento: string; motivo: string }[]>("duplicatas", {
        _tipo: "pagar",
        _d: {
          linha_digitavel: digitos.length === 47 || digitos.length === 48 ? digitos : null,
          codigo_barras: analiseAtual?.codigoBarras ?? null,
          fornecedor_id: r.fornecedorId || null,
          fornecedor: fornecedor?.nome ?? r.beneficiario,
          valor: r.valor,
          vencimento: r.vencimento,
        },
        _exceto: rascunhoExistente?.id ?? null,
      }),
  });

  async function salvar(modo: "rascunho" | "conta", justificativa?: string) {
    setSalvando(true);
    try {
      const dados = {
        descricao: r.descricao,
        valor: r.valor,
        vencimento: r.vencimento,
        fornecedor: fornecedor?.nome ?? r.beneficiario,
        fornecedor_id: r.fornecedorId || null,
        categoria_id: r.categoriaId || null,
        cost_center_id: r.centroId || null,
        observacao: r.observacao || null,
        linha_digitavel: digitos.length === 47 || digitos.length === 48 ? digitos : null,
        codigo_barras: analiseAtual?.valido ? analiseAtual.codigoBarras : null,
        boleto_tipo: analiseAtual?.tipo ?? null,
        boleto_beneficiario: r.beneficiario || null,
        boleto_documento: r.documento || null,
        confirmar_duplicidade: !!justificativa,
        justificativa: justificativa ?? null,
      };
      let id: string | null = rascunhoExistente?.id ?? null;
      if (rascunhoExistente) {
        const res =
          modo === "conta"
            ? await executar("contaConfirmarRascunho", { _id: rascunhoExistente.id, _d: dados })
            : await executar("contaSalvar", { _tipo: "pagar", _d: { ...dados, id: rascunhoExistente.id } });
        if (!res.ok) {
          setAviso({ a: res, modo });
          return;
        }
      } else {
        const res = await executar<{ ids: string[] }>("contaSalvar", { _tipo: "pagar", _d: { ...dados, rascunho: modo === "rascunho" } });
        if (!res.ok) {
          setAviso({ a: res, modo });
          return;
        }
        id = res.dados.ids[0];
        if (arquivo && id) await enviarAnexo(arquivo, "contas-pagar", "financial_payables", id).catch(() => toast.warning("A conta foi salva, mas o arquivo não anexou."));
      }
      toast.success(modo === "rascunho" ? "Rascunho guardado: confira antes de pagar." : "Conta conferida e salva.");
      await invalidarFinanceiro(qc);
      onFechar();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível salvar."));
    } finally {
      setSalvando(false);
    }
  }

  const podeSalvar = r.descricao.trim().length >= 2 && r.valor > 0 && !!r.vencimento && (!digitos || !!analiseAtual?.valido);

  return (
    <>
      <Dialog open={aberto} onOpenChange={(o) => !o && !salvando && onFechar()}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-primary" /> {rascunhoExistente ? "Conferir rascunho de boleto" : "Ler boleto"}
            </DialogTitle>
            <DialogDescription>O sistema lê e confere os dígitos; você revisa tudo antes de salvar. Nada é pago por aqui.</DialogDescription>
          </DialogHeader>

          {passo === "origem" ? (
            <div className="space-y-4">
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border px-4 py-8 text-center hover:border-primary/50">
                <FileUp className="h-7 w-7 text-primary" />
                <span className="text-sm font-medium">{arquivo ? arquivo.name : "Escolha o PDF ou a foto do boleto"}</span>
                <span className="text-xs text-muted-foreground">PDF gerado pelo banco é lido pelo texto; foto usa o leitor do navegador, se houver.</span>
                <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
              </label>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Barcode className="h-4 w-4" /> Ou digite/cole a linha digitável ou o código de barras
                </Label>
                <Input value={colado} onChange={(e) => setColado(e.target.value)} placeholder="23793.38128 60082.677139 48000.063307 3 99990000024590" />
              </div>
              {avisoLeitura && (
                <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <p>{avisoLeitura}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div
                className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
                  analiseAtual?.valido ? "border-success/30 bg-success/5" : digitos ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/30"
                }`}
              >
                {analiseAtual?.valido ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                ) : (
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <Input value={r.linha} onChange={(e) => setR({ ...r, linha: e.target.value })} className="font-mono text-xs" placeholder="Linha digitável" />
                  <p className="text-xs text-muted-foreground">
                    {analiseAtual?.valido
                      ? `${analiseAtual.tipo === "arrecadacao" ? "Arrecadação" : `Bancário · banco ${analiseAtual.banco}`} · dígitos verificadores conferem · ${formatarLinhaDigitavel(digitos)}`
                      : digitos
                        ? analiseAtual?.erros.join(" ")
                        : "Sem linha digitável (despesa sem boleto)."}
                  </p>
                  {analiseAtual?.avisos.map((a) => (
                    <p key={a} className="text-xs text-warning">
                      {a}
                    </p>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Valor</Label>
                  <CurrencyInput value={r.valor} onChange={(v) => setR({ ...r, valor: v })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Vencimento</Label>
                  <Input type="date" value={r.vencimento} onChange={(e) => setR({ ...r, vencimento: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Beneficiário (no boleto)</Label>
                  <Input value={r.beneficiario} onChange={(e) => setR({ ...r, beneficiario: e.target.value })} maxLength={160} />
                </div>
                <div className="space-y-1.5">
                  <Label>CNPJ/CPF do beneficiário</Label>
                  <Input value={r.documento} onChange={(e) => setR({ ...r, documento: somenteDigitos(e.target.value).slice(0, 14) })} inputMode="numeric" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Fornecedor</Label>
                  <Select value={r.fornecedorId || "_"} onValueChange={(v) => setR({ ...r, fornecedorId: v === "_" ? "" : v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha o fornecedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_">Sem fornecedor cadastrado</SelectItem>
                      {fornecedores
                        .filter((f) => f.ativo)
                        .map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {conferencia === "diverge" && (
                    <p className="flex items-center gap-1.5 text-xs text-destructive">
                      <ShieldAlert className="h-3.5 w-3.5" /> O beneficiário do boleto não bate com o fornecedor escolhido. Confira antes de salvar (golpe comum).
                    </p>
                  )}
                  {conferencia === "confere" && <p className="text-xs text-success">Beneficiário confere com o fornecedor.</p>}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Descrição</Label>
                  <Input value={r.descricao} onChange={(e) => setR({ ...r, descricao: e.target.value })} maxLength={200} />
                </div>
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Select value={r.categoriaId || "_"} onValueChange={(v) => setR({ ...r, categoriaId: v === "_" ? "" : v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_">Sem categoria</SelectItem>
                      {(cadastros?.categorias ?? [])
                        .filter((c) => c.ativo && c.tipo !== "receita")
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Centro de custo</Label>
                  <Select value={r.centroId || "_"} onValueChange={(v) => setR({ ...r, centroId: v === "_" ? "" : v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_">Sem centro</SelectItem>
                      {(cadastros?.centros ?? [])
                        .filter((c) => c.ativo)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Observação</Label>
                  <Textarea rows={2} value={r.observacao} onChange={(e) => setR({ ...r, observacao: e.target.value })} maxLength={500} />
                </div>
              </div>

              {(alertas.vencido || alertas.divergencias.length > 0 || (dup.data?.length ?? 0) > 0) && (
                <ul className="space-y-1.5 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs">
                  {(alertas.vencido || (r.vencimento && r.vencimento < hojeISO())) && <li>• Boleto vencido: confira juros/multa antes de pagar.</li>}
                  {alertas.divergencias.map((d) => (
                    <li key={d}>• {d}</li>
                  ))}
                  {(dup.data ?? []).map((d, i) => (
                    <li key={i}>
                      • Possível duplicata: {d.numero} {d.descricao} · {moeda(d.valor)} ({d.motivo})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={onFechar} disabled={salvando || lendo}>
              Voltar
            </Button>
            {passo === "origem" ? (
              <>
                <Button variant="outline" onClick={() => preencher(null, doTexto)} disabled={lendo}>
                  Preencher à mão
                </Button>
                <Button onClick={ler} disabled={lendo || (!arquivo && !colado.trim())}>
                  {lendo ? "Lendo…" : "Ler boleto"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => salvar("rascunho")} disabled={salvando || !podeSalvar}>
                  Guardar rascunho
                </Button>
                <Button onClick={() => salvar("conta")} disabled={salvando || !podeSalvar}>
                  {salvando ? "Salvando…" : "Conferi — salvar conta"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DialogoAviso aviso={aviso?.a ?? null} onFechar={() => setAviso(null)} onConfirmar={(j) => salvar(aviso!.modo, j)} />
    </>
  );
}

export async function descartarRascunho(id: string, qc: ReturnType<typeof useQueryClient>) {
  await executarOuFalhar("contaDescartarRascunho", { _id: id });
  await invalidarFinanceiro(qc);
}
