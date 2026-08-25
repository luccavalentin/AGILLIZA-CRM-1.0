import { z } from "zod";
import { validarCpfCnpj } from "./format";

/** Schema do wizard inicial (paridade com o site público). */
export const wizardSchema = z
  .object({
    produto: z.enum(["financiamento_imobiliario", "home_equity"]),
    valor_imovel: z.number().positive("Informe o valor do imóvel"),
    valor_entrada: z.number().min(0),
    valor_financiamento: z.number().positive("Informe o valor do crédito"),
    possui_imovel_escolhido: z.boolean().optional().nullable(),
    data_nascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
    prazo_meses: z
      .number()
      .int()
      .min(60, "Prazo mínimo 60 meses")
      .max(420, "Prazo máximo 420 meses"),
  })
  .refine((d) => d.valor_entrada < d.valor_imovel, {
    message: "A entrada deve ser menor que o valor do imóvel",
    path: ["valor_entrada"],
  });

export type WizardDados = z.infer<typeof wizardSchema>;

export const participanteSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().min(3, "Informe o nome"),
  cpf_cnpj: z.string().refine((v) => validarCpfCnpj(v), "CPF/CNPJ inválido"),
  data_nascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  renda: z.number().min(0),
  vinculo: z.string().min(1, "Selecione o vínculo"),
  sexo: z.enum(["M", "F"], { errorMap: () => ({ message: "Selecione o sexo" }) }),
  estado_civil: z.string().min(1, "Selecione o estado civil"),
  compoe_renda: z.boolean().default(true),
  // Campos obrigatórios para HomeFin
  nome_mae: z.string().optional().nullable(),
  email: z.string().email("E-mail inválido").optional().nullable(),
  celular: z.string().optional().nullable(),
  cep: z.string().optional().nullable(),
  logradouro: z.string().optional().nullable(),
  numero: z.string().optional().nullable(),
  complemento: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  municipio: z.string().optional().nullable(),
  uf: z.string().optional().nullable(),
});

export type ParticipanteDados = z.infer<typeof participanteSchema>;

/** Schema completo (Simulação Personalizada). */
export const completaSchema = z.object({
  cliente_id: z.string().uuid().optional().nullable(),
  // Operação / imóvel
  produto: z.enum(["financiamento_imobiliario", "home_equity"]),
  id_operacao_homefin: z.number().int({ message: "Selecione a operação" }),
  agrupador_id: z.string().uuid().optional().nullable(),
  tipo_imovel: z.string().min(1, "Selecione o tipo de imóvel"),
  uso_imovel: z.string().min(1, "Selecione o uso do imóvel"),
  situacao_imovel: z.string().min(1, "Selecione a situação do imóvel"),
  uf: z.string().length(2, "Selecione a UF"),
  cep_imovel: z.string().optional().nullable(),
  valor_imovel: z.number().positive("Informe o valor do imóvel"),
  valor_entrada: z.number().min(0),
  valor_financiamento: z.number().positive(),
  prazo: z.number().int().min(60, "Prazo mínimo 60 meses").max(420, "Prazo máximo 420 meses"),
  prazo_2: z.number().int().min(60).max(420).optional().nullable(),
  prazo_anos: z.number().int().optional().nullable(),
  possui_imovel_escolhido: z.boolean().optional().nullable(),
  utiliza_fgts: z.enum(["S", "N"]),
  fg_financiar_despesas: z.boolean().default(false),
  valor_despesas_financiadas: z.number().min(0).optional().nullable(),
  sistema_amortizacao: z.enum(["S", "P"]),
  // Titular
  nome_cliente: z.string().min(3, "Informe o nome"),
  cpf_cnpj: z.string().refine((v) => validarCpfCnpj(v), "CPF/CNPJ inválido"),
  renda_total: z.number().positive("Informe a renda total"),
  sexo: z.enum(["M", "F"], { errorMap: () => ({ message: "Selecione o sexo" }) }),
  data_nascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  estado_civil: z.string().min(1, "Selecione o estado civil"),
  email: z.string().email("E-mail inválido"),
  celular: z.string().min(10, "Informe o celular"),
  // Cônjuge / composição de renda
  possui_conjuge: z.boolean().default(false),
  compoe_renda: z.boolean().default(false),
  compoe_renda_conjuge: z.boolean().default(true),

  nome_conjuge: z.string().optional().nullable(),
  cpf_conjuge: z.string().optional().nullable(),
  data_nascimento_conjuge: z.string().optional().nullable(),
  email_conjuge: z.string().optional().nullable(),
  celular_conjuge: z.string().optional().nullable(),
  renda_conjuge: z.number().optional().nullable(),
  sexo_conjuge: z.enum(["M", "F"]).optional().nullable(),
  estado_civil_conjuge: z.string().optional().nullable(),
  regime_casamento: z.string().optional().nullable(),
  /** Teste automático de CPFs — precisa atravessar o schema para chegar ao
   *  servidor, que desliga o inversor automático quando o cliente assume. */
  testar_cpfs: z.boolean().optional().default(false),
  // Participantes adicionais
  participantes: z.array(participanteSchema).default([]),
  // Bancos
  bancos_ids: z.array(z.string().uuid()).min(1, "Selecione ao menos um banco"),
  // Consentimentos
  consentimento_lgpd: z.literal(true, {
    errorMap: () => ({ message: "É necessário aceitar o consentimento LGPD" }),
  }),
  consentimento_scr: z.literal(true, {
    errorMap: () => ({ message: "É necessário autorizar a consulta ao SCR/Bacen" }),
  }),
}).refine((d) => {
  // Só é obrigatório quando REALMENTE existe cônjuge (estado civil casado/união
  // estável), o flag possui_conjuge está ativo e ele compõe renda.
  const temConjuge =
    d.possui_conjuge && (d.estado_civil === "CA" || d.estado_civil === "UE");
  if (temConjuge && d.compoe_renda_conjuge && !d.sexo_conjuge) return false;
  return true;
}, {
  message: "Selecione o sexo do cônjuge",
  path: ["sexo_conjuge"]
});

