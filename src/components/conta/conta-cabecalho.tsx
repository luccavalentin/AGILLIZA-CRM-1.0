import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Lock, UserRound } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SubNavegacao } from "@/components/ui/sub-navegacao";
import { Icone3D, type TomIcone3D } from "@/components/ui/icone-3d";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getMinhaSessao } from "@/lib/session.functions";

/**
 * Conta > Meu perfil (C69, 26/10/2026): Meus dados, Segurança e Notificações com o
 * MESMO cabeçalho (peça 3D, "Conta · Meu perfil", a pessoa logada à direita) e as abas
 * entre as três telas, na mesma largura e com as mesmas seções.
 */
const PAGINAS = {
  perfil: {
    to: "/conta/perfil",
    rotulo: "Meus dados",
    icone: UserRound,
    tom: "marca" as TomIcone3D,
    descricao: "Nome, foto, telefone e o e-mail com que você entra no Agilliza.",
  },
  seguranca: {
    to: "/conta/seguranca",
    rotulo: "Segurança",
    icone: Lock,
    tom: "sucesso" as TomIcone3D,
    descricao: "Senha de acesso e desbloqueio por biometria neste aparelho.",
  },
  notificacoes: {
    to: "/conta/notificacoes",
    rotulo: "Notificações",
    icone: Bell,
    tom: "alerta" as TomIcone3D,
    descricao: "Quais alertas você recebe e quais tocam som neste navegador.",
  },
} as const;

export type PaginaConta = keyof typeof PAGINAS;

export function ContaCabecalho({
  pagina,
  acoes,
  pessoa,
}: {
  pagina: PaginaConta;
  acoes?: ReactNode;
  /** Nome e foto ainda não salvos (Meus dados mostra o que a pessoa está editando). */
  pessoa?: { nome?: string; foto?: string };
}) {
  const p = PAGINAS[pagina];
  const sessao = useQuery({ queryKey: ["minha-sessao"], queryFn: () => getMinhaSessao() });
  const nome = pessoa?.nome ?? sessao.data?.profile?.nome ?? "";
  const foto = pessoa?.foto ?? sessao.data?.profile?.foto_url ?? "";
  const email = sessao.data?.profile?.email ?? "";
  const iniciais =
    nome
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0]?.toUpperCase())
      .join("") || "?";
  return (
    <div className="space-y-4">
      <PageHeader
        secao="Conta · Meu perfil"
        icone={<p.icone />}
        tom={p.tom}
        titulo={p.rotulo}
        descricao={p.descricao}
        acoes={
          <>
            {acoes}
            <div className="flex min-w-0 max-w-full items-center gap-2.5 rounded-full max-sm:hidden border border-border bg-card py-1 pl-1 pr-3.5 shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
              <Avatar className="size-8">
                <AvatarImage src={foto || undefined} alt={nome} />
                <AvatarFallback className="text-[11px]">{iniciais}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-xs font-semibold text-foreground">{nome || "—"}</p>
                <p className="truncate text-[11px] text-muted-foreground">{email}</p>
              </div>
            </div>
          </>
        }
      />
      <SubNavegacao
        rotulo="Meu perfil"
        itens={Object.values(PAGINAS).map((x) => ({
          to: x.to,
          rotulo: x.rotulo,
          icone: x.icone,
          tom: x.tom,
        }))}
      />
    </div>
  );
}

/** Seção numerada das telas da Conta (cartão com a peça 3D no cabeçalho). */
export function SecaoConta({
  numero,
  icone,
  tom = "marca",
  titulo,
  descricao,
  acoes,
  children,
}: {
  numero?: string;
  icone: ReactNode;
  tom?: TomIcone3D;
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="i3d-grupo overflow-hidden rounded-[14px] border border-[#eceef2] bg-card shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
      <header className="flex items-center gap-3 border-b border-[#f0f1f5] px-4 py-3.5 sm:px-5">
        <Icone3D tom={tom} tamanho="md">
          {icone}
        </Icone3D>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {numero && (
              <span className="text-[10px] font-semibold tracking-[0.16em] text-primary/70 tabular-nums">
                {numero}
              </span>
            )}
            <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
              {titulo}
            </h2>
          </div>
          {descricao && <p className="text-xs text-muted-foreground">{descricao}</p>}
        </div>
        {acoes}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}
