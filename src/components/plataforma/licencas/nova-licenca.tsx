import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2, Gift, Handshake, Hourglass, ShieldCheck, UserRound, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { IconeGestao } from "@/components/plataforma/kit";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL } from "@/lib/financeiro/format";
import { cn } from "@/lib/utils";
import { criarLicenca, type PlanoLicenca, type TipoLicenca } from "@/lib/plataforma/licencas.functions";
import { CamposDesconto, DESCONTO_INICIAL, paraDesconto, type EstadoDesconto } from "./desconto-licenca";
import {
  CamposIndicacao,
  INDICACAO_INICIAL,
  paraIndicacao,
  resumoIndicacao,
  type EstadoIndicacao,
} from "./indicacao-licenca";
import { ROTULO_TIPO } from "./rotulos";

type Modalidade = "cortesia" | "teste" | "pagamento";

const MODALIDADES: { id: Modalidade; titulo: string; texto: string; icone: ReactNode }[] = [
  { id: "cortesia", titulo: "Cortesia", texto: "Liberada sem pagar pelos dias escolhidos.", icone: <Gift /> },
  { id: "teste", titulo: "Teste", texto: "Período de teste; depois a pessoa contrata.", icone: <Hourglass /> },
  { id: "pagamento", titulo: "Pagamento", texto: "A pessoa entra e paga o plano para liberar.", icone: <Wallet /> },
];

const TIPOS: { id: TipoLicenca; icone: ReactNode }[] = [
  { id: "corretor", icone: <UserRound /> },
  { id: "imobiliaria", icone: <Building2 /> },
  { id: "parceiro", icone: <Handshake /> },
];

const SEM_CARTEIRA = "__nenhuma__";

/**
 * "Nova licença": cria a conta de um corretor, imobiliária ou parceiro sem o cadastro do
 * site, em cinco passos numa gaveta (conta, plano e modalidade, desconto, indicação, carteira
 * e motivo) com o resumo do que vai acontecer antes de confirmar. A pessoa recebe o e-mail
 * para criar a própria senha — ninguém escolhe a senha por ela.
 */