export type CompletaDados = z.infer<typeof completaSchema>;

export function validarCepImovelHomeEquity(d: Pick<CompletaDados, "produto" | "cep_imovel">) {
  if (d.produto !== "home_equity") return null;
  return d.cep_imovel?.replace(/\D/g, "").length === 8
    ? null
    : "Informe o CEP do imóvel para Home Equity.";
}

export const ESTADOS_CIVIS = [
  { value: "S", label: "Solteiro(a)" },
  { value: "CA", label: "Casado(a)" },
  { value: "UE", label: "União estável" },
  { value: "DI", label: "Divorciado(a)" },
  { value: "VI", label: "Viúvo(a)" },
  { value: "SL", label: "Separado(a)" },
] as const;

/** Converte o código de estado civil da simulação (S, CA, UE, DI, VI, SL)
 * para o enum cliente_estado_civil do CRM. */
export function mapEstadoCivilEnum(
  v: string | null | undefined,
): "solteiro" | "casado" | "uniao_estavel" | "divorciado" | "viuvo" | null {
  switch (v) {
    case "S":
      return "solteiro";
    case "CA":
      return "casado";
    case "UE":
      return "uniao_estavel";
    case "DI":
    case "SL":
      return "divorciado";
    case "VI":
      return "viuvo";
    // já pode vir no formato do enum
    case "solteiro":
    case "casado":
    case "uniao_estavel":
    case "divorciado":
    case "viuvo":
      return v;
    default:
      return null;
  }
}

export const TIPOS_IMOVEL = [
  { value: "AP", label: "Apartamento" },
  { value: "CS", label: "Casa" },
  { value: "GA", label: "Galpão" },
  { value: "TE", label: "Terreno" },
  { value: "TC", label: "Terreno em condomínio" },
] as const;

export const USOS_IMOVEL = [
  { value: "R", label: "Residencial" },
  { value: "C", label: "Comercial" },
] as const;

export const SITUACOES_IMOVEL = [
  { value: "N", label: "Novo" },
  { value: "U", label: "Usado" },
] as const;

export const PRODUTOS = [
  { value: "financiamento_imobiliario", label: "Financiamento Imobiliário" },
  { value: "home_equity", label: "Home Equity" },
] as const;
