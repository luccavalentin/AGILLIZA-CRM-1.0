import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, UserRoundPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { cn } from "@/lib/utils";
import {
  buscarContasIndicacao,
  definirIndicacaoLicenca,
  type ContaIndicadora,
  type IndicacaoNova,
  type Licenca,
} from "@/lib/plataforma/licencas.functions";
import { ROTULO_TIPO } from "./rotulos";

/*
 * Indicação da licença (0501, pedido do dono de 26/10/2026): as cortesias ficam ligadas a
 * quem indicou — uma conta assinante (corretor, imobiliária ou parceiro) ou, quando quem
 * indicou não é assinante, o nome dele. Usado em "Nova licença" e no bloco Indicação das
 * ações da licença. A cortesia vence e passa a cobrar normalmente; a indicação não muda isso.
 */

export type ModoIndicacao = "nenhuma" | "conta" | "nome";

export interface EstadoIndicacao {
  modo: ModoIndicacao;
  conta: Pick<ContaIndicadora, "id" | "nome"> & Partial<Pick<ContaIndicadora, "tipo">>;
  nome: string;
}

export const INDICACAO_INICIAL: EstadoIndicacao = {
  modo: "nenhuma",
  conta: { id: "", nome: "" },
  nome: "",
};

/** Estado → o que vai para o servidor: `null` sem indicação; `undefined` se incompleta. */
export function paraIndicacao(e: EstadoIndicacao): IndicacaoNova | null | undefined {
  if (e.modo === "nenhuma") return null;
  if (e.modo === "conta") return e.conta.id ? { conta: e.conta.id, nome: null } : undefined;
  const nome = e.nome.trim();
  return nome.length >= 2 ? { conta: null, nome } : undefined;
}

/** Texto curto para o resumo da criação. */
export function resumoIndicacao(e: EstadoIndicacao): string | null {
  const i = paraIndicacao(e);
  if (!i) return null;
  return `indicada por ${i.conta ? e.conta.nome : i.nome}`;
}

function estadoDaLicenca(l: Licenca): EstadoIndicacao {
  if (l.indicado_por)
    return {
      modo: "conta",
      conta: { id: l.indicado_por, nome: l.indicado_por_nome ?? "" },
      nome: "",
    };
  if (l.indicado_por_nome) return { ...INDICACAO_INICIAL, modo: "nome", nome: l.indicado_por_nome };
  return INDICACAO_INICIAL;
}

const MODOS: { id: ModoIndicacao; rotulo: string }[] = [
  { id: "nenhuma", rotulo: "Sem indicação" },
  { id: "conta", rotulo: "Um assinante" },
  { id: "nome", rotulo: "Outra pessoa" },
];

