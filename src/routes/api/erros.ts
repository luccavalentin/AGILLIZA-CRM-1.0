import { createFileRoute } from "@tanstack/react-router";
import { ipDoCliente } from "@/lib/http/ip-cliente";
import {
  limparTexto,
  linhaDaPilha,
  perfilDaRota,
  rotaSemDado,
} from "@/lib/tecnologia/erros-cliente";

/**
 * Erros que a pessoa viu no navegador do Agilliza → Gestão de Tecnologia (0233).
 *
 * Sem login obrigatório (a tela de entrada também quebra). O corpo é resumido de novo aqui
 * e o banco limpa uma terceira vez: nenhum dado pessoal é gravado. O perfil sai da área do
 * sistema em que o erro aconteceu, nunca do corpo.
 * Freios: corpo até 8 KB, 30 envios por minuto por IP (só em memória; o IP não é gravado)
 * e, no banco, teto por minuto e de grupos novos por hora. Responde 204 sempre (413 para
 * corpo grande): reportar erro nunca vira outro erro no console.
 */
const MAX_BYTES = 8 * 1024;
const POR_MINUTO_POR_IP = 30;
const vazio = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

const g = globalThis as unknown as { __agzErrosPorIp?: Map<string, { minuto: number; n: number }> };
const porIp = (g.__agzErrosPorIp ??= new Map());

function passouDoLimite(ip: string): boolean {
  const minuto = Math.floor(Date.now() / 60_000);
  const atual = porIp.get(ip);
  if (!atual || atual.minuto !== minuto) {
    if (porIp.size > 5000) porIp.clear();
    porIp.set(ip, { minuto, n: 1 });
    return false;
  }
  atual.n += 1;
  return atual.n > POR_MINUTO_POR_IP;
}

/** Com `Origin`, só da própria origem (mesma regra do Corretor, `lib/origem.ts`). */
function mesmaOrigem(req: Request): boolean {
  const origem = req.headers.get("origin");
  if (!origem) return true;
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "")
    .split(",")[0]!
    .trim()
    .toLowerCase();
  try {
    return new URL(origem).host.toLowerCase() === host;
  } catch {
    return false;
  }
}

const curto = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : null);

export const Route = createFileRoute("/api/erros")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!mesmaOrigem(request)) return vazio();
        if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES) {
          return new Response(null, { status: 413 });
        }
        const texto = await request.text().catch(() => "");
        if (!texto || texto.length > MAX_BYTES) return vazio();
        const ip = ipDoCliente((n) => request.headers.get(n)) ?? "desconhecido";
        if (passouDoLimite(ip)) return vazio();

        let corpo: Record<string, unknown>;
        try {
          const c = JSON.parse(texto) as unknown;
          if (!c || typeof c !== "object" || Array.isArray(c)) return vazio();
          corpo = c as Record<string, unknown>;
        } catch {
          return vazio();
        }
        const mensagem = limparTexto(curto(corpo.mensagem, 2000) ?? "");
        if (!mensagem) return vazio();
        const rota = rotaSemDado(curto(corpo.rota, 300) ?? "");

        const { registrarErroNaPlataforma } = await import("@/lib/plataforma/ponte.server");
        await registrarErroNaPlataforma({
          mensagem,
          pilha: linhaDaPilha(curto(corpo.pilha, 4000)),
          tipo: curto(corpo.tipo, 60),
          rota,
          versao: process.env.AGILLIZA_VERSAO ?? null,
          navegador: curto(corpo.navegador, 40),
          sistemaOp: curto(corpo.sistemaOp, 20),
          origem: "navegador",
          perfil: perfilDaRota(rota),
        });
        return vazio();
      },
    },
  },
});
