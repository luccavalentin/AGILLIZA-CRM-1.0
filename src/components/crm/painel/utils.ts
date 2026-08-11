import {
  Calculator,
  FileCheck2,
  FolderClosed,
  HardHat,
  Scale,
  Send,
  Star,
  UserCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import type { PainelStage } from "@/lib/crm/clientes.functions";

/** Ícone por código de etapa da esteira do CRM. */
export const ICONES_ETAPA: Record<string, LucideIcon> = {
  cadastro_basico: UserPlus,
  cadastro_completo: UserCheck,
  simulacao: Calculator,
  credito_enviado: Send,
  credito_aprovado: Star,
  coleta_documentos: FolderClosed,
  engenharia_vistoria: HardHat,
  analise_juridica: Scale,
  contrato_emitido: FileCheck2,
};

/** Texto "há Xmin/h/d" relativo à data ISO informada. */
export function tempoRelativo(iso: string | null): string {
  if (!iso) return "sem data";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

/** Estado de arrasto de um card na esteira. */
export interface Arrasto {
  clienteId: string;
  origem: string;
}

/** Item de cliente conforme entregue pelo backend do painel. */
export type PainelClienteItem = PainelStage["clientes"][number];
