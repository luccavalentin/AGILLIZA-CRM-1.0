import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  FileSignature,
  Printer,
  PenLine,
  Database,
  ArrowLeft,
  Search,
  Loader2,
  User,
  Eraser,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buscarClientesCRM } from "@/lib/crm/clientes.functions";
import { DPS_PERGUNTAS } from "@/lib/formularios/dps-questions";
import logoLight from "@/assets/brand/agilliza-logo-oficial-light.png";

type Modo = "escolha" | "documento";

interface Proponente {
  nome: string;
  documento: string | null;
  data_nascimento: string | null;
  estado_civil: string | null;
  telefone_celular: string | null;
  email: string | null;
}

const PROPONENTE_VAZIO: Proponente = {
  nome: "",
  documento: null,
  data_nascimento: null,
  estado_civil: null,
  telefone_celular: null,
  email: null,
};

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
  const [proponente, setProponente] = useState<Proponente>(PROPONENTE_VAZIO);
  const [origem, setOrigem] = useState<"branco" | "crm">("branco");

  if (modo === "documento") {
    return (
      <DpsDocumento
        proponenteInicial={proponente}
        origem={origem}
        onVoltar={() => {
          setModo("escolha");
          setProponente(PROPONENTE_VAZIO);
          setOrigem("branco");
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
            Escolha como deseja gerar a declaração de saúde do proponente. Em qualquer opção
            você pode editar todos os campos e marcar as respostas na tela antes de imprimir.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            setProponente(PROPONENTE_VAZIO);
            setOrigem("branco");
            setModo("documento");
          }}
          className="group rounded-xl border border-border bg-card p-6 text-left transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <PenLine className="h-6 w-6" />
          </div>
          <h2 className="mb-1 font-semibold text-foreground">Preencher direto na tela</h2>
          <p className="text-sm text-muted-foreground">
            Sem puxar do CRM. Preencha os dados do proponente e marque as respostas aqui mesmo,
            depois imprima ou salve em PDF.
          </p>
        </button>

        <ClientePicker
          onSelecionar={(p) => {
            setProponente(p);
            setOrigem("crm");
            setModo("documento");
          }}
        />
      </div>
    </div>
  );
}

