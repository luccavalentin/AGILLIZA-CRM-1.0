// Estrutura da Declaração Pessoal de Saúde (DPS) — Agilliza.
// Baseada no modelo oficial. Usada tanto no preenchimento manual (impressão em
// branco) quanto no preenchimento via sistema (dados do cliente puxados do CRM).

export interface DpsSubItem {
  letra: string;
  texto: string;
  nota?: string;
}

export interface DpsPergunta {
  numero: number;
  texto: string;
  /** Linha de "Esclareça:" abaixo da pergunta. */
  esclareca?: boolean;
  /** Observação/instrução exibida em itálico abaixo. */
  nota?: string;
  /** Subitens (ex.: pergunta 4 a-j). */
  subitens?: DpsSubItem[];
}

export const DPS_PERGUNTAS: DpsPergunta[] = [
  {
    numero: 1,
    texto: "Esteve ou está afastado de suas atividades profissionais? Por que motivo?",
    esclareca: true,
  },
  {
    numero: 2,
    texto: "Está em gozo de benefício previdenciário de invalidez? Por que motivo?",
    esclareca: true,
  },
  {
    numero: 3,
    texto:
      "Tem alguma deficiência de órgão, membros ou sentidos (por exemplo: visão, audição) ou defeitos físicos em membros ou órgãos? Especifique o grau de deficiência.",
    esclareca: true,
    nota: "Caso o proponente indique problema de visão encaminhar Laudo Oftalmológico no modelo (4840-551E), se a indicação for de outra doença relacionada a órgãos, membros ou sentidos solicitar Laudo do médico assistente.",
  },
  {
    numero: 4,
    texto:
      "Sofre ou sofreu de alguma doença ou distúrbios abaixo relacionados? Em caso positivo, informar todos os detalhes incluindo datas e tratamentos realizados.",
    subitens: [
      {
        letra: "a",
        texto: "Hipertensão, infarto do miocárdio ou outras doenças cardiocirculares?",
        nota: "Em caso de Hipertensão Arterial (Hipertensão/Pressão Alta) encaminhar Laudo do médico assistente no modelo (4840-550E — Declaração de Saúde Complementar — Hipertensão Arterial), se a indicação for de outra doença neste item solicitar Laudo do médico assistente.",
      },
      {
        letra: "b",
        texto: "Tumores ou câncer?",
        nota: "Caso positivado encaminhar Laudo do médico assistente.",
      },
      {
        letra: "c",
        texto: "Reumatismo, problema de coluna, musculares, articulares ou ossos?",
        nota: "Caso positivado encaminhar Laudo do Ortopedista.",
      },
      {
        letra: "d",
        texto: "Asma, bronquite, enfisema ou outras doenças pulmonares?",
        nota: "Caso positivado encaminhar Laudo do Pneumologista com Prova de Esforço Respiratório.",
      },
      {
        letra: "e",
        texto: "Doenças de rim, bexiga, próstata, alterações de trato urinário ou órgãos sexuais?",
        nota: "Caso positivado encaminhar Laudo do Urologista.",
      },
      {
        letra: "f",
        texto:
          "Úlcera duodenal, gastrite, icterícia, doenças do fígado, hepatite, doenças da vesícula ou outras do aparelho digestivo?",
        nota: "Caso positivado encaminhar Laudo gástrico e se hepatite, exame de funções hepáticas e marcadores virais.",
      },
      {
        letra: "g",
        texto: "Hemorragias, anemia, hemofilia, leucemia ou outras doenças do sangue?",
        nota: "Caso positivado encaminhar Laudo do médico assistente.",
      },
      {
        letra: "h",
        texto:
          "Doenças neurológicas ou psiquiátricas (vertigens, desmaios, convulsão, dores de cabeça, dificuldades de fala, paralisia ou derrame cerebral, doenças ou alterações mentais ou nervos)?",
        nota: "Caso positivado encaminhar Laudo do Neurologista ou Psiquiatra acompanhado dos exames realizados, se houver.",
      },
      {
        letra: "i",
        texto: "Diabetes, doenças da tireóide ou outras endócrinas?",
        nota: "Caso positivado encaminhar Laudo do Endocrinologista ou médico assistente.",
      },
      {
        letra: "j",
        texto: "Outras doenças ou distúrbios não mencionados acima?",
        nota: "Caso positivado encaminhar Laudo do médico assistente.",
      },
    ],
  },
  {
    numero: 5,
    texto: "Já teve doença COVID19?",
    subitens: [
      { letra: "a", texto: "Já foi vacinado para o coronavírus SARS-COV2?" },
      {
        letra: "b",
        texto: "Em caso positivo, houve internação ou complicações? Encaminhar laudo médico assistente.",
      },
    ],
  },
  {
    numero: 6,
    texto:
      "É ou foi portador de doenças sexualmente transmissíveis ou outras doenças infectocontagiosas tais como HIV, Sífilis, meningite, tuberculose ou outras? Esclareça com data do diagnóstico e tratamento ministrado.",
    esclareca: true,
  },
  {
    numero: 7,
    texto: "É ou foi portador de alguma doença ou lesão produzida pelo trabalho (doença profissional)?",
    esclareca: true,
    nota: "Caso positivado encaminhar Laudo do médico assistente.",
  },
  {
    numero: 8,
    texto:
      "Fez ou faz uso de algum medicamento de forma rotineira? Em caso positivo, esclareça quais os medicamentos e os motivos?",
    esclareca: true,
    nota: "Caso positivado encaminhar Laudo do médico assistente.",
  },
  {
    numero: 9,
    texto:
      "Tem outro(s) Seguro(s) de Vida e/ou Acidentes Pessoais em vigor? Em caso positivo, relacione: Seguradora, data da contratação e valor do capital segurado.",
    esclareca: true,
  },
  {
    numero: 10,
    texto:
      "Foi vítima de acidente ou violência? Em caso positivo, descrever a ocorrência e informar a data de ocorrência e quais as lesões produzidas?",
    esclareca: true,
  },
  {
    numero: 11,
    texto:
      "Sofre ou sofreu nos últimos 5 anos doença que tenha obrigado a hospitalizar-se para tratamento clínico ou cirúrgico, ou afastar-se de suas atividades de trabalho?",
    esclareca: true,
  },
];
