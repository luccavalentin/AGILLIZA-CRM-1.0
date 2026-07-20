import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Download, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listarDocumentos,
  listarBeneficiosDoFuncionario,
  listarFerias,
  listarOcorrencias,
  listarHolerites,
  gerarUrlAssinada,
} from "@/lib/rh/submodulos.functions";
import { ChecklistClt } from "@/components/rh/checklist-clt";
import { formatBRL } from "@/lib/financeiro/format";

function fmtDate(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={99} className="py-8 text-center text-sm text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  );
}

function Chrome({
  titulo,
  atalho,
  children,
}: {
  titulo: string;
  atalho: { to: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="text-base">{titulo}</CardTitle>
        <Button asChild variant="outline" size="sm">
          <Link to={atalho.to}>
            <ExternalLink className="mr-2 h-3.5 w-3.5" />
            {atalho.label}
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">{children}</div>
      </CardContent>
    </Card>
  );
}

export function FichaDocumentos({ funcionarioId }: { funcionarioId: string }) {
  const fn = useServerFn(listarDocumentos);
  const fnUrl = useServerFn(gerarUrlAssinada);
  const q = useQuery({
    queryKey: ["rh-ficha-docs", funcionarioId],
    queryFn: () => fn({ data: { funcionario_id: funcionarioId } }),
  });

  async function baixar(path: string) {
    const r = await fnUrl({ data: { path, expira_em: 300 } });
    window.open(r.url, "_blank", "noopener,noreferrer");
  }

  return (
    <Chrome titulo="Documentos" atalho={{ to: "/rh/documentos", label: "Gerenciar" }}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Arquivo</TableHead>
            <TableHead>Validade</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.isLoading && <Empty>Carregando…</Empty>}
          {!q.isLoading && (q.data?.length ?? 0) === 0 && (
            <Empty>Nenhum documento anexado.</Empty>
          )}
          {q.data?.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="font-medium">{d.tipo}</TableCell>
              <TableCell className="max-w-[280px] truncate">{d.descricao ?? "—"}</TableCell>
              <TableCell className="max-w-[220px] truncate">{d.arquivo_nome}</TableCell>
              <TableCell>{fmtDate(d.validade)}</TableCell>
              <TableCell className="text-right">
                <Button size="icon" variant="ghost" onClick={() => baixar(d.arquivo_path)}>
                  <Download className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Chrome>
  );
}

export function FichaBeneficios({ funcionarioId }: { funcionarioId: string }) {
  const fn = useServerFn(listarBeneficiosDoFuncionario);
  const q = useQuery({
    queryKey: ["rh-ficha-benef", funcionarioId],
    queryFn: () => fn({ data: { funcionario_id: funcionarioId } }),
  });
  return (
    <Chrome titulo="Benefícios" atalho={{ to: "/rh/beneficios", label: "Gerenciar" }}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Desconto</TableHead>
            <TableHead>Vigência</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.isLoading && <Empty>Carregando…</Empty>}
          {!q.isLoading && (q.data?.length ?? 0) === 0 && (
            <Empty>Nenhum benefício vinculado.</Empty>
          )}
          {q.data?.map((b) => (
            <TableRow key={b.id}>
              <TableCell className="font-medium">{b.tipo_nome}</TableCell>
              <TableCell>{formatBRL(b.valor)}</TableCell>
              <TableCell>{formatBRL(b.desconto)}</TableCell>
              <TableCell>
                {fmtDate(b.vigencia_inicio)} — {fmtDate(b.vigencia_fim)}
              </TableCell>
              <TableCell>
                <span
                  className={
                    b.ativo
                      ? "inline-flex rounded-md bg-[color-mix(in_oklab,var(--success)_15%,transparent)] px-2 py-0.5 text-[11px] font-medium text-success"
                      : "inline-flex rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                  }
                >
                  {b.ativo ? "Ativo" : "Encerrado"}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Chrome>
  );
}

export function FichaFerias({ funcionarioId }: { funcionarioId: string }) {
  const fn = useServerFn(listarFerias);
  const q = useQuery({
    queryKey: ["rh-ficha-ferias", funcionarioId],
    queryFn: () => fn({ data: { funcionario_id: funcionarioId } }),
  });
  return (
    <Chrome titulo="Férias" atalho={{ to: "/rh/ferias", label: "Gerenciar" }}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Período aquisitivo</TableHead>
            <TableHead>Gozo</TableHead>
            <TableHead>Dias</TableHead>
            <TableHead>Abono</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.isLoading && <Empty>Carregando…</Empty>}
          {!q.isLoading && (q.data?.length ?? 0) === 0 && (
            <Empty>Nenhum período de férias cadastrado.</Empty>
          )}
          {q.data?.map((f) => (
            <TableRow key={f.id}>
              <TableCell>
                {fmtDate(f.periodo_aquisitivo_inicio)} — {fmtDate(f.periodo_aquisitivo_fim)}
              </TableCell>
              <TableCell>
                {fmtDate(f.data_inicio)} — {fmtDate(f.data_fim)}
              </TableCell>
              <TableCell>{f.dias_gozados}</TableCell>
              <TableCell>{f.abono_dias}</TableCell>
              <TableCell className="capitalize">{f.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Chrome>
  );
}

export function FichaOcorrencias({ funcionarioId }: { funcionarioId: string }) {
  const fn = useServerFn(listarOcorrencias);
  const q = useQuery({
    queryKey: ["rh-ficha-ocorr", funcionarioId],
    queryFn: () => fn({ data: { funcionario_id: funcionarioId } }),
  });
  return (
    <Chrome titulo="Ocorrências" atalho={{ to: "/rh/faltas-ocorrencias", label: "Gerenciar" }}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Início</TableHead>
            <TableHead>Fim</TableHead>
            <TableHead>Dias</TableHead>
            <TableHead>Justificativa</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.isLoading && <Empty>Carregando…</Empty>}
          {!q.isLoading && (q.data?.length ?? 0) === 0 && (
            <Empty>Nenhuma ocorrência registrada.</Empty>
          )}
          {q.data?.map((o) => (
            <TableRow key={o.id}>
              <TableCell className="font-medium capitalize">{o.tipo}</TableCell>
              <TableCell>{fmtDate(o.data_inicio)}</TableCell>
              <TableCell>{fmtDate(o.data_fim)}</TableCell>
              <TableCell>{o.dias ?? "—"}</TableCell>
              <TableCell className="max-w-[320px] truncate">
                {o.justificativa ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Chrome>
  );
}

export function FichaHolerites({ funcionarioId }: { funcionarioId: string }) {
  const fn = useServerFn(listarHolerites);
  const fnUrl = useServerFn(gerarUrlAssinada);
  const q = useQuery({
    queryKey: ["rh-ficha-hol", funcionarioId],
    queryFn: () => fn({ data: { funcionario_id: funcionarioId } }),
  });
  async function baixar(path: string) {
    const r = await fnUrl({ data: { path, expira_em: 300 } });
    window.open(r.url, "_blank", "noopener,noreferrer");
  }
  return (
    <Chrome titulo="Holerites" atalho={{ to: "/rh/holerites", label: "Gerenciar" }}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Competência</TableHead>
            <TableHead>Arquivo</TableHead>
            <TableHead>Valor líquido</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.isLoading && <Empty>Carregando…</Empty>}
          {!q.isLoading && (q.data?.length ?? 0) === 0 && (
            <Empty>Nenhum holerite disponível.</Empty>
          )}
          {q.data?.map((h) => (
            <TableRow key={h.id}>
              <TableCell className="font-medium">
                {String(h.mes).padStart(2, "0")}/{h.ano}
              </TableCell>
              <TableCell className="max-w-[240px] truncate">{h.arquivo_nome}</TableCell>
              <TableCell>{h.valor_liquido !== null ? formatBRL(h.valor_liquido) : "—"}</TableCell>
              <TableCell className="text-right">
                <Button size="icon" variant="ghost" onClick={() => baixar(h.arquivo_path)}>
                  <Download className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Chrome>
  );
}
