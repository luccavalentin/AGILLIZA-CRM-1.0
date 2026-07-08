import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Upload, Loader2, CircleDashed, Trash2, Plus, Pencil, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { supabase } from "@/integrations/supabase/client";
import {
  getChecklistDados,
  salvarChecklist,
  listarDocumentos,
  anexarDocumento,
} from "@/lib/crm/clientes.functions";
import { TIPOS_DOCUMENTO_POR_CATEGORIA } from "@/lib/crm/documento-tipos";

const T = TIPOS_DOCUMENTO_POR_CATEGORIA;

type Categoria = "comprador" | "conjuge" | "vendedor" | "vendedor_conjuge" | "imovel" | "outros";

const filled = (v: unknown) => typeof v === "string" && v.trim().length > 0;

function AutoItem({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1.5 text-sm">
      {ok ? (
        <Check className="size-4 shrink-0 text-success" />
      ) : (
        <CircleDashed className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      {!ok && <span className="text-xs text-muted-foreground">(preencher no cadastro)</span>}
    </div>
  );
}

function AdicionarItem({ onAdd }: { onAdd: (label: string) => void }) {
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);
  function confirmar() {
    const v = texto.trim();
    if (!v) return;
    onAdd(v);
    setTexto("");
    setAberto(false);
  }
  if (!aberto) {
    return (
      <div className="pt-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setAberto(true)}>
          <Plus className="size-4" /> Adicionar item
        </Button>
      </div>
    );
  }
  return (
    <div className="mt-2 flex items-center gap-2">
      <Input
        autoFocus
        value={texto}
        placeholder="Novo item do checklist…"
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            confirmar();
          } else if (e.key === "Escape") {
            setAberto(false);
            setTexto("");
          }
        }}
        className="h-9"
      />
      <Button type="button" size="sm" onClick={confirmar}>
        <Plus className="size-4" /> Incluir
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => {
          setAberto(false);
          setTexto("");
        }}
      >
        Cancelar
      </Button>
    </div>
  );
}

