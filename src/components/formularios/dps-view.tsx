import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FileSignature,
  Printer,
  PenLine,
  Database,
  ArrowLeft,
  Search,
  Loader2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buscarClientesCRM } from "@/lib/crm/clientes.functions";
import { DPS_PERGUNTAS } from "@/lib/formularios/dps-questions";
import logoLight from "@/assets/brand/agilliza-logo-oficial-light.png";

type Modo = "escolha" | "manual" | "sistema";

interface Proponente {
  nome: string;
  documento: string | null;
  data_nascimento: string | null;
  estado_civil: string | null;
  telefone_celular: string | null;
  email: string | null;
}

const ESTADO_CIVIL_LABEL: Record<string, string> = {
  solteiro: "Solteiro(a)",
  casado: "Casado(a)",
  uniao_estavel: "União estável",
  divorciado: "Divorciado(a)",
  viuvo: "Viúvo(a)",
};

function fmtDoc(doc: string | null): string {
  if (!doc) return "";
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return doc;
}

function fmtData(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("T")[0].split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function DpsView() {
  const [modo, setModo] = useState<Modo>("escolha");
  const [proponente, setProponente] = useState<Proponente | null>(null);

  if (modo === "manual") {
    return <DpsDocumento proponente={null} onVoltar={() => setModo("escolha")} />;
  }
  if (modo === "sistema") {
    return (
      <DpsDocumento
        proponente={proponente}
        onVoltar={() => {
          setModo("escolha");
          setProponente(null);
        }}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <FileSignature className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            DPS · Declaração Pessoal de Saúde
          </h1>
          <p className="text-sm text-muted-foreground">
            Escolha como deseja gerar a declaração de saúde do proponente.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setModo("manual")}
          className="group rounded-xl border border-border bg-card p-6 text-left transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <PenLine className="h-6 w-6" />
          </div>
          <h2 className="mb-1 font-semibold text-foreground">Preenchimento manual</h2>
          <p className="text-sm text-muted-foreground">
            Imprima a DPS em branco, com o cabeçalho profissional da Agilliza, para o cliente
            preencher e assinar à mão.
          </p>
        </button>

        <ClientePicker
          onSelecionar={(p) => {
            setProponente(p);
            setModo("sistema");
          }}
        />
      </div>
    </div>
  );
}

function ClientePicker({ onSelecionar }: { onSelecionar: (p: Proponente) => void }) {
  const [aberto, setAberto] = useState(false);
  const [q, setQ] = useState("");
  const buscar = useServerFn(buscarClientesCRM);
  const busca = useMutation({
    mutationFn: (term: string) => buscar({ data: { q: term } }),
    onError: (e: any) => toast.error(e?.message ?? "Falha na busca."),
  });

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="group rounded-xl border border-border bg-card p-6 text-left transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg"
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Database className="h-6 w-6" />
        </div>
        <h2 className="mb-1 font-semibold text-foreground">Preenchimento via sistema</h2>
        <p className="text-sm text-muted-foreground">
          A mesma DPS, já com os dados principais do cliente puxados automaticamente do CRM.
        </p>
      </button>
    );
  }

  const resultados = busca.data ?? [];

  return (
    <Card className="sm:col-span-2">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Selecione o cliente no CRM</span>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) busca.mutate(q.trim());
          }}
        >
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome, CPF/CNPJ ou e-mail…"
          />
          <Button type="submit" disabled={busca.isPending}>
            {busca.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </form>

        <div className="space-y-1">
          {busca.isSuccess && resultados.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado.
            </p>
          )}
          {resultados.map((c: any) => (
            <button
              key={c.id}
              type="button"
              onClick={() =>
                onSelecionar({
                  nome: c.nome,
                  documento: c.documento,
                  data_nascimento: c.data_nascimento,
                  estado_civil: c.estado_civil,
                  telefone_celular: c.telefone_celular,
                  email: c.email,
                })
              }
              className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition hover:border-primary/50 hover:bg-accent"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{c.nome}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {fmtDoc(c.documento) || "sem documento"}
                  {c.email ? ` · ${c.email}` : ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SimNao() {
  return (
    <div className="dps-simnao">
      <span className="dps-opt">
        <span className="dps-box" /> Sim
      </span>
      <span className="dps-opt">
        <span className="dps-box" /> Não
      </span>
    </div>
  );
}

function DpsDocumento({
  proponente,
  onVoltar,
}: {
  proponente: Proponente | null;
  onVoltar: () => void;
}) {
  return (
    <div className="dps-screen">
      {/* Barra de ações — some na impressão */}
      <div className="dps-toolbar no-print">
        <Button variant="outline" size="sm" onClick={onVoltar}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {proponente ? (
            <span className="inline-flex items-center gap-1">
              <Database className="h-4 w-4" /> Dados de {proponente.nome}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <PenLine className="h-4 w-4" /> Formulário em branco
            </span>
          )}
        </div>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Imprimir / Salvar PDF
        </Button>
      </div>

      <div className="dps-print">
        {/* Cabeçalho profissional */}
        <header className="dps-header">
          <div className="dps-header-inner">
            <img src={logoLight} alt="Agilliza" className="dps-logo" />
            <div className="dps-title">
              <h1>Declaração Pessoal de Saúde</h1>
              <p>Assinalar com "X" a resposta de cada pergunta abaixo.</p>
            </div>
          </div>
        </header>

        {/* Identificação do proponente */}
        <section className="dps-ident">
          <div className="dps-ident-row">
            <Campo label="Nome do proponente" valor={proponente?.nome} span={2} />
            <Campo label="CPF/CNPJ" valor={fmtDoc(proponente?.documento ?? null)} />
          </div>
          <div className="dps-ident-row">
            <Campo label="Data de nascimento" valor={fmtData(proponente?.data_nascimento ?? null)} />
            <Campo
              label="Estado civil"
              valor={
                proponente?.estado_civil
                  ? (ESTADO_CIVIL_LABEL[proponente.estado_civil] ?? proponente.estado_civil)
                  : ""
              }
            />
            <Campo label="Telefone" valor={proponente?.telefone_celular ?? ""} />
          </div>
          <div className="dps-ident-row">
            <Campo label="E-mail" valor={proponente?.email ?? ""} span={3} />
          </div>
        </section>

        {/* Perguntas */}
        <div className="dps-perguntas">
          {DPS_PERGUNTAS.map((p) => (
            <div key={p.numero} className="dps-q">
              <div className="dps-q-head">
                <p className="dps-q-text">
                  <b>{p.numero} –</b> {p.texto}
                </p>
                {!p.subitens && <SimNao />}
              </div>
              {p.esclareca && <div className="dps-esclareca">Esclareça:</div>}
              {p.nota && <p className="dps-nota">{p.nota}</p>}
              {p.subitens && (
                <div className="dps-sub">
                  {p.subitens.map((s) => (
                    <div key={s.letra} className="dps-subitem">
                      <div className="dps-q-head">
                        <p className="dps-q-text">
                          <b>{s.letra})</b> {s.texto}
                        </p>
                        <SimNao />
                      </div>
                      {p.numero === 4 && <div className="dps-esclareca">Esclareça:</div>}
                      {s.nota && <p className="dps-nota">{s.nota}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Peso/altura e médico */}
          <div className="dps-q">
            <p className="dps-q-text">
              <b>12 –</b> Informe seu peso e altura:
            </p>
            <div className="dps-inline">
              <span>
                Peso: <span className="dps-linha dps-linha-sm" /> Kg
              </span>
              <span>
                Altura: <span className="dps-linha dps-linha-sm" /> m
              </span>
            </div>
          </div>
          <div className="dps-q">
            <p className="dps-q-text">
              <b>13 –</b> Informe o nome do seu médico habitual e telefone ou outro meio para
              contato.
            </p>
            <div className="dps-ident-row">
              <Campo label="Nome" valor="" span={2} />
              <Campo label="Telefone" valor="" />
            </div>
          </div>

          {/* Declaração e assinatura */}
          <p className="dps-declaracao">
            Declaro que as informações acima são verdadeiras e completas, estando ciente de que a
            omissão de informações pode implicar na perda do direito à indenização, bem como no
            cancelamento do seguro.
          </p>
          <div className="dps-assinatura">
            <div>
              <span className="dps-linha" />
              <p>Local e data</p>
            </div>
            <div>
              <span className="dps-linha" />
              <p>Assinatura do proponente</p>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <footer className="dps-footer">
          <span>📞 (19) 98326-0030</span>
          <span>✉️ contato@agilliza.net.br</span>
        </footer>
      </div>
    </div>
  );
}

function Campo({ label, valor, span = 1 }: { label: string; valor?: string; span?: number }) {
  return (
    <div className="dps-campo" style={{ gridColumn: `span ${span}` }}>
      <span className="dps-campo-label">{label}</span>
      <span className="dps-campo-valor">{valor || "\u00A0"}</span>
    </div>
  );
}
