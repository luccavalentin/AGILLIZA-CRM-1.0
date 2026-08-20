import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { chamarIntegracao } from "../src/lib/simulacao/homefin.server";

async function run() {
  console.log("=== Iniciando Backfill Passivo P e Estado Civil ===");

  // 1. Corrigir Estado Civil 'casado' -> 'CA'
  const { data: casados, error: errCasados } = await supabaseAdmin
    .from("simulacoes")
    .select("id, numero_simulacao, estado_civil")
    .not("estado_civil", "in", '("CA","S","SO","DI","VI","UN")')
    .ilike("estado_civil", "casado");

  if (errCasados) console.error("Erro ao buscar casados:", errCasados);
  else {
    console.log(`Encontrados ${casados?.length || 0} registros com 'casado'. Convertendo para 'CA'...`);
    for (const s of casados || []) {
      const { error } = await supabaseAdmin
        .from("simulacoes")
        .update({ estado_civil: "CA" })
        .eq("id", s.id);
      if (error) console.error(`Erro no registro ${s.numero_simulacao}:`, error);
    }
  }

  // 2. Consultar registros 'P' com ID válido
  const { data: pendentes, error: errP } = await supabaseAdmin
    .from("simulacao_bancos")
    .select("id, homefin_id_simulacao_banco, simulacao_id, nome_banco, raw_response")
    .eq("status_banco", "erro")
    .not("homefin_id_simulacao_banco", "is", null)
    .filter("raw_response->>tipoSituacao", "eq", "P");

  if (errP) console.error("Erro ao buscar pendentes P:", errP);
  else {
    console.log(`Encontrados ${pendentes?.length || 0} registros 'P' para consulta...`);
    for (const b of pendentes || []) {
      try {
        const { data: sim } = await supabaseAdmin
          .from("simulacoes")
          .select("homefin_id_oportunidade")
          .eq("id", b.simulacao_id)
          .single();

        if (!sim?.homefin_id_oportunidade) continue;

        const op = await chamarIntegracao<any>(
          `/oportunidade/${sim.homefin_id_oportunidade}`,
          "GET",
          undefined,
          { simulacao_id: b.simulacao_id }
        );

        const lista = op?.oportunidade?.simulacoes ?? op?.simulacoes ?? [];
        const achado = lista.find((s: any) => String(s?.idSimulacao) === String(b.homefin_id_simulacao_banco));

        if (achado) {
          const situacao = String(achado.tipoSituacao || achado.situacao || "").toUpperCase();
          const parcela = achado.valorParcelaBanco || achado.valorParcelaSimulacao;
          
          if (parcela && Number(parcela) > 0) {
            console.log(`Banco ${b.id} (${b.nome_banco}) agora tem valor! Atualizando para simulada.`);
            await supabaseAdmin.from("simulacao_bancos").update({
              status_banco: "simulada",
              mensagem_banco: null,
              raw_response: achado,
              valor_parcela: parcela
            }).eq("id", b.id);
          } else if (situacao !== "P" && situacao !== "A") {
            // Se já concluiu (recusado/descartado), não faz nada aqui, mas o watchdog pode recalcular depois
          }
        }
      } catch (e) {
        // Ignora erros de 404/expiração
      }
    }
  }

  // 3. Recalcular status global de simulações que tenham bancos simulados mas status global de erro/enviando
  const { data: stuck } = await supabaseAdmin
    .from("simulacoes")
    .select("id, numero_simulacao, status, simulacao_bancos(status_banco, selecionado)")
    .in("status", ["enviando", "erro_banco"]);

  for (const s of stuck || []) {
    const lista = ((s.simulacao_bancos as any[]) || []).filter(b => b.selecionado !== false);
    if (lista.length === 0) continue;
    
    const aguardando = lista.some(b => b.status_banco === "aguardando" || b.status_banco === "enviando");
    if (!aguardando) {
      const sucesso = lista.filter(b => b.status_banco === "simulada").length;
      const novoStatus = sucesso === lista.length ? "simulada" : sucesso > 0 ? "parcialmente_simulada" : "erro_banco";
      if (novoStatus !== s.status) {
        console.log(`Simulação ${s.numero_simulacao} corrigindo status global: ${s.status} -> ${novoStatus}`);
        await supabaseAdmin.from("simulacoes").update({ status: novoStatus }).eq("id", s.id);
      }
    }
  }
  
  console.log("=== Backfill concluído ===");
}

run();
