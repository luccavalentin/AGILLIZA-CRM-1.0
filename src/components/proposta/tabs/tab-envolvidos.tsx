import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToneBadge } from "@/components/crm/tone-badge";
import {
  ParticipanteDialog,
  envolvidoParaForm,
  participanteCompleto,
  type ParticipanteForm,
} from "@/components/proposta/participante-form";
import {
  adicionarEnvolvido,
  atualizarEnvolvido,
  removerEnvolvido,
  obterConjugeCliente,
} from "@/lib/propostas/propostas.functions";

export function TabEnvolvidos({
  tipo,
  propostaId,
  envolvidos,
  autoAbrir,
  onAutoAbriu,
  onFechouAposSalvar,
  idBanco,
}: {
  tipo: "CO" | "VD";
  propostaId: string;
  envolvidos: any[];
  autoAbrir?: boolean;
  onAutoAbriu?: () => void;
  onFechouAposSalvar?: () => void;
  idBanco?: number;
}) {

  const qc = useQueryClient();
  const addFn = useServerFn(adicionarEnvolvido);
  const updFn = useServerFn(atualizarEnvolvido);
  const delFn = useServerFn(removerEnvolvido);
  const conjClienteFn = useServerFn(obterConjugeCliente);
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [inicial, setInicial] = useState<ParticipanteForm | undefined>(undefined);
  const [conjugeInicial, setConjugeInicial] = useState<ParticipanteForm | undefined>(undefined);
  const [conjugeId, setConjugeId] = useState<string | null>(null);

  // Compradores: mostra CO e TI, mas oculta o cônjuge já vinculado a um titular
  // (ele é editado dentro do formulário do titular).
  const lista = envolvidos.filter((e) =>
    tipo === "CO"
      ? (e.tipo_qualificacao === "CO" || e.tipo_qualificacao === "TI") && !e.conjuge_de
      : e.tipo_qualificacao === tipo,
  );

  const completo = participanteCompleto;

  function novo() {
    setEditId(null);
    setInicial(undefined);
    setConjugeInicial(undefined);
    setConjugeId(null);
    setOpen(true);
  }

  async function editar(e: any) {
    setEditId(e.id);
    setInicial(envolvidoParaForm(e));
    const conj = envolvidos.find((x) => x.conjuge_de === e.id);
    setConjugeInicial(conj ? envolvidoParaForm(conj) : undefined);
    setConjugeId(conj?.id ?? null);
    setOpen(true);
    if (!conj && e.cliente_id) {
      try {
        const dadosConj = await conjClienteFn({ data: { cliente_id: e.cliente_id } });
        if (dadosConj) setConjugeInicial(envolvidoParaForm(dadosConj));
      } catch {
        /* ignora: mantém o bloco do cônjuge vazio */
      }
    }
  }

  // Abre automaticamente o formulário do comprador principal ao criar a proposta.
  useEffect(() => {
    if (!autoAbrir || tipo !== "CO") return;
    const principal =
      lista.find((e) => e.tipo_qualificacao === "CO") ?? lista[0] ?? null;
    if (principal) {
      editar(principal);
    } else {
      novo();
    }
    onAutoAbriu?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAbrir]);

  async function salvar(principal: any, conjuge: any) {
    setSalvando(true);
    try {
      let titularId = editId;
      if (editId) {
        await updFn({ data: { id: editId, dados: principal } });
      } else {
        const r = await addFn({
          data: {
            proposta_id: propostaId,
            dados: { ...principal, tipo_qualificacao: principal.tipo_qualificacao ?? tipo },
          },
        });
        titularId = r.id;
      }

      if (conjuge && titularId) {
        const dadosConj = { ...conjuge, tipo_qualificacao: "TI", conjuge_de: titularId };
        if (conjugeId) {
          await updFn({ data: { id: conjugeId, dados: dadosConj } });
        } else {
          await addFn({ data: { proposta_id: propostaId, dados: dadosConj } });
        }
      } else if (!conjuge && conjugeId) {
        await delFn({ data: { id: conjugeId } });
      }

      toast.success(editId ? "Participante atualizado." : "Participante incluído.");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
      onFechouAposSalvar?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: string) {
    try {
      await delFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["proposta", propostaId] });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Falha ao remover participante.",
      );
    }
  }

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-sm font-medium text-muted-foreground">
          {tipo === "CO" ? "Compradores" : "Vendedores"}
        </span>
        <Button size="sm" onClick={novo}>
          <Plus className="mr-1 h-4 w-4" /> Incluir pessoa
        </Button>
      </div>

      <ParticipanteDialog
        open={open}
        onOpenChange={setOpen}
        titulo={
          editId
            ? "Editar participante"
            : `Incluir ${tipo === "CO" ? "comprador" : "vendedor"}`
        }
        inicial={inicial}
        conjugeInicial={conjugeInicial}
        tipoQualificacaoFixo={tipo === "VD" ? "VD" : undefined}
        salvando={salvando}
        onSalvar={salvar}
        idBanco={idBanco}
      />


      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>CPF/CNPJ</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Celular</TableHead>
            <TableHead>Dados</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lista.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                Nenhum {tipo === "CO" ? "comprador" : "vendedor"} cadastrado
              </TableCell>
            </TableRow>
          )}
          {lista.map((e) => (
            <TableRow
              key={e.id}
              className="cursor-pointer"
              onClick={() => editar(e)}
            >
              <TableCell>{e.cpf_cnpj ?? "—"}</TableCell>
              <TableCell className="font-medium">{e.nome}</TableCell>
              <TableCell>{e.email ?? "—"}</TableCell>
              <TableCell>{e.celular ?? "—"}</TableCell>
              <TableCell>
                <ToneBadge tone={completo(e) ? "success" : "warning"}>
                  {completo(e) ? "Completo" : "Incompleto"}
                </ToneBadge>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    remover(e.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