function ClientePicker({ onSelecionar }: { onSelecionar: (p: Proponente) => void }) {
  const [aberto, setAberto] = useState(false);
  const [q, setQ] = useState("");
  const [termo, setTermo] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setTermo(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const busca = useQuery({
    queryKey: ["dps-buscar-clientes", termo],
    queryFn: () => buscarClientesCRM({ data: { q: termo } }),
    enabled: aberto && termo.length >= 2,
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
        <h2 className="mb-1 font-semibold text-foreground">Puxar dados do CRM</h2>
        <p className="text-sm text-muted-foreground">
          A DPS já vem com os dados principais do cliente pré-carregados. Você ainda pode ajustar
          qualquer campo antes de imprimir.
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
        <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nome, CPF/CNPJ ou e-mail…"
              className="pl-9"
            />
          </div>
          {busca.isFetching && (
            <div className="flex items-center px-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </form>

        <div className="space-y-1">
          {termo.length < 2 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Digite ao menos 2 caracteres para buscar.
            </p>
          )}
          {busca.isError && (
            <p className="py-4 text-center text-sm text-destructive">
              {busca.error instanceof Error ? busca.error.message : "Falha na busca."}
            </p>
          )}
          {termo.length >= 2 && busca.isSuccess && resultados.length === 0 && (
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

/** Resposta possível de cada pergunta/subitem da DPS. */
type Resposta = "sim" | "nao" | null;

/** Toggle clicável de Sim/Não que também imprime como caixinhas marcadas. */
function SimNao({
  valor,
  onChange,
}: {
  valor: Resposta;
  onChange: (v: Resposta) => void;
}) {
  return (
    <div className="dps-simnao">
      {(["sim", "nao"] as const).map((op) => {
        const marcado = valor === op;
        return (
          <button
            key={op}
            type="button"
            aria-pressed={marcado}
            onClick={() => onChange(marcado ? null : op)}
            className="dps-opt dps-opt-btn no-print-outline"
            title={marcado ? "Clique para desmarcar" : `Marcar ${op === "sim" ? "Sim" : "Não"}`}
          >
            <span className={`dps-box${marcado ? " dps-box-marcado" : ""}`}>
              {marcado && <span className="dps-box-x">✕</span>}
            </span>
            {op === "sim" ? "Sim" : "Não"}
          </button>
        );
      })}
    </div>
  );
}

/** Todas as chaves possíveis de respostas — perguntas simples e subitens (ex.: "4a"). */
function iniciarRespostas(): Record<string, Resposta> {
  const r: Record<string, Resposta> = {};
  for (const p of DPS_PERGUNTAS) {
    if (p.subitens) {
      for (const s of p.subitens) r[`${p.numero}${s.letra}`] = null;
    } else {
      r[String(p.numero)] = null;
    }
  }
  return r;
}

function DpsDocumento({
  proponenteInicial,
  origem,
  onVoltar,
}: {
  proponenteInicial: Proponente;
  origem: "branco" | "crm";
  onVoltar: () => void;
}) {
  // Todos os campos são editáveis na tela — vindos do CRM ou em branco.
  const [nome, setNome] = useState(proponenteInicial.nome ?? "");
  const [documento, setDocumento] = useState(fmtDoc(proponenteInicial.documento));
  const [dataNasc, setDataNasc] = useState(fmtData(proponenteInicial.data_nascimento));
  const [estadoCivil, setEstadoCivil] = useState(
    proponenteInicial.estado_civil
      ? (ESTADO_CIVIL_LABEL[proponenteInicial.estado_civil] ?? proponenteInicial.estado_civil)
      : "",
  );
  const [telefone, setTelefone] = useState(proponenteInicial.telefone_celular ?? "");
  const [email, setEmail] = useState(proponenteInicial.email ?? "");
  const [peso, setPeso] = useState("");
  const [altura, setAltura] = useState("");
  const [medicoNome, setMedicoNome] = useState("");
  const [medicoTel, setMedicoTel] = useState("");
  const [localData, setLocalData] = useState("");

  const respostasIniciais = useMemo(() => iniciarRespostas(), []);
  const [respostas, setRespostas] = useState<Record<string, Resposta>>(respostasIniciais);
  const [esclarecimentos, setEsclarecimentos] = useState<Record<string, string>>({});
  const [assinaturaNome, setAssinaturaNome] = useState("");

  function marcar(chave: string, valor: Resposta) {
    setRespostas((r) => ({ ...r, [chave]: valor }));
  }

  function setEsclarecimento(chave: string, texto: string) {
    setEsclarecimentos((e) => ({ ...e, [chave]: texto }));
  }

  function limparRespostas() {
    setRespostas(iniciarRespostas());
    setEsclarecimentos({});
  }

  return (
    <div className="dps-screen">
      <div className="dps-toolbar no-print">
        <Button variant="outline" size="sm" onClick={onVoltar}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {origem === "crm" && nome ? (
            <span className="inline-flex items-center gap-1">
              <Database className="h-4 w-4" /> Dados de {nome}{" "}
              <span className="text-xs">(editável)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <PenLine className="h-4 w-4" /> Preenchimento direto na tela
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={limparRespostas} title="Limpar marcações Sim/Não">
            <Eraser className="mr-2 h-4 w-4" />
            Limpar marcações
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir / Salvar PDF
          </Button>
        </div>
      </div>

      <div className="dps-print">
        <header className="dps-header">
          <div className="dps-header-inner">
            <img src={logoLight} alt="Agilliza" className="dps-logo" />
            <div className="dps-title">
              <h1>Declaração Pessoal de Saúde</h1>
              <p>Assinalar com "X" a resposta de cada pergunta abaixo.</p>
            </div>
          </div>
        </header>

        <section className="dps-ident">
          <div className="dps-ident-row">
            <CampoEditavel label="Nome do proponente" valor={nome} onChange={setNome} span={2} />
            <CampoEditavel label="CPF/CNPJ" valor={documento} onChange={setDocumento} />
          </div>
          <div className="dps-ident-row">
            <CampoEditavel
              label="Data de nascimento"
              valor={dataNasc}
              onChange={setDataNasc}
              placeholder="dd/mm/aaaa"
            />
            <CampoEditavel label="Estado civil" valor={estadoCivil} onChange={setEstadoCivil} />
            <CampoEditavel label="Telefone" valor={telefone} onChange={setTelefone} />
          </div>
          <div className="dps-ident-row">
            <CampoEditavel label="E-mail" valor={email} onChange={setEmail} span={3} />
          </div>
        </section>

        <div className="dps-perguntas">
          {DPS_PERGUNTAS.map((p) => (
            <div key={p.numero} className="dps-q">
              <div className="dps-q-head">
                <p className="dps-q-text">
                  <b>{p.numero} –</b> {p.texto}
                </p>
                {!p.subitens && (
                  <SimNao
                    valor={respostas[String(p.numero)] ?? null}
                    onChange={(v) => marcar(String(p.numero), v)}
                  />
                )}
              </div>
              {p.esclareca && (
                <EsclarecaCampo
                  valor={esclarecimentos[String(p.numero)] ?? ""}
                  onChange={(v) => setEsclarecimento(String(p.numero), v)}
                />
              )}
              {p.nota && <p className="dps-nota">{p.nota}</p>}
              {p.subitens && (
                <div className="dps-sub">
                  {p.subitens.map((s) => {
                    const chave = `${p.numero}${s.letra}`;
                    return (
                      <div key={s.letra} className="dps-subitem">
                        <div className="dps-q-head">
                          <p className="dps-q-text">
                            <b>{s.letra})</b> {s.texto}
                          </p>
                          <SimNao valor={respostas[chave] ?? null} onChange={(v) => marcar(chave, v)} />
                        </div>
                        {p.numero === 4 && (
                          <EsclarecaCampo
                            valor={esclarecimentos[chave] ?? ""}
                            onChange={(v) => setEsclarecimento(chave, v)}
                          />
                        )}
                        {s.nota && <p className="dps-nota">{s.nota}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          <div className="dps-q">
            <p className="dps-q-text">
              <b>12 –</b> Informe seu peso e altura:
            </p>
            <div className="dps-inline">
              <span className="dps-inline-item">
                Peso:{" "}
                <input
                  type="text"
                  value={peso}
                  onChange={(e) => setPeso(e.target.value)}
                  className="dps-input-inline"
                  inputMode="decimal"
                />{" "}
                Kg
              </span>
              <span className="dps-inline-item">
                Altura:{" "}
                <input
                  type="text"
                  value={altura}
                  onChange={(e) => setAltura(e.target.value)}
                  className="dps-input-inline"
                  inputMode="decimal"
                />{" "}
                m
              </span>
            </div>
          </div>
          <div className="dps-q">
            <p className="dps-q-text">
              <b>13 –</b> Informe o nome do seu médico habitual e telefone ou outro meio para
              contato.
            </p>
            <div className="dps-ident-row">
              <CampoEditavel label="Nome" valor={medicoNome} onChange={setMedicoNome} span={2} />
              <CampoEditavel label="Telefone" valor={medicoTel} onChange={setMedicoTel} />
            </div>
          </div>

          <p className="dps-declaracao">
            Declaro que as informações acima são verdadeiras e completas, estando ciente de que a
            omissão de informações pode implicar na perda do direito à indenização, bem como no
            cancelamento do seguro.
          </p>
          <div className="dps-assinatura">
            <div>
              <input
                type="text"
                value={localData}
                onChange={(e) => setLocalData(e.target.value)}
                className="dps-input-assinatura"
                placeholder="Cidade, dd/mm/aaaa"
              />
              <p>Local e data</p>
            </div>
            <div>
              <span className="dps-linha" />
              <p>Assinatura do proponente</p>
            </div>
          </div>
        </div>

        <footer className="dps-footer">
          <span>📞 (19) 98326-0030</span>
          <span>✉️ contato@agilliza.net.br</span>
        </footer>
      </div>
    </div>
  );
}

function CampoEditavel({
  label,
  valor,
  onChange,
  span = 1,
  placeholder,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  span?: number;
  placeholder?: string;
}) {
  return (
    <div className="dps-campo" style={{ gridColumn: `span ${span}` }}>
      <span className="dps-campo-label">{label}</span>
      <input
        type="text"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="dps-campo-input"
      />
    </div>
  );
}
