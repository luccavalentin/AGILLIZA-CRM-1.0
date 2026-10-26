import { useEffect, useState } from "react";
import { moduloPermitido } from "@/lib/route-guards";
import { AvisoChatAgilliza } from "./aviso-chat-agilliza";

/**
 * Aviso flutuante do chat universal para quem usa o painel do correspondente (equipe e
 * parceiros, que usam as mesmas telas). Só aparece para quem pode usar o chat (`crm.chat`).
 */
export function AvisoChatUniversalEquipe() {
  const [pode, setPode] = useState(false);
  useEffect(() => {
    let vale = true;
    void moduloPermitido("crm.chat")
      .then((ok) => vale && setPode(ok))
      .catch(() => undefined);
    return () => {
      vale = false;
    };
  }, []);
  return <AvisoChatAgilliza canal="equipe" rotaChat="/crm/chat" habilitado={pode} />;
}
