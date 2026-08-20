/**
 * Scan IA — fonte única de tipos de documento, campos esperados por tipo e
 * mapeamento campo extraído → coluna da tabela `clientes`.
 *
 * REGRA DE OURO: nada aqui aplica dados sozinho. Este módulo apenas descreve
 * o que a IA deve procurar e para onde o dado PODE ir depois que um humano
 * confirmar explicitamente, campo por campo.
 *
 * Client-safe (sem imports de servidor).
 */

export const TIPOS_DOCUMENTO = [
  "rg",
  "cnh",
  "cpf",
  "comprovante_renda",
  "comprovante_residencia",
  "certidao_casamento",
  "certidao_nascimento",
  "matricula_imovel",
  "iptu",
  "extrato_bancario",
  "outro",
] as const;

export type TipoDocumentoScan = (typeof TIPOS_DOCUMENTO)[number];

export const TIPO_DOCUMENTO_LABEL: Record<TipoDocumentoScan, string> = {
  rg: "RG / Identidade",
  cnh: "CNH",
  cpf: "CPF",
  comprovante_renda: "Comprovante de renda",
  comprovante_residencia: "Comprovante de residência",
  certidao_casamento: "Certidão de casamento",
  certidao_nascimento: "Certidão de nascimento",
  matricula_imovel: "Matrícula do imóvel",
  iptu: "IPTU / Valor venal",
  extrato_bancario: "Extrato bancário",
  outro: "Outro / não identificado",
};

export function rotuloTipo(tipo: string | null | undefined): string {
  if (!tipo) return "—";
  return TIPO_DOCUMENTO_LABEL[tipo as TipoDocumentoScan] ?? tipo;
}

export function ehTipoConhecido(tipo: string | null | undefined): tipo is TipoDocumentoScan {
  return !!tipo && (TIPOS_DOCUMENTO as readonly string[]).includes(tipo);
}

/** Lista genérica original — fallback do tipo "outro". NÃO REMOVER. */
export const CAMPOS_ESPERADOS = [
  "nome_completo",
  "cpf_cnpj",
  "rg",
  "data_nascimento",
  "estado_civil",
  "renda_mensal",
  "endereco",
  "endereco_completo",
  "endereco_logradouro",
  "endereco_numero",
  "endereco_complemento",
  "endereco_bairro",
  "endereco_cidade",
  "endereco_uf",
  "endereco_cep",
  "cep",
  "telefone",
  "email",
  "valor_imovel",
  "numero_documento",
];

