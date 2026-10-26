import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  BadgeCheck,
  Handshake,
  Link2,
  Mail,
  Phone,
  Search,
  ShieldOff,
  UserPlus,
  Users,
  Hourglass,
  Briefcase,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatData } from "@/lib/financeiro/format";
import { useValorAssentado } from "@/components/plataforma/paginacao";
import { detalheLicenca, type PlanoLicenca } from "@/lib/plataforma/licencas.functions";
import {
  listarVinculados,
  reenviarConviteVinculado,
  type SituacaoVinculado,
  type Vinculado,
} from "@/lib/plataforma/vinculados.functions";
import {
  ROTULO_ACESSO,
  ROTULO_ORIGEM,
  estadoDoAcesso,
  formatarCelular,
  type EstadoAcesso,
} from "@/lib/plataforma/vinculados-regras";
import {
  ConverterParceiro,
  Desvincular,
  NovoVinculado,
  SituacaoDoVinculado,
  VincularContaExistente,
} from "./dialogos-vinculado";

/** Cor do selo do acesso por significado (vermelho só para alerta). */
const TOM_ACESSO: Record<EstadoAcesso, string> = {
  ativo: "border-success/20 bg-success/10 text-success-texto",
  convite_enviado: "border-primary/20 bg-primary/10 text-primary",
  convite_vencido: "border-warning/40 bg-warning/15 text-warning-foreground",
  suspenso: "border-destructive/30 bg-destructive/10 text-destructive",
  encerrado: "border-border bg-muted text-muted-foreground",
};

/**
 * Aba "Vinculados ao correspondente" de Gestão de sistemas › Licenças (C70).
 *
 * Corretores e parceiros da base do Agilliza Correspondente: usam exatamente o portal dos
 * assinantes do Agilliza Tech, sem mensalidade, e entram em "Sua base" nos filtros do
 * correspondente. Componente isolado: a tela de licenças só o encaixa numa aba.
 */
export function VinculadosAba({ planos }: { planos: PlanoLicenca[] }) {
  const listarFn = useServerFn(listarVinculados);
  const podeEditar = usePermissao("saas.licencas", "edit");
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<"todas" | SituacaoVinculado>("todas");
  const [aberto, setAberto] = useState<Vinculado | null>(null);
  const [dialogo, setDialogo] = useState<null | "novo" | "converter" | "existente">(null);
  const termo = useValorAssentado(busca.trim());

  const q = useQuery({
    queryKey: ["plataforma-vinculados", termo, situacao],
    queryFn: () =>
      listarFn({ data: { busca: termo || null, situacao: situacao === "todas" ? null : situacao } }),
    staleTime: 30_000,
    placeholderData: (anterior) => anterior,
  });
  const itens = q.data?.itens ?? [];
  const r = q.data?.resumo;
  const abertoAtual = aberto ? (itens.find((v) => v.id === aberto.id) ?? aberto) : null;

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-xl border border-primary/15 bg-card p-4 sm:p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-primary/5"
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_6px_16px_-6px_rgba(0,15,159,0.55)]">
              <Handshake className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">Vinculados ao correspondente</h2>
              <p className="text-sm text-muted-foreground">
                Mesmo portal, menu e funções dos assinantes do Agilliza Tech. Sem mensalidade, e as
                propostas vêm direto para a nossa operação.
              </p>
            </div>
          </div>
          {podeEditar && (
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3 lg:flex lg:shrink-0">
              <Button onClick={() => setDialogo("novo")} className="min-h-10">
                <UserPlus className="mr-1.5 size-4" /> Cadastrar vinculado
              </Button>
              <Button variant="outline" onClick={() => setDialogo("converter")} className="min-h-10">
                <ArrowRightLeft className="mr-1.5 size-4" /> Converter parceiro
              </Button>
              <Button variant="outline" onClick={() => setDialogo("existente")} className="min-h-10">
                <Link2 className="mr-1.5 size-4" /> Vincular conta existente
              </Button>
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Numero rotulo="Vinculados" valor={r?.total} icone={<Users className="size-4" />} />
        <Numero rotulo="Corretores" valor={r?.corretores} icone={<Briefcase className="size-4" />} />
        <Numero rotulo="Parceiros" valor={r?.parceiros} icone={<Handshake className="size-4" />} />
        <Numero rotulo="Com acesso ativo" valor={r?.ativos} icone={<BadgeCheck className="size-4" />} />
        <Numero
          rotulo="Aguardando acesso"
          valor={r?.aguardando_acesso}
          icone={<Hourglass className="size-4" />}
          detalhe="Ainda não criaram a senha"
        />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 md:flex-row md:items-end">
        <div className="relative flex-1">
          <Label htmlFor="vinc-busca" className="sr-only">
            Buscar vinculado
          </Label>
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="vinc-busca"
            className="pl-9"
            placeholder="Buscar por nome, e-mail ou CRECI"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select value={situacao} onValueChange={(v) => setSituacao(v as typeof situacao)}>
          <SelectTrigger className="md:w-52" aria-label="Situação do vinculado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as situações</SelectItem>
            <SelectItem value="ativo">Com acesso ativo</SelectItem>
            <SelectItem value="aguardando_acesso">Aguardando acesso</SelectItem>
            <SelectItem value="suspenso">Suspensos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {q.isLoading && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      )}
      {q.isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          {mensagemDeErro(q.error, "Não foi possível carregar os vinculados.")}
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={() => q.refetch()}>
              Tentar de novo
            </Button>
          </div>
        </div>
      )}
      {!q.isLoading && !q.isError && itens.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Handshake className="size-6" />
          </span>
          <div>
            <p className="font-medium text-foreground">
              {termo || situacao !== "todas" ? "Nenhum vinculado com estes filtros." : "Nenhum vinculado ainda."}
            </p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Cadastre um corretor ou parceiro da sua base, ou converta quem hoje usa o portal do
              parceiro: ele passa a usar o mesmo portal dos assinantes, sem mensalidade.
            </p>
          </div>
          {podeEditar && !termo && situacao === "todas" && (
            <Button onClick={() => setDialogo("novo")}>
              <UserPlus className="mr-1.5 size-4" /> Cadastrar o primeiro
            </Button>
          )}
        </div>
      )}

      {itens.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {itens.map((v) => (
            <li key={v.id}>
              <CartaoVinculado v={v} onAbrir={() => setAberto(v)} />
            </li>
          ))}
        </ul>
      )}

      <GavetaVinculado vinculado={abertoAtual} planos={planos} onFechar={() => setAberto(null)} />
      {podeEditar && (
        <>
          <NovoVinculado aberto={dialogo === "novo"} aoFechar={() => setDialogo(null)} />
          <ConverterParceiro aberto={dialogo === "converter"} aoFechar={() => setDialogo(null)} />
          <VincularContaExistente aberto={dialogo === "existente"} aoFechar={() => setDialogo(null)} />
        </>
      )}
    </div>
  );
}

