import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

function validar(f: ParticipanteForm): string | null {
  const pf = f.tipo_pessoa === "F";
  if (!f.nome.trim()) return "Informe o nome / razão social.";
  if (!apenasDigitos(f.cpf_cnpj)) return "Informe o CPF/CNPJ.";
  if (!validarCpfCnpj(f.cpf_cnpj)) return "CPF/CNPJ inválido.";
  if (pf) {
    if (!f.data_nascimento) return "Informe a data de nascimento.";
    if (!f.nome_mae.trim()) return "Informe o nome da mãe.";
    if (!f.tipo_sexo) return "Informe o sexo.";
    if (!f.estado_civil) return "Informe o estado civil.";
  }
  if (!f.tipo_documento_identidade) return "Informe o tipo de documento.";
  if (!f.numero_documento.trim()) return "Informe o número do documento.";
  if (!f.orgao_expedidor.trim()) return "Informe o órgão expedidor.";
  if (!f.uf_expedicao) return "Informe a UF de expedição.";
  if (!f.profissao.trim()) return "Informe a profissão.";
  if (!f.renda || f.renda <= 0) return "Informe a renda.";
  if (!f.email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim()))
    return "Informe um e-mail válido.";
  if (apenasDigitos(f.celular).length < 10) return "Informe um celular válido.";
  if (!apenasDigitos(f.cep)) return "Informe o CEP.";
  if (!f.logradouro.trim()) return "Informe o logradouro.";
  if (!f.numero_logradouro.trim()) return "Informe o número.";
  if (!f.bairro.trim()) return "Informe o bairro.";
  if (!f.municipio.trim()) return "Informe o município.";
  if (!f.uf) return "Informe a UF.";
  if (!f.fg_autorizacao_dados) return "É necessário a autorização de consulta de dados.";
  return null;
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
  tipoQualificacaoFixo,
  salvando,
  onSalvar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  titulo: string;
  inicial?: ParticipanteForm;
  tipoQualificacaoFixo?: string;
  salvando?: boolean;
  onSalvar: (dados: ReturnType<typeof formParaEnvolvido>) => Promise<void> | void;
}) {
  const [f, setF] = useState<ParticipanteForm>(inicial ?? VAZIO);
  const [buscandoCep, setBuscandoCep] = useState(false);

  useEffect(() => {
    if (open) {
      setF(inicial ?? { ...VAZIO, tipo_qualificacao: tipoQualificacaoFixo ?? "CO" });
    }
  }, [open, inicial, tipoQualificacaoFixo]);

  const pf = f.tipo_pessoa === "F";
  const set = (patch: Partial<ParticipanteForm>) => setF((p) => ({ ...p, ...patch }));

  async function buscarCep(cepRaw: string) {
    const cep = cepRaw.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setBuscandoCep(true);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const dados = await resp.json();
      if (dados?.erro) {
        toast.error("CEP não encontrado.");
        return;
      }
      set({
        logradouro: dados.logradouro || f.logradouro,
        bairro: dados.bairro || f.bairro,
        municipio: dados.localidade || f.municipio,
        uf: dados.uf || f.uf,
      });
    } catch {
      toast.error("Não foi possível consultar o CEP.");
    } finally {
      setBuscandoCep(false);
    }
  }

  async function submit() {
    const erro = validar(f);
    if (erro) {
      toast.error(erro);
      return;
    }
    await onSalvar(formParaEnvolvido(f));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            Dados complementares obrigatórios para envio da proposta aos bancos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Identificação */}
          <Secao titulo="Identificação">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SelSelect label="Situação" value={f.tipo_situacao} options={TIPO_SITUACAO} onChange={(v) => set({ tipo_situacao: v })} />
              {!tipoQualificacaoFixo && (
                <SelSelect label="Qualificação" value={f.tipo_qualificacao} options={TIPO_QUALIFICACAO} onChange={(v) => set({ tipo_qualificacao: v })} />
              )}
              <SelSelect label="Tipo de pessoa" value={f.tipo_pessoa} options={TIPO_PESSOA} onChange={(v) => set({ tipo_pessoa: v })} />
              <Campo label={pf ? "Nome completo" : "Razão social"} className="sm:col-span-2">
                <Input value={f.nome} onChange={(e) => set({ nome: e.target.value })} />
              </Campo>
              <Campo label="CPF/CNPJ">
                <Input value={f.cpf_cnpj} onChange={(e) => set({ cpf_cnpj: maskCpfCnpj(e.target.value) })} />
              </Campo>
            </div>
          </Secao>

          {/* Dados pessoais (PF) */}
          {pf && (
            <Secao titulo="Dados pessoais">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Campo label="Data de nascimento">
                  <Input type="date" value={f.data_nascimento} onChange={(e) => set({ data_nascimento: e.target.value })} />
                </Campo>
                <Campo label="Nome da mãe">
                  <Input value={f.nome_mae} onChange={(e) => set({ nome_mae: e.target.value })} />
                </Campo>
                <SelSelect label="Sexo" value={f.tipo_sexo} options={TIPO_SEXO} onChange={(v) => set({ tipo_sexo: v })} />
                <SelSelect label="Estado civil" value={f.estado_civil} options={TIPO_ESTADO_CIVIL} onChange={(v) => set({ estado_civil: v })} />
                {ESTADO_CIVIL_COM_REGIME.has(f.estado_civil) && (
                  <SelSelect label="Regime de casamento" value={f.regime_casamento} options={TIPO_REGIME_CASAMENTO} onChange={(v) => set({ regime_casamento: v })} className="sm:col-span-2" />
                )}
              </div>
            </Secao>
          )}

          {/* Documento */}
          <Secao titulo="Documento de identidade">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SelSelect label="Tipo de documento" value={f.tipo_documento_identidade} options={TIPO_DOCUMENTO_IDENTIDADE} onChange={(v) => set({ tipo_documento_identidade: v })} />
              <Campo label="Número do documento">
                <Input value={f.numero_documento} onChange={(e) => set({ numero_documento: e.target.value })} />
              </Campo>
              <Campo label="Órgão expedidor">
                <Input value={f.orgao_expedidor} onChange={(e) => set({ orgao_expedidor: e.target.value })} />
              </Campo>
              <SelUf label="UF de expedição" value={f.uf_expedicao} onChange={(v) => set({ uf_expedicao: v })} />
              <Campo label="Data de expedição">
                <Input type="date" value={f.data_expedicao} onChange={(e) => set({ data_expedicao: e.target.value })} />
              </Campo>
            </div>
          </Secao>

          {/* Profissional / renda */}
          <Secao titulo="Profissional e renda">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="Profissão">
                <Input value={f.profissao} onChange={(e) => set({ profissao: e.target.value })} />
              </Campo>
              <Campo label="Empresa">
                <Input value={f.empresa} onChange={(e) => set({ empresa: e.target.value })} />
              </Campo>
              <Campo label="Renda">
                <CurrencyInput value={f.renda} onChange={(v) => set({ renda: v })} />
              </Campo>
            </div>
          </Secao>

          {/* Contato */}
          <Secao titulo="Contato">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="E-mail">
                <Input type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} />
              </Campo>
              <Campo label="Celular">
                <Input value={f.celular} onChange={(e) => set({ celular: maskCelular(e.target.value) })} placeholder="(00) 00000-0000" />
              </Campo>
            </div>
          </Secao>

          {/* Endereço */}
          <Secao titulo="Endereço">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="CEP">
                <div className="relative">
                  <Input
                    value={f.cep}
                    onChange={(e) => {
                      const m = mascararCep(e.target.value);
                      set({ cep: m });
                      if (m.replace(/\D/g, "").length === 8) buscarCep(m);
                    }}
                    onBlur={(e) => buscarCep(e.target.value)}
                  />
                  {buscandoCep && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                </div>
              </Campo>
              <Campo label="Logradouro">
                <Input value={f.logradouro} onChange={(e) => set({ logradouro: e.target.value })} />
              </Campo>
              <Campo label="Número">
                <Input value={f.numero_logradouro} onChange={(e) => set({ numero_logradouro: e.target.value })} />
              </Campo>
              <Campo label="Complemento">
                <Input value={f.complemento} onChange={(e) => set({ complemento: e.target.value })} />
              </Campo>
              <Campo label="Bairro">
                <Input value={f.bairro} onChange={(e) => set({ bairro: e.target.value })} />
              </Campo>
              <Campo label="Município">
                <Input value={f.municipio} onChange={(e) => set({ municipio: e.target.value })} />
              </Campo>
              <SelUf label="UF" value={f.uf} onChange={(v) => set({ uf: v })} />
            </div>
          </Secao>

          {/* FGTS / autorizações */}
          <Secao titulo="FGTS e autorizações">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <Label className="cursor-pointer">Utiliza FGTS?</Label>
                <Switch checked={f.utiliza_fgts} onCheckedChange={(v) => set({ utiliza_fgts: v })} />
              </div>
              <label className="flex items-start gap-2 rounded-md border border-border px-3 py-2">
                <Checkbox
                  checked={f.fg_autorizacao_dados}
                  onCheckedChange={(v) => set({ fg_autorizacao_dados: Boolean(v) })}
                  className="mt-0.5"
                />
                <span className="text-sm text-muted-foreground">
                  Autorizo a consulta e o tratamento dos meus dados para análise de crédito
                  (obrigatório).
                </span>
              </label>
            </div>
          </Secao>
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
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-xs">{label}</Label>
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
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <Campo label={label} className={className}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Campo label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
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
