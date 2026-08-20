
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Iniciando backfill de estado_civil para códigos HomeFin...');
  
  const mapa = {
    'solteiro': 'S',
    'casado': 'CA',
    'uniao_estavel': 'UE',
    'divorciado': 'DI',
    'separado': 'DI',
    'viuvo': 'VI'
  };

  for (const [rótulo, código] of Object.entries(mapa)) {
    const { count, error } = await supabase
      .from('simulacoes')
      .update({ estado_civil: código })
      .eq('estado_civil', rótulo);
    
    if (error) {
      console.error(`Erro ao converter ${rótulo}:`, error);
    } else {
      console.log(`Convertidos ${rótulo} -> ${código}`);
    }

    const { error: errConjuge } = await supabase
      .from('simulacoes')
      .update({ estado_civil_conjuge: código })
      .eq('estado_civil_conjuge', rótulo);
      
    if (errConjuge) console.error(`Erro ao converter cônjuge ${rótulo}:`, errConjuge);
  }

  console.log('Backfill concluído.');
}

run();
