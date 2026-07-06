import {
  Users,
  Calculator,
  FileText,
  Wallet,
  ListChecks,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

/** Tipos de campo suportados nas configurações por módulo. */
export type CampoConfigTipo = "boolean" | "number" | "text" | "select";

export interface CampoConfig {
  chave: string;
  label: string;
  descricao?: string;
  tipo: CampoConfigTipo;
  /** Valor inicial quando ainda não há configuração salva. */
  padrao: boolean | number | string;
  /** Opções para tipo "select". */
  opcoes?: { valor: string; label: string }[];
  /** Limites para tipo "number". */
  min?: number;
  max?: number;
  sufixo?: string;
}

export interface ModuloConfig {
  /** Identificador persistido em configuracoes_modulos.modulo. */
  id: string;
  label: string;
  icon: LucideIcon;
  descricao: string;
  campos: CampoConfig[];
}

/** Definição declarativa de todas as configurações por módulo. */
export const MODULOS_CONFIG: ModuloConfig[] = [
  {
    id: "crm",
    label: "CRM",
    icon: Users,
    descricao: "Regras de cadastro de clientes e acompanhamento da esteira.",
    campos: [
      {
        chave: "dias_inatividade_alerta",
        label: "Alerta de inatividade",
        descricao: "Dias sem interação até sinalizar o cliente como parado.",
        tipo: "number",
        padrao: 7,
        min: 1,
        max: 180,
        sufixo: "dias",
      },
      {
        chave: "exigir_cpf_cliente",
        label: "Exigir CPF/CNPJ no cadastro",
        tipo: "boolean",
        padrao: true,
      },
      {
        chave: "permitir_exclusao_cliente",
        label: "Permitir exclusão de clientes",
        descricao: "Se desativado, clientes só podem ser arquivados.",
        tipo: "boolean",
        padrao: false,
      },
    ],
  },
  {
    id: "simulacoes",
    label: "Simulações",
    icon: Calculator,
    descricao: "Padrões aplicados às novas simulações de financiamento.",
    campos: [
      {
        chave: "sistema_amortizacao_padrao",
        label: "Sistema de amortização padrão",
        tipo: "select",
        padrao: "SAC",
        opcoes: [
          { valor: "SAC", label: "SAC" },
          { valor: "PRICE", label: "PRICE" },
        ],
      },
      {
        chave: "validade_dias",
        label: "Validade da simulação",
        descricao: "Após esse prazo a simulação é marcada como expirada.",
        tipo: "number",
        padrao: 30,
        min: 1,
        max: 365,
        sufixo: "dias",
      },
      {
        chave: "financiar_despesas_padrao",
        label: "Financiar despesas por padrão",
        tipo: "boolean",
        padrao: false,
      },
    ],
  },
  {
    id: "propostas",
    label: "Propostas",
    icon: FileText,
    descricao: "Fluxo de originação e acompanhamento de propostas.",
    campos: [
      {
        chave: "sla_analise_horas",
        label: "SLA de análise",
        descricao: "Prazo esperado para primeira análise da proposta.",
        tipo: "number",
        padrao: 48,
        min: 1,
        max: 720,
        sufixo: "horas",
      },
      {
        chave: "exigir_documentos_minimos",
        label: "Exigir documentos mínimos para envio",
        tipo: "boolean",
        padrao: true,
      },
      {
        chave: "permitir_reabertura",
        label: "Permitir reabrir propostas encerradas",
        tipo: "boolean",
        padrao: false,
      },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: Wallet,
    descricao: "Padrões de contas, vencimentos e comissões.",
    campos: [
      {
        chave: "dia_vencimento_padrao",
        label: "Dia de vencimento padrão",
        tipo: "number",
        padrao: 10,
        min: 1,
        max: 28,
      },
      {
        chave: "alerta_vencimento_dias",
        label: "Antecedência do alerta de vencimento",
        tipo: "number",
        padrao: 3,
        min: 0,
        max: 60,
        sufixo: "dias",
      },
      {
        chave: "gerar_comissao_automatica",
        label: "Gerar comissão automaticamente ao emitir contrato",
        tipo: "boolean",
        padrao: true,
      },
    ],
  },
  {
    id: "tarefas",
    label: "Tarefas e Demandas",
    icon: ListChecks,
    descricao: "Configuração de SLA e escalonamento de demandas.",
    campos: [
      {
        chave: "sla_padrao_horas",
        label: "SLA padrão",
        tipo: "number",
        padrao: 24,
        min: 1,
        max: 720,
        sufixo: "horas",
      },
      {
        chave: "escalonamento_automatico",
        label: "Escalonar automaticamente ao estourar o SLA",
        tipo: "boolean",
        padrao: true,
      },
      {
        chave: "notificar_responsavel",
        label: "Notificar responsável ao atribuir",
        tipo: "boolean",
        padrao: true,
      },
    ],
  },
  {
    id: "relatorios",
    label: "Relatórios",
    icon: BarChart3,
    descricao: "Exportações e retenção de dados dos relatórios.",
    campos: [
      {
        chave: "retencao_exports_dias",
        label: "Retenção de exportações",
        descricao: "Após esse prazo os arquivos exportados são removidos.",
        tipo: "number",
        padrao: 90,
        min: 1,
        max: 730,
        sufixo: "dias",
      },
      {
        chave: "permitir_export_pdf",
        label: "Permitir exportar em PDF",
        tipo: "boolean",
        padrao: true,
      },
      {
        chave: "permitir_export_excel",
        label: "Permitir exportar em Excel",
        tipo: "boolean",
        padrao: true,
      },
    ],
  },
];

export type ConfigValor = boolean | number | string;
export type ConfigModulo = Record<string, ConfigValor>;
export type ConfigTodos = Record<string, ConfigModulo>;

/** Valores padrão de um módulo a partir da definição declarativa. */
export function padroesDoModulo(m: ModuloConfig): ConfigModulo {
  const out: ConfigModulo = {};
  for (const c of m.campos) out[c.chave] = c.padrao;
  return out;
}

/** Mescla padrões declarados com o que veio do banco. */
export function mesclarConfig(m: ModuloConfig, salvo: ConfigModulo | undefined): ConfigModulo {
  return { ...padroesDoModulo(m), ...(salvo ?? {}) };
}
