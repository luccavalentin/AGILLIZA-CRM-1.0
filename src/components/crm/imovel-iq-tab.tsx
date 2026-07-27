import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MatriculaTab } from "./imovel-matricula-tab";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { salvarImovelIq } from "@/lib/crm/clientes.functions";
import {
  TIPOS_IMOVEL,
  USOS_IMOVEL,
  SITUACOES_IMOVEL,
} from "@/lib/simulacao/schemas";
import { mascararCep, cepValido, consultarCep } from "@/lib/cep";

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
];

type Cliente = Record<string, any>;

export function ImovelTab({ clienteId, cliente }: { clienteId: string; cliente: Cliente }) {
  const qc = useQueryClient();
  const salvar = useServerFn(salvarImovelIq);
  const [salvando, setSalvando] = useState(false);
  const [f, setF] = useState({
    imovel_tipo: cliente.imovel_tipo ?? "",
    imovel_uso: cliente.imovel_uso ?? "",
    imovel_situacao: cliente.imovel_situacao ?? "",
    imovel_valor: cliente.imovel_valor != null ? String(cliente.imovel_valor) : "",
    imovel_cep: cliente.imovel_cep ?? "",
    imovel_logradouro: cliente.imovel_logradouro ?? "",
    imovel_numero: cliente.imovel_numero ?? "",
    imovel_complemento: cliente.imovel_complemento ?? "",
    imovel_bairro: cliente.imovel_bairro ?? "",
    imovel_cidade: cliente.imovel_cidade ?? "",
    imovel_uf: cliente.imovel_uf ?? "",
  });

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((p) => ({ ...p, [k]: v }));
  }

  const [buscandoCep, setBuscandoCep] = useState(false);

  async function buscarCepImovel(cepRaw: string) {
    if (!cepValido(cepRaw)) return;
    setBuscandoCep(true);
    try {
      const end = await consultarCep(cepRaw);
      if (!end) {
        toast.error("CEP não encontrado.");
        return;
      }
      setF((p) => ({
        ...p,
        imovel_logradouro: end.logradouro || p.imovel_logradouro,
        imovel_bairro: end.bairro || p.imovel_bairro,
        imovel_cidade: end.cidade || p.imovel_cidade,
        imovel_uf: end.uf || p.imovel_uf,
      }));
    } catch {
      toast.error("Não foi possível consultar o CEP.");
    } finally {
      setBuscandoCep(false);
    }
  }


  async function onSalvar() {
    setSalvando(true);
    try {
      await salvar({
        data: {
          cliente_id: clienteId,
          imovel_tipo: f.imovel_tipo || null,
          imovel_uso: f.imovel_uso || null,
          imovel_situacao: f.imovel_situacao || null,
          imovel_valor: f.imovel_valor ? Number(f.imovel_valor) : null,
          imovel_cep: f.imovel_cep || null,
          imovel_logradouro: f.imovel_logradouro || null,
          imovel_numero: f.imovel_numero || null,
          imovel_complemento: f.imovel_complemento || null,
          imovel_bairro: f.imovel_bairro || null,
          imovel_cidade: f.imovel_cidade || null,
          imovel_uf: f.imovel_uf || null,
        },
      });
      toast.success("Dados do imóvel salvos.");
      qc.invalidateQueries({ queryKey: ["cliente", clienteId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Dados do imóvel
      </p>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <div>
          <Label>Tipo do imóvel</Label>
          <Select value={f.imovel_tipo} onValueChange={(v) => set("imovel_tipo", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_IMOVEL.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Uso do imóvel</Label>
          <Select value={f.imovel_uso} onValueChange={(v) => set("imovel_uso", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {USOS_IMOVEL.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Situação do imóvel</Label>
          <Select value={f.imovel_situacao} onValueChange={(v) => set("imovel_situacao", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {SITUACOES_IMOVEL.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Valor do imóvel (R$)</Label>
          <Input
            type="number"
            inputMode="decimal"
            value={f.imovel_valor}
            onChange={(e) => set("imovel_valor", e.target.value)}
          />
        </div>
        <div>
          <Label>CEP</Label>
          <div className="relative">
            <Input
              value={f.imovel_cep}
              inputMode="numeric"
              placeholder="00000-000"
              onChange={(e) => {
                const m = mascararCep(e.target.value);
                set("imovel_cep", m);
                if (cepValido(m)) buscarCepImovel(m);
              }}
              onBlur={(e) => buscarCepImovel(e.target.value)}
            />
            {buscandoCep && (
              <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
        <div>
          <Label>UF</Label>
          <Select value={f.imovel_uf} onValueChange={(v) => set("imovel_uf", v)}>
            <SelectTrigger>
              <SelectValue placeholder="UF" />
            </SelectTrigger>
            <SelectContent>
              {UFS.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Logradouro</Label>
          <Input
            value={f.imovel_logradouro}
            onChange={(e) => set("imovel_logradouro", e.target.value)}
          />
        </div>
        <div>
          <Label>Número</Label>
          <Input value={f.imovel_numero} onChange={(e) => set("imovel_numero", e.target.value)} />
        </div>
        <div>
          <Label>Complemento</Label>
          <Input
            value={f.imovel_complemento}
            onChange={(e) => set("imovel_complemento", e.target.value)}
          />
        </div>
        <div>
          <Label>Bairro</Label>
          <Input value={f.imovel_bairro} onChange={(e) => set("imovel_bairro", e.target.value)} />
        </div>
        <div>
          <Label>Cidade</Label>
          <Input value={f.imovel_cidade} onChange={(e) => set("imovel_cidade", e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={onSalvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar imóvel"}
        </Button>
      </div>
    </div>
  );
}

export function IqTab({ clienteId, cliente }: { clienteId: string; cliente: Cliente }) {
  const qc = useQueryClient();
  const salvar = useServerFn(salvarImovelIq);
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState(cliente.iq_nome ?? "");
  const [comentario, setComentario] = useState(cliente.iq_comentario ?? "");

  async function onSalvar() {
    setSalvando(true);
    try {
      await salvar({
        data: { cliente_id: clienteId, iq_nome: nome || null, iq_comentario: comentario || null },
      });
      toast.success("Dados do interveniente salvos.");
      qc.invalidateQueries({ queryKey: ["cliente", clienteId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Interveniente quitante (IQ)
      </p>
      <div>
        <Label>Nome</Label>
        <Input value={nome} onChange={(e) => setNome(e.target.value)} />
      </div>
      <div>
        <Label>Comentário sobre o processo</Label>
        <Textarea
          value={comentario}
          maxLength={2000}
          rows={5}
          onChange={(e) => setComentario(e.target.value)}
        />
        <p className="mt-1 text-right text-xs text-muted-foreground">{comentario.length}/2000</p>
      </div>
      <div className="flex justify-end">
        <Button onClick={onSalvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar IQ"}
        </Button>
      </div>
    </div>
  );
}
