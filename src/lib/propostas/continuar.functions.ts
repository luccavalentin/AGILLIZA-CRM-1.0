/**
 * "Continuar proposta" — fluxo pós-aprovação (ver MDs/14-continuar-proposta-sequenciamento.md).
 *
 * Etapa ① Conferência de dados: o operador revisa participantes, conta,
 * imóvel e valores. "Gravar e avançar" grava no CRM (proposta, participantes,
 * cadastro do cliente) e manda à HomeFin só os blocos que mudaram:
 *   - valores      → `PUT /oportunidade/{id}` só com valorImovel/valorFinanciamento/prazo;
 *   - participantes/conta → `PUT /oportunidade/{id}/participante/{id}`;
 *   - imóvel/vistoria → `PUT /oportunidade/{id}` com os campos do imóvel.
 *
 * Os documentos (etapa ②) reaproveitam `enviarDocumentosBanco`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  conjugeParaClienteCrm,
  envolvidoParaVendedorCrm,
  imovelParaClienteCrm,
  mesmoDocumento,
  vendedorCrmParaEnvolvido,
} from "./sincronizar-crm";
import {
  bancoAprovado,
  podeContinuarProposta,
  transicaoPermitida,
  type PropostaStatus,
} from "./state-machine";

/** Campos da proposta que a conferência pode alterar. */
const CAMPOS_VALORES = [
  "valor_imovel",
  "valor_financiamento",
  "prazo",
  "sistema_amortizacao",
  "utiliza_fgts",
  "financia_despesas_cartorarias",
] as const;
const CAMPOS_IMOVEL = [
  "tipo_imovel",
  "uso_imovel",
  "situacao_imovel",
  "cep_imovel",
  "endereco_imovel",
  "numero_imovel",
  "complemento_imovel",
  "bairro_imovel",
  "cidade_imovel",
  "uf",
  "contato_avaliacao_nome",
  "contato_avaliacao_telefone",
] as const;
/** Só estes três vão no PUT da oportunidade: qualquer outro campo gera HTTP 500. */
const CAMPOS_VALORES_HOMEFIN = ["valor_imovel", "valor_financiamento", "prazo"];

const CAMPOS_ENVOLVIDO = [
  "tipo_pessoa",
  "nome",
  "cpf_cnpj",
  "data_nascimento",
  "nome_mae",
  "tipo_sexo",
  "estado_civil",
  "regime_casamento",
  "tipo_documento_identidade",
  "numero_documento",
  "orgao_expedidor",
  "uf_expedicao",
  "data_expedicao",
  "profissao",
  "empresa",
  "renda",
  "email",
  "celular",
  "cep",
  "logradouro",
  "numero_logradouro",
  "complemento",
  "bairro",
  "municipio",
  "uf",
  "utiliza_fgts",
  "fg_autorizacao_dados",
] as const;

export type BlocoConferencia = "valores" | "participantes" | "imovel";

export interface ResultadoConferencia {
  alterou: boolean;
  /** Blocos que mudaram e foram gravados no CRM. */
  blocos: BlocoConferencia[];
  /** Falhas ao repassar à HomeFin, por bloco. O CRM já está gravado. */
  errosHomefin: { bloco: BlocoConferencia; mensagem: string }[];
  /**
   * Vendedores na oportunidade (participante VD). Não trava a proposta: o
   * vendedor incompleto só não vai, e a tela mostra o que falta.
   */
  vendedores: {
    enviados: string[];
    pendentes: { nome: string; faltando: string[] }[];
    erros: { nome: string; mensagem: string }[];
  } | null;
  status: string;
}

const pick = <T extends readonly string[]>(obj: Record<string, unknown>, campos: T) => {
  const out: Record<string, unknown> = {};
  for (const k of campos) if (k in obj) out[k] = obj[k];
  return out;
};