/** Campos esperados por tipo de documento. */
export const CAMPOS_POR_TIPO: Record<TipoDocumentoScan, string[]> = {
  rg: [
    "nome_completo",
    "numero_documento",
    "tipo_documento_identidade",
    "orgao_expedidor",
    "uf_expedicao",
    "data_expedicao",
    "data_nascimento",
    "sexo",
    "nacionalidade",
    "naturalidade",
    "nome_mae",
    "nome_pai",
    "cpf_cnpj",
  ],
  cnh: [
    "nome_completo",
    "numero_documento",
    "tipo_documento_identidade",
    "orgao_expedidor",
    "uf_expedicao",
    "data_expedicao",
    "data_nascimento",
    "sexo",
    "nacionalidade",
    "naturalidade",
    "nome_mae",
    "nome_pai",
    "cpf_cnpj",
  ],
  cpf: ["nome_completo", "cpf_cnpj", "data_nascimento", "nome_mae"],
  comprovante_renda: ["nome_completo", "profissao", "empresa", "renda_mensal"],
  comprovante_residencia: [
    "endereco_titular",
    "endereco_completo",
    "endereco_logradouro",
    "endereco_numero",
    "endereco_complemento",
    "endereco_bairro",
    "endereco_cidade",
    "endereco_uf",
    "endereco_cep",
    // Compatibilidade com leituras antigas/prompts customizados.
    "endereco",
    "cep",
    "bairro",
    "cidade",
    "uf",
  ],
  certidao_casamento: [
    "nome_completo",
    "cpf_cnpj",
    "data_nascimento",
    "naturalidade",
    "nacionalidade",
    "nome_mae",
    "nome_pai",
    "nome_conjuge",
    "cpf_conjuge",
    "data_nascimento_conjuge",
    "conjuge_naturalidade",
    "conjuge_nacionalidade",
    "conjuge_nome_mae",
    "conjuge_profissao",
    "regime_casamento",
    "estado_civil",
    "data_casamento",
    "matricula_certidao",
    "cartorio_certidao",
    "livro_certidao",
    "folha_certidao",
    "termo_certidao",
    "observacoes_certidao",
  ],
  certidao_nascimento: ["nome_completo", "data_nascimento", "nome_mae", "nome_pai", "naturalidade"],
  matricula_imovel: [
    "numero_matricula",
    "cartorio",
    "comarca",
    "uf_imovel",
    "data_abertura_matricula",
    "data_atualizacao_matricula",
    "transcricao_anterior",
    "proprietario",
    "cpf_proprietario",
    "estado_civil_proprietario",
    "nome_conjuge",
    "cpf_conjuge",
    "regime_casamento",
    "tipo_imovel",
    "endereco_imovel",
    "numero_imovel",
    "complemento_imovel",
    "bairro_imovel",
    "cidade_imovel",
    "cep_imovel",
    "area_terreno",
    "area_construida",
    "area_privativa",
    "area_comum",
    "fracao_ideal",
    "numero_vagas",
    "matricula_vaga",
    "confrontacoes",
    "inscricao_imobiliaria",
    "inscricao_iptu",
    "valor_venal",
    "valor_imovel",
    // Compra e venda / transmissões
    "forma_aquisicao",
    "data_aquisicao",
    "vendedor_nome",
    "vendedor_cpf",
    "comprador_nome",
    "comprador_cpf",
    "valor_transacao",
    "data_transacao",
    "itbi_informacao",
    // Ônus, gravames e financiamento
    "onus_gravames",
    "tem_hipoteca",
    "hipoteca_credor",
    "tem_alienacao_fiduciaria",
    "alienacao_credor",
    "alienacao_valor",
    "alienacao_data",
    "alienacao_situacao",
    "alienacao_fiduciaria",
    "tem_interveniente_quitante",
    "interveniente_nome",
    "tem_penhora",
    "tem_usufruto",
    "tem_indisponibilidade",
    "outros_onus",
    // Averbações e regularidade
    "habite_se_averbado",
    "construcao_averbada",
    "edificacao_regularizada",
    // Histórico
    "data_registro",
    "ultimo_registro",
    "historico_atos",
  ],

  iptu: ["valor_imovel", "endereco_imovel", "cep_imovel", "inscricao_imobiliaria"],
  extrato_bancario: ["nome_completo", "banco_conta", "agencia", "conta_corrente"],
  outro: CAMPOS_ESPERADOS,
};

/** União de todos os campos que o Scan IA pode aceitar em qualquer documento legível. */
export const TODOS_CAMPOS_EXTRAIVEIS = Array.from(
  new Set([...CAMPOS_ESPERADOS, ...Object.values(CAMPOS_POR_TIPO).flat()]),
);

export function camposEsperadosDoTipo(tipo: string | null | undefined): string[] {
  return ehTipoConhecido(tipo) ? CAMPOS_POR_TIPO[tipo] : CAMPOS_ESPERADOS;
}

