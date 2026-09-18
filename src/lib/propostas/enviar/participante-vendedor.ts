/**
 * Vendedor como participante da oportunidade (`tipoQualificacao: "VD"`).
 *
 * A documentação trata comprador e vendedor pelo mesmo contrato
 * (`CreateParticipantRequest`, CO/VD). É o vendedor cadastrado na oportunidade
 * que dá à HomeFin o dono das vagas de documento do vendedor (`tipoDocumento`
 * VD/CV no checklist). Módulo puro: monta o payload e diz o que falta.
 */
import { faltantesEnvolvido, type CampoObrigatorio } from "../campos-obrigatorios";

const texto = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s || undefined;
};
const digitos = (v: unknown) => {
  const s = String(v ?? "").replace(/\D/g, "");
  return s || undefined;
};
const numero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** Campos obrigatórios da documentação que faltam no vendedor. */
export function pendenciasDoVendedor(vendedor: Record<string, any>): CampoObrigatorio[] {
  return faltantesEnvolvido({ ...vendedor, tipo_qualificacao: "VD" });
}

/**
 * Payload do `POST/PUT /oportunidade/{id}/participante` para o vendedor e, se
 * houver, o cônjuge dele (campos `*Conjuge`, como no comprador).
 */
export function payloadParticipanteVendedor(
  vendedor: Record<string, any>,
  conjuge?: Record<string, any> | null,
): Record<string, unknown> {
  const pf = String(vendedor.tipo_pessoa ?? "F") !== "J";
  const payload: Record<string, unknown> = {
    tipoSituacao: "A",
    tipoQualificacao: "VD",
    tipoPessoa: pf ? "F" : "J",
    nomeParticipante: texto(vendedor.nome),
    cpfCnpj: digitos(vendedor.cpf_cnpj),
    dataNascimento: texto(vendedor.data_nascimento),
    nomeMae: texto(vendedor.nome_mae),
    tipoSexo: texto(vendedor.tipo_sexo),
    tipoEstadoCivil: texto(vendedor.estado_civil),
    tipoRegimeCasamento: texto(vendedor.regime_casamento),
    tipoDocumentoIdentidade: texto(vendedor.tipo_documento_identidade),
    // Sem RG no cadastro, pessoa física vai com o próprio CPF — o mesmo
    // padrão do comprador (ver enviar.server.ts).
    numeroDocumento:
      texto(vendedor.numero_documento) ?? (pf ? digitos(vendedor.cpf_cnpj) : undefined),
    dataExpedicao: texto(vendedor.data_expedicao),
    orgaoExpedidor: texto(vendedor.orgao_expedidor),
    ufExpedicao: texto(vendedor.uf_expedicao),
    nomeProfissao: texto(vendedor.profissao),
    nomeEmpresaProfissao: texto(vendedor.empresa),
    // Obrigatório no contrato, mas o vendedor não tem renda na operação: 0.
    renda: numero(vendedor.renda) ?? 0,
    email: texto(vendedor.email),
    celular: digitos(vendedor.celular),
    cep: digitos(vendedor.cep),
    logradouro: texto(vendedor.logradouro),
    numeroLogradouro: texto(vendedor.numero_logradouro),
    complementoLogradouro: texto(vendedor.complemento),
    bairro: texto(vendedor.bairro),
    municipio: texto(vendedor.municipio),
    uf: texto(vendedor.uf),
    utilizaFgts: vendedor.utiliza_fgts ? "S" : "N",
    fgAutorizacaoDados: vendedor.fg_autorizacao_dados === true,
    // Conta de recebimento do vendedor, quando cadastrada.
    codigoAgencia: digitos(vendedor.agencia),
    codigoContaCorrente: digitos(vendedor.conta_corrente),
    digitoContaCorrente: texto(vendedor.digito_conta),
  };
  if (conjuge) {
    Object.assign(payload, {
      nomeConjuge: texto(conjuge.nome),
      cpfConjuge: digitos(conjuge.cpf_cnpj),
      dataNascimentoConjuge: texto(conjuge.data_nascimento),
      tipoEstadoCivilConjuge: texto(conjuge.estado_civil ?? vendedor.estado_civil),
      tipoDocumentoIdentidadeConjuge: texto(conjuge.tipo_documento_identidade),
      numeroDocumentoConjuge: texto(conjuge.numero_documento) ?? digitos(conjuge.cpf_cnpj),
      dataExpedicaoConjuge: texto(conjuge.data_expedicao),
      orgaoExpedidorConjuge: texto(conjuge.orgao_expedidor),
      ufExpedicaoConjuge: texto(conjuge.uf_expedicao),
      nomeProfissaoConjuge: texto(conjuge.profissao),
      rendaConjuge: numero(conjuge.renda),
      nomeEmpresaProfissaoConjuge: texto(conjuge.empresa),
      tipoSexoConjuge: texto(conjuge.tipo_sexo),
    });
  }
  // `undefined` some do JSON: o PUT não apaga o que a HomeFin já tem.
  return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
}
