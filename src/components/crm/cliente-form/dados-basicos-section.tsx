import { useMemo } from "react";
import { IdCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/shared/date-input";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { TIPO_BANCO_SANTANDER } from "@/lib/simulacao/homefin.server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mascararTelefone, mascararDocumentoTipo } from "@/lib/crm/documento";
import {
  ESTADOS_CIVIS,
  REGIMES,
  OPCOES_UF,
  OPCOES_SEXO,
  OPCOES_NACIONALIDADE,
  OPCOES_TIPO_DOCUMENTO,
  OPCOES_ORGAO_EXPEDIDOR,
  OPCOES_NATURALIDADE,
  mascararMoedaBR,
  CLASSE_ERRO,
  type ClienteFormValues,
  type SetCampo,
} from "./constants";
import { cn } from "@/lib/utils";

export function DadosBasicosSection({
  v,
  set,
  setV,
  erros,
  idBanco,
}: {
  v: ClienteFormValues;
  set: SetCampo;
  setV: React.Dispatch<React.SetStateAction<ClienteFormValues>>;
  erros?: Set<string>;
  idBanco?: number;
}) {
  const cls = (k: string) => (erros?.has(k) ? CLASSE_ERRO : undefined);
  const clsBox = (k: string) => (erros?.has(k) ? "rounded-md ring-1 ring-destructive" : undefined);

  // Naturalidade é armazenada como "Cidade/UF"; aqui separamos em dois campos.
  const [natCidade, natUf] = useMemo(() => {
    const s = v.naturalidade || "";
    const i = s.lastIndexOf("/");
    if (i === -1) return [s, ""];
    return [s.slice(0, i), s.slice(i + 1)];
  }, [v.naturalidade]);

  // Cidades disponíveis para o estado selecionado.
  const cidadesDoEstado = useMemo(() => {
    if (!natUf) return [];
    const suf = `/${natUf}`;
    return OPCOES_NATURALIDADE.filter((m) => m.endsWith(suf)).map((m) =>
      m.slice(0, m.length - suf.length),
    );
  }, [natUf]);

  const setNatUf = (uf: string) => {
    // Ao trocar o estado, mantém a cidade apenas se pertencer ao novo estado.
    const cidadeValida = OPCOES_NATURALIDADE.includes(`${natCidade}/${uf}`);
    set("naturalidade", cidadeValida ? `${natCidade}/${uf}` : `/${uf}`);
  };
  const setNatCidade = (cidade: string) => {
    set("naturalidade", `${cidade}/${natUf}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <IdCard className="size-4 text-primary" /> Dados básicos
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {/* 1. Tipo de pessoa */}
        <div className="space-y-1.5">
          <Label>Tipo de pessoa</Label>
          <Select
            value={v.tipo_pessoa}
            onValueChange={(x) => {
              const tp = x as "PF" | "PJ";
              setV((prev) => ({
                ...prev,
                tipo_pessoa: tp,
                documento: mascararDocumentoTipo(prev.documento, tp),
              }));
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PF">Pessoa Física</SelectItem>
              <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 2. Nome */}
        <div className="space-y-1.5">
          <Label>{v.tipo_pessoa === "PF" ? "Nome completo *" : "Razão social *"}</Label>
          <Input
            value={v.nome}
            onChange={(e) => set("nome", e.target.value)}
            className={cls("nome")}
          />
        </div>

        {/* 3. CPF */}
        <div className="space-y-1.5">
          <Label>{v.tipo_pessoa === "PF" ? "CPF *" : "CNPJ *"}</Label>
          <Input
            value={v.documento}
            onChange={(e) => set("documento", mascararDocumentoTipo(e.target.value, v.tipo_pessoa))}
            inputMode="numeric"
            placeholder={v.tipo_pessoa === "PF" ? "000.000.000-00" : "00.000.000/0000-00"}
            className={cls("documento")}
          />
        </div>

        {/* 4. RG (nº do documento — não obrigatório) */}
        <div className="space-y-1.5">
          <Label>RG</Label>
          <Input
            value={v.documento_secundario}
            onChange={(e) => {
              set("documento_secundario", e.target.value);
              set("numero_documento", e.target.value);
            }}
            placeholder="Opcional"
          />
        </div>

        {/* 5. Data de nascimento */}
        <div className="space-y-1.5">
          <Label>{v.tipo_pessoa === "PF" ? "Data de nascimento *" : "Data de abertura *"}</Label>
          <DateInput
            value={v.data_nascimento}
            onChange={(val) => set("data_nascimento", val)}
            className={cls("data_nascimento")}
          />
        </div>

        {/* 6. Tipo de documento */}
        <div className="space-y-1.5">
          <Label>Tipo de documento</Label>
          <Combobox
            value={v.tipo_documento_identidade}
            onValueChange={(x) => set("tipo_documento_identidade", x)}
            options={OPCOES_TIPO_DOCUMENTO}
            placeholder="Selecione"
            searchPlaceholder="Buscar tipo…"
            className={clsBox("tipo_documento_identidade")}
          />
        </div>

        {/* 6b. Órgão expedidor, UF e data de expedição (referentes ao RG) */}
        <div className="space-y-1.5">
          <Label>Órgão expedidor</Label>
          <Combobox
            value={v.orgao_expedidor}
            onValueChange={(x) => set("orgao_expedidor", x)}
            options={OPCOES_ORGAO_EXPEDIDOR}
            placeholder="Selecione"
            searchPlaceholder="Buscar órgão…"
            className={clsBox("orgao_expedidor")}
          />
        </div>
        <div className="space-y-1.5">
          <Label>UF de expedição</Label>
          <Combobox
            value={v.uf_expedicao}
            onValueChange={(x) => set("uf_expedicao", x)}
            options={OPCOES_UF}
            placeholder="UF"
            searchPlaceholder="Buscar UF…"
            className={clsBox("uf_expedicao")}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Data de expedição</Label>
          <Input
            type="date"
            value={v.data_expedicao}
            onChange={(e) => set("data_expedicao", e.target.value)}
          />
        </div>

        {/* 7. Nome da mãe */}
        <div className="space-y-1.5">
          <Label>Nome da mãe {v.tipo_pessoa === "PF" && "*"}</Label>
          <Input
            value={v.mae}
            onChange={(e) => set("mae", e.target.value)}
            className={cls("mae")}
          />
        </div>

        {/* 8. Nome do pai */}
        <div className="space-y-1.5">
          <Label>Nome do pai</Label>
          <Input value={v.pai} onChange={(e) => set("pai", e.target.value)} />
        </div>

        {/* 9. Naturalidade — cidade e estado */}
        <div className="space-y-1.5">
          <Label>Naturalidade — estado</Label>
          <Combobox
            value={natUf}
            onValueChange={setNatUf}
            options={OPCOES_UF}
            placeholder="UF"
            searchPlaceholder="Buscar UF…"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Naturalidade — cidade</Label>
          <Combobox
            value={natCidade}
            onValueChange={setNatCidade}
            options={cidadesDoEstado}
            placeholder={natUf ? "Selecione a cidade" : "Selecione o estado primeiro"}
            searchPlaceholder="Buscar cidade…"
          />
        </div>

        {/* 10. Sexo */}
        <div className="space-y-1.5">
          <Label>Sexo</Label>
          <Select value={v.sexo || undefined} onValueChange={(x) => set("sexo", x)}>
            <SelectTrigger className={cls("sexo")}>
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
        </div>

        {/* 11. Nacionalidade */}
        <div className="space-y-1.5">
          <Label>Nacionalidade</Label>
          <Combobox
            value={v.nacionalidade}
            onValueChange={(x) => set("nacionalidade", x)}
            options={OPCOES_NACIONALIDADE}
            placeholder="Selecione"
            searchPlaceholder="Buscar nacionalidade…"
          />
        </div>

        {/* 12. Estado civil */}
        {v.tipo_pessoa === "PF" && (
          <div className="space-y-1.5">
            <Label>Estado civil *</Label>
            <Select value={v.estado_civil} onValueChange={(x) => set("estado_civil", x)}>
              <SelectTrigger className={cls("estado_civil")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS_CIVIS.map((o) => (
                  <SelectItem key={o.v} value={o.v}>
                    {o.l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {v.tipo_pessoa === "PF" &&
          (v.estado_civil === "casado" || v.estado_civil === "uniao_estavel") && (
            <div className="space-y-1.5">
              <Label>
                Regime de casamento{" "}
                {v.tipo_pessoa === "PF" &&
                  (v.estado_civil === "casado" || v.estado_civil === "uniao_estavel") &&
                  idBanco === TIPO_BANCO_SANTANDER &&
                  "*"}
              </Label>
              <Select value={v.regime_casamento} onValueChange={(x) => set("regime_casamento", x)}>
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
            </div>
          )}

        {/* 13. Contato */}
        <div className="space-y-1.5">
          <Label>E-mail *</Label>
          <Input
            type="email"
            value={v.email}
            onChange={(e) => set("email", e.target.value)}
            className={cls("email")}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Celular *</Label>
          <Input
            value={v.telefone_celular}
            onChange={(e) => set("telefone_celular", mascararTelefone(e.target.value))}
            inputMode="numeric"
            placeholder="(11) 99999-9999"
            className={cls("telefone_celular")}
          />
        </div>

        {/* 14. Renda + UF de interesse */}
        <div className="space-y-1.5">
          <Label>Renda total declarada (R$) *</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              R$
            </span>
            <Input
              inputMode="numeric"
              className={cn("pl-9", cls("renda_total_declarada"))}
              value={v.renda_total_declarada}
              onChange={(e) => set("renda_total_declarada", mascararMoedaBR(e.target.value))}
              placeholder="0,00"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>UF de interesse</Label>
          <Combobox
            value={v.uf_interesse}
            onValueChange={(x) => set("uf_interesse", x)}
            options={OPCOES_UF}
            placeholder="UF"
            searchPlaceholder="Buscar UF…"
          />
        </div>
      </CardContent>
    </Card>
  );
}
