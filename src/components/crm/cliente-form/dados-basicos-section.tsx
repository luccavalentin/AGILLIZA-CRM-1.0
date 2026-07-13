import { IdCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/shared/date-input";
import { Label } from "@/components/ui/label";
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
}: {
  v: ClienteFormValues;
  set: SetCampo;
  setV: React.Dispatch<React.SetStateAction<ClienteFormValues>>;
  erros?: Set<string>;
}) {
  const cls = (k: string) => (erros?.has(k) ? CLASSE_ERRO : undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <IdCard className="size-4 text-primary" /> Dados básicos
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
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
        <div className="space-y-1.5">
          <Label>{v.tipo_pessoa === "PF" ? "CPF *" : "CNPJ *"}</Label>
          <Input
            value={v.documento}
            onChange={(e) => set("documento", mascararDocumentoTipo(e.target.value, v.tipo_pessoa))}
            inputMode="numeric"
            placeholder={v.tipo_pessoa === "PF" ? "000.000.000-00" : "00.000.000/0000-00"}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>{v.tipo_pessoa === "PF" ? "Nome completo *" : "Razão social *"}</Label>
          <Input value={v.nome} onChange={(e) => set("nome", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{v.tipo_pessoa === "PF" ? "Data de nascimento *" : "Data de abertura *"}</Label>
          <DateInput
            value={v.data_nascimento}
            onChange={(val) => set("data_nascimento", val)}
          />
        </div>
        {v.tipo_pessoa === "PF" && (
          <div className="space-y-1.5">
            <Label>Estado civil *</Label>
            <Select value={v.estado_civil} onValueChange={(x) => set("estado_civil", x)}>
              <SelectTrigger>
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
              <Label>Regime de casamento</Label>
              <Select value={v.regime_casamento} onValueChange={(x) => set("regime_casamento", x)}>
                <SelectTrigger>
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
        <div className="space-y-1.5">
          <Label>Nome da mãe</Label>
          <Input value={v.mae} onChange={(e) => set("mae", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Nome do pai</Label>
          <Input value={v.pai} onChange={(e) => set("pai", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>E-mail *</Label>
          <Input type="email" value={v.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Celular *</Label>
          <Input
            value={v.telefone_celular}
            onChange={(e) => set("telefone_celular", mascararTelefone(e.target.value))}
            inputMode="numeric"
            placeholder="(11) 99999-9999"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Renda total declarada (R$) *</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              R$
            </span>
            <Input
              inputMode="numeric"
              className="pl-9"
              value={v.renda_total_declarada}
              onChange={(e) => set("renda_total_declarada", mascararMoedaBR(e.target.value))}
              placeholder="0,00"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>UF de interesse</Label>
          <Select value={v.uf_interesse} onValueChange={(x) => set("uf_interesse", x)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {OPCOES_UF.map((uf) => (
                <SelectItem key={uf} value={uf}>
                  {uf}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
