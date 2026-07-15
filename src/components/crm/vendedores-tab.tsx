import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, User, Landmark, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import {
  listarVendedores,
  salvarVendedor,
  removerVendedor,
} from "@/lib/crm/clientes.functions";
import {
  mascararDocumentoTipo,
  mascararTelefone,
  validarDocumento,
  validarEmail,
  validarTelefone,
} from "@/lib/crm/documento";
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
} from "./cliente-form/constants";

interface VendedorForm {
  id?: string;
  tipo_pessoa: "PF" | "PJ";
  nome: string;
  documento: string;
  documento_secundario: string;
  data_nascimento: string;
  estado_civil: string;
  regime_casamento: string;
  mae: string;
  pai: string;
  sexo: string;
  nacionalidade: string;
  naturalidade: string;
  tipo_documento_identidade: string;
  numero_documento: string;
  orgao_expedidor: string;
  uf_expedicao: string;
  data_expedicao: string;
  profissao: string;
  empresa: string;
  banco_conta: string;
  agencia: string;
  conta_corrente: string;
  digito_conta: string;
  conjuge_banco_conta: string;
  conjuge_agencia: string;
  conjuge_conta_corrente: string;
  conjuge_digito_conta: string;
  email: string;
  telefone_celular: string;
  renda_total_declarada: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  utiliza_fgts: boolean;
  fg_autorizacao_dados: boolean;
}

const VAZIO: VendedorForm = {
  tipo_pessoa: "PF",
  nome: "",
  documento: "",
  documento_secundario: "",
  data_nascimento: "",
  estado_civil: "",
  regime_casamento: "",
  mae: "",
  pai: "",
  sexo: "",
  nacionalidade: "Brasileira",
  naturalidade: "",
  tipo_documento_identidade: "",
  numero_documento: "",
  orgao_expedidor: "",
  uf_expedicao: "",
  data_expedicao: "",
  profissao: "",
  empresa: "",
  banco_conta: "",
  agencia: "",
  conta_corrente: "",
  digito_conta: "",
  conjuge_banco_conta: "",
  conjuge_agencia: "",
  conjuge_conta_corrente: "",
  conjuge_digito_conta: "",
  email: "",
  telefone_celular: "",
  renda_total_declarada: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  utiliza_fgts: false,
  fg_autorizacao_dados: false,
};

function paraForm(v: any): VendedorForm {
  return {
    ...VAZIO,
    ...Object.fromEntries(Object.entries(v).map(([k, val]) => [k, val ?? ""])),
    id: v.id,
    tipo_pessoa: v.tipo_pessoa === "PJ" ? "PJ" : "PF",
    documento: mascararDocumentoTipo(v.documento ?? "", v.tipo_pessoa === "PJ" ? "PJ" : "PF"),
    telefone_celular: mascararTelefone(v.telefone_celular ?? ""),
    cep: mascararCep(v.cep ?? ""),
    renda_total_declarada:
      v.renda_total_declarada != null && v.renda_total_declarada !== ""
        ? mascararMoedaBR(String(Math.round(Number(v.renda_total_declarada) * 100)))
        : "",
    utiliza_fgts: Boolean(v.utiliza_fgts),
    fg_autorizacao_dados: Boolean(v.fg_autorizacao_dados),
  };
}

