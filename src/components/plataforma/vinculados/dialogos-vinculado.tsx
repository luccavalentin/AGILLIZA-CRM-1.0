import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL } from "@/lib/financeiro/format";
import { pessoasParaCarteira, type PlanoLicenca } from "@/lib/plataforma/licencas.functions";
import {
  buscarContaParaVincular,
  converterParceiroEmVinculado,
  criarVinculado,
  desvincularVinculado,
  listarParceirosParaConverter,
  situacaoVinculado,
  vincularContaExistente,
  type ContaExistente,
  type ParceiroAgilliza,
  type TipoVinculado,
  type Vinculado,
} from "@/lib/plataforma/vinculados.functions";
import { documentoValido, normalizarCreci, somenteDigitos } from "@/lib/plataforma/vinculados-regras";

const SEM_CARTEIRA = "__nenhuma__";

function useInvalidarVinculados() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["plataforma-vinculados"] });
    qc.invalidateQueries({ queryKey: ["plataforma-licencas"] });
    qc.invalidateQueries({ queryKey: ["plataforma-licenca"] });
  };
}

function TipoSegmentado({ valor, aoMudar }: { valor: TipoVinculado; aoMudar: (t: TipoVinculado) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Tipo do vinculado">
      {(["corretor", "parceiro"] as TipoVinculado[]).map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={valor === t}
          onClick={() => aoMudar(t)}
          className={
            "min-h-10 rounded-md px-2 text-sm font-medium transition-colors " +
            (valor === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")
          }
        >
          {t === "corretor" ? "Corretor" : "Parceiro"}
        </button>
      ))}
    </div>
  );
}

