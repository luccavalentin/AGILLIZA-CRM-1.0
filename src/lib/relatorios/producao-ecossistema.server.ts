/**
 * Produção dos assinantes e das contas da Sua base no Agilliza Tech — SÓ SERVIDOR.
 * Carregar por import dinâmico dentro dos handlers (como `ponte.server`).
 *
 * Caminho preferido: a função de agregação `plataforma.producao_do_ecossistema(jsonb)` do
 * banco do Tech (pedida à sessão principal, migração 0306; texto em
 * docs/plataforma/0306_producao_do_ecossistema.sql). Enquanto ela não existir, somamos as
 * listas que já existem (`consultar_simulacoes`/`consultar_propostas`, com permissão
 * conferida no banco), página a página, e paramos com erro explícito se passar do teto —
 * nunca um número cortado sem aviso.
 */
import type { TxPlataforma } from "@/lib/plataforma/ponte.server";
import {
  BLOCO_VAZIO,
  blocoDosFatos,
  fatosDaPropostaTech,
  type BaseProducao,
  type BlocoProducao,
  type FatoProducao,
  type Intervalo,
} from "./producao-ecossistema";
import { dataBR } from "./shared";

export interface PedidoPlataforma {
  base: BaseProducao;
  licenca?: string;
  /** "Minha": só as contas na carteira da pessoa (plataforma.carteira). */
  minha: boolean;
  /** Usuário do Tech (uuid sem o prefixo `t:`). */
  usuario?: string;
  intervalo: Intervalo;
}

export interface RespostaPlataforma {
  bloco: BlocoProducao;
  agregacao: "nativa" | "listas";
  assinanteNome: string | null;
}

const POR_PAGINA = 100;
/** Teto das listas por tipo e período (40 × 100). Passou disso, use a função de agregação. */
const MAX_PAGINAS = 40;

/** Erro com mensagem para a pessoa (a ponte repassa P0001 como está). */
function erroLegivel(mensagem: string): Error {
  return Object.assign(new Error(mensagem), { code: "P0001" });
}

/** Consulta de apoio que pode não existir neste banco (coluna/tabela nova): savepoint. */
async function talvez<T>(tx: TxPlataforma, nome: string, fn: () => Promise<T>): Promise<T | null> {
  await tx.consultar(`savepoint ${nome}`);
  try {
    const r = await fn();
    await tx.consultar(`release savepoint ${nome}`);
    return r;
  } catch {
    await tx.consultar(`rollback to savepoint ${nome}`);
    return null;
  }
}

export async function producaoDaPlataforma(
  tx: TxPlataforma,
  p: PedidoPlataforma,
): Promise<RespostaPlataforma> {
  const assinanteNome =
    p.base === "assinante" && p.licenca
      ? ((
          await talvez(tx, "nome_licenca", () =>
            tx.uma<{ nome: string }>("select nome from nucleo.tenants where id = $1", [p.licenca]),
          )
        )?.nome ?? null)
      : null;

  const nativa = await tx.uma<{ f: string | null }>(
    "select to_regprocedure('plataforma.producao_do_ecossistema(jsonb)')::text as f",
  );
  if (nativa?.f) {
    const r = await tx.uma<{ r: BlocoProducao }>(
      "select plataforma.producao_do_ecossistema($1::jsonb) as r",
      [
        JSON.stringify({
          base: p.base,
          licenca: p.licenca ?? null,
          minha: p.minha,
          usuario: p.usuario ?? null,
          de: p.intervalo.de,
          ate: p.intervalo.ate,
          anterior_de: p.intervalo.anteriorDe,
          anterior_ate: p.intervalo.anteriorAte,
        }),
      ],
    );
    return { bloco: r?.r ?? BLOCO_VAZIO, agregacao: "nativa", assinanteNome };
  }

  // ---- Caminho das listas (sem a função de agregação) ----
  // Contas vinculadas ao correspondente (0305): entram na Sua base, não em Assinantes.
  const vinculadas = new Set(
    (
      (await talvez(tx, "vinculadas", () =>
        tx.consultar<{ id: string }>(
          "select id::text from nucleo.tenants where vinculo_agilliza and deleted_at is null",
        ),
      )) ?? []
    ).map((x) => x.id),
  );
  let carteira: Set<string> | null = null;
  if (p.minha) {
    const linhas = await talvez(tx, "carteira", () =>
      tx.consultar<{ id: string }>(
        `select c.tenant_id::text as id from plataforma.carteira c
          where c.analista_id = seguranca.auth_usuario_id()`,
      ),
    );
    if (linhas === null) {
      throw erroLegivel(
        "Não foi possível ler a sua carteira de assinantes. Use a visão Geral ou peça acesso à carteira.",
      );
    }
    carteira = new Set(linhas.map((x) => x.id));
  }

  const entra = (tenant: string | null | undefined, contaTipo: string | null | undefined) => {
    if (!tenant) return false;
    if (carteira && !carteira.has(tenant)) return false;
    if (p.base === "assinante") return tenant === p.licenca;
    const daBase = contaTipo === "plataforma" || vinculadas.has(tenant);
    return p.base === "sua_base" ? daBase : !daBase;
  };

  const filtroComum = {
    licenca: p.base === "assinante" ? p.licenca : null,
    // Assinantes nunca são a conta da plataforma: o próprio banco já recorta.
    origem: p.base === "assinantes" ? "licenca" : null,
    usuario: p.usuario ?? null,
  };

  async function todas<T>(
    funcao: "consultar_simulacoes" | "consultar_propostas",
    chave: "simulacoes" | "propostas",
    de: string,
    ate: string,
  ): Promise<T[]> {
    const linhas: T[] = [];
    for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
      const r = await tx.uma<{ r: Record<string, unknown> }>(
        `select plataforma.${funcao}($1::jsonb) as r`,
        [
          JSON.stringify({
            ...filtroComum,
            ...(funcao === "consultar_propostas" ? { aceite: "todas" } : {}),
            de,
            ate,
            pagina,
            por_pagina: POR_PAGINA,
          }),
        ],
      );
      const lote = ((r?.r?.[chave] as T[]) ?? []) as T[];
      const total = Number(r?.r?.total ?? 0);
      linhas.push(...lote);
      if (linhas.length >= total || lote.length < POR_PAGINA) return linhas;
    }
    throw erroLegivel(
      `O período tem mais de ${MAX_PAGINAS * POR_PAGINA} ${chave} nos assinantes. Reduza o período ou escolha um assinante (a soma completa depende da função de agregação do banco).`,
    );
  }

  async function fatos(de: string, ate: string): Promise<FatoProducao[]> {
    // Em sequência: é uma conexão só (e há savepoints no meio).
    const sims = await todas<SimulacaoTech>("consultar_simulacoes", "simulacoes", de, ate);
    const props = await todas<PropostaTech>("consultar_propostas", "propostas", de, ate);
    let propsDaBase = props.filter((x) => entra(x.tenant_id, x.conta_tipo));
    if (p.base === "sua_base" && propsDaBase.length) {
      // Proposta do Tech já trazida ao Agilliza (cópia por baixo) conta uma vez só: lá.
      const { anotarVinculoAgilliza } = await import("@/lib/plataforma/fila.server");
      await anotarVinculoAgilliza(tx, propsDaBase as never);
      propsDaBase = propsDaBase.filter((x) => !x.proposta_agilliza_id);
    }
    const out: FatoProducao[] = [];
    for (const s of sims) {
      if (!entra(s.tenant_id, s.conta_tipo)) continue;
      out.push({
        tipo: "simulacao",
        dia: dataBR(s.criado_em),
        usuarioId: s.usuario_id ? `t:${s.usuario_id}` : null,
        usuarioNome: s.usuario ?? null,
        contaId: s.tenant_id,
        contaNome: s.conta ?? null,
      });
    }
    for (const x of propsDaBase) out.push(...fatosDaPropostaTech(x, dataBR));
    return out;
  }

  const atual = await fatos(p.intervalo.de, p.intervalo.ate);
  const anterior = await fatos(p.intervalo.anteriorDe, p.intervalo.anteriorAte);
  return {
    bloco: blocoDosFatos(atual, anterior, p.intervalo.de, p.intervalo.ate),
    agregacao: "listas",
    assinanteNome,
  };
}

