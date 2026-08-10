import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  anexarDocumento,
  salvarChecklist,
} from "@/lib/crm/clientes.functions";
import type { Categoria, GrupoChecklist } from "./types";

type Dados = { cliente?: { documentos_checklist?: unknown; utiliza_fgts?: boolean | null } | null };

export function useChecklistState(clienteId: string, data: Dados | undefined) {
  const qc = useQueryClient();
  const salvar = useServerFn(salvarChecklist);
  const anexar = useServerFn(anexarDocumento);

  const [check, setCheck] = useState<Record<string, any>>({});
  const [fgts, setFgts] = useState(false);
  const [subindo, setSubindo] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const carregou = useRef(false);

  useEffect(() => {
    if (data && !carregou.current) {
      setCheck((data.cliente?.documentos_checklist as Record<string, any>) ?? {});
      setFgts(Boolean(data.cliente?.utiliza_fgts));
      carregou.current = true;
    }
  }, [data]);

  const hidden: string[] = Array.isArray(check.__hidden) ? check.__hidden : [];
  const custom: { id: string; label: string; cat?: Categoria }[] = Array.isArray(check.__custom)
    ? check.__custom
    : [];
  const labels: Record<string, string> =
    check.__labels && typeof check.__labels === "object" ? check.__labels : {};
  const grupos: GrupoChecklist[] = Array.isArray(check.__grupos) ? check.__grupos : [];

  // Serializa persistências do checklist: se várias mudanças ocorrerem em
  // sequência (cliques rápidos), cancela a fila anterior e envia sempre o
  // ESTADO MAIS RECENTE após a resposta corrente — evita "resposta antiga
  // sobrescreve estado novo" (race condition last-response-wins).
  const enviandoRef = useRef(false);
  const pendenteRef = useRef<null | { next: Record<string, any>; fgts: boolean }>(null);

  async function persistir(next: Record<string, any>, novoFgts = fgts) {
    pendenteRef.current = { next, fgts: novoFgts };
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    try {
      while (pendenteRef.current) {
        const payload = pendenteRef.current;
        pendenteRef.current = null;
        try {
          await salvar({
            data: { cliente_id: clienteId, checklist: payload.next, utiliza_fgts: payload.fgts },
          });
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Falha ao salvar checklist.");
          break;
        }
      }
    } finally {
      enviandoRef.current = false;
    }
  }

  function setManual(key: string, val: any) {
    setCheck((prev) => {
      const next = { ...prev, [key]: val };
      persistir(next);
      return next;
    });
  }

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

  function setGrupos(updater: (g: GrupoChecklist[]) => GrupoChecklist[]) {
    setCheck((prev) => {
      const atuais: GrupoChecklist[] = Array.isArray(prev.__grupos) ? prev.__grupos : [];
      const next = { ...prev, __grupos: updater(atuais) };
      persistir(next);
      return next;
    });
  }

  function addGrupo(titulo: string) {
    const t = titulo.trim();
    if (!t) return;
    setGrupos((g) => [...g, { id: crypto.randomUUID(), titulo: t, itens: [] }]);
  }

  function renameGrupo(id: string, titulo: string) {
    const t = titulo.trim();
    if (!t) return;
    setGrupos((g) => g.map((x) => (x.id === id ? { ...x, titulo: t } : x)));
  }

  function removeGrupo(id: string) {
    setGrupos((g) => g.filter((x) => x.id !== id));
  }

  function addItemGrupo(grupoId: string, label: string) {
    const t = label.trim();
    if (!t) return;
    setGrupos((g) =>
      g.map((x) =>
        x.id === grupoId
          ? { ...x, itens: [...x.itens, { id: crypto.randomUUID(), label: t, feito: false }] }
          : x,
      ),
    );
  }

  function toggleItemGrupo(grupoId: string, itemId: string, feito: boolean) {
    setGrupos((g) =>
      g.map((x) =>
        x.id === grupoId
          ? { ...x, itens: x.itens.map((it) => (it.id === itemId ? { ...it, feito } : it)) }
          : x,
      ),
    );
  }

  function renameItemGrupo(grupoId: string, itemId: string, label: string) {
    const t = label.trim();
    if (!t) return;
    setGrupos((g) =>
      g.map((x) =>
        x.id === grupoId
          ? { ...x, itens: x.itens.map((it) => (it.id === itemId ? { ...it, label: t } : it)) }
          : x,
      ),
    );
  }

  function removeItemGrupo(grupoId: string, itemId: string) {
    setGrupos((g) =>
      g.map((x) =>
        x.id === grupoId ? { ...x, itens: x.itens.filter((it) => it.id !== itemId) } : x,
      ),
    );
  }

  function moverGrupo(fromId: string, toId: string) {
    if (fromId === toId) return;
    setGrupos((g) => {
      const from = g.findIndex((x) => x.id === fromId);
      const to = g.findIndex((x) => x.id === toId);
      if (from < 0 || to < 0) return g;
      const copia = [...g];
      const [movido] = copia.splice(from, 1);
      copia.splice(to, 0, movido);
      return copia;
    });
  }

  function moverItem(
    origem: { grupoId: string; itemId: string },
    destino: { grupoId: string; itemId?: string },
  ) {
    if (origem.grupoId === destino.grupoId && origem.itemId === destino.itemId) return;
    setGrupos((g) => {
      const copia = g.map((x) => ({ ...x, itens: [...x.itens] }));
      const gOrigem = copia.find((x) => x.id === origem.grupoId);
      const gDestino = copia.find((x) => x.id === destino.grupoId);
      if (!gOrigem || !gDestino) return g;
      const idx = gOrigem.itens.findIndex((it) => it.id === origem.itemId);
      if (idx < 0) return g;
      const [movido] = gOrigem.itens.splice(idx, 1);
      let insertAt = gDestino.itens.length;
      if (destino.itemId) {
        const destIdx = gDestino.itens.findIndex((it) => it.id === destino.itemId);
        if (destIdx >= 0) insertAt = destIdx;
      }
      gDestino.itens.splice(insertAt, 0, movido);
      return copia;
    });
  }

  async function toggleFgts(v: boolean) {
    setFgts(v);
    await persistir(check, v);
  }

  async function enviar(
    e: React.ChangeEvent<HTMLInputElement>,
    cat: Categoria,
    key: string,
  ) {
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

  return {
    check,
    setCheck,
    fgts,
    subindo,
    editKey,
    editText,
    setEditText,
    setEditKey,
    hidden,
    custom,
    labels,
    grupos,
    persistir,
    setManual,
    startEdit,
    saveEdit,
    hideItem,
    addCustom,
    removeCustom,
    addGrupo,
    renameGrupo,
    removeGrupo,
    addItemGrupo,
    toggleItemGrupo,
    renameItemGrupo,
    removeItemGrupo,
    moverGrupo,
    moverItem,
    toggleFgts,
    enviar,
  };
}

export type ChecklistState = ReturnType<typeof useChecklistState>;