function CampoCarteira({ valor, aoMudar, ativo }: { valor: string; aoMudar: (v: string) => void; ativo: boolean }) {
  const pessoasFn = useServerFn(pessoasParaCarteira);
  const pessoas = useQuery({
    queryKey: ["plataforma-pessoas-carteira"],
    queryFn: () => pessoasFn(),
    enabled: ativo,
    staleTime: 60_000,
  });
  return (
    <div className="space-y-1.5">
      <Label>Carteira de</Label>
      <Select value={valor} onValueChange={aoMudar}>
        <SelectTrigger aria-label="Carteira de">
          <SelectValue placeholder="Quem cuida deste vinculado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SEM_CARTEIRA}>Sem carteira por enquanto</SelectItem>
          {(pessoas.data ?? []).map((p) => (
            <SelectItem key={p.auth_uid} value={p.auth_uid}>
              {p.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CampoMotivo({ id, valor, aoMudar, exemplo }: { id: string; valor: string; aoMudar: (v: string) => void; exemplo: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Motivo</Label>
      <Textarea id={id} rows={2} placeholder={exemplo} value={valor} onChange={(e) => aoMudar(e.target.value)} />
      <p className="text-xs text-muted-foreground">Fica no histórico da conta.</p>
    </div>
  );
}

/* ------------------------------------------------------------- cadastrar --- */

export function NovoVinculado({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const criarFn = useServerFn(criarVinculado);
  const invalidar = useInvalidarVinculados();
  const [tipo, setTipo] = useState<TipoVinculado>("corretor");
  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [creci, setCreci] = useState("");
  const [creciUf, setCreciUf] = useState("");
  const [email, setEmail] = useState("");
  const [celular, setCelular] = useState("");
  const [carteira, setCarteira] = useState(SEM_CARTEIRA);
  const [motivo, setMotivo] = useState("");

  function limpar() {
    setTipo("corretor");
    setNome("");
    setDocumento("");
    setCreci("");
    setCreciUf("");
    setEmail("");
    setCelular("");
    setCarteira(SEM_CARTEIRA);
    setMotivo("");
  }

  const criar = useMutation({
    mutationFn: () =>
      criarFn({
        data: {
          tipo,
          nome,
          documento,
          creci,
          creciUf,
          email,
          celular,
          carteira: carteira === SEM_CARTEIRA ? null : carteira,
          motivo,
        },
      }),
    onSuccess: () => {
      toast.success(`Vinculado cadastrado. ${email} recebeu o convite para criar a senha.`);
      invalidar();
      limpar();
      aoFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível cadastrar o vinculado.")),
  });

  const docOk = documentoValido(documento);
  const creciOk = tipo === "parceiro" ? !normalizarCreci(creci) || /^[A-Za-z]{2}$/.test(creciUf) : !!normalizarCreci(creci) && /^[A-Za-z]{2}$/.test(creciUf);
  const pronto =
    nome.trim().length >= 2 &&
    docOk &&
    creciOk &&
    /\S+@\S+\.\S+/.test(email) &&
    [10, 11].includes(somenteDigitos(celular).length) &&
    motivo.trim().length >= 5;

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Cadastrar vinculado</DialogTitle>
          <DialogDescription>
            A pessoa ganha uma conta no Agilliza Tech, igual à dos assinantes, sem mensalidade. Ela
            recebe um e-mail para criar a própria senha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <TipoSegmentado valor={tipo} aoMudar={setTipo} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="nv-nome">{tipo === "corretor" ? "Nome do corretor" : "Nome ou razão social"}</Label>
              <Input id="nv-nome" value={nome} maxLength={200} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nv-doc">CPF ou CNPJ</Label>
              <Input
                id="nv-doc"
                inputMode="numeric"
                value={documento}
                aria-invalid={documento.length > 10 && !docOk}
                onChange={(e) => setDocumento(e.target.value)}
              />
              {documento.length > 10 && !docOk && <p className="text-xs text-destructive">CPF ou CNPJ inválido.</p>}
            </div>
            <div className="grid grid-cols-[1fr_72px] gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="nv-creci">CRECI{tipo === "parceiro" ? " (opcional)" : ""}</Label>
                <Input id="nv-creci" value={creci} maxLength={20} onChange={(e) => setCreci(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nv-uf">UF</Label>
                <Input id="nv-uf" maxLength={2} value={creciUf} onChange={(e) => setCreciUf(e.target.value.toUpperCase())} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nv-email">E-mail de acesso</Label>
              <Input
                id="nv-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nv-cel">Celular com DDD</Label>
              <Input id="nv-cel" inputMode="tel" value={celular} onChange={(e) => setCelular(e.target.value)} />
            </div>
          </div>
          <CampoCarteira valor={carteira} aoMudar={setCarteira} ativo={aberto} />
          <CampoMotivo id="nv-motivo" valor={motivo} aoMudar={setMotivo} exemplo="Ex.: corretor parceiro da equipe do Lucca" />
        </div>

        <DialogFooter>
          <Button variant="outline" className="w-full sm:w-auto" onClick={aoFechar} disabled={criar.isPending}>
            Cancelar
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => criar.mutate()} disabled={!pronto || criar.isPending}>
            {criar.isPending ? "Cadastrando…" : "Cadastrar e enviar convite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------- converter parceiro antigo --- */

export function ConverterParceiro({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const listarFn = useServerFn(listarParceirosParaConverter);
  const converterFn = useServerFn(converterParceiroEmVinculado);
  const invalidar = useInvalidarVinculados();
  const qc = useQueryClient();
  const [escolhido, setEscolhido] = useState<ParceiroAgilliza | null>(null);
  const [filtro, setFiltro] = useState("");
  const [tipo, setTipo] = useState<TipoVinculado>("corretor");
  const [documento, setDocumento] = useState("");
  const [celular, setCelular] = useState("");
  const [creci, setCreci] = useState("");
  const [creciUf, setCreciUf] = useState("");
  const [carteira, setCarteira] = useState(SEM_CARTEIRA);
  const [motivo, setMotivo] = useState("Migração do portal do parceiro para o Agilliza Tech");

  const q = useQuery({ queryKey: ["plataforma-parceiros-agilliza"], queryFn: () => listarFn(), enabled: aberto });
  const lista = (q.data ?? []).filter((p) => {
    const t = filtro.trim().toLowerCase();
    return !t || p.nome.toLowerCase().includes(t) || (p.email ?? "").toLowerCase().includes(t);
  });

  function escolher(p: ParceiroAgilliza) {
    setEscolhido(p);
    setDocumento(p.documento ?? "");
    setCelular(p.telefone ?? "");
    setCreci(p.creci ?? "");
    setCreciUf("");
  }

  const converter = useMutation({
    mutationFn: () =>
      converterFn({
        data: {
          authUid: escolhido!.auth_uid,
          tipo,
          documento,
          celular,
          creci,
          creciUf,
          carteira: carteira === SEM_CARTEIRA ? null : carteira,
          motivo,
        },
      }),
    onSuccess: (r) => {
      toast.success(
        r.contaExistente
          ? `${escolhido?.nome} já tinha conta no Agilliza Tech: a conta foi vinculada.`
          : `${escolhido?.nome} virou vinculado e recebeu o convite para criar a senha.`,
      );
      invalidar();
      qc.invalidateQueries({ queryKey: ["plataforma-parceiros-agilliza"] });
      setEscolhido(null);
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível converter o parceiro.")),
  });

  const existente = !!escolhido?.conta_existente;
  const pronto =
    !!escolhido &&
    motivo.trim().length >= 5 &&
    (existente ||
      (documentoValido(documento) &&
        [10, 11].includes(somenteDigitos(celular).length) &&
        (tipo === "parceiro" || (!!normalizarCreci(creci) && /^[A-Za-z]{2}$/.test(creciUf)))));

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        if (!v) {
          setEscolhido(null);
          aoFechar();
        }
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Converter parceiro do Agilliza em vinculado</DialogTitle>
          <DialogDescription>
            Quem hoje usa o portal do parceiro passa a usar o portal dos assinantes do Agilliza Tech,
            sem mensalidade. O portal antigo continua funcionando até a pessoa entrar no novo.
          </DialogDescription>
        </DialogHeader>

        {!escolhido ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar parceiro" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
            </div>
            {q.isLoading && <Skeleton className="h-40" />}
            {q.isError && <p className="text-sm text-destructive">{mensagemDeErro(q.error, "Não foi possível carregar os parceiros.")}</p>}
            {!q.isLoading && !q.isError && lista.length === 0 && (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhum parceiro do portal antigo encontrado.
              </p>
            )}
            <ul className="max-h-[50dvh] space-y-2 overflow-y-auto">
              {lista.map((p) => (
                <li key={p.auth_uid}>
                  <button
                    type="button"
                    disabled={!!p.convertido_tenant || !p.ativo}
                    onClick={() => escolher(p)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{p.razao_social || p.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                    </div>
                    <span className="shrink-0 text-xs">
                      {p.convertido_tenant ? (
                        <span className="inline-flex items-center gap-1 text-success-texto">
                          <CheckCircle2 className="size-3.5" /> Já convertido
                        </span>
                      ) : !p.ativo ? (
                        <span className="text-muted-foreground">Inativo</span>
                      ) : p.conta_existente ? (
                        <span className="text-primary">Já tem conta no Agilliza Tech</span>
                      ) : (
                        <span className="text-primary">Converter</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
              <p className="font-medium text-foreground">{escolhido.razao_social || escolhido.nome}</p>
              <p className="text-muted-foreground">{escolhido.email} · nome e e-mail vêm do cadastro do Agilliza</p>
            </div>
            {existente ? (
              <p className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                Este e-mail já tem conta no Agilliza Tech. A conta existente será vinculada (a
                assinatura dela é encerrada e ela deixa de ser cobrada).
              </p>
            ) : (
              <>
                <TipoSegmentado valor={tipo} aoMudar={setTipo} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cp-doc">CPF ou CNPJ</Label>
                    <Input id="cp-doc" inputMode="numeric" value={documento} onChange={(e) => setDocumento(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cp-cel">Celular com DDD</Label>
                    <Input id="cp-cel" inputMode="tel" value={celular} onChange={(e) => setCelular(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-[1fr_72px] gap-2 sm:col-span-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="cp-creci">CRECI{tipo === "parceiro" ? " (opcional)" : ""}</Label>
                      <Input id="cp-creci" value={creci} onChange={(e) => setCreci(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cp-uf">UF</Label>
                      <Input id="cp-uf" maxLength={2} value={creciUf} onChange={(e) => setCreciUf(e.target.value.toUpperCase())} />
                    </div>
                  </div>
                </div>
                <CampoCarteira valor={carteira} aoMudar={setCarteira} ativo={aberto} />
              </>
            )}
            <CampoMotivo id="cp-motivo" valor={motivo} aoMudar={setMotivo} exemplo="Migração do portal do parceiro" />
          </div>
        )}

        <DialogFooter>
          {escolhido ? (
            <>
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setEscolhido(null)} disabled={converter.isPending}>
                Voltar
              </Button>
              <Button className="w-full sm:w-auto" disabled={!pronto || converter.isPending} onClick={() => converter.mutate()}>
                {converter.isPending ? "Convertendo…" : existente ? "Vincular a conta" : "Converter e enviar convite"}
              </Button>
            </>
          ) : (
            <Button variant="outline" className="w-full sm:w-auto" onClick={aoFechar}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------ vincular conta existente --- */

export function VincularContaExistente({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const buscarFn = useServerFn(buscarContaParaVincular);
  const vincularFn = useServerFn(vincularContaExistente);
  const invalidar = useInvalidarVinculados();
  const [email, setEmail] = useState("");
  const [conta, setConta] = useState<ContaExistente | null | undefined>(undefined);
  const [motivo, setMotivo] = useState("");

  const buscar = useMutation({
    mutationFn: () => buscarFn({ data: { email } }),
    onSuccess: (c) => setConta(c),
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível procurar a conta.")),
  });
  const vincular = useMutation({
    mutationFn: () => vincularFn({ data: { id: conta!.tenant_id, motivo } }),
    onSuccess: () => {
      toast.success(`${conta?.nome} agora é vinculada ao correspondente e não é mais cobrada.`);
      invalidar();
      setConta(undefined);
      setEmail("");
      setMotivo("");
      aoFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível vincular a conta.")),
  });

  const bloqueio = conta
    ? conta.vinculada
      ? "Esta conta já é vinculada ao correspondente."
      : conta.faturas_em_aberto > 0
        ? `A conta tem ${conta.faturas_em_aberto} fatura(s) em aberto: acerte ou cancele na Receita antes.`
        : null
    : null;

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Vincular conta existente</DialogTitle>
          <DialogDescription>
            Para o corretor ou parceiro que já usa o Agilliza Tech como assinante. A assinatura é
            encerrada e a conta deixa de ser cobrada, sem perder nada.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              buscar.mutate();
            }}
          >
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="vc-email">E-mail do dono da conta</Label>
              <Input id="vc-email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" variant="outline" disabled={!/\S+@\S+\.\S+/.test(email) || buscar.isPending}>
              {buscar.isPending ? "Procurando…" : "Procurar"}
            </Button>
          </form>
          {conta === null && (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Nenhuma conta de corretor ou parceiro com este e-mail.
            </p>
          )}
          {conta && (
            <div className="rounded-lg border border-border p-3 text-sm">
              <p className="font-medium text-foreground">{conta.nome}</p>
              <p className="text-muted-foreground">
                {conta.tipo === "corretor" ? "Corretor" : "Parceiro"} · plano {conta.plano ?? "—"} · {conta.status}
              </p>
              {bloqueio && <p className="mt-2 text-warning-foreground">{bloqueio}</p>}
            </div>
          )}
          {conta && !bloqueio && (
            <CampoMotivo id="vc-motivo" valor={motivo} aoMudar={setMotivo} exemplo="Ex.: corretor entrou para a base do correspondente" />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" className="w-full sm:w-auto" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button
            className="w-full sm:w-auto"
            disabled={!conta || !!bloqueio || motivo.trim().length < 5 || vincular.isPending}
            onClick={() => vincular.mutate()}
          >
            {vincular.isPending ? "Vinculando…" : "Vincular conta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------- suspender / reativar --- */

export function SituacaoDoVinculado({
  vinculado,
  acao,
  aoFechar,
}: {
  vinculado: Vinculado;
  acao: "suspender" | "reativar";
  aoFechar: () => void;
}) {
  const fn = useServerFn(situacaoVinculado);
  const invalidar = useInvalidarVinculados();
  const [motivo, setMotivo] = useState("");
  const m = useMutation({
    mutationFn: () => fn({ data: { id: vinculado.id, acao, motivo } }),
    onSuccess: () => {
      toast.success(acao === "suspender" ? "Vinculado suspenso. Quem estava dentro saiu." : "Vinculado reativado.");
      invalidar();
      aoFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível mudar a situação.")),
  });
  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{acao === "suspender" ? "Suspender vinculado" : "Reativar vinculado"}</DialogTitle>
          <DialogDescription>
            {acao === "suspender"
              ? `${vinculado.nome} perde o acesso ao portal agora. Nada é apagado.`
              : `${vinculado.nome} volta a entrar no portal.`}
          </DialogDescription>
        </DialogHeader>
        <CampoMotivo
          id="sv-motivo"
          valor={motivo}
          aoMudar={setMotivo}
          exemplo={acao === "suspender" ? "Ex.: CRECI vencido" : "Ex.: CRECI renovado"}
        />
        <DialogFooter>
          <Button variant="outline" className="w-full sm:w-auto" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button
            variant={acao === "suspender" ? "destructive" : "default"}
            className="w-full sm:w-auto"
            disabled={motivo.trim().length < 5 || m.isPending}
            onClick={() => m.mutate()}
          >
            {m.isPending ? "Salvando…" : acao === "suspender" ? "Suspender" : "Reativar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------------------------- desvincular --- */

export function Desvincular({
  vinculado,
  planos,
  aoFechar,
  aoConcluir,
}: {
  vinculado: Vinculado;
  planos: PlanoLicenca[];
  aoFechar: () => void;
  aoConcluir: () => void;
}) {
  const fn = useServerFn(desvincularVinculado);
  const invalidar = useInvalidarVinculados();
  const [destino, setDestino] = useState<"assinante" | "encerrar">("assinante");
  const [planoId, setPlanoId] = useState("");
  const [dias, setDias] = useState("0");
  const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const publico = vinculado.tipo === "parceiro" ? "parceiro" : "corretor";
  const planosDoTipo = planos.filter((p) => p.publico === publico);
  const diasN = Number(dias);

  const m = useMutation({
    mutationFn: () =>
      fn({
        data: {
          id: vinculado.id,
          destino,
          planoId: destino === "assinante" ? planoId : null,
          diasTeste: destino === "assinante" ? diasN : 0,
          motivo,
        },
      }),
    onSuccess: () => {
      toast.success(
        destino === "encerrar"
          ? `${vinculado.nome} foi desvinculado e a conta encerrada. Os dados continuam guardados.`
          : `${vinculado.nome} agora é assinante comum (${diasN > 0 ? `${diasN} dias de teste` : "paga para continuar"}).`,
      );
      invalidar();
      aoConcluir();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível desvincular.")),
  });

  const pronto =
    confirmado &&
    motivo.trim().length >= 5 &&
    (destino === "encerrar" || (!!planoId && Number.isInteger(diasN) && diasN >= 0 && diasN <= 365));

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Desvincular {vinculado.nome}</DialogTitle>
          <DialogDescription>
            A conta sai da base do correspondente. Clientes, imóveis, propostas e documentos
            continuam na conta — nada é apagado.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <legend className="sr-only">O que acontece com a conta</legend>
            {(
              [
                { id: "assinante", titulo: "Vira assinante", texto: "Continua no Agilliza Tech pagando um plano." },
                { id: "encerrar", titulo: "Encerrar a conta", texto: "O acesso acaba; os dados ficam guardados." },
              ] as const
            ).map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={destino === o.id}
                onClick={() => setDestino(o.id)}
                className={
                  "rounded-lg border p-3 text-left transition-colors " +
                  (destino === o.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50")
                }
              >
                <span className="block text-sm font-semibold">{o.titulo}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{o.texto}</span>
              </button>
            ))}
          </fieldset>

          {destino === "assinante" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
              <div className="space-y-1.5">
                <Label>Plano</Label>
                <Select value={planoId} onValueChange={setPlanoId}>
                  <SelectTrigger aria-label="Plano de assinante">
                    <SelectValue placeholder="Escolha o plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {planosDoTipo.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome} · {formatBRL(p.preco_mensal)}/mês
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dv-dias">Dias de teste</Label>
                <Input id="dv-dias" type="number" inputMode="numeric" min={0} max={365} value={dias} onChange={(e) => setDias(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Com 0 dias, a conta fica só para leitura até a pessoa pagar o plano.
              </p>
            </div>
          )}

          <CampoMotivo id="dv-motivo" valor={motivo} aoMudar={setMotivo} exemplo="Ex.: deixou a base do correspondente" />

          <label className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[#000F9F]"
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
            />
            <span>
              Entendi: {vinculado.nome} deixa de ser da nossa base
              {destino === "assinante" ? " e passa a ser cobrado como assinante." : " e perde o acesso ao portal."}
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" className="w-full sm:w-auto" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button variant="destructive" className="w-full sm:w-auto" disabled={!pronto || m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? "Desvinculando…" : "Desvincular"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
