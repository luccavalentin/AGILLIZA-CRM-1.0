/**
 * Aba "Pacotes e preços": os espaços de banner (início, busca, imóvel) com todos os pacotes,
 * à venda ou não. O valor por mês e a economia sobre o mensal vêm da vitrine do banco (a
 * mesma conta que o comprador vê) e só existem para pacote à venda. Editar preço, dias e pôr
 * à venda exige "Planos, preços e créditos" (saas.planos → planos.editar no banco). Compra já
 * feita guarda o preço da época.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Package, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { formatBRL } from "@/lib/financeiro/format";
import {
  lerPacotes,
  salvarEspaco,
  salvarPacote,
  type EspacoBanner,
  type PacoteBanner,
  type PeriodoPacote,
} from "@/lib/plataforma/patrocinados.functions";
import { CHAVE_BANNERS, ROTULO_PERIODO } from "./banners-comum";
import { Carregando, Vazio } from "./comum";

const PERIODOS: PeriodoPacote[] = ["semana", "mes", "trimestre", "semestre", "ano"];
const DIAS_PADRAO: Record<PeriodoPacote, number> = {
  semana: 7,
  mes: 30,
  trimestre: 90,
  semestre: 180,
  ano: 365,
};

const numero = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));
const pct = (v: number | null) =>
  v == null ? "—" : `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export function AbaPacotes() {
  const lerFn = useServerFn(lerPacotes);
  const podeEditar = usePermissao("saas.planos", "edit");
  const q = useQuery({
    queryKey: [...CHAVE_BANNERS, "pacotes"],
    queryFn: () => lerFn(),
    staleTime: 30_000,
  });
  if (q.isLoading) return <Carregando />;
  if (q.isError)
    return (
      <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
        {mensagemDeErro(q.error, "Não foi possível ler os pacotes.")}
      </p>
    );
  const espacos = q.data ?? [];
  if (espacos.length === 0)
    return (
      <Vazio
        icone={<Package className="size-5" aria-hidden />}
        titulo="Nenhum espaço de banner"
        texto="Os espaços (início, busca e página do imóvel) vêm da tabela de pacotes do banco."
      />
    );
  return (
    <div className="space-y-4">
      {!podeEditar && (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          Você pode ver os preços. Para mudar preço, dias ou pôr à venda, é preciso a permissão
          “Planos, preços e créditos” (editar).
        </p>
      )}
      {espacos.map((e) => (
        <Espaco key={e.chave} e={e} podeEditar={podeEditar} />
      ))}
    </div>
  );
}

function Espaco({ e, podeEditar }: { e: EspacoBanner; podeEditar: boolean }) {
  const qc = useQueryClient();
  const espacoFn = useServerFn(salvarEspaco);
  const [novo, setNovo] = useState(false);
  const ligar = useMutation({
    mutationFn: (ativo: boolean) => espacoFn({ data: { chave: e.chave, dados: { ativo } } }),
    onSuccess: (_, ativo) => {
      toast.success(ativo ? `Espaço “${e.nome}” ligado.` : `Espaço “${e.nome}” desligado.`);
      qc.invalidateQueries({ queryKey: CHAVE_BANNERS });
    },
    onError: (err) => toast.error(mensagemDeErro(err, "Não foi possível mudar o espaço.")),
  });
  return (
    <section className="min-w-0 rounded-xl border border-border bg-card">
      <header className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-start sm:justify-between sm:p-4">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
            {e.nome}
            {!e.ativo && <Badge variant="secondary">Desligado</Badge>}
          </h3>
          {e.descricao && <p className="text-xs text-muted-foreground">{e.descricao}</p>}
          <p className="text-[11px] tabular-nums text-muted-foreground">
            Imagem a partir de {e.largura_min}×{e.altura_min} px · até {e.peso_max_kb} KB
          </p>
        </div>
        {podeEditar && (
          <label className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
            <Switch
              checked={e.ativo}
              disabled={ligar.isPending}
              onCheckedChange={(v) => ligar.mutate(v)}
              aria-label={`Espaço ${e.nome} ligado`}
            />
            Espaço ligado
          </label>
        )}
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium sm:px-4">Pacote</th>
              <th className="px-3 py-2 text-right font-medium">Dias</th>
              <th className="px-3 py-2 text-right font-medium">Preço</th>
              <th className="px-3 py-2 text-right font-medium">Por mês</th>
              <th className="px-3 py-2 text-right font-medium">Economia</th>
              <th className="px-3 py-2 font-medium">À venda</th>
              <th className="px-3 py-2 sm:px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {e.pacotes.map((p) => (
              <LinhaPacote key={p.id} p={p} podeEditar={podeEditar} />
            ))}
            {e.pacotes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Nenhum pacote neste espaço.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {podeEditar && (
        <div className="border-t border-border p-3 sm:p-4">
          {novo ? (
            <NovoPacote espaco={e.chave} onFeito={() => setNovo(false)} />
          ) : (
            <Button variant="outline" size="sm" onClick={() => setNovo(true)}>
              <Plus className="mr-2 size-4" /> Novo pacote
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function LinhaPacote({ p, podeEditar }: { p: PacoteBanner; podeEditar: boolean }) {
  const qc = useQueryClient();
  const fn = useServerFn(salvarPacote);
  const [editando, setEditando] = useState(false);
  const [preco, setPreco] = useState(String(p.preco).replace(".", ","));
  const [dias, setDias] = useState(String(p.dias));
  const salvar = useMutation({
    mutationFn: (dados: { preco?: number; dias?: number; a_venda?: boolean }) =>
      fn({ data: { id: p.id, dados } }),
    onSuccess: (_, dados) => {
      toast.success(
        dados.a_venda === true
          ? `${p.nome} à venda.`
          : dados.a_venda === false
            ? `${p.nome} fora de venda.`
            : "Pacote salvo. Compras já feitas guardam o preço da época.",
      );
      setEditando(false);
      qc.invalidateQueries({ queryKey: CHAVE_BANNERS });
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível salvar o pacote.")),
  });
  const precoN = numero(preco);
  const diasN = Number(dias);
  const valido =
    Number.isFinite(precoN) && precoN > 0 && Number.isInteger(diasN) && diasN >= 1 && diasN <= 366;

  return (
    <tr className="align-middle">
      <td className="px-3 py-2 sm:px-4">
        <span className="font-medium">{p.nome}</span>
        {p.nome !== (ROTULO_PERIODO[p.periodo] ?? p.periodo) && (
          <span className="block text-[11px] text-muted-foreground">
            {ROTULO_PERIODO[p.periodo] ?? p.periodo}
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {editando ? (
          <Input
            value={dias}
            onChange={(e) => setDias(e.target.value.replace(/\D/g, "").slice(0, 3))}
            inputMode="numeric"
            aria-label="Dias"
            className="ml-auto h-9 w-20 text-right text-base sm:text-sm"
          />
        ) : (
          p.dias
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {editando ? (
          <Input
            value={preco}
            onChange={(e) => setPreco(e.target.value.replace(/[^\d.,]/g, ""))}
            inputMode="decimal"
            aria-label="Preço"
            className="ml-auto h-9 w-28 text-right text-base sm:text-sm"
          />
        ) : (
          formatBRL(Number(p.preco))
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
        {p.por_mes != null && p.dias >= 28 ? formatBRL(Number(p.por_mes)) : "—"}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {p.economia_pct != null ? (
          <span className="text-emerald-700 dark:text-emerald-400">{pct(p.economia_pct)}</span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2">
        {podeEditar ? (
          <Switch
            checked={p.a_venda}
            disabled={salvar.isPending}
            onCheckedChange={(v) => salvar.mutate({ a_venda: v })}
            aria-label={`${p.nome} à venda`}
          />
        ) : (
          <Badge variant={p.a_venda ? "success" : "secondary"}>
            {p.a_venda ? "À venda" : "Fora"}
          </Badge>
        )}
      </td>
      <td className="px-3 py-2 text-right sm:px-4">
        {podeEditar &&
          (editando ? (
            <span className="inline-flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setEditando(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!valido || salvar.isPending}
                onClick={() => salvar.mutate({ preco: precoN, dias: diasN })}
              >
                {salvar.isPending && <Loader2 className="mr-1 size-4 animate-spin" />}
                Salvar
              </Button>
            </span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditando(true)}
              aria-label={`Editar ${p.nome}`}
            >
              <Pencil className="size-4" />
            </Button>
          ))}
      </td>
    </tr>
  );
}

function NovoPacote({ espaco, onFeito }: { espaco: string; onFeito: () => void }) {
  const qc = useQueryClient();
  const fn = useServerFn(salvarPacote);
  const [periodo, setPeriodo] = useState<PeriodoPacote>("mes");
  const [dias, setDias] = useState("30");
  const [preco, setPreco] = useState("");
  const precoN = numero(preco);
  const diasN = Number(dias);
  const valido =
    Number.isFinite(precoN) && precoN > 0 && Number.isInteger(diasN) && diasN >= 1 && diasN <= 366;
  const m = useMutation({
    mutationFn: () =>
      fn({
        data: {
          id: null,
          dados: {
            espaco,
            periodo,
            dias: diasN,
            preco: precoN,
            nome: ROTULO_PERIODO[periodo],
            a_venda: false,
          },
        },
      }),
    onSuccess: () => {
      toast.success(
        "Pacote criado fora de venda. Ligue “À venda” quando o preço estiver aprovado.",
      );
      qc.invalidateQueries({ queryKey: CHAVE_BANNERS });
      onFeito();
    },
    onError: (e) => toast.error(mensagemDeErro(e, "Não foi possível criar o pacote.")),
  });
  return (
    <div className="grid gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] sm:items-end">
      <div className="space-y-1">
        <Label>Período</Label>
        <Select
          value={periodo}
          onValueChange={(v) => {
            setPeriodo(v as PeriodoPacote);
            setDias(String(DIAS_PADRAO[v as PeriodoPacote]));
          }}
        >
          <SelectTrigger aria-label="Período do pacote">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODOS.map((x) => (
              <SelectItem key={x} value={x}>
                {ROTULO_PERIODO[x]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`np-dias-${espaco}`}>Dias</Label>
        <Input
          id={`np-dias-${espaco}`}
          value={dias}
          onChange={(e) => setDias(e.target.value.replace(/\D/g, "").slice(0, 3))}
          inputMode="numeric"
          className="text-base sm:text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`np-preco-${espaco}`}>Preço (R$)</Label>
        <Input
          id={`np-preco-${espaco}`}
          value={preco}
          onChange={(e) => setPreco(e.target.value.replace(/[^\d.,]/g, ""))}
          inputMode="decimal"
          placeholder="1.500,00"
          className="text-base sm:text-sm"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onFeito}>
          Cancelar
        </Button>
        <Button disabled={!valido || m.isPending} onClick={() => m.mutate()}>
          {m.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Criar
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground sm:col-span-4">
        Nasce fora de venda. O valor por mês e a economia aparecem quando o pacote estiver à venda.
      </p>
    </div>
  );
}