/** Campos: sem indicação, uma conta assinante (com busca) ou o nome de quem indicou. */
export function CamposIndicacao({
  estado,
  aoMudar,
  prefixo,
  conta,
}: {
  estado: EstadoIndicacao;
  aoMudar: (e: EstadoIndicacao) => void;
  prefixo: string;
  /** A própria conta (na gaveta), que não pode indicar a si mesma. */
  conta?: string;
}) {
  const buscarFn = useServerFn(buscarContasIndicacao);
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  // Espera o usuário parar de digitar para buscar (300 ms).
  useEffect(() => {
    const t = setTimeout(() => setTermo(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);
  const q = useQuery({
    queryKey: ["plataforma-indicacao-busca", termo],
    queryFn: () => buscarFn({ data: { busca: termo } }),
    enabled: estado.modo === "conta" && !estado.conta.id && termo.length >= 2,
    staleTime: 30_000,
  });
  const resultados = (q.data ?? []).filter((c) => c.id !== conta);

  return (
    <div className="space-y-3">
      <div
        className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1"
        role="radiogroup"
        aria-label="Quem indicou"
      >
        {MODOS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={estado.modo === m.id}
            onClick={() => aoMudar({ ...estado, modo: m.id })}
            className={cn(
              "min-h-10 rounded-md px-2 text-xs font-medium transition-colors sm:min-h-8 sm:text-[13px]",
              estado.modo === m.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m.rotulo}
          </button>
        ))}
      </div>

      {estado.modo === "conta" &&
        (estado.conta.id ? (
          <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/[0.04] p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <Users className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{estado.conta.nome}</p>
              <p className="text-xs text-muted-foreground">
                {estado.conta.tipo ? `${ROTULO_TIPO[estado.conta.tipo]} · ` : ""}conta que indicou
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-10 shrink-0 sm:min-h-8"
              onClick={() => aoMudar({ ...estado, conta: { id: "", nome: "" } })}
              aria-label="Trocar a conta que indicou"
            >
              <X className="size-4" /> Trocar
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id={`${prefixo}-busca`}
                aria-label="Buscar a conta que indicou"
                placeholder="Nome, endereço ou e-mail da conta"
                className="pl-9"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                autoComplete="off"
              />
            </div>
            {termo.length >= 2 && (
              <div
                className="max-h-56 overflow-y-auto rounded-xl border border-border"
                role="listbox"
                aria-label="Contas encontradas"
              >
                {q.isLoading && (
                  <p className="px-3 py-2.5 text-xs text-muted-foreground">Buscando…</p>
                )}
                {q.error && (
                  <p className="px-3 py-2.5 text-xs text-destructive">
                    {mensagemDeErro(q.error, "Não foi possível buscar.")}
                  </p>
                )}
                {!q.isLoading && !q.error && resultados.length === 0 && (
                  <p className="px-3 py-2.5 text-xs text-muted-foreground">
                    Nenhuma conta com esse nome. Se quem indicou não é assinante, use "Outra
                    pessoa".
                  </p>
                )}
                {resultados.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => {
                      aoMudar({ ...estado, conta: { id: c.id, nome: c.nome, tipo: c.tipo } });
                      setBusca("");
                    }}
                    className="flex min-h-11 w-full items-center gap-2 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-secondary/60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.nome}</span>
                      <span className="block text-xs text-muted-foreground">
                        {ROTULO_TIPO[c.tipo]}
                      </span>
                    </span>
                    {c.indicacoes > 0 && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        {c.indicacoes} {c.indicacoes === 1 ? "indicação" : "indicações"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

      {estado.modo === "nome" && (
        <div className="space-y-1.5">
          <Input
            id={`${prefixo}-nome`}
            aria-label="Nome de quem indicou"
            placeholder="Nome de quem indicou"
            maxLength={200}
            value={estado.nome}
            onChange={(e) => aoMudar({ ...estado, nome: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Para quem indicou e não é assinante do Agilliza Tech.
          </p>
        </div>
      )}
    </div>
  );
}

/** Bloco Indicação nas ações da licença: mostra quem indicou e deixa trocar ou tirar. */
export function IndicacaoDaLicenca({ licenca }: { licenca: Licenca }) {
  const qc = useQueryClient();
  const definirFn = useServerFn(definirIndicacaoLicenca);
  const [estado, setEstado] = useState<EstadoIndicacao>(() => estadoDaLicenca(licenca));
  // Outra conta aberta na gaveta: volta ao que está gravado nela.
  useEffect(() => setEstado(estadoDaLicenca(licenca)), [licenca]);
  const pronta = paraIndicacao(estado);
  const salvar = useMutation({
    mutationFn: () => definirFn({ data: { id: licenca.id, indicacao: pronta ?? null } }),
    onSuccess: () => {
      toast.success(pronta ? "Indicação salva." : "Indicação retirada.");
      qc.invalidateQueries({ queryKey: ["plataforma-licencas"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível salvar a indicação.")),
  });

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm">
        <UserRoundPlus className="size-4 shrink-0 text-primary" />
        {licenca.indicado_por_nome ? (
          <span>
            Indicada por <b className="font-semibold">{licenca.indicado_por_nome}</b>
            {!licenca.indicado_por && (
              <span className="text-muted-foreground"> (não assinante)</span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">Sem indicação registrada.</span>
        )}
      </p>
      <CamposIndicacao estado={estado} aoMudar={setEstado} prefixo="gl-ind" conta={licenca.id} />
      <div className="flex justify-end">
        <Button
          size="sm"
          className="min-h-11 w-full sm:min-h-9 sm:w-auto"
          onClick={() => salvar.mutate()}
          disabled={salvar.isPending || pronta === undefined}
        >
          {salvar.isPending ? "Salvando…" : "Salvar indicação"}
        </Button>
      </div>
    </div>
  );
}
