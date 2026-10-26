#!/usr/bin/env node
/**
 * Teste de CORRIDA do financeiro da matriz (frente a5): duas pessoas clicando ao mesmo tempo.
 *
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54341/a5_corrida node scripts/testes/corrida-financeiro.mjs
 *
 * Só aceita banco LOCAL (127.0.0.1/localhost) com as migrações 2026102705* aplicadas (ex.: uma cópia da base fiel
 * de _eco-testes). Grava dados de teste com ids aleatórios e não apaga nada fora deles.
 *
 * Cenários (cada um com duas conexões em transações simultâneas):
 *   1. a mesma linha do extrato conciliada duas vezes ao mesmo tempo  → só uma vence;
 *   2. duas linhas diferentes disputando o MESMO pagamento              → só uma vence (índice único);
 *   3. dois pagamentos de 70 numa conta de 100, ao mesmo tempo          → só um entra (saldo relido sob trava);
 *   4. a mesma comissão do banco gerada duas vezes pelo gatilho        → uma previsão só.
 */
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL (banco local de teste).");
  process.exit(2);
}
const host = new URL(url).hostname;
if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
  console.error("Recusado: este teste só roda em banco local.");
  process.exit(2);
}

const novo = () => crypto.randomUUID();
let falhas = 0;
function confere(cond, texto) {
  console.log(`${cond ? "✔" : "✖"} ${texto}`);
  if (!cond) falhas++;
}

async function conectar() {
  const c = new pg.Client({ connectionString: url, application_name: "corrida-financeiro" });
  await c.connect();
  return c;
}

/** Abre uma transação como a pessoa (auth.uid) e roda o SQL, sem confirmar. */
async function comoPessoa(c, uid, sql, params) {
  await c.query("begin");
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: "authenticated" })]);
  await c.query("set local role authenticated");
  return c.query(sql, params);
}

/** Duas conexões executam ao mesmo tempo; devolve [resultado|erro, resultado|erro]. */
async function aoMesmoTempo(uid, a, b) {
  const [c1, c2] = [await conectar(), await conectar()];
  try {
    const p1 = comoPessoa(c1, uid, a.sql, a.params).then(
      async (r) => {
        await new Promise((ok) => setTimeout(ok, 300)); // segura a trava enquanto a outra tenta
        await c1.query("commit");
        return { ok: true, r };
      },
      async (e) => {
        await c1.query("rollback");
        return { ok: false, e };
      },
    );
    await new Promise((ok) => setTimeout(ok, 50));
    const p2 = comoPessoa(c2, uid, b.sql, b.params).then(
      async (r) => {
        await c2.query("commit");
        return { ok: true, r };
      },
      async (e) => {
        await c2.query("rollback");
        return { ok: false, e };
      },
    );
    return await Promise.all([p1, p2]);
  } finally {
    await c1.end();
    await c2.end();
  }
}

