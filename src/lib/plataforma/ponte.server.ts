/**
 * Ponte para a gestão da plataforma (Corretor 2.0) — SÓ SERVIDOR.
 *
 * O Agilliza correspondente administra as licenças, a receita, o monitoramento e a fila
 * de propostas dos assinantes. Esses dados moram no mesmo banco (banco único), nos
 * esquemas do Corretor, protegidos por RLS com contexto assinado. Em vez de copiar
 * regras, cada operação abre uma transação com o papel `agilliza_ponte` e chama
 * `plataforma.abrir_contexto_agilliza(pessoa)`: o próprio banco confere a permissão da
 * pessoa no Agilliza e abre o contexto do operador-espelho dela. A partir daí valem as
 * mesmas funções e políticas da gestão (migração 0175 do Corretor).
 *
 * Carregar só por import dinâmico dentro de handlers de server functions.
 */
import { isIP } from "node:net";
import pg from "pg";
import { getRequestHeader } from "@tanstack/react-start/server";
import { ipDoCliente } from "@/lib/http/ip-cliente";

export interface TxPlataforma {
  consultar<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  uma<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>;
}

let pool: pg.Pool | null = null;

function obterPool(): pg.Pool {
  const url = process.env.PONTE_DATABASE_URL;
  if (!url) {
    throw new Error("A gestão da plataforma não está configurada neste servidor.");
  }
  pool ??= new pg.Pool({
    connectionString: url,
    max: 8,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: "agilliza-ponte",
  });
  // Sem ouvinte, a queda de uma conexão ociosa (reinício do banco, rede) emite "error" no
  // pool e derruba o processo inteiro do servidor. A conexão ruim sai do pool sozinha.
  if (pool.listenerCount("error") === 0) {
    pool.on("error", (e) => console.error("[ponte-plataforma] conexão ociosa caiu", e.message));
  }
  return pool;
}

/** Erros que saíram do banco (marcados em `consultar`/`uma`), e não do nosso código. */
const DO_BANCO = new WeakSet<object>();

function marcarDoBanco(e: unknown): never {
  if (e && typeof e === "object") DO_BANCO.add(e);
  throw e;
}

/** Códigos das regras do banco que trazem mensagem escrita em português para a pessoa. */
const MENSAGEM_DO_BANCO = new Set([
  "42501", // sem permissão (raise das funções)
  "P0001", // regra de negócio
  "P0002", // não encontrado ("Credencial não encontrada.", "Saldo de créditos insuficiente.")
  "28000", // sessão
  "22023", // valor inválido ("O teste vai de 0 a 365 dias.")
  "55000", // estado que não permite a operação
  "AG404",
  "AG429",
]);

/** Erro do banco → mensagem para a tela. As regras do banco já falam português. */
function traduzir(e: unknown): Error {
  const err = e as { code?: string; message?: string; constraint?: string; table?: string };
  // Mensagem lançada pelo nosso próprio código dentro da transação ("Fatura não encontrada
  // ou já baixada.", "Conta não encontrada."): é para a pessoa, passa intacta. Erro de
  // programação (TypeError etc.) e falha de conexão do pg não entram aqui.
  if (e instanceof Error && e.constructor === Error && !err.code && !DO_BANCO.has(e) && e.message) {
    return e;
  }
  const codigo = err?.code ?? "";
  const msg = err?.message ?? "";
  // A RLS recusa em inglês ("new row violates row-level security policy…").
  if (codigo === "42501" && /row-level security|permission denied/i.test(msg)) {
    return new Error("Você não tem permissão para esta operação na plataforma.");
  }
  if (msg && MENSAGEM_DO_BANCO.has(codigo)) return new Error(msg);
  if (codigo.startsWith("23")) {
    // Sem tabela nem restrição, foi a função que levantou a mensagem (escrita para gente).
    if (msg && !err.constraint && !err.table) return new Error(msg);
    if (codigo === "23505") return new Error("Já existe um registro com esses dados.");
    if (codigo === "23502") return new Error("Falta preencher um dado obrigatório.");
    return new Error("Os dados enviados não passaram na validação.");
  }
  if (codigo === "40001" || codigo === "40P01" || codigo === "55P03") {
    return new Error("A plataforma estava ocupada com a mesma informação. Tente de novo.");
  }
  if (codigo === "57014") {
    return new Error(
      "A consulta demorou demais. Use filtros para reduzir a lista e tente de novo.",
    );
  }
  if (codigo === "22P02") return new Error("Algum dado chegou em formato inválido.");
  console.error("[ponte-plataforma]", codigo, msg);
  return new Error("Não foi possível concluir a operação na plataforma.");
}

