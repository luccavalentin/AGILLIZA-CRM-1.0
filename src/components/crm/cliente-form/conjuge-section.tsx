import { Heart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
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
import { mascararTelefone, mascararCPF } from "@/lib/crm/documento";
import {
  OPCOES_SEXO,
  OPCOES_NACIONALIDADE,
  OPCOES_TIPO_DOCUMENTO,
  OPCOES_ORGAO_EXPEDIDOR,
  OPCOES_UF,
  mascararMoedaBR,
  type ClienteFormValues,
  type SetCampo,
} from "./constants";

export function ConjugeSection({ v, set }: { v: ClienteFormValues; set: SetCampo }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Heart className="size-4 text-primary" /> Dados do cônjuge
        </CardTitle>

        <p className="text-sm text-muted-foreground">
          Exigidos pelos bancos quando o proponente é casado ou vive em união estável.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {/* 1. Nome completo */}
        <div className="space-y-1.5">
          <Label>Nome completo do cônjuge *</Label>
          <Input value={v.conjuge_nome} onChange={(e) => set("conjuge_nome", e.target.value)} />
        </div>

        {/* 2. CPF */}
        <div className="space-y-1.5">
          <Label>CPF do cônjuge</Label>
          <Input
            value={v.conjuge_cpf}
            onChange={(e) => set("conjuge_cpf", mascararCPF(e.target.value))}
            inputMode="numeric"
            placeholder="000.000.000-00"
          />
        </div>

        {/* 3. Número do documento (RG) */}
        <div className="space-y-1.5">
          <Label>Número do documento</Label>
          <Input
            value={v.conjuge_numero_documento}
            onChange={(e) => set("conjuge_numero_documento", e.target.value)}
          />
        </div>

        {/* 4. Data de nascimento */}
        <div className="space-y-1.5">
          <Label>Data de nascimento</Label>
          <DateInput
            value={v.conjuge_data_nascimento}
            onChange={(val) => set("conjuge_data_nascimento", val)}
          />
        </div>

        {/* 5. Tipo de documento */}
        <div className="space-y-1.5">
          <Label>Tipo de documento</Label>
          <Combobox
            value={v.conjuge_tipo_documento_identidade}
            onValueChange={(x) => set("conjuge_tipo_documento_identidade", x)}
            options={OPCOES_TIPO_DOCUMENTO}
            placeholder="Selecione"
            searchPlaceholder="Buscar tipo…"
          />
        </div>

        {/* 6. Órgão expedidor */}
        <div className="space-y-1.5">
          <Label>Órgão expedidor</Label>
          <Combobox
            value={v.conjuge_orgao_expedidor}
            onValueChange={(x) => set("conjuge_orgao_expedidor", x)}
            options={OPCOES_ORGAO_EXPEDIDOR}
            placeholder="Selecione"
            searchPlaceholder="Buscar órgão…"
          />
        </div>

        {/* 7. UF de expedição */}
        <div className="space-y-1.5">
          <Label>UF de expedição</Label>
          <Select
            value={v.conjuge_uf_expedicao}
            onValueChange={(x) => set("conjuge_uf_expedicao", x)}
          >
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

        {/* 8. Data de expedição */}
        <div className="space-y-1.5">
          <Label>Data de expedição</Label>
          <Input
            type="date"
            value={v.conjuge_data_expedicao}
            onChange={(e) => set("conjuge_data_expedicao", e.target.value)}
          />
        </div>

        {/* 9. Nome da mãe */}
        <div className="space-y-1.5">
          <Label>Nome da mãe do cônjuge</Label>
          <Input
            value={v.conjuge_nome_mae}
            onChange={(e) => set("conjuge_nome_mae", e.target.value)}
          />
        </div>

        {/* 10. Sexo */}
        <div className="space-y-1.5">
          <Label>Sexo</Label>
          <Select value={v.conjuge_sexo || undefined} onValueChange={(x) => set("conjuge_sexo", x)}>
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
        </div>

        {/* 11. Nacionalidade */}
        <div className="space-y-1.5">
          <Label>Nacionalidade</Label>
          <Combobox
            value={v.conjuge_nacionalidade}
            onValueChange={(x) => set("conjuge_nacionalidade", x)}
            options={OPCOES_NACIONALIDADE}
            placeholder="Selecione"
            searchPlaceholder="Buscar nacionalidade…"
          />
        </div>

        {/* 12. Profissão */}
        <div className="space-y-1.5">
          <Label>Profissão</Label>
          <Input
            value={v.conjuge_profissao}
            onChange={(e) => set("conjuge_profissao", e.target.value)}
          />
        </div>

        {/* 13. Empresa */}
        <div className="space-y-1.5">
          <Label>Empresa</Label>
          <Input
            value={v.conjuge_empresa}
            onChange={(e) => set("conjuge_empresa", e.target.value)}
          />
        </div>

        {/* 14. E-mail */}
        <div className="space-y-1.5">
          <Label>E-mail do cônjuge</Label>
          <Input
            type="email"
            value={v.conjuge_email}
            onChange={(e) => set("conjuge_email", e.target.value)}
          />
        </div>

        {/* 15. Celular */}
        <div className="space-y-1.5">
          <Label>Celular do cônjuge</Label>
          <Input
            value={v.conjuge_celular}
            onChange={(e) => set("conjuge_celular", mascararTelefone(e.target.value))}
            inputMode="numeric"
            placeholder="(11) 99999-9999"
          />
        </div>

        {/* 16. Renda declarada */}
        <div className="space-y-1.5">
          <Label>Renda declarada (R$)</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              R$
            </span>
            <Input
              inputMode="numeric"
              className="pl-9"
              value={v.conjuge_renda}
              onChange={(e) => set("conjuge_renda", mascararMoedaBR(e.target.value))}
              placeholder="0,00"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
