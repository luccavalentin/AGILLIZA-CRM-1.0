import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { salvarImovelIq } from "@/lib/crm/clientes.functions";

const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

/** Aceita boolean ou texto ("Sim"/"Não") vindo da leitura por IA. */
function ehVerdadeiro(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v !== "string") return false;
  const t = v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  if (!t) return false;
  return !/^(nao|n|false|0|nenhum|nenhuma|inexistente|sem)\b/.test(t);
}

/**
 * Estrutura dos "Dados da matrícula" do imóvel — campos avaliados pelos
 * bancos ao analisar uma matrícula para fins de financiamento imobiliário
 * (compra e venda). Todos são opcionais; salvos como JSONB em
 * clientes.imovel_matricula.
 */
export interface MatriculaDados {
  numero_matricula?: string;
  cartorio_nome?: string;
  cartorio_numero?: string;
  comarca?: string;
  cidade?: string;
  uf?: string;
  data_abertura?: string;
  data_atualizacao?: string;

  proprietario_atual?: string;
  proprietario_cpf?: string;
  estado_civil_proprietario?: string;
  aquisicao_forma?: string;
  aquisicao_data?: string;
  transcricao_anterior?: string;

  // Compra e venda / transmissão
  vendedor_nome?: string;
  vendedor_cpf?: string;
  comprador_nome?: string;
  comprador_cpf?: string;
  valor_transacao?: string;
  data_transacao?: string;
  itbi_informacao?: string;

  inscricao_imobiliaria?: string;
  inscricao_iptu?: string;
  valor_venal?: string;

  area_terreno?: string;
  area_construida?: string;
  area_privativa?: string;
  area_comum?: string;
  fracao_ideal?: string;
  numero_vagas?: string;
  matricula_vaga?: string;

  confrontacoes?: string;

  habite_se_averbado?: boolean;
  construcao_averbada?: boolean;
  edificacao_regularizada?: boolean;

  tem_hipoteca?: boolean;
  hipoteca_credor?: string;
  tem_alienacao_fiduciaria?: boolean;
  alienacao_credor?: string;
  alienacao_valor?: string;
  alienacao_data?: string;
  alienacao_situacao?: string;
  alienacao_descricao?: string;
  tem_interveniente_quitante?: boolean;
  interveniente_nome?: string;
  tem_penhora?: boolean;
  tem_usufruto?: boolean;
  tem_indisponibilidade?: boolean;
  outros_onus?: string;
  onus_gravames?: string;

  certidao_onus_data?: string;
  certidao_onus_valida_ate?: string;
  cnd_iptu?: boolean;
  cnd_condominio?: boolean;

  data_registro?: string;
  ultimo_registro?: string;
  historico_atos?: string;

  observacoes?: string;
}

const CAMPOS_TEXTO_CURTO: Array<[keyof MatriculaDados, string, string?]> = [
  ["numero_matricula", "Número da matrícula"],
  ["cartorio_nome", "Cartório de Registro de Imóveis"],
  ["cartorio_numero", "Nº do cartório / Zona"],
  ["comarca", "Comarca"],
  ["cidade", "Cidade"],
];

const CAMPOS_AREA: Array<[keyof MatriculaDados, string, string?]> = [
  ["area_terreno", "Área do terreno (m²)"],
  ["area_construida", "Área construída (m²)"],
  ["area_privativa", "Área privativa (m²)"],
  ["area_comum", "Área comum (m²)"],
  ["fracao_ideal", "Fração ideal"],
  ["numero_vagas", "Nº de vagas"],
  ["matricula_vaga", "Matrícula da vaga"],
];

const ONUS_CHECKS: Array<[keyof MatriculaDados, string]> = [
  ["tem_hipoteca", "Hipoteca"],
  ["tem_alienacao_fiduciaria", "Alienação fiduciária"],
  ["tem_interveniente_quitante", "Interveniente quitante"],
  ["tem_penhora", "Penhora"],
  ["tem_usufruto", "Usufruto"],
  ["tem_indisponibilidade", "Indisponibilidade"],
];