/** Rótulos legíveis por campo (nunca exibir o slug ao usuário). */
export const CAMPO_LABEL: Record<string, string> = {
  nome_completo: "Nome completo",
  cpf_cnpj: "CPF / CNPJ",
  rg: "RG",
  numero_documento: "Número do documento",
  tipo_documento_identidade: "Tipo do documento de identidade",
  orgao_expedidor: "Órgão expedidor",
  uf_expedicao: "UF de expedição",
  data_expedicao: "Data de expedição",
  data_nascimento: "Data de nascimento",
  sexo: "Sexo",
  nacionalidade: "Nacionalidade",
  naturalidade: "Naturalidade",
  nome_mae: "Nome da mãe",
  nome_pai: "Nome do pai",
  profissao: "Profissão",
  empresa: "Empresa",
  renda_mensal: "Renda mensal",
  estado_civil: "Estado civil",
  endereco: "Endereço",
  endereco_titular: "Titular do comprovante de endereço",
  endereco_completo: "Endereço completo",
  endereco_logradouro: "Logradouro",
  endereco_numero: "Número do endereço",
  endereco_complemento: "Complemento do endereço",
  endereco_bairro: "Bairro",
  endereco_cidade: "Cidade",
  endereco_uf: "UF",
  endereco_cep: "CEP",
  cep: "CEP",
  bairro: "Bairro",
  cidade: "Cidade",
  uf: "UF",
  telefone: "Telefone",
  email: "E-mail",
  nome_conjuge: "Nome do cônjuge",
  cpf_conjuge: "CPF do cônjuge",
  data_nascimento_conjuge: "Data de nascimento do cônjuge",
  conjuge_naturalidade: "Naturalidade do cônjuge",
  conjuge_nacionalidade: "Nacionalidade do cônjuge",
  conjuge_nome_mae: "Nome da mãe do cônjuge",
  conjuge_profissao: "Profissão do cônjuge",
  regime_casamento: "Regime de casamento",
  data_casamento: "Data do casamento",
  matricula_certidao: "Matrícula da certidão",
  cartorio_certidao: "Cartório da certidão",
  livro_certidao: "Livro da certidão",
  folha_certidao: "Folha da certidão",
  termo_certidao: "Termo da certidão",
  observacoes_certidao: "Observações da certidão",
  numero_matricula: "Número da matrícula",
  cartorio: "Cartório",
  comarca: "Comarca",
  uf_imovel: "UF do imóvel",
  proprietario: "Proprietário",
  area_terreno: "Área do terreno",
  area_construida: "Área construída",
  onus_gravames: "Ônus e gravames",
  data_registro: "Data do registro",
  endereco_imovel: "Endereço do imóvel",
  cep_imovel: "CEP do imóvel",
  inscricao_imobiliaria: "Inscrição imobiliária",
  cpf_proprietario: "CPF do proprietário",
  estado_civil_proprietario: "Estado civil do proprietário",
  tipo_imovel: "Tipo do imóvel",
  numero_imovel: "Número do imóvel",
  complemento_imovel: "Complemento do imóvel",
  bairro_imovel: "Bairro do imóvel",
  cidade_imovel: "Cidade do imóvel",
  area_privativa: "Área privativa",
  fracao_ideal: "Fração ideal",
  alienacao_fiduciaria: "Alienação fiduciária",
  ultimo_registro: "Último registro / averbação",
  data_abertura_matricula: "Data de abertura da matrícula",
  data_atualizacao_matricula: "Data da última atualização",
  transcricao_anterior: "Transcrição anterior (origem)",
  area_comum: "Área comum",
  numero_vagas: "Nº de vagas",
  matricula_vaga: "Matrícula da vaga",
  confrontacoes: "Confrontações",
  inscricao_iptu: "Inscrição / cadastro IPTU",
  valor_venal: "Valor venal",
  forma_aquisicao: "Forma de aquisição",
  data_aquisicao: "Data de aquisição",
  vendedor_nome: "Vendedor (transmitente)",
  vendedor_cpf: "CPF/CNPJ do vendedor",
  comprador_nome: "Comprador (adquirente)",
  comprador_cpf: "CPF/CNPJ do comprador",
  valor_transacao: "Valor da compra e venda",
  data_transacao: "Data da compra e venda",
  itbi_informacao: "ITBI (guia / valor / data)",
  tem_hipoteca: "Possui hipoteca",
  hipoteca_credor: "Credor da hipoteca",
  tem_alienacao_fiduciaria: "Possui alienação fiduciária",
  alienacao_credor: "Credor da alienação fiduciária",
  alienacao_valor: "Valor da alienação fiduciária",
  alienacao_data: "Data da alienação fiduciária",
  alienacao_situacao: "Situação da alienação (ativa/baixada)",
  tem_interveniente_quitante: "Possui interveniente quitante",
  interveniente_nome: "Interveniente quitante (credor)",
  tem_penhora: "Possui penhora",
  tem_usufruto: "Possui usufruto",
  tem_indisponibilidade: "Possui indisponibilidade",
  outros_onus: "Outros ônus / restrições",
  habite_se_averbado: "Habite-se averbado",
  construcao_averbada: "Construção averbada",
  edificacao_regularizada: "Edificação regularizada",
  historico_atos: "Histórico de atos (R. / AV.)",

  valor_imovel: "Valor do imóvel",
  banco_conta: "Banco",
  agencia: "Agência",
  conta_corrente: "Conta corrente",
};

