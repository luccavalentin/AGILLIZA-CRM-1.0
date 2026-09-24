/**
 * Vendedor como participante da oportunidade (`tipoQualificacao: "VD"`).
 *
 * A documentação trata comprador e vendedor pelo mesmo contrato
 * (`CreateParticipantRequest`, CO/VD). É o vendedor cadastrado na oportunidade
 * que dá à HomeFin o dono das vagas de documento do vendedor (`tipoDocumento`
 * VD/CV no checklist). Módulo puro: monta o payload e diz o que falta.
 */
import { faltantesEnvolvido, type CampoObrigatorio } from "../campos-obrigatorios";
import { ENDERECO_PADRAO, PADROES_CADASTRO } from "@/lib/crm/padroes-cadastro";

/**
 * Campos que o vendedor pode não ter e que saem com o padrão do cadastro, como
 * já acontece com o comprador. Sem isso, um vendedor recém-cadastrado ficava
 * "pendente" e simplesmente não era criado na HomeFin, sem aviso nenhum.
 */
const COM_PADRAO = new Set([
  "nome_mae",
  "tipo_documento_identidade",
  "numero_documento",
  "orgao_expedidor",
  "uf_expedicao",
  "profissao",
  "email",
  "celular",
]);

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

/**
 * Campos obrigatórios da documentação que faltam no vendedor e que ninguém
 * consegue preencher por ele (nome, documento, e os de pessoa física). O resto
 * sai com o padrão do cadastro — ver `COM_PADRAO`.
 */
export function pendenciasDoVendedor(vendedor: Record<string, any>): CampoObrigatorio[] {
  return faltantesEnvolvido({ ...vendedor, tipo_qualificacao: "VD" }).filter(
    (c) => !COM_PADRAO.has(c.chave),
  );
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
    nomeMae: pf ? (texto(vendedor.nome_mae) ?? PADROES_CADASTRO.mae) : undefined,
    tipoSexo: texto(vendedor.tipo_sexo),
    tipoEstadoCivil: texto(vendedor.estado_civil),
    tipoRegimeCasamento: texto(vendedor.regime_casamento),
    tipoDocumentoIdentidade:
      texto(vendedor.tipo_documento_identidade) ?? PADROES_CADASTRO.tipoDocumentoIdentidade,
    // Sem RG no cadastro, vai o próprio CPF/CNPJ — o mesmo padrão do comprador
    // (ver enviar.server.ts).
    numeroDocumento: texto(vendedor.numero_documento) ?? digitos(vendedor.cpf_cnpj),
    dataExpedicao: texto(vendedor.data_expedicao) ?? PADROES_CADASTRO.dataExpedicao,
    orgaoExpedidor: texto(vendedor.orgao_expedidor) ?? PADROES_CADASTRO.orgaoExpedidor,
    ufExpedicao: texto(vendedor.uf_expedicao) ?? PADROES_CADASTRO.ufExpedicao,
    nomeProfissao: texto(vendedor.profissao) ?? PADROES_CADASTRO.profissao,
    nomeEmpresaProfissao: texto(vendedor.empresa),
    // Obrigatório no contrato, mas o vendedor não tem renda na operação: 0.
    renda: numero(vendedor.renda) ?? 0,
    email: texto(vendedor.email) ?? PADROES_CADASTRO.email,
    celular: digitos(vendedor.celular) ?? PADROES_CADASTRO.celular,
    cep: digitos(vendedor.cep) ?? ENDERECO_PADRAO.cep,
    logradouro: texto(vendedor.logradouro) ?? ENDERECO_PADRAO.logradouro,
    numeroLogradouro: texto(vendedor.numero_logradouro) ?? ENDERECO_PADRAO.numero,
    complementoLogradouro: texto(vendedor.complemento) ?? ENDERECO_PADRAO.complemento,
    bairro: texto(vendedor.bairro) ?? ENDERECO_PADRAO.bairro,
    municipio: texto(vendedor.municipio) ?? ENDERECO_PADRAO.cidade,
    uf: texto(vendedor.uf) ?? ENDERECO_PADRAO.uf,
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
