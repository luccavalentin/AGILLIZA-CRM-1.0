import type React from "react";
import { Label } from "@/components/ui/label";

/** Wrapper padrão de rótulo + controle usado nas seções da simulação. */
export function Campo({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/** Asterisco de campo obrigatório. */
export function Ast() {
  return <span className="text-destructive">*</span>;
}

/** Mensagem de erro de validação de um campo, quando houver. */
export function Erro({ erros, campo }: { erros: Record<string, string>; campo: string }) {
  if (!erros[campo]) return null;
  return <p className="text-xs text-destructive">{erros[campo]}</p>;
}
