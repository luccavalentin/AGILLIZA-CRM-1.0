/**
 * Leitor dos códigos de acesso — SÓ SERVIDOR, um por processo.
 *
 * Cuidados que vieram do Gerenciador de E-mail antigo, cujas caixas o provedor
 * bloqueava:
 *   · só LÊ: nunca envia e-mail (o reencaminhamento era a maior causa de bloqueio)
 *     e nunca marca como lido (busca com PEEK; quem usa a caixa vê tudo como antes);
 *   · UMA conexão aberta por caixa, em IDLE — nada de login novo a cada verificação;
 *   · um único leitor por caixa no mundo: "aluguel" no banco (codigos_assumir_caixa),
 *     então nem uma cópia local nem um segundo servidor fazem login junto;
 *   · login recusado → espera crescente (5, 10, 20, 30 min) gravada no banco, que
 *     sobrevive a reinícios. Insistir durante um bloqueio só o prolonga.
 *
 * Liga só com LEITOR_CODIGOS=1 no ambiente (o servidor de produção). Em máquina de
 * desenvolvimento ele não roda — um segundo login na caixa é justamente o que bloqueia.
 */
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decifrarSenha } from "./cripto.server";
import { bancoDoRemetente, extrairCodigo, htmlParaTexto, trechoDoCorpo } from "./detectar";
import { avaliarCaptura, type RegraFiltro } from "./filtros";
import { ehRecusaDeLogin } from "./teste-conexao";
import { hostPermitido } from "./rede.server";