const AVERBACOES_CHECKS: Array<[keyof MatriculaDados, string]> = [
  ["habite_se_averbado", "Habite-se averbado"],
  ["construcao_averbada", "Construção averbada"],
  ["edificacao_regularizada", "Edificação regularizada"],
];

export function MatriculaTab({
  clienteId,
  cliente,
}: {
  clienteId: string;
  cliente: Record<string, any>;
}) {
  const qc = useQueryClient();
  const salvar = useServerFn(salvarImovelIq);
  const [salvando, setSalvando] = useState(false);
  const inicial: MatriculaDados = useMemo(
    () => (cliente.imovel_matricula ?? {}) as MatriculaDados,
    [cliente.imovel_matricula],
  );
  const [m, setM] = useState<MatriculaDados>(inicial);

  function set<K extends keyof MatriculaDados>(k: K, v: MatriculaDados[K]) {
    setM((p) => ({ ...p, [k]: v }));
  }

  async function onSalvar() {
    setSalvando(true);
    try {
      // Remove chaves vazias/falsy para manter o JSON limpo.
      const limpo: Record<string, any> = {};
      for (const [k, v] of Object.entries(m)) {
        if (v === "" || v === null || v === undefined || v === false) continue;
        limpo[k] = v;
      }
      await salvar({ data: { cliente_id: clienteId, imovel_matricula: limpo } });
      toast.success("Dados da matrícula salvos.");
      qc.invalidateQueries({ queryKey: ["cliente", clienteId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Dados da matrícula do imóvel
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Informações analisadas pelos bancos na matrícula para financiamento imobiliário (compra e
          venda). Todos os campos são opcionais.
        </p>
      </div>

      {/* Identificação */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold">Identificação do registro</h4>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {CAMPOS_TEXTO_CURTO.map(([k, l]) => (
            <div key={k}>
              <Label>{l}</Label>
              <Input
                value={(m[k] as string) ?? ""}
                onChange={(e) => set(k, e.target.value as never)}
              />
            </div>
          ))}
          <div>
            <Label>UF</Label>
            <Select value={m.uf ?? ""} onValueChange={(v) => set("uf", v)}>
              <SelectTrigger>
                <SelectValue placeholder="UF" />
              </SelectTrigger>
              <SelectContent>
                {UFS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data de abertura</Label>
            <Input
              type="date"
              value={m.data_abertura ?? ""}
              onChange={(e) => set("data_abertura", e.target.value)}
            />
          </div>
          <div>
            <Label>Última atualização</Label>
            <Input
              type="date"
              value={m.data_atualizacao ?? ""}
              onChange={(e) => set("data_atualizacao", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 md:col-span-3">
            <Label>Transcrição anterior (origem)</Label>
            <Input
              value={m.transcricao_anterior ?? ""}
              onChange={(e) => set("transcricao_anterior", e.target.value)}
              placeholder="Nº da transcrição/matrícula anterior, se houver"
            />
          </div>
        </div>
      </section>

      {/* Propriedade */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold">Propriedade</h4>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <div className="sm:col-span-2">
            <Label>Proprietário atual (registrado)</Label>
            <Input
              value={m.proprietario_atual ?? ""}
              onChange={(e) => set("proprietario_atual", e.target.value)}
            />
          </div>
          <div>
            <Label>CPF/CNPJ do proprietário</Label>
            <Input
              value={m.proprietario_cpf ?? ""}
              onChange={(e) => set("proprietario_cpf", e.target.value)}
            />
          </div>
          <div>
            <Label>Forma de aquisição</Label>
            <Input
              value={m.aquisicao_forma ?? ""}
              onChange={(e) => set("aquisicao_forma", e.target.value)}
              placeholder="Compra e venda, doação, herança…"
            />
          </div>
          <div>
            <Label>Data de aquisição</Label>
            <Input
              type="date"
              value={m.aquisicao_data ?? ""}
              onChange={(e) => set("aquisicao_data", e.target.value)}
            />
          </div>
          <div>
            <Label>Estado civil do proprietário</Label>
            <Input
              value={m.estado_civil_proprietario ?? ""}
              onChange={(e) => set("estado_civil_proprietario", e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Compra e venda */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold">Compra e venda / transmissão</h4>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <div className="sm:col-span-2">
            <Label>Vendedor (transmitente)</Label>
            <Input
              value={m.vendedor_nome ?? ""}
              onChange={(e) => set("vendedor_nome", e.target.value)}
            />
          </div>
          <div>
            <Label>CPF/CNPJ do vendedor</Label>
            <Input
              value={m.vendedor_cpf ?? ""}
              onChange={(e) => set("vendedor_cpf", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Comprador (adquirente)</Label>
            <Input
              value={m.comprador_nome ?? ""}
              onChange={(e) => set("comprador_nome", e.target.value)}
            />
          </div>
          <div>
            <Label>CPF/CNPJ do comprador</Label>
            <Input
              value={m.comprador_cpf ?? ""}
              onChange={(e) => set("comprador_cpf", e.target.value)}
            />
          </div>
          <div>
            <Label>Valor da compra e venda (R$)</Label>
            <Input
              inputMode="decimal"
              value={m.valor_transacao ?? ""}
              onChange={(e) => set("valor_transacao", e.target.value)}
            />
          </div>
          <div>
            <Label>Data da compra e venda</Label>
            <Input
              type="date"
              value={m.data_transacao ?? ""}
              onChange={(e) => set("data_transacao", e.target.value)}
            />
          </div>
          <div>
            <Label>ITBI (guia / valor / data)</Label>
            <Input
              value={m.itbi_informacao ?? ""}
              onChange={(e) => set("itbi_informacao", e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Fiscal */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold">Dados fiscais</h4>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <Label>Inscrição imobiliária</Label>
            <Input
              value={m.inscricao_imobiliaria ?? ""}
              onChange={(e) => set("inscricao_imobiliaria", e.target.value)}
            />
          </div>
          <div>
            <Label>Inscrição / cadastro IPTU</Label>
            <Input
              value={m.inscricao_iptu ?? ""}
              onChange={(e) => set("inscricao_iptu", e.target.value)}
            />
          </div>
          <div>
            <Label>Valor venal (R$)</Label>
            <Input
              inputMode="decimal"
              value={m.valor_venal ?? ""}
              onChange={(e) => set("valor_venal", e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Áreas */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold">Áreas e frações</h4>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {CAMPOS_AREA.map(([k, l]) => (
            <div key={k}>
              <Label>{l}</Label>
              <Input
                value={(m[k] as string) ?? ""}
                onChange={(e) => set(k, e.target.value as never)}
              />
            </div>
          ))}
          <div className="sm:col-span-2 md:col-span-3">
            <Label>Confrontações</Label>
            <Textarea
              rows={3}
              value={m.confrontacoes ?? ""}
              onChange={(e) => set("confrontacoes", e.target.value)}
              placeholder="Descrição das confrontações (norte, sul, leste, oeste…)"
            />
          </div>
        </div>
      </section>

      {/* Averbações */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold">Averbações</h4>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {AVERBACOES_CHECKS.map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={ehVerdadeiro(m[k])}
                onCheckedChange={(v) => set(k, Boolean(v) as never)}
              />
              {l}
            </label>
          ))}
        </div>
      </section>

      {/* Ônus e gravames */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold">Ônus e gravames</h4>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {ONUS_CHECKS.map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={ehVerdadeiro(m[k])}
                onCheckedChange={(v) => set(k, Boolean(v) as never)}
              />
              {l}
            </label>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Credor da hipoteca</Label>
            <Input
              value={m.hipoteca_credor ?? ""}
              onChange={(e) => set("hipoteca_credor", e.target.value)}
              disabled={!m.tem_hipoteca}
            />
          </div>
          <div>
            <Label>Credor da alienação fiduciária</Label>
            <Input
              value={m.alienacao_credor ?? ""}
              onChange={(e) => set("alienacao_credor", e.target.value)}
            />
          </div>
          <div>
            <Label>Valor da alienação fiduciária (R$)</Label>
            <Input
              inputMode="decimal"
              value={m.alienacao_valor ?? ""}
              onChange={(e) => set("alienacao_valor", e.target.value)}
            />
          </div>
          <div>
            <Label>Data da alienação fiduciária</Label>
            <Input
              type="date"
              value={m.alienacao_data ?? ""}
              onChange={(e) => set("alienacao_data", e.target.value)}
            />
          </div>
          <div>
            <Label>Situação da alienação</Label>
            <Input
              value={m.alienacao_situacao ?? ""}
              onChange={(e) => set("alienacao_situacao", e.target.value)}
              placeholder="Ativa, baixada/cancelada…"
            />
          </div>
          <div>
            <Label>Interveniente quitante (credor a quitar)</Label>
            <Input
              value={m.interveniente_nome ?? ""}
              onChange={(e) => set("interveniente_nome", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Descrição da alienação fiduciária</Label>
            <Textarea
              rows={2}
              value={m.alienacao_descricao ?? ""}
              onChange={(e) => set("alienacao_descricao", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Ônus vigentes (resumo)</Label>
            <Textarea
              rows={3}
              value={m.onus_gravames ?? ""}
              onChange={(e) => set("onus_gravames", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Outros ônus / observações</Label>
            <Textarea
              rows={3}
              value={m.outros_onus ?? ""}
              onChange={(e) => set("outros_onus", e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Histórico de atos */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold">Histórico de registros e averbações</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Último registro / averbação</Label>
            <Input
              value={m.ultimo_registro ?? ""}
              onChange={(e) => set("ultimo_registro", e.target.value)}
            />
          </div>
          <div>
            <Label>Data do último registro</Label>
            <Input
              value={m.data_registro ?? ""}
              onChange={(e) => set("data_registro", e.target.value)}
              placeholder="dd/mm/aaaa"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Histórico de atos (R. / AV.)</Label>
            <Textarea
              rows={6}
              value={m.historico_atos ?? ""}
              onChange={(e) => set("historico_atos", e.target.value)}
              placeholder="R.3 — 12/05/2019 — compra e venda: Fulano vendeu para Beltrano, R$ 300.000,00"
            />
          </div>
        </div>
      </section>

      {/* Certidões */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold">Certidões</h4>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <Label>Certidão de ônus — emissão</Label>
            <Input
              type="date"
              value={m.certidao_onus_data ?? ""}
              onChange={(e) => set("certidao_onus_data", e.target.value)}
            />
          </div>
          <div>
            <Label>Certidão de ônus — validade</Label>
            <Input
              type="date"
              value={m.certidao_onus_valida_ate ?? ""}
              onChange={(e) => set("certidao_onus_valida_ate", e.target.value)}
            />
          </div>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={ehVerdadeiro(m.cnd_iptu)}
                onCheckedChange={(v) => set("cnd_iptu", Boolean(v))}
              />
              CND de IPTU disponível
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={ehVerdadeiro(m.cnd_condominio)}
                onCheckedChange={(v) => set("cnd_condominio", Boolean(v))}
              />
              Nada consta do condomínio
            </label>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <Label>Observações gerais</Label>
        <Textarea
          rows={4}
          maxLength={2000}
          value={m.observacoes ?? ""}
          onChange={(e) => set("observacoes", e.target.value)}
        />
      </section>

      <div className="flex justify-end">
        <Button onClick={onSalvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar matrícula"}
        </Button>
      </div>
    </div>
  );
}
