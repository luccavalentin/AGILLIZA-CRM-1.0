import { useEffect, useState } from "react";
import { AtSign, Loader2 } from "lucide-react";
import { Icone3D } from "@/components/ui/icone-3d";
import type { MeuArroba } from "@/components/chat-universal/tipos";
import { arrobaValido, limparArroba } from "@/components/chat-universal/util";
import { apiChatAgilliza } from "@/lib/chat/api-agilliza";
import type { CanalChat } from "@/lib/chat/pessoa.server";

/**
 * "Seu @ no ecossistema" na tela de conta do Agilliza (C01/C02): o @ único — o mesmo nos
 * dois sistemas — e a troca, com a conferência de disponibilidade, a janela de troca e a
 * quarentena de 30 dias do @ antigo (regras no banco).
 */
export function CartaoMeuArroba({ canal }: { canal: CanalChat }) {
  const api = apiChatAgilliza(canal);
  const [meu, setMeu] = useState<MeuArroba | null>(null);
  const [novo, setNovo] = useState("");
  const [livre, setLivre] = useState<{ livre: boolean; motivo?: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);

  useEffect(() => {
    void api.meuArroba().then((r) => (r.ok ? setMeu(r.dados ?? null) : setErro(r.mensagem)));
  }, [api]);
  useEffect(() => {
    setLivre(null);
    if (!arrobaValido(novo) || limparArroba(novo) === meu?.arroba) return;
    const t = setTimeout(
      () =>
        void api.arrobaDisponivel(limparArroba(novo)).then((r) => r.ok && setLivre(r.dados ?? null)),
      450,
    );
    return () => clearTimeout(t);
  }, [api, novo, meu?.arroba]);

  return (
    <section id="meu-arroba" className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <Icone3D icone={AtSign} tamanho="md" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Seu @ no ecossistema</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Qualquer pessoa do ecossistema que tiver o seu @ exato acha você e manda mensagem pelo
            chat. O mesmo @ vale no Agilliza e no Agilliza Tech.
          </p>
          <p className="mt-3 flex items-center gap-1 text-xl font-semibold tracking-tight text-primary">
            <AtSign className="h-5 w-5" aria-hidden />
            {meu?.arroba ?? "…"}
          </p>
          {erro && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {erro}
            </p>
          )}
          {ok && (
            <p role="status" className="mt-2 text-sm text-emerald-700">
              {ok}
            </p>
          )}
          {meu?.pode_trocar_em ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Você trocou há pouco. Dá para trocar de novo em{" "}
              {new Date(meu.pode_trocar_em).toLocaleDateString("pt-BR")}.
            </p>
          ) : (
            <form
              className="mt-3 flex flex-wrap items-center gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                setErro(null);
                setOk(null);
                setIndo(true);
                const r = await api.trocarArroba(limparArroba(novo));
                setIndo(false);
                if (!r.ok) setErro(r.mensagem);
                else if (r.dados?.erro) setErro(r.dados.erro);
                else {
                  setMeu(r.dados ?? null);
                  setNovo("");
                  setOk("Pronto! Seu @ mudou. O antigo fica reservado para você por 30 dias.");
                }
              }}
            >
              <label className="relative w-full max-w-[280px]">
                <span className="sr-only">Novo @</span>
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  @
                </span>
                <input
                  value={novo}
                  onChange={(e) => setNovo(e.target.value)}
                  placeholder="novo.arroba"
                  maxLength={31}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="h-10 w-full rounded-lg border border-input bg-background pl-7 pr-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
                />
              </label>
              <button
                type="submit"
                disabled={indo || !arrobaValido(novo) || livre?.livre === false}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
              >
                {indo && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Trocar o @
              </button>
            </form>
          )}
          {novo && !arrobaValido(novo) && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              De 3 a 30 caracteres: letras sem acento, números, ponto (não no fim nem dois seguidos)
              ou sublinhado.
            </p>
          )}
          {livre && (
            <p
              className={
                livre.livre ? "mt-1.5 text-xs text-emerald-700" : "mt-1.5 text-xs text-destructive"
              }
            >
              {livre.livre ? "Disponível" : (livre.motivo ?? "Indisponível")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
