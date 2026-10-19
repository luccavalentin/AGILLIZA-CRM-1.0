/**
 * Completa os participantes da oportunidade antes de criar as simulações.
 *
 * O `POST /oportunidade` cria o titular (e o cônjuge) só com nome, CPF,
 * nascimento, estado civil, renda e contato. Sexo, regime de casamento, mãe,
 * documento, profissão e endereço ficavam vazios até a proposta — e por meses
 * os bancos simularam assim. A partir de 18/10/2026 ~16h58 a HomeFin passou a
 * devolver `500 INTERNAL_ERROR` ao criar e integrar simulações nessas
 * oportunidades, e o suporte deles apontou os participantes sem informação.
 * As oportunidades que funcionaram no sábado tinham exatamente os mesmos campos
 * vazios: a regra mudou do lado deles.
 *
 * Aqui montamos o `PUT /oportunidade/{id}/participante/{id}` com o cadastro do
 * cliente e, onde estiver vazio, os mesmos padrões já usados no envio da
 * proposta. O que já está preenchido na HomeFin é mantido.
 *
 * Módulo puro: sem I/O, para ser testado.
 */

import { estadoCivilCrmParaCodigo, regimeCasamentoCrmParaCodigo } from "@/lib/propostas/dominios";
import {
  ENDERECO_PADRAO,
  PADROES_CADASTRO,
  celularConjugeOuPadrao,
  emailConjugeOuPadrao,
  rendaConjugeOuPadrao,
  rgDoCpf,
} from "@/lib/crm/padroes-cadastro";
import { fgAutorizacaoDadosParticipante } from "./autorizacao-dados";

/** Campos do `CreateParticipantRequest` (o PUT usa o mesmo contrato). */
const CAMPOS_CONTRATO = [
  "tipoSituacao",
  "nomeParticipante",
  "tipoQualificacao",
  "tipoPessoa",
  "cpfCnpj",
  "dataNascimento",
  "nomeMae",
  "tipoSexo",
  "tipoEstadoCivil",
  "tipoRegimeCasamento",
  "tipoDocumentoIdentidade",
  "numeroDocumento",
  "dataExpedicao",
  "orgaoExpedidor",
  "ufExpedicao",
  "nomeProfissao",
  "nomeEmpresaProfissao",
  "renda",
  "idBanco",
  "codigoAgencia",
  "codigoContaCorrente",
  "digitoContaCorrente",
  "email",
  "celular",
  "cep",
  "logradouro",
  "numeroLogradouro",
  "complementoLogradouro",
  "bairro",
  "municipio",
  "uf",
  "utilizaFgts",
  "fgAutorizacaoDados",
  "nomeConjuge",
  "cpfConjuge",
  "dataNascimentoConjuge",
  "tipoEstadoCivilConjuge",
  "tipoDocumentoIdentidadeConjuge",
  "numeroDocumentoConjuge",
  "dataExpedicaoConjuge",
  "orgaoExpedidorConjuge",
  "ufExpedicaoConjuge",
  "nomeProfissaoConjuge",
  "rendaConjuge",
  "nomeEmpresaProfissaoConjuge",
  "tipoSexoConjuge",
] as const;

const vazio = (v: unknown) => v === null || v === undefined || String(v).trim() === "";
const texto = (v: unknown): string | undefined => (vazio(v) ? undefined : String(v).trim());
const digitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const primeiro = (...vs: unknown[]) => vs.map(texto).find((v) => v !== undefined);

/** "M"/"F" a partir de "M", "masculino", "F", "feminino". */
function sexo(v: unknown): string | undefined {
  const s = texto(v)?.charAt(0).toUpperCase();
  return s === "M" || s === "F" ? s : undefined;
}

const ESTADOS_CASADO = new Set(["CA", "UE"]);

/** Falha do servidor da HomeFin (não do pedido): vale tentar de novo. */
const STATUS_REPETIVEL = new Set([500, 502, 503, 504]);

/**
 * Executa `fn` e repete quando a HomeFin devolve erro de servidor (500/502/
 * 503/504) ou nem responde. Só para chamadas seguras de repetir — `GET` e o
 * `PUT` de participante, que atualiza o mesmo registro. Erro do pedido (4xx)
 * não se repete: mandar igual daria o mesmo erro.
 */
export async function repetirEmFalhaDoServidor<T>(
  fn: () => Promise<T>,
  esperasMs: number[] = [1500, 3000, 4500],
): Promise<T> {
  for (let tentativa = 0; ; tentativa++) {
    try {
      return await fn();
    } catch (e: any) {
      const status = e?.statusHttp;
      const repetivel = status === undefined || STATUS_REPETIVEL.has(Number(status));
      if (!repetivel || tentativa >= esperasMs.length) throw e;
      await new Promise((r) => setTimeout(r, esperasMs[tentativa]));
    }
  }
}

