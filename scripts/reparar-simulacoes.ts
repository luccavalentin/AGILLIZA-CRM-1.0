import { createClient } from "@supabase/supabase-js";
import { chamarIntegracao, obterToken } from "../src/lib/simulacao/homefin.server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function recalcularStatus(simulacaoId: string) {
  const { data: bancos } = await supabase
    .from("simulacao_bancos")
    .select("status_banco")
    .eq("simulacao_id", simulacaoId);

  if (!bancos || bancos.length === 0) return;

  const listaStatus = bancos.map((b) => b.status_banco);
  const temAguardando = listaStatus.some((s) => s === "aguardando" || s === "enviando");
  
  if (temAguardando) return;

  const total = listaStatus.length;
  const sucesso = listaStatus.filter((s) => s === "simulada").length;
  const erro = listaStatus.filter((s) => s === "erro" || s === "expirada" || s === "erro_banco").length;

  let novoStatus = "erro_banco";
  if (sucesso === total) {
    novoStatus = "simulada";
  } else if (sucesso > 0) {
    novoStatus = "parcialmente_simulada";
  }

  console.log(`Atualizando SIM ${simulacaoId}: ${sucesso}/${total} sucessos -> ${novoStatus}`);
  await supabase.from("simulacoes").update({ status: novoStatus }).eq("id", simulacaoId);
}

async function run() {
  console.log("1. Recalculando status de simulações travadas...");
  const { data: travadas } = await supabase
    .from("simulacoes")
    .select("id, numero_simulacao")
    .eq("status", "enviando");

  for (const sim of travadas || []) {
    await recalcularStatus(sim.id);
  }

  console.log("\n2. Processando 68 registros 'P' do Santander...");
  // Consultar bancos que estão como 'erro' mas tem tipoSituacao 'P'
  const { data: pendentesP } = await supabase
    .from("simulacao_bancos")
    .select("*, simulacoes(correspondente_id)")
    .eq("status_banco", "erro")
    .eq("raw_response->>tipoSituacao", "P")
    .not("homefin_id_simulacao_banco", "is", null);

  console.log(`Encontrados ${pendentesP?.length || 0} registros 'P' para validar.`);

  for (const b of pendentesP || []) {
    try {
      const ctx = { 
        simulacao_id: b.simulacao_id, 
        correspondente_id: (b.simulacoes as any)?.correspondente_id 
      };
      
      console.log(`Consultando HomeFin ID ${b.homefin_id_simulacao_banco} (Banco: ${b.nome_banco})...`);
      const resp = await chamarIntegracao<any>(
        `/simulacao/${b.homefin_id_simulacao_banco}`,
        "GET",
        undefined,
        ctx
      );

      const dados = resp?.simulacao ?? resp ?? {};
      const tipo = dados.tipoSituacao;
      const valor = dados.valorParcelaBanco || dados.valorParcela;

      if (tipo === "S" && valor > 0) {
        console.log(`  -> SUCESSO! Valor encontrado: ${valor}. Atualizando para 'simulada'.`);
        await supabase.from("simulacao_bancos").update({
          status_banco: "simulada",
          valor_parcela: valor,
          valor_financiado: dados.valorFinanciadoBanco || dados.valorFinanciado,
          taxa_juros_mes: dados.taxaJurosMes,
          taxa_cet_mes: dados.taxaCetMes,
          taxa_cet_ano: dados.taxaCetAno,
          renda_minima_banco: dados.rendaMinimaSugerida,
          raw_response: dados,
          updated_at: new Date().toISOString()
        }).eq("id", b.id);
        
        await recalcularStatus(b.simulacao_id);
      } else {
        console.log(`  -> Ainda pendente ou sem valor (Status: ${tipo}).`);
      }
    } catch (e) {
      console.error(`  -> Erro ao consultar ID ${b.homefin_id_simulacao_banco}:`, e);
    }
  }

  console.log("\n3. Verificação de Watchdog (bancos aguardando > 10h)...");
  const dezHorasAtras = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
  const { data: muitoAntigos } = await supabase
    .from("simulacao_bancos")
    .select("id, simulacao_id, nome_banco")
    .eq("status_banco", "aguardando")
    .lt("updated_at", dezHorasAtras);

  for (const b of muitoAntigos || []) {
    console.log(`Marcando timeout em banco ${b.nome_banco} (${b.id}) da SIM ${b.simulacao_id}`);
    await supabase.from("simulacao_bancos").update({
      status_banco: "erro",
      mensagem_banco: "O banco não respondeu no tempo previsto. Clique em reenviar.",
      updated_at: new Date().toISOString()
    }).eq("id", b.id);
    await recalcularStatus(b.simulacao_id);
  }

  console.log("\nConcluído.");
}

run();
