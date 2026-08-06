export function AbaBar({
  aba,
  onChange,
}: {
  aba: "documentos" | "checklist";
  onChange: (a: "documentos" | "checklist") => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-border/60 bg-muted/40 p-1 shadow-sm">
      <button
        type="button"
        onClick={() => onChange("documentos")}
        className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
          aba === "documentos"
            ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Pastas de documentos
      </button>
      <button
        type="button"
        onClick={() => onChange("checklist")}
        className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
          aba === "checklist"
            ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Checklist
      </button>
    </div>
  );
}
