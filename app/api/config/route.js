import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Usando as variáveis com prefixo NEXT_PUBLIC_ (como estão no .env.local)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Validação de ambiente
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY não definidas no .env.local'
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// GET: Buscar configurações
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'cemoa_config')
      .single();

    if (error) {
      // Se não encontrar registro, retorna vazio (sem erro)
      if (error.code === 'PGRST116') {
        return NextResponse.json({});
      }
      throw error;
    }

    return NextResponse.json(data?.valor || {});
  } catch (error) {
    console.error('Erro GET /api/config:', error);
    return NextResponse.json(
      { erro: 'Erro ao buscar configurações: ' + error.message },
      { status: 500 }
    );
  }
}

// POST: Salvar/atualizar configurações
export async function POST(request) {
  try {
    const dados = await request.json();

    // Validação: só aceita objeto válido (não array)
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
      return NextResponse.json(
        { erro: 'Dados inválidos: esperado um objeto.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('configuracoes')
      .upsert(
        {
          chave: 'cemoa_config',
          valor: dados,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'chave' }
      )
      .select();

    if (error) throw error;

    return NextResponse.json({
      sucesso: true,
      mensagem: 'Configurações salvas com sucesso',
      data,
    });
  } catch (error) {
    console.error('Erro POST /api/config:', error);
    return NextResponse.json(
      { erro: 'Erro ao salvar: ' + error.message },
      { status: 500 }
    );
  }
}