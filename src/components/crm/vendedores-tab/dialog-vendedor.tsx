import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Combobox } from "@/components/ui/combobox";
import { DateInput } from "@/components/shared/date-input";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { mascararDocumentoTipo, mascararTelefone } from "@/lib/crm/documento";
import {
  ESTADOS_CIVIS,
  REGIMES,
  OPCOES_UF,
  OPCOES_SEXO,
  OPCOES_NACIONALIDADE,
  OPCOES_NATURALIDADE,
  OPCOES_TIPO_DOCUMENTO,
  OPCOES_ORGAO_EXPEDIDOR,
  OPCOES_BANCO,
  mascararMoedaBR,
  mascararCep,
  CLASSE_ERRO,
} from "../cliente-form/constants";
import { Campo, Secao } from "./ui";
import type { VendedorForm } from "./types";

export function DialogVendedor({
  aberto,
  onOpenChange,
  form,
  setForm,
  erros,
  buscandoCep,
  buscarCep,
  salvando,
  onSubmeter,
  idBanco,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  form: VendedorForm;
  setForm: React.Dispatch<React.SetStateAction<VendedorForm>>;
  erros: Set<string>;
  buscandoCep: boolean;
  buscarCep: (cepRaw: string) => void;
  salvando: boolean;
  onSubmeter: () => void;
  idBanco?: number;
}) {
  const pf = form.tipo_pessoa === "PF";
  const casado = form.estado_civil === "casado" || form.estado_civil === "uniao_estavel";
  const set = (p: Partial<VendedorForm>) => setForm((f) => ({ ...f, ...p }));
  const cls = (k: string) => (erros.has(k) ? CLASSE_ERRO : undefined);
  const clsBox = (k: string) => (erros.has(k) ? "rounded-md ring-1 ring-destructive" : undefined);

  const [natCidade, natUf] = useMemo(() => {
    const s = form.naturalidade || "";
    const i = s.lastIndexOf("/");
    if (i === -1) return [s, ""];
    return [s.slice(0, i), s.slice(i + 1)];
  }, [form.naturalidade]);
  const cidadesDoEstado = useMemo(
    () =>
      natUf
        ? OPCOES_NATURALIDADE.filter((m) => m.endsWith(`/${natUf}`)).map((m) => m.slice(0, -3))
        : [],
    [natUf],
  );
  const setNatUf = (uf: string) => setForm((f) => ({ ...f, naturalidade: uf ? `/${uf}` : "" }));
  const setNatCidade = (cidade: string) =>
    setForm((f) => ({
      ...f,
      naturalidade: cidade && natUf ? `${cidade}/${natUf}` : cidade,
    }));

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar vendedor" : "Novo vendedor"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <Secao titulo="Dados do vendedor">
            <Campo label="Tipo de pessoa">
              <Select
                value={form.tipo_pessoa}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    tipo_pessoa: v as "PF" | "PJ",
                    documento: mascararDocumentoTipo(f.documento, v as "PF" | "PJ"),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PF">Pessoa Física</SelectItem>
                  <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                </SelectContent>
              </Select>
            </Campo>
            <Campo label={pf ? "Nome completo *" : "Razão social *"} full>
              <Input
                value={form.nome}
                onChange={(e) => set({ nome: e.target.value })}
                className={cls("nome")}
              />
            </Campo>
            <Campo label={pf ? "CPF" : "CNPJ"}>
              <Input
                value={form.documento}
                inputMode="numeric"
                placeholder={pf ? "000.000.000-00" : "00.000.000/0000-00"}
                onChange={(e) =>
                  set({ documento: mascararDocumentoTipo(e.target.value, form.tipo_pessoa) })
                }
                className={cls("documento")}
              />
            </Campo>
            <Campo label={pf ? "RG (nº)" : "Inscrição estadual"}>
              <Input
                value={form.documento_secundario}
                onChange={(e) => set({ documento_secundario: e.target.value })}
              />
            </Campo>
            {pf && (
              <>
                <Campo label="Nascimento">
                  <DateInput
                    value={form.data_nascimento}
                    onChange={(v) => set({ data_nascimento: v })}
                  />
                </Campo>
                <Campo label="Sexo">
                  <Select value={form.sexo || undefined} onValueChange={(v) => set({ sexo: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {OPCOES_SEXO.map((o) => (
                        <SelectItem key={o.v} value={o.v}>
                          {o.l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Campo>
                <Campo label="Estado civil">
                  <Select value={form.estado_civil} onValueChange={(v) => set({ estado_civil: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS_CIVIS.map((o) => (
                        <SelectItem key={o.v} value={o.v}>
                          {o.l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Campo>
                {casado && (
                  <Campo label={`Regime de casamento ${idBanco === 33 ? "*" : ""}`}>
                    <Select
                      value={form.regime_casamento}
                      onValueChange={(v) => set({ regime_casamento: v })}
                    >
                      <SelectTrigger className={cls("regime_casamento")}>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>

                      <SelectContent>
                        {REGIMES.map((o) => (
                          <SelectItem key={o.v} value={o.v}>
                            {o.l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Campo>
                )}
                <Campo label="Nome da mãe">
                  <Input value={form.mae} onChange={(e) => set({ mae: e.target.value })} />
                </Campo>
                <Campo label="Nome do pai">
                  <Input value={form.pai} onChange={(e) => set({ pai: e.target.value })} />
                </Campo>
                <Campo label="Nacionalidade">
                  <Combobox
                    value={form.nacionalidade}
                    onValueChange={(x) => set({ nacionalidade: x })}
                    options={OPCOES_NACIONALIDADE}
                    placeholder="Selecione"
                    searchPlaceholder="Buscar nacionalidade…"
                  />
                </Campo>
                <Campo label="Naturalidade — estado">
                  <Combobox
                    value={natUf}
                    onValueChange={setNatUf}
                    options={OPCOES_UF}
                    placeholder="UF"
                    searchPlaceholder="Buscar UF…"
                  />
                </Campo>
                <Campo label="Naturalidade — cidade">
                  <Combobox
                    value={natCidade}
                    onValueChange={setNatCidade}
                    options={cidadesDoEstado}
                    placeholder={natUf ? "Selecione a cidade" : "Selecione o estado primeiro"}
                    searchPlaceholder="Buscar cidade…"
                  />
                </Campo>
                <Campo label="Profissão">
                  <Input
                    value={form.profissao}
                    onChange={(e) => set({ profissao: e.target.value })}
                  />
                </Campo>
                <Campo label="Empresa">
                  <Input value={form.empresa} onChange={(e) => set({ empresa: e.target.value })} />
                </Campo>
              </>
            )}
            <Campo label="Renda declarada">
              <Input
                value={form.renda_total_declarada}
                inputMode="numeric"
                placeholder="0,00"
                onChange={(e) => set({ renda_total_declarada: mascararMoedaBR(e.target.value) })}
              />
            </Campo>
            <Campo label="E-mail">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
                className={cls("email")}
              />
            </Campo>
            <Campo label="Celular">
              <Input
                value={form.telefone_celular}
                inputMode="tel"
                placeholder="(00) 00000-0000"
                onChange={(e) => set({ telefone_celular: mascararTelefone(e.target.value) })}
                className={cls("telefone_celular")}
              />
            </Campo>
          </Secao>

          {pf && (
            <Secao titulo="Documento de identidade">
              <Campo label="Tipo">
                <Combobox
                  value={form.tipo_documento_identidade}
                  onValueChange={(x) => set({ tipo_documento_identidade: x })}
                  options={OPCOES_TIPO_DOCUMENTO}
                  placeholder="Selecione"
                  searchPlaceholder="Buscar tipo…"
                  className={clsBox("tipo_documento_identidade")}
                />
              </Campo>
              <Campo label="Número">
                <Input
                  value={form.numero_documento}
                  onChange={(e) => set({ numero_documento: e.target.value })}
                />
              </Campo>
              <Campo label="Órgão expedidor">
                <Combobox
                  value={form.orgao_expedidor}
                  onValueChange={(x) => set({ orgao_expedidor: x })}
                  options={OPCOES_ORGAO_EXPEDIDOR}
                  placeholder="Selecione"
                  searchPlaceholder="Buscar órgão…"
                />
              </Campo>
              <Campo label="UF expedição">
                <Combobox
                  value={form.uf_expedicao}
                  onValueChange={(x) => set({ uf_expedicao: x })}
                  options={OPCOES_UF}
                  placeholder="UF"
                  searchPlaceholder="Buscar UF…"
                />
              </Campo>
              <Campo label="Data expedição">
                <DateInput
                  value={form.data_expedicao}
                  onChange={(v) => set({ data_expedicao: v })}
                />
              </Campo>
            </Secao>
          )}

          <Secao titulo="Conta bancária">
            <Campo label="Banco" full>
              <Combobox
                value={form.banco_conta}
                onValueChange={(x) => set({ banco_conta: x })}
                options={OPCOES_BANCO}
                placeholder="Selecione o banco"
                searchPlaceholder="Buscar banco…"
              />
            </Campo>
            <Campo label="Agência">
              <Input value={form.agencia} onChange={(e) => set({ agencia: e.target.value })} />
            </Campo>
            <Campo label="Conta corrente">
              <Input
                value={form.conta_corrente}
                onChange={(e) => set({ conta_corrente: e.target.value })}
              />
            </Campo>
            <Campo label="Dígito">
              <Input
                value={form.digito_conta}
                onChange={(e) => set({ digito_conta: e.target.value })}
              />
            </Campo>
          </Secao>

          {casado && (
            <Secao titulo="Conta bancária do cônjuge (opcional)">
              <Campo label="Banco" full>
                <Combobox
                  value={form.conjuge_banco_conta}
                  onValueChange={(x) => set({ conjuge_banco_conta: x })}
                  options={OPCOES_BANCO}
                  placeholder="Selecione o banco"
                  searchPlaceholder="Buscar banco…"
                />
              </Campo>
              <Campo label="Agência">
                <Input
                  value={form.conjuge_agencia}
                  onChange={(e) => set({ conjuge_agencia: e.target.value })}
                />
              </Campo>
              <Campo label="Conta corrente">
                <Input
                  value={form.conjuge_conta_corrente}
                  onChange={(e) => set({ conjuge_conta_corrente: e.target.value })}
                />
              </Campo>
              <Campo label="Dígito">
                <Input
                  value={form.conjuge_digito_conta}
                  onChange={(e) => set({ conjuge_digito_conta: e.target.value })}
                />
              </Campo>
            </Secao>
          )}

          <Secao titulo="Endereço">
            <Campo label="CEP">
              <div className="relative">
                <Input
                  value={form.cep}
                  inputMode="numeric"
                  placeholder="00000-000"
                  onChange={(e) => {
                    const m = mascararCep(e.target.value);
                    set({ cep: m });
                    if (m.replace(/\D/g, "").length === 8) buscarCep(m);
                  }}
                  onBlur={(e) => buscarCep(e.target.value)}
                />
                {buscandoCep && (
                  <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </Campo>
            <Campo label="Logradouro" full>
              <Input
                value={form.logradouro}
                onChange={(e) => set({ logradouro: e.target.value })}
              />
            </Campo>
            <Campo label="Número">
              <Input value={form.numero} onChange={(e) => set({ numero: e.target.value })} />
            </Campo>
            <Campo label="Complemento">
              <Input
                value={form.complemento}
                onChange={(e) => set({ complemento: e.target.value })}
              />
            </Campo>
            <Campo label="Bairro">
              <Input value={form.bairro} onChange={(e) => set({ bairro: e.target.value })} />
            </Campo>
            <Campo label="Cidade">
              <Input value={form.cidade} onChange={(e) => set({ cidade: e.target.value })} />
            </Campo>
            <Campo label="UF">
              <Combobox
                value={form.uf}
                onValueChange={(x) => set({ uf: x })}
                options={OPCOES_UF}
                placeholder="UF"
                searchPlaceholder="Buscar UF…"
              />
            </Campo>
          </Secao>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.utiliza_fgts}
                onCheckedChange={(v) => set({ utiliza_fgts: v })}
              />
              Utiliza FGTS
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.fg_autorizacao_dados}
                onCheckedChange={(v) => set({ fg_autorizacao_dados: v })}
              />
              Autoriza uso de dados
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={onSubmeter} disabled={salvando}>
            {salvando && <Loader2 className="mr-1 size-4 animate-spin" />}
            Salvar vendedor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
