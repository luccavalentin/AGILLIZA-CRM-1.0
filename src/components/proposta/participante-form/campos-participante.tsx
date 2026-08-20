import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/shared/date-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/simulacao/currency-input";
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
import { maskCpfCnpj, maskCelular } from "@/lib/simulacao/format";
import { cn } from "@/lib/utils";
import { Campo, Secao, SelSelect, SelUf } from "./campos-atomos";
import { CLASSE_ERRO, mascararCep, type ParticipanteForm } from "./types";

/** Conjunto de campos de um participante — reutilizado para titular e cônjuge. */
export function CamposParticipante({
  f,
  set,
  erros,
  buscandoCep,
  onBuscarCep,
  mostrarQualificacao,
  mostrarEstadoCivil,
  mostrarIdentificacaoExtra,
  idBanco,
}: {
  f: ParticipanteForm;
  set: (patch: Partial<ParticipanteForm>) => void;
  erros: Set<string>;
  buscandoCep: boolean;
  onBuscarCep: (cepMascarado: string) => void;
  mostrarQualificacao: boolean;
  mostrarEstadoCivil: boolean;
  mostrarIdentificacaoExtra: boolean;
  idBanco?: number;
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
            <SelSelect
              label="Situação"
              value={f.tipo_situacao}
              options={TIPO_SITUACAO}
              onChange={(v) => set({ tipo_situacao: v })}
            />
          )}
          {mostrarQualificacao && (
            <SelSelect
              label="Qualificação"
              value={f.tipo_qualificacao}
              options={TIPO_QUALIFICACAO}
              onChange={(v) => set({ tipo_qualificacao: v })}
            />
          )}
          {mostrarIdentificacaoExtra && (
            <SelSelect
              label="Tipo de pessoa"
              value={f.tipo_pessoa}
              options={TIPO_PESSOA}
              onChange={(v) => set({ tipo_pessoa: v })}
            />
          )}
          <Campo
            label={pf ? "Nome completo" : "Razão social"}
            className="sm:col-span-2"
            obrigatorio
            erro={err("nome")}
          >
            <Input
              value={f.nome}
              onChange={(e) => set({ nome: e.target.value })}
              className={cls("nome")}
            />
          </Campo>
          <Campo label="CPF/CNPJ" obrigatorio erro={err("cpf_cnpj")}>
            <Input
              value={f.cpf_cnpj}
              onChange={(e) => set({ cpf_cnpj: maskCpfCnpj(e.target.value) })}
              className={cls("cpf_cnpj")}
            />
          </Campo>
        </div>
      </Secao>

      {/* Dados pessoais (PF) */}
      {pf && (
        <Secao titulo="Dados pessoais">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label="Data de nascimento" obrigatorio erro={err("data_nascimento")}>
              <DateInput
                value={f.data_nascimento}
                onChange={(v) => set({ data_nascimento: v })}
                className={cls("data_nascimento")}
              />
            </Campo>
            <Campo label="Nome da mãe" obrigatorio erro={err("nome_mae")}>
              <Input
                value={f.nome_mae}
                onChange={(e) => set({ nome_mae: e.target.value })}
                className={cls("nome_mae")}
              />
            </Campo>
            <SelSelect
              label="Sexo"
              value={f.tipo_sexo}
              options={TIPO_SEXO}
              onChange={(v) => set({ tipo_sexo: v })}
              obrigatorio
              erro={err("tipo_sexo")}
            />
            {mostrarEstadoCivil && (
              <SelSelect
                label="Estado civil"
                value={f.estado_civil}
                options={TIPO_ESTADO_CIVIL}
                onChange={(v) => set({ estado_civil: v })}
                obrigatorio
                erro={err("estado_civil")}
              />
            )}
            {mostrarEstadoCivil && ESTADO_CIVIL_COM_REGIME.has(f.estado_civil) && (
              <SelSelect
                label="Regime de casamento (recomendado)"
                value={f.regime_casamento}
                options={TIPO_REGIME_CASAMENTO}
                onChange={(v) => set({ regime_casamento: v })}
                className="sm:col-span-2"
                erro={err("regime_casamento")}
              />
            )}
          </div>
        </Secao>
      )}

      {/* Documento */}
      <Secao titulo="Documento de identidade">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelSelect
            label="Tipo de documento"
            value={f.tipo_documento_identidade}
            options={TIPO_DOCUMENTO_IDENTIDADE}
            onChange={(v) => set({ tipo_documento_identidade: v })}
            obrigatorio
            erro={err("tipo_documento_identidade")}
          />
          <Campo label="Número do documento" obrigatorio erro={err("numero_documento")}>
            <Input
              value={f.numero_documento}
              onChange={(e) => set({ numero_documento: e.target.value })}
              className={cls("numero_documento")}
            />
          </Campo>
          <Campo label="Órgão expedidor" obrigatorio erro={err("orgao_expedidor")}>
            <Input
              value={f.orgao_expedidor}
              onChange={(e) => set({ orgao_expedidor: e.target.value })}
              className={cls("orgao_expedidor")}
            />
          </Campo>
          <SelUf
            label="UF de expedição"
            value={f.uf_expedicao}
            onChange={(v) => set({ uf_expedicao: v })}
            obrigatorio
            erro={err("uf_expedicao")}
          />
          <Campo label="Data de expedição">
            <DateInput value={f.data_expedicao} onChange={(v) => set({ data_expedicao: v })} />
          </Campo>
        </div>
      </Secao>

      {/* Profissional / renda */}
      <Secao titulo="Profissional e renda">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Profissão" obrigatorio erro={err("profissao")}>
            <Input
              value={f.profissao}
              onChange={(e) => set({ profissao: e.target.value })}
              className={cls("profissao")}
            />
          </Campo>
          <Campo label="Empresa">
            <Input value={f.empresa} onChange={(e) => set({ empresa: e.target.value })} />
          </Campo>
          <Campo label="Renda" obrigatorio erro={err("renda")}>
            <CurrencyInput
              value={f.renda}
              onChange={(v) => set({ renda: v })}
              className={cls("renda")}
            />
          </Campo>
        </div>
      </Secao>

      {/* Contato */}
      <Secao titulo="Contato">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="E-mail" obrigatorio erro={err("email")}>
            <Input
              type="email"
              value={f.email}
              onChange={(e) => set({ email: e.target.value })}
              className={cls("email")}
            />
          </Campo>
          <Campo label="Celular" obrigatorio erro={err("celular")}>
            <Input
              value={f.celular}
              onChange={(e) => set({ celular: maskCelular(e.target.value) })}
              placeholder="(00) 00000-0000"
              className={cls("celular")}
            />
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
            <Input
              value={f.logradouro}
              onChange={(e) => set({ logradouro: e.target.value })}
              className={cls("logradouro")}
            />
          </Campo>
          <Campo label="Número" obrigatorio erro={err("numero_logradouro")}>
            <Input
              value={f.numero_logradouro}
              onChange={(e) => set({ numero_logradouro: e.target.value })}
              className={cls("numero_logradouro")}
            />
          </Campo>
          <Campo label="Complemento">
            <Input value={f.complemento} onChange={(e) => set({ complemento: e.target.value })} />
          </Campo>
          <Campo label="Bairro" obrigatorio erro={err("bairro")}>
            <Input
              value={f.bairro}
              onChange={(e) => set({ bairro: e.target.value })}
              className={cls("bairro")}
            />
          </Campo>
          <Campo label="Município" obrigatorio erro={err("municipio")}>
            <Input
              value={f.municipio}
              onChange={(e) => set({ municipio: e.target.value })}
              className={cls("municipio")}
            />
          </Campo>
          <SelUf
            label="UF"
            value={f.uf}
            onChange={(v) => set({ uf: v })}
            obrigatorio
            erro={err("uf")}
          />
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