export function rotuloCampo(campo: string): string {
  return CAMPO_LABEL[campo] ?? campo.replace(/_/g, " ");
}

export type DestinoCampo =
  | {
      tipo: "coluna";
      coluna: string;
      formato?: "texto" | "numero" | "data" | "estado_civil" | "regime_casamento" | "documento";
    }
  | {
      tipo: "endereco";
      coluna: "cep" | "logradouro" | "numero" | "complemento" | "bairro" | "cidade" | "uf";
      formato?: "texto" | "documento";
    }
  | { tipo: "matricula"; chave: string; formato?: "texto" | "data" | "booleano" }
  | { tipo: "nenhum" };

/** Para onde cada campo extraído pode ir na tabela `clientes`. */
export const DESTINO_CAMPO: Record<string, DestinoCampo> = {
  nome_completo: { tipo: "coluna", coluna: "nome" },
  cpf_cnpj: { tipo: "coluna", coluna: "documento", formato: "documento" },
  rg: { tipo: "coluna", coluna: "numero_documento" },
  numero_documento: { tipo: "coluna", coluna: "numero_documento" },
  tipo_documento_identidade: { tipo: "coluna", coluna: "tipo_documento_identidade" },
  orgao_expedidor: { tipo: "coluna", coluna: "orgao_expedidor" },
  uf_expedicao: { tipo: "coluna", coluna: "uf_expedicao" },
  data_expedicao: { tipo: "coluna", coluna: "data_expedicao", formato: "data" },
  data_nascimento: { tipo: "coluna", coluna: "data_nascimento", formato: "data" },
  sexo: { tipo: "coluna", coluna: "sexo" },
  nacionalidade: { tipo: "coluna", coluna: "nacionalidade" },
  naturalidade: { tipo: "coluna", coluna: "naturalidade" },
  nome_mae: { tipo: "coluna", coluna: "mae" },
  nome_pai: { tipo: "coluna", coluna: "pai" },
  profissao: { tipo: "coluna", coluna: "profissao" },
  empresa: { tipo: "coluna", coluna: "empresa" },
  renda_mensal: { tipo: "coluna", coluna: "renda_total_declarada", formato: "numero" },
  estado_civil: { tipo: "coluna", coluna: "estado_civil", formato: "estado_civil" },
  email: { tipo: "coluna", coluna: "email" },
  telefone: { tipo: "coluna", coluna: "telefone_celular", formato: "documento" },
  banco_conta: { tipo: "coluna", coluna: "banco_conta" },
  agencia: { tipo: "coluna", coluna: "agencia" },
  conta_corrente: { tipo: "coluna", coluna: "conta_corrente" },

  // Cônjuge
  nome_conjuge: { tipo: "coluna", coluna: "conjuge_nome" },
  cpf_conjuge: { tipo: "coluna", coluna: "conjuge_cpf", formato: "documento" },
  data_nascimento_conjuge: { tipo: "coluna", coluna: "conjuge_data_nascimento", formato: "data" },
  conjuge_nacionalidade: { tipo: "coluna", coluna: "conjuge_nacionalidade" },
  conjuge_nome_mae: { tipo: "coluna", coluna: "conjuge_nome_mae" },
  conjuge_profissao: { tipo: "coluna", coluna: "conjuge_profissao" },
  regime_casamento: { tipo: "coluna", coluna: "regime_casamento", formato: "regime_casamento" },

  // Endereço principal do cliente (tabela cliente_enderecos)
  endereco: { tipo: "endereco", coluna: "logradouro" },
  endereco_completo: { tipo: "endereco", coluna: "logradouro" },
  endereco_logradouro: { tipo: "endereco", coluna: "logradouro" },
  endereco_numero: { tipo: "endereco", coluna: "numero" },
  endereco_complemento: { tipo: "endereco", coluna: "complemento" },
  endereco_bairro: { tipo: "endereco", coluna: "bairro" },
  endereco_cidade: { tipo: "endereco", coluna: "cidade" },
  endereco_uf: { tipo: "endereco", coluna: "uf" },
  endereco_cep: { tipo: "endereco", coluna: "cep", formato: "documento" },
  cep: { tipo: "endereco", coluna: "cep", formato: "documento" },
  bairro: { tipo: "endereco", coluna: "bairro" },
  cidade: { tipo: "endereco", coluna: "cidade" },
  uf: { tipo: "endereco", coluna: "uf" },

  // Imóvel
  valor_imovel: { tipo: "coluna", coluna: "imovel_valor", formato: "numero" },
  endereco_imovel: { tipo: "coluna", coluna: "imovel_logradouro" },
  cep_imovel: { tipo: "coluna", coluna: "imovel_cep", formato: "documento" },
  uf_imovel: { tipo: "coluna", coluna: "imovel_uf" },

  // Matrícula (jsonb clientes.imovel_matricula — mesclado, nunca sobrescrito por inteiro)
  numero_matricula: { tipo: "matricula", chave: "numero_matricula" },
  cartorio: { tipo: "matricula", chave: "cartorio_nome" },
  comarca: { tipo: "matricula", chave: "comarca" },
  proprietario: { tipo: "matricula", chave: "proprietario_atual" },
  area_terreno: { tipo: "matricula", chave: "area_terreno" },
  area_construida: { tipo: "matricula", chave: "area_construida" },
  onus_gravames: { tipo: "matricula", chave: "onus_gravames" },
  data_registro: { tipo: "matricula", chave: "data_registro" },
  inscricao_imobiliaria: { tipo: "matricula", chave: "inscricao_imobiliaria" },
  cpf_proprietario: { tipo: "matricula", chave: "proprietario_cpf" },
  estado_civil_proprietario: { tipo: "matricula", chave: "estado_civil_proprietario" },
  area_privativa: { tipo: "matricula", chave: "area_privativa" },
  fracao_ideal: { tipo: "matricula", chave: "fracao_ideal" },
  alienacao_fiduciaria: { tipo: "matricula", chave: "alienacao_descricao" },
  ultimo_registro: { tipo: "matricula", chave: "ultimo_registro" },
  data_abertura_matricula: { tipo: "matricula", chave: "data_abertura", formato: "data" },
  data_atualizacao_matricula: { tipo: "matricula", chave: "data_atualizacao", formato: "data" },
  transcricao_anterior: { tipo: "matricula", chave: "transcricao_anterior" },
  area_comum: { tipo: "matricula", chave: "area_comum" },
  numero_vagas: { tipo: "matricula", chave: "numero_vagas" },
  matricula_vaga: { tipo: "matricula", chave: "matricula_vaga" },
  confrontacoes: { tipo: "matricula", chave: "confrontacoes" },
  inscricao_iptu: { tipo: "matricula", chave: "inscricao_iptu" },
  valor_venal: { tipo: "matricula", chave: "valor_venal" },

  // Compra e venda / transmissões
  forma_aquisicao: { tipo: "matricula", chave: "aquisicao_forma" },
  data_aquisicao: { tipo: "matricula", chave: "aquisicao_data", formato: "data" },
  vendedor_nome: { tipo: "matricula", chave: "vendedor_nome" },
  vendedor_cpf: { tipo: "matricula", chave: "vendedor_cpf" },
  comprador_nome: { tipo: "matricula", chave: "comprador_nome" },
  comprador_cpf: { tipo: "matricula", chave: "comprador_cpf" },
  valor_transacao: { tipo: "matricula", chave: "valor_transacao" },
  data_transacao: { tipo: "matricula", chave: "data_transacao", formato: "data" },
  itbi_informacao: { tipo: "matricula", chave: "itbi_informacao" },

  // Ônus, gravames e financiamento
  tem_hipoteca: { tipo: "matricula", chave: "tem_hipoteca", formato: "booleano" },
  hipoteca_credor: { tipo: "matricula", chave: "hipoteca_credor" },
  tem_alienacao_fiduciaria: {
    tipo: "matricula",
    chave: "tem_alienacao_fiduciaria",
    formato: "booleano",
  },
  alienacao_credor: { tipo: "matricula", chave: "alienacao_credor" },
  alienacao_valor: { tipo: "matricula", chave: "alienacao_valor" },
  alienacao_data: { tipo: "matricula", chave: "alienacao_data", formato: "data" },
  alienacao_situacao: { tipo: "matricula", chave: "alienacao_situacao" },
  tem_interveniente_quitante: {
    tipo: "matricula",
    chave: "tem_interveniente_quitante",
    formato: "booleano",
  },
  interveniente_nome: { tipo: "matricula", chave: "interveniente_nome" },
  tem_penhora: { tipo: "matricula", chave: "tem_penhora", formato: "booleano" },
  tem_usufruto: { tipo: "matricula", chave: "tem_usufruto", formato: "booleano" },
  tem_indisponibilidade: {
    tipo: "matricula",
    chave: "tem_indisponibilidade",
    formato: "booleano",
  },
  outros_onus: { tipo: "matricula", chave: "outros_onus" },

  // Averbações
  habite_se_averbado: { tipo: "matricula", chave: "habite_se_averbado", formato: "booleano" },
  construcao_averbada: { tipo: "matricula", chave: "construcao_averbada", formato: "booleano" },
  edificacao_regularizada: {
    tipo: "matricula",
    chave: "edificacao_regularizada",
    formato: "booleano",
  },
  historico_atos: { tipo: "matricula", chave: "historico_atos" },

  tipo_imovel: { tipo: "coluna", coluna: "imovel_tipo" },
  numero_imovel: { tipo: "coluna", coluna: "imovel_numero" },
  complemento_imovel: { tipo: "coluna", coluna: "imovel_complemento" },
  bairro_imovel: { tipo: "coluna", coluna: "imovel_bairro" },
  cidade_imovel: { tipo: "coluna", coluna: "imovel_cidade" },
  // Dados informativos sem destino direto no cadastro atual.
  endereco_titular: { tipo: "nenhum" },
  conjuge_naturalidade: { tipo: "nenhum" },
  data_casamento: { tipo: "nenhum" },
  matricula_certidao: { tipo: "nenhum" },
  cartorio_certidao: { tipo: "nenhum" },
  livro_certidao: { tipo: "nenhum" },
  folha_certidao: { tipo: "nenhum" },
  termo_certidao: { tipo: "nenhum" },
  observacoes_certidao: { tipo: "nenhum" },
};

