import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SlidersHorizontal, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  MODULOS_CONFIG,
  mesclarConfig,
  type CampoConfig,
  type ConfigModulo,
  type ModuloConfig,
} from "@/lib/admin/configuracoes-modulos";
import {
  obterConfiguracoesModulos,
  salvarConfiguracaoModulo,
} from "@/lib/admin/configuracoes-modulos.functions";

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações Gerais — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("admin.parametros"),
  component: Pagina,
});

function Pagina() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-config-modulos"],
    queryFn: () => obterConfiguracoesModulos(),
  });

  if (q.isLoading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <header className="flex items-center gap-3">
        <SlidersHorizontal className="size-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Configurações Gerais</h1>
          <p className="text-sm text-muted-foreground">
            Ajuste o comportamento de cada módulo do sistema.
          </p>
        </div>
      </header>

      <Tabs defaultValue={MODULOS_CONFIG[0]?.id}>
        <TabsList className="flex h-auto flex-wrap justify-start">
          {MODULOS_CONFIG.map((m) => (
            <TabsTrigger key={m.id} value={m.id} className="gap-2">
              <m.icon className="size-4" />
              {m.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {MODULOS_CONFIG.map((m) => (
          <TabsContent key={m.id} value={m.id} className="mt-4">
            <PainelModulo
              modulo={m}
              salvo={q.data?.[m.id]}
              onSaved={() => qc.invalidateQueries({ queryKey: ["admin-config-modulos"] })}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function PainelModulo({
  modulo,
  salvo,
  onSaved,
}: {
  modulo: ModuloConfig;
  salvo: ConfigModulo | undefined;
  onSaved: () => void;
}) {
  const inicial = useMemo(() => mesclarConfig(modulo, salvo), [modulo, salvo]);
  const [form, setForm] = useState<ConfigModulo>(inicial);

  useEffect(() => {
    setForm(inicial);
  }, [inicial]);

  const salvar = useMutation({
    mutationFn: () => salvarConfiguracaoModulo({ data: { modulo: modulo.id, config: form } }),
    onSuccess: () => {
      toast.success(`Configurações de ${modulo.label} salvas.`);
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const set = (chave: string, valor: boolean | number | string) =>
    setForm((f) => ({ ...f, [chave]: valor }));

  return (
    <Card className="p-5">
      <p className="mb-5 text-sm text-muted-foreground">{modulo.descricao}</p>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          salvar.mutate();
        }}
      >
        {modulo.campos.map((campo) => (
          <CampoLinha key={campo.chave} campo={campo} valor={form[campo.chave]} onChange={set} />
        ))}

        <div className="flex justify-end border-t pt-4">
          <Button type="submit" disabled={salvar.isPending}>
            <Save className="mr-2 size-4" />
            {salvar.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function CampoLinha({
  campo,
  valor,
  onChange,
}: {
  campo: CampoConfig;
  valor: boolean | number | string | undefined;
  onChange: (chave: string, valor: boolean | number | string) => void;
}) {
  if (campo.tipo === "boolean") {
    return (
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label className="text-foreground">{campo.label}</Label>
          {campo.descricao && (
            <p className="text-xs text-muted-foreground">{campo.descricao}</p>
          )}
        </div>
        <Switch
          checked={!!valor}
          onCheckedChange={(v) => onChange(campo.chave, v)}
        />
      </div>
    );
  }

  if (campo.tipo === "select") {
    return (
      <div className="space-y-1.5">
        <Label>{campo.label}</Label>
        {campo.descricao && <p className="text-xs text-muted-foreground">{campo.descricao}</p>}
        <Select value={String(valor ?? "")} onValueChange={(v) => onChange(campo.chave, v)}>
          <SelectTrigger className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(campo.opcoes ?? []).map((o) => (
              <SelectItem key={o.valor} value={o.valor}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (campo.tipo === "number") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={campo.chave}>{campo.label}</Label>
        {campo.descricao && <p className="text-xs text-muted-foreground">{campo.descricao}</p>}
        <div className="flex items-center gap-2">
          <Input
            id={campo.chave}
            type="number"
            className="max-w-[10rem]"
            min={campo.min}
            max={campo.max}
            value={valor === undefined ? "" : String(valor)}
            onChange={(e) => onChange(campo.chave, e.target.value === "" ? 0 : Number(e.target.value))}
          />
          {campo.sufixo && (
            <span className="text-sm text-muted-foreground">{campo.sufixo}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={campo.chave}>{campo.label}</Label>
      {campo.descricao && <p className="text-xs text-muted-foreground">{campo.descricao}</p>}
      <Input
        id={campo.chave}
        value={String(valor ?? "")}
        onChange={(e) => onChange(campo.chave, e.target.value)}
      />
    </div>
  );
}