interface SimulacaoTech {
  tenant_id: string;
  conta: string | null;
  conta_tipo: string | null;
  usuario_id: string | null;
  usuario: string | null;
  criado_em: string;
}
interface PropostaTech {
  id: string;
  tenant_id: string;
  conta: string | null;
  conta_tipo: string | null;
  status: string;
  criado_em: string;
  valor_aprovado: number | null;
  valor_financiamento: number | null;
  usuario_id: string | null;
  usuario_origem: string | null;
  proposta_agilliza_id?: string | null;
}

/** Opções do filtro: assinantes por nome e usuários de uma conta (só nome, nada de contato). */
export async function opcoesDaPlataforma(
  tx: TxPlataforma,
  o: { busca?: string; licenca?: string; daBase?: boolean },
): Promise<{
  assinantes: { id: string; nome: string; tipo: string }[];
  usuarios: { id: string; nome: string; conta: string | null }[];
}> {
  const busca = o.busca ? o.busca.replace(/[\\%_]/g, (c) => "\\" + c) : null;
  const assinantes =
    (await talvez(tx, "busca_assinantes", () =>
      tx.consultar<{ id: string; nome: string; tipo: string }>(
        `select t.id::text, t.nome, t.tipo::text as tipo
           from nucleo.tenants t
          where t.deleted_at is null and t.tipo <> 'plataforma'
            and not coalesce((to_jsonb(t) ->> 'vinculo_agilliza')::boolean, false)
            and ($1::text is null or t.nome ilike '%' || $1 || '%')
          order by t.nome limit 30`,
        [busca],
      ),
    )) ?? [];
  let usuarios: { id: string; nome: string; conta: string | null }[] = [];
  if (o.licenca) {
    usuarios =
      (await talvez(tx, "usuarios_licenca", () =>
        tx.consultar<{ id: string; nome: string; conta: string | null }>(
          "select ('t:' || u.id::text) as id, u.nome, null::text as conta from plataforma.usuarios_da_licenca($1) u",
          [o.licenca],
        ),
      )) ?? [];
  } else if (o.daBase) {
    // Usuários das contas da Sua base no Tech (vinculadas + a conta da plataforma).
    usuarios =
      (await talvez(tx, "usuarios_base", () =>
        tx.consultar<{ id: string; nome: string; conta: string | null }>(
          `select ('t:' || u.id::text) as id, u.nome, t.nome as conta
             from nucleo.tenants t
             cross join lateral plataforma.usuarios_da_licenca(t.id) u
            where t.deleted_at is null
              and (t.tipo = 'plataforma' or coalesce((to_jsonb(t) ->> 'vinculo_agilliza')::boolean, false))
            order by u.nome limit 300`,
        ),
      )) ?? [];
  }
  return { assinantes, usuarios };
}
