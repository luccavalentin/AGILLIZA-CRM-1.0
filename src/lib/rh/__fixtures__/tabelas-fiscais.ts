/**
 * Só para testes: as mesmas vigências que a migração 20261027060002 semeia como padrão
 * do sistema em `rh_tabelas_fiscais`. O aplicativo lê sempre do banco.
 */
import type { TabelaFiscal } from "@/lib/rh/clt";

const IRRF_DESDE_MAIO_2025 = [
  { ate: 2428.8, aliquota: 0, deducao: 0 },
  { ate: 2826.65, aliquota: 0.075, deducao: 182.16 },
  { ate: 3751.05, aliquota: 0.15, deducao: 394.16 },
  { ate: 4664.68, aliquota: 0.225, deducao: 675.49 },
  { ate: null, aliquota: 0.275, deducao: 908.73 },
];

export const TABELA_2025: TabelaFiscal = {
  correspondente_id: null,
  vigencia_desde: "2025-01-01",
  salario_minimo: 1518,
  inss_faixas: [
    { ate: 1518, aliquota: 0.075 },
    { ate: 2793.88, aliquota: 0.09 },
    { ate: 4190.83, aliquota: 0.12 },
    { ate: 8157.41, aliquota: 0.14 },
  ],
  irrf_faixas: IRRF_DESDE_MAIO_2025,
  irrf_dependente: 189.59,
  irrf_desconto_simplificado: 607.2,
  irrf_reducao: null,
  salario_familia_quota: 65,
  salario_familia_teto: 1906.04,
  fgts_aliquota: 0.08,
};

export const TABELA_2026: TabelaFiscal = {
  correspondente_id: null,
  vigencia_desde: "2026-01-01",
  salario_minimo: 1621,
  inss_faixas: [
    { ate: 1621, aliquota: 0.075 },
    { ate: 2902.84, aliquota: 0.09 },
    { ate: 4354.27, aliquota: 0.12 },
    { ate: 8475.55, aliquota: 0.14 },
  ],
  irrf_faixas: IRRF_DESDE_MAIO_2025,
  irrf_dependente: 189.59,
  irrf_desconto_simplificado: 607.2,
  irrf_reducao: { isencao_ate: 5000, reducao_maxima: 312.89, ate: 7350, a: 978.62, b: 0.133145 },
  salario_familia_quota: 67.54,
  salario_familia_teto: 1980.38,
  fgts_aliquota: 0.08,
};

export const TABELAS_PADRAO: TabelaFiscal[] = [TABELA_2025, TABELA_2026];
