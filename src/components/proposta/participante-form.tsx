import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/shared/date-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/simulacao/currency-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  TIPO_SITUACAO,
  TIPO_QUALIFICACAO,
  TIPO_PESSOA,
  TIPO_SEXO,
  TIPO_ESTADO_CIVIL,
  TIPO_REGIME_CASAMENTO,
  TIPO_DOCUMENTO_IDENTIDADE,
  ESTADO_CIVIL_COM_REGIME,
} from "@/lib/propostas/dominios";
import { maskCpfCnpj, maskCelular, apenasDigitos, validarCpfCnpj, UFS } from "@/lib/simulacao/format";
import { cn } from "@/lib/utils";


export type ParticipanteForm = {
  tipo_situacao: string;
  tipo_qualificacao: string;
  tipo_pessoa: string;
  nome: string;
  cpf_cnpj: string;
  data_nascimento: string;
  nome_mae: string;
  tipo_sexo: string;
  estado_civil: string;
  regime_casamento: string;
  tipo_documento_identidade: string;
  numero_documento: string;
  orgao_expedidor: string;
  uf_expedicao: string;
  data_expedicao: string;
  profissao: string;
  empresa: string;
  renda: number;
  email: string;
  celular: string;
  cep: string;
  logradouro: string;
  numero_logradouro: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  utiliza_fgts: boolean;
  fg_autorizacao_dados: boolean;
};

const VAZIO: ParticipanteForm = {
  tipo_situacao: "A",
  tipo_qualificacao: "CO",
  tipo_pessoa: "F",
  nome: "",
  cpf_cnpj: "",
  data_nascimento: "",
  nome_mae: "",
  tipo_sexo: "",
  estado_civil: "",
  regime_casamento: "",
  tipo_documento_identidade: "",
  numero_documento: "",
  orgao_expedidor: "",
  uf_expedicao: "",
  data_expedicao: "",
  profissao: "",
  empresa: "",
  renda: 0,
  email: "",
  celular: "",
  cep: "",
  logradouro: "",
  numero_logradouro: "",
  complemento: "",
  bairro: "",
  municipio: "",
  uf: "",
  utiliza_fgts: false,
  fg_autorizacao_dados: false,
};

/** Converte a linha do banco (proposta_envolvidos) para o formulário. */
export function envolvidoParaForm(e: any): ParticipanteForm {
  return {
    ...VAZIO,
    tipo_situacao: e.tipo_situacao ?? "A",
    tipo_qualificacao: e.tipo_qualificacao ?? "CO",
    tipo_pessoa: e.tipo_pessoa ?? "F",
    nome: e.nome ?? "",
    cpf_cnpj: e.cpf_cnpj ? maskCpfCnpj(e.cpf_cnpj) : "",
    data_nascimento: e.data_nascimento ?? "",
    nome_mae: e.nome_mae ?? "",
    tipo_sexo: e.tipo_sexo ?? "",
    estado_civil: e.estado_civil ?? "",
    regime_casamento: e.regime_casamento ?? "",
    tipo_documento_identidade: e.tipo_documento_identidade ?? "",
    numero_documento: e.numero_documento ?? "",
    orgao_expedidor: e.orgao_expedidor ?? "",
    uf_expedicao: e.uf_expedicao ?? "",
    data_expedicao: e.data_expedicao ?? "",
    profissao: e.profissao ?? "",
    empresa: e.empresa ?? "",
    renda: e.renda ?? 0,
    email: e.email ?? "",
    celular: e.celular ? maskCelular(e.celular) : "",
    cep: e.cep ?? "",
    logradouro: e.logradouro ?? "",
    numero_logradouro: e.numero_logradouro ?? "",
    complemento: e.complemento ?? "",
    bairro: e.bairro ?? "",
    municipio: e.municipio ?? "",
    uf: e.uf ?? "",
    utiliza_fgts: Boolean(e.utiliza_fgts),
    fg_autorizacao_dados: Boolean(e.fg_autorizacao_dados),
  };
}

