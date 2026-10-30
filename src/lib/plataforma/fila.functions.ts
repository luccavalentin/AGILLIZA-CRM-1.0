/**
 * Fila de propostas dos assinantes (corretores e imobiliárias do Agilliza Tech).
 *
 * A proposta que o assinante envia fica pendente aqui até um analista do Agilliza assumir
 * ou ser designado. Mesmas funções da Gestão: `plataforma.consultar_propostas`,
 * `assumir_proposta` e `reatribuir_proposta` — o operador é a pessoa do Agilliza (ponte).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissao } from "@/integrations/supabase/exigir-permissao";
import { ROTULO_PROPOSTA_ASSINANTE } from "./rotulos-proposta-assinante";

// Rótulos num arquivo puro (sem servidor): a tela e os testes dos filtros usam o mesmo.
export { ROTULO_PROPOSTA_ASSINANTE };

export interface PropostaAssinante {
  id: string;
  codigo: string;
  conta: string;
  conta_tipo: string;
  origem: "agilliza" | "licenca";
  cliente: string;
  banco: string | null;
  status: string;
  numero_proposta_banco: string | null;
  valor_financiamento: number;
  criado_em: string;
  assumida_em: string | null;
  analista: string | null;
  usuario_origem: string | null;
  minha: boolean;
  pendente: boolean;
  atrasada: boolean;
  /** Já trazida ao Agilliza (há vínculo com cliente/simulação daqui). */
  no_agilliza?: boolean;
  /** Número interno no Agilliza (proposta, ou a simulação enquanto não virou proposta). */
  numero_agilliza?: string | null;
  /** Simulação do Agilliza (cópia por baixo, com as cotações do assinante). */
  simulacao_agilliza_id?: string | null;
  /** Proposta do Agilliza criada a partir desta, pelo envio de sempre. */
  proposta_agilliza_id?: string | null;
  /** Conta (licença) dona da proposta. */
  tenant_id?: string;
  sla_ate?: string | null;
  /** Banco (id do Agilliza Tech: bradesco, itau…). */
  banco_id?: string | null;
  /** Id da oportunidade na integração bancária — na tela só "ID H." (0315). */
  id_h?: string | null;
  contrato_emitido_em?: string | null;
  registrado_em?: string | null;
}

export interface ResultadoFila {
  propostas: PropostaAssinante[];
  total: number;
  por_pagina: number;
  pendentes: number;
  minhas: number;
  atrasadas: number;
  volume: number;
}

const UUID = z.string().uuid();

export const listarFilaAssinantes = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.fila", "view"])])
  .validator((d: unknown) =>
    z
      .object({
        aceite: z.enum(["todas", "pendentes", "minhas"]).default("pendentes"),
        licenca: UUID.optional().nullable(),
        status: z.string().max(40).optional().nullable(),
        banco: UUID.optional().nullable(),
        termo: z.string().trim().max(120).optional().nullable(),
        pagina: z.number().int().min(1).max(500).default(1),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    return comPlataforma(context.userId, async (tx) => {
      const r = await tx.uma<{ r: ResultadoFila }>(
        "select plataforma.consultar_propostas($1::jsonb) as r",
        [
          JSON.stringify({
            aceite: data.aceite,
            licenca: data.licenca ?? null,
            status: data.status && ROTULO_PROPOSTA_ASSINANTE[data.status] ? data.status : null,
            banco: data.banco ?? null,
            termo: data.termo || null,
            pagina: data.pagina,
          }),
        ],
      );
      const { anotarVinculoAgilliza } = await import("./fila.server");
      await anotarVinculoAgilliza(tx, r?.r?.propostas ?? []);
      // As contas do filtro vêm de `listarContasDaFila` (cache próprio): antes iam junto
      // a cada página e a cada recarga de 60 s — com 2.000 assinantes, a lista inteira.
      return {
        fila: r?.r ?? {
          propostas: [],
          total: 0,
          por_pagina: 50,
          pendentes: 0,
          minhas: 0,
          atrasadas: 0,
          volume: 0,
        },
      };
    });
  });

/** Contas (licenças) para o filtro da fila. Muda pouco: a tela guarda em cache. */
export const listarContasDaFila = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.fila", "view"])])
  .handler(async ({ context }) => {
    const { comPlataforma } = await import("./ponte.server");
    return comPlataforma(context.userId, (tx) =>
      tx.consultar<{ id: string; nome: string; tipo: string }>(
        "select id, nome, tipo::text as tipo from plataforma.licencas_do_correspondente() order by nome",
      ),
    );
  });

/** O analista do Agilliza assume a proposta (sai de "pendentes", entra em "minhas"). */
export const assumirPropostaAssinante = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.fila", "edit"])])
  .validator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    const r = await comPlataforma(context.userId, (tx) =>
      tx.uma<{ codigo: string }>("select codigo from plataforma.assumir_proposta($1)", [data.id]),
    );
    return { codigo: r?.codigo ?? "" };
  });