/**
 * Executa `fn` numa transação da plataforma em nome da pessoa do Agilliza.
 * Tudo dentro de `fn` roda com o contexto dela (RLS + funções da gestão).
 */
/**
 * Executa `fn` DENTRO da conta de um assinante (corretor/imobiliária), como o
 * "atendimento da carteira" do Corretor (`plataforma.atender_conta`, migração 0143):
 * a conta-sombra da pessoa entra como admin, com pessoas, configurações, equipe e
 * financeiro da conta negados, e o acesso fica em `auditoria.acessos_sensiveis`.
 * A sessão aberta para isso é encerrada no fim da própria transação.
 */
export async function comConta<R>(
  authUid: string,
  tenantId: string,
  fn: (tx: TxPlataforma) => Promise<R>,
): Promise<R> {
  return comPlataforma(authUid, async (tx) => {
    const a = await tx.uma<{ token: string }>(
      "select token from plataforma.atender_conta($1, null, 'agilliza-ponte', 'agilliza-ponte')",
      [tenantId],
    );
    if (!a?.token) throw new Error("Não foi possível abrir a conta do assinante.");
    // A KEK só é necessária para abrir dado cifrado da conta (ex.: CPF ao levar a proposta).
    await tx.uma("select seguranca.iniciar_contexto($1, $2, $3)", [
      a.token,
      tenantId,
      process.env.CORRETOR_KEK || null,
    ]);
    // Em erro, o rollback de comPlataforma já desfaz a sessão de atendimento; tentar
    // encerrá-la numa transação abortada só esconderia o erro verdadeiro.
    const r = await fn(tx);
    await tx.uma("select acesso.encerrar_sessao($1)", [a.token]);
    return r;
  });
}

export async function comPlataforma<R>(
  authUid: string,
  fn: (tx: TxPlataforma) => Promise<R>,
  opcoes: { kek?: boolean } = {},
): Promise<R> {
  const banco = obterPool();
  let c: pg.PoolClient;
  try {
    c = await banco.connect();
  } catch (e) {
    console.error("[ponte-plataforma] sem conexão", (e as Error)?.message);
    throw new Error("A plataforma não respondeu agora. Tente de novo em instantes.");
  }
  const q = (sql: string, params?: unknown[]) =>
    c.query(sql, params as unknown[]).catch(marcarDoBanco);
  // Conexão que falhou no rollback não volta para o pool (seria entregue quebrada ao próximo).
  let descartar = false;
  try {
    await q("begin");
    let ip: string | null = null;
    let ua: string | null = null;
    try {
      ip = ipDoCliente(getRequestHeader);
      ua = getRequestHeader("user-agent") ?? null;
    } catch {
      /* fora de requisição (teste): sem IP */
    }
    // O banco converte para inet: cabeçalho forjado ("abc") derrubaria toda operação.
    if (ip && !isIP(ip)) ip = null;
    await q("select plataforma.abrir_contexto_agilliza($1, $2, $3)", [authUid, ip, ua]);
    // Chave-mestra só para quem cifra/decifra (credenciais dos provedores) — e só nesta transação.
    if (opcoes.kek) {
      const kek = process.env.CORRETOR_KEK;
      if (!kek) throw new Error("A chave de cifragem não está configurada neste servidor.");
      await q("select set_config('app.kek', $1, true)", [kek]);
    }
    const tx: TxPlataforma = {
      consultar: async (sql, params) => (await q(sql, params)).rows,
      uma: async (sql, params) => (await q(sql, params)).rows[0] ?? null,
    };
    const r = await fn(tx);
    await q("commit");
    return r;
  } catch (e) {
    await c.query("rollback").catch(() => {
      descartar = true;
    });
    throw traduzir(e);
  } finally {
    c.release(descartar);
  }
}

