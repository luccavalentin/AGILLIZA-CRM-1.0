import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileDown, Plus, Receipt } from "lucide-react";
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
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { usePermissao } from "@/hooks/use-permissao";
import { mensagemDeErro } from "@/lib/erros/mensagem";
import { hojeISO } from "@/lib/financeiro/format";
import { formatBRL, maskBRLCents, parseBRL } from "@/lib/simulacao/format";
import { erroDoArquivo } from "@/lib/matriculas/regras";
import {
  excluirCreditoMatricula,
  linkArquivoMatricula,
  registrarRecargaMatricula,
  type MatriculaCredito,
} from "@/lib/matriculas/matriculas.functions";

function data(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Recargas do crédito do cartório/serviço: quem recarregou, quanto e o comprovante. */
export function Creditos({ lista, onMudou }: { lista: MatriculaCredito[]; onMudou: () => void }) {
  const total = useMemo(() => lista.reduce((s, c) => s + Number(c.valor), 0), [lista]);
  const podeEditar = usePermissao("documentos.matriculas", "edit");
  const linkFn = useServerFn(linkArquivoMatricula);
  const excluirFn = useServerFn(excluirCreditoMatricula);
  const [nova, setNova] = useState(false);

  async function abrir(id: string) {
    try {
      const { url } = await linkFn({ data: { id, tipo: "comprovante" } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível abrir o comprovante."));
    }
  }

  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Recargas de crédito</h2>
          <p className="text-xs text-muted-foreground">Total recarregado: {formatBRL(total)}</p>
        </div>
        {podeEditar && (
          <Button size="sm" variant="secondary" onClick={() => setNova(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Registrar recarga
          </Button>
        )}
      </div>
      {lista.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <Receipt className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium text-foreground">Nenhuma recarga registrada</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Registre cada recarga do crédito do cartório (com o comprovante): é dela que sai o custo
            de cada matrícula puxada.
          </p>
        </div>
      ) : (
        <ul className="divide-y">
          {lista.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {c.servico || c.descricao || "Recarga de crédito"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {data(c.data)}
                  {c.recarregado_por_nome && ` · por ${c.recarregado_por_nome}`}
                  {c.servico && c.descricao && ` · ${c.descricao}`}
                </p>
              </div>
              <span className="font-semibold tabular-nums text-foreground">{formatBRL(c.valor)}</span>
              {c.tem_comprovante && (
                <Button size="sm" variant="outline" onClick={() => void abrir(c.id)}>
                  <FileDown className="mr-1 h-3.5 w-3.5" />
                  Comprovante
                </Button>
              )}
              {podeEditar && (
                <ConfirmDelete
                  descricao="Excluir esta recarga? O saldo de crédito diminui."
                  onConfirm={async () => {
                    await excluirFn({ data: { id: c.id } });
                    onMudou();
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <RecargaDialog aberto={nova} aoFechar={() => setNova(false)} onMudou={onMudou} />
    </section>
  );
}

function RecargaDialog({
  aberto,
  aoFechar,
  onMudou,
}: {
  aberto: boolean;
  aoFechar: () => void;
  onMudou: () => void;
}) {
  const registrarFn = useServerFn(registrarRecargaMatricula);
  const [quando, setQuando] = useState(hojeISO());
  const [valor, setValor] = useState("");
  const [servico, setServico] = useState("");
  const [descricao, setDescricao] = useState("");
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const v = parseBRL(valor);
    if (v <= 0) return void toast.error("Informe um valor maior que zero.");
    const fd = new FormData();
    fd.set("data", quando);
    fd.set("valor", String(v));
    fd.set("servico", servico);
    fd.set("descricao", descricao);
    if (comprovante) fd.set("comprovante", comprovante);
    setSalvando(true);
    try {
      await registrarFn({ data: fd });
      toast.success("Recarga registrada.");
      setValor("");
      setServico("");
      setDescricao("");
      setComprovante(null);
      setQuando(hojeISO());
      aoFechar();
      onMudou();
    } catch (e) {
      toast.error(mensagemDeErro(e, "Não foi possível registrar a recarga."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar recarga</DialogTitle>
          <DialogDescription>O valor entra no saldo de crédito usado para puxar as matrículas.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="rc-data">Data</Label>
            <Input id="rc-data" type="date" max={hojeISO()} value={quando} onChange={(e) => setQuando(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rc-valor">Valor</Label>
            <Input
              id="rc-valor"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(maskBRLCents(e.target.value))}
              placeholder="0,00"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="rc-serv">Serviço / cartório</Label>
            <Input
              id="rc-serv"
              value={servico}
              maxLength={120}
              onChange={(e) => setServico(e.target.value)}
              placeholder="Ex.: ONR, e-Cartório, Registradores"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="rc-desc">Observação</Label>
            <Input id="rc-desc" value={descricao} maxLength={500} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="rc-comp">Comprovante (PDF ou imagem)</Label>
            <Input
              id="rc-comp"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                const erro = f ? erroDoArquivo(f) : null;
                if (erro) {
                  toast.error(erro);
                  e.target.value = "";
                  setComprovante(null);
                } else setComprovante(f);
              }}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={salvando}>
            {salvando ? "Salvando…" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
