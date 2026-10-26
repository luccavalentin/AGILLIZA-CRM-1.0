import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Stamp } from "lucide-react";
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
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { marcarContratoRegistrado } from "@/lib/propostas/propostas.functions";
import { erroDataRegistro, hojeEmSaoPaulo } from "@/lib/propostas/contrato-registrado";
import { textoIdH } from "@/lib/propostas/id-h";

/**
 * "Marcar contrato registrado" (C12): pede a data do cartório e grava pela regra do servidor
 * (só a partir de "Contrato emitido"; data não futura nem anterior à emissão).
 */
export function MarcarRegistroDialog({
  proposta,
  onClose,
}: {
  proposta: {
    id: string;
    homefin_id_oportunidade?: string | number | null;
    contrato_emitido_em?: string | null;
    nome_cliente?: string | null;
  } | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const marcar = useServerFn(marcarContratoRegistrado);
  const [data, setData] = useState(() => hojeEmSaoPaulo());
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (proposta) setData(hojeEmSaoPaulo());
  }, [proposta]);
  const erro = erroDataRegistro(data, proposta?.contrato_emitido_em ?? null);

  async function confirmar() {
    if (!proposta || erro) return;
    setSalvando(true);
    try {
      await marcar({ data: { proposta_id: proposta.id, data } });
      toast.success("Contrato registrado.");
      qc.invalidateQueries({ queryKey: ["propostas"] });
      qc.invalidateQueries({ queryKey: ["proposta", proposta.id] });
      onClose();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível marcar o registro."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={!!proposta} onOpenChange={(o) => !o && !salvando && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stamp className="size-4 text-primary" /> Marcar contrato registrado
          </DialogTitle>
          <DialogDescription>
            {proposta ? `${textoIdH(proposta)}${proposta.nome_cliente ? ` · ${proposta.nome_cliente}` : ""}. ` : ""}
            Informe a data do registro em cartório.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="data-registro-dialog">Data do registro</Label>
          <Input
            id="data-registro-dialog"
            type="date"
            value={data}
            max={hojeEmSaoPaulo()}
            onChange={(e) => setData(e.target.value)}
            className="h-11 w-full sm:w-48"
          />
          {erro && <p className="text-xs text-destructive">{erro}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={salvando}>
            Voltar
          </Button>
          <Button onClick={confirmar} disabled={salvando || !!erro}>
            {salvando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Marcar contrato registrado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
