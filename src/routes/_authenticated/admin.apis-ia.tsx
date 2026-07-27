import { AdminHero } from "@/components/admin/admin-hero";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Cpu, KeyRound, PlugZap, AlertTriangle, CheckCircle2 } from "lucide-react";
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
  testarConexaoIA,
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

type TesteResultado = { ok: boolean; message: string; modelo?: string } | null;

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
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [teste, setTeste] = useState<TesteResultado>(null);

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
      setHasApiKey(q.data.has_api_key);
      setApiKey("");
      if (q.data.status === "erro") {
        setTeste({ ok: false, message: "Última verificação falhou. Revise a chave da API e a URL base." });
      } else {
        setTeste(null);
      }
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
    setTeste(null);
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
          api_key: apiKey.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Configuração de IA salva.");
      setApiKey("");
      qc.invalidateQueries({ queryKey: ["admin-config-ia"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
  });

  const testar = useMutation({
    mutationFn: () =>
      testarConexaoIA({
        data: {
          provedor,
          modelo,
          base_url: baseUrl || null,
          api_key: apiKey.trim() || null,
        },
      }),
    onSuccess: (res) => {
      setTeste(res);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
      qc.invalidateQueries({ queryKey: ["admin-config-ia"] });
    },
    onError: (e) =>
      setTeste({ ok: false, message: e instanceof Error ? e.message : "Falha ao conectar." }),
  });

  if (q.isLoading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const modelosDisponiveis = PRESETS_IA[provedor].modelos;
  const modeloConhecido = modelosDisponiveis.some((m) => m.value === modelo);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <AdminHero
        icon={<Cpu className="h-5 w-5" />}
        titulo="APIs de IA"
        descricao="Configure o provedor de IA (Google Gemini ou ChatGPT) usado pelo Scan IA."
      />

      {teste && (
        <div
          className={
            "flex items-start gap-3 rounded-lg border p-3 text-sm " +
            (teste.ok
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-destructive/40 bg-destructive/10 text-destructive")
          }
          role="status"
        >
          {teste.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="font-medium">
              {teste.ok ? "Conexão de IA funcionando." : "Falha ao conectar com o provedor de IA."}
            </p>
            <p className="opacity-90">{teste.message}</p>
            {!teste.ok && (
              <p className="mt-1 text-xs opacity-80">
                Revise a chave da API, a URL base e o modelo selecionado abaixo e teste novamente.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-5 rounded-lg border border-border p-4 md:p-6">
        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <Label htmlFor="ativo">Integração de IA ativa</Label>
          <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
        </div>

        <div className="space-y-1.5">
          <Label>Provedor de IA</Label>
          <Select value={provedor} onValueChange={(v) => aplicarProvedor(v as ProvedorIA)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini">Google Gemini</SelectItem>
              <SelectItem value="openai">OpenAI (ChatGPT)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Ao trocar o provedor, o modelo e o endpoint sugeridos são preenchidos automaticamente.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Modelo</Label>
            <Select
              value={modeloConhecido ? modelo : "__custom__"}
              onValueChange={(v) => {
                if (v === "__custom__") return;
                setModelo(v);
                setTeste(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o modelo" />
              </SelectTrigger>
              <SelectContent>
                {modelosDisponiveis.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
                {!modeloConhecido && (
                  <SelectItem value="__custom__">Personalizado: {modelo}</SelectItem>
                )}
              </SelectContent>
            </Select>
            <Input
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              placeholder="Ou digite um modelo específico"
              className="mt-1 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Nome de exibição</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Base URL</Label>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={PRESETS_IA[provedor].base_url}
          />
          <p className="text-xs text-muted-foreground">
            Endpoint do provedor. Deixe o padrão sugerido se não usar um gateway próprio.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <KeyRound className="size-4" /> Chave da API
          </Label>
          <Input
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              hasApiKey ? "•••••••••••••••• (chave já cadastrada — deixe em branco para manter)" : "Cole aqui a chave da API"
            }
          />
          <p className="text-xs text-muted-foreground">
            A chave é armazenada apenas no servidor e nunca é exibida novamente. Deixe em branco para manter a chave atual.
          </p>
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

        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          <Button
            variant="outline"
            disabled={testar.isPending || (!apiKey.trim() && !hasApiKey)}
            onClick={() => testar.mutate()}
          >
            <PlugZap className="mr-2 h-4 w-4" />
            {testar.isPending ? "Testando..." : "Testar conexão"}
          </Button>
          <Button disabled={salvar.isPending} onClick={() => salvar.mutate()}>
            {salvar.isPending ? "Salvando..." : "Salvar configuração"}
          </Button>
        </div>
      </div>
    </div>
  );
}