const LEITOR = `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
const ALUGUEL_S = 90;
const RENOVAR_MS = 30_000;
const VARREDURA_MS = 30_000;
const ESPERAS_MIN = [5, 10, 20, 30];
const TAMANHO_MAX = 3 * 1024 * 1024;
const GUARDAR_DIAS = 7;

interface Caixa {
  id: string;
  email: string;
  usuario: string | null;
  imap_host: string;
  imap_port: number;
  imap_ssl: boolean;
  pasta: string;
  usar_palavras_padrao: boolean;
  senha_cifrada: string;
  ativo: boolean;
  desde: string;
  ultima_uid: number | null;
  uid_validity: number | null;
  espera_ate: string | null;
  falhas: number;
}

const db = () => supabaseAdmin as unknown as SupabaseClient;
const ativas = new Map<string, { parar: () => void }>();

function log(msg: string, extra?: unknown) {
  if (extra !== undefined) console.log(`[codigos] ${msg}`, extra);
  else console.log(`[codigos] ${msg}`);
}

async function atualizar(id: string, campos: Record<string, unknown>) {
  const { error } = await db()
    .from("codigos_caixas")
    .update({ ...campos, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) log(`não consegui atualizar a caixa ${id}: ${error.message}`);
}

async function assumir(id: string): Promise<boolean> {
  const { data, error } = await db().rpc("codigos_assumir_caixa", {
    p_caixa: id,
    p_leitor: LEITOR,
    p_segundos: ALUGUEL_S,
  });
  if (error) {
    log(`aluguel da caixa ${id} falhou: ${error.message}`);
    return false;
  }
  return data === true;
}


/** Regras de filtro da caixa, relidas a cada lote (quem edita na tela vê valer na hora). */
async function regrasDa(caixaId: string): Promise<RegraFiltro[]> {
  const { data, error } = await db()
    .from("codigos_filtros")
    .select("operador, campo, termo, ativo")
    .eq("caixa_id", caixaId)
    .eq("ativo", true);
  if (error) {
    log(`não consegui ler os filtros da caixa ${caixaId}: ${error.message}`);
    return [];
  }
  return (data ?? []) as RegraFiltro[];
}

/** Lê os e-mails novos da caixa (UID acima do último visto) e grava os capturados. */
async function processarNovos(cliente: ImapFlow, caixa: Caixa, estado: { ultima: number }) {
  const desde = new Date(caixa.desde);
  const intervalo = `${estado.ultima + 1}:*`;
  let maior = estado.ultima;
  // Primeiro a lista (o IMAP não aceita outro comando com o fetch aberto), depois cada e-mail.
  const novos: { uid: number; quando: Date }[] = [];
  for await (const msg of cliente.fetch(
    intervalo,
    { uid: true, internalDate: true, size: true },
    { uid: true },
  )) {
    if (msg.uid <= estado.ultima) continue; // "N:*" sempre devolve ao menos a última
    maior = Math.max(maior, msg.uid);
    const quando = msg.internalDate ? new Date(msg.internalDate) : new Date();
    if (quando < desde) continue;
    if ((msg.size ?? 0) > TAMANHO_MAX) continue;
    novos.push({ uid: msg.uid, quando });
  }
  const regras = novos.length ? await regrasDa(caixa.id) : [];
  for (const n of novos) {
    try {
      await registrarSeCapturado(cliente, caixa, regras, n.uid, n.quando);
    } catch (e) {
      log(`e-mail UID ${n.uid} não pôde ser lido`, (e as Error).message);
    }
  }
  if (maior > estado.ultima) {
    estado.ultima = maior;
    await atualizar(caixa.id, { ultima_uid: maior, ultima_leitura: new Date().toISOString() });
  }
}

async function registrarSeCapturado(
  cliente: ImapFlow,
  caixa: Caixa,
  regras: RegraFiltro[],
  uid: number,
  quando: Date,
) {
  // `source` vem com BODY.PEEK[]: o e-mail continua NÃO LIDO na caixa.
  const m = await cliente.fetchOne(String(uid), { source: true }, { uid: true });
  if (!m || !m.source) return;
  const email = await simpleParser(m.source);
  const assunto = (email.subject ?? "").trim();
  const corpo = (email.text?.trim() || (email.html ? htmlParaTexto(String(email.html)) : "")).slice(0, 20_000);
  const de = email.from?.value?.[0];
  const remetenteEmail = de?.address?.toLowerCase() ?? null;
  const remetenteNome = de?.name?.trim() || null;
  const captura = avaliarCaptura(
    { assunto, corpo, remetenteEmail, remetenteNome },
    regras,
    caixa.usar_palavras_padrao,
  );
  if (!captura.capturar) return;
  // Número só em e-mail que fala de código: no aviso de boleto, "12345678" é outra coisa.
  const codigo = captura.ehCodigo ? extrairCodigo(assunto, corpo) : null;
  const messageId = email.messageId ?? `uid:${caixa.uid_validity ?? 0}:${uid}`;

  const { error } = await db()
    .from("codigos_recebidos")
    .upsert(
      {
        caixa_id: caixa.id,
        message_id: messageId,
        recebido_em: (email.date ?? quando).toISOString(),
        remetente_nome: remetenteNome,
        remetente_email: remetenteEmail,
        banco: bancoDoRemetente(remetenteEmail, remetenteNome),
        assunto: assunto.slice(0, 300) || null,
        trecho: trechoDoCorpo(corpo, codigo) || null,
        codigo,
        motivo: captura.motivo?.slice(0, 200) ?? null,
      },
      { onConflict: "caixa_id,message_id", ignoreDuplicates: true },
    );
  if (error) log(`não gravei o código de ${remetenteEmail}: ${error.message}`);
  else log(`mensagem capturada de ${remetenteEmail ?? "?"} (${codigo ? "com código" : "sem código"})`);
}

/** Uma caixa: conecta, lê o que chegou e fica em IDLE até cair, perder o aluguel ou parar. */
async function vigiar(caixa: Caixa, sinal: { parado: boolean }) {
  // A senha guardada nunca vai para um servidor de rede interna (ver rede.server.ts).
  if (!(await hostPermitido(caixa.imap_host))) {
    throw new Error("servidor não permitido (endereço de rede interna)");
  }
  const cliente = new ImapFlow({
    host: caixa.imap_host,
    port: caixa.imap_port,
    secure: caixa.imap_ssl,
    auth: { user: caixa.usuario || caixa.email, pass: decifrarSenha(caixa.senha_cifrada) },
    logger: false,
    emitLogs: false,
    socketTimeout: 5 * 60_000,
  });
  cliente.on("error", (e: Error) => log(`conexão de ${caixa.email}: ${e.message}`));

  let renovar: ReturnType<typeof setInterval> | undefined;
  try {
    await cliente.connect();
    const lock = await cliente.getMailboxLock(caixa.pasta || "INBOX");
    try {
      const mb = cliente.mailbox && typeof cliente.mailbox === "object" ? cliente.mailbox : null;
      const validade = mb ? Number(mb.uidValidity) : null;
      const proxima = mb ? Number(mb.uidNext ?? 1) : 1;
      // Caixa nova ou recriada no servidor: começa do que existe agora (não importa o passado).
      const mudou = validade !== null && caixa.uid_validity !== null && validade !== caixa.uid_validity;
      const estado = {
        ultima: caixa.ultima_uid !== null && !mudou ? caixa.ultima_uid : Math.max(0, proxima - 1),
      };
      await atualizar(caixa.id, {
        status: "conectado",
        erro: null,
        falhas: 0,
        espera_ate: null,
        uid_validity: validade,
        ultima_uid: estado.ultima,
        ultima_leitura: new Date().toISOString(),
      });
      log(`conectado em ${caixa.email}`);

      let ocupado = false;
      let pendente = false;
      const verificar = async () => {
        if (ocupado) {
          pendente = true;
          return;
        }
        ocupado = true;
        try {
          do {
            pendente = false;
            await processarNovos(cliente, caixa, estado);
          } while (pendente);
        } catch (e) {
          log(`leitura de ${caixa.email} falhou`, (e as Error).message);
        } finally {
          ocupado = false;
        }
      };
      cliente.on("exists", () => void verificar());
      await verificar();

      // Mantém o aluguel; se outro processo assumiu (ou a caixa foi desligada), sai.
      await new Promise<void>((resolver) => {
        renovar = setInterval(() => {
          void (async () => {
            if (sinal.parado || !(await assumir(caixa.id))) {
              resolver();
              return;
            }
            // Rede: confere de tempos em tempos mesmo sem aviso do servidor.
            await verificar();
          })();
        }, RENOVAR_MS);
        cliente.on("close", () => resolver());
      });
    } finally {
      lock.release();
    }
  } finally {
    if (renovar) clearInterval(renovar);
    await cliente.logout().catch(() => cliente.close());
  }
}

async function rodarCaixa(caixa: Caixa) {
  const sinal = { parado: false };
  ativas.set(caixa.id, { parar: () => (sinal.parado = true) });
  try {
    await vigiar(caixa, sinal);
    await atualizar(caixa.id, { status: "aguardando" });
  } catch (e) {
    if (ehRecusaDeLogin(e)) {
      const falhas = caixa.falhas + 1;
      const minutos = ESPERAS_MIN[Math.min(falhas - 1, ESPERAS_MIN.length - 1)]!;
      await atualizar(caixa.id, {
        status: "espera",
        falhas,
        espera_ate: new Date(Date.now() + minutos * 60_000).toISOString(),
        erro: `O provedor recusou o login. Nova tentativa em ${minutos} min (confira a senha se continuar).`,
      });
      log(`login recusado em ${caixa.email}; espera de ${minutos} min`);
    } else {
      await atualizar(caixa.id, {
        status: "erro",
        espera_ate: new Date(Date.now() + 60_000).toISOString(),
        erro: `Conexão falhou: ${(e as Error).message}`.slice(0, 300),
      });
      log(`falha em ${caixa.email}`, (e as Error).message);
    }
  } finally {
    ativas.delete(caixa.id);
    await db().rpc("codigos_soltar_caixa", { p_caixa: caixa.id, p_leitor: LEITOR });
  }
}

async function varrer() {
  const { data, error } = await db()
    .from("codigos_caixas")
    .select(
      "id, email, usuario, imap_host, imap_port, imap_ssl, pasta, usar_palavras_padrao, senha_cifrada, ativo, desde, ultima_uid, uid_validity, espera_ate, falhas",
    );
  if (error) {
    log(`não consegui listar as caixas: ${error.message}`);
    return;
  }
  const agora = Date.now();
  for (const caixa of (data ?? []) as Caixa[]) {
    const rodando = ativas.get(caixa.id);
    if (!caixa.ativo) {
      rodando?.parar();
      continue;
    }
    if (rodando || !caixa.senha_cifrada) continue;
    if (caixa.espera_ate && new Date(caixa.espera_ate).getTime() > agora) continue;
    if (!(await assumir(caixa.id))) continue; // outro processo já lê esta caixa
    void rodarCaixa({
      ...caixa,
      ultima_uid: caixa.ultima_uid === null ? null : Number(caixa.ultima_uid),
      uid_validity: caixa.uid_validity === null ? null : Number(caixa.uid_validity),
    });
  }
  // Códigos antigos não servem para nada: some depois de alguns dias.
  await db()
    .from("codigos_recebidos")
    .delete()
    .lt("recebido_em", new Date(agora - GUARDAR_DIAS * 86_400_000).toISOString());
}

let iniciado = false;

export function iniciarLeitorDeCodigos(): void {
  if (iniciado) return;
  iniciado = true;
  log(`leitor iniciado (${LEITOR})`);
  const ciclo = () => void varrer().catch((e) => log("varredura falhou", (e as Error).message));
  setTimeout(ciclo, 5_000);
  setInterval(ciclo, VARREDURA_MS).unref?.();
}
