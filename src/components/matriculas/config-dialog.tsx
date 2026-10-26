import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { maskBRLCents, maskBRLInput, parseBRL } from "@/lib/simulacao/format";
import { salvarConfigMatriculas, type MatriculaConfig } from "@/lib/matriculas/matriculas.functions";

/** Pix, pedidos das contas assinantes (receber e limite) e valor de referência. */
export function ConfigDialog({ config, onMudou }: { config: MatriculaConfig | null; onMudou: () => void }) {
  const salvarFn = useServerFn(salvarConfigMatriculas);
  const [aberto, setAberto] = useState(false);
  const [pix, setPix] = useState("");
  const [titular, setTitular] = useState("");
  const [recebe, setRecebe] = useState(false);
  const [limite, setLimite] = useState("10");
  const [referencia, setReferencia] = useState("");
  const [salvando, setSalvando] = useState(false);

  function abrir() {
    setPix(config?.pix_chave ?? "");
    setTitular(config?.pix_titular ?? "");
    setRecebe(config?.recebe_assinantes ?? false);
    setLimite(String(config?.limite_pedidos_assinante ?? 10));
    setReferencia(config?.valor_referencia ? maskBRLInput(config.valor_referencia) : "");
    setAberto(true);
  }

  async function salvar() {
    const n = Number(limite);
    if (!Number.isInteger(n) || n < 1 || n > 200) return void toast.error("O limite vai de 1 a 200 pedidos.");
    setSalvando(true);
    try {
      await salvarFn({
        data: {
          pix_chave: pix || null,
          pix_titular: titular || null,
          recebe_assinantes: recebe,
          limite_pedidos_assinante: n,
          valor_referencia: referencia ? parseBRL(referencia) : null,
        },
      });
      toast.success("Configuração salva.");
      setAberto(false);
      onMudou();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível salvar."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={abrir}>
        <Settings2 className="mr-1 h-4 w-4" />
        Configurar
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configuração das matrículas</DialogTitle>
            <DialogDescription>O que aparece para quem paga e como chegam os pedidos das contas assinantes.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="mcf-pix">Chave Pix</Label>
              <Input id="mcf-pix" value={pix} maxLength={200} onChange={(e) => setPix(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mcf-tit">Titular</Label>
              <Input id="mcf-tit" value={titular} maxLength={200} onChange={(e) => setTitular(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mcf-ref">Valor de referência</Label>
              <Input
                id="mcf-ref"
                inputMode="decimal"
                value={referencia}
                onChange={(e) => setReferencia(maskBRLCents(e.target.value))}
                placeholder="Sugestão ao concluir"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mcf-lim">Pedidos em aberto por conta</Label>
              <Input
                id="mcf-lim"
                inputMode="numeric"
                value={limite}
                onChange={(e) => setLimite(e.target.value.replace(/\D/g, "").slice(0, 3))}
              />
            </div>
            <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 sm:col-span-2">
              <span className="text-sm">
                <span className="font-medium text-foreground">Receber pedidos das contas assinantes</span>
                <span className="block text-xs text-muted-foreground">
                  Contas sem analista na carteira pedem matrícula pelo portal e o pedido cai aqui.
                </span>
              </span>
              <Switch checked={recebe} onCheckedChange={setRecebe} />
            </label>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void salvar()} disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