export function NovaLicenca({
  aberta,
  aoFechar,
  planos,
  carteiras,
}: {
  aberta: boolean;
  aoFechar: () => void;
  planos: PlanoLicenca[];
  carteiras: { id: string; nome: string }[];
}) {
  const qc = useQueryClient();
  const criarFn = useServerFn(criarLicenca);

  const [tipo, setTipo] = useState<TipoLicenca>("corretor");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [documento, setDocumento] = useState("");
  const [celular, setCelular] = useState("");
  const [creci, setCreci] = useState("");
  const [creciUf, setCreciUf] = useState("");
  const [planoId, setPlanoId] = useState("");
  const [modalidade, setModalidade] = useState<Modalidade>("cortesia");
  const [dias, setDias] = useState("30");
  const [carteira, setCarteira] = useState(SEM_CARTEIRA);
  const [motivo, setMotivo] = useState("");
  const [comDesconto, setComDesconto] = useState(false);
  const [desconto, setDesconto] = useState<EstadoDesconto>(DESCONTO_INICIAL);
  const descontoPronto = comDesconto ? paraDesconto(desconto) : null;
  const [indicacao, setIndicacao] = useState<EstadoIndicacao>(INDICACAO_INICIAL);
  const indicacaoPronta = paraIndicacao(indicacao);

  const planosDoTipo = planos.filter((p) => p.publico === tipo || p.publico === "todos");
  const plano = planosDoTipo.find((p) => p.id === planoId) ?? null;

  function limpar() {
    setNome("");
    setEmail("");
    setDocumento("");
    setCelular("");
    setCreci("");
    setCreciUf("");
    setPlanoId("");
    setModalidade("cortesia");
    setDias("30");
    setCarteira(SEM_CARTEIRA);
    setMotivo("");
    setComDesconto(false);
    setDesconto(DESCONTO_INICIAL);
    setIndicacao(INDICACAO_INICIAL);
  }

  const criar = useMutation({
    mutationFn: () =>
      criarFn({
        data: {
          tipo,
          nome,
          email,
          documento,
          celular,
          creci,
          creciUf,
          planoId,
          modalidade,
          dias: modalidade === "pagamento" ? null : Number(dias),
          carteira: null,
          carteiraGrupo: carteira === SEM_CARTEIRA ? null : carteira,
          motivo,
          desconto: descontoPronto,
          indicacao: indicacaoPronta ?? null,
        },
      }),
    onSuccess: () => {
      toast.success(
        `Licença criada${descontoPronto ? " com desconto" : ""}. ${email} recebeu o e-mail para criar a senha.`,
      );
      qc.invalidateQueries({ queryKey: ["plataforma-licencas"] });
      qc.invalidateQueries({ queryKey: ["plataforma-carteiras"] });
      limpar();
      aoFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível criar a licença.")),
  });

  const diasOk = modalidade === "pagamento" || (Number(dias) >= 1 && Number(dias) <= 365);
  const contaOk = nome.trim().length >= 2 && /\S+@\S+\.\S+/.test(email);
  const pronto =
    contaOk &&
    !!planoId &&
    diasOk &&
    (!comDesconto || descontoPronto !== null) &&
    indicacaoPronta !== undefined &&
    motivo.trim().length >= 5;

  const resumo = [
    `${ROTULO_TIPO[tipo]}${nome.trim() ? ` "${nome.trim()}"` : ""}`,
    plano ? `plano ${plano.nome}` : "sem plano escolhido",
    modalidade === "pagamento" ? "liberada depois do pagamento" : `${modalidade} de ${dias || "?"} dias`,
    descontoPronto ? "com desconto" : null,
    resumoIndicacao(indicacao),
    carteira !== SEM_CARTEIRA ? `na carteira ${carteiras.find((c) => c.id === carteira)?.nome ?? ""}` : "sem carteira",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Sheet open={aberta} onOpenChange={(v) => !v && aoFechar()}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle>Nova licença</SheetTitle>
          <SheetDescription>
            Cria a conta sem o cadastro do site. A pessoa recebe um e-mail para criar a própria senha.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <Passo n={1} titulo="Conta">
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de conta">
              {TIPOS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={tipo === t.id}
                  onClick={() => {
                    setTipo(t.id);
                    setPlanoId("");
                  }}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 text-sm font-medium transition-colors",
                    tipo === t.id
                      ? "border-primary bg-primary/[0.05] text-primary ring-1 ring-primary/30"
                      : "border-border text-muted-foreground hover:bg-secondary/60",
                  )}
                >
                  <span className="[&_svg]:size-4">{t.icone}</span>
                  {ROTULO_TIPO[t.id]}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo id="nl-nome" rotulo={tipo === "corretor" ? "Nome do corretor" : "Nome da empresa"} largo>
                <Input id="nl-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={200} />
              </Campo>
              <Campo id="nl-email" rotulo="E-mail de acesso" largo>
                <Input
                  id="nl-email"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Campo>
              <Campo id="nl-doc" rotulo="CPF ou CNPJ" opcional>
                <Input id="nl-doc" inputMode="numeric" value={documento} onChange={(e) => setDocumento(e.target.value)} />
              </Campo>
              <Campo id="nl-cel" rotulo="Celular" opcional>
                <Input id="nl-cel" inputMode="tel" value={celular} onChange={(e) => setCelular(e.target.value)} />
              </Campo>
              {tipo !== "parceiro" && (
                <div className="grid grid-cols-[1fr_72px] gap-2 sm:col-span-2 sm:max-w-sm">
                  <Campo id="nl-creci" rotulo="CRECI" opcional>
                    <Input id="nl-creci" value={creci} onChange={(e) => setCreci(e.target.value)} />
                  </Campo>
                  <Campo id="nl-uf" rotulo="UF">
                    <Input
                      id="nl-uf"
                      maxLength={2}
                      value={creciUf}
                      onChange={(e) => setCreciUf(e.target.value.toUpperCase())}
                    />
                  </Campo>
                </div>
              )}
            </div>
          </Passo>

          <Passo n={2} titulo="Plano e modalidade">
            <Campo id="nl-plano" rotulo="Plano">
              <Select value={planoId} onValueChange={setPlanoId}>
                <SelectTrigger id="nl-plano" aria-label="Plano">
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
            </Campo>
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Modalidade">
              {MODALIDADES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={modalidade === m.id}
                  onClick={() => setModalidade(m.id)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    modalidade === m.id
                      ? "border-primary bg-primary/[0.05] ring-1 ring-primary/30"
                      : "border-border hover:bg-secondary/60",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <IconeGestao icone={m.icone} tamanho="sm" tom={modalidade === m.id ? "marca" : "neutro"} />
                    {m.titulo}
                  </span>
                  <span className="mt-1.5 block text-xs text-muted-foreground">{m.texto}</span>
                </button>
              ))}
            </div>
            {modalidade !== "pagamento" && (
              <div className="flex items-center gap-2">
                <Label htmlFor="nl-dias" className="shrink-0 text-sm">
                  Dias de {modalidade === "cortesia" ? "cortesia" : "teste"}
                </Label>
                <Input
                  id="nl-dias"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={365}
                  className="w-24"
                  value={dias}
                  onChange={(e) => setDias(e.target.value)}
                />
                {!diasOk && <span className="text-xs text-destructive">De 1 a 365 dias.</span>}
              </div>
            )}
          </Passo>

          <Passo n={3} titulo="Desconto" opcional>
            <div className="flex items-start justify-between gap-3 rounded-xl border border-border p-3">
              <div className="min-w-0">
                <Label htmlFor="nl-com-desconto" className="text-sm font-medium">
                  Conceder desconto
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {modalidade === "pagamento"
                    ? "A fatura de ativação já sai com o desconto."
                    : `Vale nas faturas depois ${modalidade === "cortesia" ? "da cortesia" : "do teste"}.`}
                </p>
              </div>
              <Switch id="nl-com-desconto" checked={comDesconto} onCheckedChange={setComDesconto} />
            </div>
            {comDesconto && <CamposDesconto estado={desconto} aoMudar={setDesconto} prefixo="nl-desc" />}
          </Passo>

          <Passo n={4} titulo="Indicação" opcional>
            <CamposIndicacao estado={indicacao} aoMudar={setIndicacao} prefixo="nl-ind" />
          </Passo>

          <Passo n={5} titulo="Carteira e motivo">
            <Campo id="nl-carteira" rotulo="Carteira">
              <Select value={carteira} onValueChange={setCarteira}>
                <SelectTrigger id="nl-carteira" aria-label="Carteira">
                  <SelectValue placeholder="Escolha a carteira" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_CARTEIRA}>Sem carteira por enquanto</SelectItem>
                  {carteiras.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                O responsável da carteira passa a atender a conta (as propostas novas chegam para ele).
              </p>
            </Campo>
            <Campo id="nl-motivo" rotulo="Motivo">
              <Textarea
                id="nl-motivo"
                rows={2}
                placeholder="Ex.: parceria de lançamento combinada com o Lucca"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Fica no histórico da conta (pelo menos 5 letras).</p>
            </Campo>
          </Passo>
        </div>

        <footer className="space-y-3 border-t border-border bg-card px-5 py-4">
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>{resumo}</span>
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="min-h-11 sm:min-h-9" onClick={aoFechar} disabled={criar.isPending}>
              Cancelar
            </Button>
            <Button className="min-h-11 sm:min-h-9" onClick={() => criar.mutate()} disabled={!pronto || criar.isPending}>
              {criar.isPending ? "Criando…" : "Criar licença"}
            </Button>
          </div>
        </footer>
      </SheetContent>
    </Sheet>
  );
}

function Passo({
  n,
  titulo,
  opcional,
  children,
}: {
  n: number;
  titulo: string;
  opcional?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="grid size-6 place-items-center rounded-full bg-primary/[0.08] text-xs font-medium text-primary ring-1 ring-inset ring-primary/15">
          {n}
        </span>
        {titulo}
        {opcional && <span className="text-xs font-normal text-muted-foreground">(opcional)</span>}
      </h3>
      <div className="space-y-3 pl-0 sm:pl-8">{children}</div>
    </section>
  );
}

function Campo({
  id,
  rotulo,
  opcional,
  largo,
  children,
}: {
  id: string;
  rotulo: string;
  opcional?: boolean;
  largo?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", largo && "sm:col-span-2")}>
      <Label htmlFor={id}>
        {rotulo}
        {opcional && <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>}
      </Label>
      {children}
    </div>
  );
}