const adm = await conectar();
try {
  // Mundo: correspondente (dono tem todas as permissões), conta bancária, contas e extrato
  const corr = novo();
  await adm.query(
    `insert into public.tipos_pessoa (correspondente_id, nome, slug)
     select gen_random_uuid(), 'Usuário', 'usuario' where not exists (select 1 from public.tipos_pessoa where slug = 'usuario')`,
  );
  await adm.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
    corr,
    `corrida-${corr.slice(0, 8)}@teste.local`,
    { papel_inicial: "correspondente", nome: "Corrida" },
  ]);
  const como = async (sql, params) => {
    const c = await conectar();
    try {
      const r = await comoPessoa(c, corr, sql, params);
      await c.query("commit");
      return r.rows[0];
    } finally {
      await c.end();
    }
  };
  const conta = (await como("select public.fin_cadastro_salvar('conta_bancaria', '{\"apelido\": \"Corrida\"}') as id")).id;
  const pagar = async (valor) =>
    (
      await como(
        "select (public.fin_conta_salvar('pagar', jsonb_build_object('descricao', 'Corrida ' || $1::text, 'valor', $1::numeric, 'vencimento', current_date, 'fornecedor', 'F' || $1::text)) -> 'ids' ->> 0) as id",
        [valor],
      )
    ).id;
  const p100 = await pagar(100);
  const p40 = await pagar(40);
  const baixa40 = (
    await como("select public.fin_registrar_baixa('conta_pagar', $1, 40, current_date, $2) as id", [p40, conta])
  ).id;
  const ext = (
    await como(
      `select (public.fin_importar_extrato($1, 'corrida.ofx', $2, 'ofx', jsonb_build_array(
         jsonb_build_object('data', current_date, 'valor', -40, 'descricao', 'A', 'fitid', $3::text),
         jsonb_build_object('data', current_date, 'valor', -40, 'descricao', 'B', 'fitid', $4::text))) ->> 'extrato_id') as id`,
      [conta, (novo() + novo()).replace(/-/g, "").slice(0, 64), novo(), novo()],
    )
  ).id;
  const linhas = (
    await adm.query("select id from public.fin_extrato_linhas where extrato_id = $1 order by descricao", [ext])
  ).rows.map((x) => x.id);

  // 1. Mesma linha, duas vezes
  const r1 = await aoMesmoTempo(
    corr,
    { sql: "select public.fin_conciliar($1, 'baixa', $2)", params: [linhas[0], baixa40] },
    { sql: "select public.fin_conciliar($1, 'baixa', $2)", params: [linhas[0], baixa40] },
  );
  confere(r1.filter((x) => x.ok).length === 1, "mesma linha conciliada duas vezes ao mesmo tempo: só uma vence");
  const n1 = (
    await adm.query("select count(*)::int n from public.fin_conciliacoes where linha_id = $1 and desfeita_em is null", [linhas[0]])
  ).rows[0].n;
  confere(n1 === 1, `  e fica uma conciliação só (${n1})`);

  // 2. Duas linhas, o mesmo pagamento (desfaz a 1 antes para liberar o pagamento)
  const conc = (await adm.query("select id from public.fin_conciliacoes where linha_id = $1", [linhas[0]])).rows[0].id;
  await como("select public.fin_desfazer_conciliacao($1, 'Preparando a corrida 2')", [conc]);
  const r2 = await aoMesmoTempo(
    corr,
    { sql: "select public.fin_conciliar($1, 'baixa', $2)", params: [linhas[0], baixa40] },
    { sql: "select public.fin_conciliar($1, 'baixa', $2)", params: [linhas[1], baixa40] },
  );
  confere(r2.filter((x) => x.ok).length === 1, "duas linhas disputando o mesmo pagamento: só uma vence");
  const perdedor = r2.find((x) => !x.ok);
  confere(perdedor?.e?.code === "55000", `  a outra recebe "já conciliado" (${perdedor?.e?.code} ${perdedor?.e?.message ?? ""})`);

  // 3. Dois pagamentos de 70 numa conta de 100
  const r3 = await aoMesmoTempo(
    corr,
    { sql: "select public.fin_registrar_baixa('conta_pagar', $1, 70, current_date)", params: [p100] },
    { sql: "select public.fin_registrar_baixa('conta_pagar', $1, 70, current_date)", params: [p100] },
  );
  confere(r3.filter((x) => x.ok).length === 1, "dois pagamentos de 70 numa conta de 100 ao mesmo tempo: só um entra");
  const pago = (await adm.query("select valor_pago::text v from public.financial_payables where id = $1", [p100])).rows[0].v;
  confere(pago === "70.00", `  pago na conta: ${pago}`);

  // 4. Gatilho da comissão do banco disparado em paralelo
  const prop = novo();
  await adm.query(
    `insert into public.propostas (id, correspondente_id, numero_proposta, status, nome_banco, valor_financiamento)
     values ($1::uuid, $2, 'CORRIDA-' || left($1::text, 8), 'analise_juridica', 'Caixa', 100000)`,
    [prop, corr],
  );
  const [c1, c2] = [await conectar(), await conectar()];
  try {
    await c1.query("begin");
    await c2.query("begin");
    await c1.query("select public.calcular_comissao_proposta($1)", [prop]);
    const segunda = c2.query("select public.calcular_comissao_proposta($1)", [prop]);
    await new Promise((ok) => setTimeout(ok, 300));
    await c1.query("commit");
    await segunda;
    await c2.query("commit");
  } finally {
    await c1.end();
    await c2.end();
  }
  const n4 = (await adm.query("select count(*)::int n from public.comissoes where proposta_id = $1", [prop])).rows[0].n;
  confere(n4 === 1, `previsão da comissão do banco gerada em paralelo: uma só (${n4})`);
} finally {
  await adm.end();
}

console.log(falhas ? `\n✖ ${falhas} falha(s).` : "\n✔ Nenhuma corrida passou.");
process.exitCode = falhas ? 1 : 0;
