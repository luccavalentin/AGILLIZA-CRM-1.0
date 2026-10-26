/**
 * Diálogos do financeiro: motivo obrigatório (cancelar, estornar, ajustar, contestar),
 * aviso de regra com justificativa (duplicidade, soma, excedente) e registro de
 * recebimento/pagamento com comprovante. Nenhum deles move dinheiro: só registram o
 * que a pessoa autorizada fez.
 */
import { useEffect, useState } from "react";
import { AlertTriangle, Paperclip, ShieldCheck } from "lucide-react";
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
import type { AvisoFinanceiro, RespostaExecucao } from "@/lib/financeiro/cliente";
import type { ContaBancaria, ItemCadastro } from "@/lib/financeiro/tipos";
import { enviarAnexo, type PastaFinanceiro } from "./anexos";
import { moeda } from "./base";

export function DialogoMotivo({
  aberto,
  titulo,
  descricao,
  rotulo = "Motivo",
  confirmar = "Confirmar",
  perigo,
  comValor,
  valorInicial,
  onFechar,
  onConfirmar,
}: {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  rotulo?: string;
  confirmar?: string;
  perigo?: boolean;
  /** Pede também um valor (ajuste). */
  comValor?: string;
  valorInicial?: number;
  onFechar: () => void;
  onConfirmar: (motivo: string, valor?: number) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState("");
  const [valor, setValor] = useState(valorInicial ?? 0);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (aberto) {
      setMotivo("");
      setValor(valorInicial ?? 0);
    }
  }, [aberto, valorInicial]);
  const valido = motivo.trim().length >= 5 && (!comValor || valor > 0);
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && !enviando && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descricao && <DialogDescription>{descricao}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3">
          {comValor && (
            <div className="space-y-1.5">
              <Label>{comValor}</Label>
              <CurrencyInput value={valor} onChange={setValor} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>{rotulo}</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} maxLength={500} placeholder="Fica registrado na trilha de auditoria." />
            <p className="text-[11px] text-muted-foreground">Mínimo de 5 letras. Quem, quando e o motivo ficam gravados.</p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onFechar} disabled={enviando}>
            Voltar
          </Button>
          <Button
            variant={perigo ? "destructive" : "default"}
            disabled={!valido || enviando}
            onClick={async () => {
              setEnviando(true);
              try {
                await onConfirmar(motivo.trim(), comValor ? valor : undefined);
                onFechar();
              } catch (e) {
                toast.error(mensagemDeErro(e, "Não foi possível concluir."));
              } finally {
                setEnviando(false);
              }
            }}
          >
            {enviando ? "Gravando…" : confirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Aviso do banco (duplicidade, soma acima da comissão do banco): segue só com justificativa. */
export function DialogoAviso({
  aviso,
  onFechar,
  onConfirmar,
}: {
  aviso: AvisoFinanceiro | null;
  onFechar: () => void;
  onConfirmar: (justificativa: string) => Promise<void>;
}) {
  const [just, setJust] = useState("");
  const [enviando, setEnviando] = useState(false);
  useEffect(() => setJust(""), [aviso]);
  const parecidas = Array.isArray(aviso?.detalhe) ? (aviso!.detalhe as unknown as { numero?: string; descricao?: string; valor?: number; vencimento?: string; motivo?: string }[]) : [];
  return (
    <Dialog open={!!aviso} onOpenChange={(o) => !o && !enviando && onFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            {aviso?.aviso === "soma" ? "A soma passa da comissão do banco" : "Possível duplicidade"}
          </DialogTitle>
          <DialogDescription>{aviso?.mensagem}</DialogDescription>
        </DialogHeader>
        {parecidas.length > 0 && (
          <ul className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-border/70 bg-muted/30 p-2 text-xs">
            {parecidas.map((p, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card px-2.5 py-1.5">
                <span className="min-w-0 truncate">
                  <b>{p.numero}</b> {p.descricao}
                </span>
                <span className="font-mono tabular-nums">
                  {p.valor != null ? moeda(p.valor) : ""} {p.vencimento ? `· ${p.vencimento.split("-").reverse().join("/")}` : ""}
                </span>
                {p.motivo && <span className="w-full text-[11px] text-warning">{p.motivo}</span>}
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-1.5">
          <Label>Por que lançar mesmo assim?</Label>
          <Textarea value={just} onChange={(e) => setJust(e.target.value)} rows={3} maxLength={500} />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onFechar} disabled={enviando}>
            Não lançar
          </Button>
          <Button
            disabled={just.trim().length < 5 || enviando}
            onClick={async () => {
              setEnviando(true);
              try {
                await onConfirmar(just.trim());
                onFechar();
              } catch (e) {
                toast.error(mensagemDeErro(e, "Não foi possível concluir."));
              } finally {
                setEnviando(false);
              }
            }}
          >
            Lançar com justificativa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface DadosBaixa {
  valor: number;
  data: string;
  contaBancaria: string | null;
  forma: string | null;
  documento: string | null;
  observacao: string | null;
  anexo: string | null;
  permitirExcedente: boolean;
}

/** Registrar recebimento ou pagamento (total ou parcial), com comprovante. */
export function DialogoBaixa({
  aberto,
  titulo,
  subtitulo,
  saldo,
  entrada,
  pasta,
  contas,
  formas,
  permiteExcedente,
  onFechar,
  onConfirmar,
}: {
  aberto: boolean;
  titulo: string;
  subtitulo?: string;
  saldo: number;
  entrada: boolean;
  pasta: PastaFinanceiro;
  contas: ContaBancaria[];
  formas: ItemCadastro[];
  permiteExcedente?: boolean;
  onFechar: () => void;
  onConfirmar: (d: DadosBaixa) => Promise<RespostaExecucao<unknown> | void>;
}) {
  const [valor, setValor] = useState(saldo);
  const [data, setData] = useState(hojeISO());
  const [conta, setConta] = useState<string>("");
  const [forma, setForma] = useState<string>("");
  const [documento, setDocumento] = useState("");
  const [obs, setObs] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [excedente, setExcedente] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (aberto) {
      setValor(Math.max(0, Math.round(saldo * 100) / 100));
      setData(hojeISO());
      setConta(contas.find((c) => c.ativo)?.id ?? "");
      setForma("");
      setDocumento("");
      setObs("");
      setArquivo(null);
      setExcedente(null);
    }
  }, [aberto, saldo, contas]);

  async function enviar(permitir: boolean) {
    setEnviando(true);
    try {
      const anexo = arquivo ? await enviarAnexo(arquivo, pasta, "comprovante") : null;
      const r = await onConfirmar({
        valor,
        data,
        contaBancaria: conta || null,
        forma: forma || null,
        documento: documento.trim() || null,
        observacao: obs.trim() || null,
        anexo,
        permitirExcedente: permitir,
      });
      if (r && !r.ok) {
        if (r.aviso === "excedente" && permiteExcedente) {
          setExcedente(r.mensagem);
          return;
        }
        throw new Error(r.mensagem);
      }
      toast.success(entrada ? "Recebimento registrado." : "Pagamento registrado.");
      onFechar();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível registrar."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && !enviando && onFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {subtitulo ? `${subtitulo} · ` : ""}Saldo {moeda(saldo)}. {entrada ? "Recebimento" : "Pagamento"} parcial é permitido.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Valor</Label>
            <CurrencyInput value={valor} onChange={setValor} />
          </div>
          <div className="space-y-1.5">
            <Label>Data {entrada ? "do crédito" : "do pagamento"}</Label>
            <Input type="date" value={data} max={hojeISO()} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Conta bancária</Label>
            <Select value={conta || "_"} onValueChange={(v) => setConta(v === "_" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_">Sem conta</SelectItem>
                {contas
                  .filter((c) => c.ativo)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.apelido}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Forma</Label>
            <Select value={forma || "_"} onValueChange={(v) => setForma(v === "_" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_">Não informada</SelectItem>
                {["Pix", "TED", "Boleto", "Débito em conta", "Dinheiro", ...formas.filter((f) => f.ativo).map((f) => f.nome)]
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Nº do comprovante / identificador</Label>
            <Input value={documento} onChange={(e) => setDocumento(e.target.value)} maxLength={120} placeholder="E2E do Pix, nº do TED…" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Observação</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} maxLength={500} />
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground hover:border-primary/40 sm:col-span-2">
            <Paperclip className="h-4 w-4 text-primary" />
            <span className="min-w-0 flex-1 truncate">{arquivo ? arquivo.name : "Anexar comprovante (PDF ou imagem, até 15 MB)"}</span>
            <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        {excedente && (
          <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p>{excedente}</p>
          </div>
        )}
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Nada é cobrado nem transferido pelo sistema: isto só registra o que aconteceu no banco.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onFechar} disabled={enviando}>
            Voltar
          </Button>
          {excedente ? (
            <Button variant="destructive" disabled={enviando} onClick={() => enviar(true)}>
              Registrar como divergente
            </Button>
          ) : (
            <Button disabled={enviando || valor <= 0 || !data} onClick={() => enviar(false)}>
              {enviando ? "Gravando…" : entrada ? "Registrar recebimento" : "Registrar pagamento"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
