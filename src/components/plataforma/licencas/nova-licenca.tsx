import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL } from "@/lib/financeiro/format";
import {
  criarLicenca,
  pessoasParaCarteira,
  type PlanoLicenca,
  type TipoLicenca,
} from "@/lib/plataforma/licencas.functions";
import {
  CamposDesconto,
  DESCONTO_INICIAL,
  paraDesconto,
  type EstadoDesconto,
} from "./desconto-licenca";

type Modalidade = "cortesia" | "teste" | "pagamento";

const MODALIDADES: { id: Modalidade; titulo: string; texto: string }[] = [
  { id: "cortesia", titulo: "Cortesia", texto: "Liberada sem pagar pelos dias que você escolher." },
  { id: "teste", titulo: "Teste", texto: "Período de teste; depois a pessoa contrata." },
  { id: "pagamento", titulo: "Pagamento", texto: "A pessoa entra e paga o plano para liberar." },
];

const SEM_CARTEIRA = "__nenhuma__";

/**
 * "Nova licença": cria a conta de um corretor, imobiliária ou parceiro sem o cadastro do
 * site, com a modalidade (cortesia, teste ou pagamento) e a carteira de quem cuida dela.
 * A pessoa recebe o e-mail para criar a própria senha — ninguém escolhe a senha por ela.
 */
export function NovaLicenca({
  aberta,
  aoFechar,
  planos,
}: {
  aberta: boolean;
  aoFechar: () => void;
  planos: PlanoLicenca[];
}) {
  const qc = useQueryClient();
  const criarFn = useServerFn(criarLicenca);
  const pessoasFn = useServerFn(pessoasParaCarteira);
  const pessoas = useQuery({
    queryKey: ["plataforma-pessoas-carteira"],
    queryFn: () => pessoasFn(),
    enabled: aberta,
    staleTime: 60_000,
  });

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

  const planosDoTipo = planos.filter((p) => p.publico === tipo || p.publico === "todos");

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
          carteira: carteira === SEM_CARTEIRA ? null : carteira,
          motivo,
          desconto: descontoPronto,
        },
      }),
    onSuccess: () => {
      toast.success(
        `Licença criada${descontoPronto ? " com desconto" : ""}. ${email} recebeu o e-mail para criar a senha.`,
      );
      qc.invalidateQueries({ queryKey: ["plataforma-licencas"] });
      limpar();
      aoFechar();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível criar a licença.")),
  });

  const diasOk = modalidade === "pagamento" || (Number(dias) >= 1 && Number(dias) <= 365);
  const pronto =
    nome.trim().length >= 2 &&
    /\S+@\S+\.\S+/.test(email) &&
    planoId &&
    diasOk &&
    (!comDesconto || descontoPronto !== null) &&
    motivo.trim().length >= 5;

  return (
    <Dialog open={aberta} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nova licença</DialogTitle>
          <DialogDescription>
            Cria a conta sem o cadastro do site. A pessoa recebe um e-mail para criar a própria
            senha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            className="grid grid-cols-3 gap-1.5 rounded-lg bg-muted p-1"
            role="radiogroup"
            aria-label="Tipo de conta"
          >
            {(["corretor", "imobiliaria", "parceiro"] as TipoLicenca[]).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={tipo === t}
                onClick={() => {
                  setTipo(t);
                  setPlanoId("");
                }}
                className={
                  "min-h-10 rounded-md px-2 text-sm font-medium transition-colors " +
                  (tipo === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")
                }
              >
                {t === "corretor" ? "Corretor" : t === "imobiliaria" ? "Imobiliária" : "Parceiro"}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="nl-nome">
                {tipo === "corretor" ? "Nome do corretor" : "Nome da empresa"}
              </Label>
              <Input
                id="nl-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="nl-email">E-mail de acesso</Label>
              <Input
                id="nl-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nl-doc">CPF ou CNPJ (opcional)</Label>
              <Input
                id="nl-doc"
                inputMode="numeric"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nl-cel">Celular (opcional)</Label>
              <Input
                id="nl-cel"
                inputMode="tel"
                value={celular}
                onChange={(e) => setCelular(e.target.value)}
              />
            </div>
            {tipo !== "parceiro" && (
              <div className="grid grid-cols-[1fr_80px] gap-2 sm:col-span-2">
                <div className="space-y-1.5">
                  <Label htmlFor="nl-creci">CRECI (opcional)</Label>
                  <Input id="nl-creci" value={creci} onChange={(e) => setCreci(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nl-uf">UF</Label>
                  <Input
                    id="nl-uf"
                    maxLength={2}
                    value={creciUf}
                    onChange={(e) => setCreciUf(e.target.value.toUpperCase())}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Plano</Label>
            <Select value={planoId} onValueChange={setPlanoId}>
              <SelectTrigger aria-label="Plano">
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

          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-sm font-medium">Modalidade</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {MODALIDADES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={modalidade === m.id}
                  onClick={() => setModalidade(m.id)}
                  className={
                    "rounded-lg border p-3 text-left transition-colors " +
                    (modalidade === m.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:bg-muted/50")
                  }
                >
                  <span className="block text-sm font-semibold">{m.titulo}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{m.texto}</span>
                </button>
              ))}
            </div>
            {modalidade !== "pagamento" && (
              <div className="flex items-center gap-2">
                <Label htmlFor="nl-dias" className="shrink-0">
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
              </div>
            )}
          </fieldset>

          <section className="rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-3">
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
            {comDesconto && (
              <div className="mt-3 border-t border-border pt-3">
                <CamposDesconto estado={desconto} aoMudar={setDesconto} prefixo="nl-desc" />
              </div>
            )}
          </section>

          <div className="space-y-1.5">
            <Label>Carteira de</Label>
            <Select value={carteira} onValueChange={setCarteira}>
              <SelectTrigger aria-label="Carteira de">
                <SelectValue placeholder="Escolha quem cuida da conta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_CARTEIRA}>Sem carteira por enquanto</SelectItem>
                {(pessoas.data ?? []).map((p) => (
                  <SelectItem key={p.auth_uid} value={p.auth_uid}>
                    {p.nome}
                    {p.contas ? ` · ${p.contas} conta(s)` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              As propostas novas desta conta já chegam para essa pessoa.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nl-motivo">Motivo</Label>
            <Textarea
              id="nl-motivo"
              rows={2}
              placeholder="Ex.: parceria de lançamento combinada com o Lucca"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={aoFechar}
            disabled={criar.isPending}
          >
            Cancelar
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={() => criar.mutate()}
            disabled={!pronto || criar.isPending}
          >
            {criar.isPending ? "Criando…" : "Criar licença"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
