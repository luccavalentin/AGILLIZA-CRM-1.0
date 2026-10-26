/**
 * "Testar conexão" da caixa vigiada — a regra, sem rede nem banco (as dependências
 * entram por parâmetro; o servidor liga as de verdade em `teste-conexao.server.ts`).
 *
 * Cuidados (o provedor bloqueia a caixa quando há login demais):
 *   · nunca dois logins juntos: o teste pega o mesmo "aluguel" do leitor. Se o leitor
 *     está conectado, a conexão já está provada e o teste não faz login;
 *   · durante a espera depois de uma recusa, não testa (insistir prolonga o bloqueio);
 *   · um teste por minuto por caixa;
 *   · servidor que aponta para rede interna é recusado (a senha não sai para lá).
 */
export interface CaixaParaTeste {
  id: string;
  email: string;
  usuario: string | null;
  imap_host: string;
  imap_port: number;
  imap_ssl: boolean;
  pasta: string;
  tem_senha: boolean;
  status: string;
  espera_ate: string | null;
  teste_em: string | null;
}

export interface DependenciasTeste {
  agora: () => number;
  hostPermitido: (host: string) => Promise<boolean>;
  assumir: () => Promise<boolean>;
  soltar: () => Promise<void>;
  /** Login + abrir a pasta + sair. Lança em falha (com `authenticationFailed` se recusou). */
  conectar: () => Promise<{ mensagens: number | null }>;
}

export interface ResultadoTeste {
  ok: boolean;
  mensagem: string;
  /** false = o teste nem tentou (não grava como resultado de teste). */
  tentou: boolean;
}

export const INTERVALO_TESTE_MS = 60_000;

export function ehRecusaDeLogin(e: unknown): boolean {
  const err = e as { authenticationFailed?: boolean; responseText?: string; message?: string };
  if (err?.authenticationFailed) return true;
  return /authenticat|login|credenc|senha|password|AUTHENTICATIONFAILED/i.test(
    `${err?.responseText ?? ""} ${err?.message ?? ""}`,
  );
}

export async function executarTeste(
  caixa: CaixaParaTeste,
  d: DependenciasTeste,
): Promise<ResultadoTeste> {
  const agora = d.agora();
  if (!caixa.tem_senha) return { ok: false, tentou: false, mensagem: "Informe a senha da caixa antes de testar." };
  if (caixa.espera_ate && new Date(caixa.espera_ate).getTime() > agora) {
    const ate = new Date(caixa.espera_ate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return {
      ok: false,
      tentou: false,
      mensagem: `O provedor recusou um login há pouco: aguarde até ${ate} (testar agora prolongaria o bloqueio).`,
    };
  }
  if (caixa.teste_em && agora - new Date(caixa.teste_em).getTime() < INTERVALO_TESTE_MS) {
    return { ok: false, tentou: false, mensagem: "Aguarde um minuto entre um teste e outro." };
  }
  if (!(await d.hostPermitido(caixa.imap_host))) {
    return {
      ok: false,
      tentou: true,
      mensagem: "Servidor não permitido: o endereço aponta para uma rede interna.",
    };
  }
  if (!(await d.assumir())) {
    if (caixa.status === "conectado") {
      return { ok: true, tentou: true, mensagem: "Conexão confirmada: o leitor está conectado nesta caixa agora." };
    }
    return { ok: false, tentou: false, mensagem: "A caixa está sendo lida neste momento. Tente em instantes." };
  }
  try {
    const r = await d.conectar();
    return {
      ok: true,
      tentou: true,
      mensagem:
        r.mensagens === null
          ? `Conectado. Pasta "${caixa.pasta}" aberta.`
          : `Conectado. Pasta "${caixa.pasta}" com ${r.mensagens} mensagem(ns).`,
    };
  } catch (e) {
    if (ehRecusaDeLogin(e)) {
      return { ok: false, tentou: true, mensagem: "O provedor recusou o login: confira o usuário e a senha." };
    }
    const msg = (e as Error)?.message ?? "";
    if (/mailbox|pasta|nonexistent|does not exist|NONEXISTENT/i.test(msg)) {
      return { ok: false, tentou: true, mensagem: `A pasta "${caixa.pasta}" não existe nesta caixa.` };
    }
    return {
      ok: false,
      tentou: true,
      mensagem: `Não foi possível conectar em ${caixa.imap_host}:${caixa.imap_port}${msg ? ` (${msg.slice(0, 120)})` : ""}.`,
    };
  } finally {
    await d.soltar();
  }
}
