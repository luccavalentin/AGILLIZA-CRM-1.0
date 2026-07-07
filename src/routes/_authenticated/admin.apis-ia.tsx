import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assertModuloPermitido } from "@/lib/route-guards";
import {
  getConfigIA,
  salvarConfigIA,
  PRESETS_IA,
  type ProvedorIA,
} from "@/lib/admin/apis-ia.functions";


export const Route = createFileRoute("/_authenticated/admin/apis-ia")({
  head: () => ({ meta: [{ title: "APIs de IA — Agilliza" }] }),
  beforeLoad: () => assertModuloPermitido("admin.integracoes"),
  component: Pagina,
  errorComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">
      Não foi possível carregar a configuração de IA.
    </div>
  ),
});

function Pagina() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-config-ia"], queryFn: () => getConfigIA() });

  const [provedor, setProvedor] = useState<ProvedorIA>("gemini");
  const [nome, setNome] = useState(PRESETS_IA.gemini.nome);
  const [modelo, setModelo] = useState(PRESETS_IA.gemini.modelo);
  const [temperatura, setTemperatura] = useState(0.2);
  const [baseUrl, setBaseUrl] = useState(PRESETS_IA.gemini.base_url);
  const [prompt, setPrompt] = useState("");
  const [secretName, setSecretName] = useState(PRESETS_IA.gemini.secret_name);
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    if (q.data) {
      setProvedor(q.data.provedor);
      setNome(q.data.nome);
      setModelo(q.data.modelo);
      setTemperatura(q.data.temperatura);
      setBaseUrl(q.data.base_url ?? "");
      setPrompt(q.data.prompt_scan);
      setSecretName(q.data.secret_names[0] ?? PRESETS_IA[q.data.provedor].secret_name);
      setAtivo(q.data.ativo);
    }
  }, [q.data]);

  /** Ao trocar de provedor, aplica os presets (modelo, endpoint e secret sugeridos). */
  function aplicarProvedor(p: ProvedorIA) {
    const preset = PRESETS_IA[p];
    setProvedor(p);
    setNome(preset.nome);
    setModelo(preset.modelo);
    setBaseUrl(preset.base_url);
    setSecretName(preset.secret_name);
  }

  const salvar = useMutation({
    mutationFn: () =>
      salvarConfigIA({
        data: {
          provedor,
          nome,
          modelo,
          temperatura,
          base_url: baseUrl || null,
          prompt_scan: prompt,
          secret_names: [secretName],
          ativo,
        },
      }),
    onSuccess: () => {
      toast.success("Configuração de IA salva.");
      qc.invalidateQueries({ queryKey: ["admin-config-ia"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });


  if (q.isLoading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 md:p-6">
      <header className="flex items-center gap-3">
        <Sparkles className="size-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">APIs de IA</h1>
          <p className="text-sm text-muted-foreground">
            Provedor de IA usado pelo Scan IA (extração de campos de documentos).
          </p>
        </div>
      </header>

      <div className="space-y-5 rounded-lg border border-border p-4 md:p-6">
        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <Label htmlFor="ativo">Integração de IA ativa</Label>
          <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Modelo</Label>
            <Input value={modelo} onChange={(e) => setModelo(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Base URL (opcional)</Label>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://generativelanguage.googleapis.com"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Temperatura</Label>
            <span className="text-sm tabular-nums text-muted-foreground">
              {temperatura.toFixed(2)}
            </span>
          </div>
          <Slider
            min={0}
            max={2}
            step={0.05}
            value={[temperatura]}
            onValueChange={(v) => setTemperatura(v[0])}
          />
          <p className="text-xs text-muted-foreground">
            Valores baixos deixam a extração mais precisa e previsível.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Prompt do Scan IA</Label>
          <Textarea
            rows={6}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="font-mono text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <KeyRound className="size-4" /> Nome do secret da chave de API
          </Label>
          <Input value={secretName} onChange={(e) => setSecretName(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            Apenas o nome do secret — o valor da chave nunca é exibido nem armazenado aqui.
          </p>
        </div>

        <div className="flex justify-end">
          <Button disabled={salvar.isPending} onClick={() => salvar.mutate()}>
            Salvar configuração
          </Button>
        </div>
      </div>
    </div>
  );
}
