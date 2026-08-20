import { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
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
import { LABEL_POR_CHAVE } from "@/lib/propostas/campos-obrigatorios";
import { CamposParticipante } from "./participante-form/campos-participante";
import {
  camposFaltantes,
  formParaEnvolvido,
  VAZIO,
  type ParticipanteForm,
  envolvidoParaForm,
  participanteCompleto,
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
  idBanco,
  focarPendencias,
  avisoTopo,
  participanteIndex,
  totalParticipantes,
  participanteId,
  nomeConjugeExistente,
  destacarObrigatorios = false,
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
    opcoes?: { enviar?: boolean },
  ) => Promise<void> | void;
  idBanco?: number;
  focarPendencias?: boolean;
  avisoTopo?: React.ReactNode;
  participanteIndex?: number;
  totalParticipantes?: number;
  participanteId?: string;
  nomeConjugeExistente?: string | null;
  destacarObrigatorios?: boolean;
}) {
  const [salvandoInterno, setSalvandoInterno] = useState(false);

  const [f, setF] = useState<ParticipanteForm>(inicial ?? VAZIO);
  const [conjuge, setConjuge] = useState<ParticipanteForm>(
    conjugeInicial ?? { ...VAZIO, tipo_qualificacao: "TI" },
  );
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [buscandoCepC, setBuscandoCepC] = useState(false);
  const [erros, setErros] = useState<Set<string>>(new Set());
  const [errosC, setErrosC] = useState<Set<string>>(new Set());
  const [tentouEnviar, setTentouEnviar] = useState(destacarObrigatorios);

  useEffect(() => {
    if (destacarObrigatorios) setTentouEnviar(true);
  }, [destacarObrigatorios]);
  const corpoRef = useRef<HTMLDivElement>(null);
  const jaFocou = useRef(false);

  useEffect(() => {
    if (!open) {
      jaFocou.current = false;
      return;
    }
    setF(inicial ?? { ...VAZIO, tipo_qualificacao: tipoQualificacaoFixo ?? "CO" });
    setConjuge(conjugeInicial ?? { ...VAZIO, tipo_qualificacao: "TI" });
    setErros(new Set());
    setErrosC(new Set());
    setTentouEnviar(Boolean(focarPendencias));
    jaFocou.current = false;
  }, [open, participanteId]);

  // Após a primeira tentativa, revalida ao vivo para o vermelho sumir conforme preenche.
  useEffect(() => {
    if (tentouEnviar) setErros(camposFaltantes(f));
  }, [f, tentouEnviar]);

  useEffect(() => {
    if (tentouEnviar) setErrosC(camposFaltantes(conjuge));
  }, [conjuge, tentouEnviar]);

  // Rola até o primeiro campo pendente quando o modal abre em modo "completar".
  useEffect(() => {
    if (!open || !focarPendencias || jaFocou.current) return;

    // Aguardamos os erros serem computados e o DOM atualizar para encontrar o campo .border-destructive
    const t = setTimeout(() => {
      const alvo = corpoRef.current?.querySelector<HTMLElement>(".border-destructive");
      if (alvo) {
        jaFocou.current = true;
        alvo.scrollIntoView({ block: "center", behavior: "smooth" });
        alvo.focus?.();
      }
    }, 150);
    return () => clearTimeout(t);
  }, [open, focarPendencias]);

  // 1 & 2. CORREÇÃO: A seção de cônjuge só aparece para o TITULAR/comprador principal
  // e se não houver um cônjuge já cadastrado como participante independente.
  const ehConjuge = f.tipo_qualificacao === "CJ";
  const permiteConjuge = !ehConjuge && !nomeConjugeExistente;
  const precisaConjuge =
    permiteConjuge && f.tipo_pessoa === "F" && ESTADO_CIVIL_COM_REGIME.has(f.estado_civil);

  const set = (patch: Partial<ParticipanteForm>) => setF((p) => ({ ...p, ...patch }));
  const setC = (patch: Partial<ParticipanteForm>) => setConjuge((p) => ({ ...p, ...patch }));

  const conjugeTemDados =
    [
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

  /** Cônjuge normalizado que será salvo junto com o titular (quando houver). */
  const conjugeParaSalvar: ParticipanteForm | null = useMemo(
    () =>
      precisaConjuge && conjugeTemDados
        ? {
            ...conjuge,
            tipo_qualificacao: "TI",
            tipo_pessoa: "F",
            estado_civil: f.estado_civil,
            regime_casamento: f.regime_casamento,
          }
        : null,
    [precisaConjuge, conjugeTemDados, conjuge, f.estado_civil, f.regime_casamento],
  );

  // Validade calculada EM TEMPO REAL a partir do formulário (nunca a partir do
  // estado de erro, que só é preenchido após a primeira tentativa).
  const pendentesAgora = useMemo(() => {
    const chaves = [
      ...camposFaltantes(f),
      ...(conjugeParaSalvar ? camposFaltantes(conjugeParaSalvar) : []),
    ];
    return Array.from(new Set(chaves)).map((k) => LABEL_POR_CHAVE[k] ?? k);
  }, [f, conjugeParaSalvar]);

  const podeEnviar = pendentesAgora.length === 0;

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

  async function submit(enviar: boolean) {
    if (salvandoInterno || salvando) return;
    setTentouEnviar(true);

    const faltando = camposFaltantes(f);
    setErros(faltando);

    const c: ParticipanteForm | null = conjugeParaSalvar;
    const faltandoC = c ? camposFaltantes(c) : new Set<string>();
    setErrosC(faltandoC);

    if (faltando.size > 0 || faltandoC.size > 0) {
      toast.error(`Não é possível salvar: faltam dados obrigatórios destacados em vermelho.`);
      return;
    }

    const conjugePayload = c ? formParaEnvolvido(c) : null;
    setSalvandoInterno(true);
    try {
      await onSalvar(formParaEnvolvido(f), conjugePayload, { enviar });
    } finally {
      setSalvandoInterno(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl flex flex-col p-0 overflow-hidden max-h-[90vh]">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle>{titulo}</DialogTitle>
            {participanteIndex !== undefined && totalParticipantes !== undefined && (
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                Participante {participanteIndex} de {totalParticipantes}
              </span>
            )}
          </div>
          <DialogDescription>
            Dados complementares enviados aos bancos quando a proposta é processada.
          </DialogDescription>
        </DialogHeader>

        <div
          className="brand-scroll scroll-shadow-bottom min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4"
          ref={corpoRef}
        >
          {avisoTopo}
          <CamposParticipante
            f={f}
            set={set}
            erros={erros}
            buscandoCep={buscandoCep}
            onBuscarCep={(m) => buscarCep(m, set, f, setBuscandoCep)}
            mostrarQualificacao={!tipoQualificacaoFixo}
            mostrarEstadoCivil
            mostrarIdentificacaoExtra
            idBanco={idBanco}
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
                  idBanco={idBanco}
                />
              </div>
            </div>
          )}

          {!ehConjuge && nomeConjugeExistente && ESTADO_CIVIL_COM_REGIME.has(f.estado_civil) && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 sm:p-4">
              <div className="flex items-center gap-2 text-sm text-primary font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Cônjuge cadastrado como participante: {nomeConjugeExistente}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center p-6 pt-2 shrink-0">
          <div className="flex-1">
            {podeEnviar ? (
              <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-success">
                <CheckCircle2 className="h-3.5 w-3.5" /> Tudo pronto para enviar
              </p>
            ) : (
              <p className="text-[11px] font-medium text-muted-foreground">
                Falta{pendentesAgora.length === 1 ? "" : "m"} {pendentesAgora.length}{" "}
                {pendentesAgora.length === 1 ? "dado obrigatório" : "dados obrigatórios"}:{" "}
                {pendentesAgora.join(", ")}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={salvando || salvandoInterno}
            >
              Cancelar
            </Button>
            <Button
              variant="ghost"
              onClick={() => submit(false)}
              disabled={salvando || salvandoInterno || !podeEnviar}
            >
              Salvar sem enviar
            </Button>
            <Button
              onClick={() => submit(true)}
              disabled={salvando || salvandoInterno || !podeEnviar}
              title={
                podeEnviar
                  ? "Salva o cadastro e envia a proposta ao banco"
                  : `Faltam: ${pendentesAgora.join(", ")}`
              }
            >
              {(salvando || salvandoInterno) && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Salvar e enviar ao banco
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