export function destinoDoCampo(campo: string): DestinoCampo {
  return DESTINO_CAMPO[campo] ?? { tipo: "nenhum" };
}

export const ESTADOS_CIVIS = [
  "solteiro",
  "casado",
  "uniao_estavel",
  "divorciado",
  "viuvo",
] as const;

export const REGIMES_CASAMENTO = [
  "comunhao_parcial",
  "comunhao_universal",
  "separacao_total",
  "participacao_final",
  "nao_aplicavel",
] as const;

function semAcento(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function normalizarEstadoCivil(valor: string): string | null {
  const v = semAcento(valor);
  if (v.includes("solteir")) return "solteiro";
  if (v.includes("uniao")) return "uniao_estavel";
  if (v.includes("casad")) return "casado";
  if (v.includes("divorc") || v.includes("separad")) return "divorciado";
  if (v.includes("viuv")) return "viuvo";
  return null;
}

export function normalizarRegimeCasamento(valor: string): string | null {
  const v = semAcento(valor);
  if (v.includes("universal")) return "comunhao_universal";
  if (v.includes("parcial")) return "comunhao_parcial";
  if (v.includes("separacao") || v.includes("separaç")) return "separacao_total";
  if (v.includes("participacao")) return "participacao_final";
  if (v.includes("nao aplic")) return "nao_aplicavel";
  return null;
}

/** Converte "R$ 1.234,56" / "1234.56" para número; retorna null se não der. */
export function normalizarNumero(valor: string): number | null {
  const limpo = valor.replace(/[^\d,.-]/g, "").trim();
  if (!limpo) return null;
  const temVirgula = limpo.includes(",");
  const norm = temVirgula ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

/** Converte "12/03/1985" ou "1985-03-12" para ISO yyyy-mm-dd; null se inválido. */
export function normalizarData(valor: string): string | null {
  const v = valor.trim();
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

/** Converte o valor de texto extraído para o formato aceito pela coluna destino. */
export function converterValor(
  campo: string,
  valor: string,
): { ok: true; valor: string | number | boolean | null } | { ok: false; motivo: string } {
  const destino = destinoDoCampo(campo);
  const bruto = valor.trim();
  if (!bruto) return { ok: false, motivo: "Valor vazio." };
  if (destino.tipo === "endereco") {
    if (destino.formato === "documento") {
      const d = bruto.replace(/\D+/g, "");
      return d ? { ok: true, valor: d } : { ok: false, motivo: "Documento inválido." };
    }
    if (destino.coluna === "uf") return { ok: true, valor: bruto.slice(0, 2).toUpperCase() };
    return { ok: true, valor: bruto };
  }
  if (destino.tipo === "matricula") {
    if (destino.formato === "data") {
      const d = normalizarData(bruto);
      return { ok: true, valor: d ?? bruto };
    }
    if (destino.formato === "booleano") {
      const v = semAcento(bruto);
      const negativo = /^(nao|n|false|0|inexistente|nenhum|nenhuma|sem)\b/.test(v);
      const positivo = /^(sim|s|true|1|existe|possui|averbad|constitu|ativa)/.test(v);
      if (!negativo && !positivo) return { ok: true, valor: bruto };
      return { ok: true, valor: positivo };
    }
    return { ok: true, valor: bruto };
  }
  if (destino.tipo === "nenhum") return { ok: false, motivo: "Campo sem destino no cadastro." };

  switch (destino.formato) {
    case "numero": {
      const n = normalizarNumero(bruto);
      return n === null ? { ok: false, motivo: "Número inválido." } : { ok: true, valor: n };
    }
    case "data": {
      const d = normalizarData(bruto);
      return d === null ? { ok: false, motivo: "Data inválida." } : { ok: true, valor: d };
    }
    case "documento": {
      const d = bruto.replace(/\D+/g, "");
      return d ? { ok: true, valor: d } : { ok: false, motivo: "Documento inválido." };
    }
    case "estado_civil": {
      const e = normalizarEstadoCivil(bruto);
      return e === null
        ? { ok: false, motivo: "Estado civil não reconhecido." }
        : { ok: true, valor: e };
    }
    case "regime_casamento": {
      const r = normalizarRegimeCasamento(bruto);
      return r === null ? { ok: false, motivo: "Regime não reconhecido." } : { ok: true, valor: r };
    }
    default:
      return { ok: true, valor: bruto };
  }
}

/** Faixa de confiança usada na UI e nas regras de marcação padrão. */
export function faixaConfianca(c: number | null | undefined): "alta" | "media" | "revisar" {
  const v = c ?? 0;
  if (v >= 0.9) return "alta";
  if (v >= 0.6) return "media";
  return "revisar";
}

export const CONFIANCA_LABEL: Record<"alta" | "media" | "revisar", string> = {
  alta: "Alta",
  media: "Média",
  revisar: "Revisar",
};

/**
 * Comparação tolerante para detectar conflito real entre o valor já cadastrado
 * e o valor extraído: ignora pontuação, acentos, espaços e caixa. Ex.: o CPF
 * "429.914.268-37" é o MESMO valor de "42991426837" — não é conflito.
 */
export function valoresEquivalentes(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const norm = (v: string | null | undefined) => {
    const t = String(v ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
    if (!t) return "";
    const digitos = t.replace(/\D+/g, "");
    // Valores essencialmente numéricos (documentos, telefones, CEP, datas):
    // compara apenas os dígitos.
    if (digitos.length >= 6 && t.replace(/[^a-z]/g, "").length === 0) return digitos;
    return t
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };
  return norm(a) === norm(b);
}