/**
 * Credencial de um provedor guardada em "Chaves dos provedores" (cifrada no banco), lida
 * pelo SISTEMA — nunca em nome de uma pessoa: a função do banco recusa se houver contexto
 * de usuário. É assim que o Agilliza e o Corretor usam a MESMA chave da integração bancária,
 * cadastrada uma vez só na tela. `null` quando não há credencial ativa no ambiente.
 */
export async function credencialDoSistema(
  provedor: string,
): Promise<{ base_url: string | null; segredo: Record<string, string> } | null> {
  const kek = process.env.CORRETOR_KEK;
  if (!kek || !process.env.PONTE_DATABASE_URL) return null;
  const ambiente =
    (process.env.PROVEDOR_AMBIENTE ?? "homologacao") === "producao" ? "producao" : "homologacao";
  const c = await obterPool().connect();
  try {
    await c.query("begin");
    await c.query("select set_config('app.kek', $1, true)", [kek]);
    const r = await c.query<{
      c: { base_url: string | null; segredo: Record<string, string> } | null;
    }>("select plataforma.credencial_do_sistema($1, $2) as c", [provedor, ambiente]);
    await c.query("commit");
    return r.rows[0]?.c ?? null;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    console.error("[ponte-plataforma] credencial", provedor, (e as { code?: string }).code);
    return null;
  } finally {
    c.release();
  }
}

/**
 * Erro do Agilliza (navegador ou servidor) → Gestão de Tecnologia (migração 0233).
 * Grava pelo papel da ponte, SEM contexto de pessoa: o banco só aceita a função
 * `plataforma.registrar_erro_agilliza`, que limpa o texto e agrupa. Nunca lança — e
 * sem ponte configurada (desenvolvimento) simplesmente não grava.
 */
export async function registrarErroNaPlataforma(e: {
  mensagem: string;
  pilha?: string | null;
  tipo?: string | null;
  rota?: string | null;
  versao?: string | null;
  navegador?: string | null;
  sistemaOp?: string | null;
  origem: "navegador" | "servidor";
  perfil?: string | null;
}): Promise<void> {
  if (!process.env.PONTE_DATABASE_URL) return;
  try {
    await obterPool().query(
      "select plataforma.registrar_erro_agilliza($1, $2, $3, $4, $5, $6, $7, $8, $9)",
      [
        e.mensagem,
        e.pilha ?? null,
        e.tipo ?? null,
        e.rota ?? null,
        e.versao ?? null,
        e.navegador ?? null,
        e.sistemaOp ?? null,
        e.origem,
        e.perfil ?? null,
      ],
    );
  } catch {
    // Banco fora ou função ainda não migrada: o erro original já foi para o console.
  }
}

/** Sonda de saúde da ponte (`/api/saude`): `select 1` com tempo-limite de 2 s. */
export async function sondarPonte(): Promise<{
  configurada: boolean;
  ok: boolean;
  ms: number | null;
}> {
  if (!process.env.PONTE_DATABASE_URL) return { configurada: false, ok: false, ms: null };
  const t0 = performance.now();
  try {
    await Promise.race([
      obterPool().query("select 1"),
      new Promise((_, rejeitar) => setTimeout(() => rejeitar(new Error("tempo esgotado")), 2000)),
    ]);
    return { configurada: true, ok: true, ms: Math.round(performance.now() - t0) };
  } catch {
    return { configurada: true, ok: false, ms: null };
  }
}