function Numero({
  rotulo,
  valor,
  icone,
  detalhe,
}: {
  rotulo: string;
  valor: number | undefined;
  icone: React.ReactNode;
  detalhe?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2 text-muted-foreground">
        <p className="truncate text-xs uppercase tracking-wide">{rotulo}</p>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icone}
        </span>
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{valor ?? "—"}</p>
      {detalhe && <p className="mt-0.5 text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  );
}

function SeloAcesso({ v }: { v: Vinculado }) {
  const e = estadoDoAcesso(v);
  return (
    <Badge variant="outline" className={TOM_ACESSO[e]}>
      {ROTULO_ACESSO[e]}
    </Badge>
  );
}

function CartaoVinculado({ v, onAbrir }: { v: Vinculado; onAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="group flex h-full w-full flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {v.nome
              .split(/\s+/)
              .slice(0, 2)
              .map((p) => p[0])
              .join("")
              .toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{v.nome}</p>
            <p className="text-xs text-muted-foreground">
              {v.tipo === "corretor" ? "Corretor" : "Parceiro"}
              {v.creci ? ` · CRECI ${v.creci}${v.creci_uf ? `/${v.creci_uf}` : ""}` : ""}
            </p>
          </div>
        </div>
        <SeloAcesso v={v} />
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        {v.email && (
          <p className="flex min-w-0 items-center gap-1.5">
            <Mail className="size-3.5 shrink-0" />
            <span className="truncate">{v.email}</span>
          </p>
        )}
        {v.celular && (
          <p className="flex items-center gap-1.5">
            <Phone className="size-3.5 shrink-0" />
            {formatarCelular(v.celular)}
          </p>
        )}
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
        <span>{ROTULO_ORIGEM[v.origem] ?? v.origem}</span>
        <span>desde {formatData(v.vinculado_em ?? v.criado_em)}</span>
      </div>
    </button>
  );
}

function GavetaVinculado({
  vinculado,
  planos,
  onFechar,
}: {
  vinculado: Vinculado | null;
  planos: PlanoLicenca[];
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const podeEditar = usePermissao("saas.licencas", "edit");
  const detalheFn = useServerFn(detalheLicenca);
  const reenviarFn = useServerFn(reenviarConviteVinculado);
  const [acao, setAcao] = useState<null | "suspender" | "reativar" | "desvincular">(null);
  const q = useQuery({
    queryKey: ["plataforma-licenca", vinculado?.id],
    queryFn: () => detalheFn({ data: { id: vinculado!.id } }),
    enabled: !!vinculado,
  });
  const reenviar = useMutation({
    mutationFn: () => reenviarFn({ data: { id: vinculado!.id } }),
    onSuccess: () => {
      toast.success(`Convite reenviado para ${vinculado?.dono_email ?? vinculado?.email}. O link vale 72 horas.`);
      qc.invalidateQueries({ queryKey: ["plataforma-vinculados"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível reenviar o convite.")),
  });
  const uso = q.data?.detalhe?.uso;
  const ativo = vinculado?.status === "ativo";

  return (
    <Sheet open={!!vinculado} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {vinculado && (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6">{vinculado.nome}</SheetTitle>
              <SheetDescription>
                {vinculado.tipo === "corretor" ? "Corretor" : "Parceiro"} vinculado ao Agilliza
                Correspondente · {ROTULO_ORIGEM[vinculado.origem] ?? vinculado.origem}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-5 space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <SeloAcesso v={vinculado} />
                <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                  Sem mensalidade
                </Badge>
              </div>

              <dl className="grid grid-cols-1 gap-3 rounded-lg border border-border p-3 text-sm min-[420px]:grid-cols-2">
                <Campo rotulo="E-mail de acesso" valor={vinculado.dono_email ?? vinculado.email} />
                <Campo rotulo="Celular" valor={formatarCelular(vinculado.celular)} />
                <Campo rotulo="CPF/CNPJ" valor={vinculado.documento_mascarado} />
                <Campo
                  rotulo="CRECI"
                  valor={vinculado.creci ? `${vinculado.creci}/${vinculado.creci_uf ?? ""}` : null}
                />
                <Campo
                  rotulo="Último acesso"
                  valor={vinculado.ultimo_login_em ? formatData(vinculado.ultimo_login_em) : "Nunca entrou"}
                />
                <Campo rotulo="Carteira de" valor={vinculado.carteira} />
              </dl>

              <section>
                <h3 className="mb-2 text-sm font-medium text-foreground">Uso do portal</h3>
                {q.isLoading ? (
                  <Skeleton className="h-16" />
                ) : uso ? (
                  <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-4">
                    <MiniNumero rotulo="Clientes" valor={uso.clientes} />
                    <MiniNumero rotulo="Simulações" valor={uso.simulacoes} />
                    <MiniNumero rotulo="Propostas" valor={uso.propostas} />
                    <MiniNumero rotulo="Usuários" valor={vinculado.usuarios} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem dados de uso.</p>
                )}
              </section>

              {podeEditar && (
                <section className="space-y-2">
                  <h3 className="text-sm font-medium text-foreground">Ações</h3>
                  <div className="grid gap-2 min-[420px]:grid-cols-2">
                    {!vinculado.acesso_criado && ativo && (
                      <Button
                        variant="outline"
                        className="min-h-10"
                        disabled={reenviar.isPending}
                        onClick={() => reenviar.mutate()}
                      >
                        <Mail className="mr-1.5 size-4" />
                        {reenviar.isPending ? "Enviando…" : "Reenviar convite"}
                      </Button>
                    )}
                    {ativo ? (
                      <Button variant="outline" className="min-h-10" onClick={() => setAcao("suspender")}>
                        <ShieldOff className="mr-1.5 size-4" /> Suspender
                      </Button>
                    ) : (
                      <Button variant="outline" className="min-h-10" onClick={() => setAcao("reativar")}>
                        <BadgeCheck className="mr-1.5 size-4" /> Reativar
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="min-h-10 border-destructive/40 text-destructive hover:bg-destructive/5 min-[420px]:col-span-2"
                      onClick={() => setAcao("desvincular")}
                    >
                      <ArrowRightLeft className="mr-1.5 size-4" /> Desvincular
                    </Button>
                  </div>
                </section>
              )}
            </div>

            {(acao === "suspender" || acao === "reativar") && (
              <SituacaoDoVinculado
                vinculado={vinculado}
                acao={acao}
                aoFechar={() => setAcao(null)}
              />
            )}
            {acao === "desvincular" && (
              <Desvincular
                vinculado={vinculado}
                planos={planos}
                aoFechar={() => setAcao(null)}
                aoConcluir={() => {
                  setAcao(null);
                  onFechar();
                }}
              />
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="truncate font-medium text-foreground">{valor || "—"}</dd>
    </div>
  );
}

function MiniNumero({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-lg bg-muted/60 p-2 text-center">
      <p className="text-lg font-semibold tabular-nums text-foreground">{valor}</p>
      <p className="text-[11px] text-muted-foreground">{rotulo}</p>
    </div>
  );
}