export function VendedoresTab({ clienteId }: { clienteId: string }) {
  const qc = useQueryClient();
  const listar = useServerFn(listarVendedores);
  const salvar = useServerFn(salvarVendedor);
  const remover = useServerFn(removerVendedor);

  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<VendedorForm>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erros, setErros] = useState<Set<string>>(new Set());

  const [natCidade, natUf] = useMemo(() => {
    const s = form.naturalidade || "";
    const i = s.lastIndexOf("/");
    if (i === -1) return [s, ""];
    return [s.slice(0, i), s.slice(i + 1)];
  }, [form.naturalidade]);
  const cidadesDoEstado = useMemo(
    () =>
      natUf
        ? OPCOES_NATURALIDADE.filter((m) => m.endsWith(`/${natUf}`)).map((m) =>
            m.slice(0, -3),
          )
        : [],
    [natUf],
  );
  function setNatUf(uf: string) {
    setForm((f) => ({ ...f, naturalidade: uf ? `/${uf}` : "" }));
  }
  function setNatCidade(cidade: string) {
    setForm((f) => ({
      ...f,
      naturalidade: cidade && natUf ? `${cidade}/${natUf}` : cidade,
    }));
  }

  async function buscarCep(cepRaw: string) {
    const cep = cepRaw.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setBuscandoCep(true);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await resp.json();
      if (data.erro) {
        toast.error("CEP não encontrado.");
        return;
      }
      setForm((f) => ({
        ...f,
        logradouro: data.logradouro || f.logradouro,
        bairro: data.bairro || f.bairro,
        cidade: data.localidade || f.cidade,
        uf: data.uf || f.uf,
      }));
    } catch {
      toast.error("Não foi possível consultar o CEP.");
    } finally {
      setBuscandoCep(false);
    }
  }

  const { data: vendedores, isLoading } = useQuery({
    queryKey: ["cliente-vendedores", clienteId],
    queryFn: () => listar({ data: { cliente_id: clienteId } }),
  });

  const set = (p: Partial<VendedorForm>) => setForm((f) => ({ ...f, ...p }));
  const cls = (k: string) => (erros.has(k) ? CLASSE_ERRO : undefined);
  const clsBox = (k: string) =>
    erros.has(k) ? "rounded-md ring-1 ring-destructive" : undefined;

  function novo() {
    setForm(VAZIO);
    setErros(new Set());
    setAberto(true);
  }
  function editar(v: any) {
    setForm(paraForm(v));
    setErros(new Set());
    setAberto(true);
  }

  async function submeter() {
    const e = new Set<string>();
    if (!form.nome.trim()) e.add("nome");
    if (form.documento && !validarDocumento(form.documento, form.tipo_pessoa))
      e.add("documento");
    if (form.email && !validarEmail(form.email)) e.add("email");
    if (form.telefone_celular && !validarTelefone(form.telefone_celular))
      e.add("telefone_celular");
    setErros(e);
    if (e.size > 0) {
      const primeiro = e.has("nome")
        ? "Informe o nome do vendedor."
        : e.has("documento")
          ? `${form.tipo_pessoa === "PJ" ? "CNPJ" : "CPF"} inválido.`
          : e.has("email")
            ? "E-mail inválido."
            : "Telefone inválido.";
      toast.error(primeiro);
      return;
    }
    setSalvando(true);
    try {
      await salvar({ data: { ...form, cliente_id: clienteId } as any });
      toast.success("Vendedor salvo.");
      setAberto(false);
      qc.invalidateQueries({ queryKey: ["cliente-vendedores", clienteId] });
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível salvar o vendedor.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id: string) {
    try {
      await remover({ data: { id } });
      toast.success("Vendedor removido.");
      qc.invalidateQueries({ queryKey: ["cliente-vendedores", clienteId] });
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível remover.");
    }
  }

  const pf = form.tipo_pessoa === "PF";
  const casado =
    form.estado_civil === "casado" || form.estado_civil === "uniao_estavel";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Cadastre os vendedores do imóvel.
        </p>

        <Button size="sm" onClick={novo}>
          <Plus className="mr-1 size-4" /> Adicionar vendedor
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (vendedores?.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          Nenhum vendedor cadastrado para este imóvel.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {vendedores!.map((v: any) => (
            <Card key={v.id}>
              <CardHeader className="flex-row items-start justify-between gap-2 pb-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <User className="size-4" />
                  </span>
                  <div>
                    <CardTitle className="text-sm">{v.nome}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {v.tipo_pessoa === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}
                      {v.documento ? ` · ${v.documento}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => editar(v)}>
                    <Pencil className="size-4" />
                  </Button>
                  <ConfirmDelete
                    onConfirm={() => excluir(v.id)}
                    trigger={
                      <Button variant="ghost" size="icon" className="size-8 text-destructive">
                        <Trash2 className="size-4" />
                      </Button>
                    }
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-muted-foreground">
                {v.email && <p>{v.email}</p>}
                {v.telefone_celular && <p>{v.telefone_celular}</p>}
                {(v.agencia || v.conta_corrente) && (
                  <p className="flex items-center gap-1">
                    <Landmark className="size-3" /> Ag. {v.agencia ?? "—"} · CC {v.conta_corrente ?? "—"}
                    {v.digito_conta ? `-${v.digito_conta}` : ""}
                  </p>
                )}
                {(v.cidade || v.uf) && (
                  <p className="flex items-center gap-1">
                    <MapPin className="size-3" /> {[v.cidade, v.uf].filter(Boolean).join(" / ")}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {OPCOES_SEXO.map((o) => (
                          <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Campo>
                  <Campo label="Estado civil">
                    <Select value={form.estado_civil} onValueChange={(v) => set({ estado_civil: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {ESTADOS_CIVIS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Campo>
                  {casado && (
                    <Campo label="Regime de casamento">
                      <Select value={form.regime_casamento} onValueChange={(v) => set({ regime_casamento: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {REGIMES.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
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
                    <Input value={form.profissao} onChange={(e) => set({ profissao: e.target.value })} />
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
                  <Input value={form.numero_documento} onChange={(e) => set({ numero_documento: e.target.value })} />
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
                <Input value={form.conta_corrente} onChange={(e) => set({ conta_corrente: e.target.value })} />
              </Campo>
              <Campo label="Dígito">
                <Input value={form.digito_conta} onChange={(e) => set({ digito_conta: e.target.value })} />
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
                  <Input value={form.conjuge_agencia} onChange={(e) => set({ conjuge_agencia: e.target.value })} />
                </Campo>
                <Campo label="Conta corrente">
                  <Input value={form.conjuge_conta_corrente} onChange={(e) => set({ conjuge_conta_corrente: e.target.value })} />
                </Campo>
                <Campo label="Dígito">
                  <Input value={form.conjuge_digito_conta} onChange={(e) => set({ conjuge_digito_conta: e.target.value })} />
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
                <Input value={form.logradouro} onChange={(e) => set({ logradouro: e.target.value })} />
              </Campo>
              <Campo label="Número">
                <Input value={form.numero} onChange={(e) => set({ numero: e.target.value })} />
              </Campo>
              <Campo label="Complemento">
                <Input value={form.complemento} onChange={(e) => set({ complemento: e.target.value })} />
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
                <Switch checked={form.utiliza_fgts} onCheckedChange={(v) => set({ utiliza_fgts: v })} />
                Utiliza FGTS
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.fg_autorizacao_dados} onCheckedChange={(v) => set({ fg_autorizacao_dados: v })} />
                Autoriza uso de dados
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={submeter} disabled={salvando}>
              {salvando && <Loader2 className="mr-1 size-4 animate-spin" />}
              Salvar vendedor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground">{titulo}</h4>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Campo({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
