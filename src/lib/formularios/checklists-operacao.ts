/**
 * Checklists operacionais que o correspondente entrega ao cliente.
 *
 * São duas famílias, com finalidades diferentes:
 *
 *  - ABERTURA DE CONTA: o mínimo que cada banco pede para abrir a conta do
 *    cliente. Varia por instituição, por isso é organizado por banco.
 *  - SEGUIR COM A PROPOSTA: o dossiê da operação. É o mesmo para qualquer
 *    banco, e se divide em blocos que dependem do caso (FGTS e interveniente
 *    quitante só entram quando existem).
 *
 * Diferente de `CHECKLISTS_BANCOS`, que lista os documentos exigidos na
 * esteira de crédito, aqui o texto é o que o cliente lê — por isso vem em
 * linguagem corrente, e não em caixa alta de formulário de banco.
 */

export interface BlocoChecklist {
  /** Título do bloco; vazio quando os itens não precisam de agrupamento. */
  titulo?: string;
  /** Quando o bloco só se aplica em certos casos (FGTS, IQ, apartamento). */
  condicao?: string;
  itens: string[];
}

export interface ChecklistOperacao {
  id: string;
  titulo: string;
  descricao: string;
  blocos: BlocoChecklist[];
}

/** Bancos com checklist de abertura de conta, na ordem de exibição. */
export const BANCOS_ABERTURA = ["bradesco", "itau", "santander", "inter"] as const;
export type BancoAbertura = (typeof BANCOS_ABERTURA)[number];

export const NOME_BANCO_ABERTURA: Record<BancoAbertura, string> = {
  bradesco: "Bradesco",
  itau: "Itaú",
  santander: "Santander",
  inter: "Inter",
};

/**
 * Abertura de conta, por banco. A diferença entre eles está no comprovante de
 * renda: Santander e Inter exigem os três últimos extratos bancários além do
 * IRPF e dos holerites; o Bradesco aceita declaração do contador.
 */
export const CHECKLIST_ABERTURA_CONTA: Record<BancoAbertura, ChecklistOperacao> = {
  bradesco: {
    id: "abertura-bradesco",
    titulo: "Abertura de conta — Bradesco",
    descricao: "Documentos necessários para abrir a conta no Bradesco.",
    blocos: [
      {
        itens: [
          "Documentos pessoais",
          "Comprovante de renda: IRPF ou holerites ou declaração do contador",
        ],
      },
      {
        titulo: "Observação",
        itens: ["Podemos indicar um contador para a declaração, se precisar."],
      },
    ],
  },
  itau: {
    id: "abertura-itau",
    titulo: "Abertura de conta — Itaú",
    descricao: "Documentos necessários para abrir a conta no Itaú.",
    blocos: [
      {
        itens: ["Documentos pessoais", "Comprovante de renda: IRPF ou holerites"],
      },
    ],
  },
  santander: {
    id: "abertura-santander",
    titulo: "Abertura de conta — Santander",
    descricao: "Documentos necessários para abrir a conta no Santander.",
    blocos: [
      {
        itens: [
          "Documentos pessoais",
          "Comprovante de renda: IRPF, holerites e os 3 últimos extratos bancários",
        ],
      },
    ],
  },
  inter: {
    id: "abertura-inter",
    titulo: "Abertura de conta — Inter",
    descricao: "Documentos necessários para abrir a conta no Inter.",
    blocos: [
      {
        itens: [
          "Documentos pessoais",
          "Comprovante de renda: IRPF, holerites e os 3 últimos extratos bancários",
        ],
      },
    ],
  },
};

/** Dossiê da operação — igual para todos os bancos. */
export const CHECKLIST_PROPOSTA: ChecklistOperacao = {
  id: "seguir-proposta",
  titulo: "Checklist para seguir com a proposta",
  descricao:
    "Documentos e informações necessários para dar andamento à proposta de financiamento.",
  blocos: [
    {
      titulo: "Comprador — pessoa física",
      itens: [
        "Documento de identidade e CPF, ou CNH",
        "Certidão de estado civil (se casado, enviar também os documentos do cônjuge)",
        "Comprovante de residência atualizado",
        "E-mail",
        "Telefone",
        "Profissão",
      ],
    },
    {
      titulo: "Imóvel",
      itens: [
        "Matrícula atualizada",
        "IPTU 2026 ou certidão de valor venal 2026",
        "CND de IPTU",
      ],
    },
    {
      titulo: "Imóvel em condomínio",
      condicao: "Somente se o imóvel for apartamento",
      itens: [
        "CND de condomínio com assinatura do síndico ou da administradora",
      ],
    },
    {
      titulo: "Contato para a vistoria",
      itens: [
        "Nome completo de quem vai acompanhar a vistoria",
        "Telefone de contato",
        "E-mail",
      ],
    },
    {
      titulo: "Uso de FGTS",
      condicao: "Somente se houver processo de FGTS",
      itens: [
        "Extrato da conta do FGTS em PDF",
        "CTPS digital",
        "3 últimos holerites",
        "Imposto de renda 2026, com as 2 folhas do recibo, em PDF",
        "Comprovante de residência o mais recente possível, sendo conta de consumo (água, luz ou internet)",
      ],
    },
    {
      titulo: "Interveniente quitante (IQ)",
      condicao: "Somente se houver processo de IQ",
      itens: [
        "Número do contrato",
        "Data de quitação da parcela",
        "E-mail para solicitação do IQ",
        "Valor do saldo devedor atual",
      ],
    },
    {
      titulo: "Vendedores — pessoa física",
      itens: [
        "Documento de identidade e CPF, ou CNH",
        "Certidão de estado civil (se casado, enviar também os documentos do cônjuge)",
        "Comprovante de residência atualizado",
        "E-mail",
        "Telefone",
        "Profissão",
        "Dados da conta para recebimento",
      ],
    },
  ],
};

/** Todos os checklists de operação, indexados pelo id usado na rota. */
export const CHECKLISTS_OPERACAO: Record<string, ChecklistOperacao> = {
  ...Object.fromEntries(
    Object.values(CHECKLIST_ABERTURA_CONTA).map((c) => [c.id, c]),
  ),
  [CHECKLIST_PROPOSTA.id]: CHECKLIST_PROPOSTA,
};

/** Total de itens de um checklist — usado no resumo da tela. */
export function totalItens(checklist: ChecklistOperacao): number {
  return checklist.blocos.reduce((soma, b) => soma + b.itens.length, 0);
}
