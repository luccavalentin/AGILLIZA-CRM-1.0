import { createFileRoute, notFound } from "@tanstack/react-router";
import { ChecklistOperacaoView } from "@/components/formularios/checklist-operacao-view";
import {
  CHECKLISTS_OPERACAO,
  CHECKLIST_ABERTURA_CONTA,
  type BancoAbertura,
} from "@/lib/formularios/checklists-operacao";
import { assertModuloPermitido } from "@/lib/route-guards";

export const Route = createFileRoute("/_authenticated/checklists/$id")({
  beforeLoad: () => assertModuloPermitido("documentos.formularios"),
  head: () => ({ meta: [{ title: "Checklists — Agilliza" }] }),
  component: Pagina,
});

/** Qual banco está por trás do checklist, para exibir a marca no cabeçalho. */
function bancoDoChecklist(id: string): string | undefined {
  const entrada = Object.entries(CHECKLIST_ABERTURA_CONTA).find(([, c]) => c.id === id);
  return entrada ? (entrada[0] as BancoAbertura) : undefined;
}

function Pagina() {
  const { id } = Route.useParams();
  const checklist = CHECKLISTS_OPERACAO[id];
  if (!checklist) throw notFound();
  return <ChecklistOperacaoView checklist={checklist} banco={bancoDoChecklist(id)} />;
}
