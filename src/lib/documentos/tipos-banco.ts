/**
 * Tipos de documento: nome legível e termos para achar a vaga no checklist
 * da HomeFin.
 *
 * Módulo puro, usado no servidor (envio) e na tela (anexo).
 *
 * O checklist grava `tipo_documento` como a chave interna do item (`c_doc_id`,
 * `c_cert_ec`, `i_iptu`, `v_doc_id`…). O envio tentava casar essa chave com o
 * `nomeDocumento` da HomeFin ("RG", "Certidão de casamento") e nunca casava —
 * só por sorte, pelo nome do arquivo. Aqui cada chave vira um nome e uma lista
 * de termos que aparecem no nome da vaga.
 */
import { TIPOS_DOCUMENTO_POR_CATEGORIA, type CategoriaDocumento } from "@/lib/crm/documento-tipos";

interface TipoConhecido {
  nome: string;
  termos: string[];
}

const IDENTIDADE = ["identidade", "rg", "cnh", "identificacao", "documento pessoal"];
const PROPOSTA = ["proposta de financiamento", "proposta"];
const DPS = ["declaracao pessoal de saude", "saude", "dps"];
const CPF = ["cpf"];
const ENDERECO = ["comprovante de residencia", "comprovante de endereco", "residencia", "endereco"];
const ESTADO_CIVIL = [
  "certidao de casamento",
  "certidao de nascimento",
  "estado civil",
  "averbacao",
  "certidao",
];

/** Chaves do checklist (vendedor sem o prefixo de vendedor adicional). */
const POR_CHAVE: Record<string, TipoConhecido> = {
  c_doc_id: { nome: "Documento de identidade (RG, CPF ou CNH)", termos: IDENTIDADE },
  c_doc_id_conj: { nome: "Documento de identidade do cônjuge", termos: IDENTIDADE },
  c_comp_end: { nome: "Comprovante de endereço atualizado", termos: ENDERECO },
  c_prop_fin: { nome: "Proposta de Financiamento Imobiliário assinada", termos: PROPOSTA },
  c_dps: { nome: "Declaração Pessoal de Saúde (DPS)", termos: DPS },
  c_cpf: { nome: "CPF", termos: CPF },
  c_form_aut: {
    nome: "Formulário de Autorização",
    termos: ["formulario de autorizacao", "autorizacao"],
  },
  c_prop_fin_conj: {
    nome: "Proposta de Financiamento Imobiliário assinada pelo cônjuge",
    termos: PROPOSTA,
  },
  c_dps_conj: { nome: "Declaração Pessoal de Saúde (DPS) do cônjuge", termos: DPS },
  c_cpf_conj: { nome: "CPF do cônjuge", termos: CPF },
  c_cert_ec: { nome: "Certidão de estado civil", termos: ESTADO_CIVIL },
  fgts_end: { nome: "Comprovante de endereço (FGTS)", termos: ENDERECO },
  fgts_irpf: {
    nome: "IRPF completo com recibo",
    termos: ["imposto de renda", "irpf", "declaracao de ir", "declaracao"],
  },
  fgts_ctps: { nome: "CTPS digital completa", termos: ["carteira de trabalho", "ctps"] },
  fgts_extrato: {
    nome: "Extrato atualizado do FGTS",
    termos: ["extrato do fgts", "extrato fgts", "fgts"],
  },
  v_doc_id: { nome: "Documento de identidade (RG ou CNH)", termos: IDENTIDADE },
  v_doc_id_conj: { nome: "Documento de identidade do cônjuge", termos: IDENTIDADE },
  v_comp_end: { nome: "Comprovante de endereço atualizado", termos: ENDERECO },
  v_cert_ec: { nome: "Certidão de estado civil", termos: ESTADO_CIVIL },
  v_contrato_social: {
    nome: "Contrato social / última alteração",
    termos: ["contrato social", "alteracao contratual"],
  },
  v_cnpj: { nome: "Cartão CNPJ", termos: ["cartao cnpj", "cnpj"] },
  v_doc_socios: { nome: "Documento dos sócios", termos: ["socios", ...IDENTIDADE] },
  v_comp_end_pj: { nome: "Comprovante de endereço da empresa", termos: ENDERECO },
  i_matricula: {
    nome: "Matrícula atualizada com certidão de ônus",
    termos: ["matricula", "onus", "certidao de inteiro teor"],
  },
  i_iptu: { nome: "Capa do IPTU ou Certidão de Valor Venal", termos: ["iptu", "valor venal"] },
  i_cnd_cond: { nome: "CND condominial", termos: ["condominio", "condominial", "cnd"] },
  i_planta: { nome: "Planta de quadra e lote", termos: ["planta", "quadra"] },
};

