import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ChecklistItem {
  id: string;
  banco: "itau" | "caixa" | "inter" | "bradesco" | "santander";
  categoria: string;
  documento: string;
  obrigatorio: boolean;
  observacao?: string;
}

export const CHECKLISTS_BANCOS: Record<string, { docs: string[], logos: string[] }> = {
  itau: {
    docs: [
      "TELEFONE",
      "EMAIL",
      "BANCO / AG E CC PARA RECEBIMENTO",
      "VENDEDOR - PJ:",
      "CONTRATO SOCIAL E ULTIMA ALTERAÇÃO",
      "CARTÃO CNPJ",
      "CERTIDÃO NEGATIVA DE DEBITOS RELATIVO A DIVIDAS DA UNIÃO",
      "CERTIDÃO DE REGULARIDADE DO EMPREGADOR ( CRF) - FGTS",
      "EMAIL, TELEFONE",
      "DADOS DA CONTA PARA RECEBIMENTO ( AGENCIA E CONTA CORRENTE)",
      "REPRESENTANTES:",
      "RGE CPF OU CNH ( DENTRO DA VALIDADE)",
      "CERTIDÃO DE ESTADO CIVIL",
      "COMPROVANTE DE ENDEREÇO",
      "EM CASO DE PROCURADOR, ENVIAR PROCURAÇÃO NA VALIDADE DE 180 DIAS",
      "IMOVEL:",
      "MATRÍCULA ATUALIZADA COM CERTIDÃO DE ÔNUS",
      "CAPA IPTU OU CERTIDÃO DE VALOR VENAL",
      "CND IPTU",
      "SE O IMÓVEL FOR EM CONDOMINIO, ENVIAR CND CONDOMINIAL E PLANTA DE QUADRA E LOTE",
      "CONTATO PARA ACOMPANHAR VISTORIA ( NOME E TELEFONE)",
      "QUANTIDADE DE VAGAS DO IMÓVEL",
      "CONTEM IQ?",
      "NUMERO DO CONTRATO COM DIGITO",
      "DATA DE VENCIMENTO DAS PRESTAÇÕES",
      "NOME E-MAIL E TELEFONE DO GERENTE",
    ],
    logos: ["itau"],
  },
  caixa: {
    docs: [
      "RG ou CNH (Proponente e Cônjuge)",
      "Comprovante de Estado Civil",
      "Comprovante de Residência",
      "Comprovante de Renda (3 últimos meses)",
      "CTPS (Física ou Digital) e extrato FGTS",
      "Declaração de Imposto de Renda e Recibo",
      "Formulários Caixa (CCA)",
    ],
    logos: ["caixa"],
  },
  inter: {
    docs: [
      "Documento de Identidade",
      "Comprovante de Estado Civil",
      "Comprovante de Residência",
      "Comprovante de Renda",
      "Declaração de IR",
    ],
    logos: ["inter"],
  },
  bradesco: {
    docs: [
      "RG ou CNH",
      "Comprovante de Estado Civil",
      "Comprovante de Residência",
      "Comprovante de Renda",
      "Declaração de IR",
      "Ficha Cadastral Bradesco",
    ],
    logos: ["bradesco"],
  },
  santander: {
    docs: [
      "RG ou CNH",
      "Comprovante de Estado Civil",
      "Comprovante de Residência",
      "Comprovante de Renda",
      "Declaração de IR",
      "Ficha Cadastral Santander",
    ],
    logos: ["santander"],
  },
};

export const obterChecklistBanco = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ({ banco: String(d) }))
  .handler(async ({ data }) => {
    return CHECKLISTS_BANCOS[data.banco] || null;
  });
