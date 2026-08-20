import { createClient } from '@supabase/supabase-js';
import { chamarIntegracao } from '../src/lib/simulacao/homefin.server';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function reprocessarPassivo() {
  console.log("Iniciando reprocessamento de 37 registros do Santander em 'P'...");

  const { data: pendentes, error } = await supabase
    .from('simulacao_bancos')
    .select('id, homefin_id_simulacao_banco, simulacao_id, nome_banco')
    .eq('status_banco', 'erro')
    .eq('nome_banco', 'Santander')
    .not('homefin_id_simulacao_banco', 'is', null)
    .filter('mensagem_banco', 'ilike', '%não retornou valores%');

  if (error) {
    console.error("Erro ao buscar pendentes:", error);
    return;
  }

  console.log(`Encontrados ${pendentes?.length || 0} registros para verificar.`);

  for (const b of (pendentes || [])) {
    try {
      const idSimulacao = b.homefin_id_simulacao_banco;
      // Precisamos do contexto da simulação pai para o chamarIntegracao
      const { data: sim } = await supabase
        .from('simulacoes')
        .select('homefin_id_oportunidade, user_id')
        .eq('id', b.simulacao_id)
        .single();

      if (!sim?.homefin_id_oportunidade) continue;

      const ctx = { userId: sim.user_id, supabase };
      
      const op = await chamarIntegracao<any>(
        `/oportunidade/${sim.homefin_id_oportunidade}`,
        "GET",
        undefined,
        ctx
      );

      const lista = op?.oportunidade?.simulacoes ?? op?.simulacoes ?? [];
      const achado = lista.find((s: any) => String(s?.idSimulacao ?? "") === String(idSimulacao));

      if (achado) {
        const situacao = String(achado?.tipoSituacao ?? achado?.situacao ?? "").toUpperCase();
        const parcela = achado?.valorParcelaBanco ?? achado?.valorParcelaBancoMax ?? achado?.valorParcelaSimulacao;
        
        if (parcela && Number(parcela) > 0) {
          console.log(`[FIX] Banco ${b.id} agora tem valores! Atualizando para 'simulada'.`);
          await supabase
            .from('simulacao_bancos')
            .update({
              status_banco: 'simulada',
              valor_parcela: Number(parcela),
              taxa_juros_ano: achado?.taxaJurosAnoBanco,
              taxa_cet_ano: achado?.taxaCetAnoBanco,
              valor_financiamento: achado?.valorFinanciamentoBanco ?? achado?.valorFinanciamentoBancoMax,
              mensagem_banco: null,
              raw_response: achado
            })
            .eq('id', b.id);
        } else if (situacao === 'P') {
          console.log(`[FIX] Banco ${b.id} continua em 'P'. Movendo para 'aguardando'.`);
          await supabase
            .from('simulacao_bancos')
            .update({
              status_banco: 'aguardando',
              mensagem_banco: 'O banco está processando a simulação. Aguarde o retorno.',
              raw_response: achado
            })
            .eq('id', b.id);
        }
      }
    } catch (e) {
      console.error(`Erro ao processar ${b.id}:`, e);
    }
  }
  console.log("Reprocessamento concluído.");
}

reprocessarPassivo();