/** Designa (ou tira) o analista responsável, com o motivo registrado. */
export const designarPropostaAssinante = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.fila", "edit"])])
  .validator((d: unknown) =>
    z
      .object({
        id: UUID,
        analistaId: UUID.nullable(),
        motivo: z.string().trim().min(5, "Explique o motivo em poucas palavras.").max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    await comPlataforma(context.userId, (tx) =>
      tx.consultar("select plataforma.reatribuir_proposta($1, $2, $3)", [
        data.id,
        data.analistaId,
        data.motivo,
      ]),
    );
    return { ok: true as const };
  });

/**
 * Prepara o envio da proposta do assinante pelo fluxo do Agilliza: assume (se pendente) e
 * garante, por baixo e idempotente, cliente + simulação do Agilliza com as mesmas cotações
 * do assinante. Usado por "Enviar para aprovação", "Gerar nova simulação" e "Editar dados".
 */
export const prepararEnvioNoAgilliza = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.fila", "edit"])])
  .validator((d: unknown) =>
    z.object({ id: UUID, assumir: z.boolean().default(false) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assumirEPreparar } = await import("./fila.server");
    return assumirEPreparar(context.userId, data.id, data.assumir);
  });

/**
 * "Devolver ao assinante": pede correção registrando uma exigência na proposta — o mesmo
 * caminho do Corretor (operacional.proposta_exigencias, no contexto da proposta assumida),
 * que avisa o corretor/imobiliária em tempo real.
 */
export const pedirCorrecaoAoAssinante = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.fila", "edit"])])
  .validator((d: unknown) =>
    z
      .object({
        id: UUID,
        assumir: z.boolean().default(false),
        descricao: z.string().trim().min(5, "Diga o que o assinante precisa corrigir.").max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assumirSePendente } = await import("./fila.server");
    const { comPlataforma } = await import("./ponte.server");
    await assumirSePendente(context.userId, data.id, data.assumir);
    await comPlataforma(context.userId, async (tx) => {
      await tx.consultar("select plataforma.contexto_da_proposta($1)", [data.id]);
      await tx.consultar(
        "insert into operacional.proposta_exigencias (proposta_id, descricao) values ($1, $2)",
        [data.id, data.descricao],
      );
    });
    return { ok: true as const };
  });

/**
 * Logo depois de criada a proposta do Agilliza (pelo criarProposta de sempre): o imóvel e a
 * vistoria vêm do cadastro do cliente — o mesmo mapeamento do espelho CRM → proposta —, só
 * nos campos vazios, e vão à oportunidade da HomeFin ANTES do envio. Sem isso o banco recebia
 * o imóvel só com a UF (caso real Santander: recusa "sem motivo").
 */
export const completarImovelDaProposta = createServerFn({ method: "POST" })
  .middleware([exigirPermissao(["saas.fila", "edit"])])
  .validator((d: unknown) => z.object({ propostaId: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { COLUNAS_IMOVEL_DO_CLIENTE, imovelDaPropostaPeloCrm } =
      await import("@/lib/propostas/espelho-crm.server");
    const { data: prop, error } = await supabase
      .from("propostas")
      .select("*")
      .eq("id", data.propostaId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!prop?.cliente_id) return { preenchidos: [] as string[], enviado: false, erro: null };
    const { data: cliente } = await supabase
      .from("clientes")
      .select(COLUNAS_IMOVEL_DO_CLIENTE)
      .eq("id", prop.cliente_id)
      .maybeSingle();
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(imovelDaPropostaPeloCrm(cliente))) {
      if (v === null || v === undefined || String(v).trim() === "") continue;
      const atual = (prop as Record<string, unknown>)[k];
      if (atual === null || atual === undefined || String(atual).trim() === "") patch[k] = v;
    }
    if (Object.keys(patch).length > 0) {
      const { error: e2 } = await supabase
        .from("propostas")
        .update(patch as never)
        .eq("id", data.propostaId);
      if (e2) throw new Error(e2.message);
    }
    const { dadosImovelOportunidadeImpl } =
      await import("@/lib/propostas/enviar/imovel-oportunidade.server");
    const r = await dadosImovelOportunidadeImpl({
      propostaId: data.propostaId,
      supabase,
      enviar: true,
    });
    return { preenchidos: Object.keys(patch), enviado: r.enviado, erro: r.erro };
  });

/** Analistas que podem receber a proposta (para "Designar"). */
export const listarAnalistasDaFila = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.fila", "view"])])
  .handler(async ({ context }) => {
    const { comPlataforma } = await import("./ponte.server");
    return comPlataforma(context.userId, (tx) =>
      tx.consultar<{ id: string; nome: string }>(
        "select id, nome from plataforma.analistas_do_correspondente()",
      ),
    );
  });

export interface DocumentoPropostaAssinante {
  id: string;
  perfil: string;
  participante: string | null;
  descricao: string | null;
  status: string;
  obrigatorio: boolean | null;
  anexado: boolean;
  enviado_em: string | null;
  motivo_recusa: string | null;
  /** Endereço selado do arquivo — só com a proposta assumida por quem vê. */
  arquivo?: { url: string; nome: string; mime: string; bytes: number } | null;
}

export interface DetalhePropostaAssinante {
  id: string;
  codigo: string;
  status: string;
  criado_em: string;
  enviada_em: string | null;
  decidida_em: string | null;
  sla_ate: string | null;
  atrasada: boolean | null;
  assumida_em: string | null;
  analista: string | null;
  minha: boolean;
  pendente: boolean;
  numero_proposta_banco: string | null;
  /** ID da operação na integração bancária (Corretor 0221); ausente antes da migração. */
  id_op?: string | null;
  mensagem_banco: string | null;
  aprovado: {
    valor: number;
    parcela: number | null;
    prazo: number | null;
    taxa: number | null;
  } | null;
  conta: {
    id: string;
    nome: string;
    tipo: string;
    situacao: string;
    documento_mascarado: string | null;
    creci: string | null;
    creci_uf: string | null;
    email: string | null;
    celular: string | null;
  } | null;
  enviado_por: { nome: string; email: string | null; celular: string | null } | null;
  banco: { id: string | null; nome: string | null; sistema: string | null; agencia: string | null };
  cotacao: {
    parcela: number | null;
    ultima_parcela: number | null;
    taxa_juros_aa: number | null;
    cet_aa: number | null;
    prazo: number | null;
    valor_financiado: number | null;
    renda_minima: number | null;
  } | null;
  /** A simulação que o assinante fez: todos os bancos cotados, com o escolhido marcado. */
  cotacoes: {
    banco_id: string;
    banco: string;
    sistema: string;
    estado: string;
    parcela: number | null;
    ultima_parcela: number | null;
    taxa_juros_aa: number | null;
    cet_aa: number | null;
    prazo: number | null;
    valor_financiado: number | null;
    renda_minima: number | null;
    erro: string | null;
    escolhida: boolean;
  }[];
  cliente: {
    codigo: string | null;
    tipo_pessoa: string | null;
    nome: string | null;
    documento_mascarado: string | null;
    /** CPF/CNPJ completo (0212). */
    documento?: string | null;
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    nascimento: string | null;
    sexo: string | null;
    estado_civil: string | null;
    regime: string | null;
    email: string | null;
    celular: string | null;
    renda: number | null;
    profissao: string | null;
    cidade: string | null;
    uf: string | null;
  };
  conjuge: {
    nome: string | null;
    documento_mascarado: string | null;
    documento?: string | null;
    nascimento: string | null;
    renda: number | null;
    email: string | null;
    celular: string | null;
    compoe_renda: boolean;
  } | null;
  participantes: {
    nome: string;
    vinculo: string | null;
    documento_mascarado: string | null;
    documento?: string | null;
    renda: number | null;
  }[];
  simulacao: {
    codigo: string;
    produto: string | null;
    valor_imovel: number | null;
    valor_entrada: number | null;
    valor_financiamento: number | null;
    prazo: number | null;
    sistema: string | null;
    usa_fgts: boolean | null;
    financiar_despesas: boolean | null;
    valor_despesas: number | null;
    renda_total: number | null;
  };
  imovel: {
    tipo: string | null;
    uso: string | null;
    situacao: string | null;
    uf: string | null;
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    contato_avaliacao: string | null;
    contato_avaliacao_telefone: string | null;
  };
  documentos: DocumentoPropostaAssinante[];
  exigencias: {
    descricao: string;
    status: string;
    criado_em: string;
    atendida_em: string | null;
  }[];
  eventos: {
    tipo: string;
    descricao: string | null;
    status_de: string | null;
    status_para: string | null;
    automatico: boolean;
    autor: string | null;
    criado_em: string;
  }[];
  agilliza: {
    simulacao_id: string;
    numero_simulacao: string | null;
    proposta_id: string | null;
    numero_proposta: string | null;
    situacao: string | null;
    trazida_em: string;
  } | null;
}

/**
 * Tudo o que o assinante mandou na proposta, para o analista conferir ANTES de agir
 * (`plataforma.detalhe_proposta_assinante`, migração 0207 do Corretor): só leitura, leitura
 * auditada, com o CPF/CNPJ completo para o analista (0212, decifrar auditado). Os arquivos dos documentos só abrem com a
 * proposta assumida por quem vê — a mesma regra do banco (`contexto_da_proposta` +
 * RLS de integracao.midias), aqui só reaproveitada.
 */
export const detalhePropostaAssinante = createServerFn({ method: "GET" })
  .middleware([exigirPermissao(["saas.contas", "view"])])
  .validator((d: unknown) => z.object({ id: UUID }).parse(d))
  .handler(async ({ data, context }) => {
    const { comPlataforma } = await import("./ponte.server");
    const { erroLegivel } = await import("./fila.server");
    const { comChave, documentosCompletos } = await import("./documentos.server");
    return comPlataforma(
      context.userId,
      async (tx) => {
        type Bruto = Omit<DetalhePropostaAssinante, "documentos"> & {
          documentos: (DocumentoPropostaAssinante & { midia_id?: string | null })[];
        };
        let d: Bruto | null = null;
        try {
          const r = await tx.uma<{ d: Bruto }>(
            "select plataforma.detalhe_proposta_assinante($1) as d",
            [data.id],
          );
          d = r?.d ?? null;
        } catch (e) {
          if ((e as { code?: string }).code === "42883") {
            throw erroLegivel(
              "Os detalhes da proposta ainda não estão disponíveis neste servidor (falta a migração 0207 do Agilliza Tech).",
            );
          }
          throw e;
        }
        if (!d) throw new Error("Proposta não encontrada.");
        // Dados completos para o analista, como na base própria (uma leitura auditada) —
        // só para quem pode ver dado sensível, a mesma regra da lista de clientes da conta.
        const { podeVerDadosSensiveis } = await import("./contas.functions");
        const podePii = await podeVerDadosSensiveis(context.supabase, context.userId);
        if (podePii && d.conta?.id) {
          const doc = (await documentosCompletos(tx, d.conta.id, "propostas", [data.id]))[data.id];
          if (doc) {
            d.cliente.documento = doc.documento ?? null;
            if (d.conjuge) d.conjuge.documento = doc.documento_conjuge ?? null;
            d.participantes.forEach((pt, i) => {
              pt.documento = doc.participantes?.[i]?.documento ?? null;
            });
          }
        }
        const comArquivo = d.documentos.filter((doc) => doc.midia_id);
        if (d.minha && comArquivo.length > 0) {
          // Apoio: sem a ponte de arquivos (ou se o banco recusar), a ficha segue sem links.
          await tx.consultar("savepoint arquivos_proposta");
          try {
            await tx.consultar("select plataforma.contexto_da_proposta($1)", [data.id]);
            const { liberarMidias } = await import("./midias.server");
            const urls = await liberarMidias(
              tx,
              comArquivo.map((doc) => doc.midia_id),
            );
            for (const doc of d.documentos) {
              doc.arquivo = doc.midia_id ? (urls[doc.midia_id] ?? null) : null;
            }
            await tx.consultar("release savepoint arquivos_proposta");
          } catch {
            await tx.consultar("rollback to savepoint arquivos_proposta");
          }
        }
        // O id da mídia não sai do servidor: o navegador só recebe o endereço selado.
        const documentos: DocumentoPropostaAssinante[] = d.documentos.map(
          ({ midia_id: _m, ...doc }) => doc,
        );
        return { ...d, documentos } as DetalhePropostaAssinante;
      },
      { kek: comChave() },
    );
  });