async function carregarElegivel(supabase: any, propostaId: string) {
  const { data: prop, error } = await supabase
    .from("propostas")
    .select("*")
    .eq("id", propostaId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!prop) throw new Error("Proposta não encontrada.");
  const { data: bancos } = await supabase
    .from("proposta_bancos")
    .select("*")
    .eq("proposta_id", propostaId)
    .order("created_at");
  if (!podeContinuarProposta(prop.status, bancos)) {
    throw new Error(
      "Esta proposta não está aprovada pelo banco. O fluxo de continuação só vale para crédito aprovado ou aprovação condicionada.",
    );
  }
  const aprovados = ((bancos ?? []) as any[]).filter(bancoAprovado);
  const pb = aprovados.find((b) => b.selecionado) ?? aprovados[0];
  return { prop, pb };
}

export const salvarConferenciaProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        proposta_id: z.string().uuid(),
        proposta: z.record(z.string(), z.unknown()).default({}),
        envolvidos: z
          .array(z.object({ id: z.string().uuid(), dados: z.record(z.string(), z.unknown()) }))
          .default([]),
        conta: z
          .object({
            agencia: z.string().trim().max(10).nullable(),
            conta_corrente: z.string().trim().max(20).nullable(),
            digito_conta: z.string().trim().max(2).nullable(),
          })
          .nullable()
          .default(null),
        /** Passa a proposta para "Coleta de documentos" ao gravar. */
        avancar: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<ResultadoConferencia> => {
    const { supabase, userId } = context;
    const { prop, pb } = await carregarElegivel(supabase, data.proposta_id);

    const valores = pick(data.proposta, CAMPOS_VALORES);
    const imovel = pick(data.proposta, CAMPOS_IMOVEL);
    const mudou = (campos: Record<string, unknown>) =>
      Object.keys(campos).filter((k) => String(campos[k] ?? "") !== String(prop[k] ?? ""));
    const valoresMudados = mudou(valores);
    const imovelMudado = mudou(imovel);

    const blocos = new Set<BlocoConferencia>();
    const descricao: string[] = [];

    // ---- CRM: proposta
    const patchProposta: Record<string, unknown> = {};
    for (const k of [...valoresMudados, ...imovelMudado]) patchProposta[k] = data.proposta[k];
    if (Object.keys(patchProposta).length > 0) {
      const { error } = await supabase
        .from("propostas")
        .update(patchProposta as any)
        .eq("id", prop.id);
      if (error) throw new Error(error.message);
      if (valoresMudados.length > 0) {
        blocos.add("valores");
        descricao.push(`valores (${valoresMudados.join(", ")})`);
      }
      if (imovelMudado.length > 0) {
        blocos.add("imovel");
        descricao.push(`imóvel (${imovelMudado.join(", ")})`);
      }
    }

    // Contato da vistoria também vive no checklist do cliente, de onde sai para a HomeFin.
    if (
      prop.cliente_id &&
      (imovelMudado.includes("contato_avaliacao_nome") ||
        imovelMudado.includes("contato_avaliacao_telefone"))
    ) {
      const { data: cli } = await supabase
        .from("clientes")
        .select("documentos_checklist")
        .eq("id", prop.cliente_id)
        .maybeSingle();
      const checklist = { ...((cli as any)?.documentos_checklist ?? {}) };
      checklist.i_vistoria_nome = data.proposta.contato_avaliacao_nome ?? "";
      checklist.i_vistoria_tel = data.proposta.contato_avaliacao_telefone ?? "";
      await supabase
        .from("clientes")
        .update({ documentos_checklist: checklist } as any)
        .eq("id", prop.cliente_id);
    }

    // ---- CRM: participantes (+ cadastro do cliente)
    if (data.envolvidos.length > 0) {
      const { data: atuais } = await supabase
        .from("proposta_envolvidos")
        .select("*")
        .eq("proposta_id", prop.id);
      const { sincronizarEnvolvidoParaCliente } = await import("./propostas.functions");
      for (const e of data.envolvidos) {
        const atual = ((atuais ?? []) as any[]).find((a) => a.id === e.id);
        if (!atual) throw new Error("Participante não pertence a esta proposta.");
        const dados = pick(e.dados, CAMPOS_ENVOLVIDO);
        const campos = Object.keys(dados).filter(
          (k) => String(dados[k] ?? "") !== String(atual[k] ?? ""),
        );
        if (campos.length === 0) continue;
        const patch = Object.fromEntries(campos.map((k) => [k, dados[k]]));
        const { error } = await supabase
          .from("proposta_envolvidos")
          .update(patch as any)
          .eq("id", e.id);
        if (error) throw new Error(error.message);
        // Espelho no CRM: titular pelo próprio cadastro; cônjuge nas colunas
        // `conjuge_*` do titular; vendedor em `cliente_vendedores`.
        if (atual.cliente_id) {
          await sincronizarEnvolvidoParaCliente(supabase, String(atual.cliente_id), patch);
        } else if (atual.conjuge_de && atual.tipo_qualificacao !== "VD") {
          const titular = ((atuais ?? []) as any[]).find((a) => a.id === atual.conjuge_de);
          const clienteTitular = titular?.cliente_id ?? prop.cliente_id;
          const crm = conjugeParaClienteCrm({ ...atual, ...patch });
          if (clienteTitular && Object.keys(crm).length > 0) {
            await supabase
              .from("clientes")
              .update(crm as any)
              .eq("id", clienteTitular);
          }
        } else if (atual.tipo_qualificacao === "VD" && prop.cliente_id) {
          await espelharVendedorNoCrm(supabase, prop.cliente_id, atual, { ...atual, ...patch });
        }
        blocos.add("participantes");
        descricao.push(`${atual.nome ?? "participante"} (${campos.join(", ")})`);
      }
    }

    // Imóvel conferido também no cadastro do cliente (`clientes.imovel_*`).
    if (prop.cliente_id && (imovelMudado.length > 0 || valoresMudados.includes("valor_imovel"))) {
      const crm = imovelParaClienteCrm({ ...prop, ...patchProposta });
      if (Object.keys(crm).length > 0) {
        await supabase
          .from("clientes")
          .update(crm as any)
          .eq("id", prop.cliente_id);
      }
    }

    // ---- CRM: conta no banco que aprovou
    if (data.conta && pb) {
      const conta = {
        agencia: data.conta.agencia || null,
        conta_corrente: data.conta.conta_corrente || null,
        digito_conta: data.conta.digito_conta || null,
      };
      const campos = (Object.keys(conta) as (keyof typeof conta)[]).filter(
        (k) => String(conta[k] ?? "") !== String(pb[k] ?? ""),
      );
      if (campos.length > 0) {
        const { error } = await supabase
          .from("proposta_bancos")
          .update(conta as any)
          .eq("id", pb.id);
        if (error) throw new Error(error.message);
        Object.assign(pb, conta);
        if (prop.cliente_id) {
          await supabase
            .from("clientes")
            .update({ agencia: conta.agencia, conta_corrente: conta.conta_corrente } as any)
            .eq("id", prop.cliente_id);
        }
        blocos.add("participantes");
        descricao.push(`conta ${pb.nome_banco ?? ""} (${campos.join(", ")})`.trim());
      }
    }

    // ---- HomeFin: só o que mudou
    const errosHomefin: ResultadoConferencia["errosHomefin"] = [];
    const idOportunidade = prop.homefin_id_oportunidade;
    if (idOportunidade && blocos.size > 0) {
      const { chamarIntegracao, sanitizarMensagemErro } =
        await import("@/lib/simulacao/homefin.server");
      const ctx = {
        simulacao_id: prop.simulacao_id,
        proposta_id: prop.id,
        correspondente_id: prop.correspondente_id,
      };
      const msg = (e: unknown) =>
        sanitizarMensagemErro(e instanceof Error ? e.message : String(e)) ||
        "A HomeFin recusou a atualização.";

      if (valoresMudados.some((k) => CAMPOS_VALORES_HOMEFIN.includes(k))) {
        const v = (k: string) => Number(data.proposta[k] ?? prop[k]);
        try {
          await chamarIntegracao(
            `/oportunidade/${idOportunidade}`,
            "PUT",
            {
              valorImovel: v("valor_imovel"),
              valorFinanciamento: v("valor_financiamento"),
              prazo: v("prazo"),
            },
            ctx,
          );
        } catch (e) {
          errosHomefin.push({ bloco: "valores", mensagem: msg(e) });
        }
      }

      if (blocos.has("participantes")) {
        try {
          const { data: propAtual } = await supabase
            .from("propostas")
            .select("*")
            .eq("id", prop.id)
            .maybeSingle();
          const { garantirEnderecoParticipantes } = await import("./enviar.server");
          await garantirEnderecoParticipantes({
            prop: propAtual ?? prop,
            pb,
            idOportunidade,
            ctx,
            supabase,
          });
        } catch (e) {
          errosHomefin.push({ bloco: "participantes", mensagem: msg(e) });
        }
      }

      if (blocos.has("imovel")) {
        const { dadosImovelOportunidadeImpl } = await import("./enviar/imovel-oportunidade.server");
        const r = await dadosImovelOportunidadeImpl({
          propostaId: prop.id,
          supabase,
          enviar: true,
        });
        if (r.erro) errosHomefin.push({ bloco: "imovel", mensagem: r.erro });
      }
    }

    // ---- HomeFin: vendedores como participantes VD (donos das vagas do vendedor)
    let vendedores: ResultadoConferencia["vendedores"] = null;
    if (idOportunidade) {
      try {
        const { sincronizarVendedoresHomefinImpl } = await import("./enviar.server");
        vendedores = await sincronizarVendedoresHomefinImpl({ propostaId: prop.id, supabase });
      } catch (e) {
        vendedores = {
          enviados: [],
          pendentes: [],
          erros: [{ nome: "Vendedores", mensagem: e instanceof Error ? e.message : String(e) }],
        };
      }
    }

    // ---- Etapa: aprovada/condicionada → coleta de documentos
    let status = String(prop.status);
    const podeAvancar =
      data.avancar &&
      errosHomefin.length === 0 &&
      transicaoPermitida(prop.status as PropostaStatus, "aguardando_documentos");
    if (podeAvancar) {
      const { error } = await supabase
        .from("propostas")
        .update({ status: "aguardando_documentos" } as any)
        .eq("id", prop.id);
      if (!error) {
        await supabase.from("proposta_historico").insert({
          proposta_id: prop.id,
          tipo_evento: "status",
          descricao: "Dados conferidos no Continuar proposta.",
          status_anterior: prop.status,
          status_novo: "aguardando_documentos",
          ator_id: userId,
        } as any);
        status = "aguardando_documentos";
      }
    }

    if (descricao.length > 0) {
      const sufixo =
        errosHomefin.length > 0
          ? ` Falha na HomeFin: ${errosHomefin.map((e) => e.mensagem).join(" · ")}`
          : idOportunidade
            ? " Atualizado na HomeFin."
            : "";
      await supabase.from("proposta_historico").insert({
        proposta_id: prop.id,
        tipo_evento: errosHomefin.length > 0 ? "erro_envio" : "sincronizacao",
        descricao: `Conferência de dados: alterou ${descricao.join("; ")}.${sufixo}`,
        ator_id: userId,
      } as any);
    }

    return {
      alterou: blocos.size > 0,
      blocos: Array.from(blocos),
      errosHomefin,
      vendedores,
      status,
    };
  });

