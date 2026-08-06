import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  listarVendedores,
  salvarVendedor,
  removerVendedor,
} from "@/lib/crm/clientes.functions";
import {
  validarDocumento,
  validarEmail,
  validarTelefone,
} from "@/lib/crm/documento";
import { CardVendedor } from "./vendedores-tab/card-vendedor";
import { DialogVendedor } from "./vendedores-tab/dialog-vendedor";
import { paraForm, VAZIO, type VendedorForm } from "./vendedores-tab/types";

export function VendedoresTab({ clienteId }: { clienteId: string }) {
  const qc = useQueryClient();
  const listar = useServerFn(listarVendedores);
  const salvar = useServerFn(salvarVendedor);
  const remover = useServerFn(removerVendedor);

  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<VendedorForm>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erros, setErros] = useState<Set<string>>(new Set());

  async function buscarCep(cepRaw: string) {
    const cep = cepRaw.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setBuscandoCep(true);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await resp.json();
      if (data.erro) {
        toast.error("CEP não encontrado.");
        return;
      }
      setForm((f) => ({
        ...f,
        logradouro: data.logradouro || f.logradouro,
        bairro: data.bairro || f.bairro,
        cidade: data.localidade || f.cidade,
        uf: data.uf || f.uf,
      }));
    } catch {
      toast.error("Não foi possível consultar o CEP.");
    } finally {
      setBuscandoCep(false);
    }
  }

  const { data: vendedores, isLoading } = useQuery({
    queryKey: ["cliente-vendedores", clienteId],
    queryFn: () => listar({ data: { cliente_id: clienteId } }),
  });

  function novo() {
    setForm(VAZIO);
    setErros(new Set());
    setAberto(true);
  }
  function editar(v: any) {
    setForm(paraForm(v));
    setErros(new Set());
    setAberto(true);
  }

  async function submeter() {
    const e = new Set<string>();
    if (!form.nome.trim()) e.add("nome");
    if (form.documento && !validarDocumento(form.documento, form.tipo_pessoa))
      e.add("documento");
    if (form.email && !validarEmail(form.email)) e.add("email");
    if (form.telefone_celular && !validarTelefone(form.telefone_celular))
      e.add("telefone_celular");
    setErros(e);
    if (e.size > 0) {
      const primeiro = e.has("nome")
        ? "Informe o nome do vendedor."
        : e.has("documento")
          ? `${form.tipo_pessoa === "PJ" ? "CNPJ" : "CPF"} inválido.`
          : e.has("email")
            ? "E-mail inválido."
            : "Telefone inválido.";
      toast.error(primeiro);
      return;
    }
    setSalvando(true);
    try {
      await salvar({ data: { ...form, cliente_id: clienteId } as any });
      toast.success("Vendedor salvo.");
      setAberto(false);
      qc.invalidateQueries({ queryKey: ["cliente-vendedores", clienteId] });
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível salvar o vendedor.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id: string) {
    try {
      await remover({ data: { id } });
      toast.success("Vendedor removido.");
      qc.invalidateQueries({ queryKey: ["cliente-vendedores", clienteId] });
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível remover.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Cadastre os vendedores do imóvel.
        </p>
        <Button size="sm" onClick={novo}>
          <Plus className="mr-1 size-4" /> Adicionar vendedor
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (vendedores?.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          Nenhum vendedor cadastrado para este imóvel.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {vendedores!.map((v: any) => (
            <CardVendedor key={v.id} v={v} onEditar={editar} onExcluir={excluir} />
          ))}
        </div>
      )}

      <DialogVendedor
        aberto={aberto}
        onOpenChange={setAberto}
        form={form}
        setForm={setForm}
        erros={erros}
        buscandoCep={buscandoCep}
        buscarCep={buscarCep}
        salvando={salvando}
        onSubmeter={submeter}
      />
    </div>
  );
}