export function DocumentosChecklist({ clienteId }: { clienteId: string }) {
  const qc = useQueryClient();
  const getDados = useServerFn(getChecklistDados);
  const salvar = useServerFn(salvarChecklist);
  const listar = useServerFn(listarDocumentos);
  const anexar = useServerFn(anexarDocumento);

  const [check, setCheck] = useState<Record<string, any>>({});
  const [fgts, setFgts] = useState(false);
  const [subindo, setSubindo] = useState<string | null>(null);
  const carregou = useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ["cliente-checklist", clienteId],
    queryFn: () => getDados({ data: { cliente_id: clienteId } }),
  });
  const { data: docs } = useQuery({
    queryKey: ["cliente-docs", clienteId],
    queryFn: () => listar({ data: { cliente_id: clienteId } }),
  });

  useEffect(() => {
    if (data && !carregou.current) {
      setCheck((data.cliente?.documentos_checklist as Record<string, any>) ?? {});
      setFgts(Boolean(data.cliente?.utiliza_fgts));
      carregou.current = true;
    }
  }, [data]);

  const cli = data?.cliente;
  const vend = data?.vendedores?.[0];
  const casado =
    cli?.estado_civil === "casado" || cli?.estado_civil === "uniao_estavel";
  const vendCasado = vend?.estado_civil === "casado" || vend?.estado_civil === "uniao_estavel";
  const vendPJ = vend?.tipo_pessoa === "PJ";

  const temDoc = (cat: Categoria, key: string) =>
    (docs ?? []).some((d: any) => d.categoria === cat && d.tipo_documento === key);

  async function persistir(next: Record<string, any>, novoFgts = fgts) {
    try {
      await salvar({
        data: { cliente_id: clienteId, checklist: next, utiliza_fgts: novoFgts },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar checklist.");
    }
  }

  function setManual(key: string, val: any) {
    setCheck((prev) => {
      const next = { ...prev, [key]: val };
      persistir(next);
      return next;
    });
  }

  const hidden: string[] = Array.isArray(check.__hidden) ? check.__hidden : [];
  const custom: { id: string; label: string; cat?: Categoria }[] = Array.isArray(check.__custom)
    ? check.__custom
    : [];
  const labels: Record<string, string> =
    check.__labels && typeof check.__labels === "object" ? check.__labels : {};
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  function startEdit(itemKey: string, current: string) {
    setEditKey(itemKey);
    setEditText(current);
  }

  function saveEdit(itemKey: string) {
    const texto = editText.trim();
    setEditKey(null);
    if (!texto) return;
    setCheck((prev) => {
      const l = prev.__labels && typeof prev.__labels === "object" ? prev.__labels : {};
      const next: Record<string, any> = { ...prev, __labels: { ...l, [itemKey]: texto } };
      // custom items store the label on the entry too
      if (Array.isArray(prev.__custom) && itemKey.startsWith("custom_")) {
        const id = itemKey.slice("custom_".length);
        next.__custom = prev.__custom.map((x: { id: string; label: string }) =>
          x.id === id ? { ...x, label: texto } : x,
        );
      }
      persistir(next);
      return next;
    });
  }


  function hideItem(key: string) {
    setCheck((prev) => {
      const h: string[] = Array.isArray(prev.__hidden) ? prev.__hidden : [];
      const next = { ...prev, __hidden: Array.from(new Set([...h, key])) };
      persistir(next);
      return next;
    });
  }

  function addCustom(label: string, cat: Categoria = "outros") {
    const texto = label.trim();
    if (!texto) return;
    setCheck((prev) => {
      const c = Array.isArray(prev.__custom) ? prev.__custom : [];
      const next = {
        ...prev,
        __custom: [...c, { id: crypto.randomUUID(), label: texto, cat }],
      };
      persistir(next);
      return next;
    });
  }

  function removeCustom(id: string) {
    setCheck((prev) => {
      const c = Array.isArray(prev.__custom) ? prev.__custom : [];
      const next: Record<string, any> = {
        ...prev,
        __custom: c.filter((x: { id: string }) => x.id !== id),
      };
      delete next[`custom_${id}`];
      persistir(next);
      return next;
    });
  }

  async function toggleFgts(v: boolean) {
    setFgts(v);
    await persistir(check, v);
  }

  async function enviar(e: React.ChangeEvent<HTMLInputElement>, cat: Categoria, key: string) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("Arquivo acima de 10 MB.");
    setSubindo(key);
    try {
      const path = `${clienteId}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("cliente-documentos")
        .upload(path, file);
      if (upErr) throw upErr;
      await anexar({
        data: {
          cliente_id: clienteId,
          categoria: cat,
          tipo_documento: key,
          nome_arquivo: file.name,
          storage_path: path,
          mime_type: file.type,
          tamanho_bytes: file.size,
        },
      });
      toast.success("Documento anexado.");
      qc.invalidateQueries({ queryKey: ["cliente-docs", clienteId] });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha no upload.");
    } finally {
      setSubindo(null);
    }
  }

  function DocItem({
    itemKey,
    label,
    cat,
    onRemove,
  }: {
    itemKey: string;
    label: string;
    cat: Categoria;
    onRemove?: () => void;
  }) {
    if (hidden.includes(itemKey)) return null;
    const has = temDoc(cat, label);
    const checked = has || check[itemKey] === true;
    const display = labels[itemKey] ?? label;
    const editing = editKey === itemKey;
    return (
      <div className="flex items-center gap-3 py-1.5">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => setManual(itemKey, v === true)}
        />
        {editing ? (
          <Input
            autoFocus
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={() => saveEdit(itemKey)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveEdit(itemKey);
              } else if (e.key === "Escape") {
                setEditKey(null);
              }
            }}
            className="h-8 flex-1"
          />
        ) : (
          <span className={`flex-1 text-sm ${checked ? "text-foreground" : "text-muted-foreground"}`}>
            {display}
          </span>
        )}
        {has && !editing && (
          <span className="rounded bg-success/10 px-1.5 py-0.5 text-xs text-success">enviado</span>
        )}
        {!editing && (
          <button
            type="button"
            onClick={() => startEdit(itemKey, display)}
            aria-label="Editar item"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
        {editing ? (
          <>
            <button
              type="button"
              onClick={() => saveEdit(itemKey)}
              aria-label="Salvar item"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-success/10 hover:text-success"
            >
              <Check className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setEditKey(null)}
              aria-label="Cancelar edição"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </>
        ) : (
          <>
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-accent">
              {subindo === label ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              Enviar
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="sr-only"
                onChange={(e) => enviar(e, cat, label)}
                disabled={subindo === label}
              />
            </label>
            <button
              type="button"
              onClick={onRemove ?? (() => hideItem(itemKey))}
              aria-label="Remover item"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </>
        )}
      </div>
    );
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-4">
      {/* COMPRADOR */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checklist do comprador</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <DocItem itemKey="c_doc_id" cat="comprador" label={T.comprador[0]} />
          {casado && (
            <DocItem itemKey="c_doc_id_conj" cat="conjuge" label={T.conjuge[0]} />
          )}
          <DocItem itemKey="c_comp_end" cat="comprador" label={T.comprador[1]} />
          <DocItem itemKey="c_cert_ec" cat="comprador" label={T.comprador[2]} />
          <div className="my-2 border-t border-border" />
          <AutoItem label="Profissão" ok={filled(cli?.profissao)} />
          <AutoItem label="Telefone do comprador" ok={filled(cli?.telefone_celular)} />
          {casado && (
            <AutoItem label="Telefone do cônjuge" ok={filled(cli?.conjuge_celular)} />
          )}
          <AutoItem label="E-mail do comprador" ok={filled(cli?.email)} />
          {casado && <AutoItem label="E-mail do cônjuge" ok={filled(cli?.conjuge_email)} />}
          <AutoItem
            label="Dados da conta (agência e conta)"
            ok={filled(cli?.agencia) && filled(cli?.conta_corrente)}
          />
          <div className="mt-3 flex items-center justify-between rounded-lg border border-border p-3">
            <Label className="text-sm">Irá utilizar FGTS?</Label>
            <Switch checked={fgts} onCheckedChange={toggleFgts} />
          </div>
          {fgts && (
            <div className="mt-2 space-y-1 rounded-lg border border-dashed border-border p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Documentos para uso do FGTS
              </p>
              <DocItem itemKey="fgts_end" cat="comprador" label={T.comprador[3]} />
              <DocItem itemKey="fgts_irpf" cat="comprador" label={T.comprador[4]} />
              <DocItem itemKey="fgts_ctps" cat="comprador" label={T.comprador[5]} />
              <DocItem itemKey="fgts_extrato" cat="comprador" label={T.comprador[6]} />
            </div>
          )}
          {custom
            .filter((c) => c.cat === "comprador")
            .map((item) => (
              <DocItem
                key={item.id}
                itemKey={`custom_${item.id}`}
                label={item.label}
                cat="comprador"
                onRemove={() => removeCustom(item.id)}
              />
            ))}
          <AdicionarItem onAdd={(l) => addCustom(l, "comprador")} />
        </CardContent>
      </Card>

      {/* VENDEDOR */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Checklist do vendedor — {vendPJ ? "Pessoa Jurídica" : "Pessoa Física"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {vendPJ ? (
            <>
              <DocItem itemKey="v_contrato_social" cat="vendedor" label={T.vendedor[3]} />
              <DocItem itemKey="v_cnpj" cat="vendedor" label={T.vendedor[4]} />
              <DocItem itemKey="v_doc_socios" cat="vendedor" label={T.vendedor[5]} />
              <DocItem itemKey="v_comp_end_pj" cat="vendedor" label={T.vendedor[6]} />
            </>
          ) : (
            <>
              <DocItem itemKey="v_doc_id" cat="vendedor" label={T.vendedor[0]} />
              <DocItem itemKey="v_comp_end" cat="vendedor" label={T.vendedor[1]} />
              <DocItem itemKey="v_cert_ec" cat="vendedor" label={T.vendedor[2]} />
              <div className="my-2 border-t border-border" />
              <AutoItem label="Profissão" ok={filled(vend?.profissao)} />
              <AutoItem label="Telefone" ok={filled(vend?.telefone_celular)} />
              <AutoItem label="E-mail" ok={filled(vend?.email)} />
              <AutoItem
                label="Dados bancários: Banco / AG e CC para recebimento"
                ok={filled(vend?.agencia) && filled(vend?.conta_corrente)}
              />
              {vendCasado && (
                <div className="flex items-center gap-3 py-1.5">
                  <Checkbox
                    checked={check["v_dados_banc_conj"] === true}
                    onCheckedChange={(v) => setManual("v_dados_banc_conj", v === true)}
                  />
                  <span className="flex-1 text-sm text-muted-foreground">
                    Dados bancários do cônjuge do vendedor
                  </span>
                </div>
              )}
            </>
          )}
          {!vend && (
            <p className="pt-2 text-xs text-muted-foreground">
              Cadastre um vendedor na aba “Vendedores” para validar os dados automaticamente.
            </p>
          )}
          {custom
            .filter((c) => c.cat === "vendedor")
            .map((item) => (
              <DocItem
                key={item.id}
                itemKey={`custom_${item.id}`}
                label={item.label}
                cat="vendedor"
                onRemove={() => removeCustom(item.id)}
              />
            ))}
          <AdicionarItem onAdd={(l) => addCustom(l, "vendedor")} />
        </CardContent>
      </Card>

      {/* IMÓVEL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checklist do imóvel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <DocItem itemKey="i_matricula" cat="imovel" label={T.imovel[0]} />
          <DocItem itemKey="i_iptu" cat="imovel" label={T.imovel[1]} />
          <div className="mt-2 flex items-center justify-between rounded-lg border border-border p-3">
            <Label className="text-sm">O imóvel fica em condomínio?</Label>
            <Switch
              checked={check["i_condominio"] === true}
              onCheckedChange={(v) => setManual("i_condominio", v)}
            />
          </div>
          {check["i_condominio"] === true && (
            <div className="mt-2 space-y-1 rounded-lg border border-dashed border-border p-3">
              <DocItem itemKey="i_cnd_cond" cat="imovel" label={T.imovel[2]} />
              <DocItem itemKey="i_planta" cat="imovel" label={T.imovel[3]} />
            </div>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Contato da vistoria — Nome
              </Label>
              <Input
                value={check["i_vistoria_nome"] ?? ""}
                onChange={(e) =>
                  setCheck((p) => ({ ...p, i_vistoria_nome: e.target.value }))
                }
                onBlur={() => persistir(check)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Contato da vistoria — Telefone
              </Label>
              <Input
                value={check["i_vistoria_tel"] ?? ""}
                onChange={(e) =>
                  setCheck((p) => ({ ...p, i_vistoria_tel: e.target.value }))
                }
                onBlur={() => persistir(check)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Quantidade de vagas do imóvel
              </Label>
              <Input
                inputMode="numeric"
                value={check["i_vagas"] ?? ""}
                onChange={(e) => setCheck((p) => ({ ...p, i_vagas: e.target.value }))}
                onBlur={() => persistir(check)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">IQ?</Label>
              <Select
                value={check["i_iq"] ?? ""}
                onValueChange={(v) => setManual("i_iq", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="nao">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {custom
            .filter((c) => c.cat === "imovel")
            .map((item) => (
              <DocItem
                key={item.id}
                itemKey={`custom_${item.id}`}
                label={item.label}
                cat="imovel"
                onRemove={() => removeCustom(item.id)}
              />
            ))}
          <AdicionarItem onAdd={(l) => addCustom(l, "imovel")} />
        </CardContent>
      </Card>

      {/* ITENS PERSONALIZADOS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Itens personalizados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {custom.filter((c) => !c.cat || c.cat === "outros").length === 0 && (
            <p className="text-sm text-muted-foreground">
              Adicione itens próprios ao checklist deste cliente.
            </p>
          )}
          {custom
            .filter((c) => !c.cat || c.cat === "outros")
            .map((item) => (
              <DocItem
                key={item.id}
                itemKey={`custom_${item.id}`}
                label={item.label}
                cat="outros"
                onRemove={() => removeCustom(item.id)}
              />
            ))}
          <AdicionarItem onAdd={(l) => addCustom(l, "outros")} />
        </CardContent>
      </Card>
    </div>

  );
}