/** Vendedor editado na proposta → `cliente_vendedores` (casado pelo documento). */
async function espelharVendedorNoCrm(
  supabase: any,
  clienteId: string,
  antes: any,
  depois: any,
): Promise<void> {
  const { data: vendedores } = await supabase
    .from("cliente_vendedores")
    .select("id, documento, nome")
    .eq("cliente_id", clienteId);
  const alvo =
    ((vendedores ?? []) as any[]).find(
      (v) =>
        mesmoDocumento(v.documento, antes.cpf_cnpj) || mesmoDocumento(v.documento, depois.cpf_cnpj),
    ) ?? null;
  const patch = envolvidoParaVendedorCrm(depois);
  if (Object.keys(patch).length === 0) return;
  if (alvo) {
    await supabase.from("cliente_vendedores").update(patch).eq("id", alvo.id);
  } else if (patch.nome) {
    await supabase.from("cliente_vendedores").insert({ cliente_id: clienteId, ...patch });
  }
}

/**
 * Traz para a proposta os vendedores cadastrados (ou alterados) no CRM depois
 * que ela foi criada. A cópia acontecia só na criação: vendedor cadastrado na
 * aba "Vendedores" depois disso nunca chegava à proposta.
 *
 * Casamento pelo documento. O CRM vence quando foi alterado depois do
 * envolvido; a conferência da proposta escreve de volta no CRM.
 */