/** Normaliza o formulário para o payload salvo em proposta_envolvidos. */
export function formParaEnvolvido(f: ParticipanteForm) {
  const pf = f.tipo_pessoa === "F";
  return {
    tipo_situacao: f.tipo_situacao,
    tipo_qualificacao: f.tipo_qualificacao,
    tipo_pessoa: f.tipo_pessoa,
    nome: f.nome.trim(),
    cpf_cnpj: apenasDigitos(f.cpf_cnpj),
    data_nascimento: pf ? f.data_nascimento || null : null,
    nome_mae: pf ? f.nome_mae.trim() || null : null,
    tipo_sexo: pf ? f.tipo_sexo || null : null,
    estado_civil: pf ? f.estado_civil || null : null,
    regime_casamento:
      pf && ESTADO_CIVIL_COM_REGIME.has(f.estado_civil) ? f.regime_casamento || null : null,
    tipo_documento_identidade: f.tipo_documento_identidade || null,
    numero_documento: f.numero_documento.trim() || null,
    orgao_expedidor: f.orgao_expedidor.trim() || null,
    uf_expedicao: f.uf_expedicao || null,
    data_expedicao: f.data_expedicao || null,
    profissao: f.profissao.trim() || null,
    empresa: f.empresa.trim() || null,
    renda: f.renda || null,
    email: f.email.trim() || null,
    celular: apenasDigitos(f.celular) || null,
    cep: apenasDigitos(f.cep) || null,
    logradouro: f.logradouro.trim() || null,
    numero_logradouro: f.numero_logradouro.trim() || null,
    complemento: f.complemento.trim() || null,
    bairro: f.bairro.trim() || null,
    municipio: f.municipio.trim() || null,
    uf: f.uf || null,
    utiliza_fgts: f.utiliza_fgts,
    fg_autorizacao_dados: f.fg_autorizacao_dados,
  };
}

/** Verifica se um envolvido (linha do banco) tem todos os dados obrigatórios. */
export function participanteCompleto(e: any): boolean {
  const base =
    e.nome &&
    e.cpf_cnpj &&
    e.tipo_documento_identidade &&
    e.numero_documento &&
    e.orgao_expedidor &&
    e.uf_expedicao &&
    e.profissao &&
    e.renda &&
    e.email &&
    e.celular &&
    e.cep &&
    e.logradouro &&
    e.numero_logradouro &&
    e.bairro &&
    e.municipio &&
    e.uf &&
    e.fg_autorizacao_dados;
  const pf = (e.tipo_pessoa ?? "F") === "F";
  const pessoais = !pf || (e.data_nascimento && e.nome_mae && e.tipo_sexo && e.estado_civil);
  return Boolean(base && pessoais);
}

/**
 * Retorna a lista de chaves de campos obrigatórios que ainda estão vazios/invalidos.
 * Usada para destacar os campos em vermelho.
 */
function camposFaltantes(f: ParticipanteForm): Set<string> {
  const pf = f.tipo_pessoa === "F";
  const faltando = new Set<string>();
  if (!f.nome.trim()) faltando.add("nome");
  if (!apenasDigitos(f.cpf_cnpj) || !validarCpfCnpj(f.cpf_cnpj)) faltando.add("cpf_cnpj");
  if (pf) {
    if (!f.data_nascimento) faltando.add("data_nascimento");
    if (!f.nome_mae.trim()) faltando.add("nome_mae");
    if (!f.tipo_sexo) faltando.add("tipo_sexo");
    if (!f.estado_civil) faltando.add("estado_civil");
  }
  if (!f.tipo_documento_identidade) faltando.add("tipo_documento_identidade");
  if (!f.numero_documento.trim()) faltando.add("numero_documento");
  if (!f.orgao_expedidor.trim()) faltando.add("orgao_expedidor");
  if (!f.uf_expedicao) faltando.add("uf_expedicao");
  if (!f.profissao.trim()) faltando.add("profissao");
  if (!f.renda || f.renda <= 0) faltando.add("renda");
  if (!f.email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) faltando.add("email");
  if (apenasDigitos(f.celular).length < 10) faltando.add("celular");
  if (!apenasDigitos(f.cep)) faltando.add("cep");
  if (!f.logradouro.trim()) faltando.add("logradouro");
  if (!f.numero_logradouro.trim()) faltando.add("numero_logradouro");
  if (!f.bairro.trim()) faltando.add("bairro");
  if (!f.municipio.trim()) faltando.add("municipio");
  if (!f.uf) faltando.add("uf");
  if (!f.fg_autorizacao_dados) faltando.add("fg_autorizacao_dados");
  return faltando;
}




