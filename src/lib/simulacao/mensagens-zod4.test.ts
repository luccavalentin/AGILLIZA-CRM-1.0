import { describe, expect, it } from "vitest";
import { completaSchema, participanteSchema } from "./schemas";

/* QA de 03/11/2026 (M5): no zod 4, `errorMap` e `invalid_type_error` são ignorados e a
   pessoa via "Invalid input". Com `error`, as mensagens voltam em português. */
const mensagens = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  Object.fromEntries((r.error?.issues ?? []).map((i) => [i.path.join("."), i.message]));

describe("mensagens da simulação em português", () => {
  it("consentimentos LGPD e SCR recusados", () => {
    const m = mensagens(completaSchema.safeParse({ consentimento_lgpd: false, consentimento_scr: false }));
    expect(m.consentimento_lgpd).toBe("É necessário aceitar o consentimento LGPD");
    expect(m.consentimento_scr).toBe("É necessário autorizar a consulta ao SCR/Bacen");
  });

  it("gênero do participante fora da lista", () => {
    const m = mensagens(participanteSchema.safeParse({ sexo: "X" }));
    expect(m.sexo).toBe("Selecione o gênero");
  });
});