export type PapelParticipante = "titular" | "conjuge";

/** De quem é o participante: titular, cônjuge do titular ou outro (não mexemos). */
export function papelDoParticipante(part: any, sim: any): PapelParticipante | null {
  const cpf = digitos(part?.cpfCnpj);
  if (!cpf || cpf.length > 11) return null; // PJ tem fluxo próprio
  if (String(part?.tipoQualificacao ?? "CO").toUpperCase() === "VD") return null;
  if (cpf === digitos(sim?.cpf_cnpj)) return "titular";
  if (cpf === digitos(sim?.cpf_conjuge)) return "conjuge";
  return null;
}

/**
 * Payload do PUT para um participante, ou `null` quando ele já está completo.
 *
 * `sim` é a linha de `simulacoes`; `cliente` é a linha de `clientes` do titular
 * (as colunas `conjuge_*` descrevem o cônjuge dele).
 */
export function payloadCompletarParticipante(
  part: any,
  papel: PapelParticipante,
  sim: any,
  cliente: any,
): Record<string, unknown> | null {
  const c = cliente ?? {};
  const ehTitular = papel === "titular";
  const cpf = digitos(part?.cpfCnpj);

  const estadoCivil =
    texto(part?.tipoEstadoCivil) ??
    (estadoCivilCrmParaCodigo(
      ehTitular ? (sim?.estado_civil ?? c.estado_civil) : (sim?.estado_civil_conjuge ?? sim?.estado_civil),
    ) ||
      undefined);
  const casado = ESTADOS_CASADO.has(String(estadoCivil ?? "").toUpperCase());

  const completo: Record<string, unknown> = {
    tipoSituacao: "A",
    tipoQualificacao: "CO",
    tipoPessoa: "F",
    tipoEstadoCivil: estadoCivil,
    tipoSexo: ehTitular
      ? (sexo(sim?.sexo) ?? sexo(c.sexo) ?? "M")
      : (sexo(sim?.sexo_conjuge) ?? sexo(c.conjuge_sexo) ?? "F"),
    tipoRegimeCasamento: casado
      ? regimeCasamentoCrmParaCodigo(primeiro(sim?.regime_casamento, c.regime_casamento)) || "CP"
      : undefined,
    nomeMae: ehTitular
      ? (primeiro(c.mae) ?? PADROES_CADASTRO.mae)
      : (primeiro(c.conjuge_nome_mae) ?? PADROES_CADASTRO.maeConjuge),
    tipoDocumentoIdentidade:
      primeiro(ehTitular ? c.tipo_documento_identidade : c.conjuge_tipo_documento_identidade) ??
      PADROES_CADASTRO.tipoDocumentoIdentidade,
    numeroDocumento:
      primeiro(ehTitular ? c.numero_documento : c.conjuge_numero_documento) ?? rgDoCpf(cpf),
    dataExpedicao:
      primeiro(ehTitular ? c.data_expedicao : c.conjuge_data_expedicao) ??
      PADROES_CADASTRO.dataExpedicao,
    orgaoExpedidor:
      primeiro(ehTitular ? c.orgao_expedidor : c.conjuge_orgao_expedidor) ??
      PADROES_CADASTRO.orgaoExpedidor,
    ufExpedicao:
      primeiro(ehTitular ? c.uf_expedicao : c.conjuge_uf_expedicao) ?? PADROES_CADASTRO.ufExpedicao,
    nomeProfissao:
      primeiro(ehTitular ? c.profissao : c.conjuge_profissao) ?? PADROES_CADASTRO.profissao,
    nomeEmpresaProfissao:
      primeiro(ehTitular ? c.empresa : c.conjuge_empresa) ?? PADROES_CADASTRO.empresa,
    renda: ehTitular ? undefined : rendaConjugeOuPadrao(sim?.renda_conjuge ?? c.conjuge_renda),
    email: ehTitular ? undefined : emailConjugeOuPadrao(sim?.email_conjuge ?? c.conjuge_email),
    celular: ehTitular
      ? undefined
      : celularConjugeOuPadrao(sim?.celular_conjuge ?? c.conjuge_celular, sim?.celular),
    utilizaFgts: String(sim?.utiliza_fgts ?? "N") === "S" ? "S" : "N",
    fgAutorizacaoDados: fgAutorizacaoDadosParticipante(),
  };

  // Endereço: o que já está na HomeFin vale; em branco, entra o padrão inteiro
  // (meio endereço de um e meio de outro não serve). Complemento vazio vira "001".
  const temEndereco = digitos(part?.cep).length === 8 && !vazio(part?.logradouro);
  if (!temEndereco) {
    Object.assign(completo, {
      cep: ENDERECO_PADRAO.cep,
      logradouro: ENDERECO_PADRAO.logradouro,
      numeroLogradouro: ENDERECO_PADRAO.numero,
      complementoLogradouro: ENDERECO_PADRAO.complemento,
      bairro: ENDERECO_PADRAO.bairro,
      municipio: ENDERECO_PADRAO.cidade,
      uf: ENDERECO_PADRAO.uf,
    });
  } else {
    Object.assign(completo, {
      numeroLogradouro: ENDERECO_PADRAO.numero,
      complementoLogradouro: ENDERECO_PADRAO.complemento,
      bairro: ENDERECO_PADRAO.bairro,
      municipio: ENDERECO_PADRAO.cidade,
      uf: texto(sim?.uf) ?? ENDERECO_PADRAO.uf,
    });
  }

  // Casado: cada um leva os dados do parceiro (o Itaú recusa casal em que o
  // cônjuge vai "casado" sem dizer com quem — ver envio da proposta).
  const temConjugeNaSimulacao = !vazio(sim?.nome_conjuge) || digitos(sim?.cpf_conjuge) !== "";
  if (casado && temConjugeNaSimulacao) {
    const parceiro = ehTitular
      ? {
          nome: sim?.nome_conjuge,
          cpf: digitos(sim?.cpf_conjuge),
          nascimento: sim?.data_nascimento_conjuge,
          estadoCivil: estadoCivilCrmParaCodigo(sim?.estado_civil_conjuge ?? sim?.estado_civil),
          sexo: sexo(sim?.sexo_conjuge) ?? sexo(c.conjuge_sexo),
          renda: rendaConjugeOuPadrao(sim?.renda_conjuge ?? c.conjuge_renda),
          docTipo: c.conjuge_tipo_documento_identidade,
          docNumero: c.conjuge_numero_documento,
          docData: c.conjuge_data_expedicao,
          docOrgao: c.conjuge_orgao_expedidor,
          docUf: c.conjuge_uf_expedicao,
          profissao: c.conjuge_profissao,
          empresa: c.conjuge_empresa,
        }
      : {
          nome: sim?.nome_cliente,
          cpf: digitos(sim?.cpf_cnpj),
          nascimento: sim?.data_nascimento,
          estadoCivil: estadoCivilCrmParaCodigo(sim?.estado_civil),
          sexo: sexo(sim?.sexo) ?? sexo(c.sexo),
          renda: Number(sim?.renda_total) || undefined,
          docTipo: c.tipo_documento_identidade,
          docNumero: c.numero_documento,
          docData: c.data_expedicao,
          docOrgao: c.orgao_expedidor,
          docUf: c.uf_expedicao,
          profissao: c.profissao,
          empresa: c.empresa,
        };
    Object.assign(completo, {
      nomeConjuge: texto(parceiro.nome),
      cpfConjuge: parceiro.cpf || undefined,
      dataNascimentoConjuge: texto(parceiro.nascimento),
      tipoEstadoCivilConjuge: parceiro.estadoCivil || estadoCivil,
      tipoSexoConjuge: parceiro.sexo,
      rendaConjuge: parceiro.renda,
      tipoDocumentoIdentidadeConjuge:
        primeiro(parceiro.docTipo) ?? PADROES_CADASTRO.tipoDocumentoIdentidade,
      numeroDocumentoConjuge: primeiro(parceiro.docNumero) ?? (rgDoCpf(parceiro.cpf) || undefined),
      dataExpedicaoConjuge: primeiro(parceiro.docData) ?? PADROES_CADASTRO.dataExpedicao,
      orgaoExpedidorConjuge: primeiro(parceiro.docOrgao) ?? PADROES_CADASTRO.orgaoExpedidor,
      ufExpedicaoConjuge: primeiro(parceiro.docUf) ?? PADROES_CADASTRO.ufExpedicao,
      nomeProfissaoConjuge: primeiro(parceiro.profissao) ?? PADROES_CADASTRO.profissao,
      nomeEmpresaProfissaoConjuge: primeiro(parceiro.empresa) ?? PADROES_CADASTRO.empresa,
    });
  }

  // Só o que está VAZIO na HomeFin é completado; o resto segue como está lá.
  const payload: Record<string, unknown> = {};
  let faltava = false;
  for (const campo of CAMPOS_CONTRATO) {
    const atual = part?.[campo];
    if (!vazio(atual)) {
      payload[campo] = atual;
    } else if (completo[campo] !== undefined) {
      payload[campo] = completo[campo];
      // Situação/qualificação/pessoa e a autorização não contam como "faltava":
      // vêm sempre do POST e não justificam um PUT sozinhas.
      if (!["tipoSituacao", "tipoQualificacao", "tipoPessoa", "fgAutorizacaoDados"].includes(campo)) {
        faltava = true;
      }
    }
  }
  return faltava ? payload : null;
}
