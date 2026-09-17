/**
 * Dados do imóvel, da vistoria e do interveniente quitante na oportunidade.
 *
 * Módulo puro (sem banco, sem rede) para ser testado.
 *
 * Nenhum destes dados chegava à HomeFin: o contato da vistoria e o IQ ficavam
 * só no checklist do cliente, e o endereço do imóvel — presente em 161 de 161
 * propostas de 30 dias — aparecia vazio em todas as oportunidades de lá.
 *
 * Campos do `PUT /oportunidade/{id}` (Opportunity) usados aqui: `cep`,
 * `logradouro`, `numeroLogradouro`, `complementoLogradouro`, `bairro`,
 * `municipio`, `uf`, `contatoAvaliacao`, `telefoneContatoAvaliacao` (só
 * números), `nomeIntervenienteQuitante` e `descricaoIntervenienteQuitante`.
 * A API NÃO tem campo para quantidade de vagas.
 */

export interface DadosImovelOportunidade {
  payload: Record<string, string>;
  /** Rótulo legível de cada campo do payload, para mostrar ao usuário. */
  rotulos: Record<string, string>;
  /** O que o usuário preencheu e a API não tem onde receber. */
  semCampoNaApi: string[];
}

export const ROTULOS_IMOVEL: Record<string, string> = {
  cep: "CEP do imóvel",
  logradouro: "Logradouro",
  numeroLogradouro: "Número",
  complementoLogradouro: "Complemento",
  bairro: "Bairro",
  municipio: "Município",
  uf: "UF",
  contatoAvaliacao: "Contato da vistoria",
  telefoneContatoAvaliacao: "Telefone da vistoria",
  nomeIntervenienteQuitante: "Interveniente quitante",
  descricaoIntervenienteQuitante: "Descrição do interveniente quitante",
};

const texto = (v: unknown) => String(v ?? "").trim();
const digitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

export function montarDadosImovelOportunidade(
  proposta: {
    cep_imovel?: unknown;
    endereco_imovel?: unknown;
    numero_imovel?: unknown;
    complemento_imovel?: unknown;
    bairro_imovel?: unknown;
    cidade_imovel?: unknown;
    uf?: unknown;
    iq_nome?: unknown;
    iq_comentario?: unknown;
    contato_avaliacao_nome?: unknown;
    contato_avaliacao_telefone?: unknown;
  },
  checklist: Record<string, unknown> | null | undefined,
): DadosImovelOportunidade {
  const c = checklist ?? {};
  const payload: Record<string, string> = {};
  const por = (campo: string, valor: string) => {
    if (valor) payload[campo] = valor;
  };

  const cep = digitos(proposta.cep_imovel);
  if (cep.length === 8) por("cep", cep);
  por("logradouro", texto(proposta.endereco_imovel));
  por("numeroLogradouro", texto(proposta.numero_imovel));
  por("complementoLogradouro", texto(proposta.complemento_imovel));
  por("bairro", texto(proposta.bairro_imovel));
  por("municipio", texto(proposta.cidade_imovel));
  const uf = texto(proposta.uf).toUpperCase();
  if (/^[A-Z]{2}$/.test(uf)) por("uf", uf);

  // A conferência da proposta grava nos dois lugares; o checklist do CRM é a
  // reserva para propostas que ainda não passaram por ela.
  por("contatoAvaliacao", texto(proposta.contato_avaliacao_nome) || texto(c.i_vistoria_nome));
  const tel = digitos(proposta.contato_avaliacao_telefone) || digitos(c.i_vistoria_tel);
  if (tel.length >= 10) por("telefoneContatoAvaliacao", tel);

  // IQ: o nome vem da aba IQ da proposta. "IQ? Não" no checklist não envia nada.
  const iqNao = texto(c.i_iq).toLowerCase() === "nao";
  if (!iqNao) {
    por("nomeIntervenienteQuitante", texto(proposta.iq_nome));
    if (payload.nomeIntervenienteQuitante) {
      por("descricaoIntervenienteQuitante", texto(proposta.iq_comentario));
    }
  }

  const semCampoNaApi: string[] = [];
  if (texto(c.i_vagas)) semCampoNaApi.push("Quantidade de vagas do imóvel");

  const rotulos: Record<string, string> = {};
  for (const k of Object.keys(payload)) rotulos[k] = ROTULOS_IMOVEL[k] ?? k;
  return { payload, rotulos, semCampoNaApi };
}

/**
 * Compara o que foi enviado com a oportunidade devolvida pelo PUT. A API
 * responde 200 mesmo quando descarta um campo; só a resposta diz o que ficou.
 */
export function conferirGravacao(
  enviado: Record<string, string>,
  resposta: Record<string, unknown> | null | undefined,
): { confirmados: string[]; naoConfirmados: string[] } {
  const r = resposta ?? {};
  const confirmados: string[] = [];
  const naoConfirmados: string[] = [];
  for (const [campo, valor] of Object.entries(enviado)) {
    const volta = r[campo];
    const igual =
      volta != null &&
      (String(volta).trim() === valor ||
        (digitos(volta) === digitos(valor) && digitos(valor).length > 0));
    (igual ? confirmados : naoConfirmados).push(campo);
  }
  return { confirmados, naoConfirmados };
}