/** Mesmo termo para os nomes legíveis do catálogo (anexo feito por pasta). */
const POR_NOME: Record<string, TipoConhecido> = Object.fromEntries(
  Object.values(POR_CHAVE).map((t) => [normalizar(t.nome), t]),
);

export function normalizar(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Tira o prefixo de vendedor adicional (`vendedor2_v_doc_id` → `v_doc_id`). */
function chaveBase(tipo: string): string {
  const m = tipo.match(/(c_|v_|i_|fgts_)[a-z_]+$/);
  return m ? m[0] : tipo;
}

function conhecido(tipo: unknown): TipoConhecido | null {
  const t = String(tipo ?? "").trim();
  if (!t) return null;
  return POR_CHAVE[chaveBase(t)] ?? POR_NOME[normalizar(t)] ?? null;
}

/** Nome legível do tipo (chave interna vira texto; texto livre fica igual). */
export function nomeDoTipoDocumento(tipo: unknown): string {
  const k = conhecido(tipo);
  if (k) return k.nome;
  const t = String(tipo ?? "").trim();
  return t.startsWith("custom_") ? "Documento adicional" : t;
}

/**
 * Tipos que só podem subir na vaga do próprio tipo. Sem ela, o documento NÃO
 * vai para a vaga de reserva: subiria com o código de outro documento (ex.:
 * como "estado civil") e poderia ser repassado ao banco com o tipo errado.
 */
const SO_VAGA_PROPRIA = new Set(["formulario de autorizacao"]);

export function exigeVagaPropria(tipo: unknown): boolean {
  return SO_VAGA_PROPRIA.has(normalizar(nomeDoTipoDocumento(tipo)));
}

/** Termos que identificam a vaga do banco para este tipo. */
export function termosDoTipoDocumento(tipo: unknown): string[] {
  const k = conhecido(tipo);
  if (k) return k.termos;
  const n = normalizar(nomeDoTipoDocumento(tipo));
  return n ? [n] : [];
}

/** Palavras-chave no nome do arquivo → tipo do catálogo da categoria. */
const PISTAS: { termos: RegExp; tipoIndice: Partial<Record<CategoriaDocumento, number>> }[] = [
  {
    termos: /\b(rg|cnh|identidade|documento)\b/,
    tipoIndice: { comprador: 0, conjuge: 0, vendedor: 0, vendedor_conjuge: 0 },
  },
  {
    termos: /(endereco|residencia|comprovante|conta de (luz|agua))/,
    tipoIndice: { comprador: 1, vendedor: 1 },
  },
  {
    termos: /(certidao|casamento|nascimento|estado civil|averbacao)/,
    tipoIndice: { comprador: 2, vendedor: 2 },
  },
  { termos: /(proposta de financiamento|proposta)/, tipoIndice: { comprador: 7, conjuge: 1 } },
  { termos: /(\bdps\b|saude)/, tipoIndice: { comprador: 8, conjuge: 2 } },
  { termos: /\bcpf\b/, tipoIndice: { comprador: 9, conjuge: 3 } },
  { termos: /(formulario de autorizacao|autorizacao)/, tipoIndice: { comprador: 10 } },
  { termos: /(irpf|imposto|declaracao)/, tipoIndice: { comprador: 4 } },
  { termos: /(ctps|carteira de trabalho)/, tipoIndice: { comprador: 5 } },
  { termos: /\bfgts\b/, tipoIndice: { comprador: 6 } },
  { termos: /(contrato social|alteracao)/, tipoIndice: { vendedor: 3 } },
  { termos: /\bcnpj\b/, tipoIndice: { vendedor: 4 } },
  { termos: /(matricula|onus)/, tipoIndice: { imovel: 0 } },
  { termos: /(iptu|venal)/, tipoIndice: { imovel: 1 } },
  { termos: /(condominio|condominial|\bcnd\b)/, tipoIndice: { imovel: 2 } },
  { termos: /planta/, tipoIndice: { imovel: 3 } },
];

/** Sugere o tipo pelo nome do arquivo; `""` quando não há pista. */
export function sugerirTipoDocumento(nomeArquivo: string, categoria: CategoriaDocumento): string {
  const n = normalizar(nomeArquivo.replace(/\.[^.]+$/, ""));
  const lista = TIPOS_DOCUMENTO_POR_CATEGORIA[categoria] ?? [];
  for (const p of PISTAS) {
    const i = p.tipoIndice[categoria];
    if (i != null && p.termos.test(n) && lista[i]) return lista[i];
  }
  return "";
}
