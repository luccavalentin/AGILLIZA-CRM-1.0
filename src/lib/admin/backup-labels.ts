// ============================================================================
// Humanização do backup em Excel.
// Usuários leigos não entendem códigos/IDs técnicos, então aqui:
//  - colunas técnicas (id, *_id, timestamps internos) são ocultadas;
//  - nomes de colunas viram rótulos amigáveis em português;
//  - valores codificados (PF/PJ, status, booleanos, datas) viram texto legível.
// ============================================================================

import type { BackupCompleto, TabelaExportada } from "@/lib/admin/backup.functions";

type Valor = string | number | boolean | null;

// Colunas ocultadas em QUALQUER tabela (códigos internos sem valor para o leigo).
const COLUNAS_OCULTAS = new Set<string>([
  "id",
  "correspondente_id",
  "criador_id",
  "created_by",
  "updated_by",
  "user_id",
  "usuario_id",
  "nivel_acesso_id",
  "parceiro_id",
  "vendedor_id",
  "search_vector",
  "tsv",
]);

// Oculta colunas que são claramente identificadores técnicos.
function colunaTecnica(col: string): boolean {
  if (COLUNAS_OCULTAS.has(col)) return true;
  // Qualquer coluna terminada em _id é uma chave técnica (cliente_id, proposta_id…).
  if (/_id$/.test(col)) return true;
  return false;
}

// Rótulos amigáveis para colunas comuns em várias tabelas.
const ROTULOS: Record<string, string> = {
  numero_cliente: "Nº do Cliente",
  numero_proposta: "Nº da Proposta",
  numero_simulacao: "Nº da Simulação",
  tipo_pessoa: "Tipo de Pessoa",
  nome: "Nome",
  nome_completo: "Nome Completo",
  razao_social: "Razão Social",
  nome_fantasia: "Nome Fantasia",
  documento: "CPF / CNPJ",
  documento_secundario: "Documento Secundário",
  data_nascimento: "Data de Nascimento",
  estado_civil: "Estado Civil",
  email: "E-mail",
  telefone: "Telefone",
  celular: "Celular",
  status: "Situação",
  situacao: "Situação",
  etapa: "Etapa",
  fase: "Fase",
  valor: "Valor",
  valor_total: "Valor Total",
  valor_imovel: "Valor do Imóvel",
  valor_financiamento: "Valor do Financiamento",
  valor_entrada: "Valor de Entrada",
  valor_parcela: "Valor da Parcela",
  valor_solicitado: "Valor Solicitado",
  valor_aprovado: "Valor Aprovado",
  prazo: "Prazo (meses)",
  prazo_meses: "Prazo (meses)",
  taxa_juros: "Taxa de Juros",
  amortizacao: "Sistema de Amortização",
  renda: "Renda",
  renda_bruta: "Renda Bruta",
  banco: "Banco",
  banco_nome: "Banco",
  profissao: "Profissão",
  cep: "CEP",
  logradouro: "Logradouro",
  numero: "Número",
  complemento: "Complemento",
  bairro: "Bairro",
  cidade: "Cidade",
  estado: "Estado (UF)",
  uf: "UF",
  observacoes: "Observações",
  descricao: "Descrição",
  titulo: "Título",
  categoria: "Categoria",
  tipo: "Tipo",
  data_vencimento: "Data de Vencimento",
  data_pagamento: "Data de Pagamento",
  data_emissao: "Data de Emissão",
  data_conclusao: "Data de Conclusão",
  prioridade: "Prioridade",
  responsavel: "Responsável",
  created_at: "Criado em",
  updated_at: "Atualizado em",
  ativo: "Ativo",
};

// Converte nome técnico em rótulo amigável (fallback: Title Case).
export function rotularColuna(col: string): string {
  if (ROTULOS[col]) return ROTULOS[col];
  return col
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Mapas de valores codificados por nome de coluna.
const VALORES: Record<string, Record<string, string>> = {
  tipo_pessoa: { PF: "Pessoa Física", PJ: "Pessoa Jurídica" },
  amortizacao: { SAC: "SAC", PRICE: "PRICE", sac: "SAC", price: "PRICE" },
  prioridade: {
    baixa: "Baixa",
    media: "Média",
    alta: "Alta",
    urgente: "Urgente",
  },
  status: {
    ativo: "Ativo",
    inativo: "Inativo",
    pendente: "Pendente",
    aprovado: "Aprovado",
    reprovado: "Reprovado",
    cancelado: "Cancelado",
    concluido: "Concluído",
    em_andamento: "Em andamento",
    processando: "Processando",
    enviado: "Enviado",
    erro: "Erro",
    aberto: "Aberto",
    fechado: "Fechado",
    pago: "Pago",
    vencido: "Vencido",
    a_pagar: "A pagar",
    a_receber: "A receber",
  },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}.*)?$/;

function humanizarValor(col: string, v: Valor): Valor {
  if (v === null || v === undefined || v === "") return v;

  // Booleanos → Sim/Não
  if (typeof v === "boolean") return v ? "Sim" : "Não";

  if (typeof v === "string") {
    // Mapa de valores codificados
    const mapa = VALORES[col];
    if (mapa && mapa[v]) return mapa[v];
    if (mapa && mapa[v.toLowerCase()]) return mapa[v.toLowerCase()];

    // Datas ISO → pt-BR
    if (ISO_DATE_RE.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) {
        // Se tem hora, mostra data+hora; senão só data.
        return v.includes("T")
          ? d.toLocaleString("pt-BR")
          : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      }
    }

    // UUID solto num campo qualquer → oculta (vira vazio)
    if (UUID_RE.test(v)) return "";
  }

  return v;
}

// Colunas cujos TODOS os valores são UUID → ocultar (identificadores disfarçados).
function colunaSoUUID(tabela: TabelaExportada, col: string): boolean {
  let temValor = false;
  for (const linha of tabela.linhas) {
    const v = linha[col];
    if (v === null || v === undefined || v === "") continue;
    temValor = true;
    if (typeof v !== "string" || !UUID_RE.test(v)) return false;
  }
  return temValor;
}

/** Retorna uma cópia do backup com colunas e valores legíveis para leigos. */
export function humanizarBackup(dados: BackupCompleto): BackupCompleto {
  const tabelas: TabelaExportada[] = dados.tabelas.map((t) => {
    const visiveis = t.colunas.filter(
      (c) => !colunaTecnica(c) && !colunaSoUUID(t, c),
    );

    const linhas = t.linhas.map((linha) => {
      const nova: Record<string, Valor> = {};
      for (const col of visiveis) {
        nova[rotularColuna(col)] = humanizarValor(col, linha[col] ?? null);
      }
      return nova;
    });

    return {
      label: t.label,
      tabela: t.tabela,
      colunas: visiveis.map(rotularColuna),
      linhas,
    };
  });

  return { geradoEm: dados.geradoEm, tabelas };
}