export const sincronizarVendedoresProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ proposta_id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: prop } = await supabase
      .from("propostas")
      .select("id, cliente_id")
      .eq("id", data.proposta_id)
      .maybeSingle();
    if (!prop?.cliente_id) return { incluidos: 0, atualizados: 0 };

    const [{ data: vendedores }, { data: envolvidos }] = await Promise.all([
      supabase.from("cliente_vendedores").select("*").eq("cliente_id", prop.cliente_id),
      supabase
        .from("proposta_envolvidos")
        .select("id, cpf_cnpj, nome, updated_at")
        .eq("proposta_id", prop.id)
        .eq("tipo_qualificacao", "VD"),
    ]);

    let incluidos = 0;
    let atualizados = 0;
    for (const v of (vendedores ?? []) as any[]) {
      const env = ((envolvidos ?? []) as any[]).find(
        (e) =>
          mesmoDocumento(e.cpf_cnpj, v.documento) ||
          (!e.cpf_cnpj && String(e.nome ?? "").trim() === String(v.nome ?? "").trim()),
      );
      const linha = vendedorCrmParaEnvolvido(v);
      if (!env) {
        const { error } = await supabase
          .from("proposta_envolvidos")
          .insert({ proposta_id: prop.id, cliente_id: null, ...linha } as any);
        if (!error) incluidos++;
      } else if (new Date(v.updated_at ?? 0).getTime() > new Date(env.updated_at ?? 0).getTime()) {
        const { error } = await supabase
          .from("proposta_envolvidos")
          .update(linha as any)
          .eq("id", env.id);
        if (!error) atualizados++;
      }
    }
    return { incluidos, atualizados };
  });

/** Avança a proposta para a próxima etapa do fluxo pós-aprovação. */
export const avancarEtapaContinuar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        proposta_id: z.string().uuid(),
        para: z.enum(["engenharia_vistoria", "analise_juridica", "contrato_emitido"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { prop } = await carregarElegivel(supabase, data.proposta_id);
    if (!transicaoPermitida(prop.status as PropostaStatus, data.para)) {
      throw new Error("A proposta não pode avançar para essa etapa a partir da etapa atual.");
    }
    const patch: Record<string, unknown> = { status: data.para };
    if (data.para === "contrato_emitido") patch.contrato_emitido_em = new Date().toISOString();
    const { error } = await supabase
      .from("propostas")
      .update(patch as any)
      .eq("id", prop.id);
    if (error) throw new Error(error.message);
    await supabase.from("proposta_historico").insert({
      proposta_id: prop.id,
      tipo_evento: "status",
      descricao: "Avançou pelo Continuar proposta.",
      status_anterior: prop.status,
      status_novo: data.para,
      ator_id: userId,
    } as any);
    return { status: data.para };
  });
