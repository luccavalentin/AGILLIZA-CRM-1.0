import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ESTADO_CIVIL_COM_REGIME } from "@/lib/propostas/dominios";
import { CamposParticipante } from "./participante-form/campos-participante";
import {
  camposFaltantes,
  formParaEnvolvido,
  VAZIO,
  type ParticipanteForm,
} from "./participante-form/types";

// Re-exports públicos (mantém compatibilidade com callers atuais).
export {
  envolvidoParaForm,
  formParaEnvolvido,
  participanteCompleto,
  type ParticipanteForm,
} from "./participante-form/types";

export function ParticipanteDialog({
  open,
  onOpenChange,
  titulo,
  inicial,
  conjugeInicial,
  tipoQualificacaoFixo,
  salvando,
  onSalvar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  titulo: string;
  inicial?: ParticipanteForm;
  conjugeInicial?: ParticipanteForm;
  tipoQualificacaoFixo?: string;
  salvando?: boolean;
  onSalvar: (
    principal: ReturnType<typeof formParaEnvolvido>,
    conjuge: ReturnType<typeof formParaEnvolvido> | null,
  ) => Promise<void> | void;
}) {
  const [f, setF] = useState<ParticipanteForm>(inicial ?? VAZIO);
  const [conjuge, setConjuge] = useState<ParticipanteForm>(
    conjugeInicial ?? { ...VAZIO, tipo_qualificacao: "TI" },
  );
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [buscandoCepC, setBuscandoCepC] = useState(false);
  const [erros, setErros] = useState<Set<string>>(new Set());
  const [errosC, setErrosC] = useState<Set<string>>(new Set());
  const [tentouEnviar, setTentouEnviar] = useState(false);

  useEffect(() => {
    if (open) {
      setF(inicial ?? { ...VAZIO, tipo_qualificacao: tipoQualificacaoFixo ?? "CO" });
      setConjuge(conjugeInicial ?? { ...VAZIO, tipo_qualificacao: "TI" });
      setErros(new Set());
      setErrosC(new Set());
      setTentouEnviar(false);
    }
  }, [open, inicial, conjugeInicial, tipoQualificacaoFixo]);

  // Após a primeira tentativa, revalida ao vivo para o vermelho sumir conforme preenche.
  useEffect(() => {
    if (tentouEnviar) setErros(camposFaltantes(f));
  }, [f, tentouEnviar]);
  useEffect(() => {
    if (tentouEnviar) setErrosC(camposFaltantes(conjuge));
  }, [conjuge, tentouEnviar]);

  const pf = f.tipo_pessoa === "F";
  const permiteConjuge = true;
  const precisaConjuge = permiteConjuge && pf && ESTADO_CIVIL_COM_REGIME.has(f.estado_civil);

  const set = (patch: Partial<ParticipanteForm>) => setF((p) => ({ ...p, ...patch }));
  const setC = (patch: Partial<ParticipanteForm>) => setConjuge((p) => ({ ...p, ...patch }));

  const conjugeTemDados = [
    conjuge.nome,
    conjuge.cpf_cnpj,
    conjuge.data_nascimento,
    conjuge.nome_mae,
    conjuge.tipo_sexo,
    conjuge.tipo_documento_identidade,
    conjuge.numero_documento,
    conjuge.orgao_expedidor,
    conjuge.uf_expedicao,
    conjuge.data_expedicao,
    conjuge.profissao,
    conjuge.empresa,
    conjuge.email,
    conjuge.celular,
    conjuge.cep,
    conjuge.logradouro,
    conjuge.numero_logradouro,
    conjuge.complemento,
    conjuge.bairro,
    conjuge.municipio,
    conjuge.uf,
  ].some((valor) => String(valor ?? "").trim().length > 0) || conjuge.renda > 0;

  async function buscarCep(
    cepRaw: string,
    aplicar: (patch: Partial<ParticipanteForm>) => void,
    atual: ParticipanteForm,
    setLoading: (v: boolean) => void,
  ) {
    const cep = cepRaw.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setLoading(true);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const dados = await resp.json();
      if (dados?.erro) {
        toast.error("CEP não encontrado.");
        return;
      }
      aplicar({
        logradouro: dados.logradouro || atual.logradouro,
        bairro: dados.bairro || atual.bairro,
        municipio: dados.localidade || atual.municipio,
        uf: dados.uf || atual.uf,
      });
    } catch {
      toast.error("Não foi possível consultar o CEP.");
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    setTentouEnviar(true);
    const faltando = camposFaltantes(f);
    setErros(faltando);

    const c: ParticipanteForm | null = precisaConjuge && conjugeTemDados
      ? {
          ...conjuge,
          tipo_qualificacao: "TI",
          tipo_pessoa: "F",
          estado_civil: f.estado_civil,
          regime_casamento: f.regime_casamento,
        }
      : null;
    const faltandoC = c ? camposFaltantes(c) : new Set<string>();
    setErrosC(faltandoC);

    if (faltando.size > 0 || faltandoC.size > 0) {
      const total = faltando.size + faltandoC.size;
      toast.error(
        `Preencha ${total} campo${total > 1 ? "s" : ""} obrigatório${total > 1 ? "s" : ""} destacado${total > 1 ? "s" : ""} em vermelho.`,
      );
      return;
    }

    const conjugePayload = c ? formParaEnvolvido(c) : null;
    await onSalvar(formParaEnvolvido(f), conjugePayload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            Dados complementares enviados aos bancos quando a proposta é processada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <CamposParticipante
            f={f}
            set={set}
            erros={erros}
            buscandoCep={buscandoCep}
            onBuscarCep={(m) => buscarCep(m, set, f, setBuscandoCep)}
            mostrarQualificacao={!tipoQualificacaoFixo}
            mostrarEstadoCivil
            mostrarIdentificacaoExtra
          />

          {precisaConjuge && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 sm:p-4">
              <p className="mb-3 text-sm font-semibold text-primary">
                Dados do cônjuge / coproponente
              </p>
              <div className="space-y-5">
                <CamposParticipante
                  f={conjuge}
                  set={setC}
                  erros={errosC}
                  buscandoCep={buscandoCepC}
                  onBuscarCep={(m) => buscarCep(m, setC, conjuge, setBuscandoCepC)}
                  mostrarQualificacao={false}
                  mostrarEstadoCivil={false}
                  mostrarIdentificacaoExtra={false}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={salvando}>
            {salvando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