function mascararCep(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

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


  const pf = f.tipo_pessoa === "F";
  const permiteConjuge = true;
  const precisaConjuge = permiteConjuge && pf && ESTADO_CIVIL_COM_REGIME.has(f.estado_civil);

  const set = (patch: Partial<ParticipanteForm>) => setF((p) => ({ ...p, ...patch }));
  const setC = (patch: Partial<ParticipanteForm>) => setConjuge((p) => ({ ...p, ...patch }));

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

    const c: ParticipanteForm | null = precisaConjuge
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
            Dados complementares obrigatórios para envio da proposta aos bancos.
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

/** Classe aplicada a um campo obrigatório vazio (destaque em vermelho). */
const CLASSE_ERRO = "border-destructive ring-1 ring-destructive/40 focus-visible:ring-destructive";

/** Conjunto de campos de um participante — reutilizado para titular e cônjuge. */
function CamposParticipante({
  f,
  set,
  erros,
  buscandoCep,
  onBuscarCep,
  mostrarQualificacao,
  mostrarEstadoCivil,
  mostrarIdentificacaoExtra,
}: {
  f: ParticipanteForm;
  set: (patch: Partial<ParticipanteForm>) => void;
  erros: Set<string>;
  buscandoCep: boolean;
  onBuscarCep: (cepMascarado: string) => void;
  mostrarQualificacao: boolean;
  mostrarEstadoCivil: boolean;
  mostrarIdentificacaoExtra: boolean;
}) {
  const pf = f.tipo_pessoa === "F";
  const err = (k: string) => erros.has(k);
  const cls = (k: string) => (err(k) ? CLASSE_ERRO : undefined);
  return (
    <>
      {/* Identificação */}
      <Secao titulo="Identificação">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {mostrarIdentificacaoExtra && (
            <SelSelect label="Situação" value={f.tipo_situacao} options={TIPO_SITUACAO} onChange={(v) => set({ tipo_situacao: v })} />
          )}
          {mostrarQualificacao && (
            <SelSelect label="Qualificação" value={f.tipo_qualificacao} options={TIPO_QUALIFICACAO} onChange={(v) => set({ tipo_qualificacao: v })} />
          )}
          {mostrarIdentificacaoExtra && (
            <SelSelect label="Tipo de pessoa" value={f.tipo_pessoa} options={TIPO_PESSOA} onChange={(v) => set({ tipo_pessoa: v })} />
          )}
          <Campo label={pf ? "Nome completo" : "Razão social"} className="sm:col-span-2" obrigatorio erro={err("nome")}>
            <Input value={f.nome} onChange={(e) => set({ nome: e.target.value })} className={cls("nome")} />
          </Campo>
          <Campo label="CPF/CNPJ" obrigatorio erro={err("cpf_cnpj")}>
            <Input value={f.cpf_cnpj} onChange={(e) => set({ cpf_cnpj: maskCpfCnpj(e.target.value) })} className={cls("cpf_cnpj")} />
          </Campo>
        </div>
      </Secao>

      {/* Dados pessoais (PF) */}
      {pf && (
        <Secao titulo="Dados pessoais">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label="Data de nascimento" obrigatorio erro={err("data_nascimento")}>
              <DateInput value={f.data_nascimento} onChange={(v) => set({ data_nascimento: v })} className={cls("data_nascimento")} />
            </Campo>
            <Campo label="Nome da mãe" obrigatorio erro={err("nome_mae")}>
              <Input value={f.nome_mae} onChange={(e) => set({ nome_mae: e.target.value })} className={cls("nome_mae")} />
            </Campo>
            <SelSelect label="Sexo" value={f.tipo_sexo} options={TIPO_SEXO} onChange={(v) => set({ tipo_sexo: v })} obrigatorio erro={err("tipo_sexo")} />
            {mostrarEstadoCivil && (
              <SelSelect label="Estado civil" value={f.estado_civil} options={TIPO_ESTADO_CIVIL} onChange={(v) => set({ estado_civil: v })} obrigatorio erro={err("estado_civil")} />
            )}
            {mostrarEstadoCivil && ESTADO_CIVIL_COM_REGIME.has(f.estado_civil) && (
              <SelSelect label="Regime de casamento" value={f.regime_casamento} options={TIPO_REGIME_CASAMENTO} onChange={(v) => set({ regime_casamento: v })} className="sm:col-span-2" />
            )}
          </div>
        </Secao>
      )}

      {/* Documento */}
      <Secao titulo="Documento de identidade">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelSelect label="Tipo de documento" value={f.tipo_documento_identidade} options={TIPO_DOCUMENTO_IDENTIDADE} onChange={(v) => set({ tipo_documento_identidade: v })} obrigatorio erro={err("tipo_documento_identidade")} />
          <Campo label="Número do documento" obrigatorio erro={err("numero_documento")}>
            <Input value={f.numero_documento} onChange={(e) => set({ numero_documento: e.target.value })} className={cls("numero_documento")} />
          </Campo>
          <Campo label="Órgão expedidor" obrigatorio erro={err("orgao_expedidor")}>
            <Input value={f.orgao_expedidor} onChange={(e) => set({ orgao_expedidor: e.target.value })} className={cls("orgao_expedidor")} />
          </Campo>
          <SelUf label="UF de expedição" value={f.uf_expedicao} onChange={(v) => set({ uf_expedicao: v })} obrigatorio erro={err("uf_expedicao")} />
          <Campo label="Data de expedição">
            <DateInput value={f.data_expedicao} onChange={(v) => set({ data_expedicao: v })} />
          </Campo>
        </div>
      </Secao>

      {/* Profissional / renda */}
      <Secao titulo="Profissional e renda">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Profissão" obrigatorio erro={err("profissao")}>
            <Input value={f.profissao} onChange={(e) => set({ profissao: e.target.value })} className={cls("profissao")} />
          </Campo>
          <Campo label="Empresa">
            <Input value={f.empresa} onChange={(e) => set({ empresa: e.target.value })} />
          </Campo>
          <Campo label="Renda" obrigatorio erro={err("renda")}>
            <CurrencyInput value={f.renda} onChange={(v) => set({ renda: v })} className={cls("renda")} />
          </Campo>
        </div>
      </Secao>

      {/* Contato */}
      <Secao titulo="Contato">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="E-mail" obrigatorio erro={err("email")}>
            <Input type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} className={cls("email")} />
          </Campo>
          <Campo label="Celular" obrigatorio erro={err("celular")}>
            <Input value={f.celular} onChange={(e) => set({ celular: maskCelular(e.target.value) })} placeholder="(00) 00000-0000" className={cls("celular")} />
          </Campo>
        </div>
      </Secao>

      {/* Endereço */}
      <Secao titulo="Endereço">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="CEP" obrigatorio erro={err("cep")}>
            <div className="relative">
              <Input
                value={f.cep}
                onChange={(e) => {
                  const m = mascararCep(e.target.value);
                  set({ cep: m });
                  if (m.replace(/\D/g, "").length === 8) onBuscarCep(m);
                }}
                onBlur={(e) => onBuscarCep(e.target.value)}
                className={cls("cep")}
              />
              {buscandoCep && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
          </Campo>
          <Campo label="Logradouro" obrigatorio erro={err("logradouro")}>
            <Input value={f.logradouro} onChange={(e) => set({ logradouro: e.target.value })} className={cls("logradouro")} />
          </Campo>
          <Campo label="Número" obrigatorio erro={err("numero_logradouro")}>
            <Input value={f.numero_logradouro} onChange={(e) => set({ numero_logradouro: e.target.value })} className={cls("numero_logradouro")} />
          </Campo>
          <Campo label="Complemento">
            <Input value={f.complemento} onChange={(e) => set({ complemento: e.target.value })} />
          </Campo>
          <Campo label="Bairro" obrigatorio erro={err("bairro")}>
            <Input value={f.bairro} onChange={(e) => set({ bairro: e.target.value })} className={cls("bairro")} />
          </Campo>
          <Campo label="Município" obrigatorio erro={err("municipio")}>
            <Input value={f.municipio} onChange={(e) => set({ municipio: e.target.value })} className={cls("municipio")} />
          </Campo>
          <SelUf label="UF" value={f.uf} onChange={(v) => set({ uf: v })} obrigatorio erro={err("uf")} />
        </div>
      </Secao>

      {/* FGTS / autorizações */}
      <Secao titulo="FGTS e autorizações">
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label className="cursor-pointer">Utiliza FGTS?</Label>
            <Switch checked={f.utiliza_fgts} onCheckedChange={(v) => set({ utiliza_fgts: v })} />
          </div>
          <label
            className={cn(
              "flex items-start gap-2 rounded-md border px-3 py-2",
              err("fg_autorizacao_dados") ? "border-destructive bg-destructive/5" : "border-border",
            )}
          >
            <Checkbox
              checked={f.fg_autorizacao_dados}
              onCheckedChange={(v) => set({ fg_autorizacao_dados: Boolean(v) })}
              className="mt-0.5"
            />
            <span className="text-sm text-muted-foreground">
              Autorizo a consulta e o tratamento dos meus dados para análise de crédito{" "}
              <span className="text-destructive">*</span> (obrigatório).
            </span>
          </label>
        </div>
      </Secao>
    </>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {titulo}
      </p>
      {children}
    </div>
  );
}

function Campo({
  label,
  className,
  obrigatorio,
  erro,
  children,
}: {
  label: string;
  className?: string;
  obrigatorio?: boolean;
  erro?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className={cn("mb-1 block text-xs", erro && "text-destructive")}>
        {label}
        {obrigatorio && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

function SelSelect({
  label,
  value,
  options,
  onChange,
  className,
  obrigatorio,
  erro,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  className?: string;
  obrigatorio?: boolean;
  erro?: boolean;
}) {
  return (
    <Campo label={label} className={className} obrigatorio={obrigatorio} erro={erro}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={erro ? CLASSE_ERRO : undefined}>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Campo>
  );
}

function SelUf({
  label,
  value,
  onChange,
  obrigatorio,
  erro,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  obrigatorio?: boolean;
  erro?: boolean;
}) {
  return (
    <Campo label={label} obrigatorio={obrigatorio} erro={erro}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={erro ? CLASSE_ERRO : undefined}>
          <SelectValue placeholder="UF" />
        </SelectTrigger>
        <SelectContent>
          {UFS.map((uf) => (
            <SelectItem key={uf} value={uf}>
              {uf}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Campo>
  );
}

