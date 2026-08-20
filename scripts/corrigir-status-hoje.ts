
import { createClient } from "@supabase/supabase-js";

async function repararInconsistencias() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log("Iniciando reparação de status inconsistentes...");

  // Busca simulações criadas hoje que podem estar inconsistentes
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const { data: sims, error } = await supabase
    .from("simulacoes")
    .select("id, numero_simulacao, status, simulacao_bancos(status_banco, selecionado, valor_parcela)")
    .gte("created_at", hoje.toISOString())
    .is("deleted_at", null);

  if (error) {
    console.error("Erro ao buscar simulações:", error);
    return;
  }

  console.log(`Analisando ${sims?.length || 0} simulações...`);

  for (const sim of sims ?? []) {
    const bancos = ((sim.simulacao_bancos as any[]) || []).filter(b => b.selecionado !== false);
    if (bancos.length === 0) continue;

    const temAguardando = bancos.some(b => b.status_banco === "aguardando" || b.status_banco === "enviando");
    const totalComValor = bancos.filter(b => b.status_banco === "simulada" && Number(b.valor_parcela) > 0).length;
    const todosSimulados = totalComValor === bancos.length;

    let novoStatus: string | null = null;

    // Regra: se nenhum banco está em "aguardando", a simulação NÃO pode estar em "enviando"
    if (!temAguardando && sim.status === "enviando") {
      novoStatus = todosSimulados ? "simulada" : totalComValor > 0 ? "parcialmente_simulada" : "erro_banco";
    }

    // Regra: se algum banco tem valor_parcela > 0, a simulação NÃO pode estar em "erro_banco"
    if (totalComValor > 0 && sim.status === "erro_banco") {
      novoStatus = todosSimulados ? "simulada" : "parcialmente_simulada";
    }

    // Regra: SIM-001850 específico (2 de 2 com valor -> simulada)
    if (todosSimulados && sim.status !== "simulada") {
      novoStatus = "simulada";
    }

    if (novoStatus && novoStatus !== sim.status) {
      console.log(`Corrigindo ${sim.numero_simulacao}: ${sim.status} -> ${novoStatus} (Bancos: ${bancos.length}, Com valor: ${totalComValor})`);
      await supabase
        .from("simulacoes")
        .update({ status: novoStatus })
        .eq("id", sim.id);
    }
  }

  console.log("Reparação concluída.");
}

repararInconsistencias().catch(console.error);
