import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const uf = searchParams.get('uf') || 'AM';
    const dias = parseInt(searchParams.get('dias') || '7');
    
    const hoje = new Date();
    const dataLimite = new Date(hoje);
    dataLimite.setDate(hoje.getDate() - dias);
    
    // Formato da data: YYYY-MM-DD
    const startDate = dataLimite.toISOString().split('T')[0];
    const endDate = hoje.toISOString().split('T')[0];
    
    // 🔥 URL alternativa - API do INPE via Queimadas (formato GeoJSON)
    // Usando o endpoint que retorna dados por estado
    const url = `https://queimadas.dgi.inpe.br/queimadas/api/focos/estado/${uf}?dataInicio=${startDate}&dataFim=${endDate}`;
    
    console.log('🌐 Buscando focos do INPE (via Queimadas):', url);
    
    const response = await fetch(url, {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; CEMOA/1.0)'
      },
    });
    
    if (!response.ok) {
      console.error('❌ Erro na resposta do INPE:', response.status);
      
      // Se a API oficial falhar, tenta a alternativa
      return await buscarFocosAlternativo(startDate, endDate, uf);
    }
    
    const dados = await response.json();
    console.log('✅ Focos recebidos (oficial):', dados.features?.length || dados.length || 0);
    
    // Processa os dados no formato GeoJSON (mais comum)
    let focos = [];
    if (dados.features) {
      focos = dados.features.map((f: any) => ({
        latitude: f.geometry.coordinates[1],
        longitude: f.geometry.coordinates[0],
        datahora: f.properties.data_hora || f.properties.datahora,
        municipio: f.properties.municipio || f.properties.nome,
        uf: f.properties.uf || uf,
        satelite: f.properties.satelite || f.properties.sat,
        confianca: f.properties.confianca || f.properties.conf,
        bioma: f.properties.bioma
      }));
    } else if (Array.isArray(dados)) {
      focos = dados;
    }
    
    return NextResponse.json({ 
      success: true, 
      total: focos.length,
      focos: focos,
      fonte: 'INPE - Programa Queimadas',
      periodo: `${startDate} a ${endDate}`
    });
  } catch (error) {
    console.error('❌ Erro na API de focos:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro ao buscar focos de calor do INPE',
        details: String(error)
      },
      { status: 500 }
    );
  }
}

// 🔄 Função alternativa usando a API do IndiMap
async function buscarFocosAlternativo(startDate: string, endDate: string, uf: string) {
  try {
    console.log('🔄 Tentando API alternativa (IndiMap)...');
    
    const url = `https://indimap.org/api/focos?startDate=${startDate}&endDate=${endDate}`;
    const response = await fetch(url, {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; CEMOA/1.0)'
      },
    });
    
    if (!response.ok) {
      throw new Error(`Erro na API alternativa: ${response.status}`);
    }
    
    const dados = await response.json();
    console.log('✅ Focos recebidos (alternativo):', dados.length);
    
    // Filtra por estado
    const focosFiltrados = Array.isArray(dados) 
      ? dados.filter((f: any) => f.uf === uf)
      : [];
    
    return NextResponse.json({ 
      success: true, 
      total: focosFiltrados.length,
      focos: focosFiltrados,
      fonte: 'IndiMap (alternativa)',
      periodo: `${startDate} a ${endDate}`
    });
  } catch (error) {
    console.error('❌ Erro na API alternativa:', error);
    
    // 🆘 Último recurso: dados mockados para teste
    return gerarDadosMock(startDate, endDate, uf);
  }
}

// 🆘 Dados mockados para teste (caso todas as APIs falhem)
function gerarDadosMock(startDate: string, endDate: string, uf: string) {
  console.log('📊 Gerando dados mockados para teste...');
  
  const municipios = [
    'Manaus', 'Parintins', 'Itacoatiara', 'Manacapuru', 'Coari',
    'Tefé', 'Humaitá', 'Lábrea', 'Novo Aripuanã', 'Borba',
    'Maués', 'Autazes', 'Careiro', 'Iranduba', 'Rio Preto da Eva'
  ];
  
  const focos = [];
  const hoje = new Date();
  const numFocos = Math.floor(Math.random() * 30) + 10; // 10-40 focos
  
  for (let i = 0; i < numFocos; i++) {
    const data = new Date(hoje);
    data.setDate(data.getDate() - Math.floor(Math.random() * 7));
    
    const lat = -2.5 - Math.random() * 6; // -2.5 a -8.5
    const lon = -57 - Math.random() * 12; // -57 a -69
    
    focos.push({
      latitude: lat,
      longitude: lon,
      datahora: data.toISOString(),
      municipio: municipios[Math.floor(Math.random() * municipios.length)],
      uf: uf,
      satelite: ['AQUA', 'TERRA', 'NOAA-20', 'NPP'][Math.floor(Math.random() * 4)],
      confianca: Math.floor(Math.random() * 40) + 60, // 60-100%
      bioma: 'Amazônia'
    });
  }
  
  return NextResponse.json({ 
    success: true, 
    total: focos.length,
    focos: focos,
    fonte: 'Dados mockados (todas as APIs falharam)',
    periodo: `${startDate} a ${endDate}`,
    aviso: 'Dados de exemplo para teste - API do INPE indisponível'
  });
}