/**
 * Testagem automática de CPFs.
 *
 * O banco pontua o CPF de quem figura como titular, e a taxa devolvida pode
 * variar bastante conforme quem ocupa essa posição. Este módulo monta, a
 * partir do formulário, a lista de proponentes aptos a serem testados como
 * titular — cônjuge e participantes — devolvendo para cada um o patch que
 * transforma o payload da simulação.
 *
 * Puro: recebe o formulário e devolve dados. Sem side effects.
 */
import type { Form } from "./state";

export interface TitularAlternativo {
  /** Identificador estável, usado nas chaves de rastreio do overlay. */
  chave: string;
  /** Nome exibido no comparativo. */
  nome: string;
  /** Como essa pessoa se relaciona com o titular original. */
  vinculo: string;
  /** Campos que substituem os do titular no payload da simulação. */
  patch: Record<string, any>;
}

const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

/**
 * Para figurar como titular o banco exige identificação completa e renda.
 * Sem qualquer um desses campos a consulta seria recusada — melhor não gastar
 * a chamada.
 */
function aptoComoTitular(dados: {
  nome?: unknown;
  cpf?: unknown;
  nascimento?: unknown;
  renda?: unknown;
}): boolean {
  return (
    String(dados.nome ?? "").trim().length > 0 &&
    soDigitos(dados.cpf).length >= 11 &&
    String(dados.nascimento ?? "").trim().length > 0 &&
    Number(dados.renda ?? 0) > 0
  );
}

/**
 * Lista os proponentes que podem ser testados como titular, na ordem em que
 * aparecem no formulário. O titular atual não entra — ele já é a simulação
 * principal.
 */
export function listarTitularesAlternativos(f: Form): TitularAlternativo[] {
  const alternativos: TitularAlternativo[] = [];
  const cpfTitular = soDigitos(f.cpf_cnpj);

  // --- Cônjuge -----------------------------------------------------------
  // Troca recíproca: o cônjuge assume o titular e o titular assume o cônjuge,
  // preservando o casal como conjunto de proponentes.
  if (
    aptoComoTitular({
      nome: f.nome_conjuge,
      cpf: f.cpf_conjuge,
      nascimento: f.data_nascimento_conjuge,
      renda: f.renda_conjuge,
    }) &&
    soDigitos(f.cpf_conjuge) !== cpfTitular
  ) {
    alternativos.push({
      chave: "conjuge",
      nome: String(f.nome_conjuge),
      vinculo: "Cônjuge",
      patch: {
        nome_cliente: f.nome_conjuge,
        cpf_cnpj: f.cpf_conjuge,
        data_nascimento: f.data_nascimento_conjuge,
        sexo: f.sexo_conjuge || f.sexo,
        estado_civil: f.estado_civil_conjuge || f.estado_civil,
        email: f.email_conjuge || f.email,
        celular: f.celular_conjuge || f.celular,
        renda_total: f.renda_conjuge,

        nome_conjuge: f.nome_cliente,
        cpf_conjuge: f.cpf_cnpj,
        data_nascimento_conjuge: f.data_nascimento,
        sexo_conjuge: f.sexo,
        estado_civil_conjuge: f.estado_civil,
        email_conjuge: f.email,
        celular_conjuge: f.celular,
        renda_conjuge: f.renda_total,
      },
    });
  }

  // --- Participantes -----------------------------------------------------
  // O participante promovido sai da lista e o titular original ocupa a vaga
  // dele, para que o conjunto de proponentes (e o teto de prazo por idade)
  // continue idêntico ao da simulação principal.
  const participantes: any[] = Array.isArray(f.participantes) ? f.participantes : [];

  participantes.forEach((p, indice) => {
    if (
      !aptoComoTitular({
        nome: p?.nome,
        cpf: p?.cpf_cnpj,
        nascimento: p?.data_nascimento,
        renda: p?.renda,
      })
    ) {
      return;
    }
    if (soDigitos(p.cpf_cnpj) === cpfTitular) return;

    alternativos.push({
      chave: `participante-${p.id ?? indice}`,
      nome: String(p.nome),
      vinculo: p.vinculo ? String(p.vinculo) : `Participante ${indice + 1}`,
      patch: {
        nome_cliente: p.nome,
        cpf_cnpj: p.cpf_cnpj,
        data_nascimento: p.data_nascimento,
        sexo: p.sexo || f.sexo,
        estado_civil: p.estado_civil || f.estado_civil,
        email: p.email || f.email,
        celular: p.celular || f.celular,
        renda_total: p.renda,

        // O cônjuge do titular original NÃO acompanha o participante promovido
        // — mandá-lo ao banco casado com a esposa de outra pessoa seria um
        // dado falso. Como não coletamos o cônjuge de terceiros, ele vai sem.
        possui_conjuge: false,
        compoe_renda: false,
        compoe_renda_conjuge: false,
        nome_conjuge: "",
        cpf_conjuge: "",
        renda_conjuge: 0,
        data_nascimento_conjuge: "",
        sexo_conjuge: "",
        estado_civil_conjuge: "",
        celular_conjuge: "",
        participantes: participantes.map((outro) =>
          outro === p
            ? {
                ...outro,
                nome: f.nome_cliente,
                cpf_cnpj: f.cpf_cnpj,
                data_nascimento: f.data_nascimento,
                sexo: f.sexo,
                estado_civil: f.estado_civil,
                email: f.email,
                celular: f.celular,
                renda: f.renda_total,
              }
            : outro,
        ),
      },
    });
  });

  return alternativos;
}

/** Quantos proponentes seriam testados além do titular atual. */
export function contarTitularesAlternativos(f: Form): number {
  return listarTitularesAlternativos(f).length;
}
